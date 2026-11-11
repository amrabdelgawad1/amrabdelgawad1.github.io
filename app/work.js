// Round 11: the portal's own work tools, so nothing needs WhatsApp, a notes app or another site.
//   #tasks     Tasks: Amr gives a task to anyone (or himself), with a due date and an optional repeat. Reps tick theirs.
//   #messages  Messages: one thread per person with Amr, plus a whole-team thread.
//   #handbook  Handbook: how we work, written once by Amr, read and ticked by everyone.
//   #daily     Daily review: quiz questions a learner missed come back on a schedule until they stick.
//   #builder   Course builder: Amr edits any course (Acquisitions, Marketing, Psychology) and publishes when ready.
// Database: portal_tasks, portal_messages (+ portal_message_reads), handbook_pages (+ handbook_reads), review_cards with
// portal_review_today / portal_review_answer, and portal_builder_modules / portal_builder_module. Row rules decide who sees what.
(function(){
  'use strict';
  const PX = window.PX;
  if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, fmtTime, plural, card, empty, failed, pill, f, opt, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const uid = () => (T().user || {}).id;
  const page = PX.page;
  const people = async () => { const r = await safe(db().from('members').select('user_id,name,active,role').order('name')); return (r.data || []).filter(m => m.active); };
  const today = () => isoDay(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoDay(d); };
  const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const when = at => { const d = new Date(at), same = isoDay(d) === today(); return same ? fmtTime(at) : fmtDay(at, { month:'short', day:'numeric' }) + ', ' + fmtTime(at); };

  // ======================================================================
  // Tasks
  // ======================================================================
  const REPEAT = { daily:'Every day', weekly:'Every week', monthly:'Every month' };
  const nextDue = (due, rep) => { const base = due || today(); if (rep === 'daily') return addDays(base, 1); if (rep === 'weekly') return addDays(base, 7);
    const d = new Date(base + 'T12:00'); d.setMonth(d.getMonth() + 1); return isoDay(d); };
  function taskRow(t, names, owner){
    const late = t.due_on && t.due_on < today() && !t.done_at;
    const who = owner ? (t.assigned_to ? (names[t.assigned_to] || 'Someone') : 'You') : '';
    return '<div class="wk-task' + (t.done_at ? ' is-done' : '') + '">' +
      '<label class="wk-tick"><input type="checkbox" data-tdone="' + t.id + '"' + (t.done_at ? ' checked' : '') + ' aria-label="Done: ' + esc(t.title) + '"></label>' +
      '<div class="wk-task-txt"><b>' + esc(t.title) + '</b>' + (t.notes ? '<small>' + esc(t.notes) + '</small>' : '') +
      '<span class="wk-meta">' + (who ? '<span>' + esc(who) + '</span>' : '') +
        (t.due_on ? pill(t.due_on === today() ? 'Today' : late ? 'Late · ' + fmtDay(t.due_on, { month:'short', day:'numeric' }) : fmtDay(t.due_on), late ? 'no' : t.due_on === today() ? '' : 'plain') : '') +
        (t.repeat ? pill(REPEAT[t.repeat], 'plain') : '') + '</span></div>' +
      ((owner || t.created_by === uid()) ? '<button type="button" class="p-btn is-ghost wk-x" data-tdel="' + t.id + '" aria-label="Delete task">Delete</button>' : '') + '</div>';
  }
  V.tasks = { title:'Tasks', sec:'everyone', async open(el, ok){
    const owner = isOwner();
    const body = page(el, 'Work', 'Tasks', owner ? 'Give anyone a task with a due date. Repeating tasks come back on their own when ticked. Reps see theirs on this page.' : 'What you need to do, from Amr or from you. Tick it when it’s done.');
    const [r, ppl] = await Promise.all([safe(db().from('portal_tasks').select('*').order('due_on', { ascending:true, nullsFirst:false }).order('created_at').limit(500)), owner ? people() : Promise.resolve([])]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const names = {}; ppl.forEach(p => names[p.user_id] = p.name);
    const all = r.data || [], open = all.filter(t => !t.done_at), done = all.filter(t => t.done_at).sort((a, b) => b.done_at.localeCompare(a.done_at)).slice(0, 20);
    const wk = addDays(today(), 7);
    const groups = [
      ['Today and late', open.filter(t => t.due_on && t.due_on <= today())],
      ['This week', open.filter(t => t.due_on && t.due_on > today() && t.due_on <= wk)],
      ['Later', open.filter(t => t.due_on && t.due_on > wk)],
      ['No date', open.filter(t => !t.due_on)]
    ];
    const form = '<form class="px-form wk-form" id="tkForm" novalidate>' +
      f('Task', '<input type="text" id="tkTitle" maxlength="300" placeholder="e.g. Send the weekly numbers">', 'px-wide') +
      (owner ? f('For', '<select id="tkWho">' + opt('', 'Me') + ppl.map(p => opt(p.user_id, p.name)).join('') + '</select>') : '') +
      f('Due', '<input type="date" id="tkDue" value="' + today() + '">') +
      f('Repeats', '<select id="tkRep">' + opt('', 'No') + Object.entries(REPEAT).map(([k, v]) => opt(k, v)).join('') + '</select>') +
      f('Notes (optional)', '<textarea id="tkNotes" rows="2" maxlength="4000"></textarea>', 'px-wide') +
      '<button class="p-btn" type="submit">Add task</button><p class="p-empty" id="tkMsg" role="status"></p></form>';
    body.innerHTML = '<div class="wk-two"><div>' +
      groups.map(([h, list]) => card(h, list.length ? list.length + ' open' : '', list.length ? list.map(t => taskRow(t, names, owner)).join('') : empty(h === 'Today and late' ? 'Nothing due today.' : 'Nothing here.'))).join('') +
      '</div><div>' + card('New task', '', form) +
      card('Done lately', done.length ? String(done.length) : '', done.length ? done.map(t => taskRow(t, names, owner)).join('') : empty('Ticked tasks show here.')) + '</div></div>';
    const reload = () => V.tasks.open(el, ok);
    $('tkForm').addEventListener('submit', async e => {
      e.preventDefault();
      const title = $('tkTitle').value.trim(); if (!title) return say('tkMsg', 'Write the task first.');
      say('tkMsg', 'Adding…');
      const row = { title, due_on:$('tkDue').value || null, repeat:$('tkRep').value || null, notes:$('tkNotes').value.trim() || null,
        assigned_to:owner ? ($('tkWho').value || null) : uid(), created_by:uid() };
      const x = await safe(db().from('portal_tasks').insert(row));
      if (x.error) return say('tkMsg', errText(x, 'Couldn’t add it. Try again.'));
      reload();
    });
    body.addEventListener('change', async e => {
      const c = e.target.closest('[data-tdone]'); if (!c) return;
      const t = all.find(x => x.id === +c.dataset.tdone); if (!t) return;
      c.disabled = true;
      const x = await safe(db().from('portal_tasks').update({ done_at:c.checked ? new Date().toISOString() : null }).eq('id', t.id));
      if (!x.error && c.checked && t.repeat) await safe(db().from('portal_tasks').insert({ title:t.title, notes:t.notes, assigned_to:t.assigned_to, created_by:uid(), repeat:t.repeat, due_on:nextDue(t.due_on, t.repeat) }));
      reload();
    });
    body.addEventListener('click', async e => {
      const d = e.target.closest('[data-tdel]'); if (!d) return;
      if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'Sure?'; return; }
      d.disabled = true; await safe(db().from('portal_tasks').delete().eq('id', +d.dataset.tdel)); reload();
    });
  }};

  // ======================================================================
  // Messages
  // ======================================================================
  let msgTimer = null;
  V.messages = { title:'Messages', sec:'everyone', async open(el, ok){
    clearInterval(msgTimer);
    const owner = isOwner();
    el.innerHTML = '<div class="p-wrap px"><section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">Work</span><h1>Messages</h1><p>' +
      (owner ? 'Talk to each person here instead of WhatsApp. One thread per person, plus the whole team.' : 'Talk to Amr here, or to the whole team.') + '</p></div></section>' +
      '<section class="p-card wk-msg"><div class="wk-threads" id="msThreads" role="list"></div><div class="wk-chat"><div class="wk-chat-head" id="msHead"></div>' +
      '<div class="wk-log" id="msLog" aria-live="polite"></div><form class="wk-send" id="msForm" novalidate><label class="wk-sr" for="msBody">Message</label>' +
      '<textarea id="msBody" rows="2" maxlength="4000" placeholder="Write a message"></textarea><button class="p-btn" type="submit">Send</button></form><p class="p-empty" id="msMsg" role="status"></p></div></section></div>';
    const ppl = owner ? await people() : [];
    if (!ok()) return;
    const threads = owner ? [{ key:'team', id:null, name:'Whole team' }].concat(ppl.map(p => ({ key:p.user_id, id:p.user_id, name:p.name })))
      : [{ key:uid(), id:uid(), name:'Amr' }, { key:'team', id:null, name:'Whole team' }];
    let cur = (location.hash.split('/')[1] && threads.find(t => t.key === decodeURIComponent(location.hash.split('/')[1]))) || threads[0];
    let msgs = [], reads = {};
    async function load(){
      const [r, rd] = await Promise.all([safe(db().from('portal_messages').select('*').order('created_at', { ascending:false }).limit(600)), safe(db().from('portal_message_reads').select('*'))]);
      if (!ok()) return false;
      if (r.error) { $('msLog').innerHTML = failed(r.error); return false; }
      msgs = (r.data || []).reverse(); reads = {}; (rd.data || []).forEach(x => reads[x.thread_key] = x.read_at);
      return true;
    }
    const keyOf = m => m.thread || 'team';
    function drawThreads(){
      $('msThreads').innerHTML = threads.map(t => {
        const list = msgs.filter(m => keyOf(m) === t.key), last = list[list.length - 1];
        const unread = list.filter(m => m.sender !== uid() && (!reads[t.key] || m.created_at > reads[t.key])).length;
        return '<button type="button" role="listitem" class="wk-thread' + (t.key === cur.key ? ' on' : '') + '" data-th="' + esc(t.key) + '"><span class="wk-av">' + (t.key === 'team' ? 'ALL' : esc(initials(t.name))) + '</span>' +
          '<span class="wk-th-txt"><b>' + esc(t.name) + '</b><small>' + (last ? esc((last.sender === uid() ? 'You: ' : '') + last.body.slice(0, 60)) : 'No messages yet') + '</small></span>' +
          (unread && t.key !== cur.key ? '<span class="wk-unread">' + unread + '</span>' : '') + '</button>';
      }).join('');
    }
    function drawLog(){
      $('msHead').innerHTML = '<b>' + esc(cur.name) + '</b><small>' + (cur.key === 'team' ? 'Everyone on the team sees this thread' : owner ? 'Only you and ' + esc(cur.name) : 'Only you and Amr') + '</small>';
      const list = msgs.filter(m => keyOf(m) === cur.key);
      const log = $('msLog');
      log.innerHTML = list.length ? list.map(m => '<div class="wk-bubble' + (m.sender === uid() ? ' is-me' : '') + '">' + (cur.key === 'team' && m.sender !== uid() ? '<b>' + esc(m.sender_name || 'Team') + '</b>' : '') +
        '<p>' + esc(m.body) + '</p><time>' + esc(when(m.created_at)) + '</time></div>').join('') : empty('No messages yet. Say hello.');
      log.scrollTop = log.scrollHeight;
      if (list.length) safe(db().from('portal_message_reads').upsert({ user_id:uid(), thread_key:cur.key, read_at:new Date().toISOString() }));
      reads[cur.key] = new Date().toISOString();
    }
    if (!await load()) return;
    drawThreads(); drawLog();
    $('msThreads').addEventListener('click', e => { const b = e.target.closest('[data-th]'); if (!b) return; cur = threads.find(t => t.key === b.dataset.th) || cur; history.replaceState(null, '', '#messages/' + encodeURIComponent(cur.key)); drawThreads(); drawLog(); $('msBody').focus(); });
    $('msBody').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('msForm').requestSubmit(); } });
    $('msForm').addEventListener('submit', async e => {
      e.preventDefault();
      const txt = $('msBody').value.trim(); if (!txt) return;
      say('msMsg', '');
      const x = await safe(db().from('portal_messages').insert({ thread:cur.id, body:txt }));
      if (x.error) return say('msMsg', errText(x, 'Couldn’t send it. Try again.'));
      $('msBody').value = '';
      if (await load()) { drawThreads(); drawLog(); }
    });
    // new messages arrive every 20 seconds while the page is open
    msgTimer = setInterval(async () => { if (!ok() || !document.getElementById('msLog')) return clearInterval(msgTimer); if (document.hidden) return; const n = msgs.length; if (await load() && msgs.length !== n) { drawThreads(); drawLog(); } }, 20000);
  }};

  // ======================================================================
  // Handbook
  // ======================================================================
  V.handbook = { title:'Handbook', sec:'everyone', async open(el, ok){
    const owner = isOwner();
    const body = page(el, 'Work', 'Handbook', owner ? 'How we work, written once and read by everyone. Edit a page and the team sees it straight away; you see who has read each page.' : 'How we work. Read each page and tick it when you understand it.');
    const [p, rd, ppl] = await Promise.all([safe(db().from('handbook_pages').select('*').order('sort').order('id')), safe(db().from('handbook_reads').select('*')), owner ? people() : Promise.resolve([])]);
    if (!ok()) return;
    if (p.error) { body.innerHTML = failed(p.error); return; }
    const pages = p.data || [], reads = rd.data || [];
    let curId = +(location.hash.split('/')[1] || 0) || (pages[0] && pages[0].id), editing = false;
    function draw(){
      const pg = pages.find(x => x.id === curId);
      const mine = new Set(reads.filter(r => r.user_id === uid()).map(r => r.page_id));
      body.innerHTML = '<div class="wk-hb"><nav class="p-card wk-hb-nav" aria-label="Handbook pages"><input class="wk-find" id="hbFind" type="search" placeholder="Search the handbook" aria-label="Search the handbook">' +
        '<div id="hbList">' + pages.map(x => '<a href="#handbook/' + x.id + '" class="wk-hb-link' + (x.id === curId ? ' on' : '') + '" data-hb="' + x.id + '">' + esc(x.title) + (!owner && !mine.has(x.id) ? '<span class="wk-dot" aria-label="Not read yet"></span>' : '') + '</a>').join('') + '</div>' +
        (owner ? '<button type="button" class="p-btn is-ghost" id="hbNew">+ New page</button>' : '') + '</nav>' +
        '<article class="p-card wk-hb-page">' + (!pg ? empty(owner ? 'No pages yet. Add the first one.' : 'Amr hasn’t written any pages yet.') : editing ? editForm(pg) :
          '<div class="wk-hb-head"><h2>' + esc(pg.title) + '</h2><small>Updated ' + esc(fmtDay(pg.updated_at, { month:'short', day:'numeric', year:'numeric' })) + '</small></div>' +
          '<ul class="wk-hb-body">' + pg.body.split('\n').filter(l => l.trim()).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
          (owner ? '<div class="wk-hb-foot"><span>' + readLine(pg) + '</span><button type="button" class="p-btn is-ghost" id="hbEdit">Edit page</button></div>'
            : mine.has(pg.id) ? '<p class="wk-hb-ok">' + pill('You read this', 'ok') + '</p>' : '<button type="button" class="p-btn" id="hbRead">I read and understood this page</button>')) + '</article></div>';
    }
    const readLine = pg => { const who = reads.filter(r => r.page_id === pg.id).map(r => r.user_id); const by = ppl.filter(x => who.includes(x.user_id)).map(x => x.name);
      return plural(by.length, 'person', 'people') + ' of ' + ppl.length + ' read it' + (by.length && by.length < ppl.length ? ' · not yet: ' + esc(ppl.filter(x => !who.includes(x.user_id)).map(x => x.name).join(', ')) : ''); };
    const editForm = pg => '<form class="px-form" id="hbForm" novalidate>' + f('Title', '<input type="text" id="hbTitle" maxlength="120" value="' + esc(pg.title) + '">', 'px-wide') +
      f('Page (one point per line)', '<textarea id="hbBody" rows="12" maxlength="20000">' + esc(pg.body) + '</textarea>', 'px-wide') +
      f('Order', '<input type="number" id="hbSort" value="' + (pg.sort || 0) + '">') +
      '<label class="px-check"><input type="checkbox" id="hbAgain"> Ask everyone to read it again</label>' +
      '<div class="wk-row"><button class="p-btn" type="submit">Save page</button><button class="p-btn is-ghost" type="button" id="hbCancel">Cancel</button>' + (pg.id ? '<button class="p-btn is-ghost" type="button" id="hbDel">Delete page</button>' : '') + '</div><p class="p-empty" id="hbMsg" role="status"></p></form>';
    draw();
    body.addEventListener('click', async e => {
      const a = e.target.closest('[data-hb]');
      if (a) { e.preventDefault(); curId = +a.dataset.hb; editing = false; history.replaceState(null, '', '#handbook/' + curId); draw(); return; }
      if (e.target.id === 'hbEdit') { editing = true; draw(); return; }
      if (e.target.id === 'hbCancel') { editing = false; if (!curId) curId = pages[0] && pages[0].id; draw(); return; }
      if (e.target.id === 'hbNew') { const x = await safe(db().from('handbook_pages').insert({ title:'New page', body:'', sort:pages.length + 1 }).select().single()); if (!x.error) { pages.push(x.data); curId = x.data.id; editing = true; draw(); } return; }
      if (e.target.id === 'hbDel') { const b = e.target; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Delete'; return; }
        await safe(db().from('handbook_pages').delete().eq('id', curId)); V.handbook.open(el, ok); return; }
      if (e.target.id === 'hbRead') { e.target.disabled = true; const x = await safe(db().from('handbook_reads').insert({ page_id:curId, user_id:uid() })); if (!x.error) reads.push({ page_id:curId, user_id:uid() }); draw(); }
    });
    body.addEventListener('submit', async e => {
      if (e.target.id !== 'hbForm') return;
      e.preventDefault();
      const title = $('hbTitle').value.trim(); if (!title) return say('hbMsg', 'Give the page a title.');
      say('hbMsg', 'Saving…');
      const x = await safe(db().from('handbook_pages').update({ title, body:$('hbBody').value, sort:+$('hbSort').value || 0, updated_at:new Date().toISOString(), updated_by:uid() }).eq('id', curId).select().single());
      if (x.error) return say('hbMsg', errText(x, 'Couldn’t save it. Try again.'));
      if ($('hbAgain').checked) await safe(db().from('handbook_reads').delete().eq('page_id', curId));
      V.handbook.open(el, ok);
    });
    body.addEventListener('input', e => {
      if (e.target.id !== 'hbFind') return;
      const q = e.target.value.trim().toLowerCase();
      body.querySelectorAll('[data-hb]').forEach(a => { const pg = pages.find(x => x.id === +a.dataset.hb); a.hidden = !!q && !(pg.title + ' ' + pg.body).toLowerCase().includes(q); });
    });
  }};

  // ======================================================================
  // Daily review
  // ======================================================================
  V.daily = { title:'Daily review', sec:'hub', async open(el, ok){
    const body = page(el, 'Learning', 'Daily review', 'Questions you missed in a quiz come back here. Get one right and it comes back later; miss it and it comes back tomorrow. A few minutes a day is enough.');
    const r = await safe(db().rpc('portal_review_today'));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const d = r.data || {}, cards = d.cards || [];
    let i = 0, right = 0;
    const tiles = () => '<div class="px-tiles"><div class="px-tile"><b>' + (d.streak || 0) + (d.streak === 1 ? ' day' : ' days') + '</b>streak</div><div class="px-tile"><b>' + cards.length + '</b>cards today</div><div class="px-tile"><b>' + (d.total || 0) + '</b>cards in total</div></div>';
    function show(){
      if (!cards.length) { body.innerHTML = tiles() + card('All done', '', empty((d.total ? 'Nothing due today. ' : 'No cards yet. ') + 'Questions you miss in the Acquisitions quizzes are added here on their own.') + '<a class="p-btn is-ghost" href="/app/learn/">Back to the Learning Hub</a>'); return; }
      if (i >= cards.length) { body.innerHTML = tiles() + card('Done for today', right + ' of ' + cards.length + ' right', '<p class="wk-big">Nice work. The ones you missed come back tomorrow.</p><a class="p-btn" href="/app/learn/">Back to the Learning Hub</a>'); return; }
      const c = cards[i], multi = c.type === 'multi' || c.type === 'multiple';
      body.innerHTML = tiles() + '<section class="p-card wk-rv"><p class="wk-rv-k">Card ' + (i + 1) + ' of ' + cards.length + (c.missed ? ' · missed on ' + esc(fmtDay(c.missed, { month:'short', day:'numeric' })) : '') + ' · Acquisitions ' + esc(String(c.module || '').replace(/^m/, 'module ')) + '</p>' +
        '<h2 class="wk-rv-q">' + esc(c.prompt) + '</h2>' + (multi ? '<p class="wk-rv-k">Pick every answer that is right.</p>' : '') +
        '<div class="wk-rv-opts" id="rvOpts">' + (c.options || []).map(o => '<label class="wk-opt"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="rv" value="' + esc(o.id) + '"><span>' + esc(o.text) + '</span></label>').join('') + '</div>' +
        '<div class="wk-row"><button class="p-btn" type="button" id="rvCheck">Check</button></div><div id="rvOut" role="status"></div></section>';
      $('rvCheck').addEventListener('click', async () => {
        const picks = [...body.querySelectorAll('#rvOpts input:checked')].map(x => x.value);
        if (!picks.length) return say('rvOut', 'Pick an answer first.');
        $('rvCheck').disabled = true;
        const x = await safe(db().rpc('portal_review_answer', { p_card:c.id, p_picks:picks }));
        if (x.error) { $('rvCheck').disabled = false; return say('rvOut', errText(x, 'Couldn’t check it. Try again.')); }
        const a = x.data || {}; if (a.right) right++;
        body.querySelectorAll('#rvOpts label').forEach(l => { const v = l.querySelector('input').value; l.classList.toggle('is-right', (a.correct || []).includes(v)); l.classList.toggle('is-wrong', picks.includes(v) && !(a.correct || []).includes(v)); l.querySelector('input').disabled = true; });
        $('rvOut').innerHTML = '<p class="wk-rv-res ' + (a.right ? 'ok' : 'no') + '"><b>' + (a.right ? 'Right.' : 'Not this time.') + '</b> ' + (a.right ? 'This card comes back later.' : 'It comes back tomorrow.') + '</p>' +
          (a.explain && typeof a.explain === 'string' ? '<p class="wk-rv-why">' + esc(a.explain) + '</p>' : '') + '<button class="p-btn" type="button" id="rvNext">' + (i + 1 < cards.length ? 'Next card' : 'Finish') + '</button>';
        $('rvNext').addEventListener('click', () => { i++; show(); });
        $('rvNext').focus();
      });
    }
    show();
  }};

  // ======================================================================
  // Course builder (Amr): every course, drafts first, publish when ready
  // ======================================================================
  // Acquisitions lives in the database (course_modules); Marketing and Psychology live as one content file each in the
  // private course-content bucket. A draft is saved in the bucket's _src folder (only Amr can read it) and nothing
  // changes for learners until Publish. Publishing keeps a copy of what was live before it.
  const COURSES = [
    { id:'acq', name:'Acquisitions', kind:'db' },
    { id:'mkt', name:'Marketing', kind:'file' },
    { id:'psy', name:'Psychology', kind:'file' }
  ];
  const TEXT_KEYS = /^(title|t|sub|subtitle|summary|intro|body|text|html|prompt|question|q|answer|a|explanation|why|feedback|note|tip|recap|label|name|desc|description|en|ar|title_ar|text_ar|body_ar|prompt_ar)$/i;
  const LONG = s => typeof s === 'string' && (s.length > 40 || s.includes('\n'));
  // all editable strings inside one module/part, as [path, label, value]
  function fields(obj, base, out, depth){
    if (depth > 9 || !obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(k => {
      const v = obj[k], p = base.concat(Array.isArray(obj) ? +k : k);
      if (typeof v === 'string') { if (Array.isArray(obj) || TEXT_KEYS.test(k)) out.push([p, label(p), v]); }
      else if (typeof v === 'boolean' && k === 'correct') out.push([p, label(p), v]);
      else if (v && typeof v === 'object') fields(v, p, out, depth + 1);
    });
    return out;
  }
  // "items › 0 › quiz › questions › 1 › options › 2 › text" reads as "Lesson 1 › Quiz › Question 2 › Answer 3 › Text"
  const WORD = { items:'Lesson', lessons:'Lesson', parts:'Part', sections:'Section', questions:'Question', options:'Answer', choices:'Answer', quiz:'Quiz', exam:'Exam', cards:'Card', steps:'Step',
    title:'Title', t:'Title', body:'Text', text:'Text', html:'Text', prompt:'Question', q:'Question', a:'Answer', answer:'Answer', explanation:'Explanation', why:'Why', feedback:'Feedback',
    summary:'Summary', intro:'Intro', sub:'Subtitle', subtitle:'Subtitle', note:'Note', tip:'Tip', recap:'Recap', label:'Label', name:'Name', desc:'Description', description:'Description', correct:'Right answer', en:'English', ar:'Arabic' };
  const label = p => { const out = []; p.forEach((x, j) => {
    if (typeof x === 'number') { const prev = out[out.length - 1]; if (prev && !/\d$/.test(prev)) out[out.length - 1] = prev + ' ' + (x + 1); else out.push('#' + (x + 1)); }
    else out.push(WORD[x] || (x.replace(/_ar$/, '') in WORD ? WORD[x.replace(/_ar$/, '')] + ' (Arabic)' : x.replace(/[_-]/g, ' ')));
  }); return out.join(' › '); };
  const getIn = (o, p) => p.reduce((a, k) => a == null ? a : a[k], o);
  const setIn = (o, p, v) => { const last = p[p.length - 1], par = getIn(o, p.slice(0, -1)); if (par != null) par[last] = v; };
  // where the modules sit in a content file: { modules:[...] }, { modules:{ m01:{...} } }, { course:{ modules } }, or the file itself
  const modBox = c => !c || typeof c !== 'object' ? {} : c.course && c.course.modules ? c.course.modules : c.modules && typeof c.modules === 'object' ? c.modules : c;
  const modKeys = c => { const b = modBox(c); return Object.keys(b).filter(k => b[k] && typeof b[k] === 'object'); };
  const modTitle = (m, i) => { const n = m.number != null ? m.number : m.num != null ? m.num : m.n; const t = m.title || m.t || m.name || m.id || ''; return (n != null ? 'Module ' + n + ' · ' : 'Module ' + (i + 1) + ' · ') + (t && typeof t === 'object' ? t.en || Object.values(t)[0] || '' : t); };

  V.builder = { title:'Course builder', sec:'owner', async open(el, ok){
    const body = page(el, 'Learning', 'Course builder', 'Change any course without code: module titles, lessons, questions, answers and explanations. Save a draft as often as you like. Learners only see changes after you press Publish, and the old version is kept.');
    const st = { course:COURSES[0], list:[], mod:null, modIdx:0, data:null, draft:false, filter:'', part:'' };
    const bucket = () => db().storage.from('course-content');
    const draftPath = (c, m) => '_src/drafts/' + c.id + (m ? '/' + m : '') + '.json';
    async function readJson(path){ const x = await bucket().download(path); if (x.error || !x.data) return null; try { return JSON.parse(await x.data.text()); } catch(e) { return null; } }
    async function writeJson(path, obj){ return bucket().upload(path, new Blob([JSON.stringify(obj)], { type:'application/json' }), { upsert:true, contentType:'application/json' }); }

    async function loadCourse(){
      body.innerHTML = PX.loading;
      const c = st.course;
      if (c.kind === 'db') {
        const r = await safe(db().rpc('portal_builder_modules'));
        if (!ok()) return;
        if (r.error) { body.innerHTML = failed(r.error); return; }
        st.list = (r.data || []).map(m => ({ id:m.id, label:'Module ' + m.number + ' · ' + (m.title || m.id) }));
      } else {
        const dr = await readJson(draftPath(c));
        const live = dr ? null : await readJson(c.id + '/content.json');
        if (!ok()) return;
        st.data = dr || live; st.draft = !!dr;
        if (!st.data) { body.innerHTML = card(c.name, '', empty('Couldn’t open this course’s content file. Check you signed in with your authenticator code.')); drawTop(); return; }
        st.list = modKeys(st.data).map((k, i) => ({ id:k, label:modTitle(modBox(st.data)[k], i) }));
      }
      st.modIdx = 0; await loadModule();
    }
    async function loadModule(){
      const c = st.course, item = st.list[st.modIdx];
      if (!item) { draw(); return; }
      if (c.kind === 'db') {
        const dr = await readJson(draftPath(c, item.id));
        const live = dr ? null : (await safe(db().rpc('portal_builder_module', { p_id:item.id }))).data;
        if (!ok()) return;
        st.mod = dr || live; st.draft = !!dr;
      } else st.mod = modBox(st.data)[item.id];
      draw();
    }
    function drawTop(){
      body.insertAdjacentHTML('afterbegin', '<div class="px-tools wk-bt">' + '<div class="p-seg" role="tablist" aria-label="Course">' + COURSES.map(c => '<button type="button" role="tab" class="wk-seg' + (c === st.course ? ' on' : '') + '" aria-selected="' + (c === st.course) + '" data-bc="' + c.id + '">' + esc(c.name) + '</button>').join('') + '</div>' +
        (st.list.length ? '<label class="sc-f px-inline">Module<select id="bdMod">' + st.list.map((m, i) => opt(i, m.label, i === st.modIdx)).join('') + '</select></label>' : '') +
        '<span class="wk-bt-r">' + pill(st.draft ? 'Draft · not live' : 'Same as live', st.draft ? '' : 'plain') + '</span></div>');
    }
    // One part or lesson at a time: the path up to its first number ("Lesson 3", "Part 2"), named by its own title
    const groupOf = p => { const i = p.findIndex(x => typeof x === 'number'); return i < 0 ? '' : JSON.stringify(p.slice(0, i + 1)); };
    function groups(fl){
      const out = [], seen = {};
      fl.forEach(x => { const g = groupOf(x[0]); if (!g || seen[g]) return; seen[g] = 1; const p = JSON.parse(g), node = getIn(st.mod, p) || {};
        const t = node.title || node.t || node.name || ''; out.push([g, label(p) + (typeof t === 'string' && t ? ' · ' + (t.length > 50 ? t.slice(0, 50) + '…' : t) : '')]); });
      return out;
    }
    function draw(){
      const fl = st.mod ? fields(st.mod, [], [], 0) : [];
      const q = st.filter.toLowerCase(), gl = groups(fl);
      if (st.part && !gl.some(g => g[0] === st.part)) st.part = '';
      const shown = fl.filter(x => (!st.part || groupOf(x[0]) === st.part) && (!q || (x[1] + ' ' + x[2]).toLowerCase().includes(q)));
      const rtlOf = v => typeof v === 'string' && /[\u0600-\u06FF]/.test(v);
      body.innerHTML = card(st.list[st.modIdx] ? st.list[st.modIdx].label : 'Module', plural(fl.filter(x => typeof x[2] === 'string').length, 'text'),
        '<div class="wk-row wk-bfind">' + (gl.length > 1 ? '<label class="sc-f px-inline">Part or lesson<select id="bdPart">' + opt('', 'Whole module (' + plural(gl.length, 'part') + ')', !st.part) + gl.map(g => opt(g[0], g[1], g[0] === st.part)).join('') + '</select></label>' : '') + '<input class="wk-find" id="bdFind" type="search" placeholder="Find a lesson, question or word" value="' + esc(st.filter) + '" aria-label="Find in this module"></div>' +
        '<form id="bdForm" class="wk-bform" novalidate>' + (shown.length ? shown.slice(0, 400).map(x => {
          const id = 'bf' + fl.indexOf(x), rtl = /[؀-ۿ]/.test(x[2]);
          if (typeof x[2] === 'boolean') return '<label class="px-check wk-bf wk-bcheck"><input type="checkbox" id="' + id + '" data-i="' + fl.indexOf(x) + '"' + (x[2] ? ' checked' : '') + '> Right answer</label>';
          return '<label class="sc-f wk-bf" for="' + id + '"><span>' + esc(x[1]) + '</span>' + (LONG(x[2]) ? '<textarea id="' + id + '" data-i="' + fl.indexOf(x) + '" rows="' + Math.min(10, Math.max(2, Math.ceil(x[2].length / 70))) + '"' + (rtl ? ' dir="rtl"' : '') + '>' + esc(x[2]) + '</textarea>'
            : '<input type="text" id="' + id + '" data-i="' + fl.indexOf(x) + '" value="' + esc(x[2]) + '"' + (rtl ? ' dir="rtl"' : '') + '>') + '</label>';
        }).join('') + (shown.length > 400 ? '<p class="p-empty">Showing the first 400. Pick a part or lesson above, or use Find.</p>' : '') : empty('Nothing matches.')) + '</form>' +
        '<div class="wk-row wk-bsave"><button class="p-btn is-ghost" type="button" id="bdSave">Save draft</button><button class="p-btn" type="button" id="bdPub">Publish</button>' +
        (st.draft ? '<button class="p-btn is-ghost" type="button" id="bdDrop">Throw away the draft</button>' : '') + '<p class="p-empty" id="bdMsg" role="status"></p></div>');
      drawTop();
      st.fields = fl;
    }
    function collect(){ body.querySelectorAll('#bdForm [data-i]').forEach(inp => { const x = st.fields[+inp.dataset.i]; if (!x) return; const v = inp.type === 'checkbox' ? inp.checked : inp.value; if (v !== x[2]) { setIn(st.mod, x[0], v); x[2] = v; } }); }
    async function saveDraft(){
      collect();
      const c = st.course, item = st.list[st.modIdx];
      const x = c.kind === 'db' ? await writeJson(draftPath(c, item.id), st.mod) : await writeJson(draftPath(c), st.data);
      if (x.error) { say('bdMsg', 'Couldn’t save the draft. ' + (x.error.message || '')); return false; }
      st.draft = true; return true;
    }
    async function publish(){
      if (!await saveDraft()) return;
      const c = st.course, item = st.list[st.modIdx], stamp = new Date().toISOString().replace(/[:.]/g, '-');
      say('bdMsg', 'Publishing…');
      if (c.kind === 'db') {
        const old = (await safe(db().rpc('portal_builder_module', { p_id:item.id }))).data;
        if (old) await writeJson('_src/backups/' + c.id + '/' + item.id + '-' + stamp + '.json', old);
        const x = await safe(db().rpc('course_add_module', { p_file:{ course:{ modules:[st.mod] } } }));
        if (x.error) return say('bdMsg', 'Not published: ' + (x.error.message || 'try again.'));
        await bucket().remove([draftPath(c, item.id)]);
      } else {
        const old = await readJson(c.id + '/content.json');
        if (old) await writeJson('_src/backups/' + c.id + '/content-' + stamp + '.json', old);
        const x = await writeJson(c.id + '/content.json', st.data);
        if (!x.error && window.LearnOutline) { const o = window.LearnOutline.make(st.data); if (o) await writeJson(c.id + '/outline.json', o); }   // small file for the course home and Daily review
        if (x.error) return say('bdMsg', 'Not published: ' + (x.error.message || 'try again.'));
        await bucket().remove([draftPath(c)]);
      }
      st.draft = false; draw(); say('bdMsg', 'Published. Learners see it the next time they open the course. The old version is kept in the backups folder.');
    }
    body.addEventListener('click', async e => {
      const t = e.target.closest('[data-bc]');
      if (t) { st.course = COURSES.find(c => c.id === t.dataset.bc); st.filter = ''; st.part = ''; loadCourse(); return; }
      if (e.target.id === 'bdSave') { say('bdMsg', 'Saving…'); if (await saveDraft()) { draw(); say('bdMsg', 'Draft saved. Learners still see the live version.'); } }
      if (e.target.id === 'bdPub') { const b = e.target; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Publish to learners'; return; } publish(); }
      if (e.target.id === 'bdDrop') { const b = e.target; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Throw it away'; return; }
        const c = st.course; await bucket().remove([c.kind === 'db' ? draftPath(c, st.list[st.modIdx].id) : draftPath(c)]); loadCourse(); }
    });
    body.addEventListener('change', async e => {
      if (e.target.id === 'bdMod') { collect(); if (st.course.kind === 'db' && st.draft) await saveDraft(); st.modIdx = +e.target.value; st.filter = ''; st.part = ''; loadModule(); }
      if (e.target.id === 'bdPart') { collect(); st.part = e.target.value; draw(); }
    });
    body.addEventListener('input', e => { if (e.target.id === 'bdFind') { collect(); st.filter = e.target.value; const pos = e.target.selectionStart; draw(); const nf = $('bdFind'); nf.focus(); nf.setSelectionRange(pos, pos); } });
    loadCourse();
  }};
})();
