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
      '<section aria-labelledby="pvCont" id="pvContWrap" hidden><h2 class="p-h2" id="pvCont">Continue learning</h2><div id="pvContBox"></div></section>' +
      '<section aria-labelledby="pvAreas"><h2 class="p-h2" id="pvAreas">Your areas</h2><div class="p-grid p-areas">' + areas.map(area).join('') + '</div></section>' +
      '<section aria-labelledby="pvBoard" id="pvBoardWrap" hidden><h2 class="p-h2" id="pvBoard">This week on the team <small>Monday to Sunday</small></h2><div id="pvBoardBox"></div></section>' +
      (locked.length ? '<section aria-labelledby="pvLocked"><h2 class="p-h2 p-h2-sm" id="pvLocked">Not open for you yet</h2><div class="p-lockrow">' +
        locked.map(c => '<p class="p-locked">' + IC.lock + '<span><b>' + esc(c.name.replace('Real Estate ', '')) + ' course</b> · Ask Amr to open it</span></p>').join('') + '</div></section>' : '') +
      '</div>';
    $('pvClockBox').addEventListener('click', e => { const b = e.target.closest('[data-clock]'); if (b) T.clock(b.dataset.clock); });
    board(T.db, my);
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
    const [live, reqs, revs, lr, mem, vis] = await Promise.all([liveCount(db), pendingRequests(db), reviewsWaiting(db), learners(db, true),
      safe(db.from('members').select('active')), safe(db.rpc('visit_stats', { p_hours:168 }))]);
    if (my !== run) return;
    const r = reqs || [], team = (mem.data || []).filter(x => x.active).length, dc = dealCounts();
    const learning = new Set(lr.hub.map(x => x.user_id).concat(lr.acq.filter(x => x.done > 0 || x.module).map(x => x.userId))).size;
    const need = revs.length + r.length;
    const v = vis.data && vis.data.visitors != null ? Number(vis.data.visitors).toLocaleString('en-US') : null;
    box().innerHTML = '<div class="p-wrap">' +
      hero('Admin', 'Overview', need ? plural(need, 'thing') + ' need you today' : 'Nothing needs you right now',
        '<div class="p-stats">' + stat(revs.length, 'to review', '#review') + stat(r.length, r.length === 1 ? 'shift request' : 'shift requests', '#requests') + stat(live == null ? '–' : live, 'clocked in now', '#live') + '</div>') +
      '<div class="p-grid p-boxes">' +
        box5('People', plural(team, 'person', 'people') + ' on the team', [row('Clocked in now', muted(live == null ? '–' : plural(live, 'person', 'people')), '#live'),
          row('Missed-shift requests', r.length ? pillR(r.length + ' waiting') : muted('None'), '#requests'), row('Invite and access', muted('Manage'), '#people')]) +
        box5('Learning', '3 courses', [row('Review center', revs.length ? pillR(revs.length + ' waiting') : muted('None'), '#review'),
          row('Learner progress', muted(learning + ' learning'), '#progress'), row('Who has which course', muted('Manage'), '/app/learn/')]) +
        box5('Deals', 'All reps', (dc ? [row('Follow-ups due', dc.due ? pillR(dc.due + ' due') : muted('None'), '/app/deals/#followups'), row('Open deals', muted(String(dc.open)), '/app/deals/'),
          row('Under contract', muted(String(dc.contract)), '/app/deals/')] : [row(UNLOCK, muted('Unlock'), '/app/deals/')])
          .concat([row('Land calculator', muted('Open'), '/land-calculator/'), row('House calculator', muted('Open'), '/house-calculator/')])) +
        box5('Money', 'Only you', [row('Cash this month', muted('Open'), '#overview'), row('Course payments', muted('Not set up yet'))]) +
        box5('Site', 'Public pages', [row('Visits this week', muted(v == null ? 'Open' : v), '#visits'), row('Team emails', muted('Open'), '#emails'), row('Logs', muted('Open'), '#logs'),
          row('Zoho Campaigns', muted('Open'), 'https://campaigns.zoho.com/', true)]) +
      '</div></div>';
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

  window.PortalHome = {
    open(page){ view = page; const my = ++run; ({ home, portal, admin, progress })[page](my).catch(() => { if (my === run) box().insertAdjacentHTML('beforeend', '<p class="p-card p-empty">Couldn’t load everything. Check your connection and try again.</p>'); }); },
    // every second from app.js: keep the Team home's clock line and button current
    tick(){
      if (view !== 'home' || !$('pvSub') || $('pView').hidden) return;
      $('pvSub').textContent = clockLine();
      const b = $('pvClockBox'), html = clockBtn(); if (b && b.dataset.was !== html) { b.dataset.was = html; b.innerHTML = html; }
    },
    close(){ view = ''; run++; }
  };
})();
