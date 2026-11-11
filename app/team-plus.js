// Round 12: the rep's day, alerts in the menu, search, a start-here tour, hiring scorecards, recruiting numbers,
// a safe hand-over when someone leaves, and a person file (numbers month by month, one-to-one notes, documents).
//   Team home      "Start here" for new people, then "Today": tasks, callbacks and deal follow-ups due now
//   Menu           counts on Messages and Tasks; a search box at the top of the menu
//   #search        everything in one box: pages, people, tasks, handbook, scripts, deals
//   #applications  + interview scorecard, "Hire and invite", recruiting numbers
//   #offboarding   + hand over open tasks, callbacks and deals, then close the sign-in
//   #person/<id>   the person file (Amr only)
// The bell alerts for messages, tasks and late starts come from the database (triggers and a 5-minute check).
(function(){
  'use strict';
  const PX = window.PX;
  if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, fmtTime, plural, card, empty, failed, pill, f, opt, say, errText, table, tr } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const uid = () => (T().user || {}).id;
  const page = PX.page;
  const today = () => isoDay(new Date());
  const people = async () => { const r = await safe(db().from('members').select('user_id,name,email,active,role,created_at').order('name')); return r.data || []; };
  const row = (href, main, sub, right) => '<a class="p-row tp-row" href="' + esc(href) + '"><span class="tp-row-t"><b>' + esc(main) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + (right || '') + '</a>';
  const dealName = d => [d.kind === 'house' ? 'House' : d.kind === 'land' ? 'Land' : 'Deal', d.acreage ? d.acreage + ' acres' : '', d.county ? d.county + (/county$/i.test(d.county) ? '' : ' County') : '', d.state].filter(Boolean).join(', ');
  const daysAgo = at => Math.floor((Date.now() - new Date(at)) / 864e5);
  const later = (fn, ms) => new Promise(r => setTimeout(() => r(fn()), ms));

  // ======================================================================
  // Team home: Start here (first weeks) and Today
  // ======================================================================
  const TOUR_KEY = 'tour-hidden';
  async function tourHtml(){
    if (T().role !== 'member') return '';
    try { if (localStorage.getItem(TOUR_KEY) === '1') return ''; } catch(e) {}
    const me = uid();
    const [mem, hb, sh, live, les, lp, msg] = await Promise.all([
      safe(db().from('members').select('created_at').eq('user_id', me).maybeSingle()),
      safe(db().from('handbook_reads').select('page_id', { count:'exact', head:true }).eq('user_id', me)),
      safe(db().from('shifts').select('id', { count:'exact', head:true }).eq('user_id', me)),
      safe(db().from('live_status').select('user_id').eq('user_id', me).maybeSingle()),
      safe(db().from('course_item_done').select('item_id', { count:'exact', head:true }).eq('user_id', me)),
      safe(db().from('learn_progress').select('course', { count:'exact', head:true }).eq('user_id', me)),
      safe(db().from('portal_messages').select('id', { count:'exact', head:true }).eq('sender', me))
    ]);
    if (mem.data && daysAgo(mem.data.created_at) > 60) return '';
    let app = false; try { app = matchMedia('(display-mode: standalone)').matches || localStorage.getItem('tour-app') === '1'; } catch(e) {}
    const steps = [
      ['Read “How a shift works”', 'Two minutes in the Handbook', '#handbook', (hb.count || 0) > 0],
      ['Clock in for your first shift', 'From your home page, before your first dial', '#track', (sh.count || 0) > 0 || !!live.data],
      ['Open your first lesson', 'Your courses are in the Learning Hub', '/app/learn/', (les.count || 0) + (lp.count || 0) > 0],
      ['Say hello to Amr', 'Messages replaces WhatsApp for work', '#messages', (msg.count || 0) > 0],
      ['Put the portal on your phone', 'iPhone: Safari › Share › Add to Home Screen. Android: Chrome › menu › Install app', '#', app, 'app']
    ];
    const done = steps.filter(s => s[3]).length;
    if (done === steps.length) return '';
    return '<section class="p-card tp-tour" id="tpTour"><div class="p-card-head"><h2>Start here</h2><span>' + done + ' of ' + steps.length + ' done</span></div>' +
      '<div class="tp-tour-bar"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></div>' +
      steps.map((s, i) => '<a class="tp-step' + (s[3] ? ' is-done' : '') + '" href="' + s[2] + '"' + (s[4] ? ' data-tour="' + s[4] + '"' : '') + '><span class="tp-num">' + (s[3] ? '✓' : i + 1) + '</span><span class="tp-row-t"><b>' + esc(s[0]) + '</b><small>' + esc(s[1]) + '</small></span></a>').join('') +
      '<button type="button" class="p-btn is-ghost tp-hide" id="tpTourHide">Hide this</button></section>';
  }
  async function todayHtml(){
    const me = uid(), owner = isOwner(), now = new Date(), end = new Date(now); end.setHours(23, 59, 59, 999);
    let tq = db().from('portal_tasks').select('id,title,due_on,repeat').is('done_at', null).order('due_on', { ascending:true, nullsFirst:false }).limit(50);
    tq = owner ? tq.or('assigned_to.is.null,assigned_to.eq.' + me) : tq.eq('assigned_to', me);
    const [t, c, d] = await Promise.all([
      safe(tq),
      safe(db().from('callbacks').select('id,label,due_at,tz').is('done_at', null).eq('user_id', me).lte('due_at', end.toISOString()).order('due_at').limit(20)),
      owner ? Promise.resolve({ data:[] }) : safe(db().from('deals').select('id,kind,state,county,acreage,stage,follow_up,last_touch_at,result,closed_on').eq('owner', me).limit(300))
    ]);
    const tasks = (t.data || []).filter(x => !x.due_on || x.due_on <= today()).slice(0, 6);
    const cbs = c.data || [];
    const deals = (d.data || []).filter(x => !x.result && !x.closed_on && ((x.follow_up && x.follow_up <= today()) || (x.last_touch_at && daysAgo(x.last_touch_at) >= 5))).slice(0, 6);
    const n = tasks.length + cbs.length + deals.length;
    const rows = cbs.map(x => row('#callbacks', 'Call back: ' + x.label, fmtTime(x.due_at, x.tz) + ' their time · ' + fmtTime(x.due_at, 'Africa/Cairo') + ' Cairo', pill(new Date(x.due_at) < now ? 'Now' : 'Callback', new Date(x.due_at) < now ? 'no' : ''))) .join('') +
      tasks.map(x => row('#tasks', x.title, x.due_on ? (x.due_on < today() ? 'Late, was due ' + fmtDay(x.due_on, { month:'short', day:'numeric' }) : 'Due today') : 'No due date', pill('Task', x.due_on && x.due_on < today() ? 'no' : 'plain'))).join('') +
      deals.map(x => row('/app/deals/', dealName(x), x.follow_up && x.follow_up <= today() ? 'Follow-up due' + (x.follow_up < today() ? ' since ' + fmtDay(x.follow_up, { month:'short', day:'numeric' }) : ' today') : 'No touch in ' + daysAgo(x.last_touch_at) + ' days', pill('Deal', 'plain'))).join('');
    return card('Today', n ? [tasks.length && plural(tasks.length, 'task'), cbs.length && plural(cbs.length, 'callback'), deals.length && plural(deals.length, 'follow-up')].filter(Boolean).join(' · ') : 'All clear',
      n ? rows : empty('Nothing due right now. New tasks, callbacks and deal follow-ups show up here.'), 'tpToday');
  }
  if (window.PortalExtras && window.PortalExtras.home) {
    const orig = window.PortalExtras.home;
    window.PortalExtras.home = async function(dbx, el, ok){
      const p = orig.apply(this, arguments);
      if (el) {
        el.parentNode.querySelectorAll(':scope > .tp-home').forEach(x => x.remove());
        const box = document.createElement('div'); box.className = 'tp-home';
        el.parentNode.insertBefore(box, el);
        const [tour, todayCard] = await Promise.all([tourHtml().catch(() => ''), todayHtml().catch(() => '')]);
        if (ok()) { box.innerHTML = tour + todayCard; PX.widths(box); }
      }
      return p;
    };
  }
  document.addEventListener('click', e => {
    if (e.target.id === 'tpTourHide') { try { localStorage.setItem(TOUR_KEY, '1'); } catch(x) {} const t = $('tpTour'); if (t) t.remove(); }
    const a = e.target.closest('[data-tour="app"]');
    if (a) { e.preventDefault(); const b = $('installBtn'); if (b && !b.hidden) b.click(); try { localStorage.setItem('tour-app', '1'); } catch(x) {} a.classList.add('is-done'); a.querySelector('.tp-num').textContent = '✓'; }
  });

  // ======================================================================
  // Menu counts: unread messages and tasks due today
  // ======================================================================
  async function counts(){
    if (!T().db || !uid() || !T().role) return;
    const me = uid(), owner = isOwner();
    const [m, r] = await Promise.all([safe(db().from('portal_messages').select('thread,sender,created_at').order('created_at', { ascending:false }).limit(300)), safe(db().from('portal_message_reads').select('*'))]);
    if (!m.error) {
      const reads = {}; (r.data || []).forEach(x => reads[x.thread_key] = x.read_at);
      const n = (m.data || []).filter(x => x.sender !== me && (!reads[x.thread || 'team'] || x.created_at > reads[x.thread || 'team'])).length;
      const el = $('msgCnt'); if (el) { el.hidden = !n; el.textContent = n > 99 ? '99+' : n; }
    }
    let tq = db().from('portal_tasks').select('id', { count:'exact', head:true }).is('done_at', null).lte('due_on', today());
    tq = owner ? tq.or('assigned_to.is.null,assigned_to.eq.' + me) : tq.eq('assigned_to', me);
    const t = await safe(tq);
    const te = $('taskCnt'); if (te && !t.error) { te.hidden = !t.count; te.textContent = t.count; }
  }
  (function loop(){ counts().catch(() => {}); setTimeout(loop, 60000); })();
  addEventListener('hashchange', () => setTimeout(() => counts().catch(() => {}), 1500));
  setTimeout(() => counts().catch(() => {}), 4000);

  // ======================================================================
  // Search everything
  // ======================================================================
  let index = null;
  async function buildIndex(){
    const owner = isOwner(), out = [];
    document.querySelectorAll('#drawer .mi[href]').forEach(a => {
      const r = a.closest('.mi-row') || a; if (a.hidden || r.hidden) return;
      const t = (a.dataset.orig || [...a.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ')).trim();
      if (t) out.push({ kind:'Page', title:t, href:a.getAttribute('href') });
    });
    const [ppl, hb, lib, tk, dl] = await Promise.all([
      owner ? people() : Promise.resolve([]),
      safe(db().from('handbook_pages').select('id,title,body')),
      safe(db().from('library_entries').select('id,title,section,kind,body').eq('active', true).limit(500)),
      safe(db().from('portal_tasks').select('id,title,notes,due_on').is('done_at', null).limit(300)),
      safe(db().from('deals').select('id,kind,state,county,acreage,stage').limit(500))
    ]);
    ppl.forEach(p => out.push({ kind:'Person', title:p.name, sub:[p.email, p.active ? (p.role === 'manager' ? 'Manager' : 'Agent') : 'Access off'].filter(Boolean).join(' · '), href:'#person/' + p.user_id }));
    (hb.data || []).forEach(p => out.push({ kind:'Handbook', title:p.title, sub:(p.body || '').split('\n')[0], text:p.body, href:'#handbook/' + p.id }));
    (lib.data || []).forEach(e => out.push({ kind:'Script', title:e.title, sub:e.section, text:e.body, href:'#library' }));
    (tk.data || []).forEach(t => out.push({ kind:'Task', title:t.title, sub:t.due_on ? 'Due ' + fmtDay(t.due_on) : '', text:t.notes, href:'#tasks' }));
    (dl.data || []).forEach(d => out.push({ kind:'Deal', title:dealName(d), sub:d.stage || '', text:d.id, href:'/app/deals/' }));
    return out;
  }
  function find(q){
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || !index) return [];
    return index.map(x => {
      const hay = (x.title + ' ' + (x.sub || '') + ' ' + (x.text || '')).toLowerCase(), ti = x.title.toLowerCase();
      if (!words.every(w => hay.includes(w))) return null;
      return [x, (ti.startsWith(words[0]) ? 3 : 0) + words.filter(w => ti.includes(w)).length + (x.kind === 'Page' ? 1 : 0)];
    }).filter(Boolean).sort((a, b) => b[1] - a[1]).slice(0, 40).map(a => a[0]);
  }
  V.search = { title:'Search', sec:'everyone', async open(el, ok){
    const q0 = decodeURIComponent((location.hash.split('/')[1] || ''));
    el.innerHTML = '<div class="p-wrap px"><section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">Search</span><h1>Find anything</h1><p>Pages, people, tasks, handbook pages, scripts and deals.</p></div></section>' +
      '<div class="px-body"><input class="wk-find tp-q" id="tpQ" type="search" placeholder="Type to search" aria-label="Search the portal" value="' + esc(q0) + '"><div id="tpRes" role="list"></div></div></div>';
    $('tpQ').focus();
    if (!index) { $('tpRes').innerHTML = PX.loading; index = await buildIndex(); if (!ok()) return; }
    const draw = () => {
      const q = $('tpQ').value.trim(), res = find(q);
      $('tpRes').innerHTML = !q ? empty('Start typing. Try a name, “pay”, “callback” or a county.') : res.length ? '<div class="p-card tp-res">' + res.map(x => row(x.href, x.title, x.sub, '<span class="p-pill is-plain">' + esc(x.kind) + '</span>')).join('') + '</div>' : empty('Nothing found for “' + q + '”.');
    };
    draw();
    $('tpQ').addEventListener('input', () => { draw(); history.replaceState(null, '', '#search/' + encodeURIComponent($('tpQ').value.trim())); });
  }};
  // the box at the top of the menu
  (function menuBox(){
    const d = $('drawer'); if (!d || $('tpMenuQ')) return;
    const who = d.querySelector('.who');
    const fm = document.createElement('form'); fm.className = 'tp-menu-q'; fm.setAttribute('role', 'search');
    fm.innerHTML = '<input id="tpMenuQ" type="search" placeholder="Search the portal" aria-label="Search the portal">';
    (who || d.firstChild).after(fm);
    fm.addEventListener('submit', e => { e.preventDefault(); index = null; location.hash = '#search/' + encodeURIComponent($('tpMenuQ').value.trim()); $('tpMenuQ').value = ''; });
  })();

  // ======================================================================
  // Hiring: interview scorecard, hire and invite, recruiting numbers
  // ======================================================================
  const SCORE = [['english', 'English clarity on the phone'], ['objection', 'Handles “not interested”'], ['punctual', 'On time for US hours'], ['coachable', 'Coachable in the mock call'], ['energy', 'Voice and energy']];
  const sourceOf = a => a.source || (a.referred_by ? 'Referral' : 'Join page');
  function scoreHtml(a){
    const s = a.scores || {}, total = SCORE.reduce((n, [k]) => n + (+s[k] || 0), 0), any = SCORE.some(([k]) => s[k]);
    return '<div class="tp-score" data-apid="' + a.id + '"><h3 class="px-h3">Interview scorecard' + (any ? ' · <b>' + total + ' of ' + SCORE.length * 5 + '</b>' : '') + (a.interviewed_at ? ' · ' + esc(fmtDay(a.interviewed_at, { month:'short', day:'numeric' })) : '') + '</h3>' +
      '<div class="tp-score-g">' + SCORE.map(([k, label]) => '<label class="sc-f">' + esc(label) + '<select data-sc="' + k + '">' + opt('', '–') + [1, 2, 3, 4, 5].map(v => opt(v, v + ' of 5', +s[k] === v)).join('') + '</select></label>').join('') + '</div>' +
      f('Interview notes', '<textarea data-scnote rows="2" maxlength="2000">' + esc(s.note || '') + '</textarea>', 'px-wide') +
      '<div class="wk-row"><button type="button" class="p-btn is-ghost" data-scsave>Save scorecard</button>' +
      (a.status === 'hired' ? pill('Hired', 'ok') : '<button type="button" class="p-btn" data-hire>Hire and invite to the portal</button>') + '<span class="p-empty" data-scmsg role="status"></span></div></div>';
  }
  async function recruiting(list){
    const [ppl, ob] = await Promise.all([people(), safe(db().from('offboardings').select('user_id,last_day'))]);
    const byEmail = {}; ppl.forEach(p => { if (p.email) byEmail[p.email.toLowerCase()] = p; });
    const left = {}; (ob.data || []).forEach(o => left[o.user_id] = o.last_day);
    const since = Date.now() - 90 * 864e5, recent = list.filter(a => new Date(a.created_at) >= since);
    const interviewed = a => !!a.interviewed_at || ['interview', 'hired'].includes(a.status);
    const stayed = a => { const m = a.email && byEmail[a.email.toLowerCase()]; if (!m) return null; const start = new Date(m.created_at), end = left[m.user_id] ? new Date(left[m.user_id] + 'T12:00') : (m.active ? new Date() : null); return end ? (end - start) / 864e5 >= 30 : false; };
    const tiles = [[recent.length, 'applied (90 days)'], [recent.filter(interviewed).length, 'interviewed'], [recent.filter(a => a.status === 'hired').length, 'hired'],
      [recent.length ? Math.round(recent.filter(a => a.status === 'hired').length / recent.length * 100) + '%' : '–', 'hire rate']];
    const src = {}; list.forEach(a => { const k = sourceOf(a), o = src[k] || (src[k] = { n:0, hired:0, stayed:0, known:0 }); o.n++; if (a.status === 'hired') { o.hired++; const s = stayed(a); if (s != null) { o.known++; if (s) o.stayed++; } } });
    return card('Recruiting numbers', 'All time by source', '<div class="px-tiles">' + tiles.map(([v, l]) => '<div class="px-tile"><b>' + esc(v) + '</b>' + esc(l) + '</div>').join('') + '</div>' +
      table(['Source', 'Applied', 'Hired', 'Stayed 30+ days'], Object.entries(src).sort((a, b) => b[1].n - a[1].n).map(([k, o]) => tr([esc(k), o.n, o.hired, o.known ? o.stayed + ' of ' + o.known : '–']))));
  }
  if (V.applications) {
    const orig = V.applications.open;
    V.applications.open = async function(el, ok){
      await orig.call(this, el, ok);
      if (!ok()) return;
      const r = await safe(db().from('job_applications').select('*').order('created_at', { ascending:false }).limit(500));
      if (!ok() || r.error) return;
      const list = r.data || [], byId = {}; list.forEach(a => byId[a.id] = a);
      el.querySelectorAll('[data-ap]').forEach(s => { const a = byId[+s.dataset.ap], form = s.closest('.px-form'); if (a && form && !form.parentNode.querySelector('.tp-score')) form.insertAdjacentHTML('afterend', scoreHtml(a)); });
      const body = el.querySelector('.px-body');
      if (body) body.insertAdjacentHTML('afterbegin', await recruiting(list).catch(() => ''));
      el.addEventListener('click', async e => {
        const box = e.target.closest('.tp-score'); if (!box) return;
        const a = byId[+box.dataset.apid]; if (!a) return;
        const msg = t => { const m = box.querySelector('[data-scmsg]'); if (m) m.textContent = t; };
        const collect = () => { const s = { note:box.querySelector('[data-scnote]').value.trim() || null }; box.querySelectorAll('[data-sc]').forEach(x => { if (x.value) s[x.dataset.sc] = +x.value; }); return s; };
        if (e.target.closest('[data-scsave]')) {
          const scores = collect(), patch = { scores, interviewed_at:a.interviewed_at || new Date().toISOString(), source:sourceOf(a) };
          if (['new', 'shortlisted'].includes(a.status)) patch.status = 'interview';
          const x = await safe(db().from('job_applications').update(patch).eq('id', a.id));
          if (x.error) return msg(errText(x, 'Couldn’t save. Try again.'));
          Object.assign(a, patch); msg('Saved.');
          const st = el.querySelector('[data-ap="' + a.id + '"]'); if (st && patch.status) st.value = patch.status;
        }
        if (e.target.closest('[data-hire]')) {
          const x = await safe(db().from('job_applications').update({ status:'hired', scores:collect(), source:sourceOf(a), interviewed_at:a.interviewed_at || new Date().toISOString() }).eq('id', a.id));
          if (x.error) return msg(errText(x, 'Couldn’t save. Try again.'));
          try { sessionStorage.setItem('invite-prefill', JSON.stringify({ name:a.name, email:a.email })); } catch(err) {}
          location.hash = '#people';
        }
      });
    };
  }
  // Invite and access: fill in the invite for someone just hired. Onboarding (checklist and required lessons) starts with their first sign-in.
  function prefillInvite(){
    let p = null; try { p = JSON.parse(sessionStorage.getItem('invite-prefill') || 'null'); } catch(e) {}
    if (!p || location.hash.split('/')[0] !== '#people') return;
    let tries = 0;
    (function go(){
      const btn = $('ppInviteBtn'), name = $('ppInvName');
      if (!btn) { if (++tries < 30) setTimeout(go, 300); return; }
      if (!name || name.offsetParent === null) btn.click();
      setTimeout(() => { if ($('ppInvName')) $('ppInvName').value = p.name || ''; if ($('ppInvEmail')) $('ppInvEmail').value = p.email || ''; try { sessionStorage.removeItem('invite-prefill'); } catch(e) {} T().toast && T().toast('Invite filled in for ' + p.name + '. Pick their company and send it.'); }, 200);
    })();
  }
  addEventListener('hashchange', prefillInvite); setTimeout(prefillInvite, 1500);

  // ======================================================================
  // Offboarding: hand over open work, then close the sign-in
  // ======================================================================
  if (V.offboarding) {
    const orig = V.offboarding.open;
    V.offboarding.open = async function(el, ok){
      await orig.call(this, el, ok);
      if (!ok()) return;
      const ppl = (await people()).filter(p => p.active);
      const body = el.querySelector('.px-body'); if (!body || !ok()) return;
      body.insertAdjacentHTML('afterbegin', card('Hand over and close access', 'When someone leaves',
        '<p class="tp-note">Moves their open tasks, callbacks and deals to someone else in one step. Their shifts, notes and history stay. Close the sign-in last, after the exit survey.</p>' +
        '<div class="px-form"><label class="sc-f">Who is leaving<select id="hoFrom">' + opt('', 'Pick a person') + ppl.map(p => opt(p.user_id, p.name)).join('') + '</select></label>' +
        '<label class="sc-f">Who takes over<select id="hoTo">' + opt('', 'Pick a person') + ppl.map(p => opt(p.user_id, p.name)).join('') + '</select></label>' +
        '<div class="wk-row px-wide"><button type="button" class="p-btn" id="hoGo">Hand over open work</button><button type="button" class="p-btn is-danger" id="hoClose">Close their sign-in</button></div><p class="p-empty" id="hoMsg" role="status"></p></div>'));
      $('hoGo').addEventListener('click', async () => {
        const from = $('hoFrom').value, to = $('hoTo').value;
        if (!from || !to || from === to) return say('hoMsg', 'Pick who is leaving and someone else to take over.');
        say('hoMsg', 'Handing over…');
        const x = await safe(db().rpc('portal_hand_over', { p_from:from, p_to:to }));
        if (x.error) return say('hoMsg', errText(x, 'Couldn’t hand over. Try again.'));
        const d = x.data || {}; say('hoMsg', 'Done: ' + plural(d.tasks || 0, 'task') + ', ' + plural(d.callbacks || 0, 'callback') + ' and ' + plural(d.deals || 0, 'deal') + ' moved.');
      });
      $('hoClose').addEventListener('click', async () => {
        const from = $('hoFrom').value, p = ppl.find(x => x.user_id === from); if (!p) return say('hoMsg', 'Pick who is leaving first.');
        const yes = window.ask ? await window.ask({ title:'Close ' + p.name + '’s sign-in?', msg:'They won’t be able to open the portal. Their shifts and history stay. You can turn it back on from Invite and access.', ok:'Close sign-in', cancel:'Keep it', danger:true }) : confirm('Close ' + p.name + '’s sign-in?');
        if (!yes) return;
        const r = await T().callAccess({ action:'remove', user_id:p.user_id });
        say('hoMsg', r && r.error ? r.error : p.name + '’s sign-in is closed.');
      });
    };
  }

  // ======================================================================
  // Person file (Amr): month by month, one-to-one notes, documents
  // ======================================================================
  const monday = () => { const d = new Date(); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return isoDay(d); };
  const monthName = k => { const [y, m] = k.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month:'short', year:'numeric' }); };
  const DOCK = { agreement:'Agreement', offer:'Offer letter', id:'ID', tax:'Tax form', other:'Other' };
  V.person = { title:'Person file', sec:'owner', async open(el, ok){
    const id = decodeURIComponent(location.hash.split('/')[1] || '');
    const ppl = await people(); if (!ok()) return;
    const p = ppl.find(x => x.user_id === id);
    if (!p) {
      const body = page(el, 'People', 'Person files', 'Pick someone to see their numbers month by month, your one-to-one notes and their documents.');
      body.innerHTML = '<div class="p-card tp-res">' + ppl.map(x => row('#person/' + x.user_id, x.name, (x.active ? (x.role === 'manager' ? 'Manager' : 'Agent') : 'Access off') + ' · joined ' + fmtDay(x.created_at, { month:'short', year:'numeric' }))).join('') + '</div>';
      return;
    }
    const body = page(el, 'Person file', p.name, esc([p.email, p.active ? (p.role === 'manager' ? 'Manager' : 'Agent') : 'Access off', 'joined ' + fmtDay(p.created_at, { month:'short', day:'numeric', year:'numeric' })].filter(Boolean).join(' · ')));
    const wk = monday();
    const [mo, oo, docs] = await Promise.all([safe(db().rpc('portal_person_months', { p_user:id, p_months:6 })), safe(db().from('one_on_ones').select('*').eq('user_id', id).order('week', { ascending:false }).limit(52)), safe(db().from('person_docs').select('*').eq('user_id', id).order('created_at', { ascending:false }))]);
    if (!ok()) return;
    if (mo.error) { body.innerHTML = failed(mo.error); return; }
    const months = mo.data || [], cur = (oo.data || []).find(x => x.week === wk) || {}, past = (oo.data || []).filter(x => x.week !== wk);
    const rate = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
    body.innerHTML = '<div class="wk-row tp-links"><a class="p-btn is-ghost" href="#people/' + esc(id) + '">Access and role</a><a class="p-btn is-ghost" href="#team/' + encodeURIComponent(p.name) + '">Hours and pay</a><a class="p-btn is-ghost" href="#messages/' + esc(id) + '">Message ' + esc(p.name.split(' ')[0]) + '</a></div>' +
      card('Month by month', 'Last 6 months', table(['Month', 'Shifts', 'Hours', 'Dials', 'Conv.', 'Offers', 'Appts', 'Appt rate', 'Late starts', 'Lessons', 'Call score'],
        months.map(m => tr([esc(monthName(m.month)), m.shifts, m.hours, m.dials, m.conversations, m.offers, m.appointments, rate(m.appointments, m.conversations), m.late ? '<b class="tp-bad">' + m.late + '</b>' : '0', m.lessons, m.score != null ? m.score : (m.scored ? m.scored + ' scored' : '–')])))) +
      '<div class="wk-two"><div>' + card('One-to-one this week', 'Week of ' + fmtDay(wk, { month:'short', day:'numeric' }),
        '<form class="px-form" id="ooForm" novalidate>' + f('What went well', '<textarea id="ooWins" rows="3" maxlength="4000">' + esc(cur.wins || '') + '</textarea>', 'px-wide') +
        f('What to work on', '<textarea id="ooWork" rows="3" maxlength="4000">' + esc(cur.work_on || '') + '</textarea>', 'px-wide') +
        f('What we agreed', '<textarea id="ooAgreed" rows="3" maxlength="4000">' + esc(cur.agreed || '') + '</textarea>', 'px-wide') +
        f('Private note (only you)', '<textarea id="ooPriv" rows="2" maxlength="4000">' + esc(cur.private_note || '') + '</textarea>', 'px-wide') +
        '<div class="wk-row px-wide"><button class="p-btn" type="submit">Save notes</button><label class="px-check"><input type="checkbox" id="ooTask"> Also give ' + esc(p.name.split(' ')[0]) + ' a task with what we agreed</label></div><p class="p-empty" id="ooMsg" role="status"></p></form>') +
        card('Earlier one-to-ones', String(past.length), past.length ? past.map(x => '<details class="tp-oo"><summary>Week of ' + esc(fmtDay(x.week, { month:'short', day:'numeric', year:'numeric' })) + '</summary>' +
          [['Went well', x.wins], ['Work on', x.work_on], ['Agreed', x.agreed], ['Private', x.private_note]].filter(y => y[1]).map(y => '<p><b>' + y[0] + ':</b> ' + esc(y[1]) + '</p>').join('') + '</details>').join('') : empty('Notes you save each week build up here.')) +
      '</div><div>' + card('Documents', plural((docs.data || []).length, 'file'),
        '<form class="px-form" id="pdForm" novalidate>' + f('Kind', '<select id="pdKind">' + Object.entries(DOCK).map(([k, v]) => opt(k, v)).join('') + '</select>') +
        f('Name', '<input type="text" id="pdTitle" maxlength="200" placeholder="e.g. Signed contractor agreement">') + f('File (up to 25 MB)', '<input type="file" id="pdFile">', 'px-wide') +
        '<button class="p-btn" type="submit">Upload</button><p class="p-empty" id="pdMsg" role="status"></p></form>' +
        ((docs.data || []).length ? (docs.data || []).map(d => '<div class="tp-doc"><span class="tp-row-t"><b>' + esc(d.title) + '</b><small>' + esc(DOCK[d.kind] || 'Other') + ' · ' + esc(fmtDay(d.created_at, { month:'short', day:'numeric', year:'numeric' })) + (d.size_bytes ? ' · ' + Math.max(1, Math.round(d.size_bytes / 1024)) + ' KB' : '') + '</small></span>' +
          '<button type="button" class="p-btn is-ghost" data-pdopen="' + d.id + '">Open</button><button type="button" class="p-btn is-ghost" data-pddel="' + d.id + '">Delete</button></div>').join('') : empty('Agreements, ID copies and offer letters live here. Only you can see them.')) +
        '<p class="tp-note">Files are private to you. Contracts are kept for your records; this is not legal advice.</p>') + '</div></div>';
    const reload = () => V.person.open(el, ok);
    $('ooForm').addEventListener('submit', async e => {
      e.preventDefault(); say('ooMsg', 'Saving…');
      const rowv = { user_id:id, week:wk, wins:$('ooWins').value.trim() || null, work_on:$('ooWork').value.trim() || null, agreed:$('ooAgreed').value.trim() || null, private_note:$('ooPriv').value.trim() || null, updated_at:new Date().toISOString() };
      const x = await safe(db().from('one_on_ones').upsert(rowv, { onConflict:'user_id,week' }));
      if (x.error) return say('ooMsg', errText(x, 'Couldn’t save. Try again.'));
      if ($('ooTask').checked && rowv.agreed) { const d = new Date(); d.setDate(d.getDate() + 7); await safe(db().from('portal_tasks').insert({ title:('From our one-to-one: ' + rowv.agreed).slice(0, 300), assigned_to:id, created_by:uid(), due_on:isoDay(d) })); }
      say('ooMsg', 'Saved.');
    });
    $('pdForm').addEventListener('submit', async e => {
      e.preventDefault();
      const file = $('pdFile').files[0], title = $('pdTitle').value.trim() || (file && file.name);
      if (!file) return say('pdMsg', 'Pick a file first.');
      if (file.size > 25 * 1024 * 1024) return say('pdMsg', 'That file is over 25 MB.');
      say('pdMsg', 'Uploading…');
      const path = id + '/' + Date.now() + '-' + file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
      const up = await db().storage.from('people-docs').upload(path, file, { contentType:file.type || 'application/octet-stream', upsert:false });
      if (up.error) return say('pdMsg', 'Couldn’t upload: ' + (up.error.message || 'try again.'));
      const x = await safe(db().from('person_docs').insert({ user_id:id, kind:$('pdKind').value, title, path, size_bytes:file.size }));
      if (x.error) { await db().storage.from('people-docs').remove([path]); return say('pdMsg', errText(x, 'Couldn’t save it. Try again.')); }
      reload();
    });
    body.addEventListener('click', async e => {
      const o = e.target.closest('[data-pdopen]'), dl = e.target.closest('[data-pddel]');
      const d = (docs.data || []).find(x => x.id === +((o || dl || {}).dataset || {})[o ? 'pdopen' : 'pddel']);
      if (o && d) { const s = await db().storage.from('people-docs').createSignedUrl(d.path, 300); if (s.data) window.open(s.data.signedUrl, '_blank', 'noopener'); }
      if (dl && d) { if (dl.dataset.sure !== '1') { dl.dataset.sure = '1'; dl.textContent = 'Sure?'; return; } await db().storage.from('people-docs').remove([d.path]); await safe(db().from('person_docs').delete().eq('id', d.id)); reload(); }
    });
  }};
})();
