// Round 13 (plan round 4): one course home for all three courses, and Daily review for Marketing and Psychology too.
//   #coursehome/<acq|mkt|psy>  the same course home for every course: progress, Continue, and the outline
//   #daily                     Daily review now mixes Acquisitions (checked by the database) with Marketing and
//                              Psychology questions you missed (checked here, from the course content you can already open)
// Course content for Marketing and Psychology is downloaded once and kept on this device until it changes.
(function(){
  'use strict';
  const PX = window.PX;
  if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, plural, card, empty, failed, pill, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const uid = () => (T().user || {}).id;
  const page = PX.page;
  const today = () => isoDay(new Date());
  const en = v => v && typeof v === 'object' ? (v.en || Object.values(v)[0] || '') : (v || '');
  const COURSES = {
    acq:{ name:'Acquisitions Playbook', sub:'From the first call to a signed contract.', href:'/course/', key:'course' },
    mkt:{ name:'Marketing', sub:'From the first idea to running a full growth system.', href:'/app/course/', key:'mkt' },
    psy:{ name:'Psychology and Therapy', sub:'Foundations, therapy models, crisis skills, ethics and coaching practice.', href:'/app/psychology/', key:'psy' }
  };

  // ---------- course content, kept on this device until it changes ----------
  const mem = {};
  async function content(course){
    if (mem[course]) return mem[course];
    const bucket = db().storage.from('course-content');
    let stamp = '';
    try { const l = await bucket.list(course, { search:'content.json' }); const fl = (l.data || []).find(x => x.name === 'content.json'); stamp = fl ? (fl.updated_at || (fl.metadata || {}).lastModified || '') : ''; } catch(e) {}
    const key = '/_course-cache/' + course + '/' + encodeURIComponent(stamp || 'x');
    let cache = null; try { cache = await caches.open('course-content-v1'); } catch(e) {}
    if (cache && stamp) { try { const hit = await cache.match(key); if (hit) return (mem[course] = await hit.json()); } catch(e) {} }
    const x = await bucket.download(course + '/content.json');
    if (x.error || !x.data) throw x.error || new Error('no content');
    const text = await x.data.text(), json = JSON.parse(text);
    if (cache && stamp) { try { (await cache.keys()).filter(r => r.url.includes('/_course-cache/' + course + '/')).forEach(r => cache.delete(r)); await cache.put(key, new Response(text, { headers:{ 'Content-Type':'application/json' } })); } catch(e) {} }
    return (mem[course] = json);
  }
  async function canOpen(course){
    if (isOwner()) return true;
    const r = course === 'acq' ? await safe(db().rpc('course_has_access')) : await safe(db().rpc('learn_can_open', { p_course:course }));
    return r.data === true;
  }
  async function progress(course){
    const r = await safe(db().from('learn_progress').select('data').eq('user_id', uid()).eq('course', course === 'mkt' ? 'mkt2' : course).maybeSingle());
    return (r.data && r.data.data) || {};
  }

  // ======================================================================
  // One course home
  // ======================================================================
  V.coursehome = { title:'Course home', sec:'hub', async open(el, ok){
    const id = location.hash.split('/')[1] || 'acq', c = COURSES[id] || COURSES.acq;
    el.innerHTML = '<div class="p-wrap px"><nav class="lp-crumb" aria-label="Breadcrumb"><a href="/app/learn/">Learning Hub</a><span>/</span><span>' + esc(c.name) + '</span></nav>' +
      '<div class="lp-tabs">' + Object.entries(COURSES).map(([k, v]) => '<a href="#coursehome/' + k + '" class="wk-seg' + (k === id ? ' on' : '') + '">' + esc(v.name.split(' ')[0]) + '</a>').join('') + '</div><div class="px-body">' + PX.loading + '</div></div>';
    const body = el.querySelector('.px-body');
    if (!await canOpen(id)) { if (ok()) body.innerHTML = card(c.name, '', empty('This course isn’t open for you yet. Ask Amr to switch it on.')); return; }
    let mods = [], groups = null;
    try {
      if (id === 'acq') {
        const s = (await safe(db().rpc('course_state', { p_content:false }))).data || {};
        const quiz = s.quizzes || {};
        mods = (s.modules || []).map(m => { const done = (s.done || {})[m.id], n = Array.isArray(done) ? done.length : done && typeof done === 'object' ? Object.keys(done).length : 0;
          const passed = Object.keys(quiz).filter(k => k.startsWith(m.id + '/') && quiz[k].passed).length;
          return { id:m.id, n:m.number, title:m.title, desc:m.description, locked:!m.open, done:n || passed ? (passed ? passed + ' quiz' + (passed > 1 ? 'zes' : '') + ' passed' : n + ' done') : '', complete:false, href:'/course/#/m/' + m.id }; });
      } else if (id === 'mkt') {
        await loadScript('/app/course/marketing/course.js?v=20');
        const C = window.COURSE || {}, p = (await progress('mkt')).m || {};
        groups = C.stages || null;
        mods = (C.plan || []).map((m, i) => { const s = p[m.id] || {}, best = (s.quiz || {}).best || 0;
          return { id:m.id, n:i + 1, group:m.stage, title:m.t, locked:m.ready === false, complete:best >= (C.pass || 80), done:best >= (C.pass || 80) ? 'Quiz passed · ' + best + '%' : s.seen ? 'Started' + (best ? ' · best ' + best + '%' : '') : '', href:'/app/course/#/' + m.id }; });
      } else {
        const [k, pr] = await Promise.all([content('psy'), progress('psy')]);
        const kv = pr.kv || {};
        mods = (k.modules || []).map(m => { const items = (m.items || []).filter(i => i.type === 'section'), d = items.filter(i => kv['done:' + m.id + ':' + i.id]).length;
          return { id:m.id, n:m.num, code:m.code, title:en(m.title), desc:en(m.desc), complete:items.length && d === items.length, done:d ? d + ' of ' + items.length + ' sections' : '', href:'/app/psychology/#/' + m.id }; });
      }
    } catch(e) { if (ok()) body.innerHTML = failed(e); return; }
    if (!ok()) return;
    const total = mods.length, complete = mods.filter(m => m.complete).length, next = mods.find(m => !m.complete && !m.locked) || mods[0];
    const pct = total ? Math.round(complete / total * 100) : 0;
    const row = m => '<a class="lp-mod' + (m.complete ? ' is-done' : '') + (m.locked ? ' is-locked' : '') + '" href="' + esc(m.locked ? '#coursehome/' + id : m.href) + '"' + (m.locked ? ' aria-disabled="true"' : '') + '>' +
      '<span class="lp-num">' + (m.complete ? '✓' : esc(m.n != null ? m.n : '')) + '</span><span class="tp-row-t"><b>' + esc(m.title) + '</b><small>' + esc(m.locked ? 'Locked' : (m.done || 'Not started')) + '</small></span>' +
      (m === next ? pill('Next', '') : '') + '</a>';
    body.innerHTML = '<section class="p-hero lp-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">Course</span><h1>' + esc(c.name) + '</h1><p>' + esc(c.sub) + '</p>' +
      '<div class="lp-prog"><span class="lp-bar"><i style="width:' + pct + '%"></i></span><b>' + complete + ' of ' + total + ' modules · ' + pct + '%</b></div>' +
      (next ? '<a class="p-btn lp-go" href="' + esc(next.href) + '">' + (complete || next.done ? 'Continue: ' : 'Start: ') + esc(next.title) + '</a>' : '') + '</div></section>' +
      (groups ? groups.map((g, gi) => { const list = mods.filter(m => m.group === gi); return list.length ? card(g, plural(list.length, 'module'), '<div class="lp-list">' + list.map(row).join('') + '</div>') : ''; }).join('')
        : card('Outline', plural(total, 'module'), '<div class="lp-list">' + mods.map(row).join('') + '</div>')) +
      '<p class="tp-note">Lessons open in the course’s own reader. The portal menu stays, so you can always come back here.</p>';
  }};
  function loadScript(src){ return new Promise((res, rej) => { if (document.querySelector('script[data-src="' + src + '"]')) return res(); const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

  // ======================================================================
  // Daily review across all three courses
  // ======================================================================
  const GAPS = [1, 3, 7, 14, 30, 60];
  async function localCards(){
    const out = [], want = [];
    const [mOk, pOk] = await Promise.all([canOpen('mkt'), canOpen('psy')]);
    const rc = await safe(db().from('review_cards').select('*').eq('user_id', uid()).or('module_id.like.mkt:%,module_id.like.psy:%'));
    const have = {}; (rc.data || []).forEach(r => have[r.card] = r);
    if (mOk) {
      try {
        const [k, p] = await Promise.all([content('mkt'), progress('mkt')]);
        const mods = k.modules || {};
        Object.entries((p.m || {})).forEach(([mid, s]) => { const last = (s.quiz || {}).last; const m = mods[mid]; if (!last || !m || !Array.isArray(m.quiz)) return;
          (last.ok || []).forEach((good, i) => { const q = m.quiz[i]; if (good === false && q) want.push({ id:'mkt:' + mid + ':' + i, module_id:'mkt:' + mid, src:'Marketing ' + mid.replace(/^m0?/, 'module '),
            prompt:q.q, options:q.o.map((t, j) => ({ id:String(j), text:t })), correct:(q.c || []).map(String), multi:(q.c || []).length > 1, explain:q.why, missed:last.at }); }); });
      } catch(e) {}
    }
    if (pOk) {
      try {
        const [k, p] = await Promise.all([content('psy'), progress('psy')]);
        const kv = p.kv || {}, byId = {}; (k.modules || []).forEach(m => byId[m.id] = m);
        Object.keys(kv).filter(x => x.startsWith('qs:')).forEach(key => {
          const [, mid, qid, idx] = key.split(':'), v = String(kv[key]).split('|'); if (v[v.length - 1] !== '0') return;
          const m = byId[mid], it = m && (m.items || []).find(i => i.id === qid), list = it && it.exam && it.exam.q ? (it.exam.q.en || []) : [], q = list[+idx];
          if (q) want.push({ id:'psy:' + mid + ':' + qid + ':' + idx, module_id:'psy:' + mid, src:'Psychology ' + (m.code || mid), prompt:q.stem, options:q.opts.map((t, j) => ({ id:String(j), text:t })), correct:[String(q.ans)], multi:false, explain:q.fb, missed:+v[3] || null });
        });
      } catch(e) {}
    }
    const add = want.filter(w => !have[w.id]).map(w => ({ user_id:uid(), card:w.id, module_id:w.module_id, due_on:today(), missed_at:w.missed ? new Date(w.missed).toISOString() : null }));
    if (add.length) { await safe(db().from('review_cards').insert(add)); add.forEach(a => have[a.card] = a); }
    want.forEach(w => { const h = have[w.id]; if (h && h.due_on <= today()) out.push(Object.assign(w, { box:h.box || 0 })); });
    return { cards:out.slice(0, 20), total:Object.keys(have).length };
  }
  V.daily = { title:'Daily review', sec:'hub', async open(el, ok){
    const body = page(el, 'Learning', 'Daily review', 'Questions you missed in any course come back here. Get one right and it comes back later; miss it and it comes back tomorrow. A few minutes a day is enough.');
    const [r, loc] = await Promise.all([safe(db().rpc('portal_review_today')), localCards().catch(() => ({ cards:[], total:0 }))]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const d = r.data || {};
    const acq = (d.cards || []).map(c => ({ id:c.id, srv:true, src:'Acquisitions ' + String(c.module || '').replace(/^m/, 'module '), prompt:c.prompt, options:c.options || [], multi:c.type === 'multiple' || c.type === 'multi', missed:c.missed }));
    const cards = acq.concat(loc.cards);
    let i = 0, right = 0;
    const tiles = () => '<div class="px-tiles"><div class="px-tile"><b>' + (d.streak || 0) + (d.streak === 1 ? ' day' : ' days') + '</b>streak</div><div class="px-tile"><b>' + cards.length + '</b>cards today</div><div class="px-tile"><b>' + ((+d.total || 0)) + '</b>cards in total</div></div>';
    function show(){
      if (!cards.length) { body.innerHTML = tiles() + card('All done', '', empty(((+d.total || 0) + loc.total ? 'Nothing due today. ' : 'No cards yet. ') + 'Questions you miss in any course quiz are added here on their own.') + '<a class="p-btn is-ghost" href="/app/learn/">Back to the Learning Hub</a>'); return; }
      if (i >= cards.length) { body.innerHTML = tiles() + card('Done for today', right + ' of ' + cards.length + ' right', '<p class="wk-big">Nice work. The ones you missed come back tomorrow.</p><a class="p-btn" href="/app/learn/">Back to the Learning Hub</a>'); return; }
      const c = cards[i];
      body.innerHTML = tiles() + '<section class="p-card wk-rv"><p class="wk-rv-k">Card ' + (i + 1) + ' of ' + cards.length + (c.missed ? ' · missed on ' + esc(fmtDay(c.missed, { month:'short', day:'numeric' })) : '') + ' · ' + esc(c.src) + '</p>' +
        '<h2 class="wk-rv-q">' + esc(c.prompt) + '</h2>' + (c.multi ? '<p class="wk-rv-k">Pick every answer that is right.</p>' : '') +
        '<div class="wk-rv-opts" id="rvOpts">' + c.options.map(o => '<label class="wk-opt"><input type="' + (c.multi ? 'checkbox' : 'radio') + '" name="rv" value="' + esc(o.id) + '"><span>' + esc(o.text) + '</span></label>').join('') + '</div>' +
        '<div class="wk-row"><button class="p-btn" type="button" id="rvCheck">Check</button></div><div id="rvOut" role="status"></div></section>';
      $('rvCheck').addEventListener('click', async () => {
        const picks = [...body.querySelectorAll('#rvOpts input:checked')].map(x => x.value);
        if (!picks.length) return say('rvOut', 'Pick an answer first.');
        $('rvCheck').disabled = true;
        let a;
        if (c.srv) {
          const x = await safe(db().rpc('portal_review_answer', { p_card:c.id, p_picks:picks }));
          if (x.error) { $('rvCheck').disabled = false; return say('rvOut', errText(x, 'Couldn’t check it. Try again.')); }
          a = x.data || {};
        } else {
          const good = picks.length === c.correct.length && picks.every(p => c.correct.includes(p));
          a = { right:good, correct:c.correct, explain:c.explain };
          const box = good ? Math.min((c.box || 0) + 1, 6) : 0, due = new Date(); due.setDate(due.getDate() + (good ? GAPS[box - 1] : 1));
          await safe(db().from('review_cards').update({ box, due_on:isoDay(due), last_at:new Date().toISOString() }).eq('user_id', uid()).eq('card', c.id));
        }
        if (a.right) right++;
        body.querySelectorAll('#rvOpts label').forEach(l => { const v = l.querySelector('input').value; l.classList.toggle('is-right', (a.correct || []).includes(v)); l.classList.toggle('is-wrong', picks.includes(v) && !(a.correct || []).includes(v)); l.querySelector('input').disabled = true; });
        $('rvOut').innerHTML = '<p class="wk-rv-res ' + (a.right ? 'ok' : 'no') + '"><b>' + (a.right ? 'Right.' : 'Not this time.') + '</b> ' + (a.right ? 'This card comes back later.' : 'It comes back tomorrow.') + '</p>' +
          (a.explain && typeof a.explain === 'string' ? '<p class="wk-rv-why">' + esc(a.explain) + '</p>' : '') + '<button class="p-btn" type="button" id="rvNext">' + (i + 1 < cards.length ? 'Next card' : 'Finish') + '</button>';
        $('rvNext').addEventListener('click', () => { i++; show(); });
        $('rvNext').focus();
      });
    }
    show();
  }};
})();
