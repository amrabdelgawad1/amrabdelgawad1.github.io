// Admin (Amr only): learners, quiz attempts, drill reviews, and adding modules.
// Routes under #/admin:
//   #/admin                         learners and drills waiting for review
//   #/admin/u/<user>                one learner
//   #/admin/u/<user>/a/<attempt>    one quiz attempt, with the correct options
//   #/admin/u/<user>/s/<mod>/<item> one drill, with the reviewer answer key; approve or return
//   #/admin/add                     add or update a module from module-N.json, then its images
// The database refuses all of this for anyone else (course_require_admin).
(function(){
  'use strict';
  const A = window.CourseApp;
  if (!A) return;
  const { esc, IC, header, mount, msgView, chip, bar, pct, plural, when, dateTime, toast, errText, rpc, db } = A;
  const $ = id => document.getElementById(id);
  const initials = n => (n || '?').split(/[\s@.]+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const back = (href, label) => ({ back:href, backLabel:label });
  // "Quiz 1.1", "Quiz 1.2 Session 5", or the checkpoint's own title
  const quizName = a => {
    if (a.kind === 'checkpoint') return a.lessonTitle || a.title;
    const m = String(a.lessonTitle || '').match(/^([\d.]+(?: Session \d+)?)/);
    return m ? 'Quiz ' + m[1] : (a.title || 'Quiz');
  };

  async function waiting(){ return (await rpc('course_admin_waiting')).length; }

  async function homeView(){
    const at = location.hash;
    msgView('Loading learners…', { header:header(Object.assign(back('#/', 'Back to course home'), { ctx:'Admin', title:'Learners' })) });
    let people, wait, vids;
    try { [people, wait, vids] = await Promise.all([rpc('course_admin_learners'), rpc('course_admin_waiting'), rpc('course_admin_videos', { p_user:null }).catch(() => [])]); }
    catch(e){ return msgView(errText(e), { retry:true, at }); }
    const vSum = {};
    (vids || []).forEach(v => { const o = vSum[v.userId] || (vSum[v.userId] = { started:0, done:0 }); o.started++; if (v.completedAt) o.done++; });
    const rows = people.map(p => {
      const vs = vSum[p.userId];
      const cp = p.checkpoint ? 'Checkpoint ' + p.checkpoint.score + '%' : 'No checkpoint yet';
      return '<li><a class="person" href="#/admin/u/' + esc(p.userId) + '"><span class="av" aria-hidden="true">' + esc(initials(p.name)) + '</span><span class="txt">' +
        '<span class="n">' + esc(p.name) + '</span>' +
        '<span class="m">' + (p.module ? 'Module ' + p.module + ' · ' + pct(p.done, p.total) + '% done' : 'Not started') + ' · ' + (p.lastActive ? 'active ' + when(p.lastActive) : 'never active') + '</span>' +
        '<span class="m">' + esc(cp) + (p.hasAccess ? '' : ' · access switched off') + ' · ' + (vs ? plural(vs.done, 'video') + ' finished, ' + vs.started + ' started' : 'no videos watched') + '</span>' +
        (p.module ? '<span class="mini" aria-hidden="true"><i data-w="' + pct(p.done, p.total) + '"></i></span>' : '') + '</span>' +
        (p.checkpoint ? chip(p.checkpoint.passed ? 'Passed' : 'Not passed', p.checkpoint.passed ? 'ok' : 'warm') : '') + '</a></li>';
    }).join('');
    const waitRows = wait.map(w => '<li><a class="person" href="#/admin/u/' + esc(w.userId) + '/s/' + esc(w.moduleId) + '/' + esc(w.itemId) + '"><span class="av" aria-hidden="true">' + esc(initials(w.name)) + '</span>' +
      '<span class="txt"><span class="n">' + esc(w.name) + '</span><span class="m">' + esc(w.title || 'Written drill') + ' · sent ' + when(w.submittedAt) + '</span></span>' + chip('Review', 'warm') + '</a></li>').join('');
    mount(header(Object.assign(back('#/', 'Back to course home'), { ctx:'Admin', title:'Learners', menu:true })) +
      '<main id="main" class="col"><div class="page">' +
        '<h1 class="display">Admin</h1>' +
        '<section class="card stat" aria-labelledby="waitH"><span class="big">' + wait.length + '</span><span class="stack" data-s="g2"><b id="waitH">' + (wait.length === 1 ? 'Drill waiting for review' : 'Drills waiting for review') + '</b>' +
          '<span class="small muted">' + (wait.length ? 'Oldest first, below.' : 'Nothing to review right now.') + '</span></span></section>' +
        (wait.length ? '<section class="stack" aria-labelledby="wH"><h2 class="sub" id="wH">Waiting for you</h2><ul class="people">' + waitRows + '</ul></section>' : '') +
        '<section class="stack" aria-labelledby="lH"><h2 class="sub" id="lH">Learners (' + people.length + ')</h2>' +
          (people.length ? '<ul class="people">' + rows + '</ul>' : '<p class="note">No one has the course yet. Switch on Acquisitions course for someone in the Talents app, under Invite and access.</p>') + '</section>' +
        '<section class="card stack"><h2 class="sub">Modules</h2><p class="note">' + A.S.modules.map(m => 'Module ' + m.number + ': ' + esc(m.title)).join('<br>') + '</p>' +
          '<a class="btn line" href="#/admin/add">Add or update a module</a></section>' +
      '</div></main>', { title:'Admin', at });
  }

  async function learnerView(uid){
    const at = location.hash;
    msgView('Loading…', { header:header(Object.assign(back('#/admin', 'Back to learners'), { ctx:'Admin', title:'Learner' })) });
    let L, V;
    try { [L, V] = await Promise.all([rpc('course_admin_learner', { p_user:uid }), rpc('course_admin_videos', { p_user:uid }).catch(() => [])]); } catch(e){ return msgView(errText(e), { retry:true, at }); }
    const mmss = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const vids = (V || []).map(v => '<li><div class="item"><span class="txt"><span class="n">' + esc(v.title || ('Lesson ' + v.itemId)) + '</span>' +
      '<span class="m">' + v.pct + '% watched (' + mmss(v.watched) + ' of ' + mmss(v.duration) + ')' + (v.completedAt ? '' : ' · stopped at ' + mmss(v.position)) + ' · last watched ' + when(v.updatedAt) + '</span>' +
      '<span class="mini" aria-hidden="true"><i data-w="' + v.pct + '"></i></span></span>' +
      (v.completedAt ? chip('Finished', 'ok') : chip('In progress', 'warm')) + '</div></li>').join('');
    const mods = L.modules.filter(m => m.open || m.done).map(m => '<div class="stack" data-s="g6"><div class="between"><b class="small">Module ' + m.number + ': ' + esc(m.title) + '</b><span class="small muted">' + m.done + ' of ' + m.total + '</span></div>' + bar(pct(m.done, m.total)) + '</div>').join('');
    const subs = L.submissions.map(s => '<li><a class="item" href="#/admin/u/' + esc(uid) + '/s/' + esc(s.moduleId) + '/' + esc(s.itemId) + '"><span class="txt"><span class="n">' + esc(s.title || 'Written drill') + '</span>' +
      '<span class="m">' + (s.submittedAt ? 'Sent ' + dateTime(s.submittedAt) : 'Not sent yet') + (s.fileName ? ' · file attached' : '') + '</span></span>' + statusChip(s.status) + '</a></li>').join('');
    const atts = L.attempts.map(a => '<li><a class="item" href="#/admin/u/' + esc(uid) + '/a/' + esc(a.id) + '"><span class="txt"><span class="n">' + esc(quizName(a)) + '</span>' +
      '<span class="m">' + a.score + '% · ' + a.correct + ' of ' + a.total + ' · ' + dateTime(a.finishedAt) + ' · ' + duration(a.startedAt, a.finishedAt) + '</span></span>' +
      (a.abandoned ? chip('Started over', 'err') : chip(a.passed ? 'Passed' : 'Not passed', a.passed ? 'ok' : 'err')) + '</a></li>').join('');
    mount(header(Object.assign(back('#/admin', 'Back to learners'), { ctx:'Admin', title:L.name })) +
      '<main id="main" class="col"><div class="page">' +
        '<div class="stack" data-s="g4"><h1 data-s="h22">' + esc(L.name) + '</h1><span class="small muted">' + esc(L.email || '') + '</span></div>' +
        '<section class="card stack" aria-label="Progress">' + (mods || '<p class="note">No progress yet.</p>') + '</section>' +
        '<section class="stack" aria-labelledby="vH"><h2 class="sub" id="vH">Lesson videos (' + (V || []).length + ')</h2>' + (vids ? '<ul class="items">' + vids + '</ul><p class="note">Only time actually played counts, so skipping ahead does not add to the percentage. Finished means 90% or more.</p>' : '<p class="note">No lesson videos watched yet.</p>') + '</section>' +
        '<section class="stack" aria-labelledby="sH"><h2 class="sub" id="sH">Written drills</h2>' + (subs ? '<ul class="items">' + subs + '</ul>' : '<p class="note">Nothing started yet.</p>') + '</section>' +
        '<section class="stack" aria-labelledby="aH"><h2 class="sub" id="aH">Quiz attempts (' + L.attempts.length + ')</h2>' + (atts ? '<ul class="items">' + atts + '</ul>' : '<p class="note">No finished quizzes yet.</p>') + '</section>' +
        '<section class="stack" aria-labelledby="cH" id="certBox"><h2 class="sub" id="cH">Certification</h2><p class="note">Loading…</p></section>' +
      '</div></main>', { title:L.name, at });
    certSection(uid, L, at);
  }

  // ---------- Certification: requirements, live-call checklist, issue, renew, final-exam unlock ----------
  async function certSection(uid, L, at){
    const box = $('certBox'); if (!box) return;
    let rd, live, ren;
    try { [rd, live, ren] = await Promise.all([rpc('certificate_readiness', { p_user:uid }), rpc('certificate_live_get', { p_user:uid }), rpc('certificate_renewal_status', { p_user:uid })]); }
    catch(e){ if (location.hash === at) box.innerHTML = '<h2 class="sub">Certification</h2><p class="err">' + esc(errText(e)) + '</p>'; return; }
    if (location.hash !== at) return;
    const r = Array.isArray(rd) ? rd[0] || {} : rd || {};
    const row = (ok, text) => '<li class="between"><span class="small">' + esc(text) + '</span>' + chip(ok ? 'Done' : 'Not yet', ok ? 'ok' : 'warm') + '</li>';
    const reqs = '<ul class="stack" data-s="g6">' +
      row(r.checkpoints >= r.checkpoints_needed, 'Checkpoints at 85%: ' + (r.checkpoints || 0) + ' of ' + (r.checkpoints_needed || 19)) +
      row(r.final_exam, 'Final exam at 85%') +
      row(r.capstone, 'Capstone deal file approved') +
      row(r.calls_40 >= 3, 'Three certification calls at 40+ with no area below 3: ' + (r.calls_40 || 0) + ' (' + plural(r.roleplays || 0, 'role-play') + (r.real_calls ? ', a real call can count for one' : '') + ')') +
      row(r.calls_45 >= 1, 'At least one of them at 45+' + (r.best_call ? ' (best ' + r.best_call + ')' : '')) +
      row(r.human_scored >= 1, 'At least one scored by you') +
      row(r.compliance, 'Compliance quizzes passed') +
      row(r.live_signed, 'Live-call readiness checklist signed') + '</ul>';
    const cb = (id, on, text) => '<label class="row" data-s="g8"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="small">' + esc(text) + '</span></label>';
    const liveHtml = '<div class="card stack" data-s="g8"><b class="small">Live-call readiness checklist</b>' +
      '<p class="note">' + (live.complianceQuiz ? 'Compliance quizzes passed (' : 'Compliance quizzes not passed yet (') + esc((live.complianceItems || []).join(', ')) + ').</p>' +
      cb('lcDisc', live.disclosure, 'The disclosure is read correctly on a recorded call') +
      cb('lcCall', live.call, 'One call scores 40+ with no area below 3') +
      cb('lcCrm', live.crm, 'The CRM notes are clean on a practice queue') +
      '<label class="small" for="lcNote">Note (optional)</label><textarea id="lcNote" rows="2">' + esc(live.note || '') + '</textarea>' +
      (live.signedAt ? '<p class="note">Signed ' + dateTime(live.signedAt) + (live.signedBy ? ' by ' + esc(live.signedBy) : '') + '. Changing a box removes the signature.</p>' : '') +
      '<div class="row"><button class="btn line" type="button" data-act="liveSave">Save</button><button class="btn orange" type="button" data-act="liveSign">Sign</button></div></div>';
    let certHtml;
    if (ren && ren.certified) {
      certHtml = '<div class="card stack" data-s="g8"><b class="small">Certificate ' + esc(ren.code) + '</b>' +
        '<p class="note">Valid until ' + esc(ren.validUntil) + (ren.due ? ' (renewal due)' : '') + '. For renewal, since ' + esc(ren.since) + ': ' +
        (ren.callOk ? 'new call 40+ done' : 'needs one new call scored 40+') + ', ' + (ren.quizOk ? 'Lesson 20.5 quiz passed' : 'needs the Lesson 20.5 quiz') + '.</p>' +
        '<button class="btn orange" type="button" data-act="renew"' + (ren.canRenew ? '' : ' disabled') + '>Renew for one year</button></div>';
    } else {
      certHtml = '<div class="card stack" data-s="g8"><b class="small">Issue the certificate</b>' +
        '<label class="small" for="certName">Name as it should appear</label><input id="certName" type="text" maxlength="80" value="' + esc(L.name || '') + '">' +
        '<button class="btn orange" type="button" data-act="issue"' + (r.ready ? '' : ' disabled') + '>Issue certificate</button>' +
        (r.ready ? '' : '<p class="note">Every requirement above has to be done first.</p>') + '</div>';
    }
    const unlockHtml = '<div class="card stack" data-s="g8"><b class="small">Final exam</b><p class="note">After three failed tries the learner waits for you. Unlocking allows one more try and lifts the 24-hour wait.</p>' +
      '<button class="btn line" type="button" data-act="unlock">Unlock one more try</button></div>';
    box.innerHTML = '<h2 class="sub" id="cH">Certification</h2><div class="card">' + reqs + '</div>' + liveHtml + certHtml + unlockHtml;
    const val = id => $(id) && $(id).checked;
    const run = async (b, fn, ok) => { b.setAttribute('aria-busy', 'true'); try { await fn(); toast(ok); certSection(uid, L, at); } catch(e){ toast(e && e.message && !/^course:|^hub:/.test(e.message) ? e.message : errText(e)); } finally { b.removeAttribute('aria-busy'); } };
    box.onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
      const a = b.dataset.act;
      if (a === 'liveSave' || a === 'liveSign') run(b, () => rpc('certificate_live_sign', { p_user:uid, p_disclosure:val('lcDisc'), p_call:val('lcCall'), p_crm:val('lcCrm'), p_note:$('lcNote').value, p_sign:a === 'liveSign' }), a === 'liveSign' ? 'Checklist signed.' : 'Checklist saved.');
      else if (a === 'issue') run(b, () => rpc('certificate_issue', { p_user:uid, p_name:$('certName').value }), 'Certificate issued.');
      else if (a === 'renew') run(b, () => rpc('certificate_renew', { p_id:ren.id }), 'Certificate renewed.');
      else if (a === 'unlock' && confirm('Allow one more final exam try for ' + L.name + '?')) run(b, () => rpc('course_exam_unlock', { p_user:uid }), 'Unlocked. They can take the final exam again.');
    };
  }
  const statusChip = s => s === 'approved' ? chip('Approved', 'ok') : s === 'submitted' ? chip('Waiting for you', 'warm') : s === 'needs_changes' ? chip('Returned') : chip('Draft');
  function duration(a, b){
    if (!a || !b) return '';
    const m = Math.round((new Date(b) - new Date(a)) / 60000);
    return m < 1 ? 'under a minute' : m < 120 ? plural(m, 'minute') : plural(Math.round(m / 60), 'hour');
  }

  async function attemptView(uid, id){
    const at = location.hash;
    msgView('Loading…', { header:header(Object.assign(back('#/admin/u/' + uid, 'Back to the learner'), { ctx:'Admin', title:'Quiz attempt' })) });
    let a;
    try { a = await rpc('course_admin_attempt', { p_attempt:id }); } catch(e){ return msgView(errText(e), { retry:true, at }); }
    const qs = a.questions.map((q, qi) => {
      const picks = (q.answer && q.answer.picks) || [], right = q.answer && q.answer.right;
      return '<li class="card stack"><div class="between"><b class="small">Q' + (qi + 1) + ' · ' + (q.type === 'multiple' ? 'Multiple choice' : 'Single choice') + '</b>' +
        (q.answer ? '<span class="rv-v ' + (right ? 'ok' : 'no') + '">' + (right ? 'Right' : 'Wrong') + '</span>' : '<span class="small muted">Not answered</span>') + '</div>' +
        '<p data-s="p600">' + esc(q.prompt) + '</p>' +
        q.options.map(o => { const p = picks.includes(o.id); return '<div class="aopt' + (o.correct ? ' correct' : p ? ' picked-wrong' : '') + '"><span class="bdg">' + esc(o.id) + '</span><span class="t">' + esc(o.text) +
          ((o.correct || p) ? '<span class="tag">' + [o.correct ? 'Correct' : '', p ? 'Their pick' : ''].filter(Boolean).join(' · ') + '</span>' : '') + '</span></div>'; }).join('') +
        '<p class="note">' + esc(q.explanation || '') + '</p></li>';
    }).join('');
    mount(header(Object.assign(back('#/admin/u/' + uid, 'Back to the learner'), { ctx:'Admin', title:quizName(a) })) +
      '<main id="main" class="col"><div class="page">' +
        '<h1 data-s="h22">' + esc(quizName(a)) + '</h1>' +
        '<dl class="kv card"><dt>Score</dt><dd>' + a.score + '% (' + a.correct + ' of ' + a.total + ') · ' + (a.passed ? 'Passed' : 'Not passed') + ', pass mark ' + a.passMark + '%</dd>' +
          '<dt>Started</dt><dd>' + dateTime(a.startedAt) + '</dd><dt>Finished</dt><dd>' + dateTime(a.finishedAt) + '</dd><dt>Time</dt><dd>' + duration(a.startedAt, a.finishedAt) + '</dd></dl>' +
        '<ol class="stack" data-s="list">' + qs + '</ol>' +
      '</div></main>', { title:'Quiz attempt', at });
  }

  async function submissionView(uid, mid, iid){
    const at = location.hash;
    msgView('Loading…', { header:header(Object.assign(back('#/admin/u/' + uid, 'Back to the learner'), { ctx:'Admin', title:'Written drill' })) });
    let s;
    try { s = await rpc('course_admin_submission', { p_user:uid, p_module:mid, p_item:iid }); } catch(e){ return msgView(errText(e), { retry:true, at }); }
    const tasks = (s.tasks || []).map((t, i) => { const a = (s.answers || {})[String(i + 1)]; return '<li class="task"><span class="label">Task ' + (i + 1) + '</span><p>' + esc(t) + '</p>' +
      '<p class="ans' + (a && a.trim() ? '' : ' empty') + '">' + esc(a && a.trim() ? a : 'No answer') + '</p></li>'; }).join('');
    const hist = (s.history || []).map(h => '<li>' + esc({ submitted:'Submitted', needs_changes:'Returned', approved:'Approved' }[h.event] || h.event) + ' · ' + dateTime(h.at) + (h.comment ? ': ' + esc(h.comment) : '') + '</li>').join('');
    const canReview = s.status === 'submitted';
    mount(header(Object.assign(back('#/admin/u/' + uid, 'Back to the learner'), { ctx:'Admin · ' + s.name, title:'Written drill' })) +
      '<main id="main" class="col"><div class="page' + (canReview ? '' : '') + '">' +
        '<div class="stack" data-s="g6"><h1 data-s="h22">' + esc(s.name) + ': ' + esc(s.title) + '</h1><div class="row">' + statusChip(s.status) +
          '<span class="small muted">' + (s.lastSubmittedAt ? 'Sent ' + dateTime(s.lastSubmittedAt) : 'Not sent yet') + '</span></div></div>' +
        (s.filePath ? '<section class="card upload"><span class="label">File</span><div class="fname">' + IC.file + '<span>' + esc(s.fileName || 'File') + '</span></div><button class="btn line" type="button" data-act="open">Open the file</button></section>' : '') +
        '<section class="stack" aria-labelledby="ansH"><h2 class="sub" id="ansH">Their answers</h2><ol class="stack" data-s="list12">' + tasks + '</ol></section>' +
        '<section class="key" aria-labelledby="keyH"><span class="label o" id="keyH">Reviewer answer key</span><ul>' + (s.answerKey || []).map(k => '<li>' + esc(k) + '</li>').join('') + '</ul></section>' +
        (hist ? '<section class="stack"><h2 class="sub">History</h2><ul class="note" data-s="hist">' + hist + '</ul></section>' : '') +
        (canReview ? '<section class="card stack" aria-labelledby="revH"><h2 class="sub" id="revH">Your review</h2><label class="field-lbl" for="cmt">Comment (needed to return it; optional to approve)</label>' +
          '<textarea id="cmt" rows="4"></textarea><p class="err" id="revErr" role="alert"></p>' +
          '<div class="row"><button class="btn line" type="button" data-act="ret">Return with comment</button><button class="btn orange" type="button" data-act="ok">Approve</button></div></section>'
          : '<p class="note">' + (s.status === 'approved' ? 'Approved. Nothing more to do.' : s.status === 'needs_changes' ? 'Returned. It comes back here when they submit again.' : 'They haven’t submitted this yet.') + '</p>') +
      '</div></main>', { title:'Written drill', at, acts:{
        open: async b => {
          b.setAttribute('aria-busy', 'true');
          const { data, error } = await db.storage.from('course').createSignedUrl(s.filePath, 600);
          b.removeAttribute('aria-busy');
          if (error || !data) return toast('Couldn’t open the file.');
          window.open(data.signedUrl, '_blank', 'noopener');
        },
        ret: b => review(b, false), ok: b => review(b, true)
      } });
    async function review(b, approve){
      const c = $('cmt').value.trim();
      if (!approve && !c) { $('revErr').textContent = 'Add a comment so they know what to fix.'; $('cmt').focus(); return; }
      b.setAttribute('aria-busy', 'true');
      try { await rpc('course_review', { p_user:uid, p_module:mid, p_item:iid, p_approve:approve, p_comment:c || null }); }
      catch(e){ b.removeAttribute('aria-busy'); $('revErr').textContent = errText(e); return; }
      toast(approve ? 'Approved' : 'Returned with your comment');
      submissionView(uid, mid, iid);
    }
  }

  // ---------- add a module ----------
  let added = null; // result of course_add_module
  function addView(){
    mount(header(Object.assign(back('#/admin', 'Back to admin'), { ctx:'Admin', title:'Add a module' })) +
      '<main id="main" class="col"><div class="page">' +
        '<h1 class="display">Add a module</h1>' +
        '<p class="lead">Upload a module file (module-N.json, same format as Module 1). Uploading a module that’s already here replaces its content; learners keep their progress.</p>' +
        '<section class="drop" aria-labelledby="s1"><span class="label" id="s1">Step 1 · Module file</span>' +
          '<label class="btn line"><input type="file" class="vh" id="jsonFile" accept=".json,application/json">Choose module-N.json</label>' +
          '<div id="jsonInfo"></div><p class="err" id="jsonErr" role="alert"></p></section>' +
        '<section class="drop" aria-labelledby="s2" id="imgStep"' + (added ? '' : ' hidden') + '><span class="label" id="s2">Step 2 · Images</span>' +
          '<p class="note">Choose the thumbnails and guide pages together. They’re matched by file name.</p>' +
          '<label class="btn line"><input type="file" class="vh" id="imgFiles" accept="image/*" multiple>Choose images</label>' +
          '<p class="save-state" id="imgState" aria-live="polite"></p><ul class="img-list" id="imgList"></ul></section>' +
      '</div></main>', { title:'Add a module' });
    let file = null;
    $('jsonFile').addEventListener('change', async ev => {
      const f = ev.target.files[0]; if (!f) return;
      $('jsonErr').textContent = ''; $('jsonInfo').innerHTML = '';
      try { file = JSON.parse(await f.text()); } catch(e){ $('jsonErr').textContent = 'That file isn’t valid JSON.'; return; }
      const mods = (file && file.course && file.course.modules) || [];
      if (!mods.length) { $('jsonErr').textContent = 'That file has no modules in it (it needs course.modules).'; return; }
      const count = m => { let l = 0, q = 0; (function w(a){ (a || []).forEach(i => { if (i.type === 'lesson') l++; if (i.quiz) q += (i.quiz.questions || []).length; w(i.items); }); })(m.items); return [l, q]; };
      $('jsonInfo').innerHTML = '<ul class="img-list">' + mods.map(m => { const [l, q] = count(m), here = A.S.modules.find(x => x.id === m.id); return '<li><span>Module ' + esc(m.number) + ': ' + esc(m.title) + '</span><span class="muted">' + l + ' lessons · ' + q + ' questions' + (here ? ' · replaces' : ' · new') + '</span></li>'; }).join('') + '</ul>' +
        '<button class="btn orange" type="button" id="addBtn">Add ' + (mods.length === 1 ? 'Module ' + esc(mods[0].number) : plural(mods.length, 'module')) + '</button>';
      $('addBtn').addEventListener('click', async () => {
        $('addBtn').setAttribute('aria-busy', 'true');
        try { added = await rpc('course_add_module', { p_file:file }); }
        catch(e){ $('addBtn').removeAttribute('aria-busy'); $('jsonErr').textContent = (e.message || '').replace(/^course: /, 'Not added: ') || errText(e); return; }
        await A.loadState();
        toast('Module added');
        addView(); showImages();
      });
    });
    if (added) showImages();
  }
  async function showImages(){
    $('imgStep').hidden = false;
    const have = new Set();
    for (const m of added) for (const dir of ['', 'source-images']) {
      const { data } = await db.storage.from('course').list('content/' + m.id + (dir ? '/' + dir : ''), { limit:1000 });
      (data || []).filter(x => x.id).forEach(x => have.add(m.id + '/' + (dir ? dir + '/' : '') + x.name));
    }
    const need = added.flatMap(m => m.images.map(i => ({ mod:m.id, path:i, base:i.split('/').pop(), ok:have.has(m.id + '/' + i) })));
    const draw = () => {
      const missing = need.filter(n => !n.ok).length;
      $('imgState').textContent = missing ? missing + ' of ' + need.length + ' images still needed.' : 'All ' + need.length + ' images are uploaded.';
      $('imgList').innerHTML = need.map(n => '<li><span>' + esc(n.path) + '</span>' + (n.ok ? chip('Uploaded', 'ok') : chip('Missing')) + '</li>').join('');
    };
    draw();
    $('imgFiles').onchange = async ev => {
      const files = [...ev.target.files];
      let done = 0, skipped = [];
      for (const f of files) {
        const targets = need.filter(n => n.base === f.name);
        if (!targets.length) { skipped.push(f.name); continue; }
        for (const t of targets) {
          $('imgState').textContent = 'Uploading ' + f.name + '…';
          const { error } = await db.storage.from('course').upload('content/' + t.mod + '/' + t.path, f, { upsert:true, contentType:f.type || 'image/png' });
          if (!error) { t.ok = true; done++; }
        }
      }
      draw();
      toast(done + ' uploaded' + (skipped.length ? ', ' + skipped.length + ' not in this module' : ''));
    };
  }

  function route(parts){
    if (!parts.length) return homeView();
    if (parts[0] === 'add') return addView();
    if (parts[0] === 'u' && parts[1]) {
      if (parts[2] === 'a' && parts[3]) return attemptView(parts[1], parts[3]);
      if (parts[2] === 's' && parts[4]) return submissionView(parts[1], parts[3], parts[4]);
      return learnerView(parts[1]);
    }
    homeView();
  }

  window.CourseAdmin = { route, waiting };
})();
