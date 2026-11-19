// Round 21 of the Portal Master Feature Plan (Nov 19 2026): the Me area (Amr only) and Devices and sessions (everyone).
//   #routine   M1  Daily habits (sleep, gym, study...) ticked off each day, last 14 days, streaks, weekly targets.
//   #goals     M2  Big goals broken into steps, with progress and due dates.
//   #jobhunt   M3  Upwork and LinkedIn: proposals, Connects spent, replies, interviews, wins, follow-ups due.
//                  Only a log: nothing here sends anything on Upwork or LinkedIn.
//   #study     M4  Weekly study blocks per subject against a weekly target, plus own course progress.
//   #worklog   M7  Jot tasks through the shift; morning, midday and end-of-day drafts in the Slack format.
//                  Drafts only: copy and post them yourself. Nothing is posted or sent from here.
//   Settings › Devices  P1  Every signed-in device on your own account; sign one out or all others.
//   window.R21Me.summary() feeds the "Me today" box on the command center (#admin).
// Database: me_habits, me_habit_log, me_goals, me_goal_steps, me_job_apps, me_study_blocks, me_study_targets,
// me_work_log, me_report_drafts (owner only); me_course_progress(), my_sessions(), sign_out_session().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, fmtTime, num, plural, card, empty, failed, pill, f, opt, table, tr, bar, widths, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const pad = n => String(n).padStart(2, '0');
  // Days in a given zone (Cairo for routine and study, New York for the work day)
  const dayIn = (tz, d) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone:tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(d || new Date()); return p; };
  const cairo = () => dayIn('Africa/Cairo');
  const nyDay = () => dayIn('America/New_York');
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoDay(d); };
  const wd = iso => new Date(iso + 'T12:00').getDay();
  const monday = iso => addDays(iso, -((wd(iso) + 6) % 7));
  const day = d => d ? fmtDay(d, { weekday:'short', month:'short', day:'numeric' }) : '–';
  const longDay = d => fmtDay(d, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  // "14:30" → "2:30 PM"
  const t12 = t => { if (!t) return ''; const [h, m] = String(t).split(':').map(Number); return ((h % 12) || 12) + ':' + pad(m || 0) + ' ' + (h < 12 ? 'AM' : 'PM'); };
  const mins = m => { m = Math.round(+m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : r + ' min'; };
  const tile = (v, k, s, hot) => '<div class="p-tile' + (hot ? ' r19-hot' : '') + '"><b>' + esc(v) + '</b><span>' + esc(k) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div>';
  const tiles = list => '<div class="p-tiles r20-tiles">' + list.join('') + '</div>';
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sure = (b, text, back) => { if (b.dataset.sure === '1') return true; b.dataset.sure = '1'; b.textContent = text; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = back; } }, 4000); return false; };
  // Round 23 (I5): deletes take the row off the screen with a 10-second Undo bar; the delete runs only after the bar ends
  const undoDel = (b, text, run, after) => {
    const row = b.closest('.r21-goal, li, tr, .r20-rule, .r21-blk, form') || b;
    if (!window.PortalUI) { b.disabled = true; return Promise.resolve(run()).then(after); }
    window.PortalUI.undo({ text, hide:() => { row.hidden = true; }, restore:() => { row.hidden = false; b.disabled = false; }, commit:run, done:after });
  };
  const ownerOnly = (el) => { if (isOwner()) return false; el.innerHTML = '<div class="p-wrap px"><p class="p-card p-empty">This page is only for Amr.</p></div>'; return true; };
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

  // ======================================================================
  // #routine  M1
  // ======================================================================
  V.routine = { title:'Routine', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Me', 'Routine', 'Sleep, gym and study, ticked off each day. Days follow Cairo time. A habit is due on the days you pick, or a number of times a week.');
    const S = { edit:null };
    let H = [], L = new Map();
    const key = (id, d) => id + '|' + d;
    async function load(){
      const since = addDays(cairo(), -70);
      const [h, l] = await Promise.all([safe(db().from('me_habits').select('*').order('active', { ascending:false }).order('sort').order('created_at')), safe(db().from('me_habit_log').select('habit_id,day,done').gte('day', since))]);
      if (!ok()) return;
      if (h.error) { body.innerHTML = failed(h.error); return; }
      H = h.data || []; L = new Map(); (l.data || []).forEach(x => { if (x.done) L.set(key(x.habit_id, x.day), true); });
      draw();
    }
    const due = (h, d) => h.per_week ? true : (h.days || []).includes(wd(d));
    const weekDone = (h, d) => { const m = monday(d); let n = 0; for (let i = 0; i < 7; i++) { const x = addDays(m, i); if (x > cairo()) break; if (L.get(key(h.id, x))) n++; } return n; };
    function streak(h){
      const today = cairo();
      if (h.per_week) {   // weeks in a row that met the target (this week counts once it is met)
        let n = 0, m = monday(today);
        if (weekDone(h, m) >= h.per_week) n++;
        for (m = addDays(m, -7); n < 52; m = addDays(m, -7)) { if (weekDone(h, m) >= h.per_week) n++; else break; }
        return n ? plural(n, 'week') + ' in a row' : '';
      }
      let n = 0, d = today;
      if (!L.get(key(h.id, d))) d = addDays(d, -1);   // today not ticked yet doesn't break it
      for (let i = 0; i < 70; i++, d = addDays(d, -1)) { if (!due(h, d)) continue; if (L.get(key(h.id, d))) n++; else break; }
      return n ? plural(n, 'day') + ' in a row' : '';
    }
    function draw(){
      const today = cairo(), act = H.filter(h => h.active), todayList = act.filter(h => due(h, today));
      const doneToday = todayList.filter(h => L.get(key(h.id, today))).length;
      const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
      // Last 7 days: due ticks done / due
      let dueN = 0, doneN = 0;
      act.filter(h => !h.per_week).forEach(h => days.slice(7).forEach(d => { if (due(h, d)) { dueN++; if (L.get(key(h.id, d))) doneN++; } }));
      body.innerHTML =
        tiles([tile(doneToday + ' of ' + todayList.length, 'done today', longDay(today), todayList.length && doneToday < todayList.length),
          tile(dueN ? Math.round(doneN / dueN * 100) + '%' : '–', 'daily habits kept', 'last 7 days'),
          ...act.filter(h => h.per_week).map(h => tile(weekDone(h, today) + ' of ' + h.per_week, h.name + ' this week', 'Week starts Monday'))]) +
        card('Today', esc(fmtDay(today, { weekday:'long', month:'short', day:'numeric' })),
          todayList.length ? '<div class="r21-checks">' + todayList.map(h => { const on = !!L.get(key(h.id, today)); return '<button type="button" class="r21-check' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-r21tick="' + h.id + '" data-day="' + today + '"><span class="r21-box">' + (on ? '✓' : '') + '</span><span><b>' + esc(h.name) + '</b>' + (h.note ? '<small>' + esc(h.note) + '</small>' : '') + '<small class="r21-streak">' + esc(streak(h)) + '</small></span></button>'; }).join('') + '</div>' : empty('Nothing due today. Add a habit below.')) +
        card('Last 14 days', 'tap a day to tick or untick it',
          act.length ? '<div class="p-tablewrap"><table class="p-table r21-grid"><thead><tr><th scope="col">Habit</th>' + days.map(d => '<th scope="col"' + (d === today ? ' class="r21-today"' : '') + '>' + esc(DOW[wd(d)]) + '<small>' + esc(+d.slice(8)) + '</small></th>').join('') + '</tr></thead><tbody>' +
            act.map(h => '<tr><th scope="row">' + esc(h.name) + (h.per_week ? '<small>' + h.per_week + ' a week</small>' : '') + '</th>' + days.map(d => { const on = !!L.get(key(h.id, d)), isDue = due(h, d); return '<td><button type="button" class="r21-cell' + (on ? ' on' : isDue && d < today && !h.per_week ? ' miss' : !isDue ? ' off' : '') + '" aria-pressed="' + on + '" aria-label="' + esc(h.name + ', ' + day(d) + (on ? ', done' : isDue ? ', not done' : ', not due')) + '" data-r21tick="' + h.id + '" data-day="' + d + '">' + (on ? '✓' : isDue && !h.per_week ? '' : '·') + '</button></td>'; }).join('') + '</tr>').join('') +
            '</tbody></table></div><p class="p-hint">✓ done · empty box = due and not done · dot = not due that day.</p>' : empty('No habits yet.')) +
        card('Habits', plural(act.length, 'active habit'),
          (H.length ? H.map(h => S.edit === h.id ? habitForm(h) : '<div class="r20-rule"><div class="r20-rl"><b>' + esc(h.name) + '</b>' + (h.active ? '' : ' ' + pill('Paused', 'plain')) + '<small>' + esc(h.per_week ? h.per_week + ' times a week, any day' : (h.days || []).length === 7 ? 'Every day' : (h.days || []).slice().sort().map(d => DOW[d]).join(', ')) + (h.note ? ' · ' + esc(h.note) : '') + '</small></div><div class="r20-rc"><button type="button" class="p-btn is-ghost" data-r21hedit="' + h.id + '">Edit</button><button type="button" class="p-btn is-ghost" data-r21hact="' + h.id + '">' + (h.active ? 'Pause' : 'Turn on') + '</button><button type="button" class="p-btn is-ghost" data-r21hdel="' + h.id + '">Delete</button></div></div>').join('') : '') +
          (S.edit === 'new' ? habitForm(null) : '<div class="px-tools"><button type="button" class="p-btn" data-r21hedit="new">+ Add a habit</button></div>'));
    }
    function habitForm(h){
      const days = h ? h.days || [] : [0, 1, 2, 3, 4, 5, 6], mode = h && h.per_week ? 'week' : 'days';
      return '<form class="px-form r20-row r21-hform" id="r21HForm" data-id="' + (h ? h.id : '') + '" novalidate>' +
        f('Habit', '<input type="text" id="r21HName" maxlength="80" value="' + esc(h ? h.name : '') + '" placeholder="e.g. Gym">') +
        f('How often', '<select id="r21HMode">' + opt('days', 'On these days', mode === 'days') + opt('week', 'Times a week', mode === 'week') + '</select>') +
        f('Times a week', '<input type="number" id="r21HWeek" min="1" max="7" value="' + (h && h.per_week ? h.per_week : 3) + '">', 'r21-wk' + (mode === 'week' ? '' : ' r21-hide')) +
        '<fieldset class="r21-days px-wide' + (mode === 'days' ? '' : ' r21-hide') + '"><legend>Days</legend>' + DOW.map((n, i) => '<label><input type="checkbox" value="' + i + '"' + (days.includes(i) ? ' checked' : '') + '> ' + n + '</label>').join('') + '</fieldset>' +
        f('Note (optional)', '<input type="text" id="r21HNote" maxlength="300" value="' + esc(h && h.note ? h.note : '') + '" placeholder="e.g. Asleep by 2:30 AM on weekdays">', 'px-wide') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save habit</button><button type="button" class="p-btn is-ghost" data-r21hx>Cancel</button><span class="p-hint" id="r21HMsg" role="status"></span></div></form>';
    }
    await load();
    body.addEventListener('change', e => { if (e.target.id === 'r21HMode') { const w = e.target.value === 'week'; body.querySelector('.r21-wk').classList.toggle('r21-hide', !w); body.querySelector('.r21-days').classList.toggle('r21-hide', w); } });
    body.addEventListener('click', async e => {
      const t = e.target.closest('[data-r21tick]');
      if (t) {
        const id = t.dataset.r21tick, d = t.dataset.day, on = !!L.get(key(id, d));
        if (d > cairo()) return;
        if (on) L.delete(key(id, d)); else L.set(key(id, d), true);
        draw();
        const x = on ? await safe(db().from('me_habit_log').delete().eq('habit_id', id).eq('day', d)) : await safe(db().from('me_habit_log').upsert({ habit_id:id, day:d, done:true }, { onConflict:'habit_id,day' }));
        if (x.error) { if (on) L.set(key(id, d), true); else L.delete(key(id, d)); draw(); }
        return;
      }
      const ed = e.target.closest('[data-r21hedit]'); if (ed) { S.edit = ed.dataset.r21hedit; draw(); const n = $('r21HName'); if (n) n.focus(); return; }
      if (e.target.closest('[data-r21hx]')) { S.edit = null; draw(); return; }
      const ac = e.target.closest('[data-r21hact]');
      if (ac) { const h = H.find(x => x.id === ac.dataset.r21hact); ac.disabled = true; await safe(db().from('me_habits').update({ active:!h.active }).eq('id', h.id)); load(); return; }
      const dl = e.target.closest('[data-r21hdel]');
      if (dl) { const id = dl.dataset.r21hdel; undoDel(dl, 'Habit deleted, with its ticks.', () => safe(db().from('me_habits').delete().eq('id', id)), load); }
    });
    body.addEventListener('submit', async e => {
      if (e.target.id !== 'r21HForm') return;
      e.preventDefault();
      const week = $('r21HMode').value === 'week';
      const row = { name:$('r21HName').value.trim(), note:$('r21HNote').value.trim() || null, per_week:week ? Math.min(7, Math.max(1, +$('r21HWeek').value || 1)) : null,
        days:week ? [0, 1, 2, 3, 4, 5, 6] : [...e.target.querySelectorAll('.r21-days input:checked')].map(i => +i.value) };
      if (!row.name) return say('r21HMsg', 'Name the habit.');
      if (!week && !row.days.length) return say('r21HMsg', 'Pick at least one day.');
      const id = e.target.dataset.id;
      if (!id) row.sort = H.length;
      const x = id ? await safe(db().from('me_habits').update(row).eq('id', id)) : await safe(db().from('me_habits').insert(row));
      if (x.error) return say('r21HMsg', errText(x, 'Couldn’t save it. Try again.'));
      S.edit = null; load();
    });
  } };

  // ======================================================================
  // #goals  M2
  // ======================================================================
  const AREAS = ['Career', 'Money', 'Learning', 'Health', 'Family', 'Faith', 'Business', 'Other'];
  V.goals = { title:'Goals', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Me', 'Goals', 'Big goals broken into small steps. Progress is the share of steps done.');
    const S = { show:'active', adding:false, open:new Set() };
    let G = [], St = [];
    async function load(){
      const [g, s] = await Promise.all([safe(db().from('me_goals').select('*').order('sort').order('created_at')), safe(db().from('me_goal_steps').select('*').order('sort').order('created_at'))]);
      if (!ok()) return;
      if (g.error) { body.innerHTML = failed(g.error); return; }
      G = g.data || []; St = s.data || [];
      draw();
    }
    function draw(){
      const today = cairo(), wk = monday(today);
      const list = G.filter(g => S.show === 'active' ? g.status === 'active' : S.show === 'done' ? g.status === 'done' : g.status === 'paused' || g.status === 'dropped');
      const openSteps = St.filter(s => !s.done && (G.find(g => g.id === s.goal_id) || {}).status === 'active');
      const next = openSteps.filter(s => s.due).sort((a, b) => a.due < b.due ? -1 : 1)[0];
      const late = openSteps.filter(s => s.due && s.due < today).length;
      body.innerHTML =
        tiles([tile(String(G.filter(g => g.status === 'active').length), 'active goals', ''),
          tile(String(St.filter(s => s.done && s.done_at && isoDay(new Date(s.done_at)) >= wk).length), 'steps done this week', 'Week starts Monday'),
          tile(next ? day(next.due) : '–', 'next step due', next ? next.title : 'No dates set', next && next.due <= today),
          tile(String(late), 'steps past their date', '', late > 0)]) +
        '<div class="px-tools r21-tabs" role="group" aria-label="Show">' + [['active', 'Active'], ['done', 'Done'], ['other', 'Paused or dropped']].map(([k, l]) => '<button type="button" class="p-btn' + (S.show === k ? '' : ' is-ghost') + '" aria-pressed="' + (S.show === k) + '" data-r21show="' + k + '">' + l + '</button>').join('') +
          '<button type="button" class="p-btn" data-r21gnew>+ New goal</button></div>' +
        (S.adding ? card('New goal', '', goalForm(null)) : '') +
        (list.length ? list.map(goalCard).join('') : '<p class="p-card p-empty">' + (S.show === 'active' ? 'No active goals yet. Add one, then break it into steps you can finish in a day or two.' : 'Nothing here.') + '</p>');
      widths(body);
    }
    function goalCard(g){
      const steps = St.filter(s => s.goal_id === g.id), done = steps.filter(s => s.done).length, today = cairo();
      const p = steps.length ? Math.round(done / steps.length * 100) : (g.status === 'done' ? 100 : 0);
      const editing = S.open.has('e' + g.id);
      return '<section class="p-card r21-goal"><div class="p-card-head"><h2>' + esc(g.title) + '</h2><span>' + pill(g.area, 'plain') + (g.due ? ' ' + (g.due < today && g.status === 'active' ? pill('Due ' + day(g.due), '') : esc('Due ' + day(g.due))) : '') + (g.status !== 'active' ? ' ' + pill(g.status === 'done' ? 'Done' : g.status === 'paused' ? 'Paused' : 'Dropped', g.status === 'done' ? 'ok' : 'plain') : '') + '</span></div>' +
        (g.why ? '<p class="r21-why">' + esc(g.why) + '</p>' : '') +
        '<div class="r20-prog"><span><b>' + p + '%</b> <small>' + done + ' of ' + plural(steps.length, 'step') + ' done</small></span>' + bar(p, 100) + '</div>' +
        (editing ? goalForm(g) : '') +
        '<ul class="r21-steps">' + steps.map(s => '<li class="' + (s.done ? 'is-done' : '') + '"><label><input type="checkbox" data-r21step="' + s.id + '"' + (s.done ? ' checked' : '') + '> <span>' + esc(s.title) + '</span></label>' +
          (s.due ? '<small class="' + (!s.done && s.due < today ? 'r21-late' : '') + '">' + esc(day(s.due)) + '</small>' : '') + '<button type="button" class="r21-x" data-r21sdel="' + s.id + '" aria-label="Remove step ' + esc(s.title) + '">×</button></li>').join('') + '</ul>' +
        (g.status === 'active' ? '<form class="r21-addstep" data-goal="' + g.id + '" novalidate><input type="text" maxlength="200" placeholder="Add a step" aria-label="New step for ' + esc(g.title) + '"><input type="date" aria-label="Step date (optional)"><button type="submit" class="p-btn is-ghost">Add</button></form>' : '') +
        '<div class="px-tools r21-gacts">' +
          (g.status === 'active' ? '<button type="button" class="p-btn is-ghost" data-r21gst="done" data-id="' + g.id + '">Mark goal done</button><button type="button" class="p-btn is-ghost" data-r21gst="paused" data-id="' + g.id + '">Pause</button><button type="button" class="p-btn is-ghost" data-r21gst="dropped" data-id="' + g.id + '">Drop</button>'
            : '<button type="button" class="p-btn is-ghost" data-r21gst="active" data-id="' + g.id + '">Make active again</button>') +
          '<button type="button" class="p-btn is-ghost" data-r21gedit="' + g.id + '">' + (editing ? 'Close edit' : 'Edit') + '</button><button type="button" class="p-btn is-ghost" data-r21gdel="' + g.id + '">Delete</button></div></section>';
    }
    function goalForm(g){
      return '<form class="px-form r20-row" data-r21gform="' + (g ? g.id : '') + '" novalidate>' +
        f('Goal', '<input type="text" name="title" maxlength="160" value="' + esc(g ? g.title : '') + '" placeholder="e.g. Land a remote acquisitions role">', 'px-wide') +
        f('Area', '<select name="area">' + AREAS.map(a => opt(a, a, g ? g.area === a : a === 'Career')).join('') + '</select>') +
        f('By (optional)', '<input type="date" name="due" value="' + esc(g && g.due ? g.due : '') + '">') +
        f('Why it matters (optional)', '<textarea name="why" rows="2" maxlength="600">' + esc(g && g.why ? g.why : '') + '</textarea>', 'px-wide') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">' + (g ? 'Save goal' : 'Add goal') + '</button>' + (g ? '' : '<button type="button" class="p-btn is-ghost" data-r21gx>Cancel</button>') + '<span class="p-hint" role="status"></span></div></form>';
    }
    await load();
    body.addEventListener('change', async e => {
      const c = e.target.closest('[data-r21step]'); if (!c) return;
      const s = St.find(x => x.id === c.dataset.r21step); s.done = c.checked; s.done_at = c.checked ? new Date().toISOString() : null; draw();
      const x = await safe(db().from('me_goal_steps').update({ done:s.done, done_at:s.done_at }).eq('id', s.id));
      if (x.error) load();
    });
    body.addEventListener('click', async e => {
      const sh = e.target.closest('[data-r21show]'); if (sh) { S.show = sh.dataset.r21show; draw(); return; }
      if (e.target.closest('[data-r21gnew]')) { S.adding = true; draw(); const i = body.querySelector('[data-r21gform=""] [name=title]'); if (i) i.focus(); return; }
      if (e.target.closest('[data-r21gx]')) { S.adding = false; draw(); return; }
      const ge = e.target.closest('[data-r21gedit]'); if (ge) { const k = 'e' + ge.dataset.r21gedit; S.open.has(k) ? S.open.delete(k) : S.open.add(k); draw(); return; }
      const gs = e.target.closest('[data-r21gst]');
      if (gs) { gs.disabled = true; const st = gs.dataset.r21gst; await safe(db().from('me_goals').update({ status:st, done_at:st === 'done' ? new Date().toISOString() : null }).eq('id', gs.dataset.id)); load(); return; }
      const gd = e.target.closest('[data-r21gdel]'); if (gd) { const id = gd.dataset.r21gdel; undoDel(gd, 'Goal deleted, with its steps.', () => safe(db().from('me_goals').delete().eq('id', id)), load); return; }
      const sd = e.target.closest('[data-r21sdel]'); if (sd) { const id = sd.dataset.r21sdel; undoDel(sd, 'Step deleted.', () => safe(db().from('me_goal_steps').delete().eq('id', id)), load); }
    });
    body.addEventListener('submit', async e => {
      e.preventDefault();
      const fm = e.target;
      if (fm.classList.contains('r21-addstep')) {
        const [t, d] = fm.querySelectorAll('input'); const title = t.value.trim(); if (!title) { t.focus(); return; }
        const n = St.filter(s => s.goal_id === fm.dataset.goal).length;
        const x = await safe(db().from('me_goal_steps').insert({ goal_id:fm.dataset.goal, title, due:d.value || null, sort:n }));
        if (!x.error) { await load(); const again = body.querySelector('.r21-addstep[data-goal="' + fm.dataset.goal + '"] input'); if (again) again.focus(); }
        return;
      }
      if (fm.hasAttribute('data-r21gform')) {
        const id = fm.dataset.r21gform, msg = fm.querySelector('[role=status]');
        const row = { title:fm.elements.namedItem('title').value.trim(), area:fm.area.value, due:fm.due.value || null, why:fm.why.value.trim() || null };
        if (!row.title) { msg.textContent = 'Write the goal first.'; return; }
        if (!id) row.sort = G.length;
        const x = id ? await safe(db().from('me_goals').update(row).eq('id', id)) : await safe(db().from('me_goals').insert(row));
        if (x.error) { msg.textContent = errText(x, 'Couldn’t save it. Try again.'); return; }
        S.adding = false; S.open.delete('e' + id); S.show = 'active'; load();
      }
    });
  } };

  // ======================================================================
  // #jobhunt  M3
  // ======================================================================
  const JST = { sent:'Sent', viewed:'Viewed', replied:'Replied', interview:'Interview', offer:'Offer', hired:'Hired', lost:'Not chosen', no_reply:'No reply', withdrawn:'Withdrawn' };
  const JKIND = { proposal:'Proposal', application:'Application', message:'Message', connection:'Connection request', invite:'Invite from client' };
  const REPLIED = ['replied', 'interview', 'offer', 'hired'], CLOSED = ['hired', 'lost', 'no_reply', 'withdrawn'];
  V.jobhunt = { title:'Upwork and LinkedIn', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Me', 'Upwork and LinkedIn', 'Every proposal, application and outreach message, the Connects it cost, and what came back. This is only a log: nothing here sends anything on Upwork or LinkedIn.');
    const S = { range:'30', plat:'', st:'', edit:null, adding:false };
    let A = [];
    async function load(){
      const x = await safe(db().from('me_job_apps').select('*').order('sent_on', { ascending:false }).order('created_at', { ascending:false }).limit(2000));
      if (!ok()) return;
      if (x.error) { body.innerHTML = failed(x.error); return; }
      A = x.data || []; draw();
    }
    function inRange(a){
      const t = cairo();
      if (S.range === 'all') return true;
      if (S.range === 'week') return a.sent_on >= monday(t);
      if (S.range === 'month') return a.sent_on >= t.slice(0, 8) + '01';
      return a.sent_on >= addDays(t, -(+S.range) + 1);
    }
    function stats(list){
      const sent = list.length, con = list.reduce((s, a) => s + (+a.connects || 0), 0), rep = list.filter(a => REPLIED.includes(a.status)).length;
      const intv = list.filter(a => ['interview', 'offer', 'hired'].includes(a.status)).length, won = list.filter(a => a.status === 'hired').length;
      return { sent, con, rep, intv, won, rate:sent ? Math.round(rep / sent * 100) + '%' : '–', perWin:won ? Math.round(con / won) : null };
    }
    function draw(){
      const today = cairo(), inR = A.filter(inRange), all = stats(inR);
      const follow = A.filter(a => a.next_on && a.next_on <= today && !CLOSED.includes(a.status));
      const shown = inR.filter(a => (!S.plat || a.platform === S.plat) && (!S.st || (S.st === 'open' ? !CLOSED.includes(a.status) : a.status === S.st)));
      const byPlat = ['Upwork', 'LinkedIn', 'Other'].map(p => [p, stats(inR.filter(a => a.platform === p))]).filter(x => x[1].sent);
      body.innerHTML =
        '<div class="px-form r20-row">' + f('Dates', '<select id="r21JRange">' + [['week', 'This week'], ['month', 'This month'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'All time']].map(([v, l]) => opt(v, l, S.range === v)).join('') + '</select>') +
          '<div class="px-tools"><button type="button" class="p-btn" data-r21jnew>+ Log a proposal or message</button></div></div>' +
        tiles([tile(num(all.sent), 'sent', ''), tile(num(all.con), 'Connects spent', all.sent ? (Math.round(all.con / all.sent * 10) / 10) + ' per proposal' : ''),
          tile(num(all.rep), 'replies', all.rate + ' reply rate'), tile(num(all.intv), 'interviews', ''), tile(num(all.won), 'wins', all.perWin != null ? all.perWin + ' Connects per win' : '', false)]) +
        (S.adding ? card('Log one', '', jobForm(null)) : '') +
        (follow.length ? card('Follow up today', plural(follow.length, 'one'), table(['Follow up', 'Platform', 'What', 'Client', 'Status', ''], follow.map(a => tr([esc(day(a.next_on)), esc(a.platform), titleCell(a), esc(a.client || ''), pill(JST[a.status], 'plain'), '<button type="button" class="p-btn is-ghost" data-r21jedit="' + a.id + '">Update</button>'])))) : '') +
        (byPlat.length > 1 ? card('By platform', '', table(['Platform', 'Sent', 'Connects', 'Replies', 'Reply rate', 'Interviews', 'Wins'], byPlat.map(([p, s]) => tr([esc(p), num(s.sent), num(s.con), num(s.rep), esc(s.rate), num(s.intv), num(s.won)])))) : '') +
        card('Log', plural(shown.length, 'entry', 'entries'),
          '<div class="px-form r20-row">' + f('Platform', '<select id="r21JPlat">' + opt('', 'All', !S.plat) + ['Upwork', 'LinkedIn', 'Other'].map(p => opt(p, p, S.plat === p)).join('') + '</select>') +
            f('Status', '<select id="r21JSt">' + opt('', 'All', !S.st) + opt('open', 'Still open', S.st === 'open') + Object.keys(JST).map(k => opt(k, JST[k], S.st === k)).join('') + '</select>') + '</div>' +
          (shown.length ? '<div class="p-tablewrap"><table class="p-table px-table"><thead><tr>' + ['Sent', 'Platform', 'What', 'Client', 'Connects', 'Status', 'Follow up', ''].map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
            shown.map(a => S.edit === a.id ? '<tr class="r19-detail"><td colspan="8">' + jobForm(a) + '</td></tr>' : '<tr><td>' + esc(day(a.sent_on)) + '</td><td>' + esc(a.platform) + '<small class="r19-sub">' + esc(JKIND[a.kind] || a.kind) + '</small></td><td>' + titleCell(a) + '</td><td>' + esc(a.client || '') + '</td><td>' + (a.connects != null ? num(a.connects) : '–') + '</td><td><select class="r21-inline" data-r21jst="' + a.id + '" aria-label="Status">' + Object.keys(JST).map(k => opt(k, JST[k], a.status === k)).join('') + '</select></td><td>' + (a.next_on ? esc(day(a.next_on)) : '–') + '</td><td><span class="r17-acts"><button type="button" class="p-btn is-ghost" data-r21jedit="' + a.id + '">Edit</button><button type="button" class="p-btn is-ghost" data-r21jdel="' + a.id + '">Delete</button></span></td></tr>').join('') +
            '</tbody></table></div>' : empty(A.length ? 'Nothing matches.' : 'Nothing logged yet. Log each proposal when you send it, with the Connects it cost.')));
    }
    const titleCell = a => { const u = safeUrl(a.link); return (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(a.title) + '</a>' : esc(a.title)) + (a.rate ? '<small class="r19-sub">' + esc(a.rate) + '</small>' : '') + (a.notes ? '<small class="r19-sub">' + esc(a.notes.split('\n')[0].slice(0, 120)) + '</small>' : ''); };
    function jobForm(a){
      const v = (k, d) => esc(a && a[k] != null ? a[k] : (d || ''));
      return '<form class="px-form r20-row" data-r21jform="' + (a ? a.id : '') + '" novalidate>' +
        f('Platform', '<select name="platform">' + ['Upwork', 'LinkedIn', 'Other'].map(p => opt(p, p, a ? a.platform === p : p === 'Upwork')).join('') + '</select>') +
        f('Type', '<select name="kind">' + Object.keys(JKIND).map(k => opt(k, JKIND[k], a ? a.kind === k : k === 'proposal')).join('') + '</select>') +
        f('Sent on', '<input type="date" name="sent_on" value="' + v('sent_on', cairo()) + '">') +
        f('Job or person', '<input type="text" name="title" maxlength="200" value="' + v('title') + '" placeholder="e.g. Acquisitions Manager, part time">', 'px-wide') +
        f('Client or company (optional)', '<input type="text" name="client" maxlength="120" value="' + v('client') + '">') +
        f('Link (optional)', '<input type="url" name="link" maxlength="500" value="' + v('link') + '" placeholder="https://">') +
        f('Connects spent', '<input type="number" name="connects" min="0" max="500" value="' + v('connects') + '" placeholder="e.g. 16">') +
        f('Rate asked (optional)', '<input type="text" name="rate" maxlength="40" value="' + v('rate') + '" placeholder="e.g. $12/h">') +
        f('Status', '<select name="status">' + Object.keys(JST).map(k => opt(k, JST[k], a ? a.status === k : k === 'sent')).join('') + '</select>') +
        f('Follow up on (optional)', '<input type="date" name="next_on" value="' + v('next_on') + '">') +
        f('Notes (optional)', '<textarea name="notes" rows="2" maxlength="2000">' + v('notes') + '</textarea>', 'px-wide') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">' + (a ? 'Save' : 'Log it') + '</button><button type="button" class="p-btn is-ghost" data-r21jx>Cancel</button><span class="p-hint" role="status"></span></div></form>';
    }
    await load();
    body.addEventListener('change', async e => {
      if (e.target.id === 'r21JRange') { S.range = e.target.value; draw(); return; }
      if (e.target.id === 'r21JPlat') { S.plat = e.target.value; draw(); return; }
      if (e.target.id === 'r21JSt') { S.st = e.target.value; draw(); return; }
      const s = e.target.closest('[data-r21jst]');
      if (s) { const a = A.find(x => x.id === s.dataset.r21jst); a.status = s.value; const x = await safe(db().from('me_job_apps').update({ status:s.value, updated_at:new Date().toISOString() }).eq('id', a.id)); if (x.error) load(); else draw(); }
    });
    body.addEventListener('click', async e => {
      if (e.target.closest('[data-r21jnew]')) { S.adding = true; S.edit = null; draw(); const i = body.querySelector('[data-r21jform=""] [name=title]'); if (i) i.focus(); return; }
      if (e.target.closest('[data-r21jx]')) { S.adding = false; S.edit = null; draw(); return; }
      const ed = e.target.closest('[data-r21jedit]'); if (ed) { S.edit = ed.dataset.r21jedit; S.adding = false; if (S.st && S.st !== 'open') S.st = ''; draw(); const fm = body.querySelector('[data-r21jform="' + S.edit + '"]'); if (fm) fm.scrollIntoView({ block:'center' }); return; }
      const dl = e.target.closest('[data-r21jdel]'); if (dl) { const id = dl.dataset.r21jdel; undoDel(dl, 'Entry deleted.', () => safe(db().from('me_job_apps').delete().eq('id', id)), load); }
    });
    body.addEventListener('submit', async e => {
      const fm = e.target; if (!fm.hasAttribute('data-r21jform')) return;
      e.preventDefault();
      const id = fm.dataset.r21jform, msg = fm.querySelector('[role=status]');
      const row = { platform:fm.platform.value, kind:fm.kind.value, sent_on:fm.sent_on.value || cairo(), title:fm.elements.namedItem('title').value.trim(), client:fm.client.value.trim() || null,
        link:fm.link.value.trim() || null, connects:fm.connects.value === '' ? null : Math.max(0, Math.round(+fm.connects.value)), rate:fm.rate.value.trim() || null,
        status:fm.status.value, next_on:fm.next_on.value || null, notes:fm.notes.value.trim() || null, updated_at:new Date().toISOString() };
      if (!row.title) { msg.textContent = 'Write the job or the person first.'; return; }
      if (row.link && !safeUrl(row.link)) { msg.textContent = 'The link should start with https://'; return; }
      const x = id ? await safe(db().from('me_job_apps').update(row).eq('id', id)) : await safe(db().from('me_job_apps').insert(row));
      if (x.error) { msg.textContent = errText(x, 'Couldn’t save it. Try again.'); return; }
      S.adding = false; S.edit = null; load();
    });
  } };

  // ======================================================================
  // #study  M4
  // ======================================================================
  V.study = { title:'Study planner', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Me', 'Study planner', 'Plan your study blocks for the week, tick them when done, and see how close you are to each weekly target. Days and times follow Cairo time.');
    const S = { wk:monday(cairo()), adding:false, targets:false };
    let B = [], Tg = [], CP = null;
    async function load(){
      const [b, t, c] = await Promise.all([safe(db().from('me_study_blocks').select('*').gte('day', S.wk).lte('day', addDays(S.wk, 6)).order('day').order('starts', { nullsFirst:false })),
        safe(db().from('me_study_targets').select('*').order('sort')), CP ? Promise.resolve({ data:CP }) : safe(db().rpc('me_course_progress'))]);
      if (!ok()) return;
      if (b.error) { body.innerHTML = failed(b.error); return; }
      B = b.data || []; Tg = t.data || []; CP = c.data || null; draw();
    }
    const subjects = () => [...new Set(Tg.map(t => t.subject).concat(B.map(b => b.subject)))];
    function draw(){
      const today = cairo(), subs = subjects();
      const planned = s => B.filter(b => b.subject === s).reduce((a, b) => a + b.minutes, 0);
      const doneM = s => B.filter(b => b.subject === s && b.done).reduce((a, b) => a + (b.done_minutes != null ? b.done_minutes : b.minutes), 0);
      const totalDone = B.filter(b => b.done).reduce((a, b) => a + (b.done_minutes != null ? b.done_minutes : b.minutes), 0);
      const todayB = B.filter(b => b.day === today);
      const cp = CP || {};
      body.innerHTML =
        '<div class="px-tools r21-week"><button type="button" class="p-btn is-ghost" data-r21wk="-7" aria-label="Previous week">‹</button><b>' + esc(fmtDay(S.wk, { month:'short', day:'numeric' }) + ' – ' + fmtDay(addDays(S.wk, 6), { month:'short', day:'numeric', year:'numeric' })) + '</b><button type="button" class="p-btn is-ghost" data-r21wk="7" aria-label="Next week">›</button>' +
          (S.wk !== monday(today) ? '<button type="button" class="p-btn is-ghost" data-r21wk="0">This week</button>' : '') +
          '<button type="button" class="p-btn" data-r21bnew>+ Add study blocks</button><button type="button" class="p-btn is-ghost" data-r21copy>Copy last week’s plan</button><span class="p-hint" id="r21CopyMsg" role="status"></span></div>' +
        tiles([tile(mins(totalDone), 'studied this week', mins(B.reduce((a, b) => a + b.minutes, 0)) + ' planned'),
          tile(todayB.filter(b => b.done).length + ' of ' + todayB.length, 'blocks today', todayB.filter(b => !b.done)[0] ? 'Next: ' + (todayB.filter(b => !b.done)[0].starts ? t12(todayB.filter(b => !b.done)[0].starts) + ' ' : '') + todayB.filter(b => !b.done)[0].subject : ''),
          tile(cp.acq_total ? num(cp.acq_done) + ' of ' + num(cp.acq_total) : '–', 'Acquisitions items done', cp.acq_last ? 'last ' + day(cp.acq_last) : 'Not started in the course app'),
          tile(cp.psy_done != null ? num(cp.psy_done) : '–', 'Psychology parts done', cp.psy_last ? 'last opened ' + day(cp.psy_last) : '')]) +
        (S.adding ? card('Add study blocks', '', blockForm()) : '') +
        card('Weekly targets', '<button type="button" class="r21-link" data-r21tg>' + (S.targets ? 'Done editing' : 'Edit targets') + '</button>',
          (subs.length ? subs.map(s => { const tg = (Tg.find(t => t.subject === s) || {}).weekly_minutes || 0, d = doneM(s), p = planned(s); return '<div class="r20-prog"><span><b>' + esc(s) + '</b> <small>' + mins(d) + ' done · ' + mins(p) + ' planned' + (tg ? ' · target ' + mins(tg) : '') + (tg && p < tg ? ' · plan ' + mins(tg - p) + ' more' : '') + '</small></span>' + bar(d, Math.max(tg, p, 1)) + '</div>'; }).join('') : empty('No subjects yet.')) +
          (S.targets ? targetForm() : '')) +
        '<div class="r21-days7">' + [0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(S.wk, i), list = B.filter(b => b.day === d); return '<section class="p-card r21-dcol' + (d === today ? ' r21-on' : '') + '"><h3>' + esc(fmtDay(d, { weekday:'short', month:'short', day:'numeric' })) + '</h3>' +
          (list.length ? list.map(b => '<div class="r21-blk' + (b.done ? ' is-done' : '') + '"><label><input type="checkbox" data-r21bdone="' + b.id + '"' + (b.done ? ' checked' : '') + '> <b>' + esc(b.subject) + '</b></label><small>' + (b.starts ? esc(t12(b.starts)) + ' · ' : '') + esc(mins(b.minutes)) + (b.done && b.done_minutes != null && b.done_minutes !== b.minutes ? ' (did ' + esc(mins(b.done_minutes)) + ')' : '') + '</small>' + (b.topic ? '<span>' + esc(b.topic) + '</span>' : '') +
            '<span class="r21-bacts">' + (b.done ? '<button type="button" class="r21-link" data-r21bmin="' + b.id + '">Change minutes</button>' : '') + '<button type="button" class="r21-x" data-r21bdel="' + b.id + '" aria-label="Remove this block">×</button></span></div>').join('') : '<p class="p-hint">Free</p>') + '</section>'; }).join('') + '</div>' +
        card('Your courses', '', '<div class="p-row"><span>Acquisitions Playbook</span><b>' + (cp.acq_total ? num(cp.acq_done) + ' of ' + num(cp.acq_total) + ' items' : '–') + '</b></div>' +
          '<div class="p-row"><span>Psychology and coaching</span><b>' + (cp.psy_done != null ? plural(+cp.psy_done, 'part') + ' done' : '–') + '</b></div>' +
          '<div class="p-row"><span>Marketing A to Z</span><b>' + (cp.mkt_seen != null ? plural(+cp.mkt_seen, 'module') + ' opened' : '–') + '</b></div>' +
          '<div class="px-tools"><a class="p-btn is-ghost" href="/app/learn/">Open the Learning Hub</a><a class="p-btn is-ghost" href="#learnstats">Learner analytics</a></div>');
      widths(body);
    }
    function blockForm(){
      const subs = subjects();
      return '<form class="px-form r20-row" id="r21BForm" novalidate>' +
        f('Subject', '<input type="text" id="r21BSub" maxlength="40" list="r21Subs" value="' + esc(subs[0] || 'Acquisitions') + '"><datalist id="r21Subs">' + subs.map(s => '<option value="' + esc(s) + '"></option>').join('') + '</datalist>') +
        f('Starts (optional)', '<input type="time" id="r21BAt" step="900" value="11:00">') +
        f('Minutes', '<input type="number" id="r21BMin" min="5" max="600" step="5" value="60">') +
        f('What to study (optional)', '<input type="text" id="r21BTopic" maxlength="200" placeholder="e.g. Module 9, lessons 9.1 to 9.3">', 'px-wide') +
        '<fieldset class="r21-days px-wide"><legend>Days this week</legend>' + [0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(S.wk, i); return '<label><input type="checkbox" value="' + d + '"' + (d === cairo() ? ' checked' : '') + '> ' + esc(fmtDay(d, { weekday:'short', day:'numeric' })) + '</label>'; }).join('') + '</fieldset>' +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">Add blocks</button><button type="button" class="p-btn is-ghost" data-r21bx>Cancel</button><span class="p-hint" id="r21BMsg" role="status"></span></div></form>';
    }
    function targetForm(){
      return '<div class="r21-tgedit">' + Tg.map(t => '<form class="px-form r20-row" data-r21tform="' + esc(t.subject) + '" novalidate>' + f(t.subject + ' (minutes a week)', '<input type="number" name="m" min="0" max="5000" step="15" value="' + t.weekly_minutes + '">') +
        '<div class="px-tools"><button type="submit" class="p-btn is-ghost">Save</button><button type="button" class="p-btn is-ghost" data-r21tdel="' + esc(t.subject) + '">Remove</button></div></form>').join('') +
        '<form class="px-form r20-row" data-r21tform="" novalidate>' + f('New subject', '<input type="text" name="s" maxlength="40" placeholder="e.g. English pronunciation">') + f('Minutes a week', '<input type="number" name="m" min="0" max="5000" step="15" value="120">') +
        '<div class="px-tools"><button type="submit" class="p-btn">Add subject</button></div></form></div>';
    }
    await load();
    body.addEventListener('change', async e => {
      const c = e.target.closest('[data-r21bdone]'); if (!c) return;
      const b = B.find(x => x.id === c.dataset.r21bdone); b.done = c.checked; if (!c.checked) b.done_minutes = null; draw();
      const x = await safe(db().from('me_study_blocks').update({ done:b.done, done_minutes:b.done ? b.done_minutes : null }).eq('id', b.id)); if (x.error) load();
    });
    body.addEventListener('click', async e => {
      const w = e.target.closest('[data-r21wk]'); if (w) { S.wk = +w.dataset.r21wk ? addDays(S.wk, +w.dataset.r21wk) : monday(cairo()); body.innerHTML = PX.loading; load(); return; }
      if (e.target.closest('[data-r21bnew]')) { S.adding = true; draw(); return; }
      if (e.target.closest('[data-r21bx]')) { S.adding = false; draw(); return; }
      if (e.target.closest('[data-r21tg]')) { S.targets = !S.targets; draw(); return; }
      const bd = e.target.closest('[data-r21bdel]'); if (bd) { const id = bd.dataset.r21bdel; undoDel(bd, 'Study block deleted.', () => safe(db().from('me_study_blocks').delete().eq('id', id)), load); return; }
      const bm = e.target.closest('[data-r21bmin]');
      if (bm) {
        const b = B.find(x => x.id === bm.dataset.r21bmin), wrap = bm.closest('.r21-blk');
        if (wrap.querySelector('.r21-minf')) return;
        wrap.insertAdjacentHTML('beforeend', '<form class="r21-minf" novalidate><input type="number" min="0" max="600" step="5" value="' + (b.done_minutes != null ? b.done_minutes : b.minutes) + '" aria-label="Minutes you actually studied"><button type="submit" class="p-btn is-ghost">Save</button></form>');
        wrap.querySelector('.r21-minf input').focus(); wrap.querySelector('.r21-minf').dataset.id = b.id; return;
      }
      const td = e.target.closest('[data-r21tdel]'); if (td) { const id = td.dataset.r21tdel; undoDel(td, 'Target removed.', () => safe(db().from('me_study_targets').delete().eq('subject', id)), load); return; }
      if (e.target.closest('[data-r21copy]')) {
        const prev = await safe(db().from('me_study_blocks').select('subject,day,starts,minutes,topic').gte('day', addDays(S.wk, -7)).lte('day', addDays(S.wk, -1)));
        const rows = (prev.data || []).map(b => ({ subject:b.subject, day:addDays(b.day, 7), starts:b.starts, minutes:b.minutes, topic:b.topic }))
          .filter(r => !B.some(b => b.day === r.day && b.subject === r.subject && b.starts === r.starts));
        if (!rows.length) { say('r21CopyMsg', (prev.data || []).length ? 'Already copied.' : 'Last week has no blocks.'); return; }
        const x = await safe(db().from('me_study_blocks').insert(rows));
        if (x.error) { say('r21CopyMsg', errText(x, 'Couldn’t copy it.')); return; }
        load();
      }
    });
    body.addEventListener('submit', async e => {
      e.preventDefault();
      const fm = e.target;
      if (fm.classList.contains('r21-minf')) { const m = Math.max(0, Math.min(600, Math.round(+fm.querySelector('input').value || 0))); await safe(db().from('me_study_blocks').update({ done_minutes:m }).eq('id', fm.dataset.id)); load(); return; }
      if (fm.id === 'r21BForm') {
        const subject = $('r21BSub').value.trim(), minutes = Math.round(+$('r21BMin').value || 0), days = [...fm.querySelectorAll('.r21-days input:checked')].map(i => i.value);
        if (!subject) return say('r21BMsg', 'Pick a subject.');
        if (!(minutes >= 5)) return say('r21BMsg', 'At least 5 minutes.');
        if (!days.length) return say('r21BMsg', 'Pick at least one day.');
        const x = await safe(db().from('me_study_blocks').insert(days.map(d => ({ subject, day:d, starts:$('r21BAt').value || null, minutes, topic:$('r21BTopic').value.trim() || null }))));
        if (x.error) return say('r21BMsg', errText(x, 'Couldn’t add them. Try again.'));
        if (!Tg.some(t => t.subject === subject)) await safe(db().from('me_study_targets').insert({ subject, weekly_minutes:0, sort:Tg.length }));
        S.adding = false; load(); return;
      }
      if (fm.hasAttribute('data-r21tform')) {
        const s = fm.dataset.r21tform || (fm.s ? fm.s.value.trim() : ''), m = Math.max(0, Math.round(+fm.m.value || 0));
        if (!s) return;
        await safe(db().from('me_study_targets').upsert({ subject:s, weekly_minutes:m, sort:(Tg.find(t => t.subject === s) || {}).sort != null ? Tg.find(t => t.subject === s).sort : Tg.length }, { onConflict:'subject' }));
        load();
      }
    });
  } };

  // ======================================================================
  // #worklog  M7
  // ======================================================================
  const WST = { planned:'Planned', progress:'In progress', done:'Done', pending:'Pending' };
  const clean = s => String(s || '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  // Same vendor or property → one bullet with sub-bullets
  function bullets(items){
    const out = [], seen = new Map();
    items.forEach(it => {
      const g = clean(it.grp);
      if (!g) { out.push('• ' + clean(it.text)); return; }
      if (!seen.has(g.toLowerCase())) { const arr = []; seen.set(g.toLowerCase(), arr); out.push({ g, arr }); }
      seen.get(g.toLowerCase()).push(clean(it.text));
    });
    return out.map(x => typeof x === 'string' ? x : x.arr.length === 1 ? '• ' + x.g + ': ' + x.arr[0] : '• ' + x.g + '\n' + x.arr.map(t => '    ◦ ' + t).join('\n')).join('\n');
  }
  function buildDraft(kind, d, items, greet){
    const by = s => items.filter(i => i.status === s);
    const head = '*' + longDay(d) + '*\n' + (clean(greet) || 'Hello team,') + '\n\n';
    const sec = (title, list) => list.length ? '*' + title + '*\n' + bullets(list) + '\n\n' : '';
    let mid = '';
    if (kind === 'morning') {
      const plan = items.filter(i => i.status !== 'done');
      mid = plan.length ? 'Here is my plan for today:\n' + bullets(plan) + '\n\n' : 'Here is my plan for today:\n• \n\n';
    } else if (kind === 'midday') {
      mid = 'Here is my update so far today:\n\n' + sec('Completed', by('done')) + sec('In progress', by('progress')) + sec('Still to do today', by('planned').concat(by('pending')));
    } else {
      mid = 'Here is my end-of-day update:\n\n' + sec('Completed', by('done')) + sec('In progress', by('progress')) + sec('Pending', by('pending').concat(by('planned')));
    }
    if (kind !== 'morning' && !items.length) mid += '• \n\n';
    return head + mid.replace(/\n{3,}/g, '\n\n') + 'Thank you!';
  }
  V.worklog = { title:'Work log', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Me', 'Work log', 'Jot each task as you go. Get morning, midday and end-of-day drafts in your Slack format. Drafts only: copy one and post it yourself. Nothing is posted or sent from here.');
    // Shift runs about 4 PM to 1 AM Cairo: morning plan before 6 PM, midday until 10 PM, then end of day
    const ch = +new Intl.DateTimeFormat('en-US', { timeZone:'Africa/Cairo', hour:'numeric', hourCycle:'h23' }).format(new Date()) % 24;
    const S = { d:nyDay(), kind:ch >= 5 && ch < 18 ? 'morning' : ch >= 18 && ch < 22 ? 'midday' : 'eod', greet:'Hello team,', edit:null };
    try { S.greet = localStorage.getItem('r21-greet') || S.greet; } catch(e) {}
    let W = [], C = [], Dr = {}, groups = [];
    async function load(){
      const [w, c, dr, g] = await Promise.all([safe(db().from('me_work_log').select('*').eq('day', S.d).order('sort').order('at')),
        safe(db().from('me_work_log').select('*').lt('day', S.d).gte('day', addDays(S.d, -14)).in('status', ['planned', 'progress', 'pending']).is('carried_on', null).order('day', { ascending:false })),
        safe(db().from('me_report_drafts').select('*').eq('day', S.d)),
        safe(db().from('me_work_log').select('grp').not('grp', 'is', null).order('at', { ascending:false }).limit(300))]);
      if (!ok()) return;
      if (w.error) { body.innerHTML = failed(w.error); return; }
      W = w.data || []; C = c.data || []; Dr = {}; (dr.data || []).forEach(x => Dr[x.kind] = x);
      groups = [...new Set((g.data || []).map(x => x.grp).filter(Boolean))].slice(0, 40);
      draw();
    }
    function draw(){
      const cnt = s => W.filter(w => w.status === s).length;
      const saved = Dr[S.kind];
      const text = saved ? saved.body : buildDraft(S.kind, S.d, W, S.greet);
      body.innerHTML =
        '<div class="px-form r20-row">' + f('Work day (New York date)', '<input type="date" id="r21WDay" value="' + S.d + '" max="' + addDays(nyDay(), 1) + '">') +
          '<div class="px-tools"><span class="p-hint">' + esc(longDay(S.d)) + (S.d === nyDay() ? ' · today' : '') + '</span>' + (S.d !== nyDay() ? '<button type="button" class="p-btn is-ghost" data-r21wtoday>Today</button>' : '') + '</div></div>' +
        tiles([tile(String(cnt('done')), 'done', ''), tile(String(cnt('progress')), 'in progress', ''), tile(String(cnt('planned')), 'planned', ''), tile(String(cnt('pending')), 'pending', '')]) +
        card('Add a task', 'press Enter to add', '<form class="px-form r20-row" id="r21WForm" novalidate>' +
          f('Task', '<input type="text" id="r21WText" maxlength="1000" placeholder="e.g. Called PepsiCo about the Streamside account transfer">', 'px-wide') +
          f('Vendor or property (optional)', '<input type="text" id="r21WGrp" maxlength="80" list="r21Grps" placeholder="Groups tasks in one bullet"><datalist id="r21Grps">' + groups.map(g => '<option value="' + esc(g) + '"></option>').join('') + '</datalist>') +
          f('Status', '<select id="r21WSt">' + Object.keys(WST).map(k => opt(k, WST[k], k === (S.kind === 'morning' ? 'planned' : 'done'))).join('') + '</select>') +
          '<div class="px-tools"><button type="submit" class="p-btn">Add</button><span class="p-hint" id="r21WMsg" role="status"></span></div></form>') +
        (C.length && S.d >= nyDay() ? card('Still open from earlier days', plural(C.length, 'task'), C.map(c => '<div class="r20-rule"><div class="r20-rl">' + (c.grp ? '<b>' + esc(c.grp) + ':</b> ' : '') + esc(c.text) + '<small>' + esc(day(c.day)) + ' · ' + esc(WST[c.status]) + '</small></div><div class="r20-rc"><button type="button" class="p-btn is-ghost" data-r21carry="' + c.id + '">Bring to today</button><button type="button" class="p-btn is-ghost" data-r21cdone="' + c.id + '">It’s done</button><button type="button" class="p-btn is-ghost" data-r21cdrop="' + c.id + '">Drop</button></div></div>').join('') +
          '<div class="px-tools"><button type="button" class="p-btn" data-r21carryall>Bring all to today</button></div>') : '') +
        card('Today’s log', plural(W.length, 'task'), W.length ? Object.keys(WST).map(s => { const list = W.filter(w => w.status === s); return list.length ? '<h3 class="r20-h">' + esc(WST[s]) + ' <small>' + list.length + '</small></h3>' + list.map(w => S.edit === w.id ? editRow(w) : '<div class="r20-rule"><div class="r20-rl">' + (w.grp ? '<b>' + esc(w.grp) + ':</b> ' : '') + esc(w.text) + '<small>' + esc(fmtTime(w.at, 'Africa/Cairo')) + ' Cairo</small></div><div class="r20-rc"><select class="r21-inline" data-r21wst="' + w.id + '" aria-label="Status">' + Object.keys(WST).map(k => opt(k, WST[k], w.status === k)).join('') + '</select><button type="button" class="p-btn is-ghost" data-r21wedit="' + w.id + '">Edit</button><button type="button" class="p-btn is-ghost" data-r21wdel="' + w.id + '">Delete</button></div></div>').join('') : ''; }).join('') : empty('Nothing logged for this day yet.')) +
        card('Report drafts', 'for Slack, nothing is sent',
          '<div class="px-tools r21-tabs" role="tablist">' + [['morning', 'Morning plan'], ['midday', 'Midday'], ['eod', 'End of day']].map(([k, l]) => '<button type="button" role="tab" class="p-btn' + (S.kind === k ? '' : ' is-ghost') + '" aria-selected="' + (S.kind === k) + '" data-r21kind="' + k + '">' + l + (Dr[k] ? ' ✓' : '') + '</button>').join('') + '</div>' +
          '<div class="px-form r20-row">' + f('Opening line', '<input type="text" id="r21Greet" maxlength="80" value="' + esc(S.greet) + '" placeholder="Hello team, or Hello @Amina,">') + '</div>' +
          '<label class="sc-f r21-draft">Draft' + '<textarea id="r21Draft" rows="14" spellcheck="true">' + esc(text) + '</textarea></label>' +
          '<div class="px-tools"><button type="button" class="p-btn" data-r21copyd>Copy</button><button type="button" class="p-btn is-ghost" data-r21saved>Save this draft</button><button type="button" class="p-btn is-ghost" data-r21rebuild>Rebuild from the log</button>' +
            '<span class="p-hint" id="r21DMsg" role="status">' + (saved ? 'Saved ' + esc(fmtTime(saved.saved_at)) + '. Your edits are kept; Rebuild to start again from the log.' : 'Built from the log. Edit it here, then copy it into Slack yourself.') + '</span></div>' +
          '<p class="p-hint">Same vendor or property is grouped into one bullet. Dashes are turned into commas. Starts with your opening line and ends with “Thank you!”.</p>');
    }
    const editRow = w => '<form class="px-form r20-row" data-r21wform="' + w.id + '" novalidate>' + f('Task', '<input type="text" name="t" maxlength="1000" value="' + esc(w.text) + '">', 'px-wide') + f('Vendor or property', '<input type="text" name="g" maxlength="80" list="r21Grps" value="' + esc(w.grp || '') + '">') +
      '<div class="px-tools"><button type="submit" class="p-btn">Save</button><button type="button" class="p-btn is-ghost" data-r21wx>Cancel</button></div></form>';
    // Changing the log rebuilds a draft only if you haven't saved your own edits for it
    async function carry(c){ await safe(db().from('me_work_log').insert({ day:S.d, text:c.text, grp:c.grp, status:c.status === 'pending' ? 'planned' : c.status, sort:W.length })); await safe(db().from('me_work_log').update({ carried_on:S.d }).eq('id', c.id)); }
    await load();
    body.addEventListener('change', async e => {
      if (e.target.id === 'r21WDay') { if (e.target.value) { S.d = e.target.value; S.edit = null; body.innerHTML = PX.loading; load(); } return; }
      if (e.target.id === 'r21Greet') { S.greet = e.target.value || 'Hello team,'; try { localStorage.setItem('r21-greet', S.greet); } catch(x) {} if (!Dr[S.kind]) $('r21Draft').value = buildDraft(S.kind, S.d, W, S.greet); return; }
      const s = e.target.closest('[data-r21wst]');
      if (s) { const w = W.find(x => x.id === s.dataset.r21wst); w.status = s.value; draw(); const x = await safe(db().from('me_work_log').update({ status:s.value, updated_at:new Date().toISOString() }).eq('id', w.id)); if (x.error) load(); }
    });
    body.addEventListener('click', async e => {
      if (e.target.closest('[data-r21wtoday]')) { S.d = nyDay(); body.innerHTML = PX.loading; load(); return; }
      const k = e.target.closest('[data-r21kind]'); if (k) { S.kind = k.dataset.r21kind; draw(); return; }
      if (e.target.closest('[data-r21copyd]')) {
        const t = $('r21Draft').value;
        try { await navigator.clipboard.writeText(t); say('r21DMsg', 'Copied. Paste it into Slack and post it yourself.'); }
        catch(x) { const a = $('r21Draft'); a.focus(); a.select(); say('r21DMsg', 'Selected. Press Ctrl+C (or Copy) to copy it.'); }
        return;
      }
      if (e.target.closest('[data-r21saved]')) {
        const x = await safe(db().from('me_report_drafts').upsert({ day:S.d, kind:S.kind, body:$('r21Draft').value, saved_at:new Date().toISOString() }, { onConflict:'day,kind' }).select().single());
        if (x.error) { say('r21DMsg', errText(x, 'Couldn’t save it.')); return; }
        Dr[S.kind] = x.data; draw(); return;
      }
      if (e.target.closest('[data-r21rebuild]')) {
        const b = e.target.closest('[data-r21rebuild]');
        if (Dr[S.kind] && !sure(b, 'Sure? Your edits go', 'Rebuild from the log')) return;
        if (Dr[S.kind]) { await safe(db().from('me_report_drafts').delete().eq('day', S.d).eq('kind', S.kind)); delete Dr[S.kind]; }
        draw(); return;
      }
      const ed = e.target.closest('[data-r21wedit]'); if (ed) { S.edit = ed.dataset.r21wedit; draw(); return; }
      if (e.target.closest('[data-r21wx]')) { S.edit = null; draw(); return; }
      const dl = e.target.closest('[data-r21wdel]'); if (dl) { const id = dl.dataset.r21wdel; undoDel(dl, 'Task deleted.', () => safe(db().from('me_work_log').delete().eq('id', id)), load); return; }
      const ca = e.target.closest('[data-r21carry]'); if (ca) { ca.disabled = true; await carry(C.find(c => c.id === ca.dataset.r21carry)); load(); return; }
      if (e.target.closest('[data-r21carryall]')) { for (const c of C) await carry(c); load(); return; }
      const cd = e.target.closest('[data-r21cdone]'); if (cd) { const c = C.find(x => x.id === cd.dataset.r21cdone); await safe(db().from('me_work_log').insert({ day:S.d, text:c.text, grp:c.grp, status:'done', sort:W.length })); await safe(db().from('me_work_log').update({ carried_on:S.d }).eq('id', c.id)); load(); return; }
      const cx = e.target.closest('[data-r21cdrop]'); if (cx) { await safe(db().from('me_work_log').update({ carried_on:S.d }).eq('id', cx.dataset.r21cdrop)); load(); }
    });
    body.addEventListener('submit', async e => {
      e.preventDefault();
      const fm = e.target;
      if (fm.id === 'r21WForm') {
        const text = $('r21WText').value.trim(); if (!text) return say('r21WMsg', 'Write the task first.');
        const st = $('r21WSt').value, grp = $('r21WGrp').value.trim() || null;
        const x = await safe(db().from('me_work_log').insert({ day:S.d, text, grp, status:st, sort:W.length }));
        if (x.error) return say('r21WMsg', errText(x, 'Couldn’t add it. Try again.'));
        await load(); const t = $('r21WText'), s = $('r21WSt'), g = $('r21WGrp'); if (s) s.value = st; if (g && grp) g.value = grp; if (t) t.focus();
        return;
      }
      if (fm.hasAttribute('data-r21wform')) {
        const t = fm.t.value.trim(); if (!t) return;
        await safe(db().from('me_work_log').update({ text:t, grp:fm.g.value.trim() || null, updated_at:new Date().toISOString() }).eq('id', fm.dataset.r21wform));
        S.edit = null; load();
      }
    });
  } };

  // ======================================================================
  // "Me today" for the command center (portal-home.js)
  // ======================================================================
  window.R21Me = {
    async summary(d){
      if (!isOwner()) return null;
      const today = cairo(), ny = nyDay();
      const [h, l, sb, wl, ja, gs] = await Promise.all([
        safe(d.from('me_habits').select('id,days,per_week').eq('active', true)),
        safe(d.from('me_habit_log').select('habit_id').eq('day', today)),
        safe(d.from('me_study_blocks').select('subject,starts,minutes,done').eq('day', today).order('starts', { nullsFirst:false })),
        safe(d.from('me_work_log').select('status').eq('day', ny)),
        safe(d.from('me_job_apps').select('id').lte('next_on', today).not('status', 'in', '(hired,lost,no_reply,withdrawn)')),
        safe(d.from('me_goal_steps').select('id,me_goals!inner(status)').eq('done', false).lte('due', today).eq('me_goals.status', 'active'))
      ]);
      if (h.error) return null;
      const dueH = (h.data || []).filter(x => x.per_week || (x.days || []).includes(wd(today))), ticked = new Set((l.data || []).map(x => x.habit_id));
      const doneH = dueH.filter(x => ticked.has(x.id)).length;
      const blocks = sb.data || [], next = blocks.find(b => !b.done), logs = wl.data || [];
      return [
        ['Routine today', doneH + ' of ' + dueH.length + ' done', '#routine', dueH.length && doneH < dueH.length],
        ['Study', blocks.length ? (next ? 'Next ' + (next.starts ? t12(next.starts) + ' ' : '') + next.subject : blocks.length === 1 ? 'Done' : 'All ' + blocks.length + ' done') : 'Nothing planned', '#study', false],
        ['Work log', logs.length ? plural(logs.filter(x => x.status === 'done').length, 'task') + ' done' : 'Nothing logged yet', '#worklog', false],
        ['Upwork and LinkedIn', (ja.data || []).length ? plural(ja.data.length, 'follow-up') + ' due' : 'No follow-ups due', '#jobhunt', (ja.data || []).length > 0],
        ['Goal steps', (gs.data || []).length ? plural(gs.data.length, 'step') + ' due' : 'None due', '#goals', (gs.data || []).length > 0]
      ];
    }
  };

  // ======================================================================
  // P1 Devices and sessions (Settings › Devices, everyone, own account)
  // ======================================================================
  function deviceName(ua){
    ua = ua || '';
    const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Deno|node|curl|python/i.test(ua) ? 'Script' : 'Browser';
    const o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ua ? 'Unknown system' : 'Unknown device';
    return b + ' on ' + o;
  }
  const ago = t => { const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 2 ? 'just now' : m < 60 ? m + ' minutes ago' : m < 1440 ? Math.round(m / 60) + (Math.round(m / 60) === 1 ? ' hour ago' : ' hours ago') : fmtDay(t, { month:'short', day:'numeric' }) + ', ' + fmtTime(t); };
  window.PortalDevices = {
    async draw(B){
      const head = (t, sub) => '<div class="set-head"><h3>' + esc(t) + '</h3>' + (sub ? '<p class="note">' + esc(sub) + '</p>' : '') + '</div>';
      B.innerHTML = head('Devices and sessions', 'Every phone, computer and browser signed in to your account. If one isn’t yours, sign it out and change your password.') + '<p class="note">Loading…</p>';
      const r = await safe(db().rpc('my_sessions'));
      if (r.error) { B.innerHTML = head('Devices and sessions') + '<p class="note">' + (/does not exist|schema cache/i.test(r.error.message || '') ? 'This part isn’t set up yet.' : 'Couldn’t load your devices. Check your connection and try again.') + '</p>'; return; }
      const list = r.data || [], others = list.filter(s => !s.is_current);
      B.innerHTML = head('Devices and sessions', 'Every phone, computer and browser signed in to your account. If one isn’t yours, sign it out and change your password.') +
        '<ul class="r21-dev">' + list.map(s => '<li' + (s.is_current ? ' class="is-here"' : '') + '><div><b>' + esc(deviceName(s.user_agent)) + '</b>' + (s.is_current ? ' <span class="r21-here">This device</span>' : '') +
          '<small>Last active ' + esc(ago(s.last_active)) + ' · signed in ' + esc(fmtDay(s.created_at, { month:'short', day:'numeric', year:'numeric' })) + ', ' + esc(fmtTime(s.created_at)) + (s.ip ? ' · IP ' + esc(s.ip) : '') + (s.aal === 'aal2' ? ' · with authenticator code' : '') + '</small></div>' +
          (s.is_current ? '' : '<button type="button" class="btn ghost" data-r21out="' + esc(s.id) + '">Sign out</button>') + '</li>').join('') + '</ul>' +
        (others.length ? '<div class="form narrow"><button class="btn ghost" type="button" id="r21OutAll">Sign out of all other devices (' + others.length + ')</button></div>' : '<p class="note">No other devices are signed in.</p>') +
        '<p class="note" id="r21DevMsg" role="status">A device you sign out stops working within the hour, as soon as its sign-in needs renewing. Times are your device’s time.</p>';
    }
  };
  document.addEventListener('click', async e => {
    const one = e.target.closest('[data-r21out]'), all = e.target.closest('#r21OutAll');
    if (!one && !all) return;
    const B = (one || all).closest('#setBody') || document.getElementById('setBody');
    const b = one || all; b.setAttribute('aria-busy', 'true'); b.disabled = true;
    const x = one ? await safe(db().rpc('sign_out_session', { p_id:one.dataset.r21out })) : await safe(db().auth.signOut({ scope:'others' }));
    if (x.error) { b.disabled = false; b.removeAttribute('aria-busy'); const m = document.getElementById('r21DevMsg'); if (m) m.textContent = errText(x, 'Couldn’t do that. Check your connection and try again.'); return; }
    if (B) window.PortalDevices.draw(B);
  });
})();
