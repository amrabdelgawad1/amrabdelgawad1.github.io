// Round 11: the portal's own work tools, so nothing needs WhatsApp, a notes app or another site.
//   #tasks     Tasks: Amr gives a task to anyone (or himself), with a due date and an optional repeat. Reps tick theirs.
//   #messages  Messages: one thread per person with Amr, plus a whole-team thread.
//   #handbook  Handbook: how we work, written once by Amr, read and ticked by everyone.
//   #daily     Daily review: quiz questions a learner missed come back on a schedule until they stick.
//   #builder   Course builder: moved to r30-builder.js in Round 30.
// Database: portal_tasks, portal_messages (+ portal_message_reads), handbook_pages (+ handbook_reads), review_cards with
// portal_review_today / portal_review_answer. (portal_builder_modules / portal_builder_module are used by r30-builder.js.) Row rules decide who sees what.
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
      if (window.PortalUI && PortalUI.del) { PortalUI.del(d, { text:'Task deleted.', label:'Delete', rows:[d.parentElement], run:() => safe(db().from('portal_tasks').delete().eq('id', +d.dataset.tdel)), after:() => reload() }); return; }
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

  // The course builder moved to r30-builder.js (Round 30): one builder for every course, with drafts, a live preview and the checker.
})();
