// Learning Hub home (/app/learn/): every course on one page, in the same look as the course players.
// Each card opens its course for Amr and for people who have that course switched on in /app > Invite and access
// (plus Learning Hub). Everyone else sees the card locked, with "Request access" (round 29, E2).
// Round 29 also adds "Continue where you left off" (I16) and the Practice call scoring link (E8). Amr also gets the Review center and access counts.
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
    { id:'psy', key:PSY.access || 'psy', team:PSY.team !== false, letter:'P', title:'Psychology and Therapy', href:'/app/psychology/', modules:PSY.modules || 30,
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

  // Course covers (Nov 2026): each course has its own look and emblem instead of a letter.
  // Acquisitions = a house on its lot, Psychology = a therapist and client in session, Marketing = a megaphone.
  // Only the title and module count come from the course; nothing here changes course content.
  const EMBLEM = {
    acq:'<svg class="lh-cv-em" viewBox="0 0 200 160" aria-hidden="true"><path d="M6 142H196" stroke="#5E7A6B" stroke-width="2" stroke-dasharray="6 5"/><polygon points="46,72 100,26 154,72" fill="rgba(226,96,42,.18)" stroke="#E2602A" stroke-width="3" stroke-linejoin="round"/><rect x="60" y="72" width="80" height="70" fill="rgba(226,96,42,.10)" stroke="#E2602A" stroke-width="3"/><rect x="91" y="104" width="18" height="38" fill="#E2602A"/><rect x="68" y="84" width="16" height="14" fill="none" stroke="#E2602A" stroke-width="2.5"/><rect x="116" y="84" width="16" height="14" fill="none" stroke="#E2602A" stroke-width="2.5"/><path d="M174 142V96" stroke="#F3F5F1" stroke-width="3"/><rect x="158" y="80" width="36" height="20" rx="2" fill="#E2602A"/></svg>',
    psy:'<svg class="lh-cv-em" viewBox="0 0 240 160" aria-hidden="true" fill="none" stroke="#F4A340" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 146H230" stroke="#2A3D5C"/><path d="M38 68V146M38 112H80M78 112V146"/><circle cx="58" cy="56" r="11"/><path d="M56 68L60 108H88L90 146M58 80L76 92"/><rect x="72" y="86" width="14" height="10" fill="#F4A340"/><path d="M204 70V146M160 114H204M162 114V146"/><circle cx="182" cy="58" r="11"/><path d="M184 70L180 110H154L152 146M182 84L166 98"/><path d="M106 22h40a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8h-22l-8 8v-8h-10a8 8 0 0 1-8-8v-8a8 8 0 0 1 8-8z" fill="#0F1A2B"/></svg>',
    mkt:'<svg class="lh-cv-em" viewBox="0 0 200 160" aria-hidden="true"><rect x="36" y="62" width="22" height="38" fill="#111"/><polygon points="58,62 138,28 138,134 58,100" fill="#E4007C" stroke="#111" stroke-width="4" stroke-linejoin="round"/><path d="M78 104L86 134H100L94 108" fill="#FFD400" stroke="#111" stroke-width="4" stroke-linejoin="round"/><path d="M154 60Q168 81 154 102M168 46Q190 81 168 116" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/></svg>'
  };
  const CODE = { acq:'ACQ', psy:'PSY · EN / ع', mkt:'MKT' };
  function art(c, locked, mods){
    return `<span class="lh-art lh-cv lh-cv-${c.id}${locked ? ' is-locked' : ''}" aria-hidden="true">
      <span class="lh-cv-bar"></span>${c.id === 'mkt' ? '<span class="lh-cv-dots"></span>' : '<span class="lh-cv-disc"></span>'}${EMBLEM[c.id] || ''}
      <span class="lh-cv-tag"><b>Course</b><i>${CODE[c.id] || ''}</i></span>
      <span class="lh-cv-title">${esc(c.title)}</span>
      ${c.id === 'psy' ? '<span class="lh-cv-ar" dir="rtl" lang="ar">علم النفس</span>' : ''}
      ${mods ? `<span class="lh-cv-stat"><b>${mods}</b><i>Modules</i></span>` : ''}
      ${locked ? `<span class="lh-art-lock">${lockIc}</span>` : ''}</span>`;
  }
  // When a price is added later, this is where the price and a Buy button go
  // Round 29 (E2): "Request access" sends Amr the same bell alert as before (request_course_access, once a day per course;
  // it also shows on his command center under Waiting for you). The card then shows when this person last asked
  // (my_course_requests). Nothing here changes who can open what: Amr still switches courses on in Invite and access.
  const LABEL = { course:'Real Estate Acquisitions', mkt:'Marketing', psy:'Psychology and Therapy' };
  const labelOf = key => LABEL[key] || key.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase());
  const asked = {};   // label -> last time this person asked
  const fmtWhen = at => { if (window.PortalUI && window.PortalUI.when) return window.PortalUI.when(at, { zone:false });
    try { return new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true }); } catch (e) { return ''; } };
  function lockedFoot(c){
    const at = c && asked[labelOf(c.key)], recent = at && Date.now() - new Date(at).getTime() < 864e5;
    return `<p class="lh-lockmsg">${lockIc}<span>Locked.</span>${c && c.key && !owner
      ? `<button type="button" class="btn lh-ask" data-ask="${esc(c.key)}"${recent ? ' disabled' : ''}>${recent ? 'Requested' : at ? 'Ask again' : 'Request access'}</button>`
      : '<span>Ask Amr to open this course for you.</span>'}</p>${at ? `<span class="lh-asked">You asked Amr on ${esc(fmtWhen(at))}. He opens courses in Invite and access.</span>` : ''}`;
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-ask]'); if (!b || !db || b.disabled) return;
    e.preventDefault(); b.disabled = true; b.textContent = 'Sending…';
    const r = await db.rpc('request_course_access', { p_course:b.dataset.ask }).then(x => x, () => ({ error:{} }));
    if (r.error) { b.textContent = 'Couldn’t send. Try again'; b.disabled = false; return; }
    const k = labelOf(b.dataset.ask);
    if (!(asked[k] && r.data === 'already')) asked[k] = new Date().toISOString();
    draw();
  });
  function loadAsked(){
    if (!db || owner || window.HUB_TEST) return Promise.resolve();
    return db.rpc('my_course_requests').then(r => { (r.data || []).forEach(x => asked[x.label] = x.asked_at); }, () => {});
  }

  // Round 29 (I16): "Continue where you left off", one row per course in progress (my_resume). Each row opens the exact
  // lesson; the course's own video player then picks up at the saved time, shown here as "Video at 4:12".
  let resume = [];
  function loadResume(){
    if (!db || window.HUB_TEST) { resume = (window.HUB_TEST && window.HUB_TEST.resume) || []; return Promise.resolve(); }
    return db.rpc('my_resume').then(r => { resume = Array.isArray(r.data) ? r.data : []; }, () => {});
  }
  const clock = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function resumeHtml(){
    const list = resume.map(r => [r, COURSES.find(c => c.id === r.course)]).filter(([r, c]) => c && canOpen(c) && /^\/[^\/\\]/.test(r.href || ''));
    if (!list.length) return '';
    return `<section aria-labelledby="lhResH"><h2 class="lh-h2" id="lhResH">Continue where you left off</h2><div class="lh-resume">${list.map(([r, c]) =>
      `<a class="lh-res" href="${esc(r.href)}"><span class="lh-res-l lh-res-${c.id}" aria-hidden="true">${c.letter}</span>
        <span class="lh-res-t"><small>${esc(c.title)}${r.sub ? ' · ' + esc(r.sub) : ''}${r.at ? ' · ' + esc(fmtWhen(r.at)) : ''}</small><b>${esc(r.title || 'Your last lesson')}</b></span>
        ${r.pos ? `<span class="lh-res-v">Video at ${clock(r.pos)}</span>` : ''}${arrowIc}</a>`).join('')}</div></section>`;
  }
  function card(c){
    const ok = canOpen(c), p = prog[c.id], mods = (p && p.total) || c.modules;
    const pct = p && p.total ? Math.round(p.done / p.total * 100) : 0;
    const meta = [mods ? `<span><b>${mods}</b> modules</span>` : '', ok && p ? `<span><b>${p.done}</b> passed</span>` : ''].join('');
    const inner = `${art(c, !ok, mods)}
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
    return ok ? `<a class="lh-course" href="/app/#coursehome/${c.id}">${inner}</a>` : `<div class="lh-course is-locked" aria-disabled="true">${inner}</div>`;
  }

  let review = null;
  function loadReview(){
    if (!db || window.HUB_TEST) return;
    // Acquisitions cards come from portal_review_today; Marketing and Psychology cards are rows in review_cards (due_on is the learner's own day).
    // The Daily review page shows at most 20 of those, so the same cap applies here.
    const d = new Date(), p = n => String(n).padStart(2, '0'), today = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    Promise.all([
      db.rpc('portal_review_today').then(r => r, () => ({})),
      db.from('review_cards').select('card', { count:'exact', head:true }).eq('user_id', uid).or('module_id.like.mkt:%,module_id.like.psy:%').lte('due_on', today).then(r => r, () => ({}))
    ]).then(([a, b]) => {
      if (!a || a.error || !a.data) return;
      review = (a.data.cards || []).length + Math.min(20, (b && !b.error && b.count) || 0); draw();
    });
  }
  function draw(){
    const mine = COURSES.filter(canOpen).length;
    $('lhMain').innerHTML = `<div class="lh-wrap">
      <section class="lh-hero">
        <span class="lh-hero-bar"></span><span class="lh-hero-kick">Learning Hub</span>
        <h1>Your courses</h1>
        <p>${COURSES.length} courses · ${owner && !asLearner ? 'you can open all of them' : mine ? (mine === COURSES.length ? 'all open for you' : mine + ' open for you') : 'none open for you yet'}</p>
      </section>
      ${resumeHtml()}
      <section class="lh-grid" aria-label="Courses">${COURSES.map(card).join('')}</section>
      ${mine ? `<section aria-label="Daily review"><div class="lh-tools">
          <a class="lh-tool" href="/app/#daily"><span class="lh-ic"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/></svg></span>
            <span><b>Daily review</b><small>${review == null ? 'Questions you missed come back until they stick' : review ? review + ' card' + (review === 1 ? '' : 's') + ' today · about ' + Math.max(1, Math.round(review / 2)) + ' min' : 'Nothing due today'}</small></span>${review ? `<span class="lh-count">${review} today</span>` : ''}</a>
          ${canOpen(COURSES[0]) ? `<a class="lh-tool" href="/app/#scoring"><span class="lh-ic"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span>
            <span><b>Practice call scoring</b><small>Upload a practice call, score yourself on the 50-point scorecard, then see Amr’s score and notes</small></span></a>` : ''}
        </div></section>` : ''}
      ${owner && !asLearner ? `
      <section aria-label="For Amr"><h2 class="lh-h2">For you</h2>
        <div class="lh-tools">
          <a class="lh-tool" href="/app/#review"><span class="lh-ic"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span>
            <span><b>Review center</b><small>Recordings, files and written drills from every course</small></span>${waiting ? `<span class="lh-count">${waiting} waiting</span>` : ''}</a>
          <a class="lh-tool" href="/app/#builder"><span class="lh-ic"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg></span>
            <span><b>Course builder</b><small>Edit any course without code, publish when ready</small></span></a>
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
      // Round 29 (E2): with nothing open yet, people still see every course, locked, each with its Request access button
    }
    if (owner) { $('lhView').hidden = false; $('lhAsLearner').addEventListener('change', e => { asLearner = e.target.checked; draw(); }); }
    // The shared top bar (portal-shell.js): Apps menu and the person's name. "Back to app" moves into the Apps menu.
    if (window.PortalShell) window.PortalShell.start({ db, header:document.querySelector('.cp-top'), page:'learn', brand:document.querySelector('.cp-brand'),
      hide:[document.querySelector('.lh-back')],
      test:window.HUB_TEST ? { role:owner ? 'owner' : 'agent', keys:[].concat(open.acq ? ['course'] : [], open.mkt ? ['learn', 'mkt'] : [], open.psy ? ['learn', 'psy'] : []) } : null });
    draw();                                         // show the cards at once, then fill in progress
    loadReview();
    await Promise.all([loadProgress(), owner ? loadOwner() : null, loadResume(), loadAsked()]).catch(() => {});
    draw();
  }
  start();
})();
