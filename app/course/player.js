// Course player (/app/course): a GoHighLevel-style course in the Marketing look.
// Routes: #/ home · #/m01 module overview · #/m01/2 part 1.2 · #/m01/assignment · #/m01/quiz · #/m01/results
// Each person's progress saves on the device at once and to the learn_progress table (course "mkt2"),
// so it follows them to other devices. Module n+1 opens once module n's checkpoint quiz is passed.
(function(){
  const C = window.COURSE, cfg = window.TRACKER_CONFIG || {};
  const OWNER_ONLY = true; // while the rebuild is in progress, only Amr sees this course
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const LV = { b:'Basic', a:'Applied', t:'Tough' };
  let db = null, uid = 'me', owner = false, asLearner = false;

  // ---------- saved progress ----------
  let D = { m:{} };
  const key = () => 'cp1:' + uid + ':' + C.id;
  const M = id => D.m[id] || (D.m[id] = { parts:{}, asg:{ ans:{} }, quiz:{ tries:0 } });
  const P = (id, i) => { const m = M(id); return m.parts[i] || (m.parts[i] = { qa:{} }); };
  let timer, noTable = false;
  function save(){
    D.at = Date.now();
    try { localStorage.setItem(key(), JSON.stringify(D)); } catch(e){}
    clearTimeout(timer); timer = setTimeout(push, 1200);
    bar();
  }
  async function push(){
    if (!db || noTable) return;
    const { error } = await db.from('learn_progress').upsert({ user_id:uid, course:C.id, data:D, updated_at:new Date().toISOString() });
    if (error && /learn_progress/.test(error.message || '')) noTable = true;
  }
  async function pull(){
    try { const d = JSON.parse(localStorage.getItem(key()) || 'null'); if (d && d.m) D = d; } catch(e){}
    if (!db) return;
    const { data:row, error } = await db.from('learn_progress').select('data').eq('user_id', uid).eq('course', C.id).maybeSingle();
    if (error) { if (/learn_progress/.test(error.message || '')) noTable = true; return; }
    if (row && row.data && row.data.m && (row.data.at || 0) > (D.at || 0)) { D = row.data; try { localStorage.setItem(key(), JSON.stringify(D)); } catch(e){} }
  }
  window.addEventListener('pagehide', () => { clearTimeout(timer); push(); });

  // ---------- course structure and progress ----------
  const built = () => C.plan.filter(p => C.modules[p.id]).map(p => C.modules[p.id]);
  const qCount = m => m.parts.reduce((a, p) => a + p.q.length, 0) + m.quiz.length;
  const items = m => [{ k:'overview', t:'Module overview' }].concat(m.parts.map((p, i) => ({ k:String(i + 1), t:p.t, n:m.n + '.' + (i + 1) })), [{ k:'assignment', t:'Written assignment' }, { k:'quiz', t:'Checkpoint quiz' }]);
  const passed = m => (M(m.id).quiz.best || 0) >= C.pass;
  function itemDone(m, k){
    const s = M(m.id);
    if (k === 'overview') return !!s.seen;
    if (k === 'assignment') return !!s.asg.done;
    if (k === 'quiz' || k === 'results') return passed(m);
    return !!(s.parts[+k - 1] && s.parts[+k - 1].got);
  }
  const modDone = m => items(m).filter(x => itemDone(m, x.k)).length;
  const qDone = m => m.parts.reduce((a, p, i) => a + Object.values((M(m.id).parts[i] || {}).qa || {}).filter(x => x.checked).length, 0);
  function isOpen(m){
    if (owner && !asLearner) return true;
    const list = C.plan.map(p => p.id), i = list.indexOf(m.id);
    if (i <= 0) return true;
    const prev = C.modules[list[i - 1]];
    return !!prev && passed(prev);
  }
  function bar(){
    const ms = built(), all = ms.reduce((a, m) => a + items(m).length, 0), done = ms.reduce((a, m) => a + modDone(m), 0);
    const pc = all ? Math.round(done / all * 100) : 0;
    $('cpProg').querySelector('i').style.width = pc + '%'; $('cpProg').querySelector('b').textContent = pc + '%';
  }

  // ---------- thumbnails: one 1280×720 template for the course, every module and every part ----------
  const ctx = document.createElement('canvas').getContext('2d');
  function wrap(text, size, max){
    ctx.font = `800 ${size}px "Bricolage Grotesque"`;
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  }
  function thumb(o){
    // Title: largest size that fits in 3 lines
    const max = o.num ? 820 : 1060; let size = 84, lines = wrap(o.title, size, max);
    while ((lines.length > 3 || lines.some(l => (ctx.measureText(l).width > max))) && size > 50) { size -= 4; lines = wrap(o.title, size, max); }
    const lh = Math.round(size * 1.08), top = 360 - (lines.length * lh) / 2 + size * .8;
    const grid = []; for (let x = 0; x <= 1280; x += 40) grid.push(`<path d="M${x} 0V720"/>`); for (let y = 0; y <= 720; y += 40) grid.push(`<path d="M0 ${y}H1280"/>`);
    return `<svg viewBox="0 0 1280 720" role="img" aria-label="${esc(o.kick + ': ' + o.title)}" xmlns="http://www.w3.org/2000/svg">
      <rect width="1280" height="720" fill="#14161B"/><g stroke="rgba(255,255,255,.045)" stroke-width="1">${grid.join('')}</g>
      <rect x="96" y="96" width="64" height="8" rx="4" fill="#FF5A1F" stroke="none"/>
      <text x="96" y="150" fill="#FF5A1F" stroke="none" font-family="Inter, sans-serif" font-weight="700" font-size="26" letter-spacing="4">${esc(o.kick.toUpperCase())}</text>
      ${o.num ? `<text x="1184" y="640" text-anchor="end" fill="#FF5A1F" stroke="none" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="230" opacity=".95">${esc(o.num)}</text>` : ''}
      <g fill="#FFFFFF" stroke="none" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="${size}">${lines.map((l, i) => `<text x="96" y="${Math.round(top + i * lh)}">${esc(l)}</text>`).join('')}</g>
      ${o.foot ? `<text x="96" y="636" fill="#B9BDC6" stroke="none" font-family="Inter, sans-serif" font-weight="500" font-size="28">${esc(o.foot)}</text>` : ''}
    </svg>`;
  }
  const modThumb = m => thumb({ kick:'Marketing · Module ' + m.n, num:String(m.n).padStart(2, '0'), title:m.t, foot:m.parts.length + ' parts · ' + qCount(m) + ' questions' });
  const partThumb = (m, i) => thumb({ kick:'Module ' + m.n + ' · Part ' + m.n + '.' + (i + 1), num:m.n + '.' + (i + 1), title:m.parts[i].t, foot:m.parts[i].mins + ' min · ' + m.parts[i].q.length + ' playbook questions' });

  // ---------- sidebar ----------
  const ICON = { done:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff"/></svg>',
    todo:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>', lock:'<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    chev:'<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>' };
  function side(here){
    const [mid, k] = here;
    let h = '<h2>Course content</h2>' + (owner ? `<label class="cp-sideview"><input type="checkbox" data-learner${asLearner ? ' checked' : ''}> View as learner (test the locks)</label>` : ''), st = -1;
    C.plan.forEach((p, i) => {
      if (p.stage !== st) { st = p.stage; h += `<div class="cp-stage">${esc(C.stages[st])}</div>`; }
      const m = C.modules[p.id], open = m && isOpen(m), on = p.id === mid;
      h += `<div class="cp-mod${on ? ' on open' : ''}" data-mod="${p.id}"><button type="button" aria-expanded="${on}"><span class="n">${i + 1}</span><span><b>${esc(p.t)}</b><small>${m ? (open ? modDone(m) + ' of ' + items(m).length + ' done' : 'Locked') : 'Being rebuilt'}</small></span>${ICON.chev}</button><div class="cp-items">`;
      if (!m) h += '<p class="cp-soon">This module is being rebuilt to the new standard.</p>';
      else items(m).forEach(x => {
        const done = itemDone(m, x.k), cur = on && (k || 'overview') === x.k || (on && k === 'results' && x.k === 'quiz');
        h += `<a class="cp-item${open ? '' : ' locked'}" href="#/${m.id}${x.k === 'overview' ? '' : '/' + x.k}"${cur ? ' aria-current="page"' : ''}><span class="st ${open ? (done ? 'done' : '') : 'lock'}">${open ? (done ? ICON.done : ICON.todo) : ICON.lock}</span><span>${x.n ? `<em>${x.n}</em>` : ''}${esc(x.t)}</span></a>`;
      });
      h += '</div></div>';
    });
    $('cpSide').innerHTML = h;
  }
  $('cpSide').addEventListener('change', e => { if (e.target.matches('[data-learner]')) { asLearner = e.target.checked; $('cpAsLearner').checked = asLearner; route(); } });
  $('cpSide').addEventListener('click', e => {
    const b = e.target.closest('.cp-mod > button'); if (b) { const box = b.parentElement; box.classList.toggle('open'); b.setAttribute('aria-expanded', box.classList.contains('open')); return; }
    if (e.target.closest('.cp-item')) menu(false);
  });
  function menu(on){ $('cpSide').classList.toggle('open', on); $('cpScrim').hidden = !on; $('cpMenu').setAttribute('aria-expanded', on); }
  $('cpMenu').addEventListener('click', () => menu(!$('cpSide').classList.contains('open')));
  $('cpScrim').addEventListener('click', () => menu(false));

  // ---------- pages ----------
  const srcChips = list => (list || []).map(s => C.sources[s] ? `<span class="chip src" title="${esc(C.sources[s].d)}">${esc(C.sources[s].t)}</span>` : '').join('');

  function home(){
    const ms = built(), next = ms.find(m => isOpen(m) && modDone(m) < items(m).length) || ms[0];
    const cs = C.case;
    let h = `<div class="cp-wrap">
      <section class="cp-hero"><span class="cp-thumb">${thumb({ kick:'Course', title:C.title, foot:C.plan.length + ' modules · from first idea to running a growth system' })}</span>
        <h1 class="cp-h1">${esc(C.title)}</h1><p class="cp-sub">${esc(C.sub)}</p>
        <div class="row">${next ? `<a class="btn" href="#/${next.id}">${modDone(next) ? 'Continue' : 'Start'} Module ${next.n}</a>` : ''}<span class="cp-meta"><span><b>${C.plan.length}</b> modules</span><span><b>${ms.length}</b> ready</span><span>Pass mark <b>${C.pass}%</b> on each checkpoint</span></span></div></section>
      <section class="cp-card cp-case"><span class="cp-kick">The case you’ll work on</span><h2>${esc(cs.main.name)}</h2><p class="cp-sub">${esc(cs.main.about)}</p>
        <dl>${cs.main.facts.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
        <p class="cp-sub"><b>Second case, for B2B:</b> ${esc(cs.b2b.about)}</p></section>`;
    let st = -1;
    C.plan.forEach((p, i) => {
      if (p.stage !== st) { if (st > -1) h += '</div>'; st = p.stage; h += `<h2 class="cp-stagehead">${esc(C.stages[st])}</h2><div class="cp-grid">`; }
      const m = C.modules[p.id];
      if (!m) { h += `<div class="cp-mcard soon"><span class="cp-thumb">${thumb({ kick:'Marketing · Module ' + (i + 1), num:String(i + 1).padStart(2, '0'), title:p.t, foot:'Being rebuilt' })}</span><h3>${esc(p.t)}</h3><span class="chip tag">Being rebuilt</span></div>`; return; }
      const open = isOpen(m), d = modDone(m), n = items(m).length;
      h += `<a class="cp-mcard${open ? '' : ' locked'}" href="#/${m.id}"><span class="cp-thumb">${modThumb(m)}</span><h3>${esc(m.t)}</h3>
        <p class="cp-meta"><span><b>${m.parts.length}</b> parts</span><span><b>${qCount(m)}</b> questions</span><span>${open ? d + ' of ' + n + ' done' : 'Locked'}</span></p><span class="pbar"><i style="width:${Math.round(d / n * 100)}%"></i></span></a>`;
    });
    return h + '</div></div>';
  }

  function locked(m){
    const prev = C.plan[C.plan.findIndex(p => p.id === m.id) - 1];
    return `<div class="cp-wrap"><span class="cp-thumb">${modThumb(m)}</span><div class="cp-card"><h1 class="cp-h1">Module ${m.n} is locked</h1>
      <p class="cp-sub">Pass the Module ${m.n - 1} checkpoint quiz (${C.pass}% or more) to open it.</p><p><a class="btn" href="#/${prev.id}/quiz">Go to the Module ${m.n - 1} checkpoint</a></p></div></div>`;
  }

  function overview(m){
    M(m.id).seen = true; save();
    const pq = m.parts.reduce((a, p) => a + p.q.length, 0);
    return `<div class="cp-wrap"><nav class="cp-crumb"><a href="#/">Marketing</a><span>›</span><span>Module ${m.n}</span></nav>
      <span class="cp-thumb">${modThumb(m)}</span>
      <span class="cp-kick">Module ${m.n} overview · ${esc(C.stages[m.stage])}</span><h1 class="cp-h1">${esc(m.t)}</h1>
      <div class="cp-card cp-cols"><div><h3>What it covers</h3><p class="cp-sub">${esc(m.covers)}</p><h3 style="margin-top:14px">Skill focus</h3><p class="cp-sub">${esc(m.skill)}</p></div>
        <div><h3>At a glance</h3><ul><li><b>${m.parts.length}</b> parts, each on its own page</li><li><b>${pq}</b> playbook questions (Basic, Applied, Tough)</li><li><b>1</b> written assignment with an answer key</li><li><b>${m.quiz.length}</b>-question checkpoint quiz, pass mark <b>${C.pass}%</b></li><li><b>${qCount(m)}</b> questions in total, about <b>${m.parts.reduce((a, p) => a + p.mins, 0)}</b> minutes of reading</li></ul></div></div>
      <div class="cp-card"><h3>By the end you can</h3><ul>${m.outcomes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="cp-card"><h3>Parts</h3><ol>${m.parts.map((p, i) => `<li><a href="#/${m.id}/${i + 1}">${m.n}.${i + 1} ${esc(p.t)}</a> <span class="cp-meta" style="display:inline">· ${p.mins} min · ${p.q.length} questions</span></li>`).join('')}</ol></div>
      ${foot(m, 'overview')}</div>`;
  }

  function part(m, i){
    const p = m.parts[i], s = P(m.id, i), done = Object.values(s.qa).filter(x => x.checked).length;
    const on = q => q.on === 'ex' ? 'Kestrel case' : (p.s[q.on] || {}).h || '';
    const cnt = l => p.q.filter(q => q.l === l).length, doneL = l => p.q.filter((q, j) => q.l === l && (s.qa[j] || {}).checked).length;
    const qs = p.q.map((q, j) => {
      const a = s.qa[j] || {};
      return `<div class="cp-q${a.checked ? ' done' : ''}" data-q="${j}" data-l="${q.l}"><div class="row"><span class="chip ${q.l}">${LV[q.l]}</span><span class="cp-meta">Question ${j + 1} of ${p.q.length}${on(q) ? ' · On: ' + esc(on(q)) : ''}</span></div>
        <p>${esc(q.q)}</p><textarea data-ans="${j}" placeholder="Type your answer, then check it" aria-label="Your answer"></textarea>
        <div class="row"><button class="btn" type="button" data-check="${j}">${a.checked ? 'Check again' : 'Check my answer'}</button></div>
        <div class="cp-fb" data-fb="${j}"${a.checked ? '' : ' hidden'}>${a.checked ? feedback(q, a.text || '', a.self) : ''}</div></div>`;
    }).join('');
    return `<div class="cp-wrap"><nav class="cp-crumb"><a href="#/">Marketing</a><span>›</span><a href="#/${m.id}">Module ${m.n}</a><span>›</span><span>Part ${m.n}.${i + 1}</span></nav>
      <span class="cp-thumb">${partThumb(m, i)}</span>
      <div><span class="cp-kick">Part ${m.n}.${i + 1} of ${m.n}.${m.parts.length} · ${p.mins} min</span><h1 class="cp-h1">${esc(p.t)}</h1></div>
      <div class="cp-tools"><span class="cp-meta"><span><b>${done}</b> of ${p.q.length} questions checked</span>${s.got ? '<span class="chip b">Got it ✓</span>' : ''}</span></div>
      <article class="cp-card cp-lesson"><div class="cp-page">
        ${p.s.map(x => `<section class="cp-sec"><h3>${esc(x.h)} ${srcChips(x.src)}</h3>${x.b}</section>`).join('')}
        <section class="cp-box case"><span class="cp-kick">Kestrel case</span>${p.ex}</section>
        ${p.b2b ? `<section class="cp-box"><span class="cp-kick">B2B angle · BrightLine</span>${p.b2b}</section>` : ''}
        <section class="cp-sec"><h3>Key terms</h3><dl class="cp-terms">${p.terms.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></section>
      </div></article>
      <section class="cp-qs"><div class="cp-qhead"><h2>Playbook questions</h2><span class="cp-meta">${p.q.length} questions, simple to toughest. <span class="chip b">Basic</span> know it cold · <span class="chip a">Applied</span> use it on real work · <span class="chip t">Tough</span> judgment calls and edge cases</span></div>
        <div class="cp-filter" role="group" aria-label="Show questions">${[['all', 'All', p.q.length, Object.values(s.qa).filter(x => x.checked).length], ['b', 'Basic', cnt('b'), doneL('b')], ['a', 'Applied', cnt('a'), doneL('a')], ['t', 'Tough', cnt('t'), doneL('t')]].map(([k, t, n, d]) => `<button type="button" data-lv="${k}" aria-pressed="${k === 'all'}">${t} <small>${d}/${n}</small></button>`).join('')}</div>${qs}</section>
      ${foot(m, String(i + 1))}</div>`;
  }

  // Type-and-check: the answer is checked for each key point, then the model answer and the why are shown
  const norm = s => ' ' + String(s).toLowerCase().replace(/[’‘`']/g, ' ').replace(/(\d),(?=\d)/g, '$1').replace(/[^a-z0-9.%\s]/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  function hit(ans, w){
    const t = norm(w).trim();
    if (w[0] === '=') return ans.includes(' ' + t + ' ');   // "=ad": whole word only
    if (/^[\d.]+%?$/.test(t)) return new RegExp('(^|[^\\d.])' + t.replace(/[.%]/g, m => '\\' + m) + '(?![\\d])').test(ans);
    return ans.includes(t);
  }
  function feedback(q, text, self){
    const ans = norm(text), hits = q.k.map(([label, any]) => [label, any.some(w => hit(ans, w))]), n = hits.filter(x => x[1]).length;
    return `<p><b>You covered ${n} of ${q.k.length} key points.</b></p><ul class="cp-keys">${hits.map(([l, h]) => `<li class="${h ? 'hit' : ''}">${esc(l)}</li>`).join('')}</ul>
      <div class="cp-model"><b>Model answer:</b> ${esc(q.a)}</div><p class="cp-why"><b>Why:</b> ${esc(q.why)}</p>
      <div class="row"><span class="cp-meta">How did you do?</span><button class="btn ${self === 'yes' ? 'ok' : 'ghost'}" type="button" data-self="yes" aria-pressed="${self === 'yes'}">I had it</button><button class="btn ghost" type="button" data-self="no" aria-pressed="${self === 'no'}">${self === 'no' ? 'Marked: review again' : 'Review again'}</button></div>`;
  }

  function assignment(m){
    const a = m.assignment, s = M(m.id).asg, total = a.rubric.reduce((x, r) => x + r[1], 0);
    const got = a.rubric.reduce((x, r, i) => x + (Number((s.score || {})[i]) || 0), 0);
    return `<div class="cp-wrap"><nav class="cp-crumb"><a href="#/">Marketing</a><span>›</span><a href="#/${m.id}">Module ${m.n}</a><span>›</span><span>Assignment</span></nav>
      <span class="cp-thumb">${thumb({ kick:'Module ' + m.n + ' · Written assignment', title:a.t, foot:a.tasks.length + ' tasks · answer key after you submit' })}</span>
      <div><span class="cp-kick">Module ${m.n} written assignment</span><h1 class="cp-h1">${esc(a.t)}</h1></div>
      <div class="cp-card">${a.brief}<ol>${a.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
      <article class="cp-card cp-lesson"><div class="cp-page">${a.tasks.map((t, i) => `<label class="cp-task"><span>${i + 1}. ${esc(t)}</span><textarea data-task="${i}"></textarea></label>`).join('')}
        <div class="row">${s.done ? '<span class="chip b">Submitted ✓</span>' : '<button class="btn" type="button" data-submit>Submit and show the answer key</button>'}</div></div></article>
      ${s.done ? `<div class="cp-card"><h2>Answer key</h2>${a.key}</div>
        <div class="cp-card"><h2>Mark yourself</h2><p class="cp-sub">Score each part against the answer key. 70 or more is a strong memo.</p>
          <table class="cp-rubric">${a.rubric.map(([c, pts], i) => `<tr><td>${esc(c)}</td><td><input type="number" min="0" max="${pts}" inputmode="numeric" data-score="${i}" value="${esc((s.score || {})[i] || '')}" aria-label="Score for ${esc(c)}"> / ${pts}</td></tr>`).join('')}
          <tr><td><b>Total</b></td><td><b data-total>${got}</b> / ${total}</td></tr></table></div>` : ''}
      ${foot(m, 'assignment')}</div>`;
  }

  // ---------- checkpoint quiz: one question at a time, instant feedback, results page ----------
  let Q = null; // the attempt in progress: { m, i, ans:[], order:[], shown }
  function shuffle(n, seed){ const a = [...Array(n).keys()]; let x = seed * 9301 + 49297; for (let i = n - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = Math.floor(x / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function quizStart(m){
    const s = M(m.id).quiz;
    return `<div class="cp-wrap"><nav class="cp-crumb"><a href="#/">Marketing</a><span>›</span><a href="#/${m.id}">Module ${m.n}</a><span>›</span><span>Checkpoint quiz</span></nav>
      <span class="cp-thumb">${thumb({ kick:'Module ' + m.n + ' · Checkpoint', title:'Checkpoint quiz: ' + m.t, foot:m.quiz.length + ' questions · pass mark ' + C.pass + '%' })}</span>
      <div class="cp-card cp-quiz"><h1 class="cp-h1">Checkpoint quiz</h1><p class="cp-sub">${m.quiz.length} questions on everything in Module ${m.n}. You’ll see right or wrong and the reason after each one. Score ${C.pass}% or more to ${m.n < C.plan.length ? 'open Module ' + (m.n + 1) : 'finish the course'}.</p>
        <p class="cp-meta"><span>Attempts: <b>${s.tries || 0}</b></span>${s.best != null ? `<span>Best: <b>${s.best}%</b></span>` : ''}${passed(m) ? '<span class="chip b">Passed ✓</span>' : ''}</p>
        <div class="row" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="button" data-qstart>${s.tries ? 'Retake the quiz' : 'Start the quiz'}</button>${s.last ? `<a class="btn ghost" href="#/${m.id}/results">See last results</a>` : ''}</div></div></div>`;
  }
  function quizQ(){
    const { m, i } = Q, q = m.quiz[i], multi = q.c.length > 1, order = Q.order[i], pick = Q.pick || [], shown = Q.shown;
    const right = new Set(q.c), ok = shown && pick.length === q.c.length && pick.every(x => right.has(x));
    return `<div class="cp-wrap"><div class="cp-card cp-quiz"><div class="cp-qcount"><span>Question ${i + 1} of ${m.quiz.length}</span><span>Module ${m.n} checkpoint</span></div>
      <span class="pbar"><i style="width:${Math.round(i / m.quiz.length * 100)}%"></i></span>
      <h2>${esc(q.q)}</h2>${multi ? '<span class="chip a" style="justify-self:start">Pick all that apply</span>' : ''}
      <div class="cp-opts" role="${multi ? 'group' : 'radiogroup'}">${order.map(j => {
        const sel = pick.includes(j), cls = shown ? (right.has(j) ? ' right' : sel ? ' wrong' : '') : sel ? ' sel' : '';
        return `<label class="cp-opt${cls}${shown ? ' locked' : ''}"><input type="${multi ? 'checkbox' : 'radio'}" name="qo" value="${j}"${sel ? ' checked' : ''}${shown ? ' disabled' : ''}><span>${esc(q.o[j])}</span></label>`; }).join('')}</div>
      ${shown ? `<div class="cp-verdict ${ok ? 'ok' : 'no'}"><b>${ok ? 'Correct' : 'Not quite'}</b><p>${ok ? '' : 'Right answer: ' + esc(q.c.map(x => q.o[x]).join(' + ')) + '. '}${esc(q.why)}</p></div>
        <button class="btn" type="button" data-qnext>${i + 1 < m.quiz.length ? 'Next question' : 'See my results'}</button>`
      : `<button class="btn" type="button" data-qsubmit${pick.length ? '' : ' disabled'}>Submit answer</button>`}</div></div>`;
  }
  function results(m){
    const s = M(m.id).quiz, L = s.last; if (!L) return quizStart(m);
    const pass = L.score >= C.pass, nx = C.plan[m.n] && C.modules[C.plan[m.n].id];
    return `<div class="cp-wrap"><nav class="cp-crumb"><a href="#/">Marketing</a><span>›</span><a href="#/${m.id}">Module ${m.n}</a><span>›</span><span>Results</span></nav>
      <div class="cp-card cp-quiz"><span class="cp-kick">Module ${m.n} checkpoint results</span><span class="cp-score" style="color:${pass ? 'var(--ok)' : 'var(--no)'}">${L.score}%</span>
        <h2>${!pass ? 'Not yet. You need ' + C.pass + '% to move on.' : nx ? 'Passed. Module ' + nx.n + ' is open.' : m.n < C.plan.length ? 'Passed. Module ' + (m.n + 1) + ' opens as soon as it’s published.' : 'Passed. You’ve finished the course.'}</h2>
        <p class="cp-meta"><span><b>${L.right}</b> of ${m.quiz.length} right</span><span>Best: <b>${s.best}%</b></span><span>Attempts: <b>${s.tries}</b></span></p>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ${pass ? 'ghost' : ''}" type="button" data-qstart>Retake the quiz</button>${pass ? (nx ? `<a class="btn" href="#/${nx.id}">Start Module ${nx.n}</a>` : `<a class="btn" href="#/">Back to the course</a>`) : `<a class="btn ghost" href="#/${m.id}">Review the module</a>`}</div></div>
      <div class="cp-card"><h2>Review</h2><ul class="cp-review">${m.quiz.map((q, i) => { const ok = L.ok[i]; return `<li class="${ok ? '' : 'no'}"><b>${ok ? '✓' : '✕'}</b> ${esc(q.q)}<br><span class="cp-why">${esc(q.why)}</span></li>`; }).join('')}</ul></div></div>`;
  }

  // ---------- footer: previous / mark complete / next across the whole course ----------
  function seq(){ const out = []; built().forEach(m => items(m).forEach(x => out.push([m, x.k]))); return out; }
  function foot(m, k){
    const all = seq(), i = all.findIndex(([a, b]) => a.id === m.id && b === k), prev = all[i - 1], next = all[i + 1];
    const href = x => '#/' + x[0].id + (x[1] === 'overview' ? '' : '/' + x[1]);
    const mid = /^\d+$/.test(k) ? `<button class="btn ${P(m.id, +k - 1).got ? 'ok' : ''}" type="button" data-got>${P(m.id, +k - 1).got ? 'Got it ✓' : 'Mark as got it'}</button>` : '';
    return `<nav class="cp-foot">${prev ? `<a class="btn ghost" href="${href(prev)}">← Previous</a>` : '<span></span>'}${mid}${next ? `<a class="btn ${mid ? 'ghost' : ''}" href="${href(next)}">Next →</a>` : '<span></span>'}</nav>`;
  }

  // ---------- render ----------
  let lastHash = null;
  function route(){
    const [mid, k] = location.hash.replace(/^#\/?/, '').split('/');
    const m = C.modules[mid];
    let html;
    if (!m) html = home();
    else if (!isOpen(m)) html = locked(m);
    else if (!k) html = overview(m);
    else if (k === 'assignment') html = assignment(m);
    else if (k === 'quiz') html = Q && Q.m === m ? quizQ() : quizStart(m);
    else if (k === 'results') html = results(m);
    else if (m.parts[+k - 1]) html = part(m, +k - 1);
    else html = overview(m);
    if (!(m && k === 'quiz' && Q && Q.m === m)) Q = null;
    const same = location.hash === lastHash, y = window.scrollY; lastHash = location.hash;
    $('cpMain').innerHTML = html; side([mid, k]); bar(); wire(m, k); if (!same) menu(false);
    window.scrollTo(0, same ? y : 0); Pen.mount(pageKey());
    document.title = (m ? 'Module ' + m.n + ' · ' : '') + 'Marketing course';
  }
  function show(){ const y = window.scrollY; $('cpMain').innerHTML = quizQ(); window.scrollTo(0, y); wire(Q.m, 'quiz'); Pen.mount(pageKey()); }
  const pageKey = () => location.hash.replace(/^#\/?/, '').replace(/\/(quiz|results)$/, '/$1') || 'home';

  let CUR = null; // the part on screen, for the self-mark buttons
  $('cpMain').addEventListener('click', e => {
    const b = e.target.closest('[data-self]'); if (!b || !CUR) return;
    const card = b.closest('.cp-q'), j = card.dataset.q, s = P(CUR.m.id, CUR.i), a = s.qa[j] = s.qa[j] || {};
    a.self = b.dataset.self; save(); card.querySelector('[data-fb]').innerHTML = feedback(CUR.m.parts[CUR.i].q[j], a.text || '', a.self);
  });
  function wire(m, k){
    const box = $('cpMain'); CUR = m && /^\d+$/.test(k || '') ? { m, i:+k - 1 } : null;
    if (m && /^\d+$/.test(k || '')) {
      const i = +k - 1, s = P(m.id, i), p = m.parts[i];
      box.querySelectorAll('[data-ans]').forEach(t => { const j = t.dataset.ans; t.value = (s.qa[j] || {}).text || ''; t.addEventListener('input', () => { (s.qa[j] = s.qa[j] || {}).text = t.value; save(); }); });
      box.querySelectorAll('[data-check]').forEach(b => b.addEventListener('click', () => {
        const j = b.dataset.check, a = s.qa[j] = s.qa[j] || {}, card = b.closest('.cp-q'), fb = card.querySelector('[data-fb]');
        if (!(a.text || '').trim()) { card.querySelector('textarea').focus(); card.querySelector('textarea').placeholder = 'Type your answer first, then check it'; return; }
        a.checked = true; save(); fb.hidden = false; fb.innerHTML = feedback(p.q[j], a.text, a.self); card.classList.add('done'); b.textContent = 'Check again'; counts();
      }));
      box.querySelectorAll('[data-lv]').forEach(f => f.addEventListener('click', () => {
        box.querySelectorAll('[data-lv]').forEach(x => x.setAttribute('aria-pressed', x === f));
        box.querySelectorAll('.cp-q').forEach(c => c.hidden = f.dataset.lv !== 'all' && c.dataset.l !== f.dataset.lv);
      }));
      const got = box.querySelector('[data-got]'); if (got) got.addEventListener('click', () => { s.got = !s.got; save(); route(); });
      const counts = () => { const n = Object.values(s.qa).filter(x => x.checked).length; const el = box.querySelector('.cp-tools .cp-meta b'); if (el) el.textContent = n; };
    }
    if (m && k === 'assignment') {
      const s = M(m.id).asg;
      box.querySelectorAll('[data-task]').forEach(t => { t.value = s.ans[t.dataset.task] || ''; t.addEventListener('input', () => { s.ans[t.dataset.task] = t.value; save(); }); });
      const sub = box.querySelector('[data-submit]'); if (sub) sub.addEventListener('click', () => {
        const empty = m.assignment.tasks.findIndex((t, i) => !(s.ans[i] || '').trim());
        if (empty > -1 && !confirm('Task ' + (empty + 1) + ' is empty. Submit anyway and see the answer key?')) return;
        s.done = true; save(); route();
      });
      box.querySelectorAll('[data-score]').forEach(inp => inp.addEventListener('input', () => {
        const max = +inp.max; let v = Math.max(0, Math.min(max, Number(inp.value) || 0)); if (inp.value !== '' && String(v) !== inp.value) inp.value = v;
        (s.score = s.score || {})[inp.dataset.score] = inp.value === '' ? '' : v; save();
        box.querySelector('[data-total]').textContent = m.assignment.rubric.reduce((x, r, i) => x + (Number(s.score[i]) || 0), 0);
      }));
    }
    if (m && (k === 'quiz' || k === 'results')) {
      const st = box.querySelector('[data-qstart]');
      if (st) st.addEventListener('click', () => { const s = M(m.id).quiz; Q = { m, i:0, ans:[], pick:[], shown:false, order:m.quiz.map((q, i) => shuffle(q.o.length, (s.tries || 0) * 31 + i + 7)) }; if (k !== 'quiz') location.hash = '#/' + m.id + '/quiz'; else show(); });
      if (Q && Q.m === m) {
        const q = m.quiz[Q.i];
        box.querySelectorAll('.cp-opt input').forEach(inp => inp.addEventListener('change', () => {
          const v = +inp.value; Q.pick = q.c.length > 1 ? (inp.checked ? [...Q.pick, v] : Q.pick.filter(x => x !== v)) : [v]; show();
        }));
        const sb = box.querySelector('[data-qsubmit]'); if (sb) sb.addEventListener('click', () => { Q.shown = true; Q.ans[Q.i] = Q.pick.slice(); show(); });
        const nx = box.querySelector('[data-qnext]'); if (nx) nx.addEventListener('click', () => {
          if (Q.i + 1 < m.quiz.length) { Q.i++; Q.pick = []; Q.shown = false; show(); window.scrollTo(0, 0); return; }
          const ok = m.quiz.map((q, i) => { const a = Q.ans[i] || []; return a.length === q.c.length && a.every(x => q.c.includes(x)); });
          const right = ok.filter(Boolean).length, score = Math.round(right / m.quiz.length * 100), s = M(m.id).quiz;
          s.tries = (s.tries || 0) + 1; s.last = { score, right, ok, at:Date.now() }; s.best = Math.max(s.best || 0, score); save();
          Q = null; location.hash = '#/' + m.id + '/results';
        });
      }
    }
  }

  // ---------- scratch pad: pen, highlighter and eraser over the whole page, margins included ----------
  // Points are stored against the content column (its centre line, its top, and its width as the unit),
  // so drawings scroll with the lesson and stay next to the same content, in the margins too.
  // Saved per person and per page (D.pg[page]).
  const Pen = (() => {
    const INKS = [['Black', '#14161B', 2.6], ['Red', '#DC2626', 2.6], ['Orange', '#FF5A1F', 2.6], ['Highlight', 'rgba(255,214,0,.45)', 20]];
    const main = $('cpMain'), btn = $('cpPen');
    let cv, c2, strokes = [], on = false, ink = 0, mode = 'draw', cur = null, key = null, ro;
    const col = () => main.querySelector('.cp-wrap') || main;
    function frame(){ const w = col(), r = main.getBoundingClientRect(), c = w.getBoundingClientRect(); return { cx:c.left - r.left + c.width / 2, top:c.top - r.top, u:Math.max(c.width, 1) }; }
    function size(){
      if (!cv) return; const dpr = window.devicePixelRatio || 1, w = main.clientWidth, h = main.clientHeight; // the canvas is positioned, so it never stretches main itself
      cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr; c2.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    }
    function line(s, f){ const [, colr, wd] = INKS[s.k]; c2.strokeStyle = colr; c2.lineWidth = wd; c2.lineCap = c2.lineJoin = 'round'; c2.beginPath();
      s.p.forEach(([x, y], i) => { const X = f.cx + x * f.u, Y = f.top + y * f.u; i ? c2.lineTo(X, Y) : c2.moveTo(X, Y); }); if (s.p.length === 1) c2.lineTo(f.cx + s.p[0][0] * f.u + .1, f.top + s.p[0][1] * f.u); c2.stroke(); }
    function draw(){ if (!cv) return; c2.clearRect(0, 0, cv.width, cv.height); const f = frame(); strokes.forEach(s => line(s, f)); }
    const pt = e => { const f = frame(), r = main.getBoundingClientRect(); return [Math.round((e.clientX - r.left - f.cx) / f.u * 1e4) / 1e4, Math.round((e.clientY - r.top - f.top) / f.u * 1e4) / 1e4]; };
    function rub(p){ const f = frame(); for (let i = strokes.length - 1; i >= 0; i--) if (strokes[i].p.some(([x, y]) => Math.hypot((x - p[0]) * f.u, (y - p[1]) * f.u) < 14)) { strokes.splice(i, 1); save(); draw(); return; } }
    function down(e){ if (!on || mode === 'scroll') return; e.preventDefault(); cv.setPointerCapture(e.pointerId); const p = pt(e); if (mode === 'erase') { cur = 'x'; rub(p); return; } cur = { k:ink, p:[p] }; strokes.push(cur); draw(); }
    function move(e){ if (!on || !cur) return; const p = pt(e); if (cur === 'x') return rub(p); cur.p.push(p); draw(); }
    function up(){ if (cur && cur !== 'x') save(); cur = null; }
    function apply(){
      if (!cv) return; const live = on && mode !== 'scroll';
      cv.style.pointerEvents = live ? 'auto' : 'none'; cv.style.touchAction = live ? 'none' : 'auto'; main.classList.toggle('cp-drawing', on);
      btn.setAttribute('aria-pressed', on); btn.lastChild.textContent = on ? ' Drawing' : ' Scratch pad'; tools.hidden = !on;
      tools.querySelectorAll('[data-ink]').forEach(b => b.setAttribute('aria-pressed', mode === 'draw' && +b.dataset.ink === ink));
      tools.querySelector('[data-mode="erase"]').setAttribute('aria-pressed', mode === 'erase'); tools.querySelector('[data-mode="scroll"]').setAttribute('aria-pressed', mode === 'scroll');
    }
    const tools = document.createElement('div'); tools.className = 'cp-pen'; tools.hidden = true; tools.setAttribute('role', 'toolbar'); tools.setAttribute('aria-label', 'Scratch pad tools');
    tools.innerHTML = INKS.map(([n, c], i) => `<button type="button" data-ink="${i}" style="--ink-c:${c}" aria-label="${n} pen" title="${n}"></button>`).join('') +
      '<button type="button" data-mode="erase">Eraser</button><button type="button" data-mode="scroll" title="Scroll the page without drawing">Scroll</button><button type="button" data-undo>Undo</button><button type="button" data-clear>Clear page</button><button type="button" data-done>Done</button>';
    document.body.appendChild(tools);
    tools.addEventListener('click', e => { const x = e.target.closest('button'); if (!x) return;
      if (x.dataset.ink) { ink = +x.dataset.ink; mode = 'draw'; }
      if (x.dataset.mode) mode = mode === x.dataset.mode ? 'draw' : x.dataset.mode;
      if (x.hasAttribute('data-undo') && strokes.length) { strokes.pop(); save(); draw(); }
      if (x.hasAttribute('data-clear') && strokes.length && confirm('Clear your drawings on this page?')) { strokes.length = 0; save(); draw(); }
      if (x.hasAttribute('data-done')) on = false;
      apply(); });
    btn.addEventListener('click', () => { on = !on; if (on) mode = 'draw'; apply(); });
    function mount(k){
      key = k; on = false; mode = 'draw'; if (ro) ro.disconnect();
      strokes = (D.pg = D.pg || {})[k] || (D.pg[k] = []);
      cv = document.createElement('canvas'); cv.className = 'cp-ink'; cv.setAttribute('aria-hidden', 'true'); c2 = cv.getContext('2d'); main.appendChild(cv);
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      ro = new ResizeObserver(size); ro.observe(main); ro.observe(col()); size(); apply();
    }
    return { mount };
  })();

  // ---------- start: sign-in and access ----------
  async function start(){
    const msg = t => { $('cpMain').innerHTML = `<div class="cp-msg cp-card"><p>${t}</p><p><a class="btn" href="/app/">Open my app</a></p></div>`; };
    if (window.COURSE_TEST) { uid = 'test'; owner = !!window.COURSE_TEST.owner; }
    else {
      if (!window.supabase || !/^https:\/\//.test(cfg.supabaseUrl || '')) return msg('This page couldn’t connect. Check your internet and refresh.');
      db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
      const { data:{ session } } = await db.auth.getSession();
      if (!session) return msg('Sign in to your app first, then open the course from the Learning Hub.');
      uid = session.user.id;
      const own = await db.rpc('is_tracker_admin'); owner = own.data === true;
      if (!owner) {
        if (OWNER_ONLY) return msg('This course is being rebuilt. It will open here when it’s ready.');
        const acc = await db.from('members').select('access').eq('user_id', uid).maybeSingle();
        if (!((acc.data && acc.data.access) || []).includes('learn')) return msg('Your account doesn’t have the Learning Hub yet. Ask Amr to switch it on for you.');
      }
    }
    await pull();
    if (owner) { $('cpView').hidden = false; $('cpAsLearner').addEventListener('change', e => { asLearner = e.target.checked; route(); }); }
    try { await Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 26px Inter')]); } catch(e){}
    window.addEventListener('hashchange', route); route();
  }
  start();
})();
