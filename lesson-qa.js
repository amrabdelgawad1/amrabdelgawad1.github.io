// Round 29 (plan E1 and I16): questions under each lesson, and "where you left off", for every course player
// (/course for Acquisitions, /app/course for Marketing, /app/psychology for Psychology).
//
//   LessonQA.mount(box, { db, course, module, item, title, sub, link, owner, lang })
//     course  'acq' | 'mkt' | 'psy' (a future course uses its own access key)
//     title   the lesson's name as the learner sees it; sub: its module ("Module 3")
//     link    where the lesson lives, e.g. '/course/#/m/m3/l/3.2' (the bell sends people back here)
//     owner   Amr (not in "View as learner"): answers, edits, hides and deletes right here too
//
// What each person sees (the database enforces it, lesson_questions read rule):
//   everyone with the course: every answered question on this lesson, from anyone, unless Amr hid it
//   the learner: their own questions while they wait for an answer (and can take one back)
//   Amr: everything, hidden ones too, with Answer, Edit, Hide and Delete
// Asking rings Amr's bell (kind qa_question) and his answer rings the learner's (qa_answer); both follow
// Settings › Notifications › "Learning and reviews". Amr's full list is /app/#questions.
// Opening a lesson also saves it as this person's place in the course (learn_place_save), which the
// Learning Hub's "Continue where you left off" card reads (my_resume).
(function(){
  'use strict';
  if (window.LessonQA) return;
  const W = {
    head:['Questions about this lesson', 'أسئلة حول هذا الدرس'],
    note:['Stuck on something here? Ask Amr. Once he answers, the answer stays on this lesson for everyone taking the course.', 'هل توقفت عند شيء هنا؟ اسأل عمرو. بعد أن يجيب، تبقى الإجابة على هذا الدرس لكل من يدرس الكورس.'],
    noteOwner:['Learners ask here. Answered questions stay on this lesson for everyone with the course. Your full list is in the portal under Lesson questions.', 'يسأل المتعلمون هنا. الأسئلة المُجاب عنها تبقى على هذا الدرس لكل من لديه الكورس. قائمتك الكاملة في البوابة تحت أسئلة الدروس.'],
    none:['No questions on this lesson yet.', 'لا توجد أسئلة على هذا الدرس بعد.'],
    ph:['Type your question about this lesson', 'اكتب سؤالك عن هذا الدرس'],
    ask:['Ask Amr', 'اسأل عمرو'], sending:['Sending…', 'جارٍ الإرسال…'],
    sent:['Sent. You’ll get a bell when Amr answers.', 'تم الإرسال. سيصلك تنبيه عندما يجيب عمرو.'],
    tooShort:['Write a little more in your question.', 'اكتب المزيد في سؤالك.'],
    failed:['Couldn’t send it. Try again.', 'تعذّر الإرسال. حاول مرة أخرى.'],
    waiting:['Waiting for Amr’s answer', 'بانتظار إجابة عمرو'], answer:['Amr’s answer', 'إجابة عمرو'],
    takeBack:['Take it back', 'اسحب السؤال'], you:['You', 'أنت'], someone:['A learner', 'متعلّم'],
    answerBtn:['Answer', 'أجب'], edit:['Edit answer', 'عدّل الإجابة'], save:['Save answer', 'احفظ الإجابة'], cancel:['Cancel', 'إلغاء'],
    hide:['Hide', 'إخفاء'], show:['Show again', 'أظهر مجدداً'], del:['Delete', 'حذف'], hidden:['Hidden from learners', 'مخفي عن المتعلمين'],
    answerPh:['Write your answer. Learners see it under this lesson.', 'اكتب إجابتك. سيراها المتعلمون تحت هذا الدرس.'],
    deleted:['Question deleted.', 'حُذف السؤال.'], takenBack:['Question taken back.', 'سُحب السؤال.'],
    loadFail:['Couldn’t load the questions. Reload to try again.', 'تعذّر تحميل الأسئلة. أعد التحميل للمحاولة.']
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const para = s => esc(s).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  let me = null;
  async function myId(db){
    if (me) return me;
    try { const { data } = await db.auth.getSession(); me = data && data.session ? data.session.user.id : null; } catch (e) {}
    return me;
  }
  function when(at, ar){
    if (window.PortalUI && window.PortalUI.when) return window.PortalUI.when(at, { zone:false });
    try { return new Date(at).toLocaleString(ar ? 'ar-EG' : 'en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true }); } catch (e) { return ''; }
  }
  function toast(t){ if (window.PortalUI && window.PortalUI.toast) window.PortalUI.toast(t); }

  async function mount(box, o){
    if (!box || !o || !o.db) return;
    const ar = o.lang === 'ar', w = k => W[k][ar ? 1 : 0], db = o.db, owner = !!o.owner;
    // where this person is in the course (for the Hub's resume card); quiet if it fails
    if (o.title) db.rpc('learn_place_save', { p_course:o.course, p_module:String(o.module), p_item:String(o.item || ''), p_title:o.title, p_sub:o.sub || '', p_href:o.link || location.pathname + location.hash }).then(() => {}, () => {});
    const uid = await myId(db);
    let rows = [], names = {}, editing = null;

    async function load(){
      const r = await db.from('lesson_questions').select('id,asker,body,answer,answered_at,hidden,created_at')
        .eq('course', o.course).eq('module_id', String(o.module)).eq('item_id', String(o.item || '')).order('created_at').then(x => x, e => ({ error:e }));
      if (r.error) { if (/lesson_questions/.test((r.error && r.error.message) || '')) { box.innerHTML = ''; return false; } box.innerHTML = '<section class="lqa"><p class="lqa-note">' + esc(w('loadFail')) + '</p></section>'; return false; }
      rows = r.data || [];
      const ids = rows.filter(q => q.asker !== uid).map(q => q.id);
      if (ids.length) { const n = await db.rpc('lesson_question_names', { p_ids:ids }).then(x => x, () => ({})); (n.data || []).forEach(x => names[x.id] = x.name); }
      return true;
    }
    function item(q){
      const mine = q.asker === uid, who = mine ? w('you') : (names[q.id] || w('someone'));
      const head = '<div class="lqa-meta"><b>' + esc(who) + '</b><span>' + esc(when(q.created_at, ar)) + '</span>' + (q.hidden ? '<span class="lqa-pill">' + esc(w('hidden')) + '</span>' : '') + '</div>';
      const ans = editing === q.id
        ? '<div class="lqa-ans is-edit"><textarea class="lqa-in" data-ans-in="' + q.id + '" rows="4" placeholder="' + esc(w('answerPh')) + '" aria-label="' + esc(w('answer')) + '">' + esc(q.answer || '') + '</textarea>' +
          '<div class="lqa-row"><button type="button" class="lqa-btn" data-save="' + q.id + '">' + esc(w('save')) + '</button><button type="button" class="lqa-btn is-ghost" data-cancel>' + esc(w('cancel')) + '</button></div></div>'
        : q.answer ? '<div class="lqa-ans"><span class="lqa-k">' + esc(w('answer')) + (q.answered_at ? ' · ' + esc(when(q.answered_at, ar)) : '') + '</span><p>' + para(q.answer) + '</p></div>'
        : '<p class="lqa-wait">' + esc(w('waiting')) + '</p>';
      const acts = owner
        ? '<div class="lqa-row lqa-acts"><button type="button" class="lqa-link" data-edit="' + q.id + '">' + esc(w(q.answer ? 'edit' : 'answerBtn')) + '</button>' +
          '<button type="button" class="lqa-link" data-hide="' + q.id + '" data-to="' + (!q.hidden) + '">' + esc(w(q.hidden ? 'show' : 'hide')) + '</button>' +
          '<button type="button" class="lqa-link is-no" data-del="' + q.id + '">' + esc(w('del')) + '</button></div>'
        : mine && !q.answer ? '<div class="lqa-row lqa-acts"><button type="button" class="lqa-link is-no" data-back="' + q.id + '">' + esc(w('takeBack')) + '</button></div>' : '';
      return '<li class="lqa-q' + (q.answer ? '' : ' is-open') + (q.hidden ? ' is-hidden' : '') + '" data-id="' + q.id + '">' + head + '<p class="lqa-body">' + para(q.body) + '</p>' + ans + (editing === q.id ? '' : acts) + '</li>';
    }
    function draw(){
      // answered first (oldest first, so the thread reads in order), then the ones still waiting
      const list = rows.filter(q => q.answer).concat(rows.filter(q => !q.answer));
      box.innerHTML = '<section class="lqa" aria-labelledby="lqaH"><h2 class="lqa-h" id="lqaH">' + esc(w('head')) + (list.length ? ' <span class="lqa-count">' + list.length + '</span>' : '') + '</h2>' +
        '<p class="lqa-note">' + esc(w(owner ? 'noteOwner' : 'note')) + '</p>' +
        (list.length ? '<ul class="lqa-list">' + list.map(item).join('') + '</ul>' : '<p class="lqa-empty">' + esc(w('none')) + '</p>') +
        (owner ? '' : '<form class="lqa-form" novalidate><textarea class="lqa-in" rows="3" maxlength="2000" placeholder="' + esc(w('ph')) + '" aria-label="' + esc(w('ph')) + '"></textarea>' +
          '<div class="lqa-row"><button type="submit" class="lqa-btn">' + esc(w('ask')) + '</button><span class="lqa-msg" role="status" aria-live="polite"></span></div></form>') +
        '</section>';
      if (editing) { const t = box.querySelector('[data-ans-in]'); if (t) t.focus(); }
    }
    async function rpc(name, args){ const r = await db.rpc(name, args).then(x => x, e => ({ error:e })); if (r.error) throw r.error; return r.data; }
    const reload = async () => { if (await load()) draw(); };

    box.onclick = async e => {
      const b = e.target.closest('button'); if (!b || b.type === 'submit') return;
      const id = +(b.dataset.edit || b.dataset.save || b.dataset.hide || b.dataset.del || b.dataset.back || 0);
      try {
        if (b.dataset.edit) { editing = id; draw(); }
        else if (b.hasAttribute('data-cancel')) { editing = null; draw(); }
        else if (b.dataset.save) { b.disabled = true; await rpc('lesson_question_answer', { p_id:id, p_answer:box.querySelector('[data-ans-in="' + id + '"]').value }); editing = null; await reload(); }
        else if (b.dataset.hide) { b.disabled = true; await rpc('lesson_question_hide', { p_id:id, p_hidden:b.dataset.to === 'true' }); await reload(); }
        else if (b.dataset.del || b.dataset.back) {
          const keep = rows.slice(), gone = () => { rows = rows.filter(q => q.id !== id); draw(); };
          const commit = () => rpc('lesson_question_delete', { p_id:id }).catch(err => { rows = keep; draw(); toast(err.message || w('failed')); });
          if (window.PortalUI && window.PortalUI.undo) window.PortalUI.undo({ text:w(b.dataset.del ? 'deleted' : 'takenBack'), hide:gone, restore:() => { rows = keep; draw(); }, commit });
          else { gone(); await commit(); }
        }
      } catch (err) { b.disabled = false; toast((err && err.message) || w('failed')); }
    };
    box.onsubmit = async e => {
      e.preventDefault();
      const f = e.target, ta = f.querySelector('textarea'), btn = f.querySelector('button'), msg = f.querySelector('.lqa-msg'), v = ta.value.trim();
      if (v.length < 3) { msg.textContent = w('tooShort'); ta.focus(); return; }
      btn.disabled = true; btn.textContent = w('sending');
      try {
        await rpc('lesson_question_ask', { p_course:o.course, p_module:String(o.module), p_item:String(o.item || ''), p_title:o.title || '', p_link:o.link || location.pathname + location.hash, p_body:v });
        await reload();
        const m2 = box.querySelector('.lqa-msg'); if (m2) m2.textContent = w('sent');
      } catch (err) { btn.disabled = false; btn.textContent = w('ask'); msg.textContent = (err && err.message && !/permission|42501/i.test(err.message)) ? err.message : w('failed'); }
    };
    if (await load()) draw();
  }
  window.LessonQA = { mount };
})();
