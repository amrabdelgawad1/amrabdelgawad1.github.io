(function(){
  const $ = id => document.getElementById(id);
  const cfg = window.TRACKER_CONFIG || {};
  if (!/^https:\/\//.test(cfg.supabaseUrl || '') || !window.supabase) {
    $('gate').hidden = false;
    $('gateErr').textContent = "The tracker isn't connected yet. Let Amr know.";
    $('gateBtn').setAttribute('aria-busy', 'true');
    return;
  }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth:{ persistSession:false } });

  const CODE_KEY = 'tracker-company-code';
  const SHIFT_KEY = 'tracker-active-shift';
  // Live now: this phone or browser reports Run / Pause / Break / Off to Amr under the company code
  const DEVICE_KEY = 'tracker-device';
  let deviceId = null;
  try { deviceId = localStorage.getItem(DEVICE_KEY); if (!deviceId) { deviceId = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); localStorage.setItem(DEVICE_KEY, deviceId); } } catch(e){}
  function pushLive(force){
    if (!teamCode || !deviceId) return;
    const m = force || mode;
    if (m !== 'off' && !startedAt) return;
    db.rpc('code_live_update', {
      p_code: teamCode, p_device: deviceId, p_name: ($('nm').value || '').trim() || 'Team member',
      p_mode: m === 'pause' ? 'pau' : m, p_started_at: (startedAt || new Date()).toISOString(),
      p_work: Math.round(work), p_break: Math.round(brk)
    }).then(() => {}, () => {});
  }
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch(e){} },
    del(k){ try { localStorage.removeItem(k); } catch(e){} }
  };

  const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const clock = s => { s = Math.floor(s); return [Math.floor(s/3600), Math.floor(s%3600/60), s%60].map(x => String(x).padStart(2,'0')).join(':'); };
  const hm = s => Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';
  const hhmm = d => String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  const fmtDate = d => new Date(d+'T00:00').toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric' });
  const LABEL = { off:'Off', run:'Working', pause:'Paused', brk:'On break' };
  const CIRC = 326.7;
  // Shift length for the progress ring: picked on the page, remembered for each name on this device
  const LEN_KEY = 'tracker-shift-length';
  let GOAL = 8*3600;
  const lens = () => { try { return JSON.parse(store.get(LEN_KEY)) || {}; } catch(e){ return {}; } };
  const lenFor = name => lens()[(name || '').trim().toLowerCase()] || 8;
  function setLen(h){ GOAL = h*3600; $('len').value = String(h); }
  function saveLen(){ const m = lens(), n = $('nm').value.trim().toLowerCase(); if (n) { m[n] = GOAL/3600; store.set(LEN_KEY, JSON.stringify(m)); } }

  // ---------- team code gate ----------
  // The page only ever learns the company behind the code that was typed, never the others.
  const CO_KEY = 'tracker-company-name';
  let teamCode = store.get(CODE_KEY), companyName = store.get(CO_KEY) || '';

  function showGate(msg){
    $('app').hidden = true; $('gate').hidden = false;
    $('gateErr').textContent = msg || '';
    $('code').value = ''; $('code').focus();
  }
  function showApp(){ $('gate').hidden = true; $('app').hidden = false; $('coName').textContent = companyName; fillNames(savedAgents()); loadAgents(); }
  function setCompany(code, name){ teamCode = code; companyName = name; store.set(CODE_KEY, code); store.set(CO_KEY, name); $('coName').textContent = name; }

  $('gateForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('code').value.trim();
    if (!code) { $('gateErr').textContent = 'Enter the company code.'; return; }
    $('gateBtn').setAttribute('aria-busy', 'true'); $('gateErr').textContent = '';
    const { data, error } = await db.rpc('check_team_code', { p_code: code });
    $('gateBtn').removeAttribute('aria-busy');
    if (error) { $('gateErr').textContent = "Couldn't reach the server. Check your connection and try again."; return; }
    if (!data) { $('gateErr').textContent = "That code isn't right. Check it with Amr."; return; }
    setCompany(code, data); showApp();
  });
  $('code').addEventListener('input', () => $('gateErr').textContent = '');
  $('switchCo').addEventListener('click', () => {
    if (mode !== 'off') { $('switchMsg').hidden = false; return; }
    store.del(CODE_KEY); store.del(CO_KEY); teamCode = null; companyName = ''; showGate();
  });

  // ---------- name: pick from the agents list, or type it under "Someone else" ----------
  // The list is the agents Amr added on Team > Agents for this code's company, shown as "01 - Name".
  // The last list is kept on the device for a bad connection; config.js names are the last resort.
  const OTHER = '__other', AGENTS_KEY = 'tracker-agents';
  let TEAM = [];
  function fillNames(list){
    TEAM = list;
    const sel = $('nmSel');
    sel.innerHTML = '<option value="">Choose your name</option>';
    TEAM.forEach(p => { const o = document.createElement('option'); o.value = p.name; o.textContent = p.label; sel.appendChild(o); });
    const o = document.createElement('option'); o.value = OTHER; o.textContent = 'Someone else'; sel.appendChild(o);
    syncName();
  }
  function savedAgents(){
    let s = null; try { s = JSON.parse(store.get(AGENTS_KEY)); } catch(e){}
    if (s && s.code === teamCode && Array.isArray(s.list)) return s.list;
    return (cfg.teamNames || []).map(n => n.trim()).filter(Boolean).map(n => ({ name: n, label: n }));
  }
  async function loadAgents(){
    if (!teamCode) return;
    const { data, error } = await db.rpc('team_agents', { p_code: teamCode });
    if (error) return; // keep the saved list
    const list = (data || []).map(a => ({ name: a.name.trim(), label: String(a.agent_no).padStart(2, '0') + ' - ' + a.name.trim() }));
    store.set(AGENTS_KEY, JSON.stringify({ code: teamCode, list }));
    fillNames(list);
  }
  // Show the typed name in the list when it matches someone on it
  function syncName(){
    const v = $('nm').value.trim(), hit = TEAM.find(p => p.name.toLowerCase() === v.toLowerCase());
    if (hit) { $('nmSel').value = hit.name; $('nm').value = hit.name; $('nm').hidden = true; }
    else if (v) { $('nmSel').value = OTHER; $('nm').hidden = false; }
    else { $('nmSel').value = TEAM.length ? '' : OTHER; $('nm').hidden = !!TEAM.length; }
  }
  $('nmSel').addEventListener('change', () => {
    const v = $('nmSel').value;
    $('err').textContent = '';
    if (v === OTHER) { $('nm').value = ''; $('nm').hidden = false; $('nm').focus(); }
    else { $('nm').value = v; $('nm').hidden = true; }
    if (mode === 'off') { setLen(lenFor($('nm').value)); draw(); }
  });
  $('len').addEventListener('change', () => { GOAL = Number($('len').value)*3600; saveLen(); persist(); draw(); });

  // ---------- shift state (kept on this device so closing the tab doesn't lose it) ----------
  let mode = 'off', work = 0, brk = 0, segs = [], startedAt = null, last = Date.now(), saving = false;
  // A shift left running with the page closed (or the laptop asleep) for this long asks before counting it
  const GAP_ASK = 3 * 3600;
  let gapSnap = null;

  function persist(){
    if (mode === 'off') { store.del(SHIFT_KEY); return; }
    store.set(SHIFT_KEY, JSON.stringify({ mode, work, brk, segs, startedAt: startedAt.toISOString(), last, name: $('nm').value, date: $('dt').value, len: GOAL/3600, gap: gapSnap }));
  }
  function restore(){
    let s = null; try { s = JSON.parse(store.get(SHIFT_KEY)); } catch(e){}
    if (!s || !s.mode || s.mode === 'off') return false;
    $('nm').value = s.name || ''; $('dt').value = s.date || iso(new Date());
    syncName();
    setLen(s.len || lenFor(s.name));
    work = s.work || 0; brk = s.brk || 0; segs = s.segs || []; startedAt = new Date(s.startedAt);
    last = s.last || Date.now(); gapSnap = s.gap || null;
    applyMode(s.mode);
    advance(); // count the time that passed while the page was closed (a long gap asks first)
    if (gapSnap) showGap();
    return true;
  }

  function showGap(){
    const away = Math.max(0, (Date.now() - gapSnap.seenAt) / 1000), seen = hhmm(new Date(gapSnap.seenAt));
    $('gapMsg').textContent = 'This shift kept running for ' + hm(away) + ' while the page was closed (since ' + seen + '). Were you working all that time?';
    $('gapDrop').textContent = 'No, end my shift at ' + seen;
    $('gapCheck').hidden = false;
  }
  $('gapKeep').addEventListener('click', () => { gapSnap = null; $('gapCheck').hidden = true; persist(); });
  $('gapDrop').addEventListener('click', () => {
    if (!gapSnap) return;
    const snap = gapSnap; gapSnap = null; $('gapCheck').hidden = true;
    work = snap.work; brk = snap.brk; segs = snap.segs; last = Date.now();
    draw(); finish(new Date(snap.seenAt));
  });

  function applyMode(m){
    mode = m; document.body.dataset.mode = m;
    if (m === 'off') { $('endAsk').hidden = true; $('switchMsg').hidden = true; }
    $('status').querySelector('span').textContent = LABEL[m];
    document.querySelectorAll('.ctl').forEach(b => b.classList.toggle('on', b.dataset.k === m));
    const locked = m !== 'off';
    $('nm').disabled = locked; $('nmSel').disabled = locked; $('dt').disabled = locked;
    document.querySelector('[data-k="pause"]').setAttribute('aria-disabled', m === 'off');
    $('runLbl').textContent = (m === 'pause' || m === 'brk') ? 'Resume' : 'Run';
    draw();
  }

  function setMode(m){
    if (m === mode) return;
    advance();
    if (mode === 'off') { startedAt = new Date(); work = brk = 0; segs = []; }
    segs.push({ k:m, t:0 });
    applyMode(m); persist(); pushLive();
  }

  function valid(){
    if (!$('nmSel').value) { $('err').textContent = 'Choose your name to start.'; $('nmSel').focus(); return false; }
    if ($('nm').value.trim().length < 2) { $('err').textContent = 'Type your full name to start.'; $('nm').focus(); return false; }
    if (!$('dt').value) { $('err').textContent = 'Pick the date you are covering.'; return false; }
    return true;
  }
  $('nm').addEventListener('input', () => $('err').textContent = '');
  let dtPicked = false;
  ['input','change'].forEach(ev => $('dt').addEventListener(ev, () => { dtPicked = true; }));

  document.querySelectorAll('.ctl').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'off') {
      // Ask on the page first; a shift that already failed to save goes straight to saving again
      if (mode === 'off' || saving) return;
      if (pending) return finish();
      $('endAsk').hidden = false; $('endYes').focus();
      return;
    }
    $('endAsk').hidden = true;
    if (mode === 'off' && !valid()) return;
    if (mode === 'off') {
      $('saved').hidden = true; store.set('tracker-name', $('nm').value.trim()); saveLen();
      // A page left open overnight still shows yesterday; move it to today unless they picked a date
      if (!dtPicked) $('dt').value = iso(new Date());
    }
    setMode(k);
  }));

  // ---------- end shift + save online ----------
  let pending = null;

  // endAt: when the shift really ended (from the "page was closed" check); otherwise now
  async function finish(endAt){
    if (mode === 'off' || saving) return;
    $('endAsk').hidden = true;
    advance();
    if (!pending) {
      pending = {
        p_code: teamCode,
        p_name: $('nm').value.trim(),
        p_shift_date: $('dt').value,
        p_work_seconds: Math.round(work),
        p_break_seconds: Math.round(brk),
        p_started_at: startedAt.toISOString(),
        p_ended_at: (endAt || new Date()).toISOString()
      };
      // freeze the clock while saving
      segs.push({ k:'pause', t:0 }); applyMode('pause');
      document.querySelectorAll('.ctl').forEach(b => b.setAttribute('aria-busy', 'true'));
    }
    saving = true; $('offLbl').textContent = 'Saving…'; $('saveErr').hidden = true;
    const { error } = await db.rpc('log_shift', pending);
    saving = false; $('offLbl').textContent = 'Off';

    if (error) {
      const badCode = error.code === '28000' || /team code/i.test(error.message || '');
      $('saveErrMsg').textContent = badCode
        ? 'The team code changed. Enter the new code, then press Try again. Your shift is kept.'
        : "Couldn't save your shift. Check your connection and press Try again. Your shift is kept.";
      $('saveErr').hidden = false;
      if (badCode) { store.del(CODE_KEY); $('saveErrMsg').textContent = 'The company code changed. Get the new code from Amr, type it below, then press Save shift. Your shift is kept.'; $('retry').textContent = 'Save shift'; $('newCode').hidden = false; $('newCode').focus(); }
      persist();
      return;
    }

    const p = pending; pending = null;
    pushLive('off');
    document.querySelectorAll('.ctl').forEach(b => b.removeAttribute('aria-busy'));
    work = brk = 0; segs = []; startedAt = null;
    applyMode('off'); persist();
    $('savedSub').textContent = p.p_name + ' · ' + fmtDate(p.p_shift_date) + (companyName ? ' · ' + companyName : '');
    $('svW').textContent = clock(p.p_work_seconds);
    $('svB').textContent = clock(p.p_break_seconds);
    $('svC').textContent = hhmm(new Date(p.p_started_at)) + '–' + hhmm(new Date(p.p_ended_at));
    const card = $('saved'); card.hidden = true; void card.offsetWidth; card.hidden = false;
    card.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  $('retry').addEventListener('click', async () => {
    if (!store.get(CODE_KEY)) {
      const code = $('newCode').value.trim();
      if (!code) { $('saveErrMsg').textContent = 'Type the new company code from Amr first. Your shift is kept.'; $('newCode').focus(); return; }
      $('retry').setAttribute('aria-busy', 'true');
      const { data, error } = await db.rpc('check_team_code', { p_code: code });
      $('retry').removeAttribute('aria-busy');
      if (error) { $('saveErrMsg').textContent = "Couldn't reach the server. Check your connection and try again. Your shift is kept."; return; }
      if (!data) { $('saveErrMsg').textContent = "That code isn't right. Check it with Amr. Your shift is kept."; $('newCode').select(); return; }
      setCompany(code, data);
      pending.p_code = teamCode; $('retry').textContent = 'Try again';
      $('newCode').hidden = true; $('newCode').value = '';
    }
    finish();
  });
  $('newCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('retry').click(); });
  $('endYes').addEventListener('click', () => finish());
  $('endNo').addEventListener('click', () => { $('endAsk').hidden = true; });

  // ---------- Amr's Pause / Break / Resume / End from Live now ----------
  // Checked every 30 seconds while a shift runs. An End is already saved on Amr's side, so this copy is dropped, not sent again.
  let checking = false;
  async function checkRemote(){
    if (mode === 'off' || !teamCode || !deviceId || checking || pending) return;
    checking = true;
    const { data, error } = await db.rpc('code_live_check', { p_code: teamCode, p_device: deviceId });
    checking = false;
    const c = !error && data && data[0];
    if (!c || mode === 'off' || pending) return;
    if (c.command === 'end') {
      advance();
      const end = c.end_at ? new Date(c.end_at) : new Date(), over = Math.max(0, (Date.now() - end) / 1000);
      const w = Math.max(0, work - (mode === 'run' ? over : 0)), b = Math.max(0, brk - (mode === 'brk' ? over : 0));
      const name = $('nm').value.trim(), date = $('dt').value, start = startedAt;
      work = brk = 0; segs = []; startedAt = null; gapSnap = null; $('gapCheck').hidden = true;
      applyMode('off'); persist(); pushLive('off');
      $('savedSub').textContent = 'Amr ended this shift at ' + hhmm(end) + ' and saved it for you · ' + name + ' · ' + fmtDate(date);
      $('svW').textContent = clock(w); $('svB').textContent = clock(b);
      $('svC').textContent = (start ? hhmm(start) : '--:--') + '–' + hhmm(end);
      const card = $('saved'); card.hidden = true; void card.offsetWidth; card.hidden = false;
      card.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    const m = c.command === 'pau' ? 'pause' : c.command;
    if (!LABEL[m]) return;
    if (m !== mode) setMode(m); else pushLive(); // reporting the asked-for mode clears Amr's request
  }

  // ---------- clock ----------
  function advance(){
    const now = Date.now(), dt = Math.max(0, (now - last) / 1000);
    if (dt > GAP_ASK && (mode === 'run' || mode === 'brk') && !gapSnap && !pending) {
      gapSnap = { work, brk, segs: segs.map(s => ({ ...s })), seenAt: last };
      if (!$('app').hidden || teamCode) setTimeout(showGap);
    }
    last = now;
    if (mode === 'run') work += dt;
    if (mode === 'brk') brk += dt;
    if (mode !== 'off' && segs.length) segs[segs.length-1].t += dt;
  }

  function draw(){
    $('wk').textContent = clock(work);
    $('prog').style.strokeDashoffset = CIRC * (1 - Math.min(work/GOAL, 1));
    $('goal').textContent = work >= GOAL ? 'Shift goal reached' : 'of your ' + GOAL/3600 + 'h shift';
    $('sW').textContent = clock(work); $('sB').textContent = clock(brk);
    $('sS').textContent = startedAt ? hhmm(startedAt) : '--:--';
    const bar = $('bar'); bar.innerHTML = '';
    segs.forEach(s => { const e = document.createElement('span'); e.className = 'seg-'+s.k; e.style.flexGrow = Math.max(s.t, 0.5); bar.appendChild(e); });
    $('segCount').textContent = segs.length ? segs.length+' segment'+(segs.length>1?'s':'') : 'Not started';
  }

  let tickCount = 0;
  setInterval(() => {
    advance();
    if (mode !== 'off') { draw(); if (++tickCount % 20 === 0) persist(); if (tickCount % 1200 === 0) pushLive(); if (tickCount % 120 === 0 && !document.hidden) checkRemote(); } // live every 5 minutes, Amr's requests every 30 seconds
  }, 250);
  window.addEventListener('pagehide', () => { advance(); persist(); });
  document.addEventListener('visibilitychange', () => { advance(); persist(); draw(); if (!document.hidden) checkRemote(); });

  // ---------- two tabs open: each keeps its own copy of the shift and saves over the other ----------
  // Tabs on this device say hello every few seconds; while another one is open, a warning shows.
  // A closed tab can't always say goodbye, so one that goes quiet for 70 seconds counts as closed
  // (browsers slow a background tab down to about one tick a minute).
  const others = new Map();
  if (window.BroadcastChannel) {
    const tabId = Math.random().toString(36).slice(2), ch = new BroadcastChannel('tracker-tabs');
    const showTabs = () => {
      const now = Date.now();
      others.forEach((seen, id) => { if (now - seen > 70000) others.delete(id); });
      $('twoTabs').hidden = !others.size;
    };
    ch.onmessage = e => {
      const m = e.data || {};
      if (!m.id || m.id === tabId) return;
      if (m.t === 'bye') others.delete(m.id); else others.set(m.id, Date.now());
      if (m.t === 'hi') ch.postMessage({ t:'here', id: tabId });
      showTabs();
    };
    ch.postMessage({ t:'hi', id: tabId });
    setInterval(() => { ch.postMessage({ t:'here', id: tabId }); showTabs(); }, 4000);
    window.addEventListener('pagehide', () => ch.postMessage({ t:'bye', id: tabId }));
    window.addEventListener('pageshow', e => { if (e.persisted) ch.postMessage({ t:'hi', id: tabId }); });
  }

  // ---------- start ----------
  $('dt').value = iso(new Date());
  $('nm').value = store.get('tracker-name') || '';
  syncName();
  setLen(lenFor($('nm').value));
  document.querySelector('[data-k="pause"]').setAttribute('aria-disabled', 'true');
  const resumed = restore();
  if (resumed) { pushLive(); checkRemote(); }
  draw();
  if (teamCode || resumed) showApp(); else showGate();
})();
