// Round 29 of the Portal Master Feature Plan (Nov 19 2026): learners.
//   #questions   E1  Lesson questions, Amr only: every question asked under a lesson in any course, waiting ones first.
//                    Answer, edit, hide (learners stop seeing it) or delete (with Undo). The bell link for a new question
//                    (#questions/<id>) opens here on that question. Answers show under the lesson for everyone with the course.
//   Waiting      the command center's "Waiting for you" gets "N lesson questions to answer" (R29Learn.waits).
//   Search       answered questions are searchable by everyone who can read them (R29Learn.search, used by team-plus.js).
// The learner side lives in /lesson-qa.js (mounted by the three course players). The Hub's resume card, Request access and
// practice-call link are in app/learn/hub.js; practice-call self-scoring in scoring.js and review.js; nudges are a cron job
// (private.study_nudges, talents-study-nudges, daily 14:25 UTC). Nothing here sends an email.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, card, empty, failed, say } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const COURSE = { acq:'Acquisitions', mkt:'Marketing', psy:'Psychology' };
  const when = at => window.PortalUI ? window.PortalUI.when(at, { zone:false }) : new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
  const para = s => esc(s).replace(/\n/g, '<br>');

  let rows = [], filter = 'waiting', editing = null;
  V.questions = { title:'Lesson questions', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Learning', 'Lesson questions', 'Questions learners ask under a lesson. Once you answer, the answer stays under that lesson for everyone with the course. Hidden questions stop showing to learners.');
    const r = await safe(db().rpc('lesson_questions_admin'));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    rows = r.data || []; editing = null;
    const focus = +(location.hash.split('/')[1] || 0);
    if (focus && rows.some(q => q.id === focus)) { const q = rows.find(x => x.id === focus); filter = q.hidden ? 'hidden' : q.answer ? 'answered' : 'waiting'; }
    draw(body, focus);
    body.onclick = e => click(e, body);
  }};

  function counts(){ return { waiting:rows.filter(q => !q.answer && !q.hidden).length, answered:rows.filter(q => q.answer && !q.hidden).length, hidden:rows.filter(q => q.hidden).length, all:rows.length }; }
  function draw(body, focus){
    const n = counts(), list = rows.filter(q => filter === 'all' || (filter === 'hidden' ? q.hidden : !q.hidden && (filter === 'waiting' ? !q.answer : !!q.answer)));
    body.innerHTML = '<div class="p-seg r29-seg" role="group" aria-label="Show">' + [['waiting', 'Waiting'], ['answered', 'Answered'], ['hidden', 'Hidden'], ['all', 'All']]
        .map(([k, l]) => '<button type="button" class="p-seg-b" data-f="' + k + '" aria-pressed="' + (filter === k) + '">' + l + ' <b>' + n[k] + '</b></button>').join('') + '</div>' +
      (list.length ? '<div class="r29-qs">' + list.map(q => item(q, q.id === focus)).join('') + '</div>'
        : card(filter === 'waiting' ? 'Nothing waiting' : 'Nothing here', '', empty(filter === 'waiting' ? 'No questions are waiting for an answer.' : 'No questions in this list yet.')));
    const f = focus && body.querySelector('[data-q="' + focus + '"]'); if (f) f.scrollIntoView({ block:'center' });
    if (editing) { const t = body.querySelector('[data-ans="' + editing + '"]'); if (t) t.focus(); }
  }
  function item(q, hot){
    const ed = editing === q.id || (!q.answer && !q.hidden && editing == null && hot);
    return '<section class="p-card r29-q' + (hot ? ' is-hot' : '') + (q.hidden ? ' is-hidden' : '') + '" data-q="' + q.id + '">' +
      '<div class="r29-q-top"><span class="p-pill is-plain">' + esc(COURSE[q.course] || q.course) + '</span>' +
        (q.lesson_link ? '<a href="' + esc(q.lesson_link) + '">' + esc(q.lesson_title || 'Open the lesson') + '</a>' : '<span>' + esc(q.lesson_title || '') + '</span>') +
        (q.hidden ? '<span class="p-pill is-no">Hidden</span>' : q.answer ? '<span class="p-pill is-ok">Answered</span>' : '<span class="p-pill">Waiting</span>') + '</div>' +
      '<p class="r29-q-who"><b>' + esc(q.asker_name || 'A learner') + '</b> · ' + esc(when(q.created_at)) + '</p>' +
      '<p class="r29-q-body">' + para(q.body) + '</p>' +
      (ed ? '<label class="r29-vh" for="ans' + q.id + '">Your answer</label><textarea class="r29-in" id="ans' + q.id + '" data-ans="' + q.id + '" rows="4" maxlength="4000" placeholder="Write your answer. Learners see it under this lesson.">' + esc(q.answer || '') + '</textarea>' +
          '<div class="r29-acts"><button type="button" class="p-btn" data-save="' + q.id + '">Save answer</button>' + (q.answer ? '<button type="button" class="p-btn is-ghost" data-cancel>Cancel</button>' : '') + '</div>'
        : q.answer ? '<div class="r29-ans"><span>Your answer' + (q.answered_at ? ' · ' + esc(when(q.answered_at)) : '') + '</span><p>' + para(q.answer) + '</p></div>' : '') +
      '<div class="r29-acts">' + (ed ? '' : '<button type="button" class="p-btn is-ghost" data-edit="' + q.id + '">' + (q.answer ? 'Edit answer' : 'Answer') + '</button>') +
        '<button type="button" class="p-btn is-ghost" data-hide="' + q.id + '" data-to="' + !q.hidden + '">' + (q.hidden ? 'Show again' : 'Hide') + '</button>' +
        '<button type="button" class="p-btn is-ghost r29-no" data-del="' + q.id + '">Delete</button></div></section>';
  }
  async function click(e, body){
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.f) { filter = b.dataset.f; editing = null; return draw(body); }
    if (b.dataset.edit) { editing = +b.dataset.edit; return draw(body); }
    if (b.hasAttribute('data-cancel')) { editing = -1; draw(body); editing = null; return; }
    const id = +(b.dataset.save || b.dataset.hide || b.dataset.del || 0); if (!id) return;
    const q = rows.find(x => x.id === id); if (!q) return;
    if (b.dataset.save) {
      const v = (body.querySelector('[data-ans="' + id + '"]').value || '').trim();
      if (!v) { say('Write the answer first.', true); return; }
      b.disabled = true;
      const r = await safe(db().rpc('lesson_question_answer', { p_id:id, p_answer:v }));
      if (r.error) { b.disabled = false; say('Couldn’t save the answer. Try again.', true); return; }
      const first = !q.answer; q.answer = v; q.answered_at = q.answered_at || new Date().toISOString(); editing = null; draw(body);
      say(first ? 'Answered. The learner gets a bell, and the answer now shows under the lesson.' : 'Answer updated.');
    } else if (b.dataset.hide) {
      b.disabled = true;
      const to = b.dataset.to === 'true', r = await safe(db().rpc('lesson_question_hide', { p_id:id, p_hidden:to }));
      if (r.error) { b.disabled = false; say('Couldn’t change that. Try again.', true); return; }
      q.hidden = to; draw(body); say(to ? 'Hidden from learners.' : 'Showing again.');
    } else if (b.dataset.del) {
      const keep = rows.slice();
      const commit = () => safe(db().rpc('lesson_question_delete', { p_id:id })).then(r => { if (r.error) { rows = keep; draw(body); say('Couldn’t delete it. It was put back.', true); } });
      if (window.PortalUI) window.PortalUI.undo({ text:'Question deleted.', hide:() => { rows = rows.filter(x => x.id !== id); draw(body); }, restore:() => { rows = keep; draw(body); }, commit });
      else { rows = rows.filter(x => x.id !== id); draw(body); commit(); }
    }
  }

  // Command center: how many are waiting
  async function waits(d){
    const r = await safe((d || db()).from('lesson_questions').select('id', { count:'exact', head:true }).is('answer', null).eq('hidden', false));
    const n = r.count || 0;
    return n ? [{ tag:'Learning', text:n + (n === 1 ? ' lesson question' : ' lesson questions') + ' to answer', href:'#questions', act:'Answer' }] : [];
  }
  // Search: answered questions anyone can read (Amr also finds waiting ones)
  async function search(d){
    const r = await safe((d || db()).from('lesson_questions').select('id,course,lesson_title,lesson_link,body,answer').order('created_at', { ascending:false }).limit(300));
    const owner = PX.isOwner && PX.isOwner();
    return (r.data || []).filter(q => q.answer || owner).map(q => ({ kind:'Question', title:q.body.length > 90 ? q.body.slice(0, 88) + '…' : q.body,
      sub:[COURSE[q.course] || q.course, q.lesson_title].filter(Boolean).join(' · '), text:(q.answer || ''), href:owner ? '#questions/' + q.id : (q.lesson_link || '/app/learn/') }));
  }
  window.R29Learn = { waits, search };
})();
