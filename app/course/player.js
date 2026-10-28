// Course player (/app/course): a GoHighLevel-style course in the Marketing look, in English and Arabic.
// Routes: #/ home · #/m01 module overview · #/m01/2 part 1.2 · #/m01/assignment · #/m01/quiz · #/m01/results
// Each person's progress saves on the device at once and to the learn_progress table (course "mkt2"),
// so it follows them to other devices. Module n+1 opens once module n's checkpoint quiz is passed.
// Progress (parts got, assignments, quizzes) is shared by both languages; typed answers and drawings are kept per language.
(function(){
  const C = window.COURSE, cfg = window.TRACKER_CONFIG || {}, UI = window.COURSE_UI;
  const OWNER_ONLY = false; // true hides the course from everyone but Amr
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let db = null, uid = 'me', owner = false, asLearner = false;

  // ---------- language ----------
  // lang: what the person chose. PL: the language of the page being drawn (English when a module isn't translated yet).
  let lang = 'en', PL = 'en';
  try { lang = localStorage.getItem('cp-lang') === 'ar' ? 'ar' : 'en'; } catch(e){}
  const t = (k, ...a) => { const v = (UI[PL] || UI.en)[k]; const x = v == null ? UI.en[k] : v; return typeof x === 'function' ? x(...a) : x; };
  const AR = C.ar || { modules:{} };
  const hasAr = m => !!(AR.modules && AR.modules[m.id]);
  const pageLang = m => lang === 'ar' && (!m || hasAr(m)) ? 'ar' : 'en';
  const planT = p => PL === 'ar' && AR.plan && AR.plan[p.id] || p.t;
  const stageT = i => PL === 'ar' && AR.stages ? AR.stages[i] : C.stages[i];
  // The module in the page's language: Arabic text laid over the English structure (levels, keys order, right answers, sources).
  const cache = {};
  function loc(m){
    if (PL !== 'ar' || !hasAr(m)) return m;
    if (cache[m.id]) return cache[m.id];
    const a = AR.modules[m.id], o = Object.assign({}, m, { t:a.t, skill:a.skill, covers:a.covers, outcomes:a.outcomes });
    o.parts = m.parts.map((p, i) => { const x = a.parts[i];
      return Object.assign({}, p, { t:x.t, ex:x.ex, b2b:x.b2b, terms:x.terms, s:p.s.map((s, j) => Object.assign({}, s, x.s[j])), q:p.q.map((q, j) => Object.assign({}, q, x.q[j])) }); });
    o.assignment = Object.assign({}, m.assignment, { t:a.assignment.t, brief:a.assignment.brief, tasks:a.assignment.tasks, key:a.assignment.key, rubric:m.assignment.rubric.map((r, i) => [a.assignment.rubric[i], r[1]]) });
    o.quiz = m.quiz.map((q, i) => Object.assign({}, q, a.quiz[i]));
    return cache[m.id] = o;
  }

  // ---------- saved progress ----------
  let D = { m:{} };
  const key = () => 'cp1:' + uid + ':' + C.id;
  const M = id => D.m[id] || (D.m[id] = { parts:{}, asg:{ ans:{} }, quiz:{ tries:0 } });
  const P = (id, i) => { const m = M(id); return m.parts[i] || (m.parts[i] = { qa:{} }); };
  const QA = (id, i) => { const s = P(id, i); return PL === 'ar' ? (s.qaAr = s.qaAr || {}) : s.qa; };           // typed answers, per language
  const ANS = id => { const s = M(id).asg; return PL === 'ar' ? (s.ansAr = s.ansAr || {}) : s.ans; };            // assignment answers, per language
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
  const items = m => { const L = loc(m); return [{ k:'overview', t:t('overviewItem') }].concat(L.parts.map((p, i) => ({ k:String(i + 1), t:p.t, n:m.n + '.' + (i + 1) })), [{ k:'assignment', t:t('asgItem') }, { k:'quiz', t:t('quizItem') }]); };
  const passed = m => (M(m.id).quiz.best || 0) >= C.pass;
  function itemDone(m, k){
    const s = M(m.id);
    if (k === 'overview') return !!s.seen;
    if (k === 'assignment') return !!s.asg.done;
    if (k === 'quiz' || k === 'results') return passed(m);
    return !!(s.parts[+k - 1] && s.parts[+k - 1].got);
  }
  const modDone = m => items(m).filter(x => itemDone(m, x.k)).length;
  function isOpen(m){
    if (owner && !asLearner) return true;
    const list = C.plan.map(p => p.id), i = list.indexOf(m.id);
    if (i <= 0) return true;
    const prev = C.modules[list[i - 1]];
    return !!prev && passed(prev);
  }
  function bar(){
    const ms = built(), all = ms.reduce((a, m) => a + m.parts.length + 3, 0), done = ms.reduce((a, m) => a + ['overview', 'assignment', 'quiz'].concat(m.parts.map((p, i) => String(i + 1))).filter(k => itemDone(m, k)).length, 0);
    const pc = all ? Math.round(done / all * 100) : 0;
    $('cpProg').querySelector('i').style.width = pc + '%'; $('cpProg').querySelector('b').textContent = pc + '%';
  }

  // ---------- thumbnails: one 1280×720 template for the course, every module and every part ----------
  const ctx = document.createElement('canvas').getContext('2d');
  const FONT = () => PL === 'ar' ? '"IBM Plex Sans Arabic"' : '"Bricolage Grotesque"';
  function wrap(text, size, max){
    ctx.font = `${PL === 'ar' ? 700 : 800} ${size}px ${FONT()}`;
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const s = line ? line + ' ' + w : w; if (ctx.measureText(s).width > max && line) { lines.push(line); line = w; } else line = s; }
    if (line) lines.push(line);
    return lines;
  }
  function thumb(o){
    const rtl = PL === 'ar', max = o.num ? 820 : 1060; let size = 84, lines = wrap(o.title, size, max);
    while ((lines.length > 3 || lines.some(l => (ctx.measureText(l).width > max))) && size > 50) { size -= 4; lines = wrap(o.title, size, max); }
    const lh = Math.round(size * (rtl ? 1.3 : 1.08)), top = 360 - (lines.length * lh) / 2 + size * .8;
    const grid = []; for (let x = 0; x <= 1280; x += 40) grid.push(`<path d="M${x} 0V720"/>`); for (let y = 0; y <= 720; y += 40) grid.push(`<path d="M0 ${y}H1280"/>`);
    const X = rtl ? 1184 : 96, dir = rtl ? ' direction="rtl"' : ' direction="ltr"', disp = rtl ? 'IBM Plex Sans Arabic, sans-serif' : 'Bricolage Grotesque, sans-serif', body = rtl ? 'IBM Plex Sans Arabic, sans-serif' : 'Inter, sans-serif';
    return `<svg viewBox="0 0 1280 720" role="img" aria-label="${esc(o.kick + ': ' + o.title)}" xmlns="http://www.w3.org/2000/svg">
      <rect width="1280" height="720" fill="#14161B"/><g stroke="rgba(255,255,255,.045)" stroke-width="1">${grid.join('')}</g>
      <rect x="${rtl ? 1120 : 96}" y="96" width="64" height="8" rx="4" fill="#FF5A1F" stroke="none"/>
      <text x="${X}" y="150"${dir} fill="#FF5A1F" stroke="none" font-family="${body}" font-weight="700" font-size="26"${rtl ? '' : ' letter-spacing="4"'}>${esc(rtl ? o.kick : o.kick.toUpperCase())}</text>
      ${o.num ? `<text x="${rtl ? 96 : 1184}" y="640" direction="ltr" text-anchor="${rtl ? 'start' : 'end'}" fill="#FF5A1F" stroke="none" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="230" opacity=".95">${esc(o.num)}</text>` : ''}
      <g fill="#FFFFFF" stroke="none" font-family="${disp}" font-weight="${rtl ? 700 : 800}" font-size="${size}">${lines.map((l, i) => `<text x="${X}" y="${Math.round(top + i * lh)}"${dir}>${esc(l)}</text>`).join('')}</g>
      ${o.foot ? `<text x="${X}" y="636"${dir} fill="#B9BDC6" stroke="none" font-family="${body}" font-weight="500" font-size="28">${esc(o.foot)}</text>` : ''}
    </svg>`;
  }
  const modTitle = m => PL === 'ar' && !hasAr(m) ? planT(C.plan.find(p => p.id === m.id)) : loc(m).t;
  const modThumb = m => thumb({ kick:t('modKick', m.n), num:String(m.n).padStart(2, '0'), title:modTitle(m), foot:m.parts.length + ' ' + t('parts') + ' · ' + qCount(m) + ' ' + t('questions') });
  const partThumb = (m, i) => thumb({ kick:t('module', m.n) + ' · ' + t('partCrumb', m.n + '.' + (i + 1)), num:m.n + '.' + (i + 1), title:loc(m).parts[i].t, foot:t('partLine', m.parts[i].mins, m.parts[i].q.length).replace(/^· /, '') });

  // ---------- sidebar ----------
  const ICON = { done:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff"/></svg>',
    todo:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>', lock:'<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    chev:'<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>' };
  function side(here){
    const [mid, k] = here, keep = PL; PL = lang;
    let h = '<h2>' + t('content') + '</h2>' + (owner ? `<label class="cp-sideview"><input type="checkbox" data-learner${asLearner ? ' checked' : ''}> ${t('asLearnerSide')}</label>` : ''), st = -1;
    C.plan.forEach((p, i) => {
      if (p.stage !== st) { st = p.stage; h += `<div class="cp-stage">${esc(stageT(st))}</div>`; }
      const m = C.modules[p.id], open = m && isOpen(m), on = p.id === mid;
      h += `<div class="cp-mod${on ? ' on open' : ''}" data-mod="${p.id}"><button type="button" aria-expanded="${on}"><span class="n">${i + 1}</span><span><b>${esc(m ? modTitle(m) : planT(p))}</b><small>${m ? (open ? t('ofDone', modDone(m), items(m).length) : t('locked')) : t('rebuilt')}</small></span>${ICON.chev}</button><div class="cp-items">`;
      if (!m) h += '<p class="cp-soon">' + t('rebuiltNote') + '</p>';
      else items(m).forEach(x => {
        const done = itemDone(m, x.k), cur = on && (k || 'overview') === x.k || (on && k === 'results' && x.k === 'quiz');
        h += `<a class="cp-item${open ? '' : ' locked'}" href="#/${m.id}${x.k === 'overview' ? '' : '/' + x.k}"${cur ? ' aria-current="page"' : ''}${lang === 'ar' && !hasAr(m) && x.n ? ' dir="auto"' : ''}><span class="st ${open ? (done ? 'done' : '') : 'lock'}">${open ? (done ? ICON.done : ICON.todo) : ICON.lock}</span><span>${x.n ? `<em>${x.n}</em>` : ''}${esc(x.t)}</span></a>`;
      });
      h += '</div></div>';
    });
    $('cpSide').innerHTML = h; PL = keep;
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
  const srcChips = list => (list || []).map(s => C.sources[s] ? `<span class="chip src" title="${esc(PL === 'ar' && AR.sources && AR.sources[s] || C.sources[s].d)}" dir="auto">${esc(PL === 'ar' && AR.sourceNames && AR.sourceNames[s] || C.sources[s].t)}</span>` : '').join('');
  const crumb = parts => `<nav class="cp-crumb"><a href="#/">${t('brand')}</a>${parts.map(p => `<span>${t('crumbSep')}</span>` + (p[1] ? `<a href="${p[1]}">${esc(p[0])}</a>` : `<span>${esc(p[0])}</span>`)).join('')}</nav>`;
  const caseT = () => PL === 'ar' && AR.case ? AR.case : C.case;

  function home(){
    const ms = built(), next = ms.find(m => isOpen(m) && modDone(m) < items(m).length) || ms[0];
    const cs = caseT(), title = PL === 'ar' && AR.title || C.title, sub = PL === 'ar' && AR.sub || C.sub;
    let h = `<div class="cp-wrap">
      <section class="cp-hero"><span class="cp-thumb">${thumb({ kick:t('courseKick'), title, foot:t('homeFoot', C.plan.length) })}</span>
        <h1 class="cp-h1">${esc(title)}</h1><p class="cp-sub">${esc(sub)}</p>
        <div class="row">${next ? `<a class="btn" href="#/${next.id}">${modDone(next) ? t('cont', next.n) : t('start', next.n)}</a>` : ''}<span class="cp-meta"><span><b>${C.plan.length}</b> ${t('modules')}</span><span><b>${ms.length}</b> ${t('ready')}</span><span>${t('passMark', C.pass)}</span></span></div></section>
      <section class="cp-card cp-case" data-a="case"><span class="cp-kick">${t('caseKick')}</span><h2>${esc(cs.main.name)}</h2><p class="cp-sub">${esc(cs.main.about)}</p>
        <dl>${cs.main.facts.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
        <p class="cp-sub"><b>${t('b2bCase')}</b> ${esc(cs.b2b.about)}</p></section>`;
    let st = -1;
    C.plan.forEach((p, i) => {
      if (p.stage !== st) { if (st > -1) h += '</div>'; st = p.stage; h += `<h2 class="cp-stagehead">${esc(stageT(st))}</h2><div class="cp-grid">`; }
      const m = C.modules[p.id];
      if (!m) { h += `<div class="cp-mcard soon"><span class="cp-thumb">${thumb({ kick:t('modKick', i + 1), num:String(i + 1).padStart(2, '0'), title:planT(p), foot:t('rebuilt') })}</span><h3>${esc(planT(p))}</h3><span class="chip tag">${t('rebuilt')}</span></div>`; return; }
      const open = isOpen(m), d = modDone(m), n = items(m).length;
      h += `<a class="cp-mcard${open ? '' : ' locked'}" href="#/${m.id}"><span class="cp-thumb">${modThumb(m)}</span><h3>${esc(modTitle(m))}</h3>
        <p class="cp-meta"><span><b>${m.parts.length}</b> ${t('parts')}</span><span><b>${qCount(m)}</b> ${t('questions')}</span><span>${open ? t('ofDone', d, n) : t('locked')}</span></p><span class="pbar"><i style="width:${Math.round(d / n * 100)}%"></i></span></a>`;
    });
    return h + '</div></div>';
  }

  function locked(m){
    const prev = C.plan[C.plan.findIndex(p => p.id === m.id) - 1];
    return `<div class="cp-wrap"><span class="cp-thumb">${modThumb(m)}</span><div class="cp-card"><h1 class="cp-h1">${t('lockedH', m.n)}</h1>
      <p class="cp-sub">${t('lockedP', m.n - 1, C.pass)}</p><p><a class="btn" href="#/${prev.id}/quiz">${t('lockedBtn', m.n - 1)}</a></p></div></div>`;
  }

  function overview(m){
    M(m.id).seen = true; save();
    const L = loc(m), pq = m.parts.reduce((a, p) => a + p.q.length, 0);
    return `<div class="cp-wrap">${crumb([[t('module', m.n)]])}
      <span class="cp-thumb">${modThumb(m)}</span>
      <span class="cp-kick">${t('ovKick', m.n, stageT(m.stage))}</span><h1 class="cp-h1" data-a="top">${esc(L.t)}</h1>
      <div class="cp-card cp-cols" data-a="ov"><div><h3>${t('covers')}</h3><p class="cp-sub">${esc(L.covers)}</p><h3 style="margin-top:14px">${t('skill')}</h3><p class="cp-sub">${esc(L.skill)}</p></div>
        <div><h3>${t('glance')}</h3><ul><li>${t('gl1', m.parts.length)}</li><li>${t('gl2', pq)}</li><li>${t('gl3')}</li><li>${t('gl4', m.quiz.length, C.pass)}</li><li>${t('gl5', qCount(m), m.parts.reduce((a, p) => a + p.mins, 0))}</li></ul></div></div>
      <div class="cp-card" data-a="out"><h3>${t('byEnd')}</h3><ul>${L.outcomes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="cp-card" data-a="parts"><h3>${t('partsH')}</h3><ol>${L.parts.map((p, i) => `<li><a href="#/${m.id}/${i + 1}">${m.n}.${i + 1} ${esc(p.t)}</a> <span class="cp-meta" style="display:inline">${t('partLine', p.mins, p.q.length)}</span></li>`).join('')}</ol></div>
      ${foot(m, 'overview')}</div>`;
  }

  function part(m, i){
    const L = loc(m), p = L.parts[i], s = P(m.id, i), qa = QA(m.id, i), done = Object.values(qa).filter(x => x.checked).length;
    const on = q => q.on === 'ex' ? t('caseBox') : (p.s[q.on] || {}).h || '';
    const cnt = l => p.q.filter(q => q.l === l).length, doneL = l => p.q.filter((q, j) => q.l === l && (qa[j] || {}).checked).length;
    const qs = p.q.map((q, j) => {
      const a = qa[j] || {};
      return `<div class="cp-q${a.checked ? ' done' : ''}" data-q="${j}" data-l="${q.l}" data-a="q${j}"><div class="row"><span class="chip ${q.l}">${t('lv')[q.l]}</span><span class="cp-meta">${t('qOf', j + 1, p.q.length)}${on(q) ? ' · ' + t('on') + esc(on(q)) : ''}</span></div>
        <p>${esc(q.q)}</p><textarea data-ans="${j}" placeholder="${esc(t('typeAns'))}" aria-label="${esc(t('yourAns'))}"></textarea>
        <div class="row"><button class="btn" type="button" data-check="${j}">${a.checked ? t('checkAgain') : t('check')}</button></div>
        <div class="cp-fb" data-fb="${j}"${a.checked ? '' : ' hidden'}>${a.checked ? feedback(q, a.text || '', a.self) : ''}</div></div>`;
    }).join('');
    return `<div class="cp-wrap">${crumb([[t('module', m.n), '#/' + m.id], [t('partCrumb', m.n + '.' + (i + 1))]])}
      <span class="cp-thumb">${partThumb(m, i)}</span>
      <div data-a="top"><span class="cp-kick">${t('partKick', m.n + '.' + (i + 1), m.n + '.' + m.parts.length, p.mins)}</span><h1 class="cp-h1">${esc(p.t)}</h1></div>
      <div class="cp-tools"><span class="cp-meta"><span>${t('checked', done, p.q.length)}</span>${s.got ? '<span class="chip b">' + t('gotIt') + '</span>' : ''}</span></div>
      <article class="cp-card cp-lesson"><div class="cp-page">
        ${p.s.map((x, j) => `<section class="cp-sec" data-a="s${j}"><h3>${esc(x.h)} ${srcChips(x.src)}</h3>${x.b}</section>`).join('')}
        <section class="cp-box case" data-a="ex"><span class="cp-kick">${t('caseBox')}</span>${p.ex}</section>
        ${p.b2b ? `<section class="cp-box" data-a="b2b"><span class="cp-kick">${t('b2bBox')}</span>${p.b2b}</section>` : ''}
        <section class="cp-sec" data-a="terms"><h3>${t('terms')}</h3><dl class="cp-terms">${p.terms.map(([a, b], j) => `<dt data-a="t${j}">${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></section>
      </div></article>
      <section class="cp-qs"><div class="cp-qhead" data-a="qs"><h2>${t('pbH')}</h2><span class="cp-meta">${t('pbBlurb', p.q.length)}</span></div>
        <div class="cp-filter" role="group" aria-label="${esc(t('showQs'))}">${[['all', t('all'), p.q.length, done], ['b', t('lv').b, cnt('b'), doneL('b')], ['a', t('lv').a, cnt('a'), doneL('a')], ['t', t('lv').t, cnt('t'), doneL('t')]].map(([k, l, n, d]) => `<button type="button" data-lv="${k}" aria-pressed="${k === 'all'}">${l} <small>${d}/${n}</small></button>`).join('')}</div>${qs}</section>
      ${foot(m, String(i + 1))}</div>`;
  }

  // ---------- type-and-check ----------
  // Folding makes spellings that mean the same match: أ إ آ ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي, no vowel marks or tatweel,
  // Arabic numerals → 0-9. The same folding is used by the course search.
  const FOLD = { 'أ':'ا', 'إ':'ا', 'آ':'ا', 'ٱ':'ا', 'ة':'ه', 'ى':'ي', 'ؤ':'و', 'ئ':'ي', '٫':'.', '٬':',', '٪':'%', '،':',', '’':"'", '‘':"'", '`':"'" };
  function foldChar(ch){
    const l = ch.toLowerCase(), c = l.charCodeAt(0);
    if ((c >= 0x64B && c <= 0x65F) || c === 0x670 || c === 0x640) return '';
    if (c >= 0x660 && c <= 0x669) return String(c - 0x660);
    if (c >= 0x6F0 && c <= 0x6F9) return String(c - 0x6F0);
    return FOLD[l] || l;
  }
  const fold = s => { let o = ''; for (const ch of String(s)) o += foldChar(ch); return o; };
  const norm = s => ' ' + fold(s).replace(/'/g, ' ').replace(/(\d),(?=\d)/g, '$1').replace(/[^a-z0-9.%\sء-ي]/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  // An answer that is only filler earns nothing; neither does a bare verdict with no reason ("yes", "no", "لا").
  const BLANK = / (i )?(don t|do not) know | no idea | not sure | (انا )?(مش عارف|معرفش|ماعرفش|مش متاكد|لا اعرف|مش فاكر|معنديش فكره) /g;
  const VERDICT = /^ (yes|no|yeah|yep|nope|nah|not really|maybe|true|false|correct|نعم|لا|اه|ايوه|ايوا|اكيد|لا طبعا|ممكن)( (yes|no|لا|نعم))? $/;
  function hit(ans, w){
    const s = norm(w).trim();
    if (!s) return false;                                    // a key of only symbols never matches
    if (w[0] === '=') return ans.includes(' ' + s + ' ');   // "=ad": whole word only
    if (/^[\d.]+%?$/.test(s)) return new RegExp('(^|[^\\d.])' + s.replace(/[.%]/g, m => '\\' + m) + '(?![\\d])').test(ans);
    return ans.includes(s);
  }
  function feedback(q, text, self){
    const raw = norm(text), core = raw.replace(BLANK, ' ').replace(/\s+/g, ' ');
    const ans = core.trim() && !VERDICT.test(core) ? raw : ' ';
    const hits = q.k.map(([label, any]) => [label, any.some(w => hit(ans, w))]), n = hits.filter(x => x[1]).length;
    return `<p><b>${t('covered', n, q.k.length)}</b></p><ul class="cp-keys">${hits.map(([l, h]) => `<li class="${h ? 'hit' : ''}">${esc(l)}</li>`).join('')}</ul>
      <div class="cp-model"><b>${t('model')}</b> ${esc(q.a)}</div><p class="cp-why"><b>${t('why')}</b> ${esc(q.why)}</p>
      <div class="row"><span class="cp-meta">${t('how')}</span><button class="btn ${self === 'yes' ? 'ok' : 'ghost'}" type="button" data-self="yes" aria-pressed="${self === 'yes'}">${t('hadIt')}</button><button class="btn ghost" type="button" data-self="no" aria-pressed="${self === 'no'}">${self === 'no' ? t('reviewMarked') : t('review')}</button></div>`;
  }

  function assignment(m){
    const a = loc(m).assignment, s = M(m.id).asg, total = a.rubric.reduce((x, r) => x + r[1], 0);
    const got = a.rubric.reduce((x, r, i) => x + (Number((s.score || {})[i]) || 0), 0);
    return `<div class="cp-wrap">${crumb([[t('module', m.n), '#/' + m.id], [t('asgCrumb')]])}
      <span class="cp-thumb">${thumb({ kick:t('asgKick', m.n), title:a.t, foot:t('asgFoot', a.tasks.length) })}</span>
      <div data-a="top"><span class="cp-kick">${t('asgTitleKick', m.n)}</span><h1 class="cp-h1">${esc(a.t)}</h1></div>
      <div class="cp-card" data-a="brief">${a.brief}<ol>${a.tasks.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <article class="cp-card cp-lesson"><div class="cp-page">${a.tasks.map((x, i) => `<label class="cp-task" data-a="task${i}"><span>${i + 1}. ${esc(x)}</span><textarea data-task="${i}"></textarea></label>`).join('')}
        <div class="row">${s.done ? '<span class="chip b">' + t('submitted') + '</span>' : '<button class="btn" type="button" data-submit>' + t('submit') + '</button>'}</div></div></article>
      ${s.done ? `<div class="cp-card" data-a="key"><h2>${t('key')}</h2>${a.key}</div>
        <div class="cp-card"><h2>${t('markSelf')}</h2><p class="cp-sub">${t('markSelfP')}</p>
          <table class="cp-rubric">${a.rubric.map(([c, pts], i) => `<tr><td>${esc(c)}</td><td><input type="number" min="0" max="${pts}" inputmode="numeric" data-score="${i}" value="${esc((s.score || {})[i] || '')}" aria-label="${esc(t('scoreFor', c))}"> / ${pts}</td></tr>`).join('')}
          <tr><td><b>${t('total')}</b></td><td><b data-total>${got}</b> / ${total}</td></tr></table></div>` : ''}
      ${foot(m, 'assignment')}</div>`;
  }

  // ---------- checkpoint quiz: one question at a time, instant feedback, results page ----------
  let Q = null; // the attempt in progress: { m, i, ans:[], order:[], shown }
  function shuffle(n, seed){ const a = [...Array(n).keys()]; let x = seed * 9301 + 49297; for (let i = n - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = Math.floor(x / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function quizStart(m){
    const s = M(m.id).quiz, L = loc(m);
    return `<div class="cp-wrap">${crumb([[t('module', m.n), '#/' + m.id], [t('quizCrumb')]])}
      <span class="cp-thumb">${thumb({ kick:t('quizKick', m.n), title:t('quizThumb', L.t), foot:t('quizFoot', m.quiz.length, C.pass) })}</span>
      <div class="cp-card cp-quiz" data-a="top"><h1 class="cp-h1">${t('quiz')}</h1><p class="cp-sub">${t('quizDesc', m.quiz.length, m.n, C.pass, m.n >= C.plan.length)}</p>
        <p class="cp-meta"><span>${t('tries')}: <b>${s.tries || 0}</b></span>${s.best != null ? `<span>${t('best')}: <b>${s.best}%</b></span>` : ''}${passed(m) ? '<span class="chip b">' + t('passedChip') + '</span>' : ''}</p>
        <div class="row" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="button" data-qstart>${s.tries ? t('retake') : t('startQuiz')}</button>${s.last ? `<a class="btn ghost" href="#/${m.id}/results">${t('lastRes')}</a>` : ''}</div></div></div>`;
  }
  function quizQ(){
    const { m, i } = Q, q = loc(m).quiz[i], multi = q.c.length > 1, order = Q.order[i], pick = Q.pick || [], shown = Q.shown;
    const right = new Set(q.c), ok = shown && pick.length === q.c.length && pick.every(x => right.has(x));
    return `<div class="cp-wrap"><div class="cp-card cp-quiz" data-a="top"><div class="cp-qcount"><span>${t('qCount', i + 1, m.quiz.length)}</span><span>${t('modCheck', m.n)}</span></div>
      <span class="pbar"><i style="width:${Math.round(i / m.quiz.length * 100)}%"></i></span>
      <h2>${esc(q.q)}</h2>${multi ? '<span class="chip a" style="justify-self:start">' + t('pickAll') + '</span>' : ''}
      <div class="cp-opts" role="${multi ? 'group' : 'radiogroup'}">${order.map(j => {
        const sel = pick.includes(j), cls = shown ? (right.has(j) ? ' right' : sel ? ' wrong' : '') : sel ? ' sel' : '';
        return `<label class="cp-opt${cls}${shown ? ' locked' : ''}"><input type="${multi ? 'checkbox' : 'radio'}" name="qo" value="${j}"${sel ? ' checked' : ''}${shown ? ' disabled' : ''}><span>${esc(q.o[j])}</span></label>`; }).join('')}</div>
      ${shown ? `<div class="cp-verdict ${ok ? 'ok' : 'no'}"><b>${ok ? t('correct') : t('notQuite')}</b><p>${ok ? '' : t('rightAns') + esc(q.c.map(x => q.o[x]).join(' + ')) + '. '}${esc(q.why)}</p></div>
        <button class="btn" type="button" data-qnext>${i + 1 < m.quiz.length ? t('nextQ') : t('seeRes')}</button>`
      : `<button class="btn" type="button" data-qsubmit${pick.length ? '' : ' disabled'}>${t('submitAns')}</button>`}</div></div>`;
  }
  function results(m){
    const s = M(m.id).quiz, last = s.last; if (!last) return quizStart(m);
    const L = loc(m), pass = last.score >= C.pass, nx = C.plan[m.n] && C.modules[C.plan[m.n].id];
    return `<div class="cp-wrap">${crumb([[t('module', m.n), '#/' + m.id], [t('resCrumb')]])}
      <div class="cp-card cp-quiz" data-a="top"><span class="cp-kick">${t('resKick', m.n)}</span><span class="cp-score" style="color:${pass ? 'var(--ok)' : 'var(--no)'}">${last.score}%</span>
        <h2>${!pass ? t('notYet', C.pass) : nx ? t('passOpen', nx.n) : m.n < C.plan.length ? t('passSoon', m.n + 1) : t('passDone')}</h2>
        <p class="cp-meta"><span>${t('ofRight', last.right, m.quiz.length)}</span><span>${t('best')}: <b>${s.best}%</b></span><span>${t('tries')}: <b>${s.tries}</b></span></p>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ${pass ? 'ghost' : ''}" type="button" data-qstart>${t('retake')}</button>${pass ? (nx ? `<a class="btn" href="#/${nx.id}">${t('startMod', nx.n)}</a>` : `<a class="btn" href="#/">${t('backCourse')}</a>`) : `<a class="btn ghost" href="#/${m.id}">${t('reviewMod')}</a>`}</div></div>
      <div class="cp-card" data-a="review"><h2>${t('reviewH')}</h2><ul class="cp-review">${L.quiz.map((q, i) => { const ok = last.ok[i]; return `<li class="${ok ? '' : 'no'}"><b>${ok ? '✓' : '✕'}</b> ${esc(q.q)}<br><span class="cp-why">${esc(q.why)}</span></li>`; }).join('')}</ul></div></div>`;
  }

  // ---------- footer: previous / mark complete / next across the whole course ----------
  function seq(){ const out = []; built().forEach(m => ['overview'].concat(m.parts.map((p, i) => String(i + 1)), ['assignment', 'quiz']).forEach(k => out.push([m, k]))); return out; }
  function foot(m, k){
    const all = seq(), i = all.findIndex(([a, b]) => a.id === m.id && b === k), prev = all[i - 1], next = all[i + 1];
    const href = x => '#/' + x[0].id + (x[1] === 'overview' ? '' : '/' + x[1]);
    const mid = /^\d+$/.test(k) ? `<button class="btn ${P(m.id, +k - 1).got ? 'ok' : ''}" type="button" data-got>${P(m.id, +k - 1).got ? t('gotIt') : t('markGot')}</button>` : '';
    return `<nav class="cp-foot">${prev ? `<a class="btn ghost" href="${href(prev)}">${t('prev')}</a>` : '<span></span>'}${mid}${next ? `<a class="btn ${mid ? 'ghost' : ''}" href="${href(next)}">${t('next')}</a>` : '<span></span>'}</nav>`;
  }

  // ---------- render ----------
  let lastHash = null, jump = null;
  function route(){
    const [mid, k] = location.hash.replace(/^#\/?/, '').split('/');
    const m = C.modules[mid];
    PL = pageLang(m);
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
    if (lang === 'ar' && PL === 'en') html = `<p class="cp-trans" lang="ar" dir="rtl">${UI.ar.untranslated}</p>` + html;
    const same = location.hash === lastHash, y = window.scrollY; lastHash = location.hash;
    const main = $('cpMain'); main.lang = PL; main.dir = PL === 'ar' ? 'rtl' : 'ltr';
    main.innerHTML = html; side([mid, k]); bar(); wire(m, k); if (!same) menu(false);
    window.scrollTo(0, same ? y : 0); Pen.mount(pageKey());
    document.title = (m ? t('module', m.n) + ' · ' : '') + t('docTitle');
    if (jump) { const j = jump; jump = null; requestAnimationFrame(() => land(j)); }
  }
  function show(){ const y = window.scrollY; PL = pageLang(Q.m); $('cpMain').innerHTML = quizQ(); window.scrollTo(0, y); wire(Q.m, 'quiz'); Pen.mount(pageKey()); }
  const pageKey = () => (location.hash.replace(/^#\/?/, '') || 'home') + (PL === 'ar' ? '@ar' : '');   // drawings are kept per language

  let CUR = null; // the part on screen, for the self-mark buttons
  $('cpMain').addEventListener('click', e => {
    const b = e.target.closest('[data-self]'); if (!b || !CUR) return;
    const card = b.closest('.cp-q'), j = card.dataset.q, qa = QA(CUR.m.id, CUR.i), a = qa[j] = qa[j] || {};
    a.self = b.dataset.self; save(); card.querySelector('[data-fb]').innerHTML = feedback(loc(CUR.m).parts[CUR.i].q[j], a.text || '', a.self);
  });
  function wire(m, k){
    const box = $('cpMain'); CUR = m && /^\d+$/.test(k || '') ? { m, i:+k - 1 } : null;
    if (m && /^\d+$/.test(k || '') && m.parts[+k - 1]) {
      const i = +k - 1, s = P(m.id, i), qa = QA(m.id, i), p = loc(m).parts[i];
      box.querySelectorAll('[data-ans]').forEach(x => { const j = x.dataset.ans; x.value = (qa[j] || {}).text || ''; x.addEventListener('input', () => { (qa[j] = qa[j] || {}).text = x.value; save(); }); });
      box.querySelectorAll('[data-check]').forEach(b => b.addEventListener('click', () => {
        const j = b.dataset.check, a = qa[j] = qa[j] || {}, card = b.closest('.cp-q'), fb = card.querySelector('[data-fb]');
        if (!(a.text || '').trim()) { card.querySelector('textarea').focus(); card.querySelector('textarea').placeholder = t('typeFirst'); return; }
        a.checked = true; save(); fb.hidden = false; fb.innerHTML = feedback(p.q[j], a.text, a.self); card.classList.add('done'); b.textContent = t('checkAgain'); counts();
      }));
      box.querySelectorAll('[data-lv]').forEach(f => f.addEventListener('click', () => {
        box.querySelectorAll('[data-lv]').forEach(x => x.setAttribute('aria-pressed', x === f));
        box.querySelectorAll('.cp-q').forEach(c => c.hidden = f.dataset.lv !== 'all' && c.dataset.l !== f.dataset.lv);
      }));
      const got = box.querySelector('[data-got]'); if (got) got.addEventListener('click', () => { s.got = !s.got; save(); route(); });
      const counts = () => { const n = Object.values(qa).filter(x => x.checked).length; const el = box.querySelector('.cp-tools .cp-meta b'); if (el) el.textContent = n; };
    }
    if (m && k === 'assignment') {
      const s = M(m.id).asg, ans = ANS(m.id);
      box.querySelectorAll('[data-task]').forEach(x => { x.value = ans[x.dataset.task] || ''; x.addEventListener('input', () => { ans[x.dataset.task] = x.value; save(); }); });
      const sub = box.querySelector('[data-submit]'); if (sub) sub.addEventListener('click', () => {
        const empty = m.assignment.tasks.findIndex((x, i) => !(ans[i] || '').trim());
        if (empty > -1 && !confirm(t('emptyTask', empty + 1))) return;
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

  // ---------- language switch: swaps the page in place, keeping your spot ----------
  function chrome(){
    const keep = PL; PL = lang;
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    $('cpLangs').setAttribute('aria-label', t('langGroup'));
    $('cpBack').textContent = t('back'); $('cpBack').setAttribute('aria-label', t('back'));
    $('cpProg').title = t('progress'); $('cpViewText').textContent = ' ' + t('asLearner');
    $('cpQ').placeholder = t('find'); $('cpQ').setAttribute('aria-label', t('find')); $('cpFindBtn').setAttribute('aria-label', t('findBtn'));
    $('cpBrandName').textContent = t('brand');
    Pen.label(); PL = keep;
  }
  function setLang(l){
    if (l === lang) return;
    const spot = (() => { for (const el of $('cpMain').querySelectorAll('[data-a]')) { const r = el.getBoundingClientRect(); if (r.bottom > 70) return { a:el.dataset.a, off:r.top }; } return null; })();
    lang = l; try { localStorage.setItem('cp-lang', l); } catch(e){}
    D.lang = l; save(); chrome(); closeFind();
    if (Q) { show(); } else { lastHash = location.hash; route(); }
    if (spot) { const el = $('cpMain').querySelector(`[data-a="${spot.a}"]`); if (el) window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - spot.off); }
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  // ---------- course search: glossary terms first, then lessons, cases and questions ----------
  const idx = {};
  function textOf(html){ const d = document.createElement('div'); d.innerHTML = html.replace(/</g, ' <'); return d.textContent.replace(/\s+/g, ' ').trim(); }
  function entry(list, o){ o.text = o.text.replace(/\s+/g, ' ').trim(); o.f = fold(o.text); o.ft = fold(o.title); list.push(o); }
  function buildIndex(){
    const keep = PL, list = [];
    PL = lang; const cs = caseT();
    entry(list, { mid:'', k:'', a:'case', kind:'home', title:cs.main.name, where:t('caseKick'), text:cs.main.facts.map(f => f.join(': ')).join('. '), w:1 });
    built().forEach(m => {
      PL = pageLang(m); const L = loc(m), mk = t('module', m.n);
      entry(list, { mid:m.id, k:'', a:'top', kind:'mod', title:L.t, where:mk, text:L.t + '. ' + L.covers + '. ' + L.skill, w:2 });
      L.parts.forEach((p, i) => {
        const pk = String(i + 1), where = m.n + '.' + pk + ' ' + p.t;
        entry(list, { mid:m.id, k:pk, a:'top', kind:'part', title:p.t, where:mk + ' · ' + m.n + '.' + pk, text:p.t, w:2 });
        p.terms.forEach(([a, b], j) => entry(list, { mid:m.id, k:pk, a:'t' + j, kind:'term', title:a, where, text:a + ': ' + b, w:4 }));
        p.s.forEach((s, j) => entry(list, { mid:m.id, k:pk, a:'s' + j, kind:'sec', title:s.h, where, text:s.h + '. ' + textOf(s.b), w:2 }));
        entry(list, { mid:m.id, k:pk, a:'ex', kind:'case', title:t('caseBox'), where, text:textOf(p.ex), w:1 });
        if (p.b2b) entry(list, { mid:m.id, k:pk, a:'b2b', kind:'b2b', title:t('b2bBox'), where, text:textOf(p.b2b), w:1 });
        p.q.forEach((q, j) => entry(list, { mid:m.id, k:pk, a:'q' + j, kind:'q', title:t('qOf', j + 1, p.q.length), where, text:q.q, w:1 }));
      });
      entry(list, { mid:m.id, k:'assignment', a:'top', kind:'asg', title:L.assignment.t, where:mk, text:L.assignment.t + '. ' + L.assignment.tasks.join(' '), w:1 });
      PL = lang;
    });
    PL = keep; return list;
  }
  function search(raw){
    const q = fold(raw).replace(/\s+/g, ' ').trim(); if (q.length < 2) return [];
    const list = idx[lang] || (idx[lang] = buildIndex()), out = [];
    for (const e of list) {
      const p = e.f.indexOf(q); if (p < 0) continue;
      const inTitle = e.ft.indexOf(q) > -1, exact = e.ft === q;
      out.push({ e, p, s:e.w * 10 + (inTitle ? 6 : 0) + (exact ? 20 : 0) + (e.ft.startsWith(q) ? 4 : 0) });
    }
    return out.sort((a, b) => b.s - a.s).slice(0, 40).map(x => Object.assign({ p:x.p, ql:q.length }, x.e));
  }
  // The snippet shows the words as written, with the match marked; positions are mapped back through the folding.
  function snippet(e){
    const map = [], chars = [...e.text]; chars.forEach((ch, i) => { for (const c of foldChar(ch)) map.push(i); });
    const a = map[e.p] || 0, b = (map[e.p + e.ql - 1] || a) + 1, s = Math.max(0, a - 50), en = Math.min(chars.length, b + 80);
    return (s ? '…' : '') + esc(chars.slice(s, a).join('')) + '<mark>' + esc(chars.slice(a, b).join('')) + '</mark>' + esc(chars.slice(b, en).join('')) + (en < chars.length ? '…' : '');
  }
  let hits = [], sel = -1;
  function showHits(){
    const keep = PL; PL = lang; const q = $('cpQ').value.trim(), box = $('cpRes');
    if (!q) { box.innerHTML = `<p class="cp-rhint">${t('findHint')}</p>`; box.hidden = false; PL = keep; return; }
    hits = search(q); sel = -1;
    box.innerHTML = hits.length ? hits.map((h, i) => `<a class="cp-hit" href="#/${h.mid}${h.k ? '/' + h.k : ''}" data-i="${i}" role="option"><span class="cp-rk">${esc(t('kinds')[h.kind])}</span><b dir="auto">${esc(h.title)}</b><small dir="auto">${esc(h.where)}</small><span class="cp-rs" dir="auto">${snippet(h)}</span></a>`).join('')
      : `<p class="cp-rhint">${t('noHits', esc(q))}</p>`;
    box.hidden = false; PL = keep;
  }
  function openFind(){ document.body.classList.add('cp-finding'); $('cpQ').focus(); showHits(); }
  function closeFind(){ document.body.classList.remove('cp-finding'); $('cpRes').hidden = true; }
  function go(i){
    const h = hits[i]; if (!h) return;
    jump = { a:h.a, q:$('cpQ').value.trim() }; closeFind(); $('cpQ').blur();
    const target = '#/' + h.mid + (h.k ? '/' + h.k : '');
    if (location.hash === target || (!h.mid && (location.hash === '' || location.hash === '#/'))) { const j = jump; jump = null; land(j); } else location.hash = target;
  }
  // After a jump: scroll to the spot, flash it and mark the words searched for.
  function land(j){
    const main = $('cpMain'), el = main.querySelector(`[data-a="${j.a}"]`) || main;
    if (el.matches('.cp-q') && el.hidden) el.hidden = false;
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 84));
    el.classList.remove('cp-flash'); void el.offsetWidth; el.classList.add('cp-flash');
    const fq = fold(j.q).replace(/\s+/g, ' ').trim(); if (!fq) return;
    const scope = el.matches('dt') ? el.parentElement : el, walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT), nodes = [];
    while (walk.nextNode()) if (!walk.currentNode.parentElement.closest('textarea,button,mark,.chip')) nodes.push(walk.currentNode);
    for (const n of nodes) {
      const map = []; let f = ''; [...n.data].forEach((ch, i) => { for (const c of foldChar(ch)) { f += c; map.push(i); } });
      f = f.replace(/\s/g, ' '); const p = f.indexOf(fq); if (p < 0) continue;
      const chars = [...n.data], a = map[p], b = map[p + fq.length - 1] + 1;
      const pre = chars.slice(0, a).join(''), mid = chars.slice(a, b).join(''), post = chars.slice(b).join('');
      const mk = document.createElement('mark'); mk.className = 'cp-mark'; mk.textContent = mid;
      n.replaceWith(document.createTextNode(pre), mk, document.createTextNode(post));
    }
  }
  $('cpQ').addEventListener('input', showHits);
  $('cpQ').addEventListener('focus', () => { document.body.classList.add('cp-finding'); showHits(); });
  $('cpQ').addEventListener('keydown', e => {
    const links = [...$('cpRes').querySelectorAll('.cp-hit')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!links.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length; links.forEach((l, i) => l.classList.toggle('on', i === sel)); links[sel].scrollIntoView({ block:'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); go(sel > -1 ? sel : 0); }
    else if (e.key === 'Escape') { closeFind(); $('cpQ').blur(); }
  });
  $('cpRes').addEventListener('click', e => { const a = e.target.closest('.cp-hit'); if (!a) return; e.preventDefault(); go(+a.dataset.i); });
  $('cpFindBtn').addEventListener('click', () => document.body.classList.contains('cp-finding') ? closeFind() : openFind());
  document.addEventListener('click', e => { if (!e.target.closest('.cp-find, #cpFindBtn')) closeFind(); });
  document.addEventListener('keydown', e => { if (e.key === '/' && !e.target.closest('input, textarea')) { e.preventDefault(); openFind(); } });

  // ---------- scratch pad: pen, highlighter and eraser over the whole page, margins included ----------
  // Points are stored against the content column (its centre line, its top, and its width as the unit),
  // so drawings scroll with the lesson and stay next to the same content, in the margins too.
  // Saved per person, per page and per language (D.pg[page]). The pen button floats at the bottom left.
  const Pen = (() => {
    const INKS = [['#14161B', 2.6], ['#DC2626', 2.6], ['#FF5A1F', 2.6], ['rgba(255,214,0,.45)', 20]];
    const main = $('cpMain'), btn = $('cpPen');
    let cv, c2, strokes = [], on = false, ink = 0, mode = 'draw', cur = null, ro;
    const col = () => main.querySelector('.cp-wrap') || main;
    function frame(){ const w = col(), r = main.getBoundingClientRect(), c = w.getBoundingClientRect(); return { cx:c.left - r.left + c.width / 2, top:c.top - r.top, u:Math.max(c.width, 1) }; }
    function size(){
      if (!cv) return; const dpr = window.devicePixelRatio || 1, w = main.clientWidth, h = main.clientHeight; // the canvas is positioned, so it never stretches main itself
      cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr; c2.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    }
    function line(s, f){ const [colr, wd] = INKS[s.k]; c2.strokeStyle = colr; c2.lineWidth = wd; c2.lineCap = c2.lineJoin = 'round'; c2.beginPath();
      s.p.forEach(([x, y], i) => { const X = f.cx + x * f.u, Y = f.top + y * f.u; i ? c2.lineTo(X, Y) : c2.moveTo(X, Y); }); if (s.p.length === 1) c2.lineTo(f.cx + s.p[0][0] * f.u + .1, f.top + s.p[0][1] * f.u); c2.stroke(); }
    function draw(){ if (!cv) return; c2.clearRect(0, 0, cv.width, cv.height); const f = frame(); strokes.forEach(s => line(s, f)); }
    const pt = e => { const f = frame(), r = main.getBoundingClientRect(); return [Math.round((e.clientX - r.left - f.cx) / f.u * 1e4) / 1e4, Math.round((e.clientY - r.top - f.top) / f.u * 1e4) / 1e4]; };
    function rub(p){ const f = frame(); for (let i = strokes.length - 1; i >= 0; i--) if (strokes[i].p.some(([x, y]) => Math.hypot((x - p[0]) * f.u, (y - p[1]) * f.u) < 14)) { strokes.splice(i, 1); save(); draw(); return; } }
    function down(e){ if (!on || mode === 'scroll') return; e.preventDefault(); cv.setPointerCapture(e.pointerId); const p = pt(e); if (mode === 'erase') { cur = 'x'; rub(p); return; } cur = { k:ink, p:[p] }; strokes.push(cur); draw(); }
    function move(e){ if (!on || !cur) return; const p = pt(e); if (cur === 'x') return rub(p); cur.p.push(p); draw(); }
    function up(){ if (cur && cur !== 'x') save(); cur = null; }
    const tools = document.createElement('div'); tools.className = 'cp-pen'; tools.hidden = true; tools.setAttribute('role', 'toolbar');
    document.body.appendChild(tools);
    function label(){
      const keep = PL; PL = lang;
      tools.setAttribute('aria-label', t('padTools'));
      tools.innerHTML = INKS.map(([c], i) => `<button type="button" data-ink="${i}" style="--ink-c:${c}" aria-label="${esc(t('pen', t('inks')[i]))}" title="${esc(t('inks')[i])}"></button>`).join('') +
        `<button type="button" data-mode="erase">${t('eraser')}</button><button type="button" data-mode="scroll" title="${esc(t('scrollTip'))}">${t('scroll')}</button><button type="button" data-undo>${t('undo')}</button><button type="button" data-clear>${t('clear')}</button><button type="button" data-done>${t('done')}</button>`;
      PL = keep; apply();
    }
    function apply(){
      const keep = PL; PL = lang;
      btn.setAttribute('aria-pressed', on); btn.title = on ? t('padOn') : t('padBtn'); btn.setAttribute('aria-label', btn.title); tools.hidden = !on;
      tools.querySelectorAll('[data-ink]').forEach(b => b.setAttribute('aria-pressed', mode === 'draw' && +b.dataset.ink === ink));
      const er = tools.querySelector('[data-mode="erase"]'), sc = tools.querySelector('[data-mode="scroll"]'); if (er) { er.setAttribute('aria-pressed', mode === 'erase'); sc.setAttribute('aria-pressed', mode === 'scroll'); }
      PL = keep;
      if (!cv) return; const live = on && mode !== 'scroll';
      cv.style.pointerEvents = live ? 'auto' : 'none'; cv.style.touchAction = live ? 'none' : 'auto'; main.classList.toggle('cp-drawing', on);
    }
    tools.addEventListener('click', e => { const x = e.target.closest('button'); if (!x) return;
      if (x.dataset.ink) { ink = +x.dataset.ink; mode = 'draw'; }
      if (x.dataset.mode) mode = mode === x.dataset.mode ? 'draw' : x.dataset.mode;
      if (x.hasAttribute('data-undo') && strokes.length) { strokes.pop(); save(); draw(); }
      if (x.hasAttribute('data-clear') && strokes.length && confirm(t('clearAsk'))) { strokes.length = 0; save(); draw(); }
      if (x.hasAttribute('data-done')) on = false;
      apply(); });
    btn.addEventListener('click', () => { on = !on; if (on) mode = 'draw'; apply(); });
    function mount(k){
      on = false; mode = 'draw'; if (ro) ro.disconnect();
      strokes = (D.pg = D.pg || {})[k] || (D.pg[k] = []);
      cv = document.createElement('canvas'); cv.className = 'cp-ink'; cv.setAttribute('aria-hidden', 'true'); c2 = cv.getContext('2d'); main.appendChild(cv);
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      ro = new ResizeObserver(size); ro.observe(main); ro.observe(col()); size(); apply();
    }
    return { mount, label };
  })();

  // ---------- start: sign-in and access ----------
  async function start(){
    chrome();
    const msg = k => { PL = lang; $('cpMain').innerHTML = `<div class="cp-msg cp-card"><p>${t(k)}</p><p><a class="btn" href="/app/">${t('openApp')}</a></p></div>`; };
    PL = lang; $('cpMain').innerHTML = `<p class="cp-msg">${t('checking')}</p>`;
    if (window.COURSE_TEST) { uid = 'test'; owner = !!window.COURSE_TEST.owner; }
    else {
      if (!window.supabase || !/^https:\/\//.test(cfg.supabaseUrl || '')) return msg('connect');
      db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
      const { data:{ session } } = await db.auth.getSession();
      if (!session) return msg('signIn');
      uid = session.user.id;
      const own = await db.rpc('is_tracker_admin'); owner = own.data === true;
      if (!owner) {
        if (OWNER_ONLY) return msg('noAccess');
        const acc = await db.from('members').select('access').eq('user_id', uid).maybeSingle();
        if (!((acc.data && acc.data.access) || []).includes('learn')) return msg('noAccess');
      }
    }
    await pull();
    let chosen = null; try { chosen = localStorage.getItem('cp-lang'); } catch(e){}
    if (!chosen && D.lang) { lang = D.lang; chrome(); }
    if (owner) { $('cpView').hidden = false; $('cpAsLearner').addEventListener('change', e => { asLearner = e.target.checked; route(); }); }
    try { await Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 26px Inter'), document.fonts.load('700 80px "IBM Plex Sans Arabic"')]); } catch(e){}
    window.addEventListener('hashchange', route); route();
  }
  window.COURSE_PLAYER = { fold, norm, feedback:(q, s) => feedback(q, s), setLang };   // for the content checks and tests
  start();
})();
