// Talents app: one sign-in for everyone.
// Team members get the tracker and their own history. Amr (owner) gets the menu:
// Live now, his /cash pages, and Invite and access.
(function(){
  const $ = id => document.getElementById(id);
  const cfg = window.TRACKER_CONFIG || {};
  const CASH_URL = window.APP_CASH_URL || '../cash/?embed=1';

  // An invite or new sign-in link lands here with its type in the address; read it before supabase-js clears it
  const linkType = new URLSearchParams(location.hash.slice(1)).get('type');
  // Emailed and WhatsApp links point at amrabdelgawad.site/app/?token_hash=...&type=invite|recovery
  const qs = new URLSearchParams(location.search), tokenHash = qs.get('token_hash'), tokenType = qs.get('type');
  const linkError = new URLSearchParams(location.hash.slice(1)).get('error_description');

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
    if (isOwner === true) { role = 'owner'; startOwner(); return; }

    const { data: prof, error } = await db.rpc('my_profile');
    profile = Array.isArray(prof) ? prof[0] : prof;
    if (error || !profile) { $('noAccessMsg').textContent = 'This account isn’t set up for the tracker. Ask Amr to invite you.'; show('vNoAccess'); return; }
    if (!profile.active) { $('noAccessMsg').textContent = 'Your access was switched off. Ask Amr if that’s a mistake.'; show('vNoAccess'); return; }
    role = 'member'; startMember();
  }

  // ======================================================================
  // Team member: tracker + own history
  // ======================================================================
  let live = null; // { mode, started_at, work_seconds, break_seconds, seg_at } while clocked in
  let tickTimer = null, liveTimer = null;
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
  // Pick up a Run, Pause or Off pressed on another device
  async function syncLive(){
    const { data, error } = await db.from('live_status').select('*').eq('user_id', user.id).maybeSingle();
    if (error || isDirty()) return false;
    live = data || null; keepLocal(); drawClock();
    return true;
  }

  async function startMember(){
    show('vApp');
    if (location.hash) history.replaceState(null, '', location.pathname); // team members have one page
    $('burger').hidden = true; $('drawer').hidden = true;
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
    loadHistory();
    loadRequests();
    loadFx().then(() => loadHistory());
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
    $('guardSave').setAttribute('aria-busy', 'true');
    const { error } = await db.rpc('member_log_shift', {
      p_shift_date: iso(start), p_work_seconds: Math.min(work, 86400), p_break_seconds: live.break_seconds,
      p_started_at: live.started_at, p_ended_at: end.toISOString()
    });
    $('guardSave').removeAttribute('aria-busy');
    if (error) { $('guardErr').textContent = "Couldn't save it. Check your connection and try again."; return; }
    live = null; keepLocal(); $('guard').hidden = true; drawClock();
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
    $('tSub').textContent = (mode === 'run' ? 'Working since ' : mode === 'brk' ? 'On break · shift started ' : 'Paused · shift started ') + since + (breakNow() >= 60 ? ' · ' + hm(breakNow()) + ' break' : '');
  }

  async function saveLive(){
    keepLocal();
    const { error } = live
      ? await db.from('live_status').upsert(Object.assign({ user_id: user.id, updated_at: new Date().toISOString() }, live))
      : await db.from('live_status').delete().eq('user_id', user.id);
    setDirty(!!error);
    $('tErr').textContent = error ? 'Saved on this phone only. Check your connection; it will catch up.' : '';
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && role === 'member') syncLive(); });

  document.querySelectorAll('.ctl').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
  async function setMode(m){
    if (!profile || !profile.company_id) return;
    if (m === 'off') return finish();
    const now = new Date();
    if (!live) live = { mode:m, started_at: now.toISOString(), work_seconds:0, break_seconds:0, seg_at: now.toISOString() };
    else if (live.mode !== m) {
      live.work_seconds = Math.round(workNow()); live.break_seconds = Math.round(breakNow());
      live.mode = m; live.seg_at = now.toISOString();
    }
    drawClock(); await saveLive();
  }

  async function finish(){
    if (!live) return;
    // Ended or changed on another device? Show that instead of logging the shift twice
    const before = live.started_at;
    if (await syncLive() && (!live || live.started_at !== before)) { toast('This shift was already ended on another device.'); loadHistory(); return; }
    if (!live) return;
    const work = Math.round(workNow()), brk = Math.round(breakNow());
    if (work < 60) {
      if (!confirm('Less than a minute worked. Discard this shift?')) return;
      live = null; drawClock(); await saveLive(); return;
    }
    if (!confirm('End your shift and send it to Amr?\n\n' + hm(work) + ' worked' + (brk >= 60 ? ', ' + hm(brk) + ' break' : ''))) return;
    $('offLbl').textContent = 'Saving…';
    document.querySelectorAll('.ctl').forEach(b => b.setAttribute('aria-busy', 'true'));
    const started = new Date(live.started_at);
    const { error } = await db.rpc('member_log_shift', {
      p_shift_date: iso(started), p_work_seconds: Math.min(work, 86400), p_break_seconds: brk,
      p_started_at: live.started_at, p_ended_at: new Date().toISOString()
    });
    document.querySelectorAll('.ctl').forEach(b => b.removeAttribute('aria-busy'));
    $('offLbl').textContent = 'Off';
    if (error) { $('tErr').textContent = "Couldn't save your shift. Your time is kept; check your connection and press Off again."; return; }
    live = null; keepLocal(); drawClock();
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
    const { data, error } = await db.from('shift_requests').select('*').order('created_at', { ascending:false }).limit(20);
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

  // Pounds for "not paid yet": Amr's fixed rate, 52 EGP = $1 (same as cash/cash.js)
  const fx = { rate:52 };
  async function loadFx(){}

  async function loadHistory(){
    const { data, error } = await db.rpc('my_shifts');
    if (error) { $('hList').innerHTML = '<p class="empty">Couldn’t load your history. Pull to refresh.</p>'; return; }
    const rows = data || [], month = iso(new Date()).slice(0, 7);
    const mine = rows.filter(r => r.shift_date.slice(0, 7) === month);
    $('hMonth').textContent = hm(mine.reduce((a, r) => a + r.work_seconds, 0));
    $('hShifts').textContent = plural(mine.length, 'shift');
    const due = rows.filter(r => !r.paid).reduce((a, r) => a + r.work_seconds / 3600 * Number(r.pay_rate || 0), 0);
    setMoney($('hDue'), due);
    $('hDueEgp').textContent = fx.rate ? '= ' + egp(due * fx.rate) : '';
    const box = $('hList'); box.innerHTML = '';
    if (!rows.length) { box.innerHTML = '<p class="empty">No shifts yet. Press Run when you start.</p>'; return; }
    // One line per month; tap it to show that month's work days
    const months = new Map();
    rows.forEach(r => { const m = r.shift_date.slice(0, 7); if (!months.has(m)) months.set(m, []); months.get(m).push(r); });
    months.forEach((list, m) => {
      const secs = list.reduce((a, r) => a + r.work_seconds, 0);
      const amt = list.reduce((a, r) => a + r.work_seconds / 3600 * Number(r.pay_rate || 0), 0);
      const unpaid = list.filter(r => !r.paid).length;
      const wrap = document.createElement('div'); wrap.className = 'month' + (openMonths.has(m) ? ' open' : '');
      const head = document.createElement('button'); head.type = 'button'; head.className = 'mrow';
      head.setAttribute('aria-expanded', String(openMonths.has(m)));
      head.innerHTML = '<span class="n"><b>' + esc(monthLabel(m)) + '</b><small>' + esc(plural(list.length, 'day') + ' · ' + hm(secs)) + '</small></span>' +
        '<span class="v">' + usd(amt) + '<small>' + (unpaid ? '<span class="pill p-due">' + unpaid + ' unpaid</span>' : '<span class="pill p-ok">All paid</span>') + '</small></span>' +
        '<svg class="i chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      const days = document.createElement('div'); days.className = 'days';
      list.forEach(r => {
        const a = r.work_seconds / 3600 * Number(r.pay_rate || 0);
        const d = document.createElement('div'); d.className = 'row';
        const clocked = r.started_at && r.ended_at ? hhmm(new Date(r.started_at)) + '–' + hhmm(new Date(r.ended_at)) + ' · ' : '';
        d.innerHTML = '<span class="n"><b>' + esc(dayDate(r.shift_date)) + '</b><small>' + esc((r.company_name || '') + ' · ' + clocked + hm(r.work_seconds)) + '</small></span>' +
          '<span class="v">' + usd(a) + '<small>' + (r.paid ? '<span class="pill p-ok">Paid</span>' : '<span class="pill p-due">Unpaid</span>') + '</small></span>';
        if (r.paid && r.paid_at) d.title = 'Paid ' + new Date(r.paid_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) + (r.paid_fx ? ' at ' + Number(r.paid_fx).toFixed(2) + ' EGP per $1' : '');
        days.appendChild(d);
      });
      head.addEventListener('click', () => {
        const open = !wrap.classList.contains('open');
        wrap.classList.toggle('open', open); head.setAttribute('aria-expanded', String(open));
        open ? openMonths.add(m) : openMonths.delete(m);
      });
      wrap.appendChild(head); wrap.appendChild(days); box.appendChild(wrap);
    });
  }
  const openMonths = new Set(); // months you've opened stay open when the list refreshes

  // ======================================================================
  // Owner: menu, Live now, Invite and access, and the /cash pages
  // ======================================================================
  const OWNER_PAGES = { live:'Live now', requests:'Missed-shift requests', people:'Invite and access', mytime:'My time', overview:'Overview', team:'Team', income:'Income', expense:'Expenses' };
  let companies = [];

  async function startOwner(){
    show('vApp');
    $('burger').hidden = false; $('drawer').hidden = false;
    $('me').textContent = 'A'; $('me').classList.add('owner');
    $('pTrack').hidden = true;
    const { data } = await db.from('companies').select('id,name').order('name');
    companies = data || [];
    ownerRoute();
  }
  function ownerRoute(){
    if (role !== 'owner') return;
    let page = location.hash.slice(1);
    if (!OWNER_PAGES[page]) { page = 'live'; history.replaceState(null, '', '#live'); }
    $('title').textContent = OWNER_PAGES[page];
    document.querySelectorAll('.drawer .mi[href]').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + page));
    $('pLive').hidden = page !== 'live'; $('pPeople').hidden = page !== 'people'; $('pRequests').hidden = page !== 'requests';
    const cashPage = !['live', 'people', 'requests'].includes(page);
    $('pCash').hidden = !cashPage;
    clearInterval(liveTimer);
    if (page === 'live') { loadLive(); liveTimer = setInterval(loadLive, 15000); }
    if (page === 'people') loadPeople();
    if (page === 'requests') loadOwnerRequests();
    countRequests();
    if (cashPage) openCash(page);
    closeMenu();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', ownerRoute);

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
  document.querySelectorAll('.drawer .mi[href]').forEach(a => a.addEventListener('click', () => { if (a.getAttribute('href') === location.hash) ownerRoute(); }));

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
    clearInterval(tickTimer); tickTimer = setInterval(() => { if (!$('pLive').hidden) drawLive(); }, 1000);
  }
  function drawLive(){
    const coName = id => (companies.find(c => c.id === id) || {}).name || '';
    const now = Date.now();
    const fromCode = codeRows.map(r => ({ m:{ name:r.name, company_id:r.company_id }, s:r, viaCode:true }));
    const people = liveMembers.map(m => ({ m, s: liveRows.find(r => r.user_id === m.user_id) })).concat(fromCode).map(({ m, s, viaCode }) => {
      if (!s) return { m, mode:'off' };
      const seg = Math.max(0, (now - new Date(s.seg_at).getTime()) / 1000);
      return { m, mode:s.mode, work: s.work_seconds + (s.mode === 'run' ? seg : 0), brk: s.break_seconds + (s.mode === 'brk' ? seg : 0), seg, since: new Date(s.started_at), long: (now - new Date(s.started_at).getTime()) / 1000 > 10 * 3600, viaCode, quiet: viaCode && now - new Date(s.updated_at).getTime() > 15 * 60e3, seen: new Date(s.updated_at) };
    });
    const order = { run:0, brk:1, pau:2, off:3 };
    people.sort((a, b) => order[a.mode] - order[b.mode] || a.m.name.localeCompare(b.m.name));
    const count = k => people.filter(p => p.mode === k).length;
    $('lRun').textContent = count('run'); $('lBrk').textContent = count('brk'); $('lPau').textContent = count('pau');
    $('liveCnt').hidden = !count('run'); $('liveCnt').textContent = count('run') + ' working';
    const box = $('liveList');
    if (!people.length) { box.innerHTML = '<p class="empty">No team members yet. Invite someone from Invite and access.</p>'; return; }
    const pill = { run:'<span class="pill p-ok">Working</span>', brk:'<span class="pill p-due">On break</span>', pau:'<span class="pill p-pau">Paused</span>', off:'<span class="pill p-off">Off</span>' };
    box.innerHTML = people.map(p => {
      const sub = p.mode === 'off' ? 'Not clocked in' : (p.long ? 'Clocked in over 10 hours ago. Did they forget to clock out? · ' : '') + coName(p.m.company_id) + ' · ' + (p.mode === 'run' ? 'working since ' + hhmm(p.since) : p.mode === 'brk' ? 'on break ' + Math.floor(p.seg / 60) + 'm' : 'paused ' + Math.floor(p.seg / 60) + 'm') + (p.viaCode ? ' · via /tracker' + (p.quiet ? ', last heard from ' + hhmm(p.seen) : '') : '');
      return '<div class="row' + (p.long ? ' long' : '') + '"><span class="av">' + esc(initials(p.m.name)) + '</span><span class="n"><b>' + esc(p.m.name) + '</b><small>' + esc(sub) + '</small></span>' +
        '<span class="v">' + (p.mode === 'off' ? '' : '<span class="num">' + clock(p.work) + '</span><small>') + pill[p.mode] + (p.mode === 'off' ? '' : '</small>') + '</span></div>';
    }).join('');
  }

  // ---------- missed-shift requests (owner) ----------
  async function countRequests(){
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
    const row = (r, actions) => {
      const d = document.createElement('div'); d.className = 'person';
      d.innerHTML = '<div class="head"><span class="av"></span><span class="n"><b></b><small></small></span><span class="num rq-h"></span></div>' + (actions ? '<div class="acts"><button class="btn small" data-ok="1">Approve</button><button class="btn ghost small" data-ok="0">Decline</button></div>' : '');
      d.querySelector('.av').textContent = initials(r.name);
      d.querySelector('b').textContent = r.name + ' · ' + dayDate(r.shift_date);
      d.querySelector('small').textContent = hhmm(new Date(r.started_at)) + '–' + hhmm(new Date(r.ended_at)) + (r.break_seconds >= 60 ? ' · ' + hm(r.break_seconds) + ' break' : '') + ' · ' + coName(r.company_id) +
        (r.note ? ' · “' + r.note + '”' : '') + (actions ? '' : ' · ' + (r.status === 'approved' ? 'Approved' : 'Declined' + (r.reason ? ': ' + r.reason : '')));
      d.querySelector('.rq-h').textContent = hm(r.work_seconds);
      if (actions) d.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', async () => {
        const ok = b.dataset.ok === '1';
        let reason = null;
        if (!ok) { reason = prompt('Why are you declining it? (optional, ' + r.name.split(' ')[0] + ' will see this)', ''); if (reason === null) return; }
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
    pend.forEach(r => $('reqPending').appendChild(row(r, true)));
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
      const sel = d.querySelector('select'); fillCompanies(sel, m.company_id);
      sel.addEventListener('change', async () => {
        const { error } = await db.from('members').update({ company_id: Number(sel.value) }).eq('user_id', m.user_id);
        toast(error ? 'Couldn’t change it. Try again.' : m.name.split(' ')[0] + ' now works for ' + sel.options[sel.selectedIndex].text);
      });
      d.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', async () => {
        const a = b.dataset.a;
        if (a === 'remove' && !confirm('Remove ' + m.name + '’s access? They won’t be able to sign in. Their shifts stay in your records.')) return;
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

  function stopTimers(){ clearInterval(tickTimer); clearInterval(liveTimer); }

  // ---------- install ----------
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('installBtn').hidden = false; });
  $('installBtn').addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); installPrompt = null; $('installBtn').hidden = true; closeMenu(); });
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
  db.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { stopTimers(); show('vLogin'); } });
})();
