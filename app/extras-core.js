// Portal batch (Nov 9): shared helpers, the page registry, the team's own pages and the extra Team home cards.
//   Team pages:  #schedule (my shifts, time off)  #coaching (tips from Amr)  #mymonth (hours, calls, pay)
//                #referrals (bring someone in, $25)  #whatsnew (what changed)  #exit (exit survey, only when leaving)
//   Home cards:  coaching not read yet, call of the week, callbacks at the seller's local time, what's new
// Amr's versions of #schedule, #coaching, #referrals and #whatsnew, and his own pages, are in extras-admin.js.
// Every page registers in window.PortalViews; app.js routes to it and portal-home.js draws it in #pView.
// Database: supabase/migrations/20261109_portal_batch.sql (tables, rules and the portal_* functions used here).
(function(){
  'use strict';
  const T = () => window.TalentsApp || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const safe = p => Promise.resolve(p).then(r => r || {}, e => ({ error:e }));
  const isOwner = () => T().role === 'owner';
  const pad = n => String(n).padStart(2, '0');
  const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fmtDay = (d, o) => { try { return new Date(String(d).length === 10 ? d + 'T12:00' : d).toLocaleDateString('en-US', o || { weekday:'short', month:'short', day:'numeric' }); } catch(e) { return ''; } };
  const fmtTime = (d, tz) => { try { return new Date(d).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:tz || undefined }); } catch(e) { return ''; } };
  const usd = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const num = n => (Number(n) || 0).toLocaleString('en-US');
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 + '%' : '–';
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const hero = (kick, title, sub, right) => '<section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">' + esc(kick) + '</span><h1>' + esc(title) + '</h1>' +
    (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (right || '') + '</section>';
  const card = (title, kick, body, id) => '<section class="p-card"' + (id ? ' id="' + id + '"' : '') + '><div class="p-card-head"><h2>' + esc(title) + '</h2><span>' + (kick || '') + '</span></div>' + body + '</section>';
  const empty = t => '<p class="p-empty">' + esc(t) + '</p>';
  const loading = '<p class="p-loading">Loading…</p>';
  const failed = (e) => '<p class="p-card p-empty">' + (/Not allowed/.test((e && e.message) || '') ? 'This page needs your authenticator code. Sign in again with it.' : /does not exist|not find|schema cache/i.test((e && e.message) || '') ? 'This part isn’t set up in the database yet.' : 'Couldn’t load this. Check your connection and try again.') + '</p>';
  const pill = (t, kind) => '<span class="p-pill' + (kind ? ' is-' + kind : '') + '">' + esc(t) + '</span>';
  const f = (label, input, cls) => '<label class="sc-f' + (cls ? ' ' + cls : '') + '">' + esc(label) + input + '</label>';
  const opt = (v, t, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
  const table = (heads, rows) => '<div class="p-tablewrap"><table class="p-table px-table"><thead><tr>' + heads.map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  const tr = cells => '<tr>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
  // Bars: widths are set by script after drawing (the app's rules allow no style="" attributes)
  const bar = (v, max) => '<span class="px-bar"><i data-w="' + (max ? Math.max(2, Math.round(v / max * 100)) : 0) + '"></i></span>';
  const widths = el => el.querySelectorAll('.px-bar i[data-w]').forEach(i => { i.style.width = i.dataset.w + '%'; });
  const say = (id, t) => { const m = $(id); if (m) m.textContent = t; };
  const errText = (r, fallback) => { const m = (r && r.error && r.error.message) || ''; return /Not allowed/.test(m) ? 'Not allowed. Sign in again with your authenticator code.' : (m && !/fetch|network/i.test(m) && m.length < 140 ? m : fallback); };
  // US time zones a seller can be in, and which states use them (the main zone for split states)
  const ZONES = [['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii']];
  const STATE_TZ = {};
  ('CT DE DC FL GA IN KY ME MD MA MI NH NJ NY NC OH PA RI SC VT VA WV').split(' ').forEach(s => STATE_TZ[s] = 'America/New_York');
  ('AL AR IL IA KS LA MN MS MO NE ND OK SD TN TX WI').split(' ').forEach(s => STATE_TZ[s] = 'America/Chicago');
  ('CO ID MT NM UT WY').split(' ').forEach(s => STATE_TZ[s] = 'America/Denver');
  STATE_TZ.AZ = 'America/Phoenix'; ['CA', 'NV', 'OR', 'WA'].forEach(s => STATE_TZ[s] = 'America/Los_Angeles'); STATE_TZ.AK = 'America/Anchorage'; STATE_TZ.HI = 'Pacific/Honolulu';
  const STATES = Object.keys(STATE_TZ).sort();
  // A wall-clock time in a zone → the real moment (for "call at 3 pm their time")
  function zonedToUtc(dateStr, timeStr, tz){
    const [y, mo, d] = dateStr.split('-').map(Number), [h, mi] = timeStr.split(':').map(Number);
    let guess = Date.UTC(y, mo - 1, d, h, mi);
    for (let i = 0; i < 2; i++) {
      const p = new Intl.DateTimeFormat('en-US', { timeZone:tz, hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).formatToParts(new Date(guess));
      const g = k => +p.find(x => x.type === k).value;
      const seen = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
      guess += Date.UTC(y, mo - 1, d, h, mi) - seen;
    }
    return new Date(guess);
  }
  // Is it a fair hour to call (8 am to 9 pm) where the seller is?
  const localHour = (tz, at) => +new Intl.DateTimeFormat('en-US', { timeZone:tz, hour:'numeric', hourCycle:'h23' }).format(at || new Date()) % 24;
  const callable = (tz, at) => { const h = localHour(tz, at); return h >= 8 && h < 21; };

  const PX = window.PX = { T, $, esc, safe, isOwner, isoDay, fmtDay, fmtTime, usd, num, pct, plural, hero, card, empty, loading, failed, pill, f, opt, table, tr, bar, widths, say, errText,
    ZONES, STATE_TZ, STATES, zonedToUtc, callable, localHour, pad };
  // Pages: { title, sec, open(el, isCurrent) }. sec: 'owner' (Amr), 'everyone' (Amr and the team), 'member' (the team only)
  const V = window.PortalViews = window.PortalViews || {};
  const page = (el, kick, title, sub) => { el.innerHTML = '<div class="p-wrap px">' + hero(kick, title, sub) + '<div class="px-body">' + loading + '</div></div>'; return el.querySelector('.px-body'); };
  PX.page = page;

  // ======================================================================
  // My month: hours, calls and pay so far, and where the month is heading
  // ======================================================================
  V.mymonth = { title:'My month', sec:'member', async open(el, ok){
    const body = page(el, 'You', 'My month', 'Your hours, calls and pay this month. Numbers update when a shift is saved.');
    const r = await safe(T().db.rpc('portal_my_month'));
    if (!ok()) return;
    if (r.error || !r.data) { body.innerHTML = failed(r.error); return; }
    const m = r.data, today = new Date(m.today + 'T12:00'), start = new Date(m.month + 'T12:00');
    const daysIn = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(), dayNo = today.getDate();
    const pace = dayNo ? m.earned / dayNo * daysIn : 0;
    const projected = m.scheduled_hours_left > 0 ? m.earned + m.scheduled_hours_left * m.rate : pace;
    const lm = m.last_month || {};
    const tile = (v, label, sub) => '<div class="px-tile"><b>' + v + '</b><span>' + esc(label) + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
    body.innerHTML =
      '<div class="px-tiles">' +
        tile(usd(m.earned), 'earned so far', usd(m.paid) + ' paid · ' + usd(m.earned - m.paid) + ' to come') +
        tile(usd(projected), 'heading for this month', m.scheduled_hours_left > 0 ? esc(m.scheduled_hours_left) + ' scheduled hours left at ' + usd(m.rate) + '/h' : 'at your pace so far') +
        tile(esc(m.hours) + ' h', 'worked', plural(m.shifts, 'shift') + ' on ' + plural(m.days, 'day') + (lm.hours != null ? ' · last month ' + esc(lm.hours) + ' h' : '')) +
        tile(num(m.dials), 'dials', plural(+m.conversations, 'conversation') + ' · ' + plural(+m.appointments, 'appointment')) +
      '</div>' +
      card('Your calls this month', fmtDay(m.month, { month:'long', year:'numeric' }),
        '<div class="px-funnel">' + [['Dials', m.dials], ['Conversations', m.conversations], ['Offers', m.offers], ['Appointments', m.appointments]].map(([k, v], i, a) =>
          '<div class="px-frow"><span>' + esc(k) + '</span>' + bar(v, a[0][1] || 1) + '<b>' + num(v) + '</b><small>' + (i ? pct(v, a[i - 1][1]) + ' of ' + a[i - 1][0].toLowerCase() : '') + '</small></div>').join('') + '</div>') +
      ((+m.commissions || +m.referrals) ? card('Extra this month', '', '<div class="p-row"><span>Commissions</span><b>' + usd(m.commissions) + '</b></div><div class="p-row"><span>Referral bonuses</span><b>' + usd(m.referrals) + '</b></div>') : '') +
      '<p class="p-empty">Pay is your hours times your rate (' + usd(m.rate) + '/h). Amr checks every shift before it is paid, so the final payslip can differ a little.</p>';
    widths(body);
  }};

  // ======================================================================
  // Coaching (team side): tips and points to work on from Amr
  // ======================================================================
  const KIND = { tip:['Tip', ''], improve:['Work on this', 'no'], praise:['Well done', 'ok'], focus:['Focus today', 'plain'] };
  PX.KIND = KIND;
  const postHtml = (p, mine) => '<article class="px-post' + (p.is_read || !mine ? '' : ' is-new') + '" data-post="' + p.id + '"><div class="px-post-head">' + pill(KIND[p.kind] ? KIND[p.kind][0] : 'Tip', KIND[p.kind] ? KIND[p.kind][1] : '') +
    (p.user_id ? '<span class="px-for">' + (mine ? 'Just for you' : 'For ' + esc(p.for_name || 'one person')) + '</span>' : '<span class="px-for">Whole team</span>') +
    (p.pinned ? '<span class="px-for">Pinned</span>' : '') + '<time>' + esc(fmtDay(p.at, { month:'short', day:'numeric' })) + '</time></div>' +
    (p.title ? '<h3>' + esc(p.title) + '</h3>' : '') + '<p class="px-pre">' + esc(p.body) + '</p>' +
    (!mine && p.audience != null ? '<small class="px-reads">Read by ' + (p.reads || 0) + ' of ' + p.audience + '</small>' : '') + '</article>';
  PX.postHtml = postHtml;
  async function markRead(db, posts){
    const unread = posts.filter(p => !p.is_read).map(p => ({ post_id:p.id }));
    if (unread.length) await safe(db.from('coaching_reads').upsert(unread, { onConflict:'post_id,user_id', ignoreDuplicates:true }));
  }
  V.coaching = { title:'Coaching', sec:'everyone', async open(el, ok){
    if (isOwner() && window.PortalAdmin) return window.PortalAdmin.coaching(el, ok);
    const body = page(el, 'Learning', 'Coaching', 'Daily tips from Amr, and points to work on. New ones also ring the bell.');
    const r = await safe(T().db.rpc('portal_coaching', { p_limit:80 }));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const posts = r.data || [];
    body.innerHTML = posts.length ? '<div class="px-posts">' + posts.map(p => postHtml(p, true)).join('') + '</div>' : empty('Nothing yet. Amr’s tips will show up here.');
    markRead(T().db, posts);
  }};

  // ======================================================================
  // Schedule (team side): my planned shifts, lateness, time off
  // ======================================================================
  const ST = { on_time:['On time', 'ok'], late:['Late', 'no'], missed:['Missed', 'no'], upcoming:['Coming up', 'plain'], not_in_yet:['Not clocked in yet', 'no'], time_off:['Time off', 'plain'] };
  PX.ST = ST;
  const shiftLine = s => fmtDay(s.starts_at) + ' · ' + fmtTime(s.starts_at, 'Africa/Cairo') + '–' + fmtTime(s.ends_at, 'Africa/Cairo') + ' Cairo (' + fmtTime(s.starts_at, 'America/New_York') + ' ET)';
  PX.shiftLine = shiftLine;
  V.schedule = { title:'Schedule', sec:'everyone', async open(el, ok){
    if (isOwner() && window.PortalAdmin) return window.PortalAdmin.schedule(el, ok);
    const db = T().db, body = page(el, 'You', 'My schedule', 'Your planned shifts for the next four weeks, how the last two went, and time off.');
    const from = new Date(Date.now() - 14 * 864e5), to = new Date(Date.now() + 28 * 864e5);
    const [s, t] = await Promise.all([safe(db.rpc('portal_schedule', { p_from:isoDay(from), p_to:isoDay(to) })), safe(db.from('time_off').select('*').order('starts_on', { ascending:false }).limit(20))]);
    if (!ok()) return;
    if (s.error) { body.innerHTML = failed(s.error); return; }
    const rows = s.data || [], now = Date.now();
    const next = rows.filter(x => new Date(x.ends_at) > now), past = rows.filter(x => new Date(x.ends_at) <= now).reverse();
    const lateN = past.filter(x => x.status === 'late').length, missN = past.filter(x => x.status === 'missed').length;
    const line = x => '<div class="p-row"><span>' + esc(shiftLine(x)) + (x.company ? ' · ' + esc(x.company) : '') + (x.note ? '<br><small>' + esc(x.note) + '</small>' : '') + '</span>' +
      pill((ST[x.status] || [x.status])[0] + (x.status === 'late' ? ' ' + x.late_minutes + ' min' : ''), (ST[x.status] || [])[1]) + '</div>';
    const offs = (t.data || []);
    body.innerHTML =
      card('Coming up', plural(next.length, 'shift'), next.length ? next.map(line).join('') : empty('No shifts planned yet. Amr adds them here.')) +
      card('Last two weeks', past.length ? (lateN || missN ? plural(lateN, 'late start') + ' · ' + plural(missN, 'missed shift') : 'All on time') : '', past.length ? past.map(line).join('') : empty('Nothing yet.')) +
      card('Time off', '', '<form class="px-form" id="toForm" novalidate>' + f('From', '<input type="date" id="toFrom" required min="' + isoDay(new Date()) + '">') + f('To', '<input type="date" id="toTo" required min="' + isoDay(new Date()) + '">') +
        f('Why (optional)', '<input type="text" id="toWhy" maxlength="300" autocomplete="off">', 'px-wide') + '<button class="p-btn" type="submit">Ask for time off</button><p class="p-empty" id="toMsg" role="status"></p></form>' +
        (offs.length ? offs.map(o => '<div class="p-row"><span>' + esc(fmtDay(o.starts_on)) + (o.ends_on !== o.starts_on ? ' to ' + esc(fmtDay(o.ends_on)) : '') + (o.reason ? '<br><small>' + esc(o.reason) + '</small>' : '') + (o.owner_note ? '<br><small>Amr: ' + esc(o.owner_note) + '</small>' : '') + '</span>' +
          pill(o.status === 'pending' ? 'Waiting for Amr' : o.status[0].toUpperCase() + o.status.slice(1), o.status === 'approved' ? 'ok' : o.status === 'declined' ? 'no' : 'plain') +
          (o.status === 'pending' ? '<button type="button" class="p-btn is-ghost" data-cancel="' + o.id + '">Cancel</button>' : '') + '</div>').join('') : ''));
    $('toForm').addEventListener('submit', async e => {
      e.preventDefault();
      const a = $('toFrom').value, b = $('toTo').value || a;
      if (!a) return say('toMsg', 'Pick the first day.');
      if (b < a) return say('toMsg', 'The last day is before the first.');
      say('toMsg', 'Sending…');
      const r = await safe(db.from('time_off').insert({ starts_on:a, ends_on:b, reason:$('toWhy').value.trim() || null }));
      if (r.error) return say('toMsg', errText(r, 'Couldn’t send it. Try again.'));
      V.schedule.open(el, ok);
    });
    body.addEventListener('click', async e => {
      const c = e.target.closest('[data-cancel]'); if (!c) return;
      c.disabled = true; const r = await safe(db.rpc('time_off_cancel', { p_id:+c.dataset.cancel }));
      if (r.error) { c.disabled = false; return; } V.schedule.open(el, ok);
    });
  }};

  // ======================================================================
  // Referrals (team side): bring someone in, $25 when they are hired
  // ======================================================================
  const RS = { new:['New', 'plain'], talking:['Talking to them', 'plain'], hired:['Hired, bonus coming', 'ok'], paid:['Bonus paid', 'ok'], not_hired:['Not hired', 'no'] };
  PX.RS = RS;
  V.referrals = { title:'Referrals', sec:'everyone', async open(el, ok){
    if (isOwner() && window.PortalAdmin) return window.PortalAdmin.referrals(el, ok);
    const db = T().db, body = page(el, 'Team', 'Refer a friend', 'Know someone who would be good on the phones? Send them our way. When they are hired you get a bonus.');
    const [r, b] = await Promise.all([safe(db.from('referrals').select('*').order('created_at', { ascending:false })), safe(db.rpc('referral_bonus_default'))]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const bonus = b.data != null ? usd(b.data) : '$25.00', mine = r.data || [];
    const earned = mine.filter(x => x.status === 'hired' || x.status === 'paid').reduce((s, x) => s + Number(x.bonus || 0), 0);
    body.innerHTML =
      card('Who do you know?', bonus + ' for each hire', '<form class="px-form" id="rfForm" novalidate>' +
        f('Their name', '<input type="text" id="rfName" maxlength="80" autocomplete="off" required>') + f('Phone or WhatsApp', '<input type="tel" id="rfPhone" maxlength="30" autocomplete="off">') +
        f('Email (optional)', '<input type="email" id="rfEmail" maxlength="120" autocomplete="off">') + f('Why they’d be good (optional)', '<input type="text" id="rfNote" maxlength="500" autocomplete="off">', 'px-wide') +
        '<button class="p-btn" type="submit">Send to Amr</button><p class="p-empty" id="rfMsg" role="status"></p></form>' +
        '<p class="p-empty">Tell them about it first. They can also apply at <a href="/join/">amrabdelgawad.site/join</a> and write your name as the person who sent them.</p>') +
      card('Your referrals', earned ? usd(earned) + ' earned' : '', mine.length ? mine.map(x => '<div class="p-row"><span><b>' + esc(x.name) + '</b><br><small>' + esc(fmtDay(x.created_at)) + '</small></span>' + pill((RS[x.status] || [x.status])[0], (RS[x.status] || [])[1]) + '</div>').join('') : empty('No referrals yet.'));
    $('rfForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('rfName').value.trim(); if (!name) return say('rfMsg', 'Write their name first.');
      const phone = $('rfPhone').value.trim(), email = $('rfEmail').value.trim();
      if (!phone && !email) return say('rfMsg', 'Add a phone number or an email so Amr can reach them.');
      say('rfMsg', 'Sending…');
      const x = await safe(db.from('referrals').insert({ name, phone:phone || null, email:email || null, note:$('rfNote').value.trim() || null }));
      if (x.error) return say('rfMsg', errText(x, 'Couldn’t send it. Try again.'));
      V.referrals.open(el, ok);
    });
  }};

  // ======================================================================
  // What's new: changes Amr chose to tell the team about
  // ======================================================================
  V.whatsnew = { title:'What’s new', sec:'everyone', async open(el, ok){
    if (isOwner() && window.PortalAdmin) return window.PortalAdmin.whatsnew(el, ok);
    const body = page(el, 'Portal', 'What’s new', 'Changes to the portal that affect your work. Something broken, or an idea? Use “Report a problem or idea” in your account menu.');
    const r = await safe(T().db.rpc('portal_whats_new', { p_limit:30 }));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    body.innerHTML = (r.data || []).length ? '<section class="p-card">' + r.data.map(c => '<div class="px-news"><time>' + esc(fmtDay(c.at, { month:'short', day:'numeric' })) + '</time><div><b>' + esc(c.title) + '</b>' + (c.note ? '<p>' + esc(c.note) + '</p>' : '') + '</div></div>').join('') + '</section>' : empty('Nothing new yet.');
    try { localStorage.setItem('newsSeen', String((r.data[0] || {}).id || 0)); } catch(e) {}
  }};

  // ======================================================================
  // Exit survey (only for someone Amr has started offboarding)
  // ======================================================================
  const EXIT_Q = [
    ['why', 'What is the main reason you are leaving?', 'text'],
    ['enjoyed', 'What did you enjoy most about the work?', 'text'],
    ['better', 'What one thing should we change to make this a better place to work?', 'text'],
    ['training', 'How well did the training prepare you for live calls?', 'scale'],
    ['support', 'How supported did you feel by Amr?', 'scale'],
    ['pay', 'How fair did the pay feel for the work?', 'scale'],
    ['tools', 'Which tool or part of the portal got in your way the most?', 'text'],
    ['recommend', 'Would you recommend working here to a friend?', 'yesno'],
    ['back', 'Would you come back one day?', 'yesno'],
    ['else', 'Anything else you want Amr to know?', 'text']
  ];
  PX.EXIT_Q = EXIT_Q;
  V.exit = { title:'Exit survey', sec:'member', async open(el, ok){
    const db = T().db, body = page(el, 'Thank you', 'Exit survey', 'Five minutes. Your honest answers go only to Amr and help him make the team better for the next person.');
    const [o, s] = await Promise.all([safe(db.from('offboardings').select('last_day,finished_at').maybeSingle()), safe(db.from('exit_surveys').select('submitted_at').maybeSingle())]);
    if (!ok()) return;
    if (s.data) { body.innerHTML = '<p class="p-card p-empty">Thank you. Your answers were sent on ' + esc(fmtDay(s.data.submitted_at)) + '.</p>'; return; }
    if (!o.data || o.data.finished_at) { body.innerHTML = '<p class="p-card p-empty">There’s no exit survey for you.</p>'; return; }
    const scale = k => '<span class="px-scale" role="radiogroup">' + [1, 2, 3, 4, 5].map(n => '<label><input type="radio" name="q_' + k + '" value="' + n + '"><span>' + n + '</span></label>').join('') + '</span><small class="px-scale-ends"><span>Not at all</span><span>Very</span></small>';
    const yesno = k => '<span class="px-scale">' + ['Yes', 'Maybe', 'No'].map(n => '<label><input type="radio" name="q_' + k + '" value="' + n + '"><span>' + n + '</span></label>').join('') + '</span>';
    body.innerHTML = '<form class="p-card px-survey" id="exForm" novalidate>' + EXIT_Q.map(([k, q, t]) => '<fieldset><legend>' + esc(q) + '</legend>' +
      (t === 'text' ? '<textarea name="q_' + k + '" rows="3" maxlength="1500"></textarea>' : t === 'scale' ? scale(k) : yesno(k)) + '</fieldset>').join('') +
      '<button class="p-btn" type="submit">Send my answers</button><p class="p-empty" id="exMsg" role="status"></p></form>';
    $('exForm').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target), answers = {};
      EXIT_Q.forEach(([k]) => { const v = fd.get('q_' + k); if (v != null && String(v).trim() !== '') answers[k] = String(v).trim(); });
      if (Object.keys(answers).length < 3) return say('exMsg', 'Answer at least a few questions first.');
      say('exMsg', 'Sending…');
      const r = await safe(db.from('exit_surveys').insert({ answers }));
      if (r.error) return say('exMsg', errText(r, 'Couldn’t send it. Try again.'));
      V.exit.open(el, ok);
    });
  }};

  // ======================================================================
  // Callbacks at the seller's local time (Team home card and #callbacks)
  // ======================================================================
  function callbackForm(){
    const d = new Date();
    return '<form class="px-form px-cb-form" id="cbForm" novalidate hidden>' +
      f('Who (seller or property, no phone numbers)', '<input type="text" id="cbLabel" maxlength="120" autocomplete="off" placeholder="e.g. Smith, 5 acres Polk County">', 'px-wide') +
      f('State', '<select id="cbState">' + opt('', 'Pick…') + STATES.map(s => opt(s, s)).join('') + '</select>') +
      f('Their time zone', '<select id="cbTz">' + ZONES.map(([z, n]) => opt(z, n)).join('') + '</select>') +
      f('Day', '<input type="date" id="cbDay" value="' + isoDay(d) + '" min="' + isoDay(d) + '">') +
      f('Time, their time', '<input type="time" id="cbTime" value="15:00" step="300">') +
      f('Note (optional)', '<input type="text" id="cbNote" maxlength="500" autocomplete="off">', 'px-wide') +
      '<p class="p-empty px-wide" id="cbWhen" role="status"></p>' +
      '<button class="p-btn" type="submit">Save callback</button><button class="p-btn is-ghost" type="button" id="cbCancel">Cancel</button></form>';
  }
  function cbRow(c){
    const due = new Date(c.due_at), late = due < Date.now(), soon = !late && due - Date.now() < 30 * 60e3;
    const zone = (ZONES.find(z => z[0] === c.tz) || [, ''])[1];
    return '<div class="p-row px-cb"><span><b>' + esc(c.label) + '</b><br><small>' + esc(fmtDay(c.due_at, { weekday:'short', month:'short', day:'numeric', timeZone:c.tz })) + ' · ' + esc(fmtTime(c.due_at, c.tz)) + ' ' + esc(zone) + (c.state ? ' (' + esc(c.state) + ')' : '') +
      ' = ' + esc(fmtTime(c.due_at, 'Africa/Cairo')) + ' Cairo' + (c.note ? ' · ' + esc(c.note) : '') + '</small></span>' +
      (late ? pill('Due now', 'no') : soon ? pill('In ' + Math.max(1, Math.round((due - Date.now()) / 60e3)) + ' min', 'no') : '') +
      '<button type="button" class="p-btn is-ghost" data-cbdone="' + c.id + '">Done</button></div>';
  }
  async function callbacks(db, box, ok, full){
    const r = await safe(db.from('callbacks').select('*').is('done_at', null).order('due_at').limit(full ? 200 : 8));
    if (!ok() || !box) return;
    if (r.error) { box.innerHTML = /does not exist|schema cache/i.test(r.error.message || '') ? '' : failed(r.error); return; }
    const list = r.data || [];
    const today = list.filter(c => new Date(c.due_at) - Date.now() < 18 * 3600e3);
    box.innerHTML = card(full ? 'Open callbacks' : 'Callback times', full ? list.length + ' open' : today.length + ' due soon',
      '<button type="button" class="p-btn is-ghost px-cb-add" id="cbAdd">Add a callback</button>' + callbackForm() +
      '<div id="cbList">' + ((full ? list : list.slice(0, 6)).map(cbRow).join('') || empty('No callbacks waiting. When a seller says “call me at 3”, save it here in their time.')) + '</div>' +
      (!full && list.length > 6 ? '<a class="p-row" href="#callbacks"><span>See all ' + list.length + '</span></a>' : ''));
    const form = $('cbForm'), when = () => {
      const day = $('cbDay').value, t = $('cbTime').value, tz = $('cbTz').value; if (!day || !t) return say('cbWhen', '');
      const at = zonedToUtc(day, t, tz);
      say('cbWhen', 'That is ' + fmtTime(at, 'Africa/Cairo') + ' on ' + fmtDay(at, { weekday:'short', month:'short', day:'numeric', timeZone:'Africa/Cairo' }) + ' Cairo time.' + (callable(tz, at) ? '' : ' Careful: outside 8 am to 9 pm where they are.'));
    };
    $('cbAdd').addEventListener('click', () => { form.hidden = false; $('cbAdd').hidden = true; when(); $('cbLabel').focus(); });
    $('cbCancel').addEventListener('click', () => { form.hidden = true; $('cbAdd').hidden = false; });
    $('cbState').addEventListener('change', () => { const z = STATE_TZ[$('cbState').value]; if (z) $('cbTz').value = z; when(); });
    ['cbTz', 'cbDay', 'cbTime'].forEach(id => $(id).addEventListener('input', when));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const label = $('cbLabel').value.trim(); if (!label) return say('cbWhen', 'Write who to call back.');
      if (/\d{3}\D?\d{3}\D?\d{4}/.test(label)) return say('cbWhen', 'Leave the phone number out. Use their name or the property.');
      const at = zonedToUtc($('cbDay').value, $('cbTime').value, $('cbTz').value);
      const x = await safe(db.from('callbacks').insert({ label, state:$('cbState').value || null, tz:$('cbTz').value, due_at:at.toISOString(), note:$('cbNote').value.trim() || null }));
      if (x.error) return say('cbWhen', errText(x, 'Couldn’t save it. Try again.'));
      callbacks(db, box, ok, full);
    });
    if (box.dataset.bound) return;
    box.dataset.bound = '1';
    box.addEventListener('click', async e => {
      const d = e.target.closest('[data-cbdone]'); if (!d) return;
      d.disabled = true; const x = await safe(db.from('callbacks').update({ done_at:new Date().toISOString() }).eq('id', +d.dataset.cbdone));
      if (x.error) { d.disabled = false; return; } callbacks(db, box, ok, full);
    });
  }
  V.callbacks = { title:'Callbacks', sec:'member', async open(el, ok){
    const body = page(el, 'Calls', 'Callbacks', 'Sellers who asked you to call back at a set time, in their own time zone. Calling outside 8 am to 9 pm their time is flagged.');
    body.innerHTML = '<div id="cbBox"></div>'; callbacks(T().db, $('cbBox'), ok, true);
  }};

  // ======================================================================
  // Team home: extra cards (called from portal-home.js after the home is drawn)
  // ======================================================================
  async function signed(db, path){ const r = await safe(db.storage.from('hub-uploads').createSignedUrl(path, 3600)); return r.data && r.data.signedUrl; }
  PX.signed = signed;
  window.PortalExtras = {
    async home(db, el, ok){
      if (!el) return;
      el.innerHTML = '<div class="p-grid px-home"><div id="pxCoach"></div><div id="pxCotw"></div></div><div id="pxCb"></div><div id="pxNews"></div>';
      callbacks(db, $('pxCb'), ok, false);
      const [c, w, n] = await Promise.all([safe(db.rpc('portal_coaching', { p_limit:10 })), safe(db.rpc('portal_call_of_week', { p_limit:1 })), safe(db.rpc('portal_whats_new', { p_limit:3 }))]);
      if (!ok()) return;
      const unread = (c.data || []).filter(p => !p.is_read).slice(0, 2), latest = unread.length ? unread : (c.data || []).slice(0, 1);
      if (latest.length) $('pxCoach').innerHTML = card('Coaching', unread.length ? plural(unread.length, 'new tip') : 'Latest', latest.map(p => postHtml(p, true)).join('') + '<a class="p-row" href="#coaching"><span>All tips</span></a>');
      if (unread.length) markRead(db, unread);
      const cw = (w.data || [])[0];
      if (cw && cw.week >= isoDay(new Date(Date.now() - 13 * 864e5))) {
        $('pxCotw').innerHTML = card('Call of the week', esc(cw.rep ? 'By ' + cw.rep : ''), '<h3 class="px-cotw-t">' + esc(cw.title) + '</h3>' + (cw.why ? '<p class="px-pre">' + esc(cw.why) + '</p>' : '') +
          '<audio controls preload="none" id="pxCotwAudio"></audio>' + (cw.entry_title ? '<a class="p-row" href="#library"><span>Goes with: ' + esc(cw.entry_title) + '</span></a>' : ''));
        const u = await signed(db, cw.path); if (u && $('pxCotwAudio')) $('pxCotwAudio').src = u;
      }
      let seen = 0; try { seen = +localStorage.getItem('newsSeen') || 0; } catch(e) {}
      const fresh = (n.data || []).filter(x => x.id > seen);
      if (fresh.length) $('pxNews').innerHTML = card('New in the portal', '', fresh.map(x => '<div class="px-news"><time>' + esc(fmtDay(x.at, { month:'short', day:'numeric' })) + '</time><div><b>' + esc(x.title) + '</b>' + (x.note ? '<p>' + esc(x.note) + '</p>' : '') + '</div></div>').join('') + '<a class="p-row" href="#whatsnew"><span>All updates</span></a>');
      const ex = await safe(db.from('offboardings').select('finished_at').maybeSingle());
      if (ok() && ex.data && !ex.data.finished_at) {
        const s = await safe(db.from('exit_surveys').select('submitted_at').maybeSingle());
        if (ok() && !s.data) el.insertAdjacentHTML('afterbegin', '<a class="p-card p-cont" href="#exit"><span class="p-cont-txt"><span class="p-kick">Before you go</span><b>A short exit survey for Amr</b></span><span class="p-btn">Open</span></a>');
      }
    }
  };
})();
