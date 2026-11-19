// Round 28 of the plan (Nov 19 2026): calling.
//   L4  Lead's local time: every lead shows its local time and the legal-hour answer from window.CallHours (federal
//       8 AM to 9 PM plus the state rules in #callhours). Outside legal hours the Call button is blocked.
//   L11 Recording disclosure: states that need everyone's consent to record (consent_states, editable by Amr on
//       #callhours, each marked "Attorney to confirm") show the line to say before the call.
//   L1  Click-to-call: a tel: link opens the phone's dialer (or the desktop dialer). When the rep comes back to the
//       page, the outcome buttons open for that lead. No in-portal calling here (Telnyx comes later, L15).
//   L2  #queue: the next lead from the rep's own #mylists lists, its script and one-tap outcomes on one screen. Same
//       outcomes as #mylists (Do not call / Wrong number add to the do-not-call list). Due callbacks come first.
//   L3  Script and answers panel: the scripts from Scripts and objections (#library) and the objection answers from
//       Acquisitions Playbook lessons 10.1 and 10.2 (call_rebuttals()), each linked back to its lesson.
//   L5  Callbacks booked in the lead's own time zone, showing their time and Cairo time with AM/PM; blocked outside
//       legal hours. The existing bell 10 minutes before (cron talents-callback-reminders) is unchanged.
//   L14 Daily dial goal for ACQ people (People › "count as they go"): live counts against rep_targets (today and
//       this week). The queue adds dials and conversations while clocked in. The end-of-day numbers are still typed
//       by the rep when clocking out; the counter only fills empty boxes (calls.js fill()).
// Database: consent_states, call_settings, call_rebuttals(); uses lead_records, my_lead_lists(), lead_record_outcome(),
// dnc_add(), callbacks, call_events, rep_targets, members.tap_counter.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, fmtDay, fmtTime, num, plural, card, empty, failed, pill, f, opt, say, errText, STATE_TZ, ZONES, zonedToUtc, isoDay } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const CAIRO = 'Africa/Cairo';
  const OUTCOMES = ['No answer', 'Left voicemail', 'Callback', 'Not interested', 'Interested', 'Appointment set', 'Wrong number', 'Do not call'];
  const TALKED = new Set(['Callback', 'Not interested', 'Interested', 'Appointment set']);
  const phoneNorm = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; };
  const telOf = p => { const d = phoneNorm(p); return d.length === 10 ? 'tel:+1' + d : 'tel:' + d; };
  const phoneShow = p => { const d = phoneNorm(p); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : (p || ''); };
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch(e) { return null; } };
  const zoneName = tz => (ZONES.find(z => z[0] === tz) || [, ''])[1];

  // ======================================================================
  // Shared: calling rules, consent states, the disclosure line (loaded once per sign-in)
  // ======================================================================
  const R = { consent:{}, line:'', loaded:null };
  function load(force){
    if (R.loaded && !force) return R.loaded;
    R.loaded = (async () => {
      const [cr, cs, st] = await Promise.all([safe(db().from('calling_rules').select('*')), safe(db().from('consent_states').select('*').order('state')), safe(db().from('call_settings').select('key,value'))]);
      if (window.CallHours && cr.data) window.CallHours.setRules(cr.data);
      R.consent = {}; (cs.data || []).forEach(x => { if (x.all_party) R.consent[x.state] = x; });
      R.rows = cs.data || [];
      R.line = ((st.data || []).find(x => x.key === 'recording_line') || {}).value || '';
      return R;
    })();
    return R.loaded;
  }
  const consentFor = st => R.consent[String(st || '').toUpperCase()] || null;
  // L4: the lead's time, legal or not, and Cairo time beside it
  function timeFor(st, at){
    st = String(st || '').toUpperCase().slice(0, 2);
    const tz = STATE_TZ[st], ch = window.CallHours && tz ? window.CallHours.check(st, at || new Date()) : null;
    return { st, tz, ch, cairo:fmtTime(at || new Date(), CAIRO) };
  }
  // L11: the reminder block (empty when the state is one-party)
  function consentBox(st){
    const c = consentFor(st); if (!c) return '';
    if (store('r28-rec') === '0') return '<div class="r28-consent is-light" role="note"><b>' + esc(st) + ' needs everyone’s consent to record.</b><small>You said you don’t record. If you start, say the line first.</small></div>';
    return '<div class="r28-consent" role="note"><b>Recording? ' + esc(st) + ' needs everyone’s consent.</b>' +
      '<span>Say this first, before anything else:</span><q>' + esc(R.line || 'This call is recorded for quality and training. Is that okay with you?') + '</q>' +
      '<small>If they say no, stop recording or end the call. ' + (c.note ? esc(c.note) : 'Attorney to confirm.') + '</small></div>';
  }
  window.R28Calls = { load, consentFor, timeFor, consentBox };

  // ======================================================================
  // L14: the counter (ACQ people only: members.tap_counter) and saving taps from the queue
  // ======================================================================
  const C = { acq:null, targets:null, week:null, weekFor:'' };
  async function acqInfo(){
    if (C.acq !== null) return C;
    const u = T().user; if (!u || T().role !== 'member') { C.acq = false; return C; }
    const [m, t] = await Promise.all([safe(db().from('members').select('tap_counter').eq('user_id', u.id).maybeSingle()), safe(db().from('rep_targets').select('*').eq('user_id', u.id).maybeSingle())]);
    C.acq = !!(m.data && m.data.tap_counter); C.targets = t.data || null;
    return C;
  }
  const liveShift = () => { const st = T().clockState ? T().clockState() : null; return st && st.live ? st.live.started_at : null; };
  const countOn = () => C.acq && store('r28-count') !== '0';
  async function logTap(kind, listId){
    if (!countOn()) return false;
    const shift = liveShift(); if (!shift) return false;
    const x = await safe(db().from('call_events').insert(Object.assign({ kind, shift_started_at:shift }, listId ? { lead_list_id:listId } : {})));
    if (x.error) return false;
    if (window.TalentsCalls) window.TalentsCalls.reset();
    C.today = null;
    return true;
  }
  // today's taps for this shift, and this week's saved shifts (Monday, Cairo week) plus today
  async function counts(){
    const shift = liveShift(), out = { dial:0, conversation:0, offer:0, appointment:0 };
    if (shift) { const r = await safe(db().from('call_events').select('kind').eq('shift_started_at', shift)); (r.data || []).forEach(x => { out[x.kind] = (out[x.kind] || 0) + 1; }); }
    const now = new Date(), mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); const from = isoDay(mon);
    if (C.weekFor !== from + '|' + (T().user || {}).id) {
      const w = await safe(db().from('shifts').select('shift_date,dials,conversations,offers,appointments').eq('user_id', T().user.id).gte('shift_date', from));
      C.week = w.error ? null : (w.data || []).reduce((a, s) => { a.dial += +s.dials || 0; a.conversation += +s.conversations || 0; a.offer += +s.offers || 0; a.appointment += +s.appointments || 0; return a; }, { dial:0, conversation:0, offer:0, appointment:0 });
      C.weekFor = from + '|' + (T().user || {}).id;
    }
    return { today:out, week:C.week, live:!!shift };
  }
  const GOALS = [['dial', 'Dials', 'dials'], ['conversation', 'Conversations', 'conversations'], ['offer', 'Offers', 'offers'], ['appointment', 'Appointments', 'appointments']];
  function goalHtml(c){
    const t = C.targets || {};
    const tiles = GOALS.map(([k, label, col]) => {
      const n = c.today[k] || 0, goal = +t['daily_' + col] || 0, wk = c.week ? (c.week[k] || 0) + n : null, wgoal = +t['weekly_' + col] || 0;
      const w = goal ? Math.min(100, Math.round(n / goal * 100)) : 0;
      return '<div class="r28-goal' + (goal && n >= goal ? ' is-done' : '') + '"><b>' + num(n) + (goal ? '<small> of ' + num(goal) + '</small>' : '') + '</b><span>' + label + ' today</span>' +
        (goal ? '<span class="px-bar"><i data-w="' + Math.max(2, w) + '"></i></span>' : '') +
        (wk != null ? '<small>' + num(wk) + (wgoal ? ' of ' + num(wgoal) : '') + ' this week</small>' : '') + '</div>';
    }).join('');
    return '<div class="r28-goals" aria-live="polite">' + tiles + '</div>' +
      (c.live ? '' : '<p class="p-hint">Clock in on <a href="#track">My hours</a> so your dials count.</p>');
  }
  async function drawGoal(box){
    if (!box) return;
    await acqInfo(); if (!C.acq) { box.hidden = true; return; }
    const c = await counts(); box.hidden = false;
    box.innerHTML = goalHtml(c) + '<label class="r17-check r28-countme"><input type="checkbox" data-r28count' + (countOn() ? ' checked' : '') + '> Count my dials and conversations from the queue</label>' +
      '<p class="p-hint">You still type your numbers in the end-of-day report when you clock out. The counter only fills boxes you left empty.</p>';
    PX.widths(box);
  }
  document.addEventListener('change', e => { if (e.target.matches('[data-r28count]')) store('r28-count', e.target.checked ? '1' : '0'); });

  // On My hours, under the tap counter: progress against today's and this week's targets
  (function onTrack(){
    let busy = false;
    setInterval(async () => {
      const box = $('tCalls'); if (!box || box.hidden || !$('pTrack') || $('pTrack').hidden || busy) return;
      busy = true;
      try {
        await acqInfo(); if (!C.acq) return;
        let g = $('r28TrackGoal'); if (!g) { g = document.createElement('div'); g.id = 'r28TrackGoal'; g.className = 'r28-trackgoal'; const grid = $('tCallsGrid'); (grid ? grid.parentNode : box).insertBefore(g, grid ? grid.nextSibling : null); }
        const live = window.TalentsCalls && window.TalentsCalls.counts;
        const c = live ? { today:live, week:(await counts()).week, live:true } : await counts();
        g.innerHTML = '<p class="r28-trackgoal-h">Your targets</p>' + goalHtml(c).replace(/<p class="p-hint">.*$/, ''); PX.widths(g);
      } finally { busy = false; }
    }, 5000);
  })();

  // ======================================================================
  // L5: callback form in the lead's time zone (used by the queue)
  // ======================================================================
  function callbackForm(lead){
    const st = String(lead.state || '').toUpperCase(), tz = STATE_TZ[st] || 'America/New_York';
    return '<form class="px-form r28-cb" data-r28cb novalidate><p class="r28-cb-h">Call back ' + esc(lead.owner_name || 'this lead') + '</p>' +
      f('Day', '<input type="date" name="d" value="' + isoDay(new Date()) + '" min="' + isoDay(new Date()) + '">') +
      f('Time, their time', '<input type="time" name="t" value="15:00" step="300">') +
      f('Their time zone', '<select name="z">' + ZONES.map(([z, n]) => opt(z, n, z === tz)).join('') + '</select>') +
      f('Note (optional)', '<input type="text" name="n" maxlength="200" autocomplete="off">', 'px-wide') +
      '<p class="r28-cbwhen px-wide" data-r28when role="status"></p>' +
      '<div class="px-tools px-wide"><button type="submit" class="p-btn r28-big">Save callback</button><button type="button" class="p-btn is-ghost r28-big" data-r28cbx>Cancel</button></div></form>';
  }
  function cbCheck(form, st){
    const d = form.d.value, t = form.t.value, z = form.z.value; if (!d || !t) return null;
    const at = zonedToUtc(d, t, z), ch = window.CallHours && STATE_TZ[st] ? window.CallHours.check(st, at) : null;
    const theirs = fmtDay(at, { weekday:'short', month:'short', day:'numeric', timeZone:z }) + ', ' + fmtTime(at, z) + ' ' + zoneName(z);
    const mine = fmtDay(at, { weekday:'short', month:'short', day:'numeric', timeZone:CAIRO }) + ', ' + fmtTime(at, CAIRO) + ' Cairo';
    const bad = at < Date.now() - 60e3 ? 'That time has passed.' : ch && !ch.ok ? 'Not a legal hour to call ' + st + ': ' + ch.why + '.' : !ch && !PX.callable(z, at) ? 'Outside 8 AM to 9 PM their time.' : '';
    form.querySelector('[data-r28when]').innerHTML = '<b>Their time:</b> ' + esc(theirs) + '<br><b>Your time:</b> ' + esc(mine) + (bad ? '<br><span class="r28-bad">' + esc(bad) + '</span>' : '');
    return { at, bad };
  }

  // ======================================================================
  // L3: script and answers panel
  // ======================================================================
  const P = { lib:null, reb:null, method:'', q:'', tab:store('r28-tab') || 'script' };
  const strip = s => String(s || '').replace(/\*/g, '').trim();
  function parseLesson(row){
    const out = [], href = '/course/#/m/' + row.module + '/l/' + row.id, src = row.title || ('Lesson ' + row.id);
    String(row.body || '').split('\n').forEach(line => {
      let m = line.match(/^- \*\*(.+?)\*\*\s*\*Say this:\*\s*(.+)$/);
      if (m) { out.push({ q:strip(m[1]), a:strip(m[2]), href, src }); return; }
      m = line.match(/^\|\s*(".+?)\s*\|\s*(.+?)\s*\|\s*$/);
      if (m && !/^Objection$/i.test(m[1])) out.push({ q:strip(m[1]), a:strip(m[2]), href, src });
    });
    return out;
  }
  async function loadPanel(){
    if (P.lib && P.reb) return;
    const [lib, reb] = await Promise.all([safe(db().from('library_entries').select('id,kind,section,title,body,sort,lessons').eq('active', true).order('sort')), safe(db().rpc('call_rebuttals'))]);
    P.lib = lib.data || [];
    const rows = Array.isArray(reb.data) ? reb.data : [];
    P.reb = []; rows.filter(r => r.id === '10.2').forEach(r => { P.reb = P.reb.concat(parseLesson(r)); });
    const sys = rows.find(r => r.id === '10.1'); P.method = sys ? ({ href:'/course/#/m/' + sys.module + '/l/' + sys.id, title:sys.title }) : null;
    P.libObj = P.lib.filter(x => x.kind === 'objection');
  }
  const para = t => esc(t).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  function panelHtml(kind){
    const tabs = '<div class="px-tools r28-tabs" role="tablist">' + [['script', 'Script'], ['answers', 'Objection answers']].map(([k, l]) => '<button type="button" role="tab" class="p-btn' + (P.tab === k ? '' : ' is-ghost') + '" aria-selected="' + (P.tab === k) + '" data-r28tab="' + k + '">' + l + '</button>').join('') + '</div>';
    if (!P.lib) return tabs + PX.loading;
    if (P.tab === 'script') {
      const sc = P.lib.filter(x => x.kind === 'script');
      if (!sc.length) return tabs + empty('No script yet. Amr adds it in Scripts and objections.');
      // the opening that fits the list: land lists get the land opening first, house lists the FSBO opening
      const first = kind === 'house' ? /fsbo|house/i : /land/i;
      const sorted = sc.slice().sort((a, b) => (a.section === 'Opening' && b.section === 'Opening') ? (first.test(b.title) - first.test(a.title)) : 0);
      return tabs + '<div class="r28-script">' + sorted.map((x, i) => '<details class="r28-step"' + (i < 2 ? ' open' : '') + '><summary><small>' + esc(x.section) + '</small> ' + esc(x.title) + '</summary><p>' + para(x.body) + '</p></details>').join('') +
        '<p class="p-hint">From <a href="#library">Scripts and objections</a>. Say it your way; don’t read it word for word.</p></div>';
    }
    const q = P.q.toLowerCase().trim(), hit = x => !q || (x.q + ' ' + x.a).toLowerCase().includes(q);
    const les = P.reb.filter(hit), lib = (P.libObj || []).filter(x => !q || (x.title + ' ' + x.body).toLowerCase().includes(q));
    return tabs + '<input type="search" class="r28-find" data-r28find placeholder="What did the seller say?" value="' + esc(P.q) + '" aria-label="Find an answer">' +
      (P.method ? '<p class="p-hint">Every answer follows <a href="' + esc(P.method.href) + '" target="_blank" rel="noopener">' + esc(P.method.title) + '</a>: acknowledge, ask what they mean, answer the real concern, then move forward.</p>' : '') +
      '<div class="r28-answers">' + les.map(x => '<details class="r28-step"><summary>' + esc(x.q) + '</summary><p>' + esc(x.a) + '</p><small><a href="' + esc(x.href) + '" target="_blank" rel="noopener">From ' + esc(x.src) + '</a></small></details>').join('') +
      lib.map(x => '<details class="r28-step"><summary>' + esc(x.title) + '</summary><p>' + para(x.body) + '</p><small><a href="#library/e-' + x.id + '">From Scripts and objections</a></small></details>').join('') +
      (!les.length && !lib.length ? empty(q ? 'Nothing matches. Try one word, like “low” or “think”.' : 'No answers found.') : '') + '</div>';
  }

  // ======================================================================
  // L2: #queue, the calling queue
  // ======================================================================
  V.queue = { title:'Calling queue', sec:'everyone', async open(el, ok){
    const body = PX.page(el, 'Calls', 'Calling queue', 'One lead at a time from your lead lists: their local time, the script, and one tap for the outcome. Call only when the time shows green.');
    const [lr] = await Promise.all([safe(db().rpc('my_lead_lists')), load(true), acqInfo()]);
    if (!ok()) return;
    if (lr.error) { body.innerHTML = failed(lr.error); return; }
    const lists = Array.isArray(lr.data) ? lr.data : [];
    const S = { list:null, recs:[], skip:new Set(), cur:null, only:store('r28-only') !== '0', retry:store('r28-retry') === '1', cbs:[], mode:'lead', pending:null, panel:store('r28-panel') !== '0', done:0, msg:'' };
    const want = +((location.hash.split('/')[1]) || 0);

    function listPicker(){
      body.innerHTML = card('Pick a list', plural(lists.length, 'list'), lists.length ? lists.map(l => '<div class="p-row"><span><b>' + esc(l.name) + '</b><br><small>' + esc([[l.county, l.state].filter(Boolean).join(', '), num(l.rows) + ' to call', num(l.worked) + ' worked'].filter(Boolean).join(' · ')) + '</small></span>' +
        '<button type="button" class="p-btn r28-big" data-r28list="' + l.id + '">Start calling</button></div>').join('') : empty(isOwner() ? 'No lists are given to you. Add yourself as a rep on a list in Lead lists to call from it here.' : 'No lists yet. Amr gives you lists from his Lead lists page.')) +
        '<p class="p-hint">Callbacks you booked for a list come first when they’re due. <a href="#mylists">My lead lists</a> shows the whole list as a table.</p>';
    }
    async function openList(id){
      S.list = lists.find(x => x.id === id) || null; if (!S.list) return listPicker();
      body.innerHTML = PX.loading;
      let recs = [];
      for (let from = 0; ; from += 1000) { const x = await safe(db().from('lead_records').select('id,owner_name,phone,phone2,address,city,state,zip,county,outcome').eq('list_id', id).eq('dnc', false).eq('dup', false).order('id').range(from, from + 999)); recs = recs.concat(x.data || []); if (!x.data || x.data.length < 1000) break; }
      S.recs = recs; S.skip = new Set(); S.cur = null; S.done = 0;
      await loadCbs();
      if (!ok()) return;
      history.replaceState(null, '', '#queue/' + id);
      next(); loadPanel().then(() => { if (ok() && S.list) draw(); });
    }
    async function loadCbs(){
      const ids = S.recs.map(r => r.id); S.cbs = [];
      if (!ids.length) return;
      const c = await safe(db().from('callbacks').select('id,label,due_at,tz,state,note,lead_record_id').is('done_at', null).eq('user_id', T().user.id).not('lead_record_id', 'is', null).lte('due_at', new Date(Date.now() + 15 * 60e3).toISOString()).order('due_at'));
      const have = new Set(ids); S.cbs = (c.data || []).filter(x => have.has(x.lead_record_id));
    }
    const left = () => S.recs.filter(r => !r.outcome || (S.retry && /^(No answer|Left voicemail)$/.test(r.outcome)));
    function next(){
      const now = new Date(), pool = left().filter(r => !S.skip.has(r.id) && r.phone);
      let pick = S.only ? pool.find(r => { const t = timeFor(r.state || S.list.state, now); return !t.ch || t.ch.ok; }) : pool[0];
      S.cur = pick || null; S.mode = 'lead'; S.pending = null;
      draw();
    }
    function nextOpen(){
      const now = new Date(), pool = left().filter(r => !S.skip.has(r.id) && r.phone), states = [...new Set(pool.map(r => String(r.state || S.list.state || '').toUpperCase()).filter(Boolean))];
      const rows = states.map(s => ({ s, ch:window.CallHours ? window.CallHours.check(s, now) : null, n:pool.filter(r => String(r.state || S.list.state || '').toUpperCase() === s).length })).filter(x => x.ch);
      return rows.length ? '<ul class="r28-closed">' + rows.map(x => '<li><b>' + esc(x.s) + '</b> · ' + plural(x.n, 'lead') + ' · ' + esc(x.ch.time) + ' there · ' + esc(x.ch.why) + '</li>').join('') + '</ul>' : '';
    }
    function head(){
      const n = left().length;
      return '<div class="px-tools r28-top"><button type="button" class="p-btn is-ghost" data-r28lists>All my lists</button><span class="r28-left"><b>' + esc(S.list.name) + '</b> · ' + plural(n, 'lead') + ' left' + (S.done ? ' · ' + S.done + ' done now' : '') + '</span></div>' +
        '<div class="r28-opts"><label class="r17-check"><input type="checkbox" data-r28only' + (S.only ? ' checked' : '') + '> Only leads I can call now</label>' +
        '<label class="r17-check"><input type="checkbox" data-r28retry' + (S.retry ? ' checked' : '') + '> Call no-answers again</label>' +
        '<label class="r17-check"><input type="checkbox" data-r28panel' + (S.panel ? ' checked' : '') + '> Show script</label>' +
        '<label class="r17-check"><input type="checkbox" data-r28rec' + (store('r28-rec') !== '0' ? ' checked' : '') + '> I record my calls</label></div>' +
        (C.acq ? '<div id="r28Goal" class="r28-goalbox"></div>' : '');
    }
    function cbsHtml(){
      if (!S.cbs.length) return '';
      return card('Callbacks due', plural(S.cbs.length, 'callback'), S.cbs.map(c => {
        const due = new Date(c.due_at), late = due < Date.now();
        return '<div class="p-row"><span><b>' + esc(c.label) + '</b><br><small>' + esc(fmtTime(due, c.tz) + ' ' + zoneName(c.tz) + ' = ' + fmtTime(due, CAIRO) + ' Cairo' + (c.note ? ' · ' + c.note : '')) + '</small></span>' +
          pill(late ? 'Due now' : 'Soon', late ? 'no' : 'warn') + '<button type="button" class="p-btn r28-big" data-r28cbgo="' + c.lead_record_id + '" data-r28cbid="' + c.id + '">Open lead</button></div>';
      }).join(''));
    }
    function leadHtml(r){
      const now = new Date(), st = String(r.state || S.list.state || '').toUpperCase(), t = timeFor(st, now), blocked = t.ch ? !t.ch.ok : !!(t.tz && !PX.callable(t.tz, now));
      const prop = [r.address, r.city, st, r.zip].filter(Boolean).join(', ');
      const time = t.ch ? '<div class="r28-time ' + (t.ch.ok ? 'is-ok' : 'is-no') + '"><b>' + (t.ch.ok ? 'OK to call' : 'Don’t call now') + '</b><span>' + esc(t.ch.time) + ' their time · ' + esc(t.cairo) + ' Cairo</span><small>' + esc(t.ch.why) + '</small></div>'
        : '<div class="r28-time is-warn"><b>No state on this lead</b><span>Check the area code and their local time before you call. Your time: ' + esc(t.cairo) + ' Cairo</span></div>';
      const callBtn = (p, label, which) => p ? (blocked ? '<button type="button" class="p-btn r28-call" disabled aria-disabled="true">' + esc(label) + ' · blocked</button>'
        : '<a class="p-btn r28-call" href="' + esc(telOf(p)) + '" data-r28call="' + which + '">' + esc(label) + '<small>' + esc(phoneShow(p)) + '</small></a>') : '';
      const showOut = S.mode === 'outcome';
      return '<section class="p-card r28-lead"><div class="r28-who"><h2>' + esc(r.owner_name || 'Owner name missing') + '</h2><p>' + esc(prop || 'No address') + (r.county ? ' · ' + esc(r.county) + ' County' : '') + '</p>' +
        (r.outcome ? '<p class="p-hint">Last time: ' + esc(r.outcome) + '</p>' : '') + '</div>' + time + consentBox(st) +
        '<div class="r28-calls">' + callBtn(r.phone, 'Call', 1) + callBtn(r.phone2, 'Call phone 2', 2) + '</div>' +
        (showOut ? '' : '<div class="px-tools r28-row"><button type="button" class="p-btn is-ghost r28-big" data-r28log>Log outcome</button><button type="button" class="p-btn is-ghost r28-big" data-r28skip>Skip</button></div>') +
        (showOut ? outcomesHtml() : '') + (S.mode === 'callback' ? callbackForm(Object.assign({}, r, { state:st })) : '') +
        '<p class="p-hint" id="r28Msg" role="status">' + esc(S.msg) + '</p></section>';
    }
    function outcomesHtml(){
      return '<div class="r28-out" role="group" aria-label="How did the call go?"><p class="r28-out-h">How did the call go?</p><div class="r28-outgrid">' +
        OUTCOMES.map(o => '<button type="button" class="p-btn' + (/Do not call|Wrong number/.test(o) ? ' is-danger' : ' is-ghost') + ' r28-big" data-r28out="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div>' +
        (C.acq ? '<label class="r17-check"><input type="checkbox" data-r28offer> I made an offer on this call</label>' : '') +
        '<p class="p-hint">Do not call and Wrong number also add the number to the team’s do-not-call list.</p></div>';
    }
    function draw(){
      if (!S.list) return listPicker();
      const r = S.cur;
      const main = r ? leadHtml(r) : card('Nothing to call right now', '', (left().filter(x => x.phone).length ? '<p>Every lead left is outside legal calling hours right now.</p>' + nextOpen() + '<button type="button" class="p-btn is-ghost" data-r28recheck>Check again</button>' : empty('You’ve worked every lead on this list.')) +
        (S.skip.size ? '<button type="button" class="p-btn is-ghost" data-r28unskip>Bring back ' + plural(S.skip.size, 'skipped lead') + '</button>' : ''));
      body.innerHTML = head() + cbsHtml() + '<div class="r28-wrap' + (S.panel ? ' has-panel' : '') + '"><div class="r28-main">' + main + '</div>' +
        (S.panel ? '<aside class="p-card r28-panel" aria-label="Script and objection answers">' + panelHtml(S.list.kind) + '</aside>' : '') + '</div>';
      drawGoal($('r28Goal'));
      const form = body.querySelector('[data-r28cb]'); if (form && r) cbCheck(form, String(r.state || S.list.state || '').toUpperCase());
    }
    async function setOutcome(o){
      const r = S.cur; if (!r) return;
      const msg = t => { S.msg = t; const m = $('r28Msg'); if (m) m.textContent = t; };
      if (o === 'Callback') { S.mode = 'callback'; S.msg = ''; draw(); const d = body.querySelector('[data-r28cb] input[name=t]'); if (d) d.focus(); return; }
      msg('Saving…');
      const w = await safe(db().rpc('lead_record_outcome', { p_id:r.id, p_outcome:o }));
      if (w.error) return msg(errText(w, 'Couldn’t save. Check your connection and tap again.'));
      r.outcome = o;
      if (o === 'Do not call' && r.phone) await safe(db().rpc('dnc_add', { p_phone:r.phone, p_reason:'asked', p_note:'From the calling queue' }));
      if (o === 'Wrong number' && r.phone) await safe(db().rpc('dnc_add', { p_phone:r.phone, p_reason:'wrong_number', p_note:'From the calling queue' }));
      if (TALKED.has(o)) await logTap('conversation', S.list.id);
      if (o === 'Appointment set') await logTap('appointment', S.list.id);
      const off = body.querySelector('[data-r28offer]'); if (off && off.checked) await logTap('offer', S.list.id);
      S.done++; S.msg = 'Saved: ' + o + '.';
      next();
    }
    // L1: after the dialer, the outcome buttons open for that lead
    function back(){
      if (!S.pending || !document.body.contains(el) || document.visibilityState !== 'visible') return;
      if (S.pending.t && Date.now() - S.pending.t < 2500) return;
      const id = S.pending.id; S.pending = null;
      if (!S.cur || S.cur.id !== id) return;
      S.mode = 'outcome'; S.msg = ''; draw();
      const g = body.querySelector('.r28-out'); if (g) { g.scrollIntoView({ block:'center', behavior:'smooth' }); const b = g.querySelector('button'); if (b) b.focus({ preventScroll:true }); }
    }
    const onVis = () => { if (S.pending && document.visibilityState === 'hidden') S.pending.away = true; back(); };
    const onBlur = () => { if (S.pending) S.pending.away = true; };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('focus', onVis); window.addEventListener('blur', onBlur);
    const stop = setInterval(() => {
      if (!document.body.contains(el) || !ok()) { clearInterval(stop); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); window.removeEventListener('blur', onBlur); return; }
      if (S.list && S.mode === 'lead' && !S.pending) { const was = S.cur && S.cur.id; if (!S.cur) next(); else draw(); if (S.cur && S.cur.id !== was) return; }
    }, 60000);

    body.addEventListener('click', async e => {
      const t = e.target;
      const lb = t.closest('[data-r28list]'); if (lb) { openList(+lb.dataset.r28list); return; }
      if (t.closest('[data-r28lists]')) { S.list = null; history.replaceState(null, '', '#queue'); listPicker(); return; }
      const call = t.closest('[data-r28call]');
      if (call) {
        // L11: an all-party state asks once more before the dialer opens
        const st = String((S.cur && S.cur.state) || S.list.state || '').toUpperCase();
        if (consentFor(st) && !call.dataset.ok && store('r28-rec') !== '0') {
          e.preventDefault();
          const box = call.closest('.r28-lead').querySelector('.r28-consent'); if (box) { box.classList.add('is-ask'); box.scrollIntoView({ block:'center', behavior:'smooth' }); }
          call.dataset.ok = '1'; call.firstChild.textContent = 'I’ll say the line. Call now';
          return;
        }
        S.pending = { id:S.cur.id, t:Date.now(), away:false };
        logTap('dial', S.list.id);
        // a computer with no dialer set up never leaves the page: open the outcome buttons anyway after a few seconds
        const mine = S.pending;
        setTimeout(() => { if (S.pending === mine && !mine.away && document.visibilityState === 'visible') { mine.t = 0; back(); } }, 4000);
        return;   // the tel: link opens the dialer
      }
      if (t.closest('[data-r28log]')) { S.mode = 'outcome'; S.msg = ''; draw(); return; }
      if (t.closest('[data-r28skip]')) { if (S.cur) S.skip.add(S.cur.id); S.msg = ''; next(); return; }
      if (t.closest('[data-r28unskip]')) { S.skip.clear(); next(); return; }
      if (t.closest('[data-r28recheck]')) { next(); return; }
      const o = t.closest('[data-r28out]'); if (o) { o.disabled = true; await setOutcome(o.dataset.r28out); return; }
      if (t.closest('[data-r28cbx]')) { S.mode = 'outcome'; draw(); return; }
      const cg = t.closest('[data-r28cbgo]');
      if (cg) {
        const r = S.recs.find(x => x.id === +cg.dataset.r28cbgo); if (!r) return;
        await safe(db().from('callbacks').update({ done_at:new Date().toISOString() }).eq('id', +cg.dataset.r28cbid));
        S.cbs = S.cbs.filter(c => c.id !== +cg.dataset.r28cbid); S.cur = r; S.mode = 'lead'; S.msg = 'Callback opened. It’s marked done.'; draw(); return;
      }
      const tb = t.closest('[data-r28tab]'); if (tb) { P.tab = tb.dataset.r28tab; store('r28-tab', P.tab); const a = body.querySelector('.r28-panel'); if (a) a.innerHTML = panelHtml(S.list && S.list.kind); return; }
    });
    body.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-r28only]')) { S.only = t.checked; store('r28-only', t.checked ? '1' : '0'); next(); }
      else if (t.matches('[data-r28retry]')) { S.retry = t.checked; store('r28-retry', t.checked ? '1' : '0'); next(); }
      else if (t.matches('[data-r28rec]')) { store('r28-rec', t.checked ? '1' : '0'); draw(); }
      else if (t.matches('[data-r28panel]')) { S.panel = t.checked; store('r28-panel', t.checked ? '1' : '0'); draw(); }
    });
    body.addEventListener('input', e => {
      if (e.target.matches('[data-r28find]')) {
        P.q = e.target.value; const pos = e.target.selectionStart, a = body.querySelector('.r28-panel'); if (!a) return;
        a.innerHTML = panelHtml(S.list && S.list.kind); const i = a.querySelector('[data-r28find]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); }
        return;
      }
      const form = e.target.closest('[data-r28cb]'); if (form && S.cur) cbCheck(form, String(S.cur.state || S.list.state || '').toUpperCase());
    });
    body.addEventListener('submit', async e => {
      const form = e.target.closest('[data-r28cb]'); if (!form) return; e.preventDefault();
      const r = S.cur, st = String(r.state || S.list.state || '').toUpperCase(), c = cbCheck(form, st);
      const msg = t => { const m = $('r28Msg'); if (m) m.textContent = t; };
      if (!c) return msg('Pick a day and a time.');
      if (c.bad) return msg(c.bad + ' Pick another time.');
      const label = ((r.owner_name || 'Lead') + (r.address ? ', ' + r.address : '')).replace(/\d{3}\D?\d{3}\D?\d{4}/g, '').slice(0, 120);
      const x = await safe(db().from('callbacks').insert({ label, state:st || null, tz:form.z.value, due_at:c.at.toISOString(), note:form.n.value.trim() || null, lead_record_id:r.id, lead_list_id:S.list.id }));
      if (x.error) return msg(errText(x, 'Couldn’t save the callback. Try again.'));
      const w = await safe(db().rpc('lead_record_outcome', { p_id:r.id, p_outcome:'Callback' }));
      if (!w.error) r.outcome = 'Callback';
      await logTap('conversation', S.list.id);
      S.done++; S.msg = 'Callback saved for ' + fmtTime(c.at, form.z.value) + ' their time (' + fmtTime(c.at, CAIRO) + ' Cairo). You get a bell 10 minutes before.';
      next();
    });

    if (want && lists.some(l => l.id === want)) openList(want); else listPicker();
  }};

  // ======================================================================
  // #mylists: L1 outcome after the call, L4 blocked links outside legal hours, L11 consent marker, a queue button
  // ======================================================================
  const ml = V.mylists;
  if (ml && !ml.r28) {
    const open0 = ml.open;
    V.mylists = Object.assign({}, ml, { r28:true, async open(el, ok){
      await load();
      await open0.call(this, el, ok);
      if (!ok()) return;
      const body = el.querySelector('.px-body'); if (!body) return;
      let pending = null;
      const fix = () => {
        body.querySelectorAll('[data-openl]').forEach(b => { if (b.parentNode.querySelector('[data-r28q]')) return; b.insertAdjacentHTML('beforebegin', '<a class="p-btn is-ghost" data-r28q href="#queue/' + b.dataset.openl + '">Calling queue</a> '); });
        body.querySelectorAll('tbody tr').forEach(row => {
          if (row.dataset.r28) return; const cells = row.querySelectorAll('td'); if (cells.length < 5) return; row.dataset.r28 = '1';
          const closed = cells[3].querySelector('.p-pill.is-no'), st = ((cells[2].textContent.match(/,\s*([A-Z]{2})(?:,|\s|$)/) || [])[1]) || '';
          if (closed) cells[1].querySelectorAll('a[href^="tel:"]').forEach(a => { const s = document.createElement('span'); s.className = 'r28-blocked'; s.textContent = a.textContent; s.title = 'Outside legal calling hours'; a.replaceWith(s); });
          if (consentFor(st)) cells[3].insertAdjacentHTML('beforeend', '<br>' + pill('All-party consent', 'warn'));
        });
      };
      fix();
      const mo = new MutationObserver(() => { if (!document.body.contains(el)) { mo.disconnect(); return; } fix(); }); mo.observe(body, { childList:true, subtree:true });
      body.addEventListener('click', e => {
        const a = e.target.closest('a[href^="tel:"]'); if (!a) return;
        const row = a.closest('tr'), sel = row && row.querySelector('select[data-out]'); if (!sel) return;
        const st = ((row.querySelectorAll('td')[2] || {}).textContent || '').match(/,\s*([A-Z]{2})(?:,|\s|$)/);
        if (st && consentFor(st[1]) && store('r28-rec') !== '0' && !a.dataset.ok) { e.preventDefault(); a.dataset.ok = '1'; a.insertAdjacentHTML('afterend', consentBox(st[1]).replace('class="r28-consent"', 'class="r28-consent is-ask"') + '<small class="r28-again">Tap the number again to call.</small>'); return; }
        pending = { id:sel.dataset.out, t:Date.now() };
        logTap('dial', null);
      });
      const onBack = () => {
        if (!pending || document.visibilityState !== 'visible' || Date.now() - pending.t < 2500 || !document.body.contains(el)) return;
        const sel = body.querySelector('select[data-out="' + pending.id + '"]'); pending = null; if (!sel) return;
        const row = sel.closest('tr'); row.classList.add('r28-ask'); sel.scrollIntoView({ block:'center', behavior:'smooth' }); sel.focus({ preventScroll:true });
        if (!row.querySelector('.r28-askmsg')) sel.insertAdjacentHTML('beforebegin', '<b class="r28-askmsg">How did the call go?</b><br>');
      };
      document.addEventListener('visibilitychange', onBack); window.addEventListener('focus', onBack);
      body.addEventListener('change', e => {
        const s = e.target.closest('[data-out]'); if (!s) return;
        const row = s.closest('tr'); row.classList.remove('r28-ask'); const m = row.querySelector('.r28-askmsg'); if (m) { m.nextSibling && m.nextSibling.remove(); m.remove(); }
        if (TALKED.has(s.value)) logTap('conversation', null);
        if (s.value === 'Appointment set') logTap('appointment', null);
      });
      const gone = setInterval(() => { if (!document.body.contains(el)) { clearInterval(gone); document.removeEventListener('visibilitychange', onBack); window.removeEventListener('focus', onBack); } }, 30000);
    } });
  }

  // ======================================================================
  // #callhours: the recording consent states and the line to say (Amr edits, everyone reads)
  // ======================================================================
  const chv = V.callhours;
  if (chv && !chv.r28) {
    const open0 = chv.open;
    V.callhours = Object.assign({}, chv, { r28:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok()) return;
      const body = el.querySelector('.px-body'); if (!body) return;
      await load(true); if (!ok()) return;
      // beside the page body, not inside it: the hours table redraws its body every minute
      const owner = isOwner(), box = document.createElement('div'); box.id = 'r28Consent'; box.className = 'r28-after'; body.parentNode.appendChild(box);
      function draw(msg){
        const rows = (R.rows || []).filter(x => x.all_party);
        box.innerHTML = card('Recording consent', plural(rows.length, 'state') + ' need everyone’s consent',
          '<p>If you record calls, these states need every person on the call to agree. Before a call to one of them, the portal shows this line to say first:</p>' +
          (owner ? '<form class="px-form" data-r28line novalidate>' + f('Line to say', '<textarea name="line" rows="2" maxlength="300">' + esc(R.line) + '</textarea>', 'px-wide') + '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save the line</button></div></form>' : '<q class="r28-q">' + esc(R.line) + '</q>') +
          PX.table(['State', 'Note'].concat(owner ? [''] : []), rows.map(x => '<tr><td><b>' + esc(x.state) + '</b></td><td>' + esc(x.note || 'Attorney to confirm.') + '</td>' + (owner ? '<td><button type="button" class="p-btn is-ghost" data-r28rm="' + esc(x.state) + '">Remove</button></td>' : '') + '</tr>')) +
          (owner ? '<form class="px-form r17-row" data-r28add novalidate>' + f('Add a state', '<select name="st">' + opt('', 'Pick…') + PX.STATES.filter(s => !consentFor(s)).map(s => opt(s, s)).join('') + '</select>') + f('Note or law', '<input type="text" name="note" maxlength="160" placeholder="Attorney to confirm.">', 'px-wide') + '<div class="px-tools px-wide"><button type="submit" class="p-btn">Add</button></div></form>' : '') +
          '<p class="p-hint" id="r28cMsg" role="status">' + esc(msg || '') + '</p>' +
          '<p class="p-hint">Seeded Nov 19 2026 from public guides that don’t fully agree (Michigan and Oregon are disputed; Oregon phone calls are left out). Not legal advice: your attorney should confirm this list.</p>');
      }
      draw();
      if (!owner) return;
      box.addEventListener('submit', async e => {
        e.preventDefault();
        const fl = e.target.closest('[data-r28line]'), fa = e.target.closest('[data-r28add]');
        if (fl) { const v = fl.line.value.trim(); if (!v) return say('r28cMsg', 'Write the line first.');
          const x = await safe(db().from('call_settings').upsert({ key:'recording_line', value:v, updated_at:new Date().toISOString() }, { onConflict:'key' }));
          if (x.error) return say('r28cMsg', errText(x, 'Couldn’t save.')); R.line = v; draw('Saved.'); return; }
        if (fa) { const s = fa.st.value; if (!s) return say('r28cMsg', 'Pick a state.');
          const x = await safe(db().from('consent_states').upsert({ state:s, all_party:true, note:fa.note.value.trim() || 'Attorney to confirm.', updated_at:new Date().toISOString() }, { onConflict:'state' }));
          if (x.error) return say('r28cMsg', errText(x, 'Couldn’t save.')); await load(true); draw(s + ' added.'); }
      });
      box.addEventListener('click', async e => {
        const b = e.target.closest('[data-r28rm]'); if (!b) return;
        const x = await safe(db().from('consent_states').delete().eq('state', b.dataset.r28rm));
        if (x.error) return say('r28cMsg', errText(x, 'Couldn’t save.')); await load(true); draw(b.dataset.r28rm + ' removed.');
      });
    } });
  }

  // #callbacks: state rules loaded so the "Careful" check there uses them too
  addEventListener('hashchange', () => { if (/^#callbacks/.test(location.hash) && T().db && T().user) load(); });
  (function boot(n){ if (T().db && T().user) { if (/^#callbacks/.test(location.hash)) load(); return; } if (n < 40) setTimeout(() => boot(n + 1), 750); })(0);
})();
