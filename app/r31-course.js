// Round 31 of the Portal Master Feature Plan (Nov 26 2026): course builder part 2. Amr only.
//   CB3  Quiz builder and question bank, inside the Round 30 builder (#builder). "Edit the questions" on a lesson opens that
//        lesson's quiz; "Open the question bank" on a module opens every quiz in it (lesson quizzes, the checkpoint, drill
//        banks). Questions stay where the course already keeps them (Acquisitions: item.quiz.questions and item.drillBank in
//        course_modules; Marketing: the module quiz in content.json), so course_attempts, progress and grading keep working.
//        Edits go into the builder draft; learners see them after Publish. The same rules run live here and in the CB5
//        checker (course_builder_check / course_quiz_issues): right answer not usually the longest, right answers spread
//        across A, B, C and D, no duplicate options, a pass mark on every quiz. "Spread the right answers" fixes the spread
//        by moving each right answer to a new letter; learners' options are shuffled per attempt anyway.
//   V1   Re-voice changed lines: a lesson marked "needs re-voice" gets a narration job with target.revoice. Worker 0.7 keeps
//        every unchanged line's take from the earlier narration (matched by text, picked takes included), voices only the
//        changed lines and joins the lesson again. The job is pinned to the machine that made the earlier one (target.host).
//        The narration live now is copied to Versions first. Psychology (Arabic, فصحى) goes through the same queue.
//   CB11 Make the video: narration (changed lines only when it can) then the video build on yukis-pc (course_video_builds,
//        picked up by the video runner). The new video is staged in R2 (videos/_new/) as a new version and waits for your OK;
//        learners keep the live one until you press Put live for that lesson. Over 50 MB, the runner renders it smaller.
//   V6   GPU time and estimated cost per job (voice_jobs.gpu_seconds, cost_usd; course_video_builds.render_s, cost_usd), with
//        totals per month, course and lesson: Voice Studio > GPU cost (#voice/cost) and a card on the Status page.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, card, empty, pill, opt, plural } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const toast = t => { if (T().toast) T().toast(t); };
  const when = at => !at ? '' : window.PortalUI ? window.PortalUI.when(at, { zone:false }) :
    new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const norm = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const plain = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // ======================================================================
  // CB3: the rules (same as private.course_quiz_issues in the database)
  // ======================================================================
  // q: { id, type:'single'|'multiple', prompt, options:[{ id, text, correct }], explanation }
  function quizIssues(qs, pass, needPass){
    const out = [], add = (severity, issue, q) => out.push({ severity, issue, q:q || null });
    if (needPass && !(Number.isInteger(+pass) && +pass >= 1 && +pass <= 100 && String(pass).trim() !== '')) add('error', 'no pass mark set (a whole number from 1 to 100)');
    let n = 0, longest = 0; const count = { A:0, B:0, C:0, D:0 };
    (qs || []).forEach(q => {
      const o = q.options || [], right = o.filter(x => x.correct), wrong = o.filter(x => !x.correct);
      const seen = {}; let dup = null; o.forEach(x => { const k = norm(x.text); if (k && seen[k]) dup = dup || x.text; seen[k] = 1; });
      if (dup) add('error', q.id + ': two options say the same thing (“' + String(dup).slice(0, 60) + '”)', q.id);
      if (o.length < 3) add('error', q.id + ' has only ' + o.length + ' options', q.id);
      if (!plain(q.prompt)) add('error', q.id + ' has no question text', q.id);
      if (o.some(x => !plain(x.text))) add('error', q.id + ' has an empty option', q.id);
      if (q.type === 'single' && right.length !== 1) add('error', q.id + ' is single choice but has ' + right.length + ' right answers', q.id);
      if (q.type === 'multiple' && (!right.length || !wrong.length)) add('error', q.id + ' needs at least one right and one wrong option', q.id);
      if (!plain(q.explanation)) add('warn', q.id + ' has no explanation', q.id);
      if (q.type !== 'single' || right.length !== 1) return;
      n++;
      const i = o.indexOf(right[0]), L = LETTERS.includes(String(right[0].id).toUpperCase()) ? String(right[0].id).toUpperCase() : LETTERS[i];
      if (L in count) count[L]++;
      const cl = String(right[0].text || '').length, wl = Math.max(0, ...wrong.map(x => String(x.text || '').length));
      if (cl > wl) longest++;
      if (wl && cl >= wl * 1.6 && cl - wl >= 15) add('warn', q.id + ': the right answer is much longer than the others (' + cl + ' vs ' + wl + ' characters), a giveaway', q.id);
    });
    if (n >= 4) {
      if (longest * 10 >= n * 6) add('error', 'the right answer is the longest option in ' + longest + ' of ' + n + ' questions');
      else if (n >= 5 && longest * 100 >= n * 45) add('warn', 'the right answer is the longest option in ' + longest + ' of ' + n + ' questions');
      const best = Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1))[0];
      if (count[best] * 2 > n) add('error', 'right answers bunch on ' + best + ' (' + count[best] + ' of ' + n + ' questions). Spread them across A, B, C and D');
      else if (n >= 8) { const never = Object.keys(count).filter(k => !count[k]); if (never.length) add('warn', never.join(', ') + (never.length > 1 ? ' are' : ' is') + ' never the right answer in ' + n + ' questions'); }
    }
    return out;
  }
  const spreadOf = qs => { const c = { A:0, B:0, C:0, D:0 }; (qs || []).forEach(q => { if (q.type !== 'single') return; const i = (q.options || []).findIndex(x => x.correct); if (i >= 0 && LETTERS[i] in c) c[LETTERS[i]]++; }); return c; };
  // Move each single-choice right answer to a new letter, cycling B, A, D, C so no letter wins. Swaps two options, so every
  // option keeps its text and length; options are relabelled A, B, C, D in their new order.
  function spread(qs){
    let k = 0, moved = 0;
    (qs || []).forEach(q => {
      const o = q.options || []; if (q.type !== 'single' || o.length < 2 || o.filter(x => x.correct).length !== 1) return;
      const want = (k * 3 + 1) % o.length; k++;
      const at = o.findIndex(x => x.correct);
      if (at !== want) { [o[at], o[want]] = [o[want], o[at]]; moved++; }
      o.forEach((x, i) => { x.id = LETTERS[i] || String(i + 1); });
    });
    return moved;
  }

  // ======================================================================
  // Where each course keeps its questions, as editable "sets"
  // ======================================================================
  // set: { key, label, kind:'lesson'|'checkpoint'|'drill'|'module', lesson, pass (null = none), passFixed, qs:[normalized], write(qs, pass) }
  function flat(items, out = []){ (items || []).forEach(x => { if (x.type === 'group') flat(x.items, out); else out.push(x); }); return out; }
  const toQ = q => ({ id:q.id, type:q.type === 'multiple' ? 'multiple' : 'single', prompt:q.prompt || '', explanation:q.explanation || '',
    options:(q.options || []).map(o => ({ id:o.id, text:o.text || '', correct:!!o.correct })), _raw:q });
  const fromQ = q => Object.assign({}, q._raw || {}, { id:q.id, type:q.type, prompt:q.prompt, explanation:q.explanation,
    options:q.options.map(o => ({ id:o.id, text:o.text, correct:!!o.correct })) });
  function acqSets(w){
    const sets = [];
    flat(w.items).forEach(it => {
      if ((it.type === 'lesson' || it.type === 'checkpoint') && it.quiz) {
        sets.push({ key:'q:' + it.id, label:(it.type === 'checkpoint' ? 'Checkpoint' : 'Quiz ' + it.id) + ' · ' + (it.shortTitle || it.title || it.id).replace(/^\S+\s+/, ''), kind:it.type, lesson:it.id,
          pass:it.quiz.passMark, rule:it.type === 'checkpoint' ? 85 : 80, qs:(it.quiz.questions || []).map(toQ),
          write(qs, pass){ it.quiz.questions = qs.map(fromQ); if (pass !== undefined) it.quiz.passMark = pass === '' || pass == null ? null : +pass; } });
      }
      if (Array.isArray(it.drillBank)) sets.push({ key:'d:' + it.id, label:'Drill bank · ' + (it.shortTitle || it.title || it.id), kind:'drill', lesson:it.id, pass:null, qs:it.drillBank.map(toQ),
        write(qs){ it.drillBank = qs.map(fromQ); } });
    });
    return sets;
  }
  // Marketing: { q, o:[...], c:[indexes], why } with the Arabic text at the same place in ar.modules[id].quiz
  function mktSets(w){
    const en = w.en, ar = w.ar && w.ar.quiz;
    if (!en || !Array.isArray(en.quiz)) return [];
    const qs = en.quiz.map((q, i) => ({ id:'Q' + (i + 1), type:(q.c || []).length > 1 ? 'multiple' : 'single', prompt:q.q || '', explanation:q.why || '',
      options:(q.o || []).map((t, j) => ({ id:LETTERS[j], text:t, correct:(q.c || []).includes(j), _j:j })), _raw:q, _ar:ar && ar[i] }));
    return [{ key:'mkt', label:'Module ' + en.n + ' checkpoint quiz', kind:'module', pass:80, passFixed:'Marketing uses one pass mark for every module (80%), set in the course plan.', qs, mkt:true,
      write(list){
        const enQ = [], arQ = [];
        list.forEach(q => {
          const old = q._raw || {}, oa = q._ar || null, order = q.options.map(o => o._j);
          enQ.push(Object.assign({}, old, { q:q.prompt, why:q.explanation, o:q.options.map(o => o.text), c:q.options.map((o, j) => o.correct ? j : -1).filter(j => j >= 0) }));
          if (ar) arQ.push(oa ? Object.assign({}, oa, { o:Array.isArray(oa.o) ? order.map(j => j == null ? '' : oa.o[j] || '') : oa.o }) : { q:'', o:q.options.map(() => ''), why:'' });
          q.options.forEach((o, j) => { o._j = j; }); q._raw = enQ[enQ.length - 1]; q._ar = ar ? arQ[arQ.length - 1] : null;
        });
        en.quiz = enQ; if (ar) w.ar.quiz = arQ;
      } }];
  }
  const setsFor = (course, w) => course === 'acq' ? acqSets(w) : course === 'mkt' ? mktSets(w) : [];
  // the CB5 checker's Marketing branch calls this (r30-builder.js)
  window.R31Quiz = { issues:quizIssues, spread, mktIssues(quiz, arQuiz){
    const set = mktSets({ en:{ n:'', quiz }, ar:arQuiz ? { quiz:arQuiz } : null })[0]; if (!set) return [];
    const out = quizIssues(set.qs, 80, false);
    if (arQuiz && arQuiz.length !== quiz.length) out.push({ severity:'error', issue:'Arabic has ' + arQuiz.length + ' questions, English has ' + quiz.length });
    return out;
  } };

  // ======================================================================
  // CB3: the quiz builder dialog (one quiz, or the whole module's bank)
  // ======================================================================
  const Q = { ctx:null, sets:[], only:null, filter:'', bad:false, dlg:null };
  function openQuiz(ctx, only){
    Q.ctx = ctx; Q.only = only || null; Q.filter = ''; Q.bad = false;
    Q.sets = setsFor(ctx.course, ctx.work);
    if (!Q.sets.length) return toast(ctx.course === 'psy' ? 'Psychology sections have no quizzes.' : 'This module has no quizzes yet.');
    if (only && !Q.sets.some(s => s.key === only)) {   // a lesson with no quiz yet: start one
      const it = flat(ctx.work.items).find(x => x.id === ctx.lesson);
      if (it && ctx.course === 'acq') { it.quiz = { id:'quiz-' + it.id, title:'Quiz ' + it.id, passMark:80, questions:[] }; ctx.save(); Q.sets = setsFor(ctx.course, ctx.work); }
    }
    let d = Q.dlg;
    if (!d || !document.contains(d)) {   // inside #pView so the portal's form styles apply (a modal dialog still shows on top)
      d = Q.dlg = document.createElement('dialog'); d.className = 'r31-dlg'; d.setAttribute('aria-labelledby', 'r31QzH');
      (document.getElementById('pView') || document.body).appendChild(d);
      d.addEventListener('click', onQuizClick); d.addEventListener('input', onQuizInput); d.addEventListener('change', onQuizChange);
      d.addEventListener('close', () => { if (Q.ctx && /^#builder\//.test(location.hash)) Q.ctx.redraw(); });
    }
    drawQuiz(); if (!d.open) d.showModal();
  }
  addEventListener('hashchange', () => { if (Q.dlg && Q.dlg.open) Q.dlg.close(); });
  function visibleSets(){ return Q.sets.filter(s => !Q.only || s.key === Q.only); }
  function drawQuiz(keepScroll){
    const d = Q.dlg, y = keepScroll && d.querySelector('.r31-qbody') ? d.querySelector('.r31-qbody').scrollTop : 0;
    const sets = visibleSets(), all = Q.sets.reduce((a, s) => a + s.qs.length, 0);
    const head = Q.only ? sets[0].label : 'Question bank · ' + (Q.ctx.course === 'mkt' ? 'Module ' + Q.ctx.work.en.n : 'Module ' + Q.ctx.work.number);
    const f = norm(Q.filter);
    d.innerHTML = '<div class="r31-qhead"><h2 id="r31QzH">' + esc(head) + '</h2><span>' + esc(Q.only ? plural(sets[0].qs.length, 'question') : plural(all, 'question') + ' in ' + plural(Q.sets.length, 'quiz', 'quizzes')) + '</span>' +
      '<button type="button" class="p-btn is-ghost" data-q="close">Done</button></div>' +
      (Q.only ? '' : '<div class="r31-qtools"><label class="sc-f">Find a question<input type="search" data-qf="find" value="' + esc(Q.filter) + '" placeholder="Words in the question or options"></label>' +
        '<label class="px-check"><input type="checkbox" data-qf="bad"' + (Q.bad ? ' checked' : '') + '> Only quizzes with problems</label>' +
        '<label class="sc-f px-inline">Go to<select data-qf="jump"><option value="">Pick a quiz</option>' + Q.sets.map(s => opt(s.key, s.label, false)).join('') + '</select></label></div>') +
      '<p class="p-empty r31-qnote">Changes go into your draft. Learners see them after you publish the module. Quiz attempts already started keep the questions they began with.</p>' +
      '<div class="r31-qbody">' + sets.map(s => {
        const iss = quizIssues(s.qs, s.pass, s.pass !== null && !s.passFixed);
        if (Q.bad && !iss.length) return '';
        const qs = f ? s.qs.filter(q => norm(q.prompt + ' ' + q.options.map(o => o.text).join(' ')).includes(f)) : s.qs;
        if (f && !qs.length) return '';
        const sp = spreadOf(s.qs), err = iss.filter(x => x.severity === 'error').length;
        return '<section class="r31-set" id="r31s-' + esc(s.key.replace(/[^\w-]/g, '_')) + '" data-set="' + esc(s.key) + '"><div class="r31-sethead"><h3>' + esc(s.label) + '</h3>' +
          pill(err ? plural(err, 'thing') + ' to fix' : iss.length ? plural(iss.length, 'thing') + ' to check' : 'Checks pass', err ? 'no' : iss.length ? '' : 'ok') + '</div>' +
          '<div class="cb-row r31-setrow">' + (s.pass === null ? '<span class="p-empty">Drill banks have no pass mark; the checkpoint draws from them.</span>'
            : s.passFixed ? '<span class="p-empty">' + esc(s.passFixed) + '</span>'
            : '<label class="sc-f px-inline">Pass mark %<input type="number" min="1" max="100" step="1" data-qpass="' + esc(s.key) + '" value="' + esc(s.pass == null ? '' : s.pass) + '"></label><span class="p-empty">Usual: ' + s.rule + '</span>') +
            '<span class="r31-spread" aria-label="Right answers by letter">' + Object.keys(sp).map(k => '<b>' + k + '</b> ' + sp[k]).join(' · ') + '</span>' +
            '<button type="button" class="p-btn is-ghost" data-q="spread" data-s="' + esc(s.key) + '">Spread the right answers</button>' +
            '<button type="button" class="p-btn is-ghost" data-q="add" data-s="' + esc(s.key) + '">+ Add a question</button></div>' +
          (iss.length ? '<ul class="r31-iss">' + iss.map(x => '<li class="is-' + (x.severity === 'error' ? 'err' : 'warn') + '">' + pill(x.severity === 'error' ? 'Must fix' : 'Check', x.severity === 'error' ? 'no' : '') + ' ' + esc(x.issue) + '</li>').join('') + '</ul>' : '') +
          (qs.length ? qs.map(q => qHtml(s, q, s.qs.indexOf(q))).join('') : empty('No questions yet.')) + '</section>';
      }).join('') + '</div>';
    if (y) d.querySelector('.r31-qbody').scrollTop = y;
  }
  function qHtml(s, q, i){
    const k = ' data-s="' + esc(s.key) + '" data-i="' + i + '"', multi = q.type === 'multiple', others = Q.sets.filter(x => x.key !== s.key && !x.mkt);
    return '<div class="r31-q"><div class="r31-qtop"><b>' + (i + 1) + '.</b><span class="p-empty">' + esc(q.id) + '</span>' +
      (s.mkt ? '' : '<select data-qt="type"' + k + ' aria-label="Kind of question">' + opt('single', 'One right answer', !multi) + opt('multiple', 'Pick all that apply', multi) + '</select>') +
      '<span class="r31-qact"><button type="button" class="cb-ic" data-q="up"' + k + ' aria-label="Move up">↑</button><button type="button" class="cb-ic" data-q="down"' + k + ' aria-label="Move down">↓</button>' +
      (others.length ? '<select data-qt="copy"' + k + ' aria-label="Copy to another quiz"><option value="">Copy to…</option>' + others.map(x => opt(x.key, x.label, false)).join('') + '</select>' : '') +
      '<button type="button" class="cb-ic cb-del" data-q="del"' + k + ' aria-label="Remove this question">×</button></span></div>' +
      '<label class="sc-f">Question<textarea rows="2" data-qt="prompt"' + k + '>' + esc(q.prompt) + '</textarea></label>' +
      '<div class="r31-opts" role="group" aria-label="Options">' + q.options.map((o, j) => '<div class="r31-opt' + (o.correct ? ' is-right' : '') + '"><label class="r31-pick" title="Right answer"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="r31-' + esc(s.key) + '-' + i + '" data-qo="right" data-j="' + j + '"' + k + (o.correct ? ' checked' : '') + '><b>' + esc(LETTERS[j] || j + 1) + '</b></label>' +
        '<input type="text" data-qo="text" data-j="' + j + '"' + k + ' value="' + esc(o.text) + '" aria-label="Option ' + esc(LETTERS[j] || j + 1) + '"><small>' + String(o.text || '').length + '</small>' +
        (q.options.length > 2 ? '<button type="button" class="cb-ic cb-del" data-q="odel" data-j="' + j + '"' + k + ' aria-label="Remove option ' + esc(LETTERS[j] || j + 1) + '">×</button>' : '') + '</div>').join('') + '</div>' +
      (q.options.length < 6 ? '<button type="button" class="p-btn is-ghost r31-oadd" data-q="oadd"' + k + '>+ Add an option</button>' : '') +
      '<label class="sc-f">Why (shown after they answer)<textarea rows="2" data-qt="explanation"' + k + '>' + esc(q.explanation) + '</textarea></label>' +
      (s.mkt && q._ar ? '<p class="p-empty">Arabic for this question is kept and moves with its options. Edit the Arabic words in the Marketing source files.</p>' : '') + '</div>';
  }
  const setOf = key => Q.sets.find(s => s.key === key);
  function commit(s, redraw){ s.write(s.qs); Q.ctx.save(); if (redraw) drawQuiz(true); else refreshHead(s); }
  function refreshHead(s){   // pill and problems of one quiz, without redrawing the inputs being typed in
    const sec = Q.dlg.querySelector('[data-set="' + CSS.escape(s.key) + '"]'); if (!sec) return;
    const iss = quizIssues(s.qs, s.pass, s.pass !== null && !s.passFixed), err = iss.filter(x => x.severity === 'error').length;
    const p = sec.querySelector('.r31-sethead .p-pill'); if (p) p.outerHTML = pill(err ? plural(err, 'thing') + ' to fix' : iss.length ? plural(iss.length, 'thing') + ' to check' : 'Checks pass', err ? 'no' : iss.length ? '' : 'ok');
    let ul = sec.querySelector('.r31-iss');
    const html = iss.map(x => '<li class="is-' + (x.severity === 'error' ? 'err' : 'warn') + '">' + pill(x.severity === 'error' ? 'Must fix' : 'Check', x.severity === 'error' ? 'no' : '') + ' ' + esc(x.issue) + '</li>').join('');
    if (!ul && html) { ul = document.createElement('ul'); ul.className = 'r31-iss'; sec.querySelector('.r31-setrow').after(ul); }
    if (ul) { if (html) ul.innerHTML = html; else ul.remove(); }
  }
  function newId(s){
    const used = new Set(); Q.sets.forEach(x => x.qs.forEach(q => used.add(q.id)));
    if (s.mkt) return 'Q' + (s.qs.length + 1);
    const base = Q.ctx.module + '-' + (s.kind === 'checkpoint' ? 'cp' : String(s.lesson).replace(/\./g, '-')) + (s.kind === 'drill' ? '-d' : '-q');
    let n = s.qs.length + 1; while (used.has(base + String(n).padStart(2, '0'))) n++;
    return base + String(n).padStart(2, '0');
  }
  function onQuizClick(e){
    const t = e.target.closest('[data-q]'); if (!t) { if (e.target === Q.dlg) Q.dlg.close(); return; }
    const a = t.dataset.q; if (a === 'close') return Q.dlg.close();
    const s = setOf(t.dataset.s); if (!s) return;
    const i = +t.dataset.i, q = s.qs[i];
    if (a === 'spread') { const n = spread(s.qs); commit(s, true); toast(n ? plural(n, 'right answer') + ' moved to a new letter.' : 'The right answers are already spread out.'); return; }
    if (a === 'add') { s.qs.push({ id:newId(s), type:'single', prompt:'', explanation:'', options:LETTERS.slice(0, 4).map((id, j) => ({ id, text:'', correct:j === 0, _j:null })) }); commit(s, true);
      const last = Q.dlg.querySelector('[data-set="' + CSS.escape(s.key) + '"] .r31-q:last-child textarea'); if (last) last.focus(); return; }
    if (!q) return;
    if (a === 'up' || a === 'down') { const j = i + (a === 'up' ? -1 : 1); if (j < 0 || j >= s.qs.length) return; [s.qs[i], s.qs[j]] = [s.qs[j], s.qs[i]]; return commit(s, true); }
    if (a === 'del') { if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Sure?'; t.classList.add('is-sure'); return; } s.qs.splice(i, 1); return commit(s, true); }
    if (a === 'oadd') { q.options.push({ id:LETTERS[q.options.length], text:'', correct:false, _j:null }); return commit(s, true); }
    if (a === 'odel') { const j = +t.dataset.j; q.options.splice(j, 1); q.options.forEach((o, k) => { o.id = LETTERS[k]; }); if (q.type === 'single' && !q.options.some(o => o.correct) && q.options[0]) q.options[0].correct = true; return commit(s, true); }
  }
  function onQuizInput(e){
    const t = e.target;
    if (t.dataset.qf === 'find') { Q.filter = t.value; clearTimeout(Q.ft); Q.ft = setTimeout(() => { drawQuiz(); const f = Q.dlg.querySelector('[data-qf="find"]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250); return; }
    if (t.dataset.qpass) { const s = setOf(t.dataset.qpass); s.pass = t.value === '' ? null : +t.value; s.write(s.qs, s.pass); Q.ctx.save(); return refreshHead(s); }
    const s = setOf(t.dataset.s); if (!s) return; const q = s.qs[+t.dataset.i]; if (!q) return;
    if (t.dataset.qt === 'prompt' || t.dataset.qt === 'explanation') { q[t.dataset.qt] = t.value; return commit(s); }
    if (t.dataset.qo === 'text') { q.options[+t.dataset.j].text = t.value; const sm = t.nextElementSibling; if (sm) sm.textContent = t.value.length; return commit(s); }
  }
  function onQuizChange(e){
    const t = e.target;
    if (t.dataset.qf === 'bad') { Q.bad = t.checked; return drawQuiz(); }
    if (t.dataset.qf === 'jump') { const el = t.value && Q.dlg.querySelector('#r31s-' + t.value.replace(/[^\w-]/g, '_')); if (el) el.scrollIntoView({ block:'start', behavior:'smooth' }); t.value = ''; return; }
    const s = setOf(t.dataset.s); if (!s) return; const q = s.qs[+t.dataset.i]; if (!q) return;
    if (t.dataset.qt === 'type') { q.type = t.value; if (q.type === 'single') { let one = false; q.options.forEach(o => { if (o.correct && !one) one = true; else o.correct = false; }); if (!one && q.options[0]) q.options[0].correct = true; } return commit(s, true); }
    if (t.dataset.qt === 'copy') {
      const to = setOf(t.value); t.value = ''; if (!to) return;
      const c = JSON.parse(JSON.stringify(Object.assign({}, q, { _raw:null, _ar:null }))); c.id = newId(to); c._raw = null; to.qs.push(c); commit(to, true);
      return toast('Copied to ' + to.label + '.');
    }
    if (t.dataset.qo === 'right') {
      const j = +t.dataset.j;
      if (q.type === 'single') q.options.forEach((o, k) => { o.correct = k === j; }); else q.options[j].correct = t.checked;
      return commit(s, true);
    }
  }

  // ======================================================================
  // V1 and CB11: narration jobs, video builds, Put live
  // ======================================================================
  const VC = { re:'acq', acq:'re', psy:'psy' };   // builder course -> Voice Studio course (and back)
  const lessonItem = (ctx, w) => ctx.course === 'acq' ? flat((w || {}).items).find(x => x.id === ctx.lesson) : ((w || {}).items || []).find(x => x.id === ctx.lesson);
  const L = (o, k) => o && typeof o === 'object' ? (o[k] || '') : (k === 'en' ? (o || '') : '');
  // the script the worker reads: the live (published) lesson, the same way the course's own Narrate buttons make it
  function narrationJob(ctx){
    const it = lessonItem(ctx, ctx.live); if (!it) return null;
    if (ctx.course === 'acq') {
      if (!window.CourseNarrate || !it.bodyMarkdown) return null;
      return { title:'Lesson ' + it.id + ' ' + (it.shortTitle || it.title || ''), text:window.CourseNarrate.script(it.bodyMarkdown), language:'en', mood:'teaching',
        target:{ mode:'lesson', course:'re', module:ctx.module, lesson:it.id } };
    }
    if (ctx.course === 'psy') {
      if (!window.PsyNarrate || !L(it.html, 'ar')) return null;
      return { title:'Psychology ' + (it.label || it.id) + ' (AR) ' + L(it.title, 'en'), text:window.PsyNarrate.script(L(it.html, 'ar')), language:'ar', mood:'teaching',
        target:{ mode:'lesson', course:'psy', lang:'ar', module:ctx.module, lesson:it.id } };
    }
    return null;
  }
  async function jobsFor(course, module, lesson){
    const r = await safe(db().from('voice_jobs').select('id,title,status,progress,message,created_at,finished_at,claimed_at,duration_s,host,host_sure,gpu_seconds,cost_usd,target,needs_review')
      .eq('target->>course', VC[course] || course).eq('target->>module', module).eq('target->>lesson', lesson).eq('target->>mode', 'lesson').is('parent_id', null)
      .order('created_at', { ascending:false }).limit(20));
    return r.data || [];
  }
  async function buildsFor(course, module, lesson){
    const r = await safe(db().from('course_video_builds').select('*').eq('course', course).eq('module_id', module).eq('lesson', lesson).order('requested_at', { ascending:false }).limit(20));
    return r.data || [];
  }
  // keep the narration learners hear now in Versions before it is replaced (same folder Voice Studio uses)
  async function keepNarration(m, l){
    if (!window.AmrMedia) return false;
    const M = window.AmrMedia(db()), dir = 'course/content/' + m + '/narration/', ver = dir + '_versions/' + l + '/';
    const cur = await M.list(dir), mp3 = cur.find(o => o.name === l + '.mp3'); if (!mp3) return true;
    const tag = new Date(mp3.uploaded || Date.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-');
    if ((await M.list(ver)).some(o => o.name === tag + '.mp3')) return true;
    const c = await M.copy(dir + l + '.mp3', ver + tag + '.mp3'); if (c && c.error) return false;
    await M.copy(dir + l + '.json', ver + tag + '.json');
    return true;
  }
  // Queue the lesson's narration. changedOnly: keep the earlier narration's takes and voice only the changed lines.
  async function queueNarration(ctx, changedOnly){
    const job = narrationJob(ctx);
    if (!job) return { error:ctx.course === 'psy' ? 'This section has no Arabic text to narrate yet.' : 'This lesson has no published text to narrate yet.' };
    const jobs = await jobsFor(ctx.course, ctx.module, ctx.lesson);
    const open = jobs.find(j => j.status === 'queued' || j.status === 'running');
    if (open) return { job:open, reused:true };
    const prev = jobs.find(j => j.status === 'done');
    const rv = (ctx.revoice || []).find(r => r.item_id === ctx.lesson);
    if (changedOnly && prev) {
      job.target.revoice = { from_job:prev.id, lines:(rv && rv.lines || []).slice(0, 60).map(s => String(s).slice(0, 400)) };
      if (prev.host === 'pc' || prev.host === 'modal') job.target.host = prev.host;
      job.title += ' · changed lines';
    }
    job.priority = 50;   // ahead of the course batch, like "Move to the front"
    if (ctx.course === 'acq' && prev && !(await keepNarration(ctx.module, ctx.lesson))) return { error:'Couldn’t keep a copy of the current narration in Versions, so nothing was sent. Try again.' };
    const r = await safe(db().from('voice_jobs').insert(job).select('id,status,progress,message,created_at,target,host').single());
    if (r.error) return { error:/row-level|permission|policy|JWT|42501/i.test(r.error.message || '') ? 'Not allowed here. Sign in with your authenticator code, then try again.' : 'Couldn’t queue the narration. ' + (r.error.message || '') };
    return { job:r.data, revoice:!!job.target.revoice, prev };
  }
  async function workerState(){
    const r = await safe(db().from('voice_worker').select('id,name,last_seen,version,busy_job').eq('id', 'main').maybeSingle());
    const w = r.data; return { pc:!!(w && Date.now() - new Date(w.last_seen) < 120000), w };
  }
  const mins = s => s == null ? '' : s < 90 ? Math.round(s) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : (s / 3600).toFixed(1) + ' h';
  const usd = n => n == null ? '' : '$' + (+n < 0.01 && +n > 0 ? (+n).toFixed(3) : (+n).toFixed(2));
  const hostName = h => h === 'modal' ? 'Modal cloud GPU' : h === 'app' ? 'a Voice Studio app PC' : 'yukis-pc';

  // ---------------- module page: question bank + needs re-voice ----------------
  async function moduleCards(ctx, box){
    const sets = setsFor(ctx.course, ctx.work);
    let html = '';
    if (sets.length) {
      const all = sets.reduce((a, s) => a + s.qs.length, 0);
      const bad = sets.map(s => ({ s, iss:quizIssues(s.qs, s.pass, s.pass !== null && !s.passFixed) })).filter(x => x.iss.length);
      const err = bad.filter(x => x.iss.some(i => i.severity === 'error'));
      html += card('Question bank', plural(all, 'question') + ' in ' + plural(sets.length, 'quiz', 'quizzes'),
        '<p class="cb-sum">' + pill(err.length ? plural(err.length, 'quiz', 'quizzes') + ' to fix' : 'No quiz to fix', err.length ? 'no' : 'ok') + ' ' + pill(plural(bad.length - err.length, 'quiz', 'quizzes') + ' to check', bad.length - err.length ? '' : 'ok') + '</p>' +
        (err.length ? '<ul class="r31-iss">' + err.slice(0, 6).map(x => '<li class="is-err">' + esc(x.s.label) + ': ' + esc(x.iss.find(i => i.severity === 'error').issue) + '</li>').join('') + (err.length > 6 ? '<li>' + esc('and ' + (err.length - 6) + ' more') + '</li>' : '') + '</ul>' : '') +
        '<div class="cb-row"><button type="button" class="p-btn" data-r31="bank">Open the question bank</button>' +
        (err.length ? '<button type="button" class="p-btn is-ghost" data-r31="spreadall">Spread the right answers in every quiz</button>' : '') +
        '<span class="p-empty">Edits go into the draft, like the lesson text.</span></div>');
    }
    const rv = (ctx.revoice || []);
    if (rv.length && ctx.course !== 'mkt') {
      html += card('Needs re-voice', plural(rv.length, 'lesson'),
        '<p class="p-empty">These lessons were published with changed narrated lines. Re-voice keeps every unchanged line as it sounds now and voices only the changed ones.</p>' +
        '<ul class="r31-rv">' + rv.map(r => '<li data-rv="' + esc(r.item_id) + '"><b>' + esc((ctx.course === 'psy' ? '' : 'Lesson ') + r.item_id) + (r.lang === 'ar' ? ' (Arabic)' : '') + '</b><span class="p-empty">' + esc(plural((r.lines || []).length, 'changed line')) + ' · marked ' + esc(when(r.marked_at)) + '</span>' +
          '<span class="r31-rvst" data-rvst="' + esc(r.item_id) + '"></span>' +
          '<button type="button" class="p-btn is-ghost" data-r31="revoice" data-l="' + esc(r.item_id) + '">Re-voice changed lines</button>' +
          ((r.lines || []).length ? '<details><summary>Changed lines</summary><ul>' + r.lines.slice(0, 12).map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></details>' : '') + '</li>').join('') + '</ul>' +
        (rv.length > 1 ? '<div class="cb-row"><button type="button" class="p-btn is-ghost" data-r31="revoiceall">Re-voice all ' + rv.length + '</button></div>' : ''));
    }
    box.innerHTML = html;
    if (ctx.isDraft && rv.length) box.querySelectorAll('[data-r31="revoice"]').forEach(b => b.title = 'Uses the published lesson. Publish your draft first if it changes these lines.');
    // where each re-voice stands
    rv.forEach(async r => { const j = (await jobsFor(ctx.course, ctx.module, r.item_id))[0], el = box.querySelector('[data-rvst="' + CSS.escape(r.item_id) + '"]');
      if (el && j && (j.status === 'queued' || j.status === 'running')) el.innerHTML = pill(j.status === 'running' ? 'Narrating · ' + Math.round((j.progress || 0) * 100) + '%' : 'In the queue', ''); });
    box.onclick = async e => {
      const b = e.target.closest('[data-r31]'); if (!b) return;
      if (b.dataset.r31 === 'bank') return openQuiz(ctx);
      if (b.dataset.r31 === 'spreadall') { let n = 0; setsFor(ctx.course, ctx.work).forEach(s => { n += spread(s.qs); s.write(s.qs); }); ctx.save(); toast(plural(n, 'right answer') + ' moved. Check them in the question bank, then publish.'); return ctx.redraw(); }
      if (b.dataset.r31 === 'revoice' || b.dataset.r31 === 'revoiceall') {
        const list = b.dataset.r31 === 'revoice' ? [b.dataset.l] : rv.map(r => r.item_id);
        b.disabled = true; b.textContent = 'Queuing…'; let ok = 0, msg = '';
        for (const l of list) { const r = await queueNarration(Object.assign({}, ctx, { lesson:l }), true); if (r.error) msg = r.error; else ok++; }
        toast(ok ? plural(ok, 'lesson') + ' sent to Voice Studio. Only the changed lines are voiced.' : msg);
        return moduleCards(ctx, box);
      }
    };
  }

  // ---------------- lesson page: Make the video ----------------
  const VID = { timer:null, armed:'' };
  async function videoCard(ctx, box){
    clearTimeout(VID.timer);
    if (ctx.course === 'mkt') { box.innerHTML = ''; return; }
    const [jobs, builds, ws] = await Promise.all([jobsFor(ctx.course, ctx.module, ctx.lesson), ctx.course === 'acq' ? buildsFor(ctx.course, ctx.module, ctx.lesson) : Promise.resolve([]), workerState()]);
    if (!document.contains(box)) return;
    const job = jobs[0], build = builds[0], rv = (ctx.revoice || []).find(r => r.item_id === ctx.lesson);
    const lines = [];
    const step = (n, label, state, detail) => '<li class="r31-step is-' + state + '"><i>' + n + '</i><b>' + esc(label) + '</b><span>' + detail + '</span></li>';
    // 1 narration
    let nState = 'todo', nText = rv ? esc(plural((rv.lines || []).length, 'changed line') + ' to voice') : job && job.status === 'done' ? 'Narrated ' + esc(when(job.finished_at)) : 'Not narrated yet';
    if (job && (job.status === 'queued' || job.status === 'running')) { nState = 'run'; nText = job.status === 'running' ? esc('Narrating on ' + hostName(job.host) + ' · ' + Math.round((job.progress || 0) * 100) + '%') + (job.message ? '<small>' + esc(job.message) + '</small>' : '') : esc(ws.pc ? 'In the queue, the PC is online' : 'In the queue. The PC is offline; start it or use Modal (Voice Studio › Projects › Move to the front)'); }
    else if (job && job.status === 'done' && !rv) { nState = 'ok'; nText += job.gpu_seconds ? ' · ' + esc(mins(job.gpu_seconds) + ' GPU · ' + usd(job.cost_usd)) : ''; }
    else if (job && job.status === 'failed') { nState = 'bad'; nText = 'Failed: ' + esc(job.message || ''); }
    lines.push(step(1, ctx.course === 'psy' ? 'Arabic narration (فصحى)' : 'Narration', nState, nText));
    // 2 video
    if (ctx.course === 'acq') {
      let vState = 'todo', vText = 'Not built yet';
      if (build) {
        if (build.status === 'queued') { vState = 'run'; vText = esc(job && job.id === build.narration_job && job.status !== 'done' ? 'Waits for the narration, then yukis-pc builds it' : ws.pc ? 'Waiting for the video runner on yukis-pc' : 'Waiting for yukis-pc (offline now)'); }
        else if (build.status === 'building') { vState = 'run'; vText = esc('Building on yukis-pc · ' + Math.round((build.progress || 0) * 100) + '%' + (build.started_at ? ' · started ' + when(build.started_at) : '')) + (build.message ? '<small>' + esc(build.message) + '</small>' : ''); }
        else if (build.status === 'staged') { vState = 'ok'; vText = esc('New version ready ' + when(build.finished_at) + (build.mb ? ' · ' + build.mb + ' MB' : '') + (build.smaller ? ' (rendered smaller to fit 50 MB)' : '') + (build.render_s ? ' · ' + mins(build.render_s) + ' to build' : '')); }
        else if (build.status === 'live') { vState = 'ok'; vText = esc('Live since ' + when(build.live_at)); }
        else if (build.status === 'failed') { vState = 'bad'; vText = 'Failed: ' + esc(build.message || ''); }
        else vText = 'Cancelled';
      }
      lines.push(step(2, 'Video', vState, vText));
      lines.push(step(3, 'Your OK', build && build.status === 'staged' ? 'run' : build && build.status === 'live' ? 'ok' : 'todo',
        build && build.status === 'staged' ? 'Watch it, then press Put live. Learners see the old video until then.' : build && build.status === 'live' ? 'Learners see this version.' : 'Nothing changes for learners until you press Put live.'));
    } else lines.push(step(2, 'Video', 'todo', 'Psychology lesson videos aren’t built by the video runner yet, so this makes the narration only.'));
    const busy = (job && (job.status === 'queued' || job.status === 'running')) || (build && (build.status === 'queued' || build.status === 'building'));
    const staged = build && build.status === 'staged';
    let preview = '';
    if (staged && window.AmrMedia) { const u = await window.AmrMedia(db()).url('course/content/' + ctx.module + '/videos/_new/' + ctx.lesson + '.mp4', true);
      preview = u ? '<video class="cb-video" controls preload="metadata" playsinline src="' + esc(u) + '"></video><p class="p-empty">The new version (not live).</p>' : '<p class="p-empty">The staged file isn’t in R2 yet. The PC may still be uploading it.</p>'; }
    if (!document.contains(box)) return;
    box.innerHTML = '<ol class="r31-steps">' + lines.join('') + '</ol>' + preview +
      '<div class="cb-row">' + (staged ? '<button type="button" class="p-btn" data-v="live">Put live</button><button type="button" class="p-btn is-ghost" data-v="drop">Throw away this version</button>' : '') +
      (busy ? '<button type="button" class="p-btn is-ghost" data-v="cancel">Cancel</button>' : '') + '<span class="p-empty" id="r31VMsg" role="status">' + (ctx.isDraft ? 'Your draft isn’t published. Narration and video use the published lesson.' : '') + '</span></div>' +
      (builds.length > 1 || jobs.length > 1 ? '<details class="r31-hist"><summary>Earlier versions</summary><ul>' +
        builds.slice(staged ? 1 : 0).map(b => '<li>' + esc('Video · ' + when(b.requested_at) + ' · ' + ({ live:'was live', staged:'ready', failed:'failed', cancelled:'thrown away', queued:'waiting', building:'building' }[b.status] || b.status) + (b.mb ? ' · ' + b.mb + ' MB' : '') + (b.old_dir ? ' · old video kept in ' + b.old_dir : '')) + '</li>').join('') +
        jobs.slice(1, 8).map(j => '<li>' + esc('Narration · ' + when(j.created_at) + ' · ' + j.status + (j.target && j.target.revoice ? ' · changed lines only' : '') + (j.gpu_seconds ? ' · ' + mins(j.gpu_seconds) + ' on ' + hostName(j.host) : '')) + '</li>').join('') +
        '</ul><p class="p-empty">Older narrations can be put back from Voice Studio › Projects › Versions.</p></details>' : '');
    const btn = document.querySelector('#pView [data-act="makevideo"]');
    if (btn) { btn.disabled = !!busy; btn.textContent = busy ? 'Making it…' : staged ? 'Make it again' : 'Make the video'; }
    box.onclick = e => { const b = e.target.closest('[data-v]'); if (b) videoAct(ctx, box, b, build, job); };
    if (busy && /^#builder\//.test(location.hash)) VID.timer = setTimeout(() => { if (document.contains(box)) videoCard(ctx, box); }, 5000);
  }
  async function makeVideo(ctx){
    const box = document.getElementById('r31Vid'); if (!box) return;
    await ctx.flush();
    const say = t => { const m = box.querySelector('#r31VMsg'); if (m) m.textContent = t; else toast(t); };
    const btn = document.querySelector('#pView [data-act="makevideo"]');
    if (btn && btn.dataset.sure !== '1') {
      btn.dataset.sure = '1';
      const rv = (ctx.revoice || []).find(r => r.item_id === ctx.lesson);
      btn.textContent = 'Sure? Make it';
      say((ctx.isDraft ? 'Your draft isn’t published, so this uses the published lesson. ' : '') +
        (rv ? 'First the ' + plural((rv.lines || []).length, 'changed line') + ' get voiced (the rest stay as they sound now), then ' : 'Narration first if it isn’t current, then ') +
        (ctx.course === 'acq' ? 'yukis-pc builds the video. It waits for your OK before learners see it.' : 'the Arabic narration is saved. No video step for Psychology yet.'));
      setTimeout(() => { if (btn.dataset.sure === '1') { btn.dataset.sure = ''; btn.textContent = 'Make the video'; } }, 8000);
      return;
    }
    if (btn) { btn.dataset.sure = ''; btn.disabled = true; btn.textContent = 'Queuing…'; }
    const jobs = await jobsFor(ctx.course, ctx.module, ctx.lesson), done = jobs.find(j => j.status === 'done');
    const rv = (ctx.revoice || []).find(r => r.item_id === ctx.lesson);
    let job = jobs.find(j => j.status === 'queued' || j.status === 'running'), revoice = false;
    if (!job && (rv || !done)) {
      const r = await queueNarration(ctx, !!(rv && done));
      if (r.error) { if (btn) btn.disabled = false; return say(r.error); }
      job = r.job; revoice = !!r.revoice;
    }
    if (ctx.course === 'acq') {
      const b = await safe(db().from('course_video_builds').insert({ course:'acq', module_id:ctx.module, lesson:ctx.lesson, narration_job:(job || done || {}).id || null, revoice,
        message:job ? 'Waits for the narration' : 'Waiting for the video runner' }).select('id').single());
      if (b.error) { if (btn) btn.disabled = false; return say(/one_open|duplicate/i.test(b.error.message || '') ? 'A video for this lesson is already being made.' : 'Couldn’t queue the video. ' + (b.error.message || '')); }
    }
    toast(ctx.course === 'acq' ? 'Queued. You’ll get a bell when the new video is ready for your OK.' : 'Arabic narration queued.');
    videoCard(ctx, box);
  }
  async function videoAct(ctx, box, b, build, job){
    const say = t => { const m = box.querySelector('#r31VMsg'); if (m) m.textContent = t; };
    const a = b.dataset.v;
    if (a === 'cancel') {
      b.disabled = true;
      if (job && (job.status === 'queued' || job.status === 'running')) await safe(db().from('voice_jobs').update({ status:'cancelled', message:'Cancelled' }).eq('id', job.id).in('status', ['queued', 'running']));
      if (build && (build.status === 'queued' || build.status === 'building')) await safe(db().from('course_video_builds').update({ status:'cancelled', message:'Cancelled by you' }).eq('id', build.id));
      return videoCard(ctx, box);
    }
    if (a === 'drop') {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Throw it away'; return; }
      b.disabled = true; const st = window.AmrMedia(db()).bucket('course'), base = 'content/' + ctx.module + '/videos/_new/' + ctx.lesson;
      await safe(st.remove([base + '.mp4', base + '.json', base + '.jpg']));
      await safe(db().from('course_video_builds').update({ status:'cancelled', message:'Thrown away by you' }).eq('id', build.id));
      toast('That version was thrown away. The live video is unchanged.'); return videoCard(ctx, box);
    }
    if (a === 'live') {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Learners get this video'; return; }
      b.disabled = true; b.textContent = 'Putting it live…';
      const r = await putLive(ctx.module, ctx.lesson);
      if (r.error) { b.disabled = false; b.dataset.sure = ''; b.textContent = 'Put live'; return say(r.error); }
      await safe(db().from('course_video_builds').update({ status:'live', old_dir:r.old || null, message:'Live' }).eq('id', build.id));
      await safe(db().from('course_video_builds').update({ status:'cancelled', message:'Replaced by a newer version' }).eq('course', 'acq').eq('module_id', ctx.module).eq('lesson', ctx.lesson).eq('status', 'live').neq('id', build.id));
      toast('Live. Learners see the new video the next time they open the lesson.' + (r.old ? ' The old one is kept in ' + r.old + '.' : ''));
      return videoCard(ctx, box);
    }
  }
  // One lesson's staged video, captions and cover move from videos/_new/ to where the course reads them; the live files move
  // to videos/_old/<time>/ first. All or nothing (the same steps as Voice Studio › Projects › Put live).
  async function putLive(m, id){
    const st = window.AmrMedia(db()).bucket('course'), base = 'content/' + m + '/videos/';
    const [lv, nw] = await Promise.all([safe(st.list('content/' + m + '/videos', { limit:1000 })), safe(st.list('content/' + m + '/videos/_new', { limit:1000 }))]);
    if (lv.error || nw.error) return { error:'Couldn’t read the video folders. Nothing was changed.' };
    const have = new Set((lv.data || []).map(o => o.name)), names = (nw.data || []).map(o => o.name).filter(n => n === id + '.mp4' || n === id + '.json' || n === id + '.jpg');
    if (!names.includes(id + '.mp4') || !names.includes(id + '.json')) return { error:'The new video or its captions aren’t saved yet. Try again in a minute.' };
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'), done = [];
    const mv = async (from, to) => { const r = await safe(st.move(from, to)); if (r.error) throw r.error; done.push([from, to]); };
    let moved = false;
    try {
      for (const ext of ['mp4', 'json', 'jpg']) { const n = id + '.' + ext; if (have.has(n) && (ext !== 'jpg' || names.includes(n))) { await mv(base + n, base + '_old/' + stamp + '/' + n); moved = true; } }
      for (const n of names) await mv(base + '_new/' + n, base + n);
    } catch(e) {
      for (const [from, to] of done.reverse()) await safe(st.move(to, from));
      return { error:'It didn’t go live, and everything was put back as it was. Try again.' };
    }
    return { old:moved ? 'videos/_old/' + stamp : '' };
  }

  // ======================================================================
  // V6: GPU time and cost
  // ======================================================================
  const hm = s => { s = Math.round(+s || 0); const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + ' h ' + m + ' min' : m + ' min'; };
  const monthName = k => { const [y, m] = String(k).split('-'); return new Date(+y, +m - 1, 1).toLocaleString('en-US', { month:'long', year:'numeric' }); };
  const COURSE = { acq:'Acquisitions', psy:'Psychology', mkt:'Marketing', other:'Scripts and tests' };
  async function costData(){ const r = await safe(db().rpc('voice_cost_summary', { p_months:6 })); if (r.error) throw r.error; return r.data || {}; }
  function costNote(d){
    const r = d.rates || {};
    return 'Estimates. Modal’s bill can’t be read from the portal, so cost is GPU time × ' + usd(r.modal) + ' an hour on Modal (L4 GPU, 4 CPU, 16 GB) and ' + usd(r.pc) +
      ' an hour of electricity on yukis-pc. Each cloud run also spends about ' + (r.modal_load_s || 72) + ' s starting the voice model, not counted per job. Check the real Modal bill at modal.com › Usage.';
  }
  async function renderCost(el, compact){
    el.innerHTML = '<p class="p-loading">Adding up GPU time…</p>';
    let d; try { d = await costData(); } catch(e) { el.innerHTML = PX.failed(e); return; }
    if (!document.contains(el)) return;
    const mo = d.months || [], cur = mo[0], prev = mo[1];
    const stat = (k, v, sub) => '<div class="r31-stat"><span>' + esc(k) + '</span><b>' + esc(v) + '</b><small>' + esc(sub || '') + '</small></div>';
    const top = cur ? '<div class="r31-stats">' + stat(monthName(cur.month), usd(cur.usd), 'estimated') + stat('GPU time', hm(cur.narr_s + cur.video_s), plural(cur.jobs, 'job')) +
      stat('Modal cloud', hm(cur.modal_s), usd(cur.modal_usd)) + stat('yukis-pc', hm(cur.pc_s), 'narration and video builds') + (prev ? stat(monthName(prev.month), usd(prev.usd), hm(prev.narr_s + prev.video_s)) : '') + '</div>' : empty('No GPU work recorded yet.');
    const guessed = mo.reduce((a, m) => a + (m.guessed || 0), 0);
    if (compact) {
      el.innerHTML = top + '<p class="p-empty">' + esc(costNote(d)) + '</p>' + (guessed ? '<p class="p-empty">' + esc(plural(guessed, 'older job') + ' ran before the worker said which machine it was on; those are judged by speed.') + '</p>' : '') +
        '<a class="p-btn is-ghost" href="#voice/cost">Per lesson and course</a>';
      return;
    }
    const lessons = d.lessons || [];
    el.innerHTML = top +
      '<h3 class="r31-h3">By month</h3><div class="r31-tw"><table class="p-table"><thead><tr><th>Month</th><th>Narration</th><th>Video builds</th><th>Modal</th><th>yukis-pc</th><th>Jobs</th><th>Cost</th></tr></thead><tbody>' +
        mo.map(m => '<tr><td>' + esc(monthName(m.month)) + '</td><td>' + esc(hm(m.narr_s)) + '</td><td>' + esc(hm(m.video_s)) + '</td><td>' + esc(hm(m.modal_s) + ' · ' + usd(m.modal_usd)) + '</td><td>' + esc(hm(m.pc_s)) + '</td><td>' + esc(m.jobs) + '</td><td><b>' + esc(usd(m.usd)) + '</b></td></tr>').join('') + '</tbody></table></div>' +
      '<h3 class="r31-h3">By course</h3><div class="r31-tw"><table class="p-table"><thead><tr><th>Course</th><th>Lessons</th><th>GPU time</th><th>Cost</th></tr></thead><tbody>' +
        (d.courses || []).map(c => '<tr><td>' + esc(COURSE[c.course] || c.course) + '</td><td>' + esc(c.lessons) + '</td><td>' + esc(hm(c.s)) + '</td><td><b>' + esc(usd(c.usd)) + '</b></td></tr>').join('') + '</tbody></table></div>' +
      '<h3 class="r31-h3">By lesson</h3><label class="sc-f px-inline">Find<input type="search" id="r31CostFind" placeholder="11.3 or m11"></label>' +
      '<div class="r31-tw"><table class="p-table" id="r31CostT"><thead><tr><th>Lesson</th><th>Course</th><th>Narration</th><th>Video</th><th>Runs</th><th>Cost</th></tr></thead><tbody>' +
        lessons.map(l => '<tr data-k="' + esc((l.module + ' ' + l.lesson + ' ' + (COURSE[l.course] || '')).toLowerCase()) + '"><td>' + esc(l.lesson) + ' <small>' + esc(l.module) + '</small></td><td>' + esc(COURSE[l.course] || l.course) + '</td><td>' + esc(hm(l.narr_s)) + (l.modal ? ' ' + pill('Modal', 'plain') : '') + '</td><td>' + esc(l.video_s ? hm(l.video_s) : '') + '</td><td>' + esc(l.runs) + '</td><td>' + esc(usd(l.usd)) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<p class="p-empty">' + esc(costNote(d)) + '</p>' + (guessed ? '<p class="p-empty">' + esc(plural(guessed, 'job') + ' ran before the worker said which machine it was on; those are judged by speed (the cloud GPU is faster than real time, the PC about 2x slower). Worker 0.7 records it exactly.') + '</p>' : '') +
      '<h3 class="r31-h3">Rates</h3><form id="r31Rates" class="cb-row"><label class="sc-f px-inline">Modal $ an hour<input type="number" step="0.01" min="0" name="modal" value="' + esc((d.rates || {}).modal) + '"></label>' +
        '<label class="sc-f px-inline">yukis-pc $ an hour<input type="number" step="0.001" min="0" name="pc" value="' + esc((d.rates || {}).pc) + '"></label><button class="p-btn is-ghost">Save rates</button><span class="p-empty" id="r31RMsg" role="status">New rates apply to jobs that finish from now on.</span></form>';
    const find = el.querySelector('#r31CostFind');
    if (find) find.oninput = () => { const f = find.value.trim().toLowerCase(); el.querySelectorAll('#r31CostT tbody tr').forEach(tr => { tr.hidden = !!f && !tr.dataset.k.includes(f); }); };
    const form = el.querySelector('#r31Rates');
    if (form) form.onsubmit = async e => {
      e.preventDefault(); const m = +form.modal.value, p = +form.pc.value, msg = form.querySelector('#r31RMsg');
      if (!(m >= 0 && p >= 0)) { msg.textContent = 'Use numbers of 0 or more.'; return; }
      const r = await safe(db().from('voice_settings').update({ modal_usd_per_hour:m, pc_usd_per_hour:p }).eq('id', 'main'));
      msg.textContent = r.error ? 'Couldn’t save. ' + (r.error.message || '') : 'Saved. New rates apply to jobs that finish from now on.';
    };
  }
  window.R31Cost = { render:renderCost };

  // Status page: a GPU cost card next to the other checks (owner)
  const st = V.status;
  if (st && !st.r31) {
    const open0 = st.open;
    V.status = Object.assign({}, st, { r31:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok() || !PX.isOwner()) return;
      const body = el.querySelector('.px-body'); if (!body) return;
      const box = document.createElement('section'); box.className = 'p-card'; box.id = 'r31Cost';
      box.innerHTML = '<div class="p-card-head"><h2>GPU time and cost</h2><span>Narration and lesson videos</span></div><div></div>';
      const more = body.querySelector('#r17More'); if (more) more.after(box); else body.appendChild(box);
      renderCost(box.lastElementChild, true);
    } });
  }

  // ======================================================================
  // Into the builder
  // ======================================================================
  const CB = window.CourseBuilder;
  if (CB && CB.hooks) {
    CB.hooks.quiz = ctx => openQuiz(ctx, ctx.course === 'acq' ? 'q:' + ctx.lesson : ctx.course === 'mkt' ? 'mkt' : null);
    CB.hooks.makeVideo = ctx => makeVideo(ctx);
    CB.hooks.afterDraw = (ctx, body) => {
      const m = body.querySelector('#r31Mod'); if (m && !ctx.lesson) moduleCards(ctx, m);
      const v = body.querySelector('#r31Vid'); if (v && ctx.lesson) videoCard(ctx, v);
    };
  }
})();
