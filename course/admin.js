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
    let people, wait;
    try { [people, wait] = await Promise.all([rpc('course_admin_learners'), rpc('course_admin_waiting')]); }
    catch(e){ return msgView(errText(e), { retry:true, at }); }
    const rows = people.map(p => {
      const cp = p.checkpoint ? 'Checkpoint ' + p.checkpoint.score + '%' : 'No checkpoint yet';
      return '<li><a class="person" href="#/admin/u/' + esc(p.userId) + '"><span class="av" aria-hidden="true">' + esc(initials(p.name)) + '</span><span class="txt">' +
        '<span class="n">' + esc(p.name) + '</span>' +
        '<span class="m">' + (p.module ? 'Module ' + p.module + ' · ' + pct(p.done, p.total) + '% done' : 'Not started') + ' · ' + (p.lastActive ? 'active ' + when(p.lastActive) : 'never active') + '</span>' +
        '<span class="m">' + esc(cp) + (p.hasAccess ? '' : ' · access switched off') + '</span>' +
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
    let L;
    try { L = await rpc('course_admin_learner', { p_user:uid }); } catch(e){ return msgView(errText(e), { retry:true, at }); }
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
        '<section class="stack" aria-labelledby="sH"><h2 class="sub" id="sH">Written drills</h2>' + (subs ? '<ul class="items">' + subs + '</ul>' : '<p class="note">Nothing started yet.</p>') + '</section>' +
        '<section class="stack" aria-labelledby="aH"><h2 class="sub" id="aH">Quiz attempts (' + L.attempts.length + ')</h2>' + (atts ? '<ul class="items">' + atts + '</ul>' : '<p class="note">No finished quizzes yet.</p>') + '</section>' +
      '</div></main>', { title:L.name, at });
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
    const qs = a.questions.map(q => {
      const picks = (q.answer && q.answer.picks) || [], right = q.answer && q.answer.right;
      return '<li class="card stack"><div class="between"><b class="small">Q' + q.number + ' · ' + (q.type === 'multiple' ? 'Multiple choice' : 'Single choice') + '</b>' +
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
