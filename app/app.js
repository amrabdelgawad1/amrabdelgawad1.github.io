// Talents app: one sign-in for everyone.
// Team members get the tracker and their own history. Amr (owner) gets the menu:
// Live now, his /cash pages, and Invite and access.
(function(){
  const $ = id => document.getElementById(id);
  const cfg = window.TRACKER_CONFIG || {};
  // v changes with each release of the cash page, so the app never shows a stale copy
  const CASH_URL = window.APP_CASH_URL || '../cash/?embed=1&v=36';

  // An invite or new sign-in link lands here with its type in the address; read it before supabase-js clears it
  const linkType = new URLSearchParams(location.hash.slice(1)).get('type');
  // Emailed and WhatsApp links point at amrabdelgawad.site/app/?token_hash=...&type=invite|recovery
  const qs = new URLSearchParams(location.search), tokenHash = qs.get('token_hash'), tokenType = qs.get('type');
  const linkError = new URLSearchParams(location.hash.slice(1)).get('error_description');
  // Came from the old /tracker page: say where the clock went
  if (qs.get('from') === 'tracker') { $('movedNote').hidden = false; history.replaceState(null, '', location.pathname + location.hash); }

  const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const hm = s => Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';
  const clock = s => { s = Math.max(0, Math.floor(s)); return [s / 3600 | 0, (s % 3600) / 60 | 0, s % 60].map(n => String(n).padStart(2, '0')).join(':'); };
  const hhmm = d => String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  const usd = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const egp = n => 'EGP ' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const dayDate = d => new Date(d + 'T00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  const monthLabel = m => new Date(m + '-01T00:00').toLocaleDateString('en-US', { month:'long', year:'numeric' });
  const initials = n => (n || '?').split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const setMoney = (el, n) => { const t = usd(n), m = t.match(/^(.*[0-9])([.][0-9][0-9])$/); el.textContent = m ? m[1] : t; if (m) { const c = document.createElement('span'); c.className = 'c'; c.textContent = m[2]; el.appendChild(c); } };

  const VIEWS = ['vLoad', 'vLogin', 'vSetPw', 'vMfa', 'vNoAccess', 'vApp'];
  function show(v){ VIEWS.forEach(x => $(x).hidden = x !== v); }
  let toastTimer = null;
  function toast(msg){ $('toastMsg').textContent = msg; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500); }
  function notice(msg){ $('notice').textContent = msg || ''; $('notice').hidden = !msg; }

  if (!/^https:\/\//.test(cfg.supabaseUrl || '') || !window.supabase) { show('vLogin'); $('loginErr').textContent = 'The app isn’t connected yet.'; return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  let role = null, profile = null, user = null;
  let access = []; // extra sections Amr switched on for this team member: live, requests, team, money

  // What account.js (the circle menu, profile and Settings) needs from here
  window.TalentsApp = {
    db, toast, esc, initials,
    get role(){ return role; }, get user(){ return user; }, get profile(){ return profile; }, get access(){ return access; },
    signOut: () => signOut(),
    agentsChanged: () => { if (canSee('team')) loadTeamMenu(); liveSig = ''; },
    fxChanged: () => { loadFx(); try { const w = $('cashFrame').contentWindow; if (w && w.reloadFx) w.reloadFx(); } catch(e){} }
  };
  const signedIn = () => document.dispatchEvent(new Event('talents-signed-in'));

  // ---------- sign in ----------
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const em = $('em').value.trim(), pw = $('pw').value;
    if (!em.includes('@')) { $('loginErr').textContent = 'Enter your email address.'; return; }
    if (!pw) { $('loginErr').textContent = 'Enter your password.'; return; }
    $('loginBtn').setAttribute('aria-busy', 'true');
    const { error } = await db.auth.signInWithPassword({ email: em, password: pw });
    $('loginBtn').removeAttribute('aria-busy');
    $('pw').value = '';
    if (error) { $('loginErr').textContent = /invalid/i.test(error.message) ? "That email and password don't match." : /banned/i.test(error.message) ? 'Your access was switched off. Ask Amr if that’s a mistake.' : "Couldn't sign in. Check your connection and try again."; return; }
    route();
  });
  ['em', 'pw'].forEach(id => $(id).addEventListener('input', () => $('loginErr').textContent = ''));
  document.querySelectorAll('[data-signout]').forEach(b => b.addEventListener('click', signOut));
  async function signOut(){
    stopTimers();
    await db.auth.signOut();
    role = null; profile = null; closeMenu();
    document.dispatchEvent(new Event('talents-signed-out'));
    show('vLogin');
  }

  // ---------- set a password from an invite or new sign-in link ----------
  $('pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const a = $('pw1').value, b = $('pw2').value;
    if (a.length < 8) { $('pwErr').textContent = 'Use at least 8 characters.'; return; }
    if (a !== b) { $('pwErr').textContent = 'The two passwords don’t match.'; return; }
    $('pwBtn').setAttribute('aria-busy', 'true');
    const { error } = await db.auth.updateUser({ password: a });
    $('pwBtn').removeAttribute('aria-busy');
    if (error) { $('pwErr').textContent = /same/i.test(error.message) ? 'That’s your current password. Pick a new one.' : "Couldn't save it. The link may have expired; ask Amr for a new one."; return; }
    $('pw1').value = ''; $('pw2').value = '';
    toast('Password saved');
    route();
  });
  ['pw1', 'pw2'].forEach(id => $(id).addEventListener('input', () => $('pwErr').textContent = ''));

  // ---------- owner: authenticator code ----------
  let mfaFactor = null;
  $('mfaForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('mfaCode').value.replace(/\D/g, '');
    if (code.length !== 6) { $('mfaErr').textContent = 'Enter the 6-digit code from your app.'; return; }
    if (!$('mfaWhichWrap').hidden) mfaFactor = $('mfaWhich').value;
    $('mfaBtn').setAttribute('aria-busy', 'true');
    const { error } = await db.auth.mfa.challengeAndVerify({ factorId: mfaFactor, code });
    $('mfaBtn').removeAttribute('aria-busy');
    if (error) { $('mfaErr').textContent = "That code didn't work. Codes change every 30 seconds, so try the one showing now."; $('mfaCode').select(); return; }
    $('mfaCode').value = '';
    route();
  });
  $('mfaCode').addEventListener('input', () => $('mfaErr').textContent = '');

  // ---------- who is this, and what do they get ----------
  async function route(){
    const { data: { session } } = await db.auth.getSession();
    if (!session) { show('vLogin'); return; }
    user = session.user;

    // Owner accounts have an authenticator: ask for the code before anything else
    const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      const { data: f } = await db.auth.mfa.listFactors();
      const apps = ((f && f.totp) || []).filter(x => x.status === 'verified');
      mfaFactor = apps[0] && apps[0].id;
      $('mfaWhichWrap').hidden = apps.length < 2;
      $('mfaWhich').innerHTML = '';
      apps.forEach(x => { const o = document.createElement('option'); o.value = x.id; o.textContent = /^Cash \d+$/.test(x.friendly_name || '') || !x.friendly_name ? 'Authenticator app' : x.friendly_name; $('mfaWhich').appendChild(o); });
      show('vMfa'); $('mfaCode').focus();
      return;
    }

    const { data: isOwner } = await db.rpc('is_tracker_admin');
    if (isOwner === true) {
      try { localStorage.setItem('nocount', '1'); } catch(e) {} // Amr's own devices don't count as website visitors
      role = 'owner'; startOwner(); return;
    }

    const { data: prof, error } = await db.rpc('my_profile');
    profile = Array.isArray(prof) ? prof[0] : prof;
    if (error || !profile) { $('noAccessMsg').textContent = 'This account isn’t set up for the tracker. Ask Amr to invite you.'; show('vNoAccess'); return; }
    if (!profile.active) { $('noAccessMsg').textContent = 'Your access was switched off. Ask Amr if that’s a mistake.'; show('vNoAccess'); return; }
    const acc = await db.from('members').select('access').eq('user_id', user.id).maybeSingle();
    access = (!acc.error && acc.data && acc.data.access) || [];
    role = 'member'; startMember();
  }

  // ======================================================================
  // Team member: tracker + own history
  // ======================================================================
  let live = null; // { mode, started_at, work_seconds, break_seconds, seg_at } while clocked in
  let tickTimer = null, liveTimer = null, liveDrawTimer = null, memberSyncTimer = null;
  const LBL = { off:['Off', 's-off'], run:['Working', 's-run'], pau:['Paused', 's-pau'], brk:['On break', 's-brk'] };
  const segSecs = () => live ? Math.max(0, (Date.now() - new Date(live.seg_at).getTime()) / 1000) : 0;
  const workNow = () => live ? live.work_seconds + (live.mode === 'run' ? segSecs() : 0) : 0;
  const breakNow = () => live ? live.break_seconds + (live.mode === 'brk' ? segSecs() : 0) : 0;
  const LOCAL = 'talents-live', DIRTY = 'talents-live-unsent';
  function keepLocal(){ try { live ? localStorage.setItem(LOCAL, JSON.stringify(live)) : localStorage.removeItem(LOCAL); } catch(e){} }
  // Only a copy that never reached the database counts; otherwise the database is the truth
  // (a shift ended on another phone must not come back here)
  const setDirty = on => { try { on ? localStorage.setItem(DIRTY, '1') : localStorage.removeItem(DIRTY); } catch(e){} };
  const isDirty = () => { try { return localStorage.getItem(DIRTY) === '1'; } catch(e){ return false; } };
  // Pick up a Run, Pause or Off pressed on another device, or by Amr from Live now
  async function syncLive(tell){
    const { data, error } = await db.from('live_status').select('*').eq('user_id', user.id).maybeSingle();
    if (error || isDirty()) return false;
    const before = live;
    live = data || null; keepLocal(); drawClock();
    if (tell && before && !live) { toast('Your shift was ended from another device or by Amr. It’s saved in your history.'); loadHistory(); laterBrief(before.started_at); }
    else if (tell && before && live && before.mode !== live.mode) toast('Your shift is now: ' + LBL[live.mode][0]);
    return true;
  }

  async function startMember(){
    show('vApp');
    const extra = access.length > 0;
    if (location.hash && !extra) history.replaceState(null, '', location.pathname); // without extra access, team members have one page
    $('burger').hidden = !extra; $('drawer').hidden = !extra;
    $('me').textContent = initials(profile.name); $('me').classList.remove('owner');
    $('title').textContent = 'Tracker';
    $('pTrack').hidden = false; ['pLive', 'pPeople', 'pCash'].forEach(p => $(p).hidden = true);
    $('tCompany').textContent = profile.company_name || 'No company yet';
    // The clock lives in the database, so you can start on one device and stop on another
    const { data, error } = await db.from('live_status').select('*').eq('user_id', user.id).maybeSingle();
    let local = null; try { local = JSON.parse(localStorage.getItem(LOCAL) || 'null'); } catch(e){}
    const unsent = isDirty() && local;
    live = unsent ? local : error ? local : data || null;
    if (unsent) saveLive(); // offline earlier: push this device's copy up
    else if (!error) keepLocal();
    drawClock();
    clearInterval(tickTimer); tickTimer = setInterval(drawClock, 1000);
    clearInterval(memberSyncTimer); memberSyncTimer = setInterval(() => { if (!document.hidden) syncLive(true); }, 30000);
    loadHistory();
    loadRequests();
    loadFx().then(() => loadHistory());
    if (extra) startMenu();
    signedIn();
  }

  // After 10 hours on the clock, ask whether they're still working
  const GUARD_SECS = 10 * 3600, GUARD_KEY = 'talents-guard-ok-until';
  function drawGuard(){
    const since = live ? (Date.now() - new Date(live.started_at).getTime()) / 1000 : 0;
    let okUntil = 0; try { okUntil = Number(localStorage.getItem(GUARD_KEY) || 0); } catch(e){}
    const show = !!live && since > GUARD_SECS && Date.now() > okUntil;
    if ($('guard').hidden === !show) return;
    $('guard').hidden = !show;
    if (show) { $('guardText').textContent = 'You clocked in at ' + hhmm(new Date(live.started_at)) + ', ' + hm(since) + ' ago. If you finished earlier and forgot to press Off, set the time you stopped.'; $('guardForm').hidden = true; }
  }
  $('guardYes').addEventListener('click', () => { try { localStorage.setItem(GUARD_KEY, String(Date.now() + 2 * 3600e3)); } catch(e){} $('guard').hidden = true; });
  $('guardFix').addEventListener('click', () => { $('guardForm').hidden = false; $('guardEnd').value = ''; $('guardEnd').focus(); });
  $('guardEnd').addEventListener('input', () => $('guardErr').textContent = '');
  $('guardForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!live) return;
    const v = $('guardEnd').value;
    if (!v) { $('guardErr').textContent = 'Pick the time you finished.'; return; }
    const start = new Date(live.started_at), [hh, mm] = v.split(':').map(Number);
    const end = new Date(start); end.setHours(hh, mm, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1); // finished after midnight
    if (end > new Date()) { $('guardErr').textContent = 'That time hasn’t happened yet.'; return; }
    // Count the work up to that time, never more than the clock has
    const work = Math.round(Math.max(0, Math.min(workNow(), (end - start) / 1000 - live.break_seconds)));
    if (work < 60) { $('guardErr').textContent = 'That would be less than a minute of work. Pick a later time.'; return; }
    const b = await askBrief(work, live.break_seconds, end);
    if (b == null || !live) return;
    $('guardSave').setAttribute('aria-busy', 'true');
    const { error } = await db.rpc('member_log_shift', Object.assign({
      p_shift_date: iso(start), p_work_seconds: Math.min(work, 86400), p_break_seconds: live.break_seconds,
      p_started_at: live.started_at, p_ended_at: end.toISOString(), p_brief: b.note
    }, numArgs(b.nums)));
    $('guardSave').removeAttribute('aria-busy');
    if (error) { $('guardErr').textContent = "Couldn't save it. Check your connection and try again."; return; }
    live = null; keepLocal(); forgetBrief(); $('guard').hidden = true; drawClock();
    toast('Shift saved: ' + hm(work) + ', ended ' + v);
    loadHistory();
  });

  function drawClock(){
    drawGuard();
    const mode = live ? live.mode : 'off';
    $('tStatus').className = 'status ' + LBL[mode][1]; $('tStatus').querySelector('span').textContent = LBL[mode][0];
    $('tClock').textContent = clock(workNow());
    document.querySelectorAll('.ctl').forEach(b => {
      b.classList.toggle('on', b.dataset.m === mode);
      if (b.dataset.m !== 'run') b.setAttribute('aria-disabled', String(!live));
    });
    $('runLbl').textContent = live && live.mode !== 'run' ? 'Resume' : 'Run';
    if (!profile.company_id) { $('tSub').textContent = 'Amr needs to set the company you work for before you can clock in.'; return; }
    if (!live) { $('tSub').textContent = 'Press Run to start your shift'; return; }
    const since = hhmm(new Date(live.started_at));
    $('tSub').textContent = (mode === 'run' ? 'Working since ' : mode === 'brk' ? 'On break · shift started ' : 'Paused · shift started ') + since + (breakNow() >= 1 ? ' · break ' + clock(breakNow()) : '');
  }

  async function saveLive(){
    keepLocal();
    const { error } = live
      ? await db.from('live_status').upsert(Object.assign({ user_id: user.id, updated_at: new Date().toISOString() }, live))
      : await db.from('live_status').delete().eq('user_id', user.id);
    setDirty(!!error);
    $('tErr').textContent = error ? 'Saved on this phone only. Check your connection; it will catch up.' : '';
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && role === 'member') syncLive(true); });

  document.querySelectorAll('.ctl').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
  async function setMode(m){
    if (!profile || !profile.company_id) return;
    if (m === 'off') return finish();
    if (live) await syncLive(true); // Amr may have changed it from Live now
    const now = new Date();
    if (!live) live = { mode:m, started_at: now.toISOString(), work_seconds:0, break_seconds:0, seg_at: now.toISOString() };
    else if (live.mode !== m) {
      live.work_seconds = Math.round(workNow()); live.break_seconds = Math.round(breakNow());
      live.mode = m; live.seg_at = now.toISOString();
    }
    drawClock(); await saveLive();
  }

  // "End your shift?" with a required brief about the day. Resolves the brief, or null when they keep working.
  // A sent brief stays on this device until the shift saves, so a failed save doesn't make them type it again.
  // Optional numbers for the day go with the brief; they feed Amr's weekly scoreboard. Empty boxes are saved as "not given".
  const BRIEF_KEY = 'talents-brief', NUMS_KEY = 'talents-brief-nums';
  const numBoxes = draft => [
    { key:'dials', label:'Dials', value: draft.dials }, { key:'conversations', label:'Conversations', value: draft.conversations }, { key:'appointments', label:'Appointments', value: draft.appointments }
  ];
  const keepNums = n => { try { localStorage.setItem(NUMS_KEY, JSON.stringify(n || {})); } catch(e){} };
  const draftNums = () => { try { return JSON.parse(localStorage.getItem(NUMS_KEY) || '{}') || {}; } catch(e){ return {}; } };
  const forgetBrief = () => { try { localStorage.removeItem(BRIEF_KEY); localStorage.removeItem(NUMS_KEY); } catch(e){} };
  const numArgs = n => ({ p_dials: n ? n.dials : null, p_conversations: n ? n.conversations : null, p_appointments: n ? n.appointments : null });
  async function askBrief(work, brk, end){
    let draft = ''; try { draft = localStorage.getItem(BRIEF_KEY) || ''; } catch(e){}
    const ans = await ask({
      title:'End your shift and send it to Amr?',
      msg:hm(work) + ' worked · ' + hm(brk) + ' break · ' + hhmm(new Date(live.started_at)) + '–' + hhmm(end),
      input:{ multiline:true, label:'How did today go?', value:draft, placeholder:'Anything Amr should know: good calls, problems, follow-ups',
        numbers: numBoxes(draftNums()),
        minLength:10, error:'Write a sentence or two about your day first.',
        onCancel: (v, n) => { try { localStorage.setItem(BRIEF_KEY, v); } catch(e){} keepNums(n); } },
      ok:'Send and end shift', cancel:'Keep working'
    });
    if (ans == null) return null;
    try { localStorage.setItem(BRIEF_KEY, ans.text.trim()); } catch(e){} keepNums(ans.nums);
    return { note: ans.text.trim(), nums: ans.nums };
  }

  // Ended somewhere else (Amr's End, or another device): if that shift has no brief yet, offer to add one
  async function laterBrief(startedAt){
    const { data } = await db.rpc('my_briefs');
    const s = (data || []).find(r => Math.abs(new Date(r.started_at) - new Date(startedAt)) < 2000);
    if (!s || s.brief) return;
    let draft = ''; try { draft = localStorage.getItem(BRIEF_KEY) || ''; } catch(e){}
    const ans = await ask({
      title:'Your shift was ended. Add a note about your day?',
      msg:'Your hours are already saved. This note goes with them.',
      input:{ multiline:true, label:'How did today go?', value:draft, placeholder:'Anything Amr should know: good calls, problems, follow-ups', numbers: numBoxes(draftNums()) },
      ok:'Send note', cancel:'Skip'
    });
    forgetBrief();
    if (!ans || !ans.text.trim()) return;
    const { error } = await db.rpc('member_add_brief', Object.assign({ p_started_at: startedAt, p_brief: ans.text.trim() }, numArgs(ans.nums)));
    toast(error ? 'Couldn’t send your note. Check your connection.' : 'Note sent to Amr');
    if (!error) loadHistory();
  }

  async function finish(){
    if (!live) return;
    // Ended or changed on another device? Show that instead of logging the shift twice
    const before = live.started_at;
    if (await syncLive() && (!live || live.started_at !== before)) { toast('This shift was already ended on another device.'); loadHistory(); return; }
    if (!live) return;
    const work = Math.round(workNow()), brk = Math.round(breakNow());
    if (work < 60) {
      if (!await ask({ title:'Discard this shift?', msg:'Less than a minute worked, so nothing will be saved.', ok:'Discard', cancel:'Keep working', danger:true })) return;
      live = null; drawClock(); await saveLive(); return;
    }
    const b = await askBrief(work, brk, new Date());
    if (b == null || !live) return;
    $('offLbl').textContent = 'Saving…';
    document.querySelectorAll('.ctl').forEach(x => x.setAttribute('aria-busy', 'true'));
    const started = new Date(live.started_at);
    const { error } = await db.rpc('member_log_shift', Object.assign({
      p_shift_date: iso(started), p_work_seconds: Math.min(work, 86400), p_break_seconds: brk,
      p_started_at: live.started_at, p_ended_at: new Date().toISOString(), p_brief: b.note
    }, numArgs(b.nums)));
    document.querySelectorAll('.ctl').forEach(x => x.removeAttribute('aria-busy'));
    $('offLbl').textContent = 'Off';
    if (error) { $('tErr').textContent = "Couldn't save your shift. Your time is kept; check your connection and press Off again."; return; }
    live = null; keepLocal(); forgetBrief(); drawClock();
    toast('Shift saved: ' + hm(work));
    loadHistory();
  }

  // ---------- missed shifts ----------
  $('missToggle').addEventListener('click', () => {
    $('missForm').hidden = false; $('missToggle').hidden = true;
    if (!$('mDate').value) { const y = new Date(); y.setDate(y.getDate() - 1); $('mDate').value = iso(y); }
    $('mDate').max = iso(new Date());
    $('mFrom').focus();
  });
  $('missCancel').addEventListener('click', () => { $('missForm').hidden = true; $('missToggle').hidden = false; $('mErr').textContent = ''; });
  ['mDate', 'mFrom', 'mTo', 'mBreak'].forEach(id => $(id).addEventListener('input', () => $('mErr').textContent = ''));
  $('missForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = m => { $('mErr').textContent = m; };
    const d = $('mDate').value, a = $('mFrom').value, b = $('mTo').value, brk = parseInt($('mBreak').value || '0', 10);
    if (!d) return err('Pick the date you worked.');
    if (!a || !b) return err('Enter when you started and finished.');
    if (a === b) return err('The start and finish times are the same. Check them.');
    if (isNaN(brk) || brk < 0) return err('Check the break minutes.');
    const start = new Date(d + 'T' + a), end = new Date(d + 'T' + b);
    if (end <= start) end.setDate(end.getDate() + 1); // finished after midnight
    if (end > new Date()) return err('That shift ends in the future.');
    const work = (end - start) / 1000 - brk * 60;
    if (work < 60) return err('That’s less than a minute of work once the break is taken out.');
    if (work > 86400) return err('That’s over 24 hours. Check the times.');
    $('missSave').setAttribute('aria-busy', 'true');
    const { error } = await db.rpc('member_request_shift', { p_shift_date: d, p_started_at: start.toISOString(), p_ended_at: end.toISOString(), p_break_seconds: brk * 60, p_note: $('mNote').value.trim() || null });
    $('missSave').removeAttribute('aria-busy');
    if (error) return err(/future/i.test(error.message) ? 'That date is in the future.' : /far back/i.test(error.message) ? 'That’s more than two months ago. Ask Amr directly.' : /Too many/i.test(error.message) ? 'You have a lot of requests waiting. Wait for Amr to go through them.' : "Couldn't send it. Check your connection and try again.");
    $('mFrom').value = ''; $('mTo').value = ''; $('mBreak').value = ''; $('mNote').value = '';
    $('missForm').hidden = true; $('missToggle').hidden = false;
    toast('Sent to Amr for approval');
    loadRequests();
  });
  async function loadRequests(){
    const { data, error } = await db.from('shift_requests').select('*').eq('user_id', user.id).order('created_at', { ascending:false }).limit(20);
    const box = $('reqList'); box.innerHTML = '';
    if (error) return;
    const recent = (data || []).filter(r => r.status === 'pending' || (r.status === 'rejected' && Date.now() - new Date(r.decided_at).getTime() < 14 * 864e5));
    recent.forEach(r => {
      const d = document.createElement('div'); d.className = 'row req';
      d.innerHTML = '<span class="n"><b>' + esc(dayDate(r.shift_date)) + '</b><small>' + esc((r.status === 'pending' ? 'Missed shift, waiting for Amr' : 'Not approved' + (r.reason ? ': ' + r.reason : '')) + ' · ' + hm(r.work_seconds)) + '</small></span>' +
        '<span class="v">' + (r.status === 'pending' ? '<span class="pill p-pau">Pending</span>' : '<span class="pill p-off">Declined</span>') + '</span>';
      box.appendChild(d);
    });
  }

  // Pounds for "not paid yet": today's rate from Settings › Dollar rates (52 until one loads)
  const fx = { rate:52 };
  async function loadFx(){
    const { data, error } = await db.rpc('fx_rate_on');
    if (!error && Number(data) > 0) fx.rate = Number(data);
  }

  async function loadHistory(){
    const [{ data, error }, br] = await Promise.all([db.rpc('my_shifts'), db.rpc('my_briefs')]);
    // Your own end-of-shift notes, matched to each shift by its date, length and start time
    const bkey = r => r.shift_date + '|' + r.work_seconds + '|' + (r.started_at ? new Date(r.started_at).getTime() : '');
    const briefs = new Map(((!br.error && br.data) || []).filter(r => r.brief).map(r => [bkey(r), r.brief]));
    if (error) { $('hList').innerHTML = '<p class="empty">Couldn’t load your history. Pull to refresh.</p>'; return; }
    const rows = data || [], month = iso(new Date()).slice(0, 7);
    const mine = rows.filter(r => r.shift_date.slice(0, 7) === month);
    $('hMonth').textContent = hm(mine.reduce((a, r) => a + r.work_seconds, 0));
    $('hShifts').textContent = plural(mine.length, 'shift');
    const due = rows.filter(r => !r.paid).reduce((a, r) => a + r.work_seconds / 3600 * Number(r.pay_rate || 0), 0);
    setMoney($('hDue'), due);
    $('hDueEgp').textContent = fx.rate ? '= ' + egp(due * fx.rate) : '';
    const box = $('hList');
    if (!rows.length) { box.innerHTML = '<p class="empty">No shifts yet. Press Run when you start.</p>'; return; }
    // A folding header per month (newest open), then one row per shift: date, hours, pay, paid or not.
    // Tapping a row opens the clocked times, the pay worked out, and that day's note.
    const months = new Map();
    rows.forEach(r => { const m = r.shift_date.slice(0, 7); if (!months.has(m)) months.set(m, []); months.get(m).push(r); });
    const chev = '<svg class="i chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const first = months.keys().next().value; // the newest month starts open, older ones folded
    let html = '';
    months.forEach((list, m) => {
      const secs = list.reduce((a, r) => a + r.work_seconds, 0);
      const amt = list.reduce((a, r) => a + r.work_seconds / 3600 * Number(r.pay_rate || 0), 0);
      const mOpen = openMonths.has(m) ? openMonths.get(m) : m === first;
      html += '<button type="button" class="hmonth" aria-expanded="' + mOpen + '" data-month="' + esc(m) + '"><b>' + esc(monthLabel(m)) + '</b><span>' + esc(plural(list.length, 'shift') + ' · ' + hm(secs) + ' · ' + usd(amt)) + '</span>' + chev + '</button><div class="srows"' + (mOpen ? '' : ' hidden') + '>';
      list.forEach(r => {
        const id = String(r.id != null ? r.id : bkey(r)), open = openRows.has(id), a = r.work_seconds / 3600 * Number(r.pay_rate || 0), note = briefs.get(bkey(r));
        const paid = r.paid ? '<span class="pill p-ok">Paid</span>' : '<span class="pill p-due">Unpaid</span>';
        const clocked = r.started_at && r.ended_at ? hhmm(new Date(r.started_at)) + ' – ' + hhmm(new Date(r.ended_at)) : 'Added by hand';
        html += '<div class="srow' + (open ? ' open' : '') + '"><button type="button" class="shead" aria-expanded="' + open + '" data-row="' + esc(id) + '">' +
          '<span class="sd"><b>' + esc(dayDate(r.shift_date)) + '</b>' + (note ? '<span class="has-note">Note</span>' : '') + '</span>' +
          '<span class="sh num">' + hm(r.work_seconds) + '</span><span class="sp num">' + usd(a) + '</span>' + paid + chev + '</button>' +
          '<div class="sbody"' + (open ? '' : ' hidden') + '>' +
            '<div class="kv"><span>Clocked</span><span class="num">' + esc(clocked) + '</span></div>' +
            (r.break_seconds >= 60 ? '<div class="kv"><span>Break</span><span class="num">' + hm(r.break_seconds) + '</span></div>' : '') +
            '<div class="kv"><span>Pay</span><span class="num">' + hm(r.work_seconds) + ' × ' + usd(Number(r.pay_rate || 0)) + ' = ' + usd(a) + '</span></div>' +
            (r.company_name ? '<div class="kv"><span>Company</span><span>' + esc(r.company_name) + '</span></div>' : '') +
            (r.paid && r.paid_at ? '<div class="kv"><span>Paid on</span><span>' + esc(new Date(r.paid_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) + (r.paid_fx ? ' at ' + Number(r.paid_fx).toFixed(2) + ' EGP per $1' : '')) + '</span></div>' : '') +
            '<div class="snote"><small>Your note for this day</small><p class="brief-text">' + (note ? esc(note) : '<span class="muted">No note for this day.</span>') + '</p></div>' +
          '</div></div>';
      });
      html += '</div>';
    });
    box.innerHTML = html;
  }
  const openMonths = new Map(); // months you've opened or folded stay that way when the list refreshes
  const openRows = new Set(); // shifts you've opened stay open when the list refreshes
  $('hList').addEventListener('click', e => {
    const mb = e.target.closest('[data-month]');
    if (mb) {
      const open = mb.getAttribute('aria-expanded') !== 'true';
      openMonths.set(mb.dataset.month, open);
      mb.setAttribute('aria-expanded', String(open));
      mb.nextElementSibling.hidden = !open;
      return;
    }
    const b = e.target.closest('[data-row]'); if (!b) return;
    const id = b.dataset.row, open = !openRows.has(id);
    open ? openRows.add(id) : openRows.delete(id);
    b.setAttribute('aria-expanded', String(open));
    b.parentElement.classList.toggle('open', open);
    b.nextElementSibling.hidden = !open;
  });

  // ======================================================================
  // Owner: menu, Live now, Invite and access, and the /cash pages
  // ======================================================================
  const OWNER_PAGES = { live:'Live now', requests:'Missed-shift requests', people:'Invite and access', visits:'Website visitors', mytime:'My time', overview:'Overview', team:'Team', income:'Income', expense:'Expenses', track:'Tracker' };
  // Which switch in Invite and access opens each page; "owner" pages are Amr's alone
  const SECTION = { live:'live', requests:'requests', team:'team', overview:'money', income:'money', expense:'money', mytime:'owner', people:'owner', visits:'owner', track:'track' };
  const SECTION_NAMES = { live:'Live now', requests:'Missed-shift requests', team:'Team', money:'Money' };
  const canSee = sec => role === 'owner' ? sec !== 'track' : role === 'member' && (sec === 'track' || access.includes(sec));
  const hasMenu = () => role === 'owner' || (role === 'member' && access.length > 0);
  let companies = [];

  async function startOwner(){
    show('vApp');
    $('burger').hidden = false; $('drawer').hidden = false;
    $('me').textContent = 'A'; $('me').classList.add('owner');
    $('pTrack').hidden = true;
    const { data } = await db.from('companies').select('id,name').order('name');
    companies = data || [];
    startMenu();
    signedIn();
  }
  // The menu for the owner, or a team member with extra access (only the sections switched on for them).
  // Hiding is for tidiness; the database decides what each person can actually read.
  async function startMenu(){
    document.querySelectorAll('#drawer [data-sec]').forEach(el => el.hidden = !canSee(el.dataset.sec));
    if (role === 'member') {
      $('drawName').textContent = profile.name;
      $('drawWho').textContent = 'Can also see: ' + access.map(s => SECTION_NAMES[s]).filter(Boolean).join(', ');
      const { data } = await db.rpc('company_names'); // names only, no rates
      companies = data || [];
    }
    if (canSee('team')) loadTeamMenu();
    menuRoute();
  }
  // Team in the menu opens into each person's name; a name goes straight to their hours (#team/<name>).
  // Names are the active agents (Team > Agents), numbered like on /tracker. Before any agents exist,
  // they come from the last 60 days of shifts.
  async function loadTeamMenu(){
    let people = [];
    const ag = await db.from('agents').select('id,name').eq('active', true).order('id');
    if (!ag.error && ag.data.length) people = ag.data.map(a => ({ name: a.name.trim(), label: String(a.id).padStart(2, '0') + ' · ' + a.name.trim() }));
    else {
      const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      const { data } = await db.from('shifts').select('name').eq('owner', false).gte('shift_date', since).limit(1000);
      const names = new Map();
      (data || []).forEach(r => { const n = (r.name || '').trim(), k = n.toLowerCase().replace(/\s+/g, ' '); if (n && !names.has(k)) names.set(k, n); });
      people = [...names.values()].sort((a, b) => a.localeCompare(b)).map(n => ({ name: n, label: n }));
    }
    const sub = $('teamSub');
    sub.innerHTML = '';
    people.forEach(p => {
      const a = document.createElement('a');
      a.className = 'mi'; a.href = '#team/' + encodeURIComponent(p.name); a.textContent = p.label;
      sub.appendChild(a);
    });
    $('teamTog').hidden = !people.length;
    markMenu();
  }
  function openTeamMenu(open){ $('teamTog').setAttribute('aria-expanded', open); $('teamSub').hidden = !open; }
  $('teamTog').addEventListener('click', () => openTeamMenu($('teamSub').hidden));
  // Highlights the open section (or person) in the menu; the names under Team stay open while on Team
  function markMenu(){
    const here = location.hash;
    document.querySelectorAll('.drawer .mi[href]').forEach(a => a.classList.toggle('on', a.getAttribute('href') === here));
    if (here.startsWith('#team') && !$('teamTog').hidden) openTeamMenu(true);
  }
  function menuRoute(){
    if (!hasMenu()) return;
    let [page, person] = location.hash.slice(1).split('/');
    if (!OWNER_PAGES[page] || !canSee(SECTION[page])) { page = role === 'owner' ? 'live' : 'track'; history.replaceState(null, '', '#' + page); }
    const here = page + (page === 'team' && person ? '/' + person : '');
    $('title').textContent = OWNER_PAGES[page];
    markMenu();
    $('pTrack').hidden = page !== 'track';
    $('pLive').hidden = page !== 'live'; $('pPeople').hidden = page !== 'people'; $('pRequests').hidden = page !== 'requests';
    $('pVisits').hidden = page !== 'visits';
    const cashPage = !['live', 'people', 'requests', 'track', 'visits'].includes(page);
    $('pCash').hidden = !cashPage;
    // A person's Team page gets a bar for their payslips (Amr only; uploading is his)
    let who = ''; try { who = page === 'team' && person ? decodeURIComponent(person) : ''; } catch(e) {}
    $('cashBar').hidden = !(who && role === 'owner'); $('pCash').classList.toggle('with-bar', !!(who && role === 'owner'));
    $('cashBarName').textContent = who;
    clearInterval(liveTimer); clearInterval(liveDrawTimer);
    if (page === 'live') { loadLive(); liveTimer = setInterval(loadLive, 15000); }
    if (page === 'people') loadPeople();
    if (page === 'requests') loadOwnerRequests();
    if (page === 'visits') loadVisits();
    countRequests();
    if (cashPage) openCash(here);
    closeMenu();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', menuRoute);

  $('cashBarSlips').addEventListener('click', () => { if (window.TalentsAccount) window.TalentsAccount.openPayslips($('cashBarName').textContent); });

  // The /cash pages, inside the app: same sign-in, their own tab row hidden
  function openCash(view){
    const f = $('cashFrame');
    if (!f.src) { f.src = CASH_URL + '#' + view; return; }
    try { f.contentWindow.location.hash = view; } catch(e) { f.src = CASH_URL + '#' + view; }
  }

  // ---------- menu ----------
  function closeMenu(){ document.body.classList.remove('menu-open'); }
  $('burger').addEventListener('click', () => document.body.classList.add('menu-open'));
  $('shade').addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  $('drawer').addEventListener('click', e => { const a = e.target.closest('.mi[href]'); if (a && a.getAttribute('href') === location.hash) menuRoute(); });

  // ---------- live now ----------
  let liveRows = [], liveMembers = [], codeRows = [];
  async function loadLive(){
    const [st, mem, code] = await Promise.all([db.from('live_status').select('*'), db.from('members').select('user_id,name,company_id,active').order('name'), db.from('code_live_status').select('*')]);
    // People on amrabdelgawad.site/tracker (company code, no account); an old row from a closed phone drops off after 16 hours
    codeRows = code.error ? [] : (code.data || []).filter(r => Date.now() - new Date(r.updated_at).getTime() < 16 * 3600e3);
    if (st.error || mem.error) { $('liveNote').textContent = /live_status|members/.test((st.error || mem.error).message || '') ? 'The app isn’t set up yet. Run supabase/app-setup.sql.' : "Couldn't refresh. Check your connection."; return; }
    liveRows = st.data || []; liveMembers = (mem.data || []).filter(m => m.active);
    countRequests();
    $('liveNote').textContent = 'Updates every 15 seconds.';
    drawLive();
    clearInterval(liveDrawTimer); liveDrawTimer = setInterval(() => { if (!$('pLive').hidden) drawLive(); }, 1000);
  }
  // Rows are rebuilt only when someone's state changes; the clocks tick in place, so buttons don't move under a tap
  let liveSig = '', endFor = null;
  function drawLive(){
    const coName = id => (companies.find(c => c.id === id) || {}).name || '';
    const now = Date.now();
    // A /tracker shift Amr already ended stays in the table until that phone checks in; it's over, so leave it out
    const fromCode = codeRows.filter(r => r.command !== 'end').map(r => ({ m:{ name:r.name, company_id:r.company_id }, s:r, viaCode:true, key:'d:' + r.device_id }));
    const people = liveMembers.map(m => ({ m, s: liveRows.find(r => r.user_id === m.user_id), key:'u:' + m.user_id })).concat(fromCode).map(({ m, s, viaCode, key }) => {
      if (!s) return { m, key, mode:'off' };
      const seg = Math.max(0, (now - new Date(s.seg_at).getTime()) / 1000);
      return { m, key, mode:s.mode, work: s.work_seconds + (s.mode === 'run' ? seg : 0), brk: s.break_seconds + (s.mode === 'brk' ? seg : 0), seg, since: new Date(s.started_at), long: (now - new Date(s.started_at).getTime()) / 1000 > 10 * 3600, viaCode, quiet: viaCode && now - new Date(s.updated_at).getTime() > 15 * 60e3, seen: new Date(s.updated_at), asked: viaCode ? s.command || null : null };
    });
    const order = { run:0, brk:1, pau:2, off:3 };
    people.sort((a, b) => order[a.mode] - order[b.mode] || a.m.name.localeCompare(b.m.name));
    const count = k => people.filter(p => p.mode === k).length;
    $('lRun').textContent = count('run'); $('lBrk').textContent = count('brk'); $('lPau').textContent = count('pau');
    $('liveCnt').hidden = !count('run'); $('liveCnt').textContent = count('run') + ' working';
    const box = $('liveList');
    if (!people.length) { liveSig = ''; box.innerHTML = '<p class="empty">No team members yet. Invite someone from Invite and access.</p>'; return; }
    const ASKED = { run:'Resume', pau:'Pause', brk:'Break' };
    const sub = p => p.mode === 'off' ? 'Not clocked in' : (p.long ? 'Clocked in over 10 hours ago. Did they forget to clock out? · ' : '') + coName(p.m.company_id) + ' · ' +
      (p.mode === 'run' ? 'working since ' + hhmm(p.since) + (p.brk >= 1 ? ' · break ' + clock(p.brk) : '') : p.mode === 'brk' ? 'on break ' + clock(p.seg) + (p.brk - p.seg >= 1 ? ' · break total ' + clock(p.brk) : '') : 'paused ' + clock(p.seg)) +
      (p.viaCode ? ' · via /tracker' + (p.quiet ? ', last heard from ' + hhmm(p.seen) : '') : '') + (p.asked ? ' · ' + ASKED[p.asked] + ' sent, waiting for their phone' : '');
    const photos = window.TalentsPhotos;
    const face = p => { const url = photos && photos.find(p.m.user_id, p.m.name); return '<span class="av">' + (url ? '<img src="' + esc(url) + '" alt="" />' : esc(initials(p.m.name))) + '</span>'; };
    const sig = role + '|' + endFor + '|' + (photos ? photos.v : 0) + '|' + people.map(p => p.key + p.mode + p.long + p.quiet + p.asked).join('|');
    if (sig === liveSig) {
      people.forEach(p => {
        const row = box.querySelector('[data-k="' + CSS.escape(p.key) + '"]'); if (!row) return;
        row.querySelector('small').textContent = sub(p);
        const n = row.querySelector('.num'); if (n) n.textContent = clock(p.work);
      });
      return;
    }
    liveSig = sig;
    const pill = { run:'<span class="pill p-ok">Working</span>', brk:'<span class="pill p-due">On break</span>', pau:'<span class="pill p-pau">Paused</span>', off:'<span class="pill p-off">Off</span>' };
    // Only Amr can change someone's clock
    const local = d => new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
    const ctl = p => {
      if (role !== 'owner' || p.mode === 'off') return '';
      if (endFor === p.key) {
        const v = local(new Date());
        return '<form class="endf" data-end="' + esc(p.key) + '" novalidate><label class="label">When did ' + esc(p.m.name.split(' ')[0]) + ' stop working?<input class="field" type="datetime-local" name="at" value="' + v + '" min="' + local(p.since) + '" max="' + v + '" /></label>' +
          '<div class="acts"><button class="btn small" type="submit">End shift and save it</button><button class="btn ghost small" type="button" data-act="cancel">Cancel</button></div><p class="err"></p></form>';
      }
      const b = (act, label) => '<button class="btn ghost small" type="button" data-act="' + act + '">' + label + '</button>';
      return '<div class="acts">' + (p.mode === 'run' ? b('pau', 'Pause') + b('brk', 'Break') : b('run', 'Resume')) + b('end', 'End shift') + '</div>';
    };
    box.innerHTML = people.map(p => '<div class="lrow" data-k="' + esc(p.key) + '"><div class="row' + (p.long ? ' long' : '') + '">' + face(p) + '<span class="n"><b>' + esc(p.m.name) + '</b><small>' + esc(sub(p)) + '</small></span>' +
      '<span class="v">' + (p.mode === 'off' ? '' : '<span class="num">' + clock(p.work) + '</span><small>') + pill[p.mode] + (p.mode === 'off' ? '' : '</small>') + '</span></div>' + ctl(p) + '</div>').join('');
  }
  // Pause, Break, Resume and End on someone else's shift. App users change at once; /tracker phones pick it up within 30 seconds.
  async function controlShift(key, act, endAt){
    const kind = key.slice(0, 1), id = key.slice(2);
    const { error } = kind === 'u'
      ? await db.rpc('owner_control_member', { p_user: id, p_action: act, p_end: endAt || null })
      : await db.rpc('owner_control_code', { p_device: id, p_action: act, p_end: endAt || null });
    if (!error) return null;
    return /Not clocked in/.test(error.message || '') ? 'They’re not clocked in any more.' : /Bad end time/.test(error.message || '') ? 'Pick a time between the start of the shift and now.' : 'Couldn’t do that. Try again.';
  }
  $('liveList').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || role !== 'owner') return;
    const key = b.closest('[data-k]').dataset.k, act = b.dataset.act;
    if (act === 'end') { endFor = key; drawLive(); return; }
    if (act === 'cancel') { endFor = null; drawLive(); return; }
    b.setAttribute('aria-busy', 'true');
    const err = await controlShift(key, act);
    b.removeAttribute('aria-busy');
    const did = act === 'run' ? 'Resume' : act === 'pau' ? 'Pause' : 'Break';
    toast(err || (key[0] === 'd' ? did + ' sent. Their /tracker page picks it up within 30 seconds.' : act === 'run' ? 'Resumed.' : act === 'pau' ? 'Paused.' : 'Put on break.'));
    loadLive();
  });
  $('liveList').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, key = f.dataset.end, at = new Date(f.elements.at.value);
    if (isNaN(at)) { f.querySelector('.err').textContent = 'Pick the time they stopped.'; return; }
    const end = at > new Date() ? new Date() : at;
    const btn = f.querySelector('[type=submit]'); btn.setAttribute('aria-busy', 'true');
    const err = await controlShift(key, 'end', end.toISOString());
    btn.removeAttribute('aria-busy');
    if (err) { f.querySelector('.err').textContent = err; return; }
    endFor = null; toast('Shift ended at ' + hhmm(end) + ' and saved to their hours.');
    loadLive();
  });

  // ---------- website visitors (owner) ----------
  // The site's /stats.js saves visits into site_visits; visit_stats() adds them up (owner only).
  // A device where Amr signs in here stops being counted (localStorage "nocount", shared with the whole site).
  const NAMES = { 'upwork.com':'Upwork', 'linkedin.com':'LinkedIn', 'lnkd.in':'LinkedIn', 'google.com':'Google', 'bing.com':'Bing', 'facebook.com':'Facebook', 'm.facebook.com':'Facebook', 'l.facebook.com':'Facebook', 'instagram.com':'Instagram', 'l.instagram.com':'Instagram', 't.co':'X (Twitter)', 'x.com':'X (Twitter)', 'duckduckgo.com':'DuckDuckGo', 'chatgpt.com':'ChatGPT', 'web.whatsapp.com':'WhatsApp', 'mail.google.com':'Gmail' };
  const sourceName = h => !h ? 'Typed the address or unknown' : NAMES[h] || (/(^|\.)google\./.test(h) ? 'Google' : /(^|\.)upwork\.com$/.test(h) ? 'Upwork' : /(^|\.)linkedin\.com$/.test(h) ? 'LinkedIn' : h);
  let countryNames = null; try { countryNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch(e) {}
  const countryName = c => !c ? 'Unknown' : (countryNames && countryNames.of(c)) || c;
  // US zones by their winter UTC offset: America/Detroit counts as Eastern, America/Boise as Mountain, and so on
  const ZONE = { '-300':'Eastern', '-360':'Central', '-420':'Mountain', '-480':'Pacific', '-540':'Alaska', '-600':'Hawaii' };
  function usZone(tz){
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date(Date.UTC(2026, 0, 15)));
      const m = (p.find(x => x.type === 'timeZoneName') || {}).value.match(/GMT([+-])(\d\d):(\d\d)/);
      return (m && ZONE[String((m[1] === '-' ? -1 : 1) * (m[2] * 60 + +m[3]))]) || 'Other';
    } catch(e) { return 'Unknown'; }
  }
  const noCount = () => { try { return localStorage.getItem('nocount') === '1'; } catch(e) { return false; } };
  function setNoCount(on){ try { on ? localStorage.setItem('nocount', '1') : localStorage.removeItem('nocount'); } catch(e) {} drawMe(); }
  function drawMe(){
    const on = noCount();
    $('vMeNote').textContent = on ? 'Your visits from this device are not counted. Every device where you sign in here is skipped automatically.' : 'Your visits from this device are being counted.';
    $('vMeBtn').textContent = on ? 'Count this device again' : 'Stop counting this device';
  }
  $('vMeBtn').addEventListener('click', () => setNoCount(!noCount()));
  let visitsRun = 0;
  async function loadVisits(){
    const run = ++visitsRun;
    drawMe(); $('vErr').textContent = '';
    const { data: s, error } = await db.rpc('visit_stats', { p_hours: +$('vRange').value });
    if (run !== visitsRun) return; // a newer period was picked meanwhile
    if (error || !s) { $('vErr').textContent = "Couldn't load the numbers. Check your connection and try again."; return; }
    const n = x => (x || 0).toLocaleString('en-US');
    $('vTotal').textContent = n(s.visitors);
    $('vViews').textContent = plural(s.views || 0, 'page view');
    $('vPlays').textContent = n(s.plays); $('vBooked').textContent = n(s.booked); $('vCv').textContent = n(s.cv);
    const merge = (rows, name) => { const m = new Map(); rows.forEach(r => { const k = name(r.name); m.set(k, (m.get(k) || 0) + r.n); }); return [...m].sort((a, b) => b[1] - a[1]); };
    bars($('vRefs'), merge(s.sources || [], sourceName));
    bars($('vLocs'), merge(s.countries || [], countryName));
    bars($('vZones'), merge(s.uszones || [], usZone), 'No US visitors in this period yet.');
    bars($('vDevs'), merge(s.devices || [], d => d === 'phone' ? 'Phone' : d === 'desktop' ? 'Computer' : 'Unknown'));
    const hits = s.hits || [];
    $('vHits').innerHTML = hits.length ? hits.map(h => '<div class="row"><div class="n"><b>' + esc(h.kind === 'view' ? (h.path === '/' ? 'Homepage' : h.path === '/cv/' ? 'CV page' : h.path) : (h.title || h.path)) + '</b><small>' + (h.kind === 'view' ? 'Page' : 'Click or play') + '</small></div><div class="v num">' + n(h.n) + '</div></div>').join('') : '<p class="empty">No visits in this period yet.</p>';
  }
  function bars(box, rows, empty){
    const max = Math.max(1, ...rows.map(r => r[1]));
    box.innerHTML = rows.length ? rows.map(([name, c]) => '<div class="row"><div class="n"><b>' + esc(name) + '</b><div class="bar" style="width:' + Math.round(c / max * 100) + '%"></div></div><div class="v num">' + c.toLocaleString('en-US') + '</div></div>').join('') : '<p class="empty">' + (empty || 'No visits in this period yet.') + '</p>';
  }
  $('vRange').addEventListener('change', loadVisits);

  // ---------- missed-shift requests (owner) ----------
  async function countRequests(){
    if (!canSee('requests')) return;
    const { count } = await db.from('shift_requests').select('id', { count:'exact', head:true }).eq('status', 'pending');
    const n = count || 0;
    $('reqCnt').hidden = !n; $('reqCnt').textContent = n + ' waiting';
    $('burgerDot').hidden = !n;
  }
  async function loadOwnerRequests(){
    const { data, error } = await db.from('shift_requests').select('*').order('created_at', { ascending:false }).limit(60);
    if (error) { $('reqPending').innerHTML = '<p class="empty">' + (/shift_requests/.test(error.message || '') ? 'Not set up yet. Run supabase/app-requests.sql.' : 'Couldn’t load requests.') + '</p>'; return; }
    const coName = id => (companies.find(c => c.id === id) || {}).name || '';
    const pend = data.filter(r => r.status === 'pending'), done = data.filter(r => r.status !== 'pending').slice(0, 20);
    $('reqHead').textContent = role === 'owner' ? 'Waiting for you' : 'Waiting for Amr';
    const row = (r, actions) => {
      const d = document.createElement('div'); d.className = 'person';
      d.innerHTML = '<div class="head"><span class="av"></span><span class="n"><b></b><small></small></span><span class="num rq-h"></span></div>' + (actions ? '<div class="acts"><button class="btn small" data-ok="1">Approve</button><button class="btn ghost small" data-ok="0">Decline</button></div>' : '');
      d.querySelector('.av').textContent = initials(r.name);
      d.querySelector('b').textContent = r.name + ' · ' + dayDate(r.shift_date);
      d.querySelector('small').textContent = hhmm(new Date(r.started_at)) + '–' + hhmm(new Date(r.ended_at)) + (r.break_seconds >= 60 ? ' · ' + hm(r.break_seconds) + ' break' : '') + ' · ' + coName(r.company_id) +
        (r.note ? ' · “' + r.note + '”' : '') + (r.status === 'pending' ? '' : ' · ' + (r.status === 'approved' ? 'Approved' : 'Declined' + (r.reason ? ': ' + r.reason : '')));
      d.querySelector('.rq-h').textContent = hm(r.work_seconds);
      if (actions) d.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', async () => {
        const ok = b.dataset.ok === '1';
        let reason = null;
        if (!ok) { reason = await ask({ title:'Decline this shift?', ok:'Decline', danger:true, input:{ label:'Why? (optional, ' + r.name.split(' ')[0] + ' will see this)' } }); if (reason === null) return; }
        b.setAttribute('aria-busy', 'true');
        const { error } = await db.rpc('decide_shift_request', { p_id: r.id, p_approve: ok, p_reason: reason });
        b.removeAttribute('aria-busy');
        if (error) { toast(/Already/.test(error.message) ? 'That one was already decided.' : 'Couldn’t save that. Try again.'); return; }
        toast(ok ? 'Approved. It’s now in ' + r.name.split(' ')[0] + '’s shifts.' : 'Declined');
        loadOwnerRequests(); countRequests();
      }));
      return d;
    };
    $('reqPending').innerHTML = pend.length ? '' : '<p class="empty">Nothing waiting. When someone forgets to clock in, their request shows up here.</p>';
    pend.forEach(r => $('reqPending').appendChild(row(r, role === 'owner')));
    $('reqDone').innerHTML = done.length ? '' : '<p class="empty">Nothing yet.</p>';
    done.forEach(r => $('reqDone').appendChild(row(r, false)));
  }

  // ---------- invite and access ----------
  function fillCompanies(sel, current){
    sel.innerHTML = '';
    companies.forEach(c => { const o = document.createElement('option'); o.value = String(c.id); o.textContent = c.name; sel.appendChild(o); });
    if (current != null) sel.value = String(current);
  }
  async function callAccess(body){
    const { data, error } = await db.functions.invoke('team-access', { body });
    if (error) {
      let msg = 'Something went wrong. Try again.';
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch(e){}
      if (/not found|404|Failed to send/i.test(error.message || '')) msg = 'The invite service isn’t set up yet.';
      return { error: msg };
    }
    return data || {};
  }
  function showLink(name, link, note){
    $('linkBox').hidden = false;
    $('linkFor').textContent = name;
    $('linkNote').textContent = note;
    $('linkVal').value = link;
    const msg = 'Hi ' + name.split(' ')[0] + ', here is your link for the Amr Abdelgawad Talents tracker: ' + link + '\n\nOpen it, choose a password, then add the app to your home screen. The link works once.';
    $('linkWa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  }
  $('linkCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('linkVal').value); toast('Link copied'); }
    catch(e) { $('linkVal').select(); toast('Press and hold to copy the link'); }
  });
  let inviteVia = 'email';
  ['invBtn', 'invWa'].forEach(id => $(id).addEventListener('click', () => { inviteVia = $(id).dataset.via; }));
  $('invForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = inviteVia === 'email' ? $('invBtn') : $('invWa');
    const name = $('invName').value.trim().replace(/\s+/g, ' '), email = $('invEmail').value.trim(), co = Number($('invCo').value) || null;
    if (name.length < 2) { $('invErr').textContent = 'Enter their full name.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('invErr').textContent = 'Enter a valid email.'; return; }
    $('invErr').textContent = '';
    btn.setAttribute('aria-busy', 'true');
    const r = await callAccess({ action:'invite', name, email, company_id: co, via: inviteVia });
    btn.removeAttribute('aria-busy');
    if (r.error) { $('invErr').textContent = r.error; return; }
    const joined = r.linked_shifts ? ' ' + plural(r.linked_shifts, 'earlier shift') + ' joined their history.' : '';
    if (r.sent) { $('linkBox').hidden = true; toast('Invite emailed to ' + email + '.' + joined); }
    else showLink(name, r.link, 'Send this to ' + name.split(' ')[0] + '. It works once and expires in 24 hours.' + joined);
    $('invName').value = ''; $('invEmail').value = '';
    loadPeople();
  });
  ['invName', 'invEmail'].forEach(id => $(id).addEventListener('input', () => $('invErr').textContent = ''));

  async function loadPeople(){
    fillCompanies($('invCo'), $('invCo').value || (companies[0] && companies[0].id));
    const { data, error } = await db.from('members').select('*').order('active', { ascending:false }).order('name');
    const box = $('peopleList');
    if (error) { box.innerHTML = '<p class="empty">' + (/members/.test(error.message || '') ? 'The app isn’t set up yet. Run supabase/app-setup.sql.' : 'Couldn’t load people.') + '</p>'; return; }
    if (!data.length) { box.innerHTML = '<p class="empty">No one yet. Invite your first team member.</p>'; return; }
    box.innerHTML = '';
    data.forEach(m => {
      const d = document.createElement('div'); d.className = 'person';
      d.innerHTML = '<div class="head"><span class="av' + (m.active ? '' : ' gone') + '"></span><span class="n"><b></b><small></small></span>' + (m.active ? '<span class="pill p-ok">Active</span>' : '<span class="pill p-off">Removed</span>') + '</div>' +
        '<div class="acts"><select class="field" aria-label="Works for"></select><button class="btn ghost small" data-a="link" data-via="email">Email a sign-in link</button><button class="btn ghost small" data-a="link" data-via="whatsapp">WhatsApp a sign-in link</button><button class="btn ghost small" data-a="' + (m.active ? 'remove' : 'restore') + '">' + (m.active ? 'Remove access' : 'Restore access') + '</button></div>';
      d.querySelector('.av').textContent = initials(m.name);
      d.querySelector('b').textContent = m.name;
      d.querySelector('small').textContent = (m.email || '') + ' · since ' + new Date(m.created_at).toLocaleDateString('en-US', { month:'short', year:'numeric' });
      // What they can also see, look only. Team and Money ask them for an authenticator code too.
      if (m.active && Array.isArray(m.access)) {
        // One Access dropdown: the button sums it up, the list inside has a tick per section
        const acc = document.createElement('details'); acc.className = 'acc';
        const sum = () => 'Access: ' + (m.access.length ? m.access.map(s => SECTION_NAMES[s]).join(', ') : 'tracker only');
        acc.innerHTML = '<summary></summary><div class="acc-menu">' + Object.keys(SECTION_NAMES).map(s => '<label><input type="checkbox" value="' + s + '"' + (m.access.includes(s) ? ' checked' : '') + ' />' + esc(SECTION_NAMES[s]) + '</label>').join('') +
          '<p>Look only: they can’t add, change or approve anything. Team and Money ask them for an authenticator code.</p></div>';
        acc.querySelector('summary').textContent = sum();
        acc.addEventListener('change', async e => {
          const box = e.target, next = [...acc.querySelectorAll('input:checked')].map(i => i.value);
          acc.querySelectorAll('input').forEach(i => i.disabled = true);
          const { error } = await db.from('members').update({ access: next }).eq('user_id', m.user_id);
          acc.querySelectorAll('input').forEach(i => i.disabled = false);
          const first = m.name.split(' ')[0], what = SECTION_NAMES[box.value];
          if (error) { box.checked = !box.checked; toast('Couldn’t change it. Try again.'); return; }
          m.access = next; acc.querySelector('summary').textContent = sum();
          toast(box.checked ? first + ' can now see ' + what + (/team|money/.test(box.value) ? '. They’ll set up an authenticator code the first time.' : '.') : first + ' can no longer see ' + what + '.');
        });
        d.querySelector('.acts').prepend(acc);
      }
      const sel = d.querySelector('select'); fillCompanies(sel, m.company_id);
      sel.addEventListener('change', async () => {
        const { error } = await db.from('members').update({ company_id: Number(sel.value) }).eq('user_id', m.user_id);
        toast(error ? 'Couldn’t change it. Try again.' : m.name.split(' ')[0] + ' now works for ' + sel.options[sel.selectedIndex].text);
      });
      d.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', async () => {
        const a = b.dataset.a;
        if (a === 'remove' && !await ask({ title:'Remove ' + m.name + '’s access?', msg:'They won’t be able to sign in. Their shifts stay in your records.', ok:'Remove access', danger:true })) return;
        b.setAttribute('aria-busy', 'true');
        const r = await callAccess({ action:a, user_id:m.user_id, via: b.dataset.via || null });
        b.removeAttribute('aria-busy');
        if (r.error) { toast(r.error); return; }
        if (a === 'link' && r.sent) { toast('Sign-in link emailed to ' + m.email); return; }
        if (a === 'link') { showLink(m.name, r.link, 'A new sign-in link for ' + m.name.split(' ')[0] + ', for a forgotten password or a new phone. It works once and expires in an hour.'); window.scrollTo({ top:0, behavior:'smooth' }); return; }
        toast(a === 'remove' ? 'Access removed' : 'Access restored'); loadPeople();
      }));
      box.appendChild(d);
    });
  }

  // A tap outside an open Access dropdown closes it
  document.addEventListener('click', e => document.querySelectorAll('details.acc[open]').forEach(x => { if (!x.contains(e.target)) x.open = false; }));

  function stopTimers(){ clearInterval(tickTimer); clearInterval(liveTimer); clearInterval(liveDrawTimer); clearInterval(memberSyncTimer); }

  // ---------- install ----------
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('installBtn').hidden = false; });
  $('installBtn').addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); installPrompt = null; $('installBtn').hidden = true; closeMenu(); });

  // ---------- backup (owner) ----------
  // Saves every table to one file on this device. Supabase's free plan keeps no copies you can restore yourself.
  const BACKUP_TABLES = ['cash_entries', 'shifts', 'shift_requests', 'members', 'companies', 'agents', 'agent_companies', 'tracker_settings', 'site_visits', 'profiles', 'fx_rates', 'payslips'];
  $('backupBtn').addEventListener('click', async () => {
    const btn = $('backupBtn'); if (btn.disabled) return;
    btn.disabled = true; toast('Making your backup…');
    const out = { made: new Date().toISOString(), tables: {} }; const failed = [];
    for (const t of BACKUP_TABLES) {
      const rows = [];
      for (let from = 0; ; from += 1000) { // Supabase sends at most 1000 rows per request
        const { data, error } = await db.from(t).select('*').range(from, from + 999);
        if (error) { failed.push(t); break; }
        rows.push(...data); if (data.length < 1000) break;
      }
      out.tables[t] = rows;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type:'application/json' }));
    a.download = 'talents-backup-' + out.made.slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    btn.disabled = false; closeMenu();
    toast(failed.length ? 'Backup saved, but these couldn’t be read: ' + failed.join(', ') : 'Backup saved to your downloads.');
  });
  // When a new version is published, the open app offers it; one tap reloads into it
  let waitingSW = null;
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const offer = w => { waitingSW = w; $('updateBar').hidden = false; };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
      // look for a new version whenever the app comes back to the front, and every 30 minutes
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
  }
  $('updateBtn').addEventListener('click', () => {
    $('updateBtn').setAttribute('aria-busy', 'true');
    if (waitingSW) waitingSW.postMessage({ type:'SKIP_WAITING' }); else location.reload();
  });

  // ---------- start ----------
  (async () => {
    if (linkError) { show('vLogin'); $('loginErr').textContent = 'That link has expired or was already used. Ask Amr for a new one.'; history.replaceState(null, '', location.pathname); return; }
    if (tokenHash && (tokenType === 'invite' || tokenType === 'recovery')) {
      history.replaceState(null, '', location.pathname);
      const { data, error } = await db.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
      if (error || !data.session) { show('vLogin'); $('loginErr').textContent = 'That link has expired or was already used. Ask Amr for a new one.'; return; }
      const nm = data.session.user.user_metadata && data.session.user.user_metadata.name;
      $('pwTitle').textContent = tokenType === 'invite' ? 'Welcome' + (nm ? ', ' + nm.split(' ')[0] : '') : 'Choose a new password';
      show('vSetPw'); $('pw1').focus();
      return;
    }
    const { data: { session } } = await db.auth.getSession();
    if (session && (linkType === 'invite' || linkType === 'recovery')) {
      history.replaceState(null, '', location.pathname);
      $('pwTitle').textContent = linkType === 'invite' ? 'Welcome' + (session.user.user_metadata && session.user.user_metadata.name ? ', ' + session.user.user_metadata.name.split(' ')[0] : '') : 'Choose a new password';
      show('vSetPw'); $('pw1').focus();
      return;
    }
    route();
  })();
  db.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { stopTimers(); show('vLogin'); document.dispatchEvent(new Event('talents-signed-out')); } });
})();
