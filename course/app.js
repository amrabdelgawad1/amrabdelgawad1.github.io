// Acquisitions Playbook course app (/course).
// One page, hash routes:
//   #/                      course home
//   #/m/<module>            module page
//   #/m/<module>/l/<item>   lesson
//   #/m/<module>/q/<item>   quiz (resumes an unfinished attempt; /new starts over)
//   #/m/<module>/r/<id>     quiz result
//   #/m/<module>/c/<item>   checkpoint (gate and start)
//   #/m/<module>/a/<item>   written drill
//   #/locked/<number>       a locked module
//   #/install               add to home screen
//   #/admin...              Amr only (admin.js)
// All content and progress come from Supabase functions (supabase/migrations). Answers are graded there;
// this page never sees a correct option.
(function(){
  'use strict';
  const cfg = window.TRACKER_CONFIG || {};
  const MD = window.CourseMarkdown, esc = MD.esc;
  const $ = id => document.getElementById(id);
  const appEl = $('app');

  // ---------- icons ----------
  const svg = (d, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  const IC = {
    back: svg('<path d="M15 18l-6-6 6-6"/>'),
    close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    next: svg('<path d="M9 6l6 6-6 6"/>', ' stroke-width="2.2"'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'),
    quiz: svg('<path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/>'),
    chev: svg('<path d="M6 9l6 6 6-6"/>'),
    image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>'),
    file: svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>'),
    check: svg('<path d="M5 12l5 5 9-10"/>', ' stroke-width="3"'),
    dot: svg('<circle cx="12" cy="12" r="3" fill="currentColor"/>'),
    home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.2.1 3.8 1.6 4.5 4.3"/>'),
    install: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    app: svg('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6"/>'),
    out: svg('<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11"/>'),
    share: svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/>'),
    zoom: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>')
  };

  // ---------- small helpers ----------
  const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
  const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
  let toastTimer;
  function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); }
  const announce = msg => { $('announce').textContent = ''; setTimeout(() => $('announce').textContent = msg, 30); };
  function when(ts){
    if (!ts) return '';
    const d = new Date(ts), s = (Date.now() - d) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return plural(Math.floor(s / 60), 'minute') + ' ago';
    if (s < 86400) return plural(Math.floor(s / 3600), 'hour') + ' ago';
    if (s < 86400 * 7) return plural(Math.floor(s / 86400), 'day') + ' ago';
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  const dateTime = ts => ts ? new Date(ts).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
  function errText(e){
    const m = (e && (e.message || e.msg || e.error_description)) || '';
    if (/no access/.test(m)) return 'Your account doesn’t have the course.';
    if (/module locked/.test(m)) return 'This module is still locked.';
    if (/checkpoint locked/.test(m)) return 'The checkpoint is still locked.';
    if (/already approved/.test(m)) return 'This was already approved, so it can’t change.';
    if (/answer every task/.test(m)) return 'Answer every task before you submit.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'You seem to be offline. Check your connection and try again.';
    return 'Something went wrong. Try again.';
  }

  // ---------- Supabase ----------
  if (!/^https?:\/\//.test(cfg.supabaseUrl || '') || !window.supabase) {
    appEl.innerHTML = '<div class="center-msg"><p>The course couldn’t connect. Check your internet and refresh.</p></div>';
    return;
  }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  async function rpc(fn, args){
    const { data, error } = await db.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }

  // ---------- state ----------
  let S = null;            // course_state(): { title, totalModules, isAdmin, me, modules, done, quizzes, submissions }
  let user = null;
  const signed = new Map(); // storage path -> { url, exp }

  async function loadState(){ S = await rpc('course_state', { p_content:true }); }
  // After an action: progress only, and the full content again if a module just opened
  async function refresh(){
    const fresh = await rpc('course_state', { p_content:false });
    const reopen = fresh.modules.some(m => { const old = S.modules.find(x => x.id === m.id); return !old || old.open !== m.open; });
    if (reopen) { await loadState(); return; }
    fresh.modules.forEach(m => { const old = S.modules.find(x => x.id === m.id); Object.assign(old, { open:m.open, openForLearners:m.openForLearners, checkpointOpen:m.checkpointOpen }); });
    ['done', 'quizzes', 'submissions', 'isAdmin'].forEach(k => S[k] = fresh[k]);
  }

  const MOD = id => S.modules.find(m => m.id === id);
  // Items in order, groups flattened: { it, group }
  function entries(mod){
    const out = [];
    (mod.items || []).forEach(it => it.type === 'group' ? (it.items || []).forEach(c => out.push({ it:c, group:it })) : out.push({ it, group:null }));
    return out;
  }
  const lessonsOf = mod => entries(mod).filter(e => e.it.type === 'lesson');
  const find = (mod, id) => entries(mod).find(e => e.it.id === id);
  const key = (mod, it) => mod.id + '/' + it.id;
  const qState = (mod, it) => S.quizzes[key(mod, it)] || {};
  const sub = (mod, it) => S.submissions[key(mod, it)] || null;
  const isDone = (mod, it) => !!S.done[key(mod, it)];
  const quizPassed = (mod, it) => { const q = qState(mod, it); return !!(q.passed || (q.latest && q.latest.passed)); }; // passed once = stays passed
  const qCount = it => it.quiz ? (it.quiz.questions ? it.quiz.questions.length : it.quiz.count || 0) : 0;
  const passMark = it => (it.quiz && it.quiz.passMark) || 80;
  const needCount = (mark, total) => Math.ceil(mark * total / 100); // scores round down, so 85% of 25 needs 22
  const passText = it => 'Pass: ' + needCount(passMark(it), qCount(it)) + ' of ' + qCount(it);

  // Labels: "1.1", "1.2 Session 2", and the lesson heading without its number
  const idLabel = (e) => e.it.type === 'lesson' ? (e.group ? e.it.title.split(':')[0].trim() : e.it.id) : e.it.title;
  const shortLabel = (e) => e.it.shortTitle || idLabel(e);
  const inGroupLabel = e => e.it.title.replace(/^[\d.]+\s+/, '').split(':')[0].trim();
  const heading = it => it.title.includes(':') ? it.title.split(':').slice(1).join(':').trim() : it.title.replace(/^[\d.]+\s+/, '');
  const quizLabel = e => 'Quiz ' + idLabel(e);

  // The 24 things that count toward a module (each lesson, each lesson quiz, the drill, the checkpoint)
  function units(mod){
    const u = [];
    entries(mod).forEach(e => {
      const it = e.it;
      if (it.type === 'lesson') {
        u.push({ kind:'lesson', e, done:isDone(mod, it), label:shortLabel(e), href:'#/m/' + mod.id + '/l/' + it.id });
        if (it.quiz) u.push({ kind:'quiz', e, done:quizPassed(mod, it), label:quizLabel(e), href:quizHref(mod, it) });
      } else if (it.type === 'assignment') {
        const s = sub(mod, it);
        u.push({ kind:'assignment', e, done:!!s && (s.status === 'submitted' || s.status === 'approved'), label:'Written drill', href:'#/m/' + mod.id + '/a/' + it.id });
      } else if (it.type === 'checkpoint') {
        u.push({ kind:'checkpoint', e, done:quizPassed(mod, it), locked:!mod.checkpointOpen, label:'Checkpoint', href:'#/m/' + mod.id + '/c/' + it.id });
      }
    });
    return u;
  }
  function quizHref(mod, it){
    const q = qState(mod, it);
    return q.latest && !q.open ? '#/m/' + mod.id + '/r/' + q.latest.id : '#/m/' + mod.id + '/q/' + it.id;
  }
  const progressOf = mod => { const u = units(mod); return { done:u.filter(x => x.done).length, total:u.length }; };
  const nextUnit = mod => units(mod).find(x => !x.done && !x.locked) || null;
  const moduleDone = mod => { const cp = entries(mod).find(e => e.it.type === 'checkpoint'); return !!cp && quizPassed(mod, cp.it); };
  // Current module: the first open module whose checkpoint isn't passed, else the last open one
  function currentModule(){
    const open = S.modules.filter(m => m.open);
    return open.find(m => !moduleDone(m)) || open[open.length - 1] || null;
  }

  // ---------- images (private bucket, signed links) ----------
  const contentPath = (mod, file) => 'content/' + mod.id + '/' + file;
  async function signAll(paths){
    const now = Date.now(), need = [...new Set(paths)].filter(p => p && !(signed.get(p) && signed.get(p).exp > now + 60e3));
    if (need.length) {
      const { data } = await db.storage.from('course').createSignedUrls(need, 6 * 3600);
      (data || []).forEach(d => { if (d.signedUrl) signed.set(d.path, { url:d.signedUrl, exp:now + 6 * 3600e3 }); });
    }
  }
  async function hydrateImages(root){
    const imgs = [...(root || appEl).querySelectorAll('img[data-src]')];
    if (!imgs.length) return;
    try { await signAll(imgs.map(i => i.dataset.src)); } catch(e){}
    imgs.forEach(i => { const s = signed.get(i.dataset.src); if (s) { i.src = s.url; i.removeAttribute('data-src'); } });
  }
  window.CourseSigned = async path => { await signAll([path]); const s = signed.get(path); return s && s.url; };
  const img = (path, cls, alt) => '<img class="' + cls + '" data-src="' + esc(path) + '" alt="' + esc(alt || '') + '" loading="lazy" decoding="async">';
  // Thumbnails are drawn, not loaded: a dark card with an orange rule, a kicker and the title (the Learning Hub look).
  const tcard = (cls, kicker, title, alt) => '<span class="tcard ' + cls + '"' + (alt ? ' role="img" aria-label="' + esc(alt) + '"' : ' aria-hidden="true"') + '>' +
    '<i></i><span class="tk">' + esc(kicker) + '</span><span class="tt">' + esc(title) + '</span></span>';
  const kickerOf = (mod, it) => !it ? 'Module ' + mod.number : it.type === 'checkpoint' ? 'Module ' + mod.number + ' checkpoint' :
    it.type === 'assignment' ? 'Module ' + mod.number + ' drill' : it.type === 'group' ? 'Module ' + mod.number + ' · ' + it.id : 'Lesson ' + it.id.replace(/\.s(\d+)$/, ' · Session $1');
  const thumbOf = (mod, it, cls, alt) => tcard(cls, kickerOf(mod, it), it ? (it.type === 'lesson' ? heading(it) : it.title.replace(/^[\d.]+\s+/, '')) : mod.title, alt);

  // ---------- rendering ----------
  let acts = {}, lastRoute = '', onInput = null, leaving = null; // leaving: stops a recording when the page changes
  // The page's own title row, under the course top bar: a back link, where you are, and an aside (a quiz's pass mark)
  function header(o){
    // o: { back, backLabel, close, ctx, title, aside, home }
    if (o.home) return '';
    return '<div class="crumb"><div class="col">' +
      '<a class="crumb-back" href="' + esc(o.back || '#/') + '" aria-label="' + esc(o.backLabel || 'Back') + '">' + (o.close ? IC.close : IC.back) + '</a>' +
      '<span class="ttl">' + (o.ctx ? '<span class="ctx">' + esc(o.ctx) + '</span>' : '') + '<span class="t">' + esc(o.title) + '</span></span>' +
      (o.aside ? '<span class="aside">' + esc(o.aside) + '</span>' : '') +
      '</div></div>';
  }
  const bar = (n, cls) => '<div class="' + (cls || 'progress') + '"><i data-w="' + Math.max(0, Math.min(100, n)) + '"></i></div>';
  const chip = (text, tone) => '<span class="chip' + (tone ? ' ' + tone : '') + '">' + esc(text) + '</span>';

  // o.at: the route a slow view was started for. If the person has moved on since, don't draw over the new page.
  function mount(html, o){
    o = o || {};
    if (o.at && o.at !== location.hash) return false;
    acts = o.acts || {};
    onInput = null;
    if (leaving) { try { leaving(); } catch(e){} leaving = null; }
    document.body.classList.toggle('white', !!o.white);
    // Signed in with the course loaded: the Learning Hub frame (top bar, course content sidebar, page). Sign-in pages stand alone.
    const framed = !!S && !o.bare;
    document.body.classList.toggle('framed', framed);
    if (framed) { frame(); if (document.body.classList.contains('side-open')) setSide(false); $('cpMain').innerHTML = html; drawSide(); drawProgress(); }
    else appEl.innerHTML = html;
    appEl.querySelectorAll('[data-w]').forEach(el => el.style.width = el.dataset.w + '%');
    document.title = (o.title ? o.title + ' · ' : '') + 'Acquisitions Playbook';
    const here = location.hash;
    if (here !== lastRoute && !o.keepFocus) {
      window.scrollTo(0, 0);
      const h = appEl.querySelector('h1') || appEl.querySelector('main');
      if (h && lastRoute) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll:true }); }
    }
    lastRoute = here;
    hydrateImages();
  }
  // ---------- the Learning Hub frame ----------
  // Stages group the modules in the sidebar, as in the Marketing course
  const STAGES = [[1, 'Foundations'], [5, 'The call'], [8, 'Winning the deal'], [10, 'Deal types to closing'], [14, 'Career and certification']];
  const TOOLS = [['/land-calculator/', 'Land calculator'], ['/house-calculator/', 'House calculator']];
  const ICK = {
    lesson: svg('<path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>'),
    quiz: svg('<path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/>'),
    assignment: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'),
    checkpoint: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
    tool: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    done: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>'),
    todo: svg('<circle cx="12" cy="12" r="9"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.4-6 8-6s6.5 2 8 6"/>')
  };
  let sideOpen = {};
  try { sideOpen = JSON.parse(localStorage.getItem('ap-side') || '{}') || {}; } catch(e){}
  function frame(){
    if ($('cpMain')) return;
    appEl.innerHTML =
      '<header class="cp-top">' +
        '<button class="cp-menu" type="button" id="cpMenu" aria-label="Course content" aria-expanded="false" aria-controls="cpSide">' + IC.menu + '</button>' +
        '<a class="cp-brand" href="#/"><span class="cp-logo" aria-hidden="true">A</span><span class="cp-name">Acquisitions</span></a>' +
        '<div class="cp-find" id="cpFind" role="search">' + ICK.search + '<input type="search" id="cpQ" autocomplete="off" spellcheck="false" placeholder="Search the course" aria-label="Search the course" aria-describedby="cpCount"><div class="cp-results" id="cpRes" hidden></div><span class="vh" id="cpCount" aria-live="polite"></span></div>' +
        '<button class="cp-findbtn" type="button" id="cpFindBtn" aria-label="Search the course" aria-expanded="false" aria-controls="cpFind">' + ICK.search + '</button>' +
        '<div class="cp-prog" id="cpProg" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="cp-bar"><i></i></span><b>0%</b></div>' +
        '<button class="cp-acct" type="button" data-act="menu" aria-label="Your account" aria-haspopup="dialog">' + ICK.user + '</button>' +
        '<a class="cp-back" href="/app/#learn">Back to app</a>' +
      '</header>' +
      '<div class="cp-body"><aside class="cp-side" id="cpSide" aria-label="Course content"></aside><div class="cp-scrim" id="cpScrim" hidden></div>' +
      '<div class="cp-main" id="cpMain"></div></div>';
    $('cpMenu').addEventListener('click', () => setSide(!document.body.classList.contains('side-open')));
    $('cpScrim').addEventListener('click', () => setSide(false, true));
    setSide(false);
    $('cpSide').addEventListener('click', e => {
      const b = e.target.closest('button[data-mod]');
      if (b) {
        const open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', open); b.parentElement.classList.toggle('open', open);
        sideOpen[b.dataset.mod] = open; try { localStorage.setItem('ap-side', JSON.stringify(sideOpen)); } catch(err){}
        return;
      }
      if (e.target.closest('a')) setSide(false);
    });
    $('cpFindBtn').addEventListener('click', () => { const open = !document.body.classList.contains('find-open'); setFind(open); if (open) $('cpQ').focus(); });
    searchSetup();
  }
  // The phone drawer: off screen and out of the Tab order when closed (inert); the page behind is inert while it's open
  const narrow = () => window.matchMedia('(max-width:860px)').matches;
  function setSide(open, refocus){
    setFind(false);
    document.body.classList.toggle('side-open', open);
    const side = $('cpSide'), main = $('cpMain'), menu = $('cpMenu');
    if (!side) return;
    menu.setAttribute('aria-expanded', open); $('cpScrim').hidden = !open;
    side.inert = narrow() && !open;
    if (main) main.inert = narrow() && open;
    if (open) { const f = side.querySelector('[aria-current="page"]') || side.querySelector('a,button'); if (f) f.focus({ preventScroll:false }); }
    else if (refocus) menu.focus();
  }
  function setFind(open){
    document.body.classList.toggle('find-open', open);
    const b = $('cpFindBtn'); if (b) b.setAttribute('aria-expanded', open);
    if (!open) { const r = $('cpRes'); if (r) r.hidden = true; }
  }
  // Listeners on the whole document are added once, not each time the frame is drawn
  // Skip link: move focus to the page content without touching the hash (the hash is the router)
  const skip = document.querySelector('.skip');
  if (skip) skip.addEventListener('click', e => { e.preventDefault(); const m = document.getElementById('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('side-open')) setSide(false, true);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.cp-find')) { const r = $('cpRes'); if (r) r.hidden = true; } });
  window.addEventListener('resize', () => { if ($('cpSide') && !document.body.classList.contains('side-open')) { $('cpSide').inert = narrow(); if ($('cpMain')) $('cpMain').inert = false; } });
  // Which sidebar row is this page? Lessons, quizzes, results, drills and checkpoints all map back to one row.
  function hereKey(){
    const p = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (p[0] !== 'm' || !p[2]) return p[0] === 'm' ? 'mod:' + p[1] : '';
    if (p[2] === 'r') return resultCache && resultCache.attempt === p[3] ? p[1] + '/q/' + resultCache.itemId : '';
    if (p[2] === 'q') { const mod = MOD(p[1]), e = mod && find(mod, p[3]); return p[1] + '/' + (e && e.it.type === 'checkpoint' ? 'c' : 'q') + '/' + p[3]; }
    return p[1] + '/' + p[2] + '/' + p[3];
  }
  function drawSide(){
    const side = $('cpSide'); if (!side || !S) return;
    const here = hereKey(), cur = currentModule();
    const top = side.scrollTop;
    let h = '<h2>Course content</h2>';
    if (S.isAdmin) h += '<a class="cp-tool" href="#/admin"' + (location.hash.startsWith('#/admin') ? ' aria-current="page"' : '') + '>' + IC.users + '<span>Admin: learners and reviews</span></a>';
    h += '<div class="cp-stage">Tools</div>' + TOOLS.map(t => '<a class="cp-tool" href="' + t[0] + '">' + ICK.tool + '<span>' + esc(t[1]) + '</span></a>').join('');
    const last = Math.max(S.totalModules, S.modules.length ? S.modules[S.modules.length - 1].number : 0);
    for (let n = 1; n <= last; n++) {
      const st = STAGES.find(s => s[0] === n);
      if (st) h += '<div class="cp-stage">' + esc(st[1]) + '</div>';
      const m = S.modules.find(x => x.number === n);
      if (!m || !m.open) {
        h += '<div class="cp-mod locked"><a class="cp-modbtn" href="#/locked/' + n + '"><span class="n">' + n + '</span><span><b>' + esc(m ? m.title : 'Module ' + n) + '</b><small>' + (m ? 'Locked' : 'Coming soon') + '</small></span>' + IC.lock + '</a></div>';
        continue;
      }
      const us = units(m), p = { done:us.filter(u => u.done).length, total:us.length };
      const isHere = here === 'mod:' + m.id || here.startsWith(m.id + '/');
      const open = sideOpen[m.id] != null ? sideOpen[m.id] : (isHere || (cur && cur.id === m.id));
      h += '<div class="cp-mod' + (open ? ' open' : '') + (cur && cur.id === m.id ? ' on' : '') + '">' +
        '<button class="cp-modbtn" type="button" data-mod="' + esc(m.id) + '" aria-expanded="' + open + '" aria-controls="side-' + esc(m.id) + '"><span class="n">' + n + '</span><span><b>' + esc(m.title) + '</b><small>' + (moduleDone(m) ? 'Done · ' : '') + p.done + ' of ' + p.total + ' done</small></span>' + IC.chev + '</button>' +
        '<div class="cp-items" id="side-' + esc(m.id) + '"><a class="cp-item ov" href="#/m/' + esc(m.id) + '"' + (here === 'mod:' + m.id ? ' aria-current="page"' : '') + '><span class="st">' + ICK.lesson + '</span><span>Module overview</span></a>' +
        us.map(u => {
          const k = m.id + '/' + (u.kind === 'quiz' ? 'q' : u.kind === 'lesson' ? 'l' : u.kind === 'assignment' ? 'a' : 'c') + '/' + u.e.it.id;
          const lbl = u.kind === 'lesson' ? (u.e.it.shortTitle || heading(u.e.it)) : u.kind === 'quiz' ? 'Quiz ' + idLabel(u.e).replace(/^[\d.]+ (?=Session)/, '') : u.label;
          return '<a class="cp-item k-' + u.kind + (u.locked ? ' locked' : '') + '" href="' + esc(u.href) + '"' + (here === k ? ' aria-current="page"' : '') + '>' +
            '<span class="st' + (u.done ? ' done' : u.locked ? ' lock' : '') + '">' + (u.done ? ICK.done : u.locked ? IC.lock : ICK[u.kind]) + '</span>' +
            '<span><span class="vh">' + (u.done ? 'Done: ' : u.locked ? 'Locked: ' : '') + '</span>' + esc(lbl) + '</span></a>';
        }).join('') + '</div></div>';
    }
    side.innerHTML = h;
    side.scrollTop = top;
    const cur2 = side.querySelector('[aria-current="page"]');
    if (cur2 && !top) cur2.scrollIntoView({ block:'nearest' });
  }
  function drawProgress(){
    const el = $('cpProg'); if (!el || !S) return;
    let d = 0, t = 0;
    S.modules.forEach(m => { if (m.open) { const us = units(m); d += us.filter(u => u.done).length; t += us.length; } });
    // Modules not open yet still count toward the whole course: estimate them at the size of the ones you can see
    const per = S.modules.filter(m => m.open).length ? t / S.modules.filter(m => m.open).length : 24;
    const all = t + Math.max(0, S.totalModules - S.modules.filter(m => m.open).length) * per;
    const v = all ? Math.floor(d * 100 / all) : 0;
    el.querySelector('i').style.width = v + '%'; el.querySelector('b').textContent = v + '%';
    el.setAttribute('aria-valuenow', v); el.setAttribute('title', 'Course progress: ' + v + '%');
  }
  // Search: lesson titles and text in the modules you can open
  function searchSetup(){
    const q = $('cpQ'), res = $('cpRes');
    const index = () => {
      const out = [];
      S.modules.filter(m => m.open).forEach(m => entries(m).forEach(e => {
        if (e.it.type !== 'lesson') return;
        out.push({ mod:m, e, title:(e.it.shortTitle || heading(e.it)), text:(e.it.bodyMarkdown || '').replace(/[*_|#\\]|-{2,}/g, ' ').replace(/\s+/g, ' '), href:'#/m/' + m.id + '/l/' + e.it.id });
      }));
      return out;
    };
    let idx = null;
    q.addEventListener('focus', () => { idx = index(); });
    q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase();
      if (v.length < 2) { res.hidden = true; $('cpCount').textContent = ''; return; }
      idx = idx || index();
      const hits = idx.map(x => {
        const t = x.title.toLowerCase().indexOf(v), b = x.text.toLowerCase().indexOf(v);
        return t < 0 && b < 0 ? null : Object.assign({ rank:t >= 0 ? 0 : 1, at:b }, x);
      }).filter(Boolean).sort((a, b) => a.rank - b.rank).slice(0, 8);
      res.innerHTML = hits.length ? hits.map(x => {
        const snip = x.at >= 0 ? x.text.slice(Math.max(0, x.at - 40), x.at + 80) : '';
        return '<a class="cp-hit" href="' + esc(x.href) + '"><b>' + esc(x.title) + '</b><small>Module ' + x.mod.number + (snip ? ' · …' + esc(snip) + '…' : '') + '</small></a>';
      }).join('') : '<p class="cp-none">No lessons match “' + esc(q.value.trim()) + '”.</p>';
      res.hidden = false;
      $('cpCount').textContent = hits.length ? plural(hits.length, 'lesson') + ' found' : 'No lessons found';
    });
    const done = () => { q.value = ''; q.blur(); setFind(false); $('cpCount').textContent = ''; };
    res.addEventListener('click', e => { if (e.target.closest('a')) done(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); done(); }
      if (e.key === 'Enter') { const a = res.querySelector('a'); if (a) { location.hash = a.getAttribute('href'); done(); } }
    });
  }

  appEl.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !appEl.contains(b)) return;
    const f = acts[b.dataset.act] || GLOBAL_ACTS[b.dataset.act];
    if (f) { e.preventDefault(); f(b, e); }
  });
  appEl.addEventListener('input', e => { if (onInput) onInput(e); });
  const GLOBAL_ACTS = { menu: () => openMenu() };

  function msgView(text, o){
    mount((o && o.header ? o.header : '') + '<main id="main" class="col"><div class="center-msg"><p>' + esc(text) + '</p>' +
      (o && o.retry ? '<button class="btn dark" type="button" data-act="retry">Try again</button>' : '') +
      (o && o.link ? '<a class="btn line" href="' + esc(o.link[0]) + '">' + esc(o.link[1]) + '</a>' : '') + '</div></main>',
      { at:o && o.at, acts:{ retry: () => start() } });
  }

  // ==================================================================
  // Course home
  // ==================================================================
  function homeView(){
    const cur = currentModule();
    const total = S.totalModules;
    let top = '';
    if (cur) {
      const p = progressOf(cur), nx = nextUnit(cur);
      const go = nx ? '<a class="btn dark go" href="' + esc(nx.href) + '"><span>' + (p.done ? 'Continue: ' : 'Start: ') + esc(nx.label) + '</span>' + IC.next + '</a>'
                    : '<a class="btn dark go" href="#/m/' + esc(cur.id) + '"><span>Review Module ' + cur.number + '</span>' + IC.next + '</a>';
      top = '<section class="card prog-card" aria-labelledby="progLbl">' +
          '<div class="between"><span class="label" id="progLbl">Your progress</span><span class="small muted">Module ' + cur.number + ' of ' + total + '</span></div>' +
          '<div class="row" data-s="baseline"><span class="big-pct">' + pct(p.done, p.total) + '%</span><span class="small" data-s="ofmod">of Module ' + cur.number + ' done · ' + p.done + ' of ' + p.total + ' items</span></div>' +
          '<div role="progressbar" aria-label="Module ' + cur.number + ' progress" aria-valuemin="0" aria-valuemax="' + p.total + '" aria-valuenow="' + p.done + '">' + bar(pct(p.done, p.total)) + '</div>' +
          go +
        '</section>';
    } else {
      top = '<section class="card"><p class="lead">No modules have been added yet.</p></section>';
    }
    // Modules: the open ones, then the next two locked, then "+ N more"
    const rows = [];
    let lockedShown = 0, hidden = 0, firstLocked = true;
    for (let n = 1; n <= Math.max(total, S.modules.length ? S.modules[S.modules.length - 1].number : 0); n++) {
      const m = S.modules.find(x => x.number === n);
      if (m && m.open) {
        const p = progressOf(m), lc = lessonsOf(m).length, qz = units(m).filter(u => u.kind === 'quiz' || u.kind === 'checkpoint').length, as = units(m).filter(u => u.kind === 'assignment').length;
        const st = moduleDone(m) ? ['Done', 'ok'] : p.done ? ['In progress', 'warm'] : ['Not started', 'neutral'];
        rows.push('<li><a class="mod' + (cur && cur.id === m.id ? ' cur' : '') + '" href="#/m/' + esc(m.id) + '">' + thumbOf(m, null, 'thumb') +
          '<span class="txt"><span class="n">Module ' + n + ': ' + esc(m.title) + '</span><span class="m">' + [plural(lc, 'lesson'), plural(qz, 'quiz', 'quizzes'), plural(as, 'assignment')].join(' · ') + '</span>' +
          '<span class="s ' + st[1] + '">' + st[0] + '</span></span></a></li>');
        continue;
      }
      const why = firstLocked ? 'Unlocks after the Module ' + (n - 1) + ' checkpoint' : 'Locked';
      firstLocked = false;
      const row = '<li' + (lockedShown >= 2 ? ' class="more-row" hidden' : '') + '><a class="mod locked" href="#/locked/' + n + '"><span class="lock-tile" aria-hidden="true">' + IC.lock + '</span>' +
        '<span class="txt"><span class="n">Module ' + n + (m ? ': ' + esc(m.title) : '') + '</span><span class="m">' + why + '</span></span></a></li>';
      if (lockedShown >= 2) hidden++;
      lockedShown++;
      rows.push(row);
    }
    const hero = '<section class="course-hero" aria-labelledby="heroT"><i></i><span class="k">Course</span>' +
      '<h1 id="heroT">' + esc(S.title) + '</h1><p>' + total + ' modules · from the first call to a signed contract</p></section>';
    mount(header({ home:true, title:S.title }) +
      '<main id="main" class="col"><div class="page">' + hero + top +
        '<section class="stack" aria-labelledby="modsH"><h2 class="sect" id="modsH">Modules</h2><ul class="mod-list">' + rows.join('') + '</ul>' +
        (hidden ? '<button class="link-btn more" type="button" data-act="more" aria-expanded="false">+ ' + plural(hidden, 'more module') + '</button>' : '') + '</section>' +
        installCard() +
      '</div></main>',
      { title:'Home', acts:{
        more: b => { appEl.querySelectorAll('.more-row').forEach(r => r.hidden = false); b.remove(); },
        install: () => promptInstall(), installNo: () => { try { localStorage.setItem('ap-install-no', '1'); } catch(e){} homeView(); }
      } });
  }

  // ==================================================================
  // Module page
  // ==================================================================
  function moduleView(mod){
    const p = progressOf(mod), nx = nextUnit(mod), curHref = nx && nx.href;
    const lc = lessonsOf(mod).length;
    const row = (cls, href, media, title, meta, status, isCur) =>
      '<li><a class="' + cls + (isCur ? ' cur' : '') + '" href="' + esc(href) + '"' + (isCur ? ' aria-current="step"' : '') + '>' + media +
      '<span class="txt"><span class="n">' + esc(title) + '</span><span class="m">' + esc(meta) + '</span></span>' + status + '</a></li>';
    const quizTile = '<span class="quiz-tile" aria-hidden="true">' + IC.quiz + '</span>';
    const lessonStatus = (it, isCur) => isDone(mod, it) ? chip('Done', 'ok') : isCur ? chip('In progress', 'warm') : chip('Not started');
    const quizStatus = it => { const q = qState(mod, it); return quizPassed(mod, it) ? chip('Passed', 'ok') : (q.open || q.latest) ? chip('In progress', 'warm') : chip('Not started'); };
    const quizMeta = it => { const q = qState(mod, it); return plural(qCount(it), 'question') + (q.latest ? ' · scored ' + q.latest.score + '%' + (q.best > q.latest.score ? ' · best ' + q.best + '%' : '') : q.open ? ' · ' + q.open.answered + ' answered' : ''); };
    // A lesson's quiz gets its own row once the lesson is started; before that it's folded into the lesson's line
    const showQuizRow = it => isDone(mod, it) || curHref === '#/m/' + mod.id + '/l/' + it.id || !!(qState(mod, it).latest || qState(mod, it).open) || (nx && nx.e.it.id === it.id);
    const lessonLines = (e, cls) => {
      const it = e.it, lessonHref = '#/m/' + mod.id + '/l/' + it.id, isCur = curHref === lessonHref, sep = showQuizRow(it);
      const title = it.shortTitle || (cls === 'srow' ? inGroupLabel(e) + ': ' + heading(it) : it.title);
      const meta = sep || !it.quiz ? 'Lesson' : 'Lesson + ' + qCount(it) + '-question quiz';
      let h = row(cls, lessonHref, thumbOf(mod, it, 'thumb'), title, meta, lessonStatus(it, isCur), isCur);
      if (it.quiz && sep) {
        const qh = quizHref(mod, it);
        h += row(cls, qh, quizTile, cls === 'srow' ? 'Quiz: ' + inGroupLabel(e) : quizLabel(e), quizMeta(it), quizStatus(it), curHref === qh);
      }
      return h;
    };
    const parts = [];
    (mod.items || []).forEach(it => {
      if (it.type === 'lesson') parts.push(lessonLines({ it, group:null }, 'item'));
      else if (it.type === 'group') {
        const kids = (it.items || []).filter(c => c.type === 'lesson');
        const hasCur = !!nx && nx.e.group && nx.e.group.id === it.id;
        const open = groupOpen(mod, it, hasCur);
        const qs = kids.reduce((a, c) => a + qCount(c), 0);
        parts.push('<li class="group' + (hasCur ? ' cur' : '') + '"><button class="group-btn" type="button" data-act="group" data-id="' + esc(it.id) + '" aria-expanded="' + open + '" aria-controls="g-' + esc(it.id) + '">' +
          thumbOf(mod, it, 'thumb') + '<span class="txt"><span class="n">' + esc(it.title) + '</span><span class="m">' +
          [plural(kids.length, 'session'), plural(kids.filter(c => c.quiz).length, 'quiz', 'quizzes'), plural(qs, 'question')].join(' · ') + '</span></span>' +
          '<span class="chev">' + IC.chev + '</span></button>' +
          '<ul class="sub-items" id="g-' + esc(it.id) + '"' + (open ? '' : ' hidden') + '>' + kids.map(c => lessonLines({ it:c, group:it }, 'srow')).join('') + '</ul></li>');
      } else if (it.type === 'assignment') {
        const s = sub(mod, it), href = '#/m/' + mod.id + '/a/' + it.id;
        const st = !s ? chip('Not started') : s.status === 'approved' ? chip('Approved', 'ok') : s.status === 'submitted' ? chip('Submitted', 'ok') : s.status === 'needs_changes' ? chip('Needs changes', 'warm') : chip('In progress', 'warm');
        parts.push(row('item', href, thumbOf(mod, it, 'thumb'), it.title, 'Assignment · ' + plural((it.tasks || []).length || 12, 'task'), st, curHref === href));
      } else if (it.type === 'checkpoint') {
        const href = '#/m/' + mod.id + '/c/' + it.id, locked = !mod.checkpointOpen;
        const q = qState(mod, it);
        const st = locked ? chip('Locked') : quizPassed(mod, it) ? chip('Passed', 'ok') : (q.open || q.latest) ? chip('In progress', 'warm') : chip('Not started');
        parts.push(row('item' + (locked ? ' locked' : ''), href, thumbOf(mod, it, 'thumb'), it.title,
          'Quiz · ' + plural(qCount(it), 'question') + ' · ' + passText(it).toLowerCase() + (q.latest ? ' · scored ' + q.latest.score + '%' : ''), st, curHref === href));
      }
    });
    mount(header({ back:'#/', backLabel:'Back to course home', title:'Module ' + mod.number }) +
      '<main id="main" class="col"><div class="page tight">' +
        '<div class="stack" data-s="g8">' +
          '<span class="label o">Skill focus · ' + esc(mod.skillFocus || '') + '</span>' +
          '<h1 class="display">' + esc(mod.title) + '</h1>' +
          '<p class="lead">' + esc(mod.shortDescription || mod.description || '') + '</p>' +
          '<div class="row" role="progressbar" aria-label="Module progress" aria-valuemin="0" aria-valuemax="' + p.total + '" aria-valuenow="' + p.done + '">' + bar(pct(p.done, p.total)) + '<span class="small muted">' + p.done + ' of ' + p.total + '</span></div>' +
          (S.isAdmin && !mod.openForLearners ? '<p class="note">Admin view: this module is still locked for you as a learner.</p>' : '') +
        '</div>' +
        '<ul class="items" aria-label="Lessons and quizzes, in order">' + parts.join('') + '</ul>' +
      '</div></main>',
      { title:'Module ' + mod.number, acts:{
        group: b => {
          const open = b.getAttribute('aria-expanded') !== 'true';
          b.setAttribute('aria-expanded', open); $('g-' + b.dataset.id).hidden = !open;
          try { localStorage.setItem('ap-group:' + mod.id + ':' + b.dataset.id, open ? '1' : '0'); } catch(e){}
        }
      } });
  }
  function groupOpen(mod, g, hasCur){
    try { const v = localStorage.getItem('ap-group:' + mod.id + ':' + g.id); if (v) return v === '1'; } catch(e){}
    return true; // open by default, as in the approved design
  }

  // ==================================================================
  // Lesson
  // ==================================================================
  function lessonView(mod, e){
    const it = e.it, ls = lessonsOf(mod), n = ls.findIndex(x => x.it.id === it.id) + 1;
    const done = isDone(mod, it);
    const files = (it.sourceImages || []).map(f => {
      const num = parseInt((f.match(/(\d+)\.\w+$/) || [])[1], 10);
      return '<button class="file" type="button" data-act="view" data-file="' + esc(f) + '" data-name="Guide page ' + (num || '') + '">' + IC.image + 'Guide page ' + (num || esc(f)) + (it.source ? ' · ' + esc(it.source) : '') + '</button>';
    });
    mount(header({ back:'#/m/' + mod.id, backLabel:'Back to Module ' + mod.number, ctx:'Module ' + mod.number + (e.group ? ' · ' + e.group.title : ''), title:e.group ? inGroupLabel(e) : 'Lesson ' + it.id }) +
      '<main id="main" class="col">' + thumbOf(mod, it, 'banner', it.title) +
      '<article class="lesson page has-bar">' +
        '<span class="label o">Lesson ' + n + ' of ' + ls.length + (it.subtitle ? ' · ' + esc(it.subtitle) : '') + '</span>' +
        '<h1>' + esc(heading(it)) + '</h1>' +
        '<div class="prose">' + MD.render(it.bodyMarkdown) + '</div>' +
        '<div id="practiceBox"></div>' +
        (files.length ? '<section class="stack" aria-labelledby="filesH"><h2 class="sub" id="filesH" data-s="fs16">Files</h2><p class="note">Original guide page. Where it differs from the lesson, the lesson is correct.</p><div class="files">' + files.join('') + '</div></section>' : '') +
      '</article></main>' +
      '<div class="bar-foot lesson-foot"><div class="col">' +
        '<button class="btn ' + (done ? 'done' : 'line') + '" type="button" data-act="done" aria-pressed="' + done + '">' + (done ? 'Completed ✓' : 'Mark complete') + '</button>' +
        (it.quiz ? '<a class="btn dark wide" href="' + esc(quizHref(mod, it).includes('/r/') ? '#/m/' + mod.id + '/q/' + it.id + '/new' : quizHref(mod, it)) + '">' + (qState(mod, it).latest && !qState(mod, it).open ? 'Retake the quiz' : qState(mod, it).open ? 'Continue the quiz' : 'Take the quiz') + '</a>' : '') +
      '</div></div>',
      { white:true, title:heading(it), acts:{
        done: async b => {
          const now = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-busy', 'true');
          try { await rpc('course_mark_done', { p_module:mod.id, p_item:it.id, p_done:now }); await refresh(); }
          catch(err){ b.removeAttribute('aria-busy'); toast(errText(err)); return; }
          b.removeAttribute('aria-busy');
          b.className = 'btn ' + (now ? 'done' : 'line'); b.setAttribute('aria-pressed', now); b.textContent = now ? 'Completed ✓' : 'Mark complete';
          announce(now ? 'Marked complete' : 'Marked not complete');
        },
        view: b => openViewer(contentPath(mod, b.dataset.file), b.dataset.name)
      } });
    if (window.CoursePractice && user) CoursePractice.mount($('practiceBox'), { db, user, mod, it, title:it.shortTitle || heading(it), toast }).then(f => { leaving = f; }).catch(() => {});
  }

  // Guide page viewer: full screen, pinch to zoom on phones, a zoom button for everyone
  function openViewer(path, name){
    const d = document.createElement('dialog');
    d.className = 'viewer'; d.setAttribute('aria-label', name);
    d.innerHTML = '<div class="viewer-top"><button class="icon-btn" type="button" data-v="close" aria-label="Close">' + IC.close + '</button>' +
      '<span class="ttl"><span class="t">' + esc(name) + '</span><span class="ctx">Original guide page. Where it differs from the lesson, the lesson is correct.</span></span>' +
      '<button class="icon-btn" type="button" data-v="zoom" aria-label="Zoom in" aria-pressed="false">' + IC.zoom + '</button></div>' +
      '<div class="viewer-body"><img data-src="' + esc(path) + '" alt="' + esc(name) + '"></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      if (b.dataset.v === 'close') d.close();
      else { const z = d.querySelector('.viewer-body').classList.toggle('zoom'); b.setAttribute('aria-pressed', z); b.setAttribute('aria-label', z ? 'Zoom out' : 'Zoom in'); }
    });
    d.addEventListener('close', () => d.remove());
    d.showModal();
    hydrateImages(d);
  }

  // ==================================================================
  // Quiz
  // ==================================================================
  let Q = null; // { mod, e, attempt, answered, idx, picks:Set, submitted }
  async function quizStart(mod, e, restart){
    msgView('Loading the quiz…');
    let r;
    try { r = await rpc('course_quiz_start', { p_module:mod.id, p_item:e.it.id, p_restart:!!restart }); }
    catch(err){ return msgView(errText(err), { header:header({ back:'#/m/' + mod.id, title:'Quiz' }), link:['#/m/' + mod.id, 'Back to Module ' + mod.number] }); }
    if (!location.hash.startsWith('#/m/' + mod.id + '/q/' + e.it.id)) return; // they left while it loaded
    if (restart) history.replaceState(null, '', '#/m/' + mod.id + '/q/' + e.it.id);
    const qs = e.it.quiz.questions;
    Q = { mod, e, attempt:r.attempt, answered:r.answered || {}, idx:0, picks:new Set(), submitted:false };
    Q.idx = qs.findIndex(q => !Q.answered[q.id]);
    if (Q.idx < 0) return quizFinish();
    await refresh().catch(() => {});
    questionView();
  }
  function questionView(){
    const { mod, e } = Q, it = e.it, qs = it.quiz.questions, q = qs[Q.idx], multi = q.type === 'multiple';
    const fb = Q.submitted ? Q.answered[q.id] : null;
    const back = it.type === 'checkpoint' ? '#/m/' + mod.id + '/c/' + it.id : '#/m/' + mod.id + '/l/' + it.id;
    const ctx = it.type === 'checkpoint' ? 'Module ' + mod.number + ' checkpoint' : 'Quiz · ' + idLabel(e);
    const opts = q.options.map(o => {
      const sel = fb ? fb.picks.includes(o.id) : Q.picks.has(o.id);
      const cls = fb && sel ? (fb.right ? ' right' : ' wrong') : sel ? ' sel' : '';
      return '<label class="opt' + cls + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="opt" value="' + esc(o.id) + '"' + (sel ? ' checked' : '') + (fb ? ' disabled' : '') + '>' +
        '<span class="bdg" aria-hidden="true">' + esc(o.id) + '</span><span><span class="vh">Option ' + esc(o.id) + ': </span>' + esc(o.text) + '</span></label>';
    }).join('');
    const last = Q.idx === qs.length - 1;
    mount(header({ back, close:true, backLabel:'Leave the quiz. Your answers so far are saved.', ctx, title:'Question ' + (Q.idx + 1) + ' of ' + qs.length, aside:passText(it) }) +
      bar(pct(Q.idx + 1, qs.length), 'qbar') +
      '<main id="main" class="col"><div class="page has-bar" data-s="quizpage">' +
        '<span class="label">' + (multi ? 'Multiple choice' : 'Single choice') + '</span>' +
        '<h1 class="q-prompt" id="qp">' + esc(q.prompt) + '</h1>' +
        (multi && !fb ? '<p class="hint">Pick every answer that’s right.</p>' : '') +
        '<fieldset class="opts' + (multi ? ' multi' : '') + (fb ? ' locked-opts' : '') + '" aria-labelledby="qp"><legend class="vh">' + esc(q.prompt) + '</legend>' + opts + '</fieldset>' +
        '<div id="fb" aria-live="polite">' + (fb ? '<div class="verdict ' + (fb.right ? 'ok' : 'no') + '"><b>' + (fb.right ? 'Correct' : 'Not quite') + '</b><p>' + esc(fb.explanation || '') + '</p></div>' : '') + '</div>' +
      '</div></main>' +
      '<div class="bar-foot"><div class="col">' + (fb
        ? '<button class="btn dark lg" type="button" data-act="next" id="qNext">' + (last ? 'See your result' : 'Next question') + '</button>'
        : '<button class="btn orange lg" type="button" data-act="submit" id="qSubmit"' + (Q.picks.size ? '' : ' disabled') + '>Submit answer</button>') +
      '</div></div>',
      { title:'Question ' + (Q.idx + 1), keepFocus:Q.submitted, acts:{
        submit: async b => {
          if (!Q.picks.size) return;
          b.setAttribute('aria-busy', 'true');
          try {
            const r = await rpc('course_quiz_answer', { p_attempt:Q.attempt, p_question:q.id, p_picks:[...Q.picks] });
            Q.answered[q.id] = r; Q.submitted = true;
          } catch(err){ b.removeAttribute('aria-busy'); toast(errText(err)); return; }
          questionView();
          const n = $('qNext'); if (n) n.focus();
          announce(Q.answered[q.id].right ? 'Correct. ' + Q.answered[q.id].explanation : 'Not quite. ' + Q.answered[q.id].explanation);
        },
        next: () => {
          if (last) return quizFinish();
          Q.idx++; Q.picks = new Set(); Q.submitted = false;
          lastRoute = ''; // move focus to the new question
          questionView();
        }
      } });
    if (!fb) appEl.querySelector('.opts').addEventListener('change', ev => {
      const inp = ev.target;
      if (multi) inp.checked ? Q.picks.add(inp.value) : Q.picks.delete(inp.value); else Q.picks = new Set([inp.value]);
      appEl.querySelectorAll('.opt').forEach(l => l.classList.toggle('sel', l.querySelector('input').checked));
      $('qSubmit').disabled = !Q.picks.size;
    });
  }
  // Starting over with an unfinished attempt: the server keeps that attempt on record (it never counts)
  function startOverView(mod, e){
    const it = e.it, q = qState(mod, it), isCp = it.type === 'checkpoint';
    const name = isCp ? 'the checkpoint' : 'this quiz';
    mount(header({ back:isCp ? '#/m/' + mod.id + '/c/' + it.id : '#/m/' + mod.id + '/l/' + it.id, backLabel:'Back', ctx:isCp ? 'Module ' + mod.number + ' checkpoint' : 'Quiz · ' + idLabel(e), title:'Start over?' }) +
      '<main id="main" class="col"><div class="page has-bar"><div class="stack" data-s="g8">' +
        '<h1 data-s="h22">Start ' + name + ' over?</h1>' +
        '<p class="lead" data-s="fs15">You’ve answered ' + plural(q.open.answered, 'question') + ' so far. Your answers so far stay on record but won’t count. You’ll start again from question 1.</p>' +
      '</div></div></main>' +
      '<div class="bar-foot"><div class="col">' +
        '<a class="btn line lg" href="#/m/' + esc(mod.id) + '/q/' + esc(it.id) + '">Continue where I left off</a>' +
        '<button class="btn orange lg wider" type="button" data-act="restart">Start over</button>' +
      '</div></div>', { title:'Start over?', acts:{ restart: () => location.replace('#/m/' + mod.id + '/q/' + it.id + '/new/ok') } });
  }
  let resultCache = null;
  async function quizFinish(){
    const { mod } = Q;
    try { resultCache = await rpc('course_quiz_finish', { p_attempt:Q.attempt }); }
    catch(err){ return msgView(errText(err), { retry:true }); }
    await refresh().catch(() => {});
    location.hash = '#/m/' + mod.id + '/r/' + Q.attempt;
  }

  // ==================================================================
  // Result
  // ==================================================================
  async function resultView(mod, id){
    const at = location.hash;
    let r = resultCache && resultCache.attempt === id ? resultCache : null;
    if (!r) {
      msgView('Loading your result…');
      try { r = await rpc('course_attempt_result', { p_attempt:id }); } catch(err){ return msgView(errText(err), { at, link:['#/m/' + mod.id, 'Back to Module ' + mod.number] }); }
    }
    resultCache = r;
    const e = find(mod, r.itemId);
    if (!e) return msgView('That quiz isn’t in this module.', { link:['#/', 'Course home'] });
    const it = e.it, isCp = it.type === 'checkpoint';
    if (!r.finished) { location.hash = '#/m/' + mod.id + '/q/' + it.id; return; }
    const nextMod = S.modules.find(m => m.number === mod.number + 1);
    const msg = r.passed
      ? (isCp ? (nextMod && nextMod.open ? 'Passed. Module ' + (mod.number + 1) + ' is open.' : 'Passed. You’ve finished Module ' + mod.number + '.') : 'Passed. Move to the next lesson.')
      : quizPassed(mod, it) ? 'This try was under ' + r.passMark + '%. You already passed this quiz, so nothing is locked.'
      : 'Not passed yet. You need ' + needCount(r.passMark, r.total) + ' of ' + r.total + '.';
    // Next: the unit after this quiz (or the next module after the checkpoint)
    const us = units(mod), i = us.findIndex(u => (u.kind === 'quiz' || u.kind === 'checkpoint') && u.e.it.id === it.id);
    let nx = us.slice(i + 1).find(u => !u.locked);
    let nextHref, nextLabel;
    if (isCp) { nextHref = nextMod && nextMod.open ? '#/m/' + nextMod.id : '#/'; nextLabel = nextMod && nextMod.open ? 'Next: Module ' + nextMod.number : 'Course home'; }
    else if (nx) { nextHref = nx.href; nextLabel = 'Next: ' + (nx.e.group && nx.kind === 'lesson' && e.group && nx.e.group.id === e.group.id ? (nx.e.it.shortTitle || inGroupLabel(nx.e)) : nx.label); }
    else { nextHref = '#/m/' + mod.id; nextLabel = 'Back to Module ' + mod.number; }
    const review = r.review.map(x => '<li class="rv' + (x.right ? '' : ' wrong') + '"><div class="between"><span class="q">Q' + x.number + ' · ' + esc(x.prompt) + '</span><span class="v ' + (x.right ? 'ok' : 'no') + '">' + (x.right ? 'Right' : 'Wrong') + '</span></div><p class="e">' + esc(x.explanation || '') + '</p></li>').join('');
    mount(header({ back:'#/m/' + mod.id, backLabel:'Back to Module ' + mod.number, ctx:isCp ? 'Module ' + mod.number + ' checkpoint' : 'Quiz · ' + idLabel(e), title:'Your result' }) +
      '<main id="main" class="col"><div class="page has-bar" data-s="pt22">' +
        '<section class="score" aria-labelledby="scoreMsg">' +
          '<span class="label">' + r.correct + ' of ' + r.total + ' correct · Pass mark ' + r.passMark + '%</span>' +
          '<span class="num" aria-hidden="true">' + r.score + '%</span>' +
          '<h1 class="msg" id="scoreMsg" data-s="m0"><span class="vh">You scored ' + r.score + '%. </span>' + esc(msg) + '</h1>' +
          '<span class="fine">' + (r.passed || quizPassed(mod, it) ? 'Retake it anytime to practise. Once you’ve passed, a lower score won’t lock anything.' : 'Review the lesson, then retake it.') + '</span>' +
        '</section>' +
        '<section class="stack" aria-labelledby="rvH"><h2 class="sub" id="rvH">Review</h2><ol class="stack" data-s="list">' + review + '</ol>' +
          '<p class="note">Each answer is marked right or wrong. The correct option isn’t shown, but every explanation is.</p></section>' +
      '</div></main>' +
      '<div class="bar-foot"><div class="col">' +
        '<a class="btn line lg" href="#/m/' + esc(mod.id) + '/q/' + esc(it.id) + '/new">Retake</a>' +
        '<a class="btn orange lg wider" href="' + esc(nextHref) + '">' + esc(nextLabel) + '</a>' +
      '</div></div>',
      { title:'Your result', at });
  }

  // ==================================================================
  // Checkpoint (gate)
  // ==================================================================
  function checkpointView(mod, e){
    const it = e.it, open = mod.checkpointOpen, q = qState(mod, it);
    const nextMod = 'Module ' + (mod.number + 1);
    let body;
    if (!open) {
      const reqs = lessonsOf(mod).filter(x => x.it.quiz).map(x => ({ ok:quizPassed(mod, x.it), text:'Pass ' + quizLabel(x), href:quizHref(mod, x.it) }));
      const drill = entries(mod).find(x => x.it.type === 'assignment');
      if (drill) { const s = sub(mod, drill.it); reqs.push({ ok:!!(s && s.submittedAt), text:'Submit the written drill', href:'#/m/' + mod.id + '/a/' + drill.it.id }); }
      const left = reqs.filter(x => !x.ok);
      body = '<section class="card stack" aria-labelledby="reqH"><h2 class="sub" id="reqH">Opens when you’ve done all of this</h2>' +
        '<p class="note">' + (reqs.length - left.length) + ' of ' + reqs.length + ' done</p><ul class="checklist">' +
        reqs.map(x => '<li class="' + (x.ok ? 'yes' : '') + '"><span class="ic" aria-hidden="true">' + (x.ok ? IC.check : '') + '</span>' +
          (x.ok ? '<span><span class="vh">Done: </span>' + esc(x.text) + '</span>' : '<a href="' + esc(x.href) + '"><span class="vh">Not done yet: </span>' + esc(x.text) + '</a>') + '</li>').join('') + '</ul></section>';
      body += '</div></main><div class="bar-foot"><div class="col"><a class="btn dark lg go" href="' + esc(left[0] ? left[0].href : '#/m/' + mod.id) + '"><span>' + esc(left[0] ? 'Next: ' + left[0].text : 'Back to the module') + '</span>' + IC.next + '</a></div></div>';
    } else {
      body = '<p class="lead" data-s="fs15">' + plural(qCount(it), 'mixed question') + ' from the whole module. Get ' + needCount(passMark(it), qCount(it)) + ' of ' + qCount(it) + ' right (' + passMark(it) + '%) to unlock ' + nextMod + '. Retake it as often as you like.</p>' +
        (q.latest ? '<section class="card stack"><span class="label">Your last try</span><p data-s="p15"><b>' + q.latest.score + '%</b> · ' + (q.latest.passed ? 'Passed' : quizPassed(mod, it) ? 'Under the mark, but you’ve already passed' : 'Not passed yet') + ' · ' + when(q.latest.finishedAt) + '</p><a href="#/m/' + esc(mod.id) + '/r/' + esc(q.latest.id) + '">See that result</a></section>' : '') +
        '</div></main><div class="bar-foot"><div class="col"><a class="btn dark lg" href="#/m/' + esc(mod.id) + '/q/' + esc(it.id) + (q.open ? '' : q.latest ? '/new' : '') + '">' +
        (q.open ? 'Continue the checkpoint (' + q.open.answered + ' of ' + qCount(it) + ' answered)' : q.latest ? 'Take it again' : 'Start the checkpoint') + '</a></div></div>';
    }
    mount(header({ back:'#/m/' + mod.id, backLabel:'Back to Module ' + mod.number, ctx:'Module ' + mod.number, title:'Checkpoint' }) +
      '<main id="main" class="col"><div class="page gate has-bar">' +
        thumbOf(mod, it, open ? 'hero-img' : 'faded') +
        '<span class="label o">Checkpoint · ' + plural(qCount(it), 'question') + ' · ' + passText(it) + '</span>' +
        '<h1 class="display" data-s="fs30">' + esc(it.title) + '</h1>' +
        (open ? '' : '<p class="lead" data-s="fs15">' + IC.lock.replace('<svg', '<svg width="16" height="16" data-s="va"') + ' Locked for now. Pass every lesson quiz and submit the written drill to open it.</p>') +
        body,
      { title:'Checkpoint' });
  }

  // ==================================================================
  // Written drill
  // ==================================================================
  function assignmentView(mod, e){
    const it = e.it, tasks = it.tasks || [];
    const s = sub(mod, it) || { status:null, answers:{} };
    const lsKey = 'ap-draft:' + (user && user.id) + ':' + key(mod, it);
    let answers = Object.assign({}, s.answers || {});
    // A draft kept on this phone that never reached the server wins over an older server copy
    try { const loc = JSON.parse(localStorage.getItem(lsKey) || 'null'); if (loc && (!s.updatedAt || loc.at > Date.parse(s.updatedAt)) && s.status !== 'approved') answers = Object.assign(answers, loc.answers); } catch(err){}
    const ro = s.status === 'approved';
    const statusBox = !s.status ? '' :
      s.status === 'approved' ? '<div class="status ok" role="status"><b>Approved</b><p>Amr approved your drill ' + when(s.reviewedAt) + '.</p>' + (s.comment ? '<p class="cm">' + esc(s.comment) + '</p>' : '') + '</div>' :
      s.status === 'submitted' ? '<div class="status ok" role="status"><b>Submitted</b><p>Sent ' + when(s.lastSubmittedAt) + '. Amr will review it. You can still change your answers and submit again.</p></div>' :
      s.status === 'needs_changes' ? '<div class="status warm" role="status"><b>Needs changes</b><p>Amr sent it back ' + when(s.reviewedAt) + ' with this note:</p><p class="cm">' + esc(s.comment || '') + '</p><p>Fix your answers, then submit again.</p></div>' :
      s.submittedAt ? '<div class="status neutral" role="status"><b>Changed since you submitted</b><p>Submit again so Amr sees the new version.</p></div>' : '';
    const fileBox = '<section class="task upload" aria-labelledby="upH"><span class="label">File</span><h2 class="sub" id="upH">' + esc(it.attachTemplate ? 'Your filled-in ' + it.attachTemplate.replace(/^CRM/, 'CRM') : 'Attach a file') + '</h2>' +
      '<p class="note">PDF, image, Word or Excel, up to 10 MB. One file; a new one replaces the old.</p>' +
      (s.fileName ? '<div class="fname">' + IC.file + '<span>' + esc(s.fileName) + '</span></div>' : '') +
      (ro ? '' : '<div class="acts"><label class="btn line"><input type="file" class="vh" id="upFile" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.gif,.doc,.docx,.xls,.xlsx,application/pdf,image/*">' + (s.fileName ? 'Replace file' : 'Choose a file') + '</label>' +
        (s.fileName ? '<button class="btn line" type="button" data-act="rmfile">Remove</button>' : '') + '</div><p class="err" id="upErr" role="alert"></p>') + '</section>';
    mount(header({ back:'#/m/' + mod.id, backLabel:'Back to Module ' + mod.number, ctx:'Module ' + mod.number, title:'Written drill' }) +
      '<main id="main" class="col">' + thumbOf(mod, it, 'banner') +
      '<div class="page has-bar">' +
        '<div class="stack" data-s="g8"><span class="label o">Assignment · ' + plural(tasks.length, 'task') + ' · Reviewed by Amr</span><h1 data-s="h22">' + esc(it.title) + '</h1>' +
        '<p class="lead" data-s="fs15">' + esc(it.instructions || '') + '</p></div>' +
        statusBox +
        '<ol class="stack" data-s="list12">' + tasks.map((t, i) =>
          '<li class="task"><span class="label">Task ' + (i + 1) + ' of ' + tasks.length + '</span><p id="t' + (i + 1) + '">' + MD.inline(t) + '</p>' +
          '<label class="field-lbl" for="a' + (i + 1) + '">Your answer</label>' +
          '<textarea id="a' + (i + 1) + '" data-n="' + (i + 1) + '" aria-describedby="t' + (i + 1) + '" rows="5"' + (ro ? ' readonly' : '') + '>' + esc(answers[String(i + 1)] || '') + '</textarea></li>').join('') + '</ol>' +
        fileBox +
        '<p class="save-state" id="saveState" aria-live="polite"></p><p class="err" id="subErr" role="alert"></p>' +
      '</div></main>' +
      (ro ? '' : '<div class="bar-foot"><div class="col"><button class="btn line lg" type="button" data-act="save">Save draft</button><button class="btn orange lg wider" type="button" data-act="submitDrill" id="subBtn"' + (s.status === 'submitted' ? ' disabled' : '') + '>' + (s.status === 'submitted' ? 'Submitted ✓' : s.submittedAt ? 'Submit again' : 'Submit for review') + '</button></div></div>'),
      { title:'Written drill', acts:{
        save: async b => { b.setAttribute('aria-busy', 'true'); await save(false); b.removeAttribute('aria-busy'); },
        submitDrill: async b => {
          const missing = tasks.map((t, i) => i + 1).filter(n => !(collect()[String(n)] || '').trim());
          if (missing.length) { $('subErr').textContent = 'Answer every task before you submit. Still empty: task ' + missing.join(', ') + '.'; $('a' + missing[0]).focus(); return; }
          b.setAttribute('aria-busy', 'true');
          const ok = await save(true);
          b.removeAttribute('aria-busy');
          if (ok) { toast('Submitted for review'); await refresh().catch(() => {}); assignmentView(mod, e); }
        },
        rmfile: async b => {
          b.setAttribute('aria-busy', 'true');
          try {
            const old = (sub(mod, it) || {}).filePath;
            await rpc('course_set_file', { p_module:mod.id, p_item:it.id, p_path:null, p_name:null });
            if (old) await db.storage.from('course').remove([old]);
            await refresh(); assignmentView(mod, e); toast('File removed');
          } catch(err){ b.removeAttribute('aria-busy'); toast(errText(err)); }
        }
      } });
    if (ro) return;
    const collect = () => { const o = {}; appEl.querySelectorAll('textarea[data-n]').forEach(t => o[t.dataset.n] = t.value); return o; };
    let timer = null, dirty = false;
    async function save(submit){
      clearTimeout(timer);
      const a = collect();
      try { localStorage.setItem(lsKey, JSON.stringify({ at:Date.now(), answers:a })); } catch(err){}
      $('saveState').textContent = submit ? 'Submitting…' : 'Saving…'; $('subErr').textContent = '';
      try {
        await rpc('course_save_answers', { p_module:mod.id, p_item:it.id, p_answers:a, p_submit:submit });
        dirty = false;
        try { localStorage.removeItem(lsKey); } catch(err){}
        $('saveState').textContent = submit ? '' : 'Draft saved ' + new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
        if (!submit) refresh().catch(() => {});
        return true;
      } catch(err){
        $('saveState').textContent = 'Not saved yet. It’s kept on this device and will save when you’re back online.';
        if (submit) $('subErr').textContent = errText(err);
        return false;
      }
    }
    onInput = ev => {
      if (!ev.target.matches('textarea[data-n]')) return;
      dirty = true; $('saveState').textContent = 'Editing…';
      const sb = $('subBtn'); if (sb && sb.disabled) { sb.disabled = false; sb.textContent = 'Submit again'; }
      try { localStorage.setItem(lsKey, JSON.stringify({ at:Date.now(), answers:collect() })); } catch(err){}
      clearTimeout(timer); timer = setTimeout(() => save(false), 1500);
    };
    window.addEventListener('pagehide', () => { if (dirty) save(false); }, { once:true });
    $('upFile').addEventListener('change', async ev => {
      const f = ev.target.files[0]; if (!f) return;
      $('upErr').textContent = '';
      if (f.size > 10 * 1024 * 1024) { $('upErr').textContent = 'That file is over 10 MB. Try a smaller one, or save it as a PDF.'; return; }
      if (!/\.(pdf|png|jpe?g|webp|heic|heif|gif|docx?|xlsx?)$/i.test(f.name)) { $('upErr').textContent = 'Use a PDF, an image, or a Word or Excel file.'; return; }
      if (dirty) await save(false);
      $('saveState').textContent = 'Uploading ' + f.name + '…';
      const safe = f.name.replace(/[^\w.\-]+/g, '_').slice(-80);
      const path = 'uploads/' + user.id + '/' + it.id + '/' + Date.now() + '-' + safe;
      const old = (sub(mod, it) || {}).filePath;
      const up = await db.storage.from('course').upload(path, f, { contentType:f.type || undefined, upsert:false });
      if (up.error) { $('saveState').textContent = ''; $('upErr').textContent = /size|large/i.test(up.error.message || '') ? 'That file is over 10 MB.' : /mime|type/i.test(up.error.message || '') ? 'That kind of file isn’t allowed. Use a PDF, an image, or a Word or Excel file.' : 'The upload didn’t work. Check your connection and try again.'; return; }
      try {
        await rpc('course_set_file', { p_module:mod.id, p_item:it.id, p_path:path, p_name:f.name });
        if (old && old !== path) db.storage.from('course').remove([old]);
        await refresh(); assignmentView(mod, e); toast('File attached');
      } catch(err){ $('saveState').textContent = ''; $('upErr').textContent = errText(err); }
    });
  }

  // ==================================================================
  // Locked module
  // ==================================================================
  function lockedView(n){
    const m = S.modules.find(x => x.number === n), prev = S.modules.find(x => x.number === n - 1);
    const prevOpen = prev && prev.open;
    const p = prevOpen ? progressOf(prev) : null;
    mount(header({ back:'#/', backLabel:'Back to course home', title:'Module ' + n }) +
      '<main id="main" class="col"><div class="page gate">' +
        '<div class="lock-big" aria-hidden="true">' + IC.lock + '</div>' +
        '<span class="label">Module ' + n + ' of ' + S.totalModules + ' · Locked</span>' +
        '<h1 class="display">' + esc(m ? m.title : 'Module ' + n) + '</h1>' +
        '<p class="lead" data-s="fs15">' + (prevOpen ? 'Unlocks after the Module ' + (n - 1) + ' checkpoint. Pass it at 85% or higher and this module opens.' :
          'Unlocks after the Module ' + (n - 1) + ' checkpoint. Modules open one at a time, in order.') + (m ? '' : ' Its lessons haven’t been added yet.') + '</p>' +
        (m && m.description ? '<p class="lead">' + esc(m.description) + '</p>' : '') +
        (p ? '<section class="card stack"><span class="label">Module ' + (n - 1) + ' so far</span><div class="row">' + bar(pct(p.done, p.total)) + '<span class="small muted">' + p.done + ' of ' + p.total + '</span></div>' +
          '<a class="btn dark go" href="#/m/' + esc(prev.id) + '"><span>Go to Module ' + (n - 1) + '</span>' + IC.next + '</a></section>' : '') +
      '</div></main>', { title:'Module ' + n });
  }

  // ==================================================================
  // Install (Android button, iPhone steps)
  // ==================================================================
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (/^#?\/?$/.test(location.hash.replace('#', '')) || location.hash === '#/install') route(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('Installed. Open it from your home screen.'); });
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  async function promptInstall(){
    if (!deferredPrompt) { location.hash = '#/install'; return; }
    deferredPrompt.prompt();
    const c = await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    if (c && c.outcome === 'accepted') toast('Installing…');
    route();
  }
  function installSteps(){
    if (standalone()) return '<p class="lead">You’re using the installed app.</p>';
    if (deferredPrompt) return '<p class="lead">Add the course to your home screen. It opens full screen, like an app.</p><div class="acts"><button class="btn orange" type="button" data-act="install">Install the app</button></div>';
    if (isIOS()) return '<p class="lead">On iPhone, add it from Safari:</p><ol><li>Tap the Share button ' + IC.share.replace('<svg', '<svg class="share"') + ' at the bottom of Safari.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. The course opens from its own icon, full screen.</li></ol><p class="note">In another browser on iPhone, open amrabdelgawad.site/course in Safari first.</p>';
    return '<p class="lead">On Android, open this page in Chrome. Tap the menu (three dots), then <b>Install app</b> or <b>Add to Home screen</b>.</p>';
  }
  function installCard(){
    let no = false; try { no = localStorage.getItem('ap-install-no') === '1'; } catch(e){}
    if (standalone() || no) return '';
    if (!deferredPrompt && !isIOS()) return '';
    return '<section class="card install" aria-labelledby="instH"><h2 class="sub" id="instH">Put the course on your home screen</h2>' + installSteps() +
      '<button class="link-btn" type="button" data-act="installNo" data-s="start">Not now</button></section>';
  }
  function installView(){
    mount(header({ back:'#/', backLabel:'Back to course home', title:'Install the app' }) +
      '<main id="main" class="col"><div class="page"><h1 class="display">On your home screen</h1><section class="card install">' + installSteps() + '</section></div></main>',
      { title:'Install', acts:{ install: () => promptInstall() } });
  }

  // ==================================================================
  // Menu
  // ==================================================================
  function openMenu(){
    const d = document.createElement('dialog');
    d.className = 'sheet'; d.setAttribute('aria-label', 'Course menu');
    d.innerHTML = '<div class="in"><div class="who"><b>' + esc((S.me && S.me.name) || (user && user.email) || '') + '</b><span>' + esc(user ? user.email : '') + '</span></div>' +
      '<a class="mi" href="#/">' + IC.home + 'Course home</a>' +
      (S.isAdmin ? '<a class="mi" href="#/admin">' + IC.users + 'Admin<span class="cnt" id="menuCnt"></span></a>' : '') +
      (standalone() ? '' : '<a class="mi" href="#/install">' + IC.install + 'Install the app</a>') +
      '<a class="mi" href="/app/">' + IC.app + 'Talents app</a>' +
      '<button class="mi" type="button" data-m="out">' + IC.out + 'Sign out</button>' +
      '<button class="mi" type="button" data-m="close">' + IC.close + 'Close</button></div>';
    document.body.appendChild(d);
    d.addEventListener('click', async e => {
      if (e.target === d) return d.close();
      const b = e.target.closest('a,[data-m]'); if (!b) return;
      if (b.dataset.m === 'out') { d.close(); await db.auth.signOut(); S = null; return start(); }
      d.close();
    });
    d.addEventListener('close', () => d.remove());
    d.showModal();
    if (S.isAdmin && window.CourseAdmin) window.CourseAdmin.waiting().then(n => { const c = d.querySelector('#menuCnt'); if (c && n) c.outerHTML = chip(n + ' waiting', 'warm').replace('class="chip', 'class="cnt chip'); }).catch(() => {});
  }

  // ==================================================================
  // Sign in, authenticator, no access
  // ==================================================================
  function signInView(err){
    mount('<main id="main" class="signin"><div class="box">' +
      '<div class="brand-mark" aria-hidden="true">AP</div>' +
      '<div class="stack" data-s="g6"><h1 class="display" data-s="fs34">Acquisitions Playbook</h1><p class="lead">Sign in with the email and password you use for the Talents app.</p></div>' +
      '<form id="signForm" novalidate><label>Email<input type="email" id="em" autocomplete="username" inputmode="email" required></label>' +
      '<label>Password<input type="password" id="pw" autocomplete="current-password" required></label>' +
      '<p class="err" id="signErr" role="alert">' + esc(err || '') + '</p>' +
      '<button class="btn dark lg" type="submit" id="signBtn">Sign in</button></form>' +
      '<p class="note">Forgot your password, or new here? Ask Amr for a sign-in link.</p></div></main>', { title:'Sign in' });
    $('signForm').addEventListener('submit', async e => {
      e.preventDefault();
      const em = $('em').value.trim(), pw = $('pw').value;
      if (!em.includes('@')) { $('signErr').textContent = 'Enter your email address.'; $('em').focus(); return; }
      if (!pw) { $('signErr').textContent = 'Enter your password.'; $('pw').focus(); return; }
      $('signBtn').setAttribute('aria-busy', 'true');
      const { error } = await db.auth.signInWithPassword({ email:em, password:pw });
      $('signBtn').removeAttribute('aria-busy');
      if (error) { $('pw').value = ''; $('signErr').textContent = /invalid/i.test(error.message) ? 'That email and password don’t match.' : /banned/i.test(error.message) ? 'Your access was switched off. Ask Amr if that’s a mistake.' : 'Couldn’t sign in. Check your connection and try again.'; return; }
      start();
    });
  }
  function mfaView(factors){
    mount('<main id="main" class="signin"><div class="box"><div class="brand-mark" aria-hidden="true">AP</div>' +
      '<div class="stack" data-s="g6"><h1 class="display" data-s="fs30">Authenticator code</h1><p class="lead">Enter the 6-digit code from your authenticator app.</p></div>' +
      '<form id="mfaForm" novalidate><label>Code<input type="text" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required></label>' +
      '<p class="err" id="mfaErr" role="alert"></p><button class="btn dark lg" type="submit" id="mfaBtn">Continue</button></form>' +
      '<button class="link-btn" type="button" data-act="out" data-s="start">Sign out</button></div></main>',
      { title:'Authenticator code', acts:{ out: async () => { await db.auth.signOut(); start(); } } });
    $('code').focus();
    $('mfaForm').addEventListener('submit', async e => {
      e.preventDefault();
      const code = $('code').value.replace(/\D/g, '');
      if (code.length !== 6) { $('mfaErr').textContent = 'Enter the 6-digit code from your app.'; return; }
      $('mfaBtn').setAttribute('aria-busy', 'true');
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId:factors[0].id, code });
      $('mfaBtn').removeAttribute('aria-busy');
      if (error) { $('mfaErr').textContent = 'That code didn’t work. Codes change every 30 seconds, so try the one showing now.'; $('code').select(); return; }
      start();
    });
  }
  function noAccessView(){
    mount('<main id="main" class="signin"><div class="box"><div class="brand-mark" aria-hidden="true">AP</div>' +
      '<h1 class="display" data-s="fs30">Not on the course yet</h1>' +
      '<p class="lead">You’re signed in as ' + esc(user.email) + ', but this account doesn’t have the Acquisitions course. Ask Amr to switch it on for you.</p>' +
      '<a class="btn line lg" href="/app/">Go to the Talents app</a><button class="link-btn" type="button" data-act="out" data-s="start">Sign out</button></div></main>',
      { title:'No access', acts:{ out: async () => { await db.auth.signOut(); start(); } } });
  }

  // ==================================================================
  // Router
  // ==================================================================
  async function route(){
    if (!S) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'admin') {
      if (!S.isAdmin || !window.CourseAdmin) { location.hash = '#/'; return; }
      return window.CourseAdmin.route(parts.slice(1));
    }
    if (parts[0] === 'install') return installView();
    if (parts[0] === 'locked') return lockedView(parseInt(parts[1], 10) || 2);
    if (parts[0] === 'm') {
      const mod = MOD(parts[1]);
      if (!mod) return msgView('That module isn’t here.', { header:header({ back:'#/', title:'Not found' }), link:['#/', 'Course home'] });
      if (!mod.open) return lockedView(mod.number);
      if (!parts[2]) return moduleView(mod);
      if (parts[2] === 'r') return resultView(mod, parts[3]);
      const e = find(mod, parts[3]);
      if (!e) return msgView('That lesson isn’t here.', { header:header({ back:'#/m/' + mod.id, title:'Not found' }), link:['#/m/' + mod.id, 'Back to Module ' + mod.number] });
      if (parts[2] === 'l' && e.it.type === 'lesson') return lessonView(mod, e);
      if (parts[2] === 'q' && e.it.quiz) {
        if (e.it.type === 'checkpoint' && !mod.checkpointOpen) { location.replace('#/m/' + mod.id + '/c/' + e.it.id); return; }
        if (Q && Q.attempt && Q.e.it.id === e.it.id && parts[4] !== 'new') return questionView();
        const openTry = qState(mod, e.it).open;
        // Start over only asks when there are answers to give up; an empty unfinished try is simply resumed
        if (parts[4] === 'new' && openTry && openTry.answered > 0 && parts[5] !== 'ok') return startOverView(mod, e);
        return quizStart(mod, e, parts[4] === 'new' && !(openTry && openTry.answered === 0));
      }
      if (parts[2] === 'c' && e.it.type === 'checkpoint') return checkpointView(mod, e);
      if (parts[2] === 'a' && e.it.type === 'assignment') return assignmentView(mod, e);
      return moduleView(mod);
    }
    homeView();
  }
  window.addEventListener('hashchange', () => { if (!/\/q\//.test(location.hash)) Q = null; route(); });

  async function start(){
    const { data:{ session } } = await db.auth.getSession();
    if (!session) { user = null; return signInView(); }
    user = session.user;
    try {
      const { data:aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data:f } = await db.auth.mfa.listFactors();
        const apps = ((f && f.totp) || []).filter(x => x.status === 'verified');
        if (apps.length) return mfaView(apps);
      }
    } catch(e){}
    try { await loadState(); }
    catch(e){
      if (/no access/.test(e.message || '')) return noAccessView();
      if (/JWT|expired|401/.test(e.message || '')) { await db.auth.signOut(); return signInView('Please sign in again.'); }
      return msgView(errText(e), { retry:true });
    }
    lastRoute = '';
    route();
  }

  // What admin.js needs
  window.CourseApp = { db, rpc, esc, IC, header, mount, msgView, chip, bar, pct, plural, when, dateTime, toast, errText, img, contentPath,
    get S(){ return S; }, get user(){ return user; }, refresh, loadState, entries, heading, inGroupLabel, shortLabel, hydrateImages };

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  start();
})();
