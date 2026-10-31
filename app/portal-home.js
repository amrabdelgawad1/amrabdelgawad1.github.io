// Portal homes inside /app (round 4). Four views in one panel (#pView), opened by app.js's menu routing:
//   #home      Team home for team members (screens 6 and 4): clock in or out, continue learning, their areas, locked courses
//   #portal    Amr's Portal view (screen 1): today's numbers, one card per area, "Waiting for you"
//   #admin     Amr's Admin overview (screen 5): what needs him, one box per sidebar group
//   #progress  Learner progress for Amr and managers: pass counts only (portal_learner_progress, round 2)
// Deal numbers (round 7): deals are encrypted in the browser, so the database can't count them. After the Deal CRM is
// unlocked in this tab it leaves counts only (no names, places or money) in sessionStorage "dealCounts"; without them
// these pages say "Unlock the CRM to see deal numbers" instead of guessing.
// Everything here reads through the page's own Supabase client (window.TalentsApp.db) and the database's rules:
// a number someone may not see simply doesn't load. Styles: /portal.css (.p-*) and app.css (#pView).
(function(){
  'use strict';
  const A = () => window.TalentsApp || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const svg = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const IC = {
    house:svg('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9.5h12V10"/>'),
    book:svg('<path d="M5 5.5h14v10H9l-4 3.5z"/>'),
    bookBig:svg('<path d="M5 4.5h11.5a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2z"/><path d="M5 17.5a2 2 0 0 1 2-2h11.5"/>'),
    clock:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    calc:svg('<rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="M9 7.5h6M9 11.5h6M9 15.5h3"/>'),
    lock:svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    people:svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c2.2.1 3.8 1.6 4.5 4.3"/>'),
    mic:svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    cash:svg('<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
    chart:svg('<path d="M5 19V11M12 19V5M19 19v-6"/>')
  };
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const first = n => String(n || '').trim().split(/\s+/)[0] || 'there';
  const hm = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0'); };
  const day = d => { try { return new Date(d + (String(d).length === 10 ? 'T12:00' : '')).toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' }); } catch(e) { return ''; } };
  const COURSES = [
    { key:'course', name:'Real Estate Acquisitions', short:'Acquisitions', href:'/course/', total:15 },
    { key:'mkt', name:'Marketing', short:'Marketing', href:'/app/course/', total:16, id:'mkt2' },
    { key:'psy', name:'Psychology and Therapy', short:'Psychology', href:'/app/psychology/', total:27, id:'psy' }
  ];
  let view = '', run = 0;
  const box = () => $('pViewBody');

  // ---------- small builders ----------
  const hero = (kick, title, sub, right) => '<section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">' + esc(kick) + '</span><h1>' + esc(title) + '</h1>' +
    (sub ? '<p id="pvSub">' + sub + '</p>' : '') + '</div>' + (right || '') + '</section>';
  const stat = (n, label, href) => '<a class="p-stat" href="' + href + '"><b>' + n + '</b>' + esc(label) + '</a>';
  const area = (o) => '<a class="p-area" href="' + esc(o.href) + '"><span class="p-ic">' + IC[o.icon] + '</span><span class="p-area-txt"><h3>' + esc(o.name) + '</h3><p>' + esc(o.sub) + '</p></span>' +
    (o.pill ? '<span class="p-pill">' + esc(o.pill) + '</span>' : '') + '</a>';
  const row = (label, right, href, ext) => href
    ? '<a class="p-row" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '><span>' + esc(label) + '</span>' + right + '</a>'
    : '<div class="p-row"><span>' + esc(label) + '</span>' + right + '</div>';
  const muted = t => '<span>' + esc(t) + '</span>';
  const pillR = t => '<span class="p-pill">' + esc(t) + '</span>';
  const box5 = (title, kick, rows) => '<section class="p-card"><div class="p-card-head"><h2>' + esc(title) + '</h2><span>' + esc(kick) + '</span></div>' + rows.join('') + '</section>';
  const acard = o => '<article class="p-acard"><div class="p-acard-band"><span class="p-hero-bar"></span><span class="p-acard-kick">' + esc(o.band) + '</span>' + IC[o.icon] + '</div>' +
    '<div class="p-acard-body"><span class="p-kick">' + esc(o.kick) + '</span><h3>' + esc(o.name) + '</h3><p>' + esc(o.sub) + '</p>' +
    (o.meta ? '<p class="p-acard-meta">' + o.meta + '</p>' : '') + '<a class="p-btn" href="' + esc(o.href) + '">' + esc(o.btn) + '</a></div></article>';
  const metaN = (n, t) => '<span><b>' + esc(n) + '</b> ' + esc(t) + '</span>';
  const safe = p => p.then(r => r, () => ({}));
  const UNLOCK = 'Unlock the CRM to see deal numbers';
  // Deals under contract with a date in the next n days (from public.deals: dates only, no names; Amr sees everyone's)
  function soon(rows, key, n){
    if (!Array.isArray(rows)) return muted('–');
    const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const t = new Date(), today = ymd(t), end = new Date(t); end.setDate(end.getDate() + n); const last = ymd(end);   // calendar days, safe across clock changes
    const k = rows.filter(r => r[key] && r[key] >= today && r[key] <= last).length;
    return k ? pillR(plural(k, 'deal')) : muted('None');
  }
  function dealCounts(){
    try { const c = JSON.parse(sessionStorage.getItem('dealCounts') || 'null'); return c && typeof c.open === 'number' ? c : null; } catch(e) { return null; }
  }

  // ---------- shared numbers ----------
  async function liveCount(db){
    const [st, code] = await Promise.all([safe(db.from('live_status').select('user_id')), safe(db.from('code_live_status').select('updated_at'))]);
    const recent = (code.data || []).filter(r => Date.now() - new Date(r.updated_at).getTime() < 16 * 3600e3).length;
    return st.error ? null : (st.data || []).length + recent;
  }
  async function pendingRequests(db){
    const r = await safe(db.from('shift_requests').select('id,name,shift_date,user_id').eq('status', 'pending').order('shift_date'));
    return r.error ? null : (r.data || []);
  }
  async function reviewsWaiting(db){
    const [u, w] = await Promise.all([safe(db.from('hub_uploads').select('id,user_id,title,course,module,created_at').eq('status', 'waiting').order('created_at')), safe(db.rpc('course_admin_waiting'))]);
    return (u.data || []).map(x => ({ who:x.user_id, title:x.title || 'Recording', course:x.course, module:x.module }))
      .concat((Array.isArray(w.data) ? w.data : []).map(x => ({ who:x.userId, title:x.title || 'Written drill', course:'acq', drill:true })));
  }
  async function learners(db, owner){
    const [p, a] = await Promise.all([safe(db.rpc('portal_learner_progress')), owner ? safe(db.rpc('course_admin_learners')) : Promise.resolve({})]);
    return { hub:Array.isArray(p.data) ? p.data : [], acq:Array.isArray(a.data) ? a.data : [], error:p.error };
  }

  // ======================================================================
  // Team home (#home)
  // ======================================================================
  async function home(my){
    const T = A(), me = T.me || { role:'agent', keys:T.access || [] }, keys = me.keys || [], prof = T.profile || {};
    const has = k => keys.includes(k);
    const learnOn = has('learn') || has('course');
    const areas = [];
    if (has('deals')) areas.push({ href:'/app/deals/', icon:'house', name:'My deals', sub:'Your leads and follow-ups.' });
    if (learnOn) areas.push({ href:'/app/learn/', icon:'book', name:'Learning Hub', sub:'Your courses and progress.' });
    areas.push({ href:'#track', icon:'clock', name:'My hours', sub:'Shifts, hours and requests.' });
    if (has('deals')) areas.push({ href:'/land-calculator/', icon:'calc', name:'Calculators', sub:'Land and house deal tools.' });
    if (has('live') || has('requests')) areas.push({ href:has('live') ? '#live' : '#requests', icon:'people', name:'Team and shifts', sub:'Live now, hours and requests.', id:'team' });
    if (me.role === 'manager') areas.push({ href:'#progress', icon:'chart', name:'Learner progress', sub:'How the team is doing in each course.' });
    const open = c => c.key === 'course' ? has('course') : has('learn') && has(c.key);
    const locked = COURSES.filter(c => !open(c));
    box().innerHTML = '<div class="p-wrap">' +
      hero('Portal', 'Hi, ' + first(prof.name), clockLine(), '<div class="p-hero-act" id="pvClockBox">' + clockBtn() + '</div>') +
      '<div id="pvAnnc"></div>' +
      '<section aria-labelledby="pvToday" class="p-today-wrap"><h2 class="p-h2" id="pvToday">Today <small>' + esc(new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })) + '</small></h2>' +
        '<div class="p-today" id="pvTodayNums"><p class="p-loading">Loading…</p></div>' +
        (has('deals') ? '<div class="p-grid p-today-lists"><section class="p-card" aria-labelledby="pvDueH"><div class="p-card-head"><h2 id="pvDueH">Callbacks due</h2><span id="pvDueN"></span></div><div id="pvDue"><p class="p-loading">Loading…</p></div></section>' +
          '<section class="p-card" aria-labelledby="pvActH"><div class="p-card-head"><h2 id="pvActH">Deals needing action</h2><span id="pvActN"></span></div><div id="pvAct"><p class="p-loading">Loading…</p></div></section></div>' : '') +
      '</section>' +
      '<section aria-labelledby="pvCommH" id="pvCommWrap" hidden><div class="p-card"><div class="p-card-head"><h2 id="pvCommH">Your commissions</h2><span id="pvCommN"></span></div><div id="pvComm"></div></div></section>' +
      '<section aria-labelledby="pvCont" id="pvContWrap" hidden><h2 class="p-h2" id="pvCont">Next lesson</h2><div id="pvContBox"></div></section>' +
      '<section aria-labelledby="pvAreas"><h2 class="p-h2" id="pvAreas">Your areas</h2><div class="p-grid p-areas">' + areas.map(area).join('') + '</div></section>' +
      '<section aria-labelledby="pvBoard" id="pvBoardWrap" hidden><h2 class="p-h2" id="pvBoard">This week on the team <small>Monday to Sunday</small></h2><div id="pvBoardBox"></div></section>' +
      (locked.length ? '<section aria-labelledby="pvLocked"><h2 class="p-h2 p-h2-sm" id="pvLocked">Not open for you yet</h2><div class="p-lockrow">' +
        locked.map(c => '<p class="p-locked">' + IC.lock + '<span><b>' + esc(c.name.replace('Real Estate ', '')) + ' course</b> · Locked</span><button type="button" class="p-btn is-ghost p-ask" data-ask="' + esc(c.key) + '">Ask for access</button></p>').join('') + '</div></section>' : '') +
      '</div>';
    $('pvClockBox').addEventListener('click', e => { const b = e.target.closest('[data-clock]'); if (b) T.clock(b.dataset.clock); });
    // Phase 1: a locked course's "Ask for access" sends Amr a notification (once a day per course)
    box().querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', async () => {
      if (b.disabled) return; b.disabled = true; b.textContent = 'Sending…';
      const r = await safe(T.db.rpc('request_course_access', { p_course:b.dataset.ask }));
      b.textContent = r.error || !r.data ? 'Couldn’t send. Try again' : r.data === 'already' ? 'Already asked today' : 'Sent to Amr';
      b.disabled = !(r.error || !r.data);
    }));
    board(T.db, my);
    announcement(T.db, my);
    today(T.db, my, has('deals'));
    myCommissions(T.db, my);
    if (me.role === 'manager' || has('requests')) {
      const n = (await pendingRequests(T.db) || []).length;
      if (my !== run) return;
      const a = box().querySelector('.p-area[href="#requests"], .p-area[href="#live"]');
      if (a && n) a.insertAdjacentHTML('beforeend', pillR(plural(n, 'request')));
    }
    const cont = await continueLearning(T.db, open);
    if (my !== run || !cont) return;
    $('pvContBox').innerHTML = '<a class="p-card p-cont" href="' + esc(cont.href) + '"><span class="p-cont-txt"><span class="p-kick">' + esc(cont.kick) + '</span><b>' + esc(cont.title) + '</b></span>' +
      '<span class="p-cont-prog"><span class="p-bar" role="progressbar" aria-label="' + esc(cont.course) + ' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + cont.pct + '"><i></i></span><b>' + cont.pct + '%</b></span>' +
      '<span class="p-btn">Continue</span></a>';
    const i = $('pvContBox').querySelector('.p-bar i'); if (i) i.style.width = cont.pct + '%';   // set by script (/app allows it); never a style="" attribute
    $('pvContWrap').hidden = false;
  }
  // ---------- Today (Phase 1) ----------
  // Days: the heading and "due" use this device's own day, the same day the Deal CRM uses when a follow-up date is
  // picked, so a callback set for today shows as today. The call numbers use the Cairo day, like the Admin overview's
  // Calls today, so the two always agree. On purpose; only far-off time zones late in the evening ever see the gap.
  // The first thing after sign-in: today's numbers (portal_my_today, own counts only), callbacks due and deals needing
  // action. Deals come from public.deals under its rules (your own rows); only the readable fields are used: kind,
  // county, state, stage and dates. Seller names and details stay encrypted in the CRM, which a row opens.
  const STAGE = { lead:'New lead', talking:'Talking', offer:'Offer sent', contract:'Under contract' };
  const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const title = t => String(t || '').replace(/\b\w/g, x => x.toUpperCase());
  const dealName = d => (d.kind === 'house' ? 'House' : 'Land') + (d.county || d.state ? ' · ' + [d.county ? title(d.county) : '', d.state || ''].filter(Boolean).join(', ') : '');
  const daysLate = (due, now) => Math.round((new Date(now + 'T12:00') - new Date(due + 'T12:00')) / 864e5);
  const dealRow = (d, right) => row(dealName(d), right, '/app/deals/#id=' + encodeURIComponent(d.id));
  // The next contract date still to come (inspection end, then closing), for sorting; '9999' when none is left
  const nextDate = (d, now) => [d.inspection_ends, d.closing_on].filter(x => x && x >= now)[0] || (d.closing_on && d.closing_on < now ? d.closing_on : '9999');
  // Under contract: the next date that matters (inspection end, then closing), as a countdown
  function contractTxt(d, now){
    const k = x => x ? Math.round((new Date(x + 'T12:00') - new Date(now + 'T12:00')) / 864e5) : null;
    const ins = k(d.inspection_ends), cl = k(d.closing_on);
    if (ins != null && ins >= 0) return { t:ins === 0 ? 'Inspection ends today' : 'Inspection ends in ' + plural(ins, 'day'), hot:ins <= 3 };
    if (ins != null && cl == null) return { t:'Inspection over', hot:false };
    if (cl != null) return { t:cl > 0 ? 'Closing in ' + plural(cl, 'day') : cl === 0 ? 'Closing today' : 'Closing was ' + plural(-cl, 'day') + ' ago', hot:cl <= 7, late:cl < 0 };
    return { t:'Under contract · add dates', hot:false };
  }
  async function today(db, my, deals){
    const T = A(), st = T.clockState ? T.clockState() : null;
    const [n, r] = await Promise.all([safe(db.rpc('portal_my_today')),
      deals ? safe(db.from('deals').select('id,kind,county,state,stage,follow_up,updated_at,inspection_ends,closing_on').eq('owner', T.user.id).not('stage', 'in', '(closed,passed)')) : Promise.resolve({})]);
    if (my !== run) return;
    const c = (Array.isArray(n.data) ? n.data[0] : n.data) || null;
    const tile = (v, label, href) => '<a class="p-tile" href="' + href + '"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></a>';
    $('pvTodayNums').innerHTML = tile(st ? hm(st.work) : '0:00', 'hours today', '#track') +
      tile(c ? c.dials : '–', c && c.dials === 1 ? 'call' : 'calls', '#track') + tile(c ? c.conversations : '–', c && c.conversations === 1 ? 'conversation' : 'conversations', '#track') +
      tile(c ? (c.offers || 0) + (c.appointments || 0) : '–', 'offers and appointments', '#track');
    if (!deals) return;
    if (r.error) { $('pvDue').innerHTML = $('pvAct').innerHTML = '<p class="p-empty">Couldn’t load your deals. Refresh to try again.</p>'; return; }
    const now = isoDay(new Date()), list = r.data || [];
    const due = list.filter(d => d.follow_up && d.follow_up <= now).sort((a, b) => a.follow_up < b.follow_up ? -1 : 1);
    const act = list.filter(d => !d.follow_up || d.stage === 'contract').filter(d => !due.includes(d))
      .sort((a, b) => (a.stage === 'contract' ? 0 : 1) - (b.stage === 'contract' ? 0 : 1) || nextDate(a, now).localeCompare(nextDate(b, now)) || String(a.updated_at || '').localeCompare(String(b.updated_at || '')));
    $('pvDueN').textContent = due.length ? plural(due.length, 'deal') : '';
    $('pvActN').textContent = act.length ? plural(act.length, 'deal') : '';
    const lateTxt = d => { const k = daysLate(d.follow_up, now); return k <= 0 ? 'Today' : k === 1 ? '1 day late' : k + ' days late'; };
    $('pvDue').innerHTML = due.length ? due.slice(0, 6).map(d => dealRow(d, '<span class="p-pill' + (d.follow_up < now ? ' is-no' : '') + '">' + esc(lateTxt(d)) + '</span>')).join('') +
        (due.length > 6 ? row('And ' + (due.length - 6) + ' more', muted('Open the CRM'), '/app/deals/') : '')
      : '<p class="p-empty">' + (list.length ? 'No callbacks due today.' : 'No open deals yet. Deals you add in the Deal CRM show up here.') + '</p>';
    $('pvAct').innerHTML = act.length ? act.slice(0, 6).map(d => { const c = d.stage === 'contract' ? contractTxt(d, now) : null; return dealRow(d, '<span class="p-pill' + (c ? (c.late ? ' is-no' : c.hot ? '' : ' is-plain') : ' is-plain') + '">' + esc(c ? c.t : (STAGE[d.stage] || 'Open') + ' · no follow-up') + '</span>'); }).join('') +
        (act.length > 6 ? row('And ' + (act.length - 6) + ' more', muted('Open the CRM'), '/app/deals/') : '')
      : '<p class="p-empty">' + (list.length ? 'Every open deal has a next step.' : 'Nothing yet.') + '</p>';
  }
  // This week's team board: calls logged, lessons passed, drills sent. One database function (portal_team_board) that
  // never returns hours or pay; everyone on the team sees the same board.
  async function board(db, my){
    const r = await safe(db.rpc('portal_team_board'));
    if (my !== run || !Array.isArray(r.data) || !r.data.length) return;
    $('pvBoardBox').innerHTML = '<div class="p-tablewrap"><table class="p-table"><thead><tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">Calls logged</th><th scope="col">Lessons passed</th><th scope="col">Drills sent</th></tr></thead><tbody>' +
      r.data.map((x, i) => '<tr' + (x.is_me ? ' class="is-me"' : '') + '><td class="p-rank">' + (i + 1) + '</td><td>' + esc(x.is_me ? (x.name || 'You') + ' (you)' : x.name || 'Someone') + '</td><td>' +
        (Number(x.calls) || 0) + '</td><td>' + (Number(x.lessons) || 0) + '</td><td>' + (Number(x.drills) || 0) + '</td></tr>').join('') + '</tbody></table></div>';
    $('pvBoardWrap').hidden = false;
  }
  // Amr's pinned announcement (portal_announcement), on the Team home
  async function announcement(db, my){
    const r = await safe(db.rpc('portal_announcement'));
    if (my !== run || !r.data || !r.data.message) return;
    $('pvAnnc').innerHTML = '<section class="p-annc" aria-label="Announcement from Amr"><span><b>From Amr</b><p>' + esc(r.data.message) + '</p></span></section>';
  }
  function clockLine(){
    const T = A(), st = T.clockState ? T.clockState() : null, prof = T.profile || {};
    if (!prof.company_id) return 'Amr needs to set the company you work for before you can clock in.';
    if (!st || !st.live) return 'You’re not clocked in.';
    const m = st.live.mode;
    return (m === 'run' ? 'You’re clocked in' : m === 'brk' ? 'You’re on a break' : 'You’re paused') + ' · ' + hm(st.work) + ' today';
  }
  function clockBtn(){
    const T = A(), st = T.clockState ? T.clockState() : null, prof = T.profile || {};
    if (!prof.company_id) return '';
    return st && st.live ? '<button type="button" class="p-btn is-hi" data-clock="off">Clock out</button>' : '<button type="button" class="p-btn is-hi" data-clock="run">Clock in</button>';
  }
  async function continueLearning(db, open){
    for (const c of COURSES) {
      if (!open(c)) continue;
      if (c.key === 'course') {
        const r = await safe(db.rpc('course_state', { p_content:false }));
        const s = r.data; if (!s || !Array.isArray(s.modules)) continue;
        const byN = {}; s.modules.forEach(m => byN[m.number] = m);
        const passed = s.modules.filter(m => byN[m.number + 1] && byN[m.number + 1].openForLearners).length;
        const now = s.modules.find(m => m.openForLearners && !(byN[m.number + 1] && byN[m.number + 1].openForLearners)) || s.modules[0];
        const total = s.totalModules || s.modules.length || c.total;
        return { course:c.short, href:c.href, kick:c.name + (now ? ' · Module ' + now.number : ''), title:(now && now.title) || 'Start the course', pct:Math.round(passed / total * 100) };
      }
      const r = await safe(db.from('learn_progress').select('data').eq('user_id', A().user.id).eq('course', c.id).maybeSingle());
      const d = r.data && r.data.data;
      let passed = 0;
      if (c.key === 'mkt' && d && d.m) passed = Object.values(d.m).filter(m => m && m.quiz && (m.quiz.best || 0) >= 80).length;
      if (c.key === 'psy' && d && d.kv) { const ids = new Set(Object.keys(d.kv).map(k => (k.match(/^(?:exam|best):(m\d+)$|^done:(m\d+):exam$/) || []).slice(1).find(Boolean)).filter(Boolean));
        passed = [...ids].filter(id => d.kv['done:' + id + ':exam'] === '1' || Math.max(+d.kv['exam:' + id] || 0, +d.kv['best:' + id] || 0) >= 16).length; }
      return { course:c.short, href:c.href, kick:c.name + ' · Module ' + Math.min(passed + 1, c.total), title:passed ? plural(passed, 'module') + ' passed' : 'Start the course', pct:Math.round(passed / c.total * 100) };
    }
    return null;
  }

  // ======================================================================
  // Amr's Portal view (#portal)
  // ======================================================================
  async function portal(my){
    const T = A(), db = T.db;
    const h = new Date().getHours(), greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    box().innerHTML = '<div class="p-wrap">' + hero('Portal', greet + ', Amr', '6 areas', '') + '<p class="p-loading">Loading…</p></div>';
    const [live, reqs, revs, lr] = await Promise.all([liveCount(db), pendingRequests(db), reviewsWaiting(db), learners(db, true)]);
    if (my !== run) return;
    const names = await nameMap(db);
    const learning = new Set(lr.hub.filter(x => x.passed > 0 || x.updated_at).map(x => x.user_id).concat(lr.acq.filter(x => x.done > 0 || x.module).map(x => x.userId))).size;
    const r = reqs || [], waitN = revs.length + r.length;
    const month = new Date().toLocaleDateString('en-US', { month:'short' }), dc = dealCounts();
    box().innerHTML = '<div class="p-wrap">' +
      hero('Portal', greet + ', Amr', '6 areas · ' + plural(waitN, 'thing') + ' waiting for you',
        '<div class="p-stats">' + stat(revs.length, 'to review', '#review') + stat(live == null ? '–' : live, 'clocked in now', '#live') + stat(r.length, r.length === 1 ? 'shift request' : 'shift requests', '#requests') + '</div>') +
      '<section aria-labelledby="pvAreas"><h2 class="p-h2" id="pvAreas">Your areas</h2><div class="p-grid p-acards">' + [
        acard({ band:'Learning Hub', icon:'bookBig', kick:'3 courses', name:'Courses', sub:'Acquisitions, Marketing, and Psychology and Therapy, with progress for everyone learning.', meta:metaN(learning, 'learning'), href:'/app/learn/', btn:'Open Learning Hub' }),
        acard({ band:'Deals', icon:'house', kick:'Everyone’s deals', name:'Deal CRM', sub:'Every seller lead and deal, from first call to closing, with follow-ups.',
          meta:dc ? metaN(dc.open, 'open') + ' ' + metaN(dc.due, 'due') + ' ' + metaN(dc.contract, 'under contract') : esc(UNLOCK), href:'/app/deals/', btn:dc ? 'Open Deal CRM' : 'Unlock the CRM' }),
        acard({ band:'Money', icon:'cash', kick:'Only you', name:'Cash', sub:'Income, expenses and profit for the month, in one place.', meta:metaN(month, 'this month'), href:'#overview', btn:'Open Cash' }),
        acard({ band:'Team', icon:'people', kick:'Live now', name:'Team and shifts', sub:'Who is clocked in, hours, missed-shift requests and invites.', meta:metaN(live == null ? '–' : live, 'clocked in') + ' ' + metaN(r.length, r.length === 1 ? 'request' : 'requests'), href:'#live', btn:'Open Team' }),
        acard({ band:'Reviews', icon:'mic', kick:revs.length + ' waiting', name:'Review center', sub:'Call recordings, files and written drills from every course, scored in one place.', meta:metaN(revs.length, 'to review'), href:'#review', btn:'Open Review center' }),
        acard({ band:'Tools', icon:'calc', kick:'Opens in its own look', name:'Deal calculators', sub:'Land and house calculators, kept exactly as they are, one click away.', meta:metaN(2, 'calculators'), href:'/land-calculator/', btn:'Open calculators' })
      ].join('') + '</div></section>' +
      '<section aria-labelledby="pvWait"><h2 class="p-h2" id="pvWait">Waiting for you</h2>' + waitingList(revs, r, names) + '</section>' +
      '</div>';
  }
  function waitingList(revs, reqs, names){
    const items = revs.slice(0, 6).map(x => ({ tag:'Review', text:x.title + ', from ' + (names[x.who] || 'a learner'), href:x.drill ? '/course/#/admin' : '#review/' + encodeURIComponent(x.who), act:'Score it' }))
      .concat(reqs.slice(0, 6).map(x => ({ tag:'Team', text:'Missed-shift request from ' + first(x.name || names[x.user_id]) + (x.shift_date ? ' for ' + day(x.shift_date) : ''), href:'#requests', act:'Approve or decline' })));
    if (!items.length) return '<p class="p-card p-empty">Nothing is waiting for you. Nice.</p>';
    return '<div class="p-card p-wait">' + items.map(x => '<div class="p-wait-row"><span class="p-pill">' + esc(x.tag) + '</span><span class="p-wait-txt">' + esc(x.text) + '</span><a href="' + esc(x.href) + '">' + esc(x.act) + '</a></div>').join('') + '</div>';
  }
  async function nameMap(db){
    const r = await safe(db.from('members').select('user_id,name'));
    const m = {}; (r.data || []).forEach(x => m[x.user_id] = x.name); return m;
  }

  // ======================================================================
  // Amr's Admin overview (#admin)
  // ======================================================================
  async function admin(my){
    const T = A(), db = T.db;
    box().innerHTML = '<div class="p-wrap">' + hero('Admin', 'Overview', 'Loading…', '') + '</div>';
    const [live, reqs, revs, lr, mem, vis, calls, ann, eod, uc, cms] = await Promise.all([liveCount(db), pendingRequests(db), reviewsWaiting(db), learners(db, true),
      safe(db.from('members').select('active')), safe(db.rpc('visit_stats', { p_hours:168 })), safe(db.rpc('portal_calls_today')), safe(db.rpc('portal_announcement')), safe(db.rpc('portal_eod')), safe(db.from('deals').select('inspection_ends,closing_on').eq('stage', 'contract')), safe(db.from('commissions').select('amount').eq('status', 'owed'))]);
    if (my !== run) return;
    const r = reqs || [], team = (mem.data || []).filter(x => x.active).length, dc = dealCounts();
    const ct = Array.isArray(calls.data) ? calls.data : null, sum = k => (ct || []).reduce((a, x) => a + (Number(x[k]) || 0), 0);
    const learning = new Set(lr.hub.map(x => x.user_id).concat(lr.acq.filter(x => x.done > 0 || x.module).map(x => x.userId))).size;
    const need = revs.length + r.length;
    const v = vis.data && vis.data.visitors != null ? Number(vis.data.visitors).toLocaleString('en-US') : null;
    box().innerHTML = '<div class="p-wrap">' +
      hero('Admin', 'Overview', need ? plural(need, 'thing') + ' need you today' : 'Nothing needs you right now',
        '<div class="p-stats">' + stat(revs.length, 'to review', '#review') + stat(r.length, r.length === 1 ? 'shift request' : 'shift requests', '#requests') + stat(live == null ? '–' : live, 'clocked in now', '#live') + '</div>') +
      '<div class="p-grid p-boxes">' +
        box5('People', plural(team, 'person', 'people') + ' on the team', [row('Team overview', muted('Open'), '#teamview'), row('Clocked in now', muted(live == null ? '–' : plural(live, 'person', 'people')), '#live'),
          row('Missed-shift requests', r.length ? pillR(r.length + ' waiting') : muted('None'), '#requests'),
          row('Calls today', muted(ct ? plural(sum('dials'), 'dial') + ' · ' + plural(sum('appointments'), 'appointment') : '–')),
          row('End-of-day reports', eodPill(eod.data)), row('Invite and access', muted('Manage'), '#people')]) +
        box5('Learning', '3 courses', [row('Review center', revs.length ? pillR(revs.length + ' waiting') : muted('None'), '#review'),
          row('Learner progress', muted(learning + ' learning'), '#progress'), row('Who has which course', muted('Manage'), '/app/learn/')]) +
        box5('Deals', 'All reps', [row('Closing in the next 14 days', soon(uc.data, 'closing_on', 14), '/app/deals/#pipeline'), row('Inspection ending in 7 days', soon(uc.data, 'inspection_ends', 7), '/app/deals/#pipeline')].concat(dc ? [row('Follow-ups due', dc.due ? pillR(dc.due + ' due') : muted('None'), '/app/deals/#followups'), row('Open deals', muted(String(dc.open)), '/app/deals/'),
          row('Under contract', muted(String(dc.contract)), '/app/deals/')] : [row(UNLOCK, muted('Unlock'), '/app/deals/')])
          .concat([row('Land calculator', muted('Open'), '/land-calculator/'), row('House calculator', muted('Open'), '/house-calculator/')])) +
        box5('Money', 'Only you', [row('Cash this month', muted('Open'), '#overview'), row('Commissions owed', owedPill(cms.data), '#expense'), row('Course payments', muted('Not set up yet'))]) +
        box5('Site', 'Public pages', [row('Visits this week', muted(v == null ? 'Open' : v), '#visits'), row('Team emails', muted('Open'), '#emails'), row('Logs', muted('Open'), '#logs'),
          row('Zoho Campaigns', muted('Open'), 'https://campaigns.zoho.com/', true)]) +
      '</div>' + callsToday(ct) + eodSection(eod.data) + annForm(ann.data) + '</div>';
    wireAnnForm(db);
    wireEod(db, my);
  }

  // Phase 2: commissions. Amr's total still owed to reps (from the commissions table; only he can read it)
  const money = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  function owedPill(rows){
    if (!Array.isArray(rows)) return muted('–');
    const t = rows.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    return rows.length ? pillR(money(t) + ' · ' + plural(rows.length, 'commission')) : muted('None');
  }
  // A rep's own commissions on their Team home (portal_my_commissions: the deal, the amount, owed or paid; never the
  // profit or the percentage). Hidden until they have one.
  async function myCommissions(db, my){
    const r = await safe(db.rpc('portal_my_commissions'));
    if (my !== run || !Array.isArray(r.data) || !r.data.length || !$('pvCommWrap')) return;
    const owed = r.data.filter(x => x.status === 'owed'), sum = l => l.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    $('pvCommN').textContent = owed.length ? money(sum(owed)) + ' owed' : 'All paid';
    $('pvComm').innerHTML = r.data.slice(0, 8).map(x => row(x.deal_label || 'Deal', '<span class="p-pill' + (x.status === 'paid' ? ' is-ok' : '') + '">' +
        esc(money(Number(x.amount) || 0) + ' · ' + (x.status === 'paid' ? 'paid' + (x.paid_on ? ' ' + new Date(x.paid_on + 'T12:00').toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '') : 'owed')) + '</span>')).join('') +
      (r.data.length > 8 ? '<p class="p-empty">And ' + (r.data.length - 8) + ' more.</p>' : '') +
      '<p class="p-empty">Paid so far: ' + esc(money(sum(r.data.filter(x => x.status === 'paid')))) + '</p>';
    $('pvCommWrap').hidden = false;
  }
  // Amr: one announcement pinned on everyone's Team home (set_announcement; empty clears it)
  function annForm(a){
    return '<section class="p-card p-annc-form" aria-labelledby="pvAnncH"><div class="p-card-head"><h2 id="pvAnncH">Announcement</h2><span>Pinned on everyone’s Team home</span></div>' +
      '<label class="p-vh" for="pvAnncText">Announcement</label><textarea id="pvAnncText" maxlength="600" placeholder="For example: Team call Monday at 9 am New York time.">' + esc(a && a.message || '') + '</textarea>' +
      '<div class="acts"><button type="button" class="p-btn" id="pvAnncPost">' + (a && a.message ? 'Update' : 'Post') + '</button>' + (a && a.message ? '<button type="button" class="p-btn is-ghost" id="pvAnncClear">Take it down</button>' : '') + '</div>' +
      '<p class="p-annc-msg" id="pvAnncMsg" role="status"></p></section>';
  }
  function wireAnnForm(db){
    const go = async text => {
      $('pvAnncMsg').textContent = 'Saving…';
      const r = await safe(db.rpc('set_announcement', { p_message:text }));
      if (r.error || !('data' in r)) { $('pvAnncMsg').textContent = 'Couldn’t save it. Check your connection.'; return; }
      $('pvAnncMsg').textContent = text ? 'Posted. The team sees it on their home page.' : 'Taken down.';
      if (!text) $('pvAnncText').value = '';
    };
    const post = $('pvAnncPost'), clear = $('pvAnncClear');
    if (post) post.addEventListener('click', () => { const t = $('pvAnncText').value.trim(); if (!t) { $('pvAnncMsg').textContent = 'Write the announcement first.'; return; } go(t); });
    if (clear) clear.addEventListener('click', () => go(''));
  }

  // ---------- End-of-day reports (Phase 1) ----------
  // Each rep's report is the note they send when they end a shift, with their numbers. portal_eod lists every active
  // person for one Cairo day: sent, missing (worked but a shift has no note), on shift, or didn't work. No pay.
  const EOD_STATUS = { missing:['No report', ' is-no'], on_shift:['On shift', ' is-ok'], sent:['Sent', ''], off:['Didn’t work', ' is-plain'] };
  function eodPill(rows){
    if (!Array.isArray(rows)) return muted('–');
    const miss = rows.filter(x => x.status === 'missing').length, sent = rows.filter(x => x.status === 'sent').length;
    return miss ? '<span class="p-pill is-no">' + esc(miss + ' missing') + '</span>' : muted(sent ? plural(sent, 'report') + ' in' : 'None yet');
  }
  // Today's date in Cairo, then whole calendar days back from it (safe across clock changes)
  const cairoDay = n => { const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone:'Africa/Cairo' }).format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  function eodCards(rows){
    if (!rows.length) return '<p class="p-card p-empty">No one on the team yet.</p>';
    return '<div class="p-eod-list">' + rows.map(x => {
      const st = EOD_STATUS[x.status] || EOD_STATUS.off, worked = Number(x.worked_seconds) || 0;
      const nums = worked || x.status === 'on_shift' ? [hm(worked) + ' worked', plural(Number(x.dials) || 0, 'dial'), plural(Number(x.conversations) || 0, 'conversation'),
        plural(Number(x.offers) || 0, 'offer'), plural(Number(x.appointments) || 0, 'appointment')].join(' · ') : '';
      const notes = (Array.isArray(x.reports) ? x.reports : []).map(r => '<p class="p-eod-note">' + esc(r.note) + '</p>').join('');
      const gap = x.status === 'missing' && x.shifts > x.with_report ? '<p class="p-eod-gap">' + esc(x.with_report ? (x.shifts - x.with_report) + ' of ' + plural(x.shifts, 'shift') + ' without a note' : 'No note with ' + (x.shifts === 1 ? 'this shift' : 'these shifts')) + '</p>' : '';
      return '<article class="p-card p-eod"><div class="p-eod-head"><b>' + esc(x.name || 'Someone') + '</b><span class="p-pill' + st[1] + '">' + esc(st[0]) + '</span></div>' +
        (nums ? '<p class="p-eod-nums">' + esc(nums) + '</p>' : '') + notes + gap + '</article>';
    }).join('') + '</div>';
  }
  function eodSection(rows){
    if (!Array.isArray(rows)) return '';
    return '<section aria-labelledby="pvEodH"><div class="p-eod-top"><h2 class="p-h2" id="pvEodH">End-of-day reports <small id="pvEodSum">' + esc(eodSum(rows)) + '</small></h2>' +
      '<div class="p-seg" role="group" aria-label="Which day"><button type="button" class="p-seg-b" data-eod="0" aria-pressed="true">Today</button><button type="button" class="p-seg-b" data-eod="-1" aria-pressed="false">Yesterday</button></div></div>' +
      '<div id="pvEodBox">' + eodCards(rows) + '</div></section>';
  }
  function eodSum(rows){
    const worked = rows.filter(x => x.status !== 'off').length, sent = rows.filter(x => x.status === 'sent').length;
    return worked ? sent + ' of ' + plural(worked, 'person', 'people') + ' who worked sent a report' : 'No one has worked yet';
  }
  function wireEod(db, my){
    const top = box().querySelector('.p-seg'); if (!top) return;
    top.addEventListener('click', async e => {
      const b = e.target.closest('[data-eod]'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
      top.querySelectorAll('[data-eod]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $('pvEodBox').innerHTML = '<p class="p-loading">Loading…</p>';
      const r = await safe(db.rpc('portal_eod', { p_day:cairoDay(Number(b.dataset.eod)) }));
      if (my !== run) return;
      if (!Array.isArray(r.data)) { $('pvEodBox').innerHTML = '<p class="p-card p-empty">Couldn’t load the reports. Refresh to try again.</p>'; return; }
      $('pvEodSum').textContent = eodSum(r.data); $('pvEodBox').innerHTML = eodCards(r.data);
    });
  }
  // Today's calls per person (portal_calls_today): ended shifts' numbers plus the taps of shifts still running
  function callsToday(ct){
    if (!ct || !ct.length) return '';
    return '<section aria-labelledby="pvCallsH"><h2 class="p-h2" id="pvCallsH">Calls today <small>Live: shifts still running count as they tap</small></h2>' +
      '<div class="p-tablewrap"><table class="p-table"><thead><tr><th scope="col">Name</th><th scope="col">Dials</th><th scope="col">Conversations</th><th scope="col">Offers</th><th scope="col">Appointments</th></tr></thead><tbody>' +
      ct.map(x => '<tr><td>' + esc(x.name) + (x.on_shift ? ' <span class="p-pill is-ok">On shift</span>' : '') + '</td><td>' + (Number(x.dials) || 0) + '</td><td>' + (Number(x.conversations) || 0) +
        '</td><td>' + (Number(x.offers) || 0) + '</td><td>' + (Number(x.appointments) || 0) + '</td></tr>').join('') + '</tbody></table></div></section>';
  }

  // ======================================================================
  // Learner progress (#progress): Amr and managers
  // ======================================================================
  async function progress(my){
    const T = A(), db = T.db, owner = T.role === 'owner';
    box().innerHTML = '<div class="p-wrap">' + hero('Learning', 'Learner progress', 'Passed modules in each course. Never anyone’s notes or practice work.', '') + '<p class="p-loading">Loading…</p></div>';
    const [lr, names] = await Promise.all([learners(db, owner), nameMap(db)]);
    if (my !== run) return;
    const rows = [];
    lr.acq.forEach(x => rows.push({ name:x.name || names[x.userId] || 'Someone', course:'Acquisitions', passed:x.done || 0, total:x.total || 15, at:x.lastActive, href:owner ? '#review/' + encodeURIComponent(x.userId) : '' }));
    lr.hub.forEach(x => { const c = COURSES.find(k => k.id === x.course); if (c) rows.push({ name:x.name || names[x.user_id] || (owner && x.user_id === T.user.id ? 'You' : 'Someone'), course:c.short, passed:x.passed || 0, total:c.total, at:x.updated_at, href:owner ? '#review/' + encodeURIComponent(x.user_id) : '' }); });
    rows.sort((a, b) => a.name.localeCompare(b.name) || a.course.localeCompare(b.course));
    const ago = d => { if (!d) return '–'; const s = (Date.now() - new Date(d).getTime()) / 1000; return s < 3600 ? 'this hour' : s < 86400 ? 'today' : s < 172800 ? 'yesterday' : Math.floor(s / 86400) + ' days ago'; };
    const body = lr.error ? '<p class="p-card p-empty">' + (/Not allowed/.test(lr.error.message || '') ? 'Learner progress needs your authenticator code. Sign in again with it to see this page.' : 'Couldn’t load learner progress. Check your connection and try again.') + '</p>'
      : rows.length ? '<div class="p-tablewrap"><table class="p-table"><thead><tr><th scope="col">Name</th><th scope="col">Course</th><th scope="col">Passed</th><th scope="col">Last active</th></tr></thead><tbody>' +
        rows.map(x => '<tr><td>' + (x.href ? '<a href="' + esc(x.href) + '">' + esc(x.name) + '</a>' : esc(x.name)) + '</td><td>' + esc(x.course) + '</td><td>' + x.passed + ' of ' + x.total + '</td><td>' + esc(ago(x.at)) + '</td></tr>').join('') + '</tbody></table></div>'
      : '<p class="p-card p-empty">No one has started a course yet.</p>';
    box().querySelector('.p-loading').outerHTML = body;
  }

  // ======================================================================
  // Phase 3: Team overview (#teamview). Amr, and managers who may see everyone's hours.
  // One row per person: on shift, hours, calls, end-of-day notes missing, deals, learning, last active.
  // portal_team_overview gives the numbers (never pay); course progress comes from the learner progress functions.
  // ======================================================================
  let tvDays = 7;
  async function teamview(my){
    const T = A(), db = T.db, owner = T.role === 'owner';
    const pick = '<div class="p-seg" role="group" aria-label="Period">' + [[1, 'Today'], [7, '7 days'], [30, '30 days']].map(([n, t]) =>
      '<button type="button" class="p-seg-b" data-tv="' + n + '" aria-pressed="' + (n === tvDays) + '">' + t + '</button>').join('') + '</div>';
    box().innerHTML = '<div class="p-wrap">' + hero('People', 'Team overview', 'Calls, hours, deals and learning for everyone, on one screen.', pick) + '<div id="tvBody"><p class="p-loading">Loading…</p></div></div>';
    box().querySelector('.p-seg').addEventListener('click', e => { const b = e.target.closest('[data-tv]'); if (!b || +b.dataset.tv === tvDays) return; tvDays = +b.dataset.tv; teamview(++run); });
    const [r, lr] = await Promise.all([safe(db.rpc('portal_team_overview', { p_days:tvDays })), learners(db, owner)]);
    if (my !== run) return;
    if (r.error || !Array.isArray(r.data)) {
      $('tvBody').innerHTML = '<p class="p-card p-empty">' + (/Not allowed/.test((r.error || {}).message || '') ? 'The team overview needs your authenticator code. Sign in again with it to see this page.' : 'Couldn’t load the team overview. Check your connection and try again.') + '</p>';
      return;
    }
    const people = r.data.filter(x => x.role !== 'owner' && x.user_id !== T.user.id);
    if (!people.length) { $('tvBody').innerHTML = '<p class="p-card p-empty">No one on the team yet. Invite people from Invite and access.</p>'; return; }
    const courses = {};
    lr.acq.forEach(x => (courses[x.userId] = courses[x.userId] || []).push('Acquisitions ' + (x.done || 0) + '/' + (x.total || 15)));
    lr.hub.forEach(x => { const c = COURSES.find(k => k.id === x.course); if (c) (courses[x.user_id] = courses[x.user_id] || []).push(c.short + ' ' + (x.passed || 0) + '/' + c.total); });
    const sum = k => people.reduce((a, x) => a + (Number(x[k]) || 0), 0), deals = people.some(x => x.deals_open != null);
    const ago = d => { if (!d) return 'Not yet'; const m = (Date.now() - new Date(d).getTime()) / 60000; return m < 60 ? 'Within the hour' : m < 1440 ? Math.floor(m / 60) + 'h ago' : m < 2880 ? 'Yesterday' : Math.floor(m / 1440) + ' days ago'; };
    const per = tvDays === 1 ? 'today' : 'in ' + tvDays + ' days';
    const tile = (v, label, href) => '<a class="p-tile" href="' + href + '"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></a>';
    $('tvBody').innerHTML = '<div class="p-today p-tv-stats">' + tile(people.filter(x => x.on_shift).length, 'on shift now', '#live') + tile(hm(sum('worked_seconds')), 'hours ' + per, '#team') +
        tile(sum('dials'), 'calls ' + per, '#teamview') + (deals ? tile(sum('deals_closed'), 'deals closed ' + per, '/app/deals/') : tile(sum('appointments') + sum('offers'), 'offers and appointments', '#teamview')) + '</div>' +
      '<div class="p-tablewrap"><table class="p-table p-tv"><thead><tr><th scope="col">Name</th><th scope="col">Hours</th><th scope="col">Calls</th><th scope="col">End-of-day</th>' + (deals ? '<th scope="col">Deals</th>' : '') + '<th scope="col">Learning</th><th scope="col">Last active</th></tr></thead><tbody>' +
      people.map(x => '<tr><td><b>' + esc(x.name || 'Someone') + '</b>' + (x.on_shift ? ' <span class="p-pill is-ok">On shift</span>' : '') + (x.role === 'manager' ? '<br><small>Manager</small>' : '') + '</td>' +
        '<td>' + hm(x.worked_seconds) + '<br><small>' + plural(x.days_worked, 'day') + '</small></td>' +
        '<td>' + x.dials + ' dials<br><small>' + plural(x.conversations, 'conversation') + ' · ' + plural(x.offers, 'offer') + ' · ' + plural(x.appointments, 'appointment') + '</small></td>' +
        '<td>' + (x.notes_missing ? '<span class="p-pill is-no">' + plural(x.notes_missing, 'note') + ' missing</span>' : x.days_worked ? '<span class="p-pill is-ok">All sent</span>' : '<small>No shifts</small>') + '</td>' +
        (deals ? '<td>' + x.deals_open + ' open<br><small>' + x.deals_contract + ' under contract · ' + x.deals_closed + ' closed' + (x.followups_late ? '</small><br><span class="p-pill is-no">' + plural(x.followups_late, 'follow-up') + ' late</span>' : '</small>') + '</td>' : '') +
        '<td>' + plural(x.lessons, 'lesson') + ' · ' + plural(x.drills, 'drill') + ' sent<br><small>' + esc((courses[x.user_id] || ['No course started']).join(' · ')) + '</small></td>' +
        '<td>' + esc(ago(x.last_active)) + '</td></tr>').join('') + '</tbody></table></div>' +
      (deals ? '' : '<p class="p-empty">Deal numbers show for people who may see the team’s deals (Deal tools and the authenticator code).</p>');
  }

  window.PortalHome = {
    open(page){ view = page; const my = ++run; ({ home, portal, admin, progress, teamview })[page](my).catch(() => { if (my === run) box().insertAdjacentHTML('beforeend', '<p class="p-card p-empty">Couldn’t load everything. Check your connection and try again.</p>'); }); },
    // every second from app.js: keep the Team home's clock line and button current
    tick(){
      if (view !== 'home' || !$('pvSub') || $('pView').hidden) return;
      $('pvSub').textContent = clockLine();
      const b = $('pvClockBox'), html = clockBtn(); if (b && b.dataset.was !== html) { b.dataset.was = html; b.innerHTML = html; }
    },
    close(){ view = ''; run++; }
  };
})();
