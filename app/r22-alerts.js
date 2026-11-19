// Round 22 of the Portal Master Feature Plan (Nov 19 2026): tasks and alerts.
//   #tasks          N1  Task manager: list and board views, due dates, priority, repeats (every day, weekdays, week, month),
//                       a link to a deal, lesson or page, comments on each task. Replaces the Round 11 page in work.js.
//                       Repeats now come back from the database when a task is done; due-today bells at 7 AM New York.
//   @mentions       N3  Type @ in Messages, task notes, task comments, file notes or Review center comments: the person gets a bell.
//                       window.R22Mention.attach(textarea) adds the picker anywhere; R22Mention.send() is for places the
//                       database can't read (the encrypted Deal CRM).
//   #notify         N4  Bell, phone and daily email per kind of alert (also Settings › Notifications and a link under the bell).
//   Must-read       N6  Announcements people must confirm. The team gets a box until they confirm; Amr sees who hasn't, and can nudge.
//   #subscriptions  F2  Every tool paid for regularly: renewal dates, reminder bells, monthly and yearly cost, "Log payment" into Cash.
//   Budget alerts   F8  Cash › Budgets: a bell at the alert % (80% unless changed) and at 100% (database: private.budget_alerts).
// Nothing here sends an email or a message by itself, or moves money: "Log payment" only records an expense in Cash.
// Database: notify_kind_prefs, portal_comments, portal_tasks (status, priority, link, sort), announcements.must_read,
// announcement_confirms, cash_subscriptions, cash_budgets.alert_pct, cash_budget_alerts; mention_people(), mention_send(),
// announcement_post_must(), my_must_reads(), must_read_status(), must_read_nudge(), subscription_paid(), subscription_undo().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, fmtTime, num, plural, card, empty, failed, pill, f, opt, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const uid = () => (T().user || {}).id;
  const today = () => isoDay(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoDay(d); };
  const day = d => d ? fmtDay(d, { month:'short', day:'numeric' }) : '';
  const when = at => { const d = new Date(at), same = isoDay(d) === today(); return same ? 'Today, ' + fmtTime(at) : fmtDay(at, { month:'short', day:'numeric' }) + ', ' + fmtTime(at); };
  const sure = (b, text, back) => { if (b.dataset.sure === '1') return true; b.dataset.sure = '1'; b.textContent = text; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = back; } }, 4000); return false; };
  const tile = (v, k, s, hot) => '<div class="p-tile' + (hot ? ' r19-hot' : '') + '"><b>' + esc(v) + '</b><span>' + esc(k) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div>';
  const tiles = list => '<div class="p-tiles r20-tiles">' + list.join('') + '</div>';
  const notSetUp = e => /does not exist|schema cache|could not find/i.test((e && e.message) || '');

  // ======================================================================
  // People (for names and the @ picker)
  // ======================================================================
  let PEOPLE = null;
  async function people(){
    if (PEOPLE) return PEOPLE;
    const r = await safe(db().rpc('mention_people'));
    PEOPLE = (r.data || []).filter(p => p.user_id && p.name);
    return PEOPLE;
  }
  const nameOf = id => { const p = (PEOPLE || []).find(x => x.user_id === id); return p ? p.name : id === uid() ? 'You' : 'Someone'; };
  document.addEventListener('talents-signed-in', () => { PEOPLE = null; });

  // ======================================================================
  // N3 the @ picker: type @ and a few letters, pick a name with the arrows and Enter, Tab or a click
  // ======================================================================
  const pick = document.createElement('ul');
  pick.className = 'r22-pick'; pick.setAttribute('role', 'listbox'); pick.id = 'r22Pick'; pick.hidden = true;
  document.body.appendChild(pick);
  let pk = { ta:null, start:0, list:[], i:0 };
  function query(ta){
    const pos = ta.selectionStart, before = ta.value.slice(0, pos);
    const m = before.match(/(^|[^\w@])@([\p{L}\w .'-]{0,30})$/u);
    if (!m) return null;
    const q = m[2];
    if (/\s{2}|^\s/.test(q)) return null;
    return { q, start:pos - q.length - 1 };
  }
  function closePick(){ pick.hidden = true; if (pk.ta) { pk.ta.removeAttribute('aria-activedescendant'); pk.ta.setAttribute('aria-expanded', 'false'); } pk.list = []; }
  function drawPick(){
    if (!pk.list.length) return closePick();
    pick.innerHTML = pk.list.map((p, i) => '<li role="option" id="r22Pk' + i + '" data-i="' + i + '"' + (i === pk.i ? ' aria-selected="true" class="on"' : ' aria-selected="false"') + '><b>@' + esc(p.name) + '</b></li>').join('');
    const r = pk.ta.getBoundingClientRect();
    pick.style.left = Math.max(8, Math.min(window.innerWidth - 268, r.left + window.scrollX)) + 'px';
    const below = r.bottom + 4 + 220 < window.innerHeight;
    pick.style.top = (below ? r.bottom + window.scrollY + 4 : r.top + window.scrollY - Math.min(220, pk.list.length * 40 + 12) - 4) + 'px';
    pick.hidden = false;
    pk.ta.setAttribute('aria-expanded', 'true'); pk.ta.setAttribute('aria-activedescendant', 'r22Pk' + pk.i);
  }
  async function onInput(ta){
    const q = query(ta);
    if (!q) return closePick();
    const ppl = await people(), s = q.q.trim().toLowerCase();
    pk.ta = ta; pk.start = q.start; pk.i = 0;
    pk.list = ppl.filter(p => p.user_id !== uid() && (!s || p.name.toLowerCase().startsWith(s) || p.name.toLowerCase().split(/\s+/).some(w => w.startsWith(s)))).slice(0, 6);
    drawPick();
  }
  function choose(i){
    const p = pk.list[i], ta = pk.ta; if (!p || !ta) return;
    const end = ta.selectionStart, ins = '@' + p.name + ' ';
    ta.value = ta.value.slice(0, pk.start) + ins + ta.value.slice(end);
    const at = pk.start + ins.length; ta.setSelectionRange(at, at); ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles:true }));
    closePick();
  }
  pick.addEventListener('mousedown', e => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); choose(+li.dataset.i); } });
  const R22Mention = window.R22Mention = {
    attach(ta){
      if (!ta || ta.dataset.r22m) return;
      ta.dataset.r22m = '1';
      ta.setAttribute('aria-autocomplete', 'list'); ta.setAttribute('aria-controls', 'r22Pick'); ta.setAttribute('aria-expanded', 'false');
      if (!ta.placeholder || !/@/.test(ta.placeholder)) ta.placeholder = (ta.placeholder ? ta.placeholder + ' · ' : '') + 'type @ to mention someone';
      ta.addEventListener('input', () => onInput(ta));
      ta.addEventListener('keydown', e => {
        if (pick.hidden || pk.ta !== ta) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pk.i = (pk.i + (e.key === 'ArrowDown' ? 1 : -1) + pk.list.length) % pk.list.length; drawPick(); }
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); choose(pk.i); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePick(); }
      }, true);
      ta.addEventListener('blur', () => setTimeout(() => { if (pk.ta === ta) closePick(); }, 150));
    },
    // the people named with @ in a text (for pages whose text the database can't read)
    async who(text){ const ppl = await people(); return ppl.filter(p => new RegExp('(^|[^\\w])@' + p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])', 'i').test(text || '')).map(p => p.user_id); },
    async send(text, where, link){ const ids = (await this.who(text)).filter(id => id !== uid()); if (!ids.length) return 0; const r = await safe(db().rpc('mention_send', { p_users:ids, p_where:where, p_link:link })); return r.error ? 0 : r.data; }
  };
  // Messages (work.js) and Review center comments: attach the picker when their box shows up
  const AUTO = '#msBody, .rv-form textarea, textarea[data-mention]';
  document.addEventListener('focusin', e => { const t = e.target; if (t && t.tagName === 'TEXTAREA' && t.matches(AUTO)) R22Mention.attach(t); });
  window.addEventListener('resize', closePick);
  document.addEventListener('scroll', () => { if (!pick.hidden) closePick(); }, true);
  // @names stand out in shown text
  const withMentions = text => esc(text).replace(/(^|[^\w])@([\p{L}][\p{L}\w'-]*(?: [\p{Lu}][\p{L}\w'-]*)?)/gu, (m, a, n) => a + '<b class="r22-at">@' + n + '</b>');
  PX.withMentions = withMentions;

  // ======================================================================
  // Comments (tasks and files), with @mentions
  // ======================================================================
  const COUNTS = { task:new Map(), file:new Map() };
  const R22Comments = window.R22Comments = {
    count(thing, id){ return COUNTS[thing].get(String(id)) || 0; },
    async load(thing){
      const r = await safe(db().from('portal_comments').select('thing_id').eq('thing', thing).limit(5000));
      COUNTS[thing] = new Map(); (r.data || []).forEach(x => COUNTS[thing].set(x.thing_id, (COUNTS[thing].get(x.thing_id) || 0) + 1));
    },
    async thread(box, thing, id){
      await people();
      const r = await safe(db().from('portal_comments').select('*').eq('thing', thing).eq('thing_id', String(id)).order('created_at'));
      if (r.error) { box.innerHTML = notSetUp(r.error) ? '<p class="p-hint">Comments aren’t set up in the database yet.</p>' : '<p class="p-hint">Couldn’t load the comments.</p>'; return; }
      const list = r.data || [];
      COUNTS[thing].set(String(id), list.length);
      box.innerHTML = '<div class="r22-comments">' + (list.length ? list.map(c => '<div class="r22-c' + (c.author === uid() ? ' is-me' : '') + '"><div class="r22-c-head"><b>' + esc(nameOf(c.author)) + '</b><time>' + esc(when(c.created_at)) + '</time>' +
          ((c.author === uid() || isOwner()) ? '<button type="button" class="r22-link" data-r22cdel="' + c.id + '">Delete</button>' : '') + '</div><p>' + withMentions(c.body) + '</p></div>').join('') : '<p class="p-hint">No comments yet.</p>') + '</div>' +
        '<form class="r22-cform" data-thing="' + thing + '" data-id="' + esc(String(id)) + '" novalidate><label class="r22-sr" for="r22CBody">Comment</label><textarea id="r22CBody" rows="2" maxlength="4000" placeholder="Write a comment"></textarea>' +
        '<button type="submit" class="p-btn">Comment</button><span class="p-hint r22-cmsg" role="status"></span></form>';
      R22Mention.attach(box.querySelector('textarea'));
    }
  };
  document.addEventListener('submit', async e => {
    const fm = e.target.closest('.r22-cform'); if (!fm) return;
    e.preventDefault();
    const ta = fm.querySelector('textarea'), body = ta.value.trim(), msg = fm.querySelector('.r22-cmsg');
    if (!body) { msg.textContent = 'Write something first.'; return; }
    const b = fm.querySelector('button[type=submit]'); b.disabled = true;
    const x = await safe(db().from('portal_comments').insert({ thing:fm.dataset.thing, thing_id:fm.dataset.id, body }));
    b.disabled = false;
    if (x.error) { msg.textContent = errText(x, 'Couldn’t save it. Try again.'); return; }
    const box = fm.parentElement; await R22Comments.thread(box, fm.dataset.thing, fm.dataset.id);
    const t = box.querySelector('textarea'); if (t) t.focus();
    document.dispatchEvent(new CustomEvent('r22-comment', { detail:{ thing:fm.dataset.thing, id:fm.dataset.id } }));
  });
  document.addEventListener('click', async e => {
    const d = e.target.closest('[data-r22cdel]'); if (!d) return;
    if (window.PortalUI && PortalUI.del) { const box = d.closest('.r22-comments').parentElement, fm = box.querySelector('.r22-cform'); PortalUI.del(d, { text:'Comment deleted.', label:'Delete', sel:'.r22-c', run:() => safe(db().from('portal_comments').delete().eq('id', +d.dataset.r22cdel)), after:() => { if (fm) R22Comments.thread(box, fm.dataset.thing, fm.dataset.id); } }); return; }
    if (!sure(d, 'Sure?', 'Delete')) return;
    const box = d.closest('.r22-comments').parentElement, fm = box.querySelector('.r22-cform');
    await safe(db().from('portal_comments').delete().eq('id', +d.dataset.r22cdel));
    if (fm) R22Comments.thread(box, fm.dataset.thing, fm.dataset.id);
  });

  // A simple dialog (files' notes; a task's details on small screens use the same)
  function dialog(title, inner){
    let d = document.getElementById('r22Dlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'r22Dlg'; d.className = 'r22-dlg'; d.setAttribute('aria-labelledby', 'r22DlgH'); document.body.appendChild(d);
      d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-r22x]')) d.close(); });
      d.addEventListener('close', () => document.dispatchEvent(new CustomEvent('r22-dialog-closed'))); }
    d.innerHTML = '<div class="r22-dlg-in"><div class="r22-dlg-head"><h2 id="r22DlgH">' + esc(title) + '</h2><button type="button" class="r22-x" data-r22x aria-label="Close">×</button></div><div class="r22-dlg-body">' + inner + '</div></div>';
    if (!d.open) d.showModal();
    return d.querySelector('.r22-dlg-body');
  }
  // Files: notes on a file (r17-files.js draws the button)
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-r22fnote]'); if (!b) return;
    const body = dialog('Notes: ' + b.dataset.r22ftitle, '<p class="p-hint">' + (b.dataset.r22fnote.startsWith('shared/') ? 'The team can read notes on shared files.' : 'Only you can see notes on your own files.') + ' Type @ to mention someone.</p><div class="r22-fthread"><p class="p-hint">Loading…</p></div>');
    await R22Comments.thread(body.querySelector('.r22-fthread'), 'file', 'files|' + b.dataset.r22fnote);
    const t = body.querySelector('textarea'); if (t) t.focus();
  });

  // ======================================================================
  // #tasks  N1  Task manager
  // ======================================================================
  const REPEAT = { daily:'Every day', weekdays:'Weekdays', weekly:'Every week', monthly:'Every month' };
  const PRI = { high:['High', 'no'], normal:['Normal', 'plain'], low:['Low', 'plain'] };
  const STATUS = [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']];
  const safeLink = u => /^(#|\/(?![\/\\])|https?:\/\/)/i.test(u || '') ? u : '';
  const linkName = u => /^\/app\/deals\//.test(u) ? 'Open the deal' : /^\/app\/(learn|course|psychology)|^#learn|\/course\//.test(u) ? 'Open the lesson' : /^#files/.test(u) ? 'Open the file' : /^https?:/.test(u) ? 'Open the link' : 'Open';
  let viewPref = 'list'; try { viewPref = localStorage.getItem('r22TaskView') || 'list'; } catch(e) {}
  V.tasks = { title:'Tasks', sec:'everyone', async open(el, ok){
    const owner = isOwner();
    const body = PX.page(el, 'Work', 'Tasks', owner ? 'Give anyone a task with a due date, see it as a list or a board, and talk about it in its comments. Repeating tasks come back on their own when done.' : 'What you need to do, from Amr or from you. Move it to Doing, tick it when it’s done, and comment if you need something. Type @ to mention someone.');
    const S = { view:viewPref, who:'', showDone:false, open:+(location.hash.split('/')[1] || 0) || null, edit:false, adding:false };
    let all = [];
    async function load(){
      const [r] = await Promise.all([safe(db().from('portal_tasks').select('*').order('due_on', { ascending:true, nullsFirst:false }).order('sort').order('created_at').limit(1000)), people(), R22Comments.load('task')]);
      if (!ok()) return false;
      if (r.error) { body.innerHTML = failed(r.error); return false; }
      all = r.data || [];
      return true;
    }
    const who = t => t.assigned_to ? (t.assigned_to === uid() ? (owner ? 'You' : 'You') : nameOf(t.assigned_to)) : owner ? 'You' : 'Amr';
    const late = t => t.status !== 'done' && t.due_on && t.due_on < today();
    const duePill = t => t.due_on ? pill(t.status !== 'done' && t.due_on === today() ? 'Today' : late(t) ? 'Late · ' + day(t.due_on) : fmtDay(t.due_on, { weekday:'short', month:'short', day:'numeric' }), late(t) ? 'no' : t.due_on === today() && t.status !== 'done' ? '' : 'plain') : '';
    const mine = t => S.who === '' ? true : S.who === 'me' ? (t.assigned_to === uid() || (owner && !t.assigned_to)) : t.assigned_to === S.who;
    function meta(t){
      const n = R22Comments.count('task', t.id);
      return '<span class="wk-meta">' + (owner ? '<span>' + esc(who(t)) + '</span>' : t.created_by && t.created_by !== uid() ? '<span>From ' + esc(nameOf(t.created_by)) + '</span>' : '') + duePill(t) +
        (t.priority !== 'normal' ? pill(PRI[t.priority][0] + ' priority', PRI[t.priority][1]) : '') + (t.repeat ? pill(REPEAT[t.repeat] || t.repeat, 'plain') : '') +
        (t.status === 'doing' ? pill('Doing', 'ok') : '') + (n ? '<span class="r22-cn">' + plural(n, 'comment') + '</span>' : '') + '</span>';
    }
    function row(t){
      return '<div class="wk-task r22-task' + (t.status === 'done' ? ' is-done' : '') + (S.open === t.id ? ' is-open' : '') + '" data-tid="' + t.id + '">' +
        '<label class="wk-tick"><input type="checkbox" data-r22done="' + t.id + '"' + (t.status === 'done' ? ' checked' : '') + ' aria-label="Done: ' + esc(t.title) + '"></label>' +
        '<button type="button" class="r22-tt" data-r22open="' + t.id + '" aria-expanded="' + (S.open === t.id) + '"><b>' + esc(t.title) + '</b>' + meta(t) + '</button></div>' +
        (S.open === t.id ? detail(t) : '');
    }
    function cardHtml(t){
      const i = STATUS.findIndex(s => s[0] === t.status);
      return '<li class="r22-card' + (t.priority === 'high' ? ' is-high' : '') + (late(t) ? ' is-late' : '') + '" draggable="true" data-tid="' + t.id + '">' +
        '<button type="button" class="r22-tt" data-r22open="' + t.id + '"><b>' + esc(t.title) + '</b>' + meta(t) + '</button>' +
        '<div class="r22-moves">' + (i > 0 ? '<button type="button" class="r22-mv" data-r22mv="' + t.id + '" data-to="' + STATUS[i - 1][0] + '" aria-label="Move ' + esc(t.title) + ' to ' + STATUS[i - 1][1] + '">← ' + STATUS[i - 1][1] + '</button>' : '<span></span>') +
        (i < 2 ? '<button type="button" class="r22-mv" data-r22mv="' + t.id + '" data-to="' + STATUS[i + 1][0] + '" aria-label="Move ' + esc(t.title) + ' to ' + STATUS[i + 1][1] + '">' + STATUS[i + 1][1] + ' →</button>' : '') + '</div></li>';
    }
    function form(t){
      const v = t || { title:'', notes:'', due_on:today(), repeat:null, priority:'normal', link:'', assigned_to:null, status:'todo' };
      const canAssign = owner;
      return '<form class="px-form r22-tform" data-id="' + (t ? t.id : '') + '" novalidate>' +
        f('Task', '<input type="text" name="title" maxlength="300" value="' + esc(v.title) + '" placeholder="e.g. Send the weekly numbers">', 'px-wide') +
        (canAssign ? f('For', '<select name="who">' + opt('', 'Me', !v.assigned_to || v.assigned_to === uid()) + (PEOPLE || []).filter(p => p.name !== 'Amr').map(p => opt(p.user_id, p.name, v.assigned_to === p.user_id)).join('') + '</select>') : '') +
        f('Due', '<input type="date" name="due" value="' + esc(v.due_on || '') + '">') +
        f('Repeats', '<select name="repeat">' + opt('', 'No', !v.repeat) + Object.entries(REPEAT).map(([k, l]) => opt(k, l, v.repeat === k)).join('') + '</select>') +
        f('Priority', '<select name="priority">' + Object.entries(PRI).map(([k, l]) => opt(k, l[0], v.priority === k)).join('') + '</select>') +
        (t ? f('Status', '<select name="status">' + STATUS.map(([k, l]) => opt(k, l, v.status === k)).join('') + '</select>') : '') +
        f('Link (optional)', '<input type="text" name="link" maxlength="500" value="' + esc(v.link || '') + '" placeholder="A deal, lesson or page address">', 'px-wide') +
        f('Notes (optional)', '<textarea name="notes" rows="3" maxlength="4000" data-mention placeholder="Details. Type @ to mention someone">' + esc(v.notes || '') + '</textarea>', 'px-wide') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">' + (t ? 'Save task' : 'Add task') + '</button>' + (t || S.adding ? '<button type="button" class="p-btn is-ghost" data-r22tx>Cancel</button>' : '') + '<span class="p-hint r22-tmsg" role="status"></span></div></form>';
    }
    function detail(t){
      const canEdit = owner || t.created_by === uid() || t.assigned_to === uid();
      const link = safeLink(t.link);
      return '<div class="r22-detail" id="r22Detail">' + (S.edit && canEdit ? form(t) :
        '<div class="r22-dhead"><div>' + (t.notes ? '<p class="px-pre">' + withMentions(t.notes) + '</p>' : '<p class="p-hint">No notes.</p>') +
          '<p class="p-hint">Added ' + esc(when(t.created_at)) + (t.created_by ? ' by ' + esc(t.created_by === uid() ? 'you' : nameOf(t.created_by)) : '') + (t.done_at ? ' · done ' + esc(when(t.done_at)) : '') + '</p>' +
          (link ? '<a class="p-btn is-ghost" href="' + esc(link) + '"' + (/^https?:/i.test(link) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(linkName(link)) + '</a>' : '') + '</div>' +
          '<div class="r22-dacts">' + STATUS.map(([k, l]) => '<button type="button" class="p-btn' + (t.status === k ? '' : ' is-ghost') + '" data-r22mv="' + t.id + '" data-to="' + k + '" aria-pressed="' + (t.status === k) + '">' + l + '</button>').join('') +
            (canEdit ? '<button type="button" class="p-btn is-ghost" data-r22edit="' + t.id + '">Edit</button>' : '') +
            ((owner || t.created_by === uid()) ? '<button type="button" class="p-btn is-ghost" data-r22del="' + t.id + '">Delete</button>' : '') + '</div></div>') +
        '<h3 class="r22-h">Comments</h3><div class="r22-tthread" data-tid="' + t.id + '"><p class="p-hint">Loading…</p></div></div>';
    }
    function draw(){
      const open = all.filter(t => t.status !== 'done' && mine(t)), done = all.filter(t => t.status === 'done' && mine(t)).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''));
      const wk = addDays(today(), 7);
      const lateN = open.filter(late).length, todayN = open.filter(t => t.due_on === today()).length, doingN = open.filter(t => t.status === 'doing').length;
      const doneWeek = done.filter(t => t.done_at && t.done_at.slice(0, 10) >= addDays(today(), -6)).length;
      const tools = '<div class="px-tools r22-ttools"><div class="r22-seg" role="group" aria-label="View">' + [['list', 'List'], ['board', 'Board']].map(([k, l]) => '<button type="button" class="p-btn' + (S.view === k ? '' : ' is-ghost') + '" data-r22view="' + k + '" aria-pressed="' + (S.view === k) + '">' + l + '</button>').join('') + '</div>' +
        (owner ? f('Show', '<select id="r22Who">' + opt('', 'Everyone', S.who === '') + opt('me', 'Mine', S.who === 'me') + (PEOPLE || []).filter(p => p.name !== 'Amr').map(p => opt(p.user_id, p.name, S.who === p.user_id)).join('') + '</select>') : '') +
        (S.view === 'list' ? '<label class="px-check"><input type="checkbox" id="r22ShowDone"' + (S.showDone ? ' checked' : '') + '> Show done</label>' : '') +
        '<button type="button" class="p-btn" data-r22add>+ New task</button></div>';
      let main;
      if (S.view === 'board') {
        const col = (k, l, list) => '<section class="r22-col" data-col="' + k + '" aria-label="' + l + '"><h3>' + l + ' <span>' + list.length + '</span></h3><ul class="r22-cards" data-col="' + k + '">' + (list.length ? list.map(cardHtml).join('') : '<li class="r22-none">' + (k === 'done' ? 'Done tasks from the last 14 days show here.' : 'Nothing here. Drag a card here.') + '</li>') + '</ul></section>';
        const byDue = (a, b) => (a.due_on || '9999').localeCompare(b.due_on || '9999') || (a.priority === 'high' ? -1 : 0) - (b.priority === 'high' ? -1 : 0);
        main = '<div class="r22-board">' + col('todo', 'To do', open.filter(t => t.status === 'todo').sort(byDue)) + col('doing', 'Doing', open.filter(t => t.status === 'doing').sort(byDue)) +
          col('done', 'Done', done.filter(t => t.done_at && t.done_at.slice(0, 10) >= addDays(today(), -13))) + '</div>';
        const sel = S.open && all.find(t => t.id === S.open);
        if (sel) main += card(sel.title, esc(who(sel)) + ' · ' + (STATUS.find(s => s[0] === sel.status) || [0, ''])[1], detail(sel), 'r22Sel');
      } else {
        const groups = [['Today and late', open.filter(t => t.due_on && t.due_on <= today())], ['This week', open.filter(t => t.due_on && t.due_on > today() && t.due_on <= wk)],
          ['Later', open.filter(t => t.due_on && t.due_on > wk)], ['No date', open.filter(t => !t.due_on)]];
        main = groups.filter(([h, list]) => list.length || h === 'Today and late').map(([h, list]) => card(h, list.length ? list.length + ' open' : '', list.length ? list.map(row).join('') : empty('Nothing due today.'))).join('') +
          (S.showDone ? card('Done', plural(done.length, 'task'), done.length ? done.slice(0, 60).map(row).join('') : empty('Ticked tasks show here.')) : '');
      }
      body.innerHTML = tiles([tile(lateN, 'late', lateN ? 'past their due date' : 'nothing late', lateN > 0), tile(todayN, 'due today', ''), tile(doingN, 'in progress', ''), tile(doneWeek, 'done this week', '')]) +
        tools + (S.adding ? card('New task', '', form(null)) : '') + main;
      const th = body.querySelector('.r22-tthread'); if (th) R22Comments.thread(th, 'task', th.dataset.tid);
      body.querySelectorAll('textarea[data-mention]').forEach(R22Mention.attach);
    }
    async function setStatus(id, status){
      const t = all.find(x => x.id === id); if (!t || t.status === status) return;
      const was = t.status; t.status = status; draw();
      const x = await safe(db().from('portal_tasks').update({ status }).eq('id', id));
      if (x.error) { t.status = was; draw(); return; }
      if (status === 'done' && t.repeat) { await load(); draw(); }   // the next one comes back from the database
    }
    if (!await load()) return;
    if (S.open && !all.find(t => t.id === S.open)) S.open = null;
    draw();
    if (S.open) { const d = $('r22Detail'); if (d) d.scrollIntoView({ block:'center' }); }
    const keep = () => history.replaceState(null, '', '#tasks' + (S.open ? '/' + S.open : ''));
    body.addEventListener('change', e => {
      const c = e.target.closest('[data-r22done]'); if (c) { setStatus(+c.dataset.r22done, c.checked ? 'done' : 'todo'); return; }
      if (e.target.id === 'r22Who') { S.who = e.target.value; draw(); return; }
      if (e.target.id === 'r22ShowDone') { S.showDone = e.target.checked; draw(); }
    });
    body.addEventListener('click', async e => {
      const v = e.target.closest('[data-r22view]'); if (v) { S.view = v.dataset.r22view; try { localStorage.setItem('r22TaskView', S.view); } catch(x) {} draw(); return; }
      if (e.target.closest('[data-r22add]')) { S.adding = true; draw(); const i = body.querySelector('.r22-tform input[name=title]'); if (i) i.focus(); return; }
      if (e.target.closest('[data-r22tx]')) { S.adding = false; S.edit = false; draw(); return; }
      const o = e.target.closest('[data-r22open]'); if (o) { const id = +o.dataset.r22open; S.open = S.open === id ? null : id; S.edit = false; keep(); draw(); if (S.open) { const d = $('r22Detail'); if (d) d.scrollIntoView({ block:'nearest' }); } return; }
      const m = e.target.closest('[data-r22mv]'); if (m) { setStatus(+m.dataset.r22mv, m.dataset.to); return; }
      const ed = e.target.closest('[data-r22edit]'); if (ed) { S.edit = true; draw(); return; }
      const dl = e.target.closest('[data-r22del]');
      if (dl && window.PortalUI && PortalUI.del) { const id = +dl.dataset.r22del; PortalUI.del(dl, { text:'Task deleted.', label:'Delete', rows:[$('r22Detail')].concat([...body.querySelectorAll('[data-r22open="' + id + '"]')]), run:() => safe(db().from('portal_tasks').delete().eq('id', id)), after:async () => { S.open = null; keep(); await load(); draw(); } }); return; }
      if (dl) { if (!sure(dl, 'Sure? Delete', 'Delete')) return; dl.disabled = true; const x = await safe(db().from('portal_tasks').delete().eq('id', +dl.dataset.r22del)); if (!x.error) { S.open = null; keep(); await load(); draw(); } return; }
    });
    body.addEventListener('submit', async e => {
      const fm = e.target.closest('.r22-tform'); if (!fm) return;
      e.preventDefault();
      const g = n => fm.elements[n] ? fm.elements[n].value.trim() : '';
      const title = g('title'); if (!title) return say2(fm, 'Write the task first.');
      const link = g('link');
      if (link && !safeLink(link)) return say2(fm, 'A link starts with #, /app/ or https://');
      const row = { title, due_on:g('due') || null, repeat:g('repeat') || null, priority:g('priority') || 'normal', link:link || null, notes:g('notes') || null };
      if (owner) row.assigned_to = g('who') || null;
      if (fm.elements.status) row.status = g('status');
      const id = +fm.dataset.id;
      say2(fm, 'Saving…');
      let x;
      if (id) x = await safe(db().from('portal_tasks').update(row).eq('id', id));
      else { if (!owner) row.assigned_to = uid(); row.created_by = uid(); x = await safe(db().from('portal_tasks').insert(row).select('id').single()); }
      if (x.error) return say2(fm, errText(x, 'Couldn’t save it. Try again.'));
      S.adding = false; S.edit = false; if (!id && x.data) S.open = null;
      await load(); draw();
    });
    const say2 = (fm, t) => { const m = fm.querySelector('.r22-tmsg'); if (m) m.textContent = t; };
    // Board: drag a card to another column (the arrow buttons do the same on a phone or with a keyboard)
    let dragId = null;
    body.addEventListener('dragstart', e => { const c = e.target.closest('.r22-card'); if (!c) return; dragId = +c.dataset.tid; c.classList.add('is-drag'); try { e.dataTransfer.setData('text/plain', String(dragId)); e.dataTransfer.effectAllowed = 'move'; } catch(x) {} });
    body.addEventListener('dragend', e => { const c = e.target.closest('.r22-card'); if (c) c.classList.remove('is-drag'); body.querySelectorAll('.r22-col.is-over').forEach(x => x.classList.remove('is-over')); });
    body.addEventListener('dragover', e => { const col = e.target.closest('.r22-col'); if (!col || dragId == null) return; e.preventDefault(); body.querySelectorAll('.r22-col.is-over').forEach(x => x !== col && x.classList.remove('is-over')); col.classList.add('is-over'); });
    body.addEventListener('drop', e => { const col = e.target.closest('.r22-col'); if (!col || dragId == null) return; e.preventDefault(); const id = dragId; dragId = null; setStatus(id, col.dataset.col); });
  } };

  // ======================================================================
  // N4  Notification settings per type (#notify and Settings › Notifications)
  // ======================================================================
  const GROUPS = [
    ['tasks', 'Tasks', 'New tasks for you, comments on your tasks, due today and late'],
    ['mentions', 'Mentions', 'Someone wrote @ your name'],
    ['messages', 'Messages', 'New messages to you or the whole team'],
    ['news', 'Announcements', 'News from Amr (must-read ones always come through)'],
    ['pay', 'Pay', 'Pay extras, commissions, bonuses and referrals'],
    ['shifts', 'Shifts and schedule', 'Shift reminders, requests, swaps, time off and late starts'],
    ['deals', 'Deals', 'Deal changes, comments, follow-ups, callbacks and proof of funds'],
    ['learning', 'Learning and reviews', 'Reviews of your work, course access and coaching tips'],
    ['money', 'Money', 'Budget alerts and subscription renewals', true],
    ['clients', 'Clients', 'Follow-ups due on client leads and clients', true],
    ['team', 'Team and site', 'Job applications and feedback from the team', true],
    ['other', 'Everything else', 'Anything not listed above']
  ];
  const hourName = h => (h % 12 || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM');
  const R22Notify = window.R22Notify = {
    async draw(B, inPage){
      const kinds = inPage === 'kinds';
      const head = (t, sub) => kinds ? '<h4 id="r22KindsH">Each kind of alert</h4><p class="note">Bell, phone or daily email for each kind. Turning the bell off means that kind isn’t saved at all.</p>' : inPage ? '' : '<div class="set-head"><h3>' + esc(t) + '</h3>' + (sub ? '<p class="note">' + esc(sub) + '</p>' : '') + '</div>';
      B.innerHTML = head('Notifications', 'Pick how each kind of alert reaches you.') + '<p class="note">Loading…</p>';
      const [p, m] = await Promise.all([safe(db().from('notify_kind_prefs').select('*')), safe(db().rpc('notify_email_pref'))]);
      if (p.error) { B.innerHTML = head('Notifications') + '<p class="note">' + (notSetUp(p.error) ? 'This part isn’t set up yet.' : 'Couldn’t load your settings. Check your connection and try again.') + '</p>'; return; }
      const prefs = {}; (p.data || []).forEach(x => prefs[x.grp] = x);
      const mail = m.data || { daily:false, hour:9 };
      const g = k => prefs[k] || { bell:true, phone:true, email:true };
      const box = (k, f, on, dis, label) => '<td><input type="checkbox" data-r22np="' + k + '" data-f="' + f + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + ' aria-label="' + esc(label) + '"></td>';
      B.innerHTML = head('Notifications', 'Pick how each kind of alert reaches you. Off means it isn’t saved at all.') +
        '<div class="r22-np"><table class="r22-nptable"><thead><tr><th scope="col">Kind of alert</th><th scope="col">Bell</th><th scope="col">Phone</th><th scope="col">Daily email</th></tr></thead><tbody>' +
        GROUPS.filter(x => !x[3] || isOwner()).map(([k, l, d]) => { const v = g(k); return '<tr><th scope="row"><b>' + esc(l) + '</b><small>' + esc(d) + '</small></th>' +
          box(k, 'bell', v.bell, false, l + ': bell') + box(k, 'phone', v.bell && v.phone, !v.bell, l + ': phone alert') + box(k, 'email', v.bell && v.email, !v.bell, l + ': in the daily email') + '</tr>'; }).join('') +
        '</tbody></table></div>' +
        (kinds ? '' : '<div class="r22-npmail"><label class="r22-npline"><input type="checkbox" id="r22Daily"' + (mail.daily ? ' checked' : '') + '> Send me the daily email</label>' +
        '<label class="r22-npline"' + (mail.daily ? '' : ' hidden') + ' id="r22HourL">at <select id="r22Hour" aria-label="Email time, Cairo">' + Array.from({ length:24 }, (_, h) => opt(h, hourName(h), +mail.hour === h)).join('') + '</select> Cairo time</label></div>') +
        '<p class="note" id="r22NpMsg" role="status">Phone alerts only reach phones where you turned them on (above, or in Settings › Notifications). The daily email lists alerts you haven’t opened. Sign-in warnings and must-read announcements always come through.</p>';
    }
  };
  document.addEventListener('change', async e => {
    const c = e.target.closest('[data-r22np]');
    const msg = () => document.getElementById('r22NpMsg');
    if (c) {
      const k = c.dataset.r22np, tr = c.closest('tr'), get = f => tr.querySelector('[data-f="' + f + '"]');
      const row = { user_id:uid(), grp:k, bell:get('bell').checked, phone:get('phone').checked, email:get('email').checked, updated_at:new Date().toISOString() };
      if (c.dataset.f === 'bell') { get('phone').disabled = get('email').disabled = !row.bell; if (!row.bell) { get('phone').checked = get('email').checked = false; } else { get('phone').checked = get('email').checked = true; row.phone = row.email = true; } }
      if (!row.bell) { row.phone = false; row.email = false; }
      const x = await safe(db().from('notify_kind_prefs').upsert(row, { onConflict:'user_id,grp' }));
      if (msg()) msg().textContent = x.error ? 'Couldn’t save. Try again.' : 'Saved.';
      return;
    }
    if (e.target.id === 'r22Daily' || e.target.id === 'r22Hour') {
      const on = document.getElementById('r22Daily').checked, hr = +document.getElementById('r22Hour').value;
      document.getElementById('r22HourL').hidden = !on;
      const x = await safe(db().rpc('notify_email_set', { p_daily:on, p_hour:hr }));
      if (msg()) msg().textContent = x.error ? 'Couldn’t save. Try again.' : on ? 'Saved. The daily email comes at ' + hourName(hr) + ' Cairo time, only when there are alerts you haven’t opened.' : 'Daily email off.';
    }
  });
  // Round 23 (I29) made Settings › Notifications (daily email, phone alerts, CRM reminder): the per-kind table goes under it
  const R23 = window.R23Settings;
  if (R23 && R23.notify && !R23.notify.r22) {
    const origNotify = R23.notify;
    R23.notify = async function(B){
      await origNotify(B);
      const sec = document.createElement('section'); sec.className = 'r23-set r22-kinds'; sec.setAttribute('aria-labelledby', 'r22KindsH');
      B.appendChild(sec);
      await R22Notify.draw(sec, 'kinds');
    };
    R23.notify.r22 = true;
  }
  V.notify = { title:'Notification settings', sec:'everyone', async open(el, ok){
    const body = PX.page(el, 'You', 'Notification settings', 'Pick how each kind of alert reaches you: the bell, your phone, the daily email, or not at all.');
    const wrap = document.createElement('div'); wrap.className = 'p-card r22-npcard'; body.innerHTML = ''; body.appendChild(wrap);
    if (window.R23Settings && window.R23Settings.notify) await window.R23Settings.notify(wrap); else await R22Notify.draw(wrap, true);
  } };

  // ======================================================================
  // N6  Must-read announcements
  // ======================================================================
  // Team: a box until each must-read is confirmed ("Later" hides it until the app is opened again)
  let mustLater = new Set(), mustAt = 0;
  async function mustRead(force){
    if (isOwner() || T().role !== 'member' || !db()) return;
    if (!force && Date.now() - mustAt < 5 * 60e3) return;
    mustAt = Date.now();
    const r = await safe(db().rpc('my_must_reads'));
    const list = (r.data || []).filter(a => !mustLater.has(a.id));
    let box = document.getElementById('r22Must');
    if (!list.length) { if (box && box.open) box.close(); return; }
    if (!box) { box = document.createElement('dialog'); box.id = 'r22Must'; box.className = 'r22-dlg r22-must'; box.setAttribute('aria-labelledby', 'r22MustH'); document.body.appendChild(box);
      box.addEventListener('cancel', e => { e.preventDefault(); }); }
    const a = list[0];
    box.innerHTML = '<div class="r22-dlg-in"><div class="r22-dlg-head"><h2 id="r22MustH">Please read: ' + esc(a.title) + '</h2></div><div class="r22-dlg-body">' +
      '<p class="p-hint">From Amr · ' + esc(fmtDay(a.at, { weekday:'short', month:'short', day:'numeric' })) + ', ' + esc(fmtTime(a.at)) + (list.length > 1 ? ' · ' + (list.length - 1) + ' more after this' : '') + '</p>' +
      (a.body ? '<p class="px-pre r22-mbody">' + esc(a.body) + '</p>' : '') +
      '<div class="px-tools"><button type="button" class="p-btn" data-r22ok="' + a.id + '">I read and understand this</button><button type="button" class="p-btn is-ghost" data-r22later="' + a.id + '">Later</button><span class="p-hint" id="r22MustMsg" role="status"></span></div></div></div>';
    if (!box.open) box.showModal();
    const b = box.querySelector('[data-r22ok]'); if (b) b.focus();
  }
  document.addEventListener('click', async e => {
    const okb = e.target.closest('[data-r22ok]'), later = e.target.closest('[data-r22later]');
    if (later) { mustLater.add(+later.dataset.r22later); mustRead(true); return; }
    if (!okb) return;
    okb.disabled = true;
    const x = await safe(db().from('announcement_confirms').insert({ announcement_id:+okb.dataset.r22ok }));
    if (x.error && !/duplicate/i.test(x.error.message || '')) { okb.disabled = false; const m = document.getElementById('r22MustMsg'); if (m) m.textContent = errText(x, 'Couldn’t save it. Try again.'); return; }
    mustRead(true);
  });
  document.addEventListener('talents-signed-in', () => { mustLater = new Set(); setTimeout(() => mustRead(true), 800); });
  window.addEventListener('hashchange', () => setTimeout(() => mustRead(false), 100));
  setInterval(() => { if (!document.hidden) mustRead(false); }, 60e3);

  // Amr: on Announcements, each must-read shows who confirmed and who hasn't, with a nudge button
  if (V.announcements) {
    const orig = V.announcements.open;
    V.announcements.open = async function(el, ok){
      await orig.call(this, el, ok);
      if (!isOwner() || !ok()) return;
      const r = await safe(db().rpc('must_read_status'));
      if (r.error || !ok()) return;
      (r.data || []).forEach(s => {
        const del = el.querySelector('[data-andel="' + s.id + '"]'), art = del && del.closest('article'); if (!art) return;
        const got = s.confirmed || [], miss = s.missing || [];
        art.classList.add('r22-mustart');
        const h = art.querySelector('.px-post-head'); if (h) h.insertAdjacentHTML('afterbegin', pill('Must read', 'no'));
        art.insertAdjacentHTML('beforeend', '<div class="r22-mstat"><b>Confirmed by ' + got.length + ' of ' + (got.length + miss.length) + '</b>' +
          (miss.length ? '<small>Not yet: ' + esc(miss.join(', ')) + '</small>' : '<small>Everyone confirmed.</small>') +
          (got.length ? '<details><summary>Who confirmed, and when</summary><ul>' + got.map(c => '<li>' + esc(c.name) + ' · ' + esc(when(c.at)) + '</li>').join('') + '</ul></details>' : '') +
          (miss.length ? '<button type="button" class="p-btn is-ghost" data-r22nudge="' + s.id + '">Remind them (bell only)</button><span class="p-hint" role="status"></span>' : '') + '</div>');
      });
    };
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-r22nudge]'); if (!b) return;
    b.disabled = true;
    const x = await safe(db().rpc('must_read_nudge', { p_id:+b.dataset.r22nudge }));
    const m = b.nextElementSibling; if (m) m.textContent = x.error ? errText(x, 'Couldn’t send the reminder.') : 'Bell sent to ' + plural(x.data || 0, 'person', 'people') + '.';
  });

  // ======================================================================
  // #subscriptions  F2
  // ======================================================================
  const EVERY = { week:['Every week', 52 / 12], month:['Every month', 1], quarter:['Every 3 months', 1 / 3], year:['Every year', 1 / 12] };
  V.subscriptions = { title:'Subscriptions', sec:'owner', async open(el, ok){
    if (!isOwner()) { el.innerHTML = '<div class="p-wrap px"><p class="p-card p-empty">This page is only for Amr.</p></div>'; return; }
    const body = PX.page(el, 'Money', 'Subscriptions', 'Every tool you pay for regularly, when it renews, and what it costs a month. The bell reminds you before each renewal. “Log payment” adds the expense to Cash and moves the date on; it doesn’t pay anything.');
    const S = { edit:null, pay:null, prefill:null };
    let subs = [], rate = 50, found = [];
    async function load(){
      const [s, fx, ce] = await Promise.all([safe(db().from('cash_subscriptions').select('*').order('active', { ascending:false }).order('next_renewal')),
        safe(db().from('fx_rates').select('rate,from_date').order('from_date', { ascending:false }).limit(1)),
        safe(db().from('cash_entries').select('title,party,amount,currency,category,entry_date').eq('kind', 'expense').in('category', ['Subscriptions', 'Software']).gte('entry_date', addDays(today(), -120)).order('entry_date', { ascending:false }).limit(300))]);
      if (!ok()) return false;
      if (s.error) { body.innerHTML = failed(s.error); return false; }
      subs = s.data || []; if (fx.data && fx.data[0]) rate = +fx.data[0].rate || rate;
      const have = new Set(subs.map(x => x.name.trim().toLowerCase())), seen = new Set();
      found = (ce.data || []).filter(e => { const k = (e.title || '').trim().toLowerCase(); if (!k || have.has(k) || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
      return true;
    }
    const money = (n, cur) => cur === 'USD' ? '$' + (+n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) : Math.round(+n).toLocaleString('en-US') + ' EGP';
    const egp = s => s.currency === 'USD' ? +s.amount * rate : +s.amount;
    const daysTo = d => Math.round((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);
    function form(s){
      const v = s || S.prefill || { name:'', vendor:'', amount:'', currency:'EGP', every:'month', next_renewal:addDays(today(), 30), category:'Subscriptions', remind_days:3, url:'', note:'' };
      return '<form class="px-form r22-sform" data-id="' + (s ? s.id : '') + '" novalidate>' +
        f('Name', '<input type="text" name="name" maxlength="120" value="' + esc(v.name || '') + '" placeholder="e.g. Claude Pro">') +
        f('Company (optional)', '<input type="text" name="vendor" maxlength="120" value="' + esc(v.vendor || '') + '" placeholder="e.g. Anthropic">') +
        f('Amount', '<input type="number" name="amount" min="0" step="0.01" value="' + esc(v.amount) + '">') +
        f('Currency', '<select name="currency">' + opt('EGP', 'EGP', v.currency === 'EGP') + opt('USD', '$ USD', v.currency === 'USD') + '</select>') +
        f('Renews', '<select name="every">' + Object.entries(EVERY).map(([k, l]) => opt(k, l[0], v.every === k)).join('') + '</select>') +
        f('Next renewal', '<input type="date" name="next" value="' + esc(v.next_renewal || '') + '">') +
        f('Remind me', '<select name="remind">' + [0, 1, 2, 3, 5, 7, 14].map(n => opt(n, n ? plural(n, 'day') + ' before' : 'On the day', +v.remind_days === n)).join('') + '</select>') +
        f('Cash category', '<input type="text" name="category" maxlength="40" value="' + esc(v.category || 'Subscriptions') + '" list="r22SubCats"><datalist id="r22SubCats"><option value="Subscriptions"><option value="Software"><option value="Equipment"><option value="Other"></datalist>') +
        f('Where to manage or cancel it (optional)', '<input type="url" name="url" maxlength="500" value="' + esc(v.url || '') + '" placeholder="https://">', 'px-wide') +
        f('Note (optional)', '<input type="text" name="note" maxlength="300" value="' + esc(v.note || '') + '">', 'px-wide') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">' + (s ? 'Save' : 'Add subscription') + '</button>' + (s || S.edit === 'new' ? '<button type="button" class="p-btn is-ghost" data-r22sx>Cancel</button>' : '') + '<span class="p-hint r22-smsg" role="status"></span></div></form>';
    }
    function payForm(s){
      return '<form class="px-form r22-pform" data-id="' + s.id + '" novalidate><p class="p-hint px-wide">Adds an expense to Cash: ' + esc(s.name) + ', category ' + esc(s.category) + '. The next renewal moves to ' + esc(fmtDay(nextOf(s.next_renewal, s.every), { month:'short', day:'numeric', year:'numeric' })) + '.</p>' +
        f('Paid on', '<input type="date" name="d" value="' + esc(s.next_renewal <= today() ? s.next_renewal : today()) + '">') +
        f('Amount (' + (s.currency === 'USD' ? '$' : 'EGP') + ')', '<input type="number" name="a" min="0" step="0.01" value="' + esc(s.amount) + '">') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">Add to Cash</button><button type="button" class="p-btn is-ghost" data-r22sx>Cancel</button><span class="p-hint r22-smsg" role="status"></span></div></form>';
    }
    const nextOf = (d, every) => { const x = new Date(d + 'T12:00'); if (every === 'week') x.setDate(x.getDate() + 7); else x.setMonth(x.getMonth() + (every === 'year' ? 12 : every === 'quarter' ? 3 : 1)); return isoDay(x); };
    function draw(){
      const act = subs.filter(s => s.active);
      const monthly = act.reduce((t, s) => t + egp(s) * EVERY[s.every][1], 0);
      const soon = act.filter(s => daysTo(s.next_renewal) <= 7), passed = act.filter(s => daysTo(s.next_renewal) < 0);
      const usdM = act.filter(s => s.currency === 'USD').reduce((t, s) => t + +s.amount * EVERY[s.every][1], 0);
      body.innerHTML = tiles([tile(money(monthly, 'EGP'), 'a month', usdM ? 'includes ' + money(usdM, 'USD') + ' at ' + rate + ' EGP per $' : 'all active subscriptions'),
          tile(money(monthly * 12, 'EGP'), 'a year', 'at today’s prices'), tile(soon.length, 'renew in the next 7 days', passed.length ? plural(passed.length, 'date') + ' passed' : '', passed.length > 0), tile(act.length, 'active', subs.length - act.length ? (subs.length - act.length) + ' paused' : '')]) +
        card('Your subscriptions', plural(act.length, 'active one'), subs.length ? '<div class="r22-subs">' + subs.map(s => {
          if (S.edit === s.id) return form(s);
          const n = daysTo(s.next_renewal), url = /^https?:\/\//i.test(s.url || '') ? s.url : '';
          return '<div class="r20-rule r22-sub' + (s.active ? '' : ' is-off') + '"><div class="r20-rl"><b>' + esc(s.name) + '</b>' + (s.vendor ? ' <small class="r22-inl">' + esc(s.vendor) + '</small>' : '') + (s.active ? '' : ' ' + pill('Paused', 'plain')) +
            '<small>' + esc(money(s.amount, s.currency)) + ' · ' + esc(EVERY[s.every][0].toLowerCase()) + (s.currency === 'USD' ? ' · about ' + esc(money(egp(s), 'EGP')) : '') + ' · Cash category ' + esc(s.category) + (s.note ? ' · ' + esc(s.note) : '') + '</small>' +
            (s.active ? '<small>' + (n < 0 ? pill('Renewal date passed · ' + day(s.next_renewal), 'no') : n === 0 ? pill('Renews today', 'no') : n <= 7 ? pill('Renews ' + fmtDay(s.next_renewal, { weekday:'short', month:'short', day:'numeric' }) + ' · in ' + plural(n, 'day'), '') : 'Next renewal ' + esc(fmtDay(s.next_renewal, { month:'short', day:'numeric', year:'numeric' }))) +
              ' · bell ' + (s.remind_days ? plural(s.remind_days, 'day') + ' before' : 'on the day') + '</small>' : '') +
            (S.pay === s.id ? payForm(s) : '') + '</div>' +
            '<div class="r20-rc">' + (s.active && S.pay !== s.id ? '<button type="button" class="p-btn" data-r22spay="' + s.id + '">Log payment</button>' : '') +
              (s.last_entry_id ? '<button type="button" class="p-btn is-ghost" data-r22sundo="' + s.id + '">Undo last</button>' : '') +
              (url ? '<a class="p-btn is-ghost" href="' + esc(url) + '" target="_blank" rel="noopener">Manage</a>' : '') +
              '<button type="button" class="p-btn is-ghost" data-r22sedit="' + s.id + '">Edit</button><button type="button" class="p-btn is-ghost" data-r22sact="' + s.id + '">' + (s.active ? 'Pause' : 'Turn on') + '</button>' +
              '<button type="button" class="p-btn is-ghost" data-r22sdel="' + s.id + '">Delete</button></div></div>';
        }).join('') + '</div>' : empty('No subscriptions yet. Add the first one below, or pick one found in Cash.')) +
        card(S.edit === 'new' ? 'New subscription' : 'Add a subscription', '', S.edit === 'new' ? form(null) : '<div class="px-tools"><button type="button" class="p-btn" data-r22sedit="new">+ Add a subscription</button></div>') +
        (found.length ? card('Found in Cash', 'subscription and software expenses from the last 4 months', '<p class="p-hint">These aren’t on your list yet. Add one and check its amount and next renewal date.</p><div class="r22-found">' +
          found.map((e, i) => '<div class="r20-rule"><div class="r20-rl"><b>' + esc(e.title) + '</b><small>' + esc((e.party ? e.party + ' · ' : '') + money(e.amount, e.currency) + ' · last on ' + day(e.entry_date)) + '</small></div><div class="r20-rc"><button type="button" class="p-btn is-ghost" data-r22sfound="' + i + '">Add</button></div></div>').join('') + '</div>') : '');
    }
    if (!await load()) return;
    draw();
    const reload = async () => { if (await load()) draw(); };
    const msg = (fm, t) => { const m = fm.querySelector('.r22-smsg'); if (m) m.textContent = t; };
    body.addEventListener('click', async e => {
      const ed = e.target.closest('[data-r22sedit]'); if (ed) { S.edit = ed.dataset.r22sedit === 'new' ? 'new' : +ed.dataset.r22sedit; S.pay = null; if (S.edit !== 'new') S.prefill = null; draw(); const i = body.querySelector('.r22-sform input[name=name]'); if (i) i.focus(); return; }
      if (e.target.closest('[data-r22sx]')) { S.edit = null; S.pay = null; S.prefill = null; draw(); return; }
      const fd = e.target.closest('[data-r22sfound]');
      if (fd) { const x = found[+fd.dataset.r22sfound]; const last = x.entry_date; S.prefill = { name:x.title, vendor:x.party || '', amount:x.amount, currency:x.currency, every:'month', next_renewal:nextOf(last, 'month') < today() ? nextOf(today(), 'month') : nextOf(last, 'month'), category:x.category, remind_days:3 }; S.edit = 'new'; draw(); const i = body.querySelector('.r22-sform input[name=amount]'); if (i) i.focus(); return; }
      const py = e.target.closest('[data-r22spay]'); if (py) { S.pay = +py.dataset.r22spay; S.edit = null; draw(); const i = body.querySelector('.r22-pform input[name=d]'); if (i) i.focus(); return; }
      const un = e.target.closest('[data-r22sundo]');
      if (un) { if (!sure(un, 'Sure? Removes it from Cash', 'Undo last')) return; un.disabled = true; const x = await safe(db().rpc('subscription_undo', { p_id:+un.dataset.r22sundo })); if (x.error) { un.disabled = false; un.textContent = 'Couldn’t undo'; return; } reload(); return; }
      const ac = e.target.closest('[data-r22sact]'); if (ac) { const s = subs.find(x => x.id === +ac.dataset.r22sact); ac.disabled = true; await safe(db().from('cash_subscriptions').update({ active:!s.active }).eq('id', s.id)); reload(); return; }
      const dl = e.target.closest('[data-r22sdel]'); if (dl && window.PortalUI && PortalUI.del) { PortalUI.del(dl, { text:'Subscription deleted. Its Cash entries stay.', label:'Delete', rows:[dl.closest('.r20-rc').parentElement], run:() => safe(db().from('cash_subscriptions').delete().eq('id', +dl.dataset.r22sdel)), after:() => { reload(); } }); return; } if (dl) { if (!sure(dl, 'Sure? Cash entries stay', 'Delete')) return; dl.disabled = true; await safe(db().from('cash_subscriptions').delete().eq('id', +dl.dataset.r22sdel)); reload(); }
    });
    body.addEventListener('submit', async e => {
      const fm = e.target.closest('form'); if (!fm) return;
      e.preventDefault();
      const g = n => fm.elements[n] ? fm.elements[n].value.trim() : '';
      if (fm.classList.contains('r22-pform')) {
        const a = g('a'); if (a === '' || +a < 0) return msg(fm, 'Type the amount paid.');
        const b = fm.querySelector('button[type=submit]'); b.disabled = true; msg(fm, 'Adding…');
        const x = await safe(db().rpc('subscription_paid', { p_id:+fm.dataset.id, p_date:g('d') || null, p_amount:+a }));
        if (x.error) { b.disabled = false; return msg(fm, errText(x, 'Couldn’t add it. Try again.')); }
        S.pay = null; reload(); return;
      }
      if (!fm.classList.contains('r22-sform')) return;
      const url = g('url');
      const row = { name:g('name'), vendor:g('vendor') || null, amount:+g('amount'), currency:g('currency'), every:g('every'), next_renewal:g('next'), remind_days:+g('remind'), category:g('category') || 'Subscriptions', url:url || null, note:g('note') || null };
      if (!row.name) return msg(fm, 'Name it first.');
      if (g('amount') === '' || !(row.amount >= 0)) return msg(fm, 'Type the amount.');
      if (!row.next_renewal) return msg(fm, 'Pick the next renewal date.');
      if (url && !/^https?:\/\//i.test(url)) return msg(fm, 'The link starts with https://');
      const id = +fm.dataset.id;
      if (id) { const old = subs.find(s => s.id === id); if (old && old.next_renewal !== row.next_renewal) row.reminded_for = null; }
      const x = id ? await safe(db().from('cash_subscriptions').update(row).eq('id', id)) : await safe(db().from('cash_subscriptions').insert(row));
      if (x.error) return msg(fm, errText(x, 'Couldn’t save it. Try again.'));
      S.edit = null; S.prefill = null; reload();
    });
  } };
})();
