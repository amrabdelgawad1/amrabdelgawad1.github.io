// Learning Hub home (/app/learn/): every course on one page, in the same look as the course players.
// Each card opens its course for Amr and for people who have that course switched on in /app > Invite and access
// (plus Learning Hub). Everyone else sees the card locked. Amr also gets the Review center and access counts.
// New course? Add it to COURSES below, give it an access switch in app.js (SECTION_NAMES) and its own player.
// Later, a locked card can show a price and a Buy button: see lockedFoot().
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const MKT = window.COURSE || {}, PSY = window.PSY_COURSE || {};

  // Only the public facts live here (titles, blurbs, module counts). Lessons stay in the private storage bucket.
  const COURSES = [
    { id:'acq', key:'course', letter:'A', title:'Real Estate Acquisitions', href:'/course/', modules:15,
      sub:'From the first cold call to a signed contract: finding sellers, running the numbers, making offers and closing.',
      tags:['Calls and scripts', 'Deal math', 'Land and house calculators'] },
    { id:'mkt', key:MKT.access || 'mkt', team:MKT.team !== false, letter:'M', title:'Marketing', href:'/app/course/', modules:(MKT.plan || []).length || 16,
      sub:'From knowing your customer to running a full growth system: positioning, copy, brand, content, ads and analytics.',
      tags:['English and Arabic', 'Cost per deal calculator'] },
    { id:'psy', key:PSY.access || 'psy', team:PSY.team !== false, letter:'P', title:'Psychology and Therapy', href:'/app/psychology/', modules:PSY.modules || 27,
      sub:'From the foundations of psychology to therapy models, crisis skills, ethics and coaching practice.',
      tags:['English and Arabic', 'Thought record', 'Goal planner'] }
  ];

  let db = null, uid = null, owner = false, asLearner = false;
  const open = {}, prog = {}, people = {};

  // ---------- progress, read the same way each course saves it ----------
  // Marketing and Psychology save to learn_progress; Acquisitions keeps its own tables (course_state).
  function mktDone(d){
    const pass = MKT.pass || 80;
    return d && d.m ? Object.values(d.m).filter(m => ((m.quiz || {}).best || 0) >= pass).length : 0;
  }
  function psyDone(d){
    const kv = (d && d.kv) || {};
    const ids = new Set(Object.keys(kv).map(k => (k.match(/^(?:exam|best):(m\d+)$|^done:(m\d+):exam$/) || []).slice(1).find(Boolean)).filter(Boolean));
    return [...ids].filter(id => kv['done:' + id + ':exam'] === '1' || Math.max(+kv['exam:' + id] || 0, +kv['best:' + id] || 0) >= 16).length;   // 16 of 20 passes
  }
  // A module counts as passed when the module after it has opened (it opens only once the checkpoint is passed)
  function acqDone(s){
    const mods = (s && s.modules) || [], byNum = {};
    mods.forEach(m => byNum[m.number] = m);
    return mods.filter(m => byNum[m.number + 1] && byNum[m.number + 1].openForLearners).length;
  }
  const local = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } };

  async function loadProgress(){
    if (window.HUB_TEST) { Object.assign(prog, window.HUB_TEST.prog || {}); return; }
    const jobs = [];
    if (open.mkt || open.psy) jobs.push(db.from('learn_progress').select('course,data').eq('user_id', uid).in('course', [MKT.id || 'mkt2', PSY.id || 'psy']).then(({ data }) => {
      const row = id => ((data || []).find(r => r.course === id) || {}).data;
      // The device copy wins when it's newer (it saves first, the table a moment later)
      const pick = (a, b) => (b && (b.at || 0) > ((a && a.at) || 0)) ? b : a;
      if (open.mkt) prog.mkt = { done:mktDone(pick(row(MKT.id || 'mkt2'), local('cp1:' + uid + ':' + (MKT.id || 'mkt2')))), total:COURSES[1].modules };
      if (open.psy) prog.psy = { done:psyDone(pick(row(PSY.id || 'psy'), local('lh-psy-sync:' + uid))), total:COURSES[2].modules };
    }, () => {}));
    if (open.acq) jobs.push(db.rpc('course_state', { p_content:false }).then(({ data, error }) => {
      if (!error && data) prog.acq = { done:acqDone(data), total:data.totalModules || (data.modules || []).length };
    }, () => {}));
    await Promise.all(jobs);
  }

  // Amr only: how many people can open each course (role plus extras, from portal_people()), and how much is waiting in the Review center
  let waiting = null;
  async function loadOwner(){
    if (window.HUB_TEST) { Object.assign(people, window.HUB_TEST.people || {}); waiting = window.HUB_TEST.waiting; return; }
    const [m, u, w] = await Promise.all([
      db.rpc('portal_people').then(r => r.error ? db.from('members').select('access,active') : r, () => ({})),   // older database: the extras list
      db.from('hub_uploads').select('id', { count:'exact', head:true }).eq('status', 'waiting').then(r => r, () => ({})),
      db.rpc('course_admin_waiting').then(r => r, () => ({}))
    ]);
    // Same rules as the access checks above: Acquisitions needs only its own switch, the others need Learning Hub too
    (m.data || []).filter(x => x.active).forEach(x => { const a = x.keys || x.access || []; COURSES.forEach(c => { if (a.includes(c.key) && (c.id === 'acq' || a.includes('learn'))) people[c.id] = (people[c.id] || 0) + 1; }); });
    if (u.count != null || w.data) waiting = (u.count || 0) + ((w.data || []).length);
  }

  // ---------- drawing ----------
  const lockIc = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const arrowIc = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const canOpen = c => open[c.id] && !(owner && asLearner);

  function art(c, locked){
    return `<span class="lh-art${locked ? ' is-locked' : ''}" aria-hidden="true">
      <span class="lh-art-bar"></span><span class="lh-art-kick">Course</span>
      <span class="lh-art-letter">${c.letter}</span>
      ${locked ? `<span class="lh-art-lock">${lockIc}</span>` : ''}</span>`;
  }
  // When a price is added later, this is where the price and a Buy button go
  // Phase 1: "Ask for access" sends Amr a notification (request_course_access, once a day per course)
  const ASK = { acq:'course', mkt:'mkt', psy:'psy' };
  function lockedFoot(c){
    return `<p class="lh-lockmsg">${lockIc}<span>Locked.</span>${c && ASK[c.id] && !owner ? `<button type="button" class="btn lh-ask" data-ask="${ASK[c.id]}">Ask Amr for access</button>` : '<span>Ask Amr to open this course for you.</span>'}</p>`;
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-ask]'); if (!b || !db || b.disabled) return;
    e.preventDefault(); b.disabled = true; b.textContent = 'Sending…';
    const r = await db.rpc('request_course_access', { p_course:b.dataset.ask }).then(x => x, () => ({ error:{} }));
    b.textContent = r.error ? 'Couldn’t send. Try again' : r.data === 'already' ? 'Already asked today' : 'Sent to Amr';
    b.disabled = !r.error;
  });
  function card(c){
    const ok = canOpen(c), p = prog[c.id], mods = (p && p.total) || c.modules;
    const pct = p && p.total ? Math.round(p.done / p.total * 100) : 0;
    const meta = [mods ? `<span><b>${mods}</b> modules</span>` : '', ok && p ? `<span><b>${p.done}</b> passed</span>` : ''].join('');
    const inner = `${art(c, !ok)}
      <span class="lh-body">
        <span class="cp-kick">${ok ? (p && p.done ? 'In progress' : 'Ready to start') : 'Locked'}</span>
        <h2>${esc(c.title)}</h2>
        <span class="lh-sub">${esc(c.sub)}</span>
        <span class="lh-tags">${c.tags.map(t => `<span>${esc(t)}</span>`).join('')}</span>
        ${meta ? `<span class="lh-meta">${meta}</span>` : ''}
        ${ok && p ? `<span class="lh-prog" role="progressbar" aria-label="${esc(c.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="cp-bar"><i style="width:${pct}%"></i></span><b>${pct}%</b></span>` : ''}
        ${ok ? `<span class="btn lh-go">${p && p.done ? 'Continue' : 'Open course'} ${arrowIc}</span>` : lockedFoot(c)}
        ${owner && !asLearner ? `<span class="lh-own">${people[c.id] ? `<b>${people[c.id]}</b> ${people[c.id] === 1 ? 'person has' : 'people have'} access` : 'No one else has access yet'}</span>` : ''}
      </span>`;
    return ok ? `<a class="lh-course" href="${c.href}">${inner}</a>` : `<div class="lh-course is-locked" aria-disabled="true">${inner}</div>`;
  }

  function draw(){
    const mine = COURSES.filter(canOpen).length;
    $('lhMain').innerHTML = `<div class="lh-wrap">
      <section class="lh-hero">
        <span class="lh-hero-bar"></span><span class="lh-hero-kick">Learning Hub</span>
        <h1>Your courses</h1>
        <p>${COURSES.length} courses · ${owner && !asLearner ? 'you can open all of them' : mine ? (mine === COURSES.length ? 'all open for you' : mine + ' open for you') : 'none open for you yet'}</p>
      </section>
      <section class="lh-grid" aria-label="Courses">${COURSES.map(card).join('')}</section>
      ${owner && !asLearner ? `
      <section aria-label="For Amr"><h2 class="lh-h2">For you</h2>
        <div class="lh-tools">
          <a class="lh-tool" href="/app/#review"><span class="lh-ic"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span>
            <span><b>Review center</b><small>Recordings, files and written drills from every course</small></span>${waiting ? `<span class="lh-count">${waiting} waiting</span>` : ''}</a>
          <a class="lh-tool" href="/app/#people"><span class="lh-ic"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5M17 11h6M20 8v6"/></svg></span>
            <span><b>Invite and access</b><small>Choose who opens which course</small></span></a>
        </div></section>` : ''}
    </div>`;
  }

  function msg(text, link){
    $('lhMain').innerHTML = `<div class="cp-msg cp-card"><p>${text}</p>${link ? `<p><a class="btn" href="${link[0]}">${link[1]}</a></p>` : ''}</div>`;
  }

  async function start(){
    if (window.HUB_TEST) {
      owner = !!window.HUB_TEST.owner; COURSES.forEach(c => open[c.id] = owner || (window.HUB_TEST.open || []).includes(c.id));
    } else {
      const cfg = window.TRACKER_CONFIG || {};
      if (!window.supabase || !/^https:\/\//.test(cfg.supabaseUrl || '')) return msg('Couldn’t connect. Check your internet and reload.');
      db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
      const { data:{ session } } = await db.auth.getSession();
      if (!session) return msg('Sign in to the app first, then come back here.', ['/app/', 'Go to sign in']);
      uid = session.user.id;
      let res;
      // Marketing and Psychology need "Learning Hub" plus their own switch (learn_can_open).
      // Acquisitions has always opened on its own switch alone (course_has_access), so it keeps that rule.
      const check = c => c.id === 'acq' ? db.rpc('course_has_access') : db.rpc('learn_can_open', { p_course:c.key });
      try { res = await Promise.all([db.rpc('is_tracker_admin'), db.rpc('learn_can_open', { p_course:'learn' }), ...COURSES.map(check)]); }
      catch(e) { return msg('Couldn’t load the Learning Hub. Check your internet and reload.'); }
      owner = res[0].data === true;
      // A course with team:false in its course.js is Amr-only for now (its player refuses everyone else)
      COURSES.forEach((c, i) => open[c.id] = owner || (c.team !== false && res[i + 2].data === true));
      if (!owner && res[1].data !== true && !COURSES.some(c => open[c.id])) return msg('The Learning Hub isn’t switched on for you yet. Ask Amr to open it.', ['/app/', 'Back to app']);
    }
    if (owner) { $('lhView').hidden = false; $('lhAsLearner').addEventListener('change', e => { asLearner = e.target.checked; draw(); }); }
    // The shared top bar (portal-shell.js): Apps menu and the person's name. "Back to app" moves into the Apps menu.
    if (window.PortalShell) window.PortalShell.start({ db, header:document.querySelector('.cp-top'), page:'learn', brand:document.querySelector('.cp-brand'),
      hide:[document.querySelector('.lh-back')],
      test:window.HUB_TEST ? { role:owner ? 'owner' : 'agent', keys:[].concat(open.acq ? ['course'] : [], open.mkt ? ['learn', 'mkt'] : [], open.psy ? ['learn', 'psy'] : []) } : null });
    draw();                                         // show the cards at once, then fill in progress
    await Promise.all([loadProgress(), owner ? loadOwner() : null]).catch(() => {});
    draw();
  }
  start();
})();
