// Portal batch (Nov 9): Amr's pages. Helpers and the page registry come from extras-core.js (window.PX, window.PortalViews).
//   Numbers:  #funnel (calls to deals)  #profit (per client)  #clientreport (weekly, printable)  #forecast (next 3 months)
//   Calls:    #lists (lead lists)  #cotw (call of the week)
//   People:   #schedule  #coaching  #referrals  #applications  #offboarding  #whatsnew (Amr's side: which changes the team sees)
// The database checks Amr's two-step sign-in on every one of these (portal_require_owner / is_tracker_admin).
(function(){
  'use strict';
  const PX = window.PX, V = window.PortalViews;
  if (!PX || !V) return;
  const { T, $, esc, safe, isoDay, fmtDay, fmtTime, usd, num, pct, plural, card, empty, failed, pill, f, opt, table, tr, bar, widths, say, errText, page } = PX;
  const db = () => T().db;
  const today = () => isoDay(new Date());
  const daysAgo = n => isoDay(new Date(Date.now() - n * 864e5));
  const monday = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const people = async () => { const r = await safe(db().from('members').select('user_id,name,active,company_id,role').order('name')); return (r.data || []).filter(m => m.active); };
  const reopen = (name, el, ok) => V[name].open(el, ok);
  const rangeSel = (id, cur) => '<select id="' + id + '" class="px-range" aria-label="Period">' + [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months']].map(([v, t]) => opt(v, t, v === cur)).join('') + '</select>';

  // ======================================================================
  // Funnel: dials → conversations → offers → appointments → deals
  // ======================================================================
  let funnelDays = 30;
  V.funnel = { title:'Funnel', sec:'owner', async open(el, ok){
    const body = page(el, 'Numbers', 'Calls to deals', 'Where calls turn into deals, and where they drop off. By rep, by lead list and by hour (US Eastern).');
    const r = await safe(db().rpc('portal_funnel', { p_from:daysAgo(funnelDays - 1), p_to:today() }));
    if (!ok()) return;
    if (r.error || !r.data) { body.innerHTML = failed(r.error); return; }
    const d = r.data, t = d.totals;
    const steps = [['Dials', t.dials], ['Conversations', t.conversations], ['Offers', t.offers], ['Appointments', t.appointments], ['New deals', t.deals_new], ['Contracts', t.contracts], ['Closed', t.closed]];
    const maxH = Math.max(1, ...d.hours_et.map(h => h.dials));
    const listRows = d.lists.map(l => tr(['<b>' + esc(l.name) + '</b>' + (l.records ? '<br><small>' + num(l.records) + ' records' + (l.cost ? ' · ' + usd(l.cost) : '') + '</small>' : ''), num(l.dials), num(l.conversations) + ' <small>' + pct(l.conversations, l.dials) + '</small>',
      num(l.offers), num(l.appointments), num(l.deals), l.cost && l.appointments ? usd(l.cost / l.appointments) : '–']));
    body.innerHTML =
      '<div class="px-tools">' + rangeSel('fnDays', funnelDays) + '<span class="p-empty">' + esc(t.hours) + ' hours worked</span></div>' +
      card('The funnel', 'each step as a share of the one before', '<div class="px-funnel">' + steps.map(([k, v], i) =>
        '<div class="px-frow"><span>' + esc(k) + '</span>' + bar(v, steps[0][1] || 1) + '<b>' + num(v) + '</b><small>' + (i ? pct(v, steps[i - 1][1]) : (t.hours ? (Math.round(t.dials / t.hours * 10) / 10) + ' an hour' : '')) + '</small></div>').join('') + '</div>' +
        (d.tapped_share != null && d.tapped_share < 0.8 ? '<p class="p-empty">Only ' + Math.round(d.tapped_share * 100) + '% of dials were tapped live on the call counter; the rest were typed at clock-out, so the hour and list splits below miss some calls.</p>' : '') +
        '<p class="p-empty">Deals count only once the Deal CRM has them; contracts and closings use their dates in the CRM.</p>') +
      card('By rep', '', d.reps.length ? table(['Rep', 'Hours', 'Dials', 'Dials/hour', 'Conversations', 'Offers', 'Appointments'], d.reps.map(x => tr(['<b>' + esc(x.name) + '</b>', esc(x.hours), num(x.dials), x.hours ? Math.round(x.dials / x.hours) : '–',
        num(x.conversations) + ' <small>' + pct(x.conversations, x.dials) + '</small>', num(x.offers), num(x.appointments) + ' <small>' + pct(x.appointments, x.conversations) + '</small>']))) : empty('No shifts in this period.')) +
      card('By lead list', '<a href="#lists">Manage lists</a>', listRows.length ? table(['List', 'Dials', 'Conversations', 'Offers', 'Appointments', 'Deals', 'Cost per appointment'], listRows) : empty('No tapped calls in this period.')) +
      card('Best hours to call', 'US Eastern time', d.hours_et.length ? '<div class="px-funnel">' + d.hours_et.map(h => '<div class="px-frow"><span>' + (h.hour % 12 || 12) + (h.hour < 12 ? ' am' : ' pm') + '</span>' + bar(h.dials, maxH) + '<b>' + num(h.dials) + '</b><small>' + num(h.conversations) + ' talked · ' + pct(h.conversations, h.dials) + '</small></div>').join('') + '</div>' : empty('No tapped calls in this period.'));
    widths(body);
    $('fnDays').addEventListener('change', e => { funnelDays = +e.target.value; reopen('funnel', el, ok); });
  }};

  // ======================================================================
  // Profit per client
  // ======================================================================
  V.profit = { title:'Profit per client', sec:'owner', async open(el, ok){
    const body = page(el, 'Numbers', 'Profit per client', 'Billed to each client, paid to the reps, and what is left, by month. US dollars, from the rates on each shift.');
    const r = await safe(db().rpc('portal_profit', { p_months:6 }));
    if (!ok()) return;
    if (r.error || !r.data) { body.innerHTML = failed(r.error); return; }
    const m = r.data.months, reps = r.data.reps;
    const tot = m.reduce((a, x) => ({ h:a.h + +x.hours, b:a.b + +x.billed, p:a.p + +x.paid, g:a.g + +x.margin, c:a.c + +x.collected }), { h:0, b:0, p:0, g:0, c:0 });
    const byClient = {}; m.forEach(x => { const c = byClient[x.client] = byClient[x.client] || { b:0, g:0, h:0 }; c.b += +x.billed; c.g += +x.margin; c.h += +x.hours; });
    const maxB = Math.max(1, ...Object.values(byClient).map(c => c.b));
    const mon = s => fmtDay(s, { month:'short', year:'numeric' });
    body.innerHTML =
      '<div class="px-tiles"><div class="px-tile"><b>' + usd(tot.b) + '</b><span>billed in 6 months</span><small>' + esc(Math.round(tot.h)) + ' hours</small></div>' +
        '<div class="px-tile"><b>' + usd(tot.p) + '</b><span>paid to reps</span></div><div class="px-tile"><b>' + usd(tot.g) + '</b><span>margin</span><small>' + pct(tot.g, tot.b) + ' of billing</small></div>' +
        '<div class="px-tile"><b>' + usd(tot.b - tot.c) + '</b><span>billed, not collected yet</span></div></div>' +
      card('By client', '6 months', Object.keys(byClient).length ? '<div class="px-funnel">' + Object.entries(byClient).sort((a, b) => b[1].b - a[1].b).map(([n, c]) =>
        '<div class="px-frow"><span>' + esc(n) + '</span>' + bar(c.b, maxB) + '<b>' + usd(c.g) + '</b><small>margin on ' + usd(c.b) + ' · ' + usd(c.h ? c.g / c.h : 0) + '/hour</small></div>').join('') + '</div>' : empty('No shifts yet.')) +
      card('By month', '', m.length ? table(['Month', 'Client', 'Hours', 'Billed', 'Paid to reps', 'Margin', 'Collected'], m.slice().reverse().map(x => tr([esc(mon(x.month)), esc(x.client), esc(x.hours), usd(x.billed), usd(x.paid), '<b>' + usd(x.margin) + '</b> <small>' + pct(x.margin, x.billed) + '</small>', usd(x.collected)]))) : empty('No shifts yet.')) +
      card('By rep', '', reps.length ? table(['Month', 'Rep', 'Client', 'Hours', 'Billed', 'Paid', 'Margin'], reps.slice().reverse().map(x => tr([esc(mon(x.month)), '<b>' + esc(x.name) + '</b>', esc(x.client), esc(x.hours), usd(x.billed), usd(x.paid), usd(x.margin)]))) : empty('No shifts yet.')) +
      '<p class="p-empty">Margin here is billing minus rep pay. Your own costs (software, the phone number) are in Cash.</p>';
    widths(body);
  }};

  // ======================================================================
  // Weekly client report (print or save as PDF; copy text for an email)
  // ======================================================================
  let crCo = null, crWeek = null;
  V.clientreport = { title:'Client report', sec:'owner', async open(el, ok){
    const body = page(el, 'Clients', 'Weekly client report', 'One page per client per week: hours, calls, appointments and the reps’ end-of-day notes. Print it, save it as a PDF, or copy the text into an email.');
    const co = await safe(db().from('companies').select('id,name').order('name'));
    if (!ok()) return;
    const list = co.data || [];
    if (!list.length) { body.innerHTML = empty('No clients yet.'); return; }
    crCo = crCo || list[0].id; crWeek = crWeek || isoDay(addDays(monday(new Date()), -7));
    const from = crWeek, to = isoDay(addDays(new Date(crWeek + 'T12:00'), 6));
    body.innerHTML = '<div class="px-tools px-noprint">' + '<select id="crCo" aria-label="Client">' + list.map(c => opt(c.id, c.name, c.id === crCo)).join('') + '</select>' +
      '<input type="date" id="crWeek" value="' + from + '" aria-label="Week starting">' + '<button class="p-btn is-ghost" type="button" id="crPrint">Print or save PDF</button><button class="p-btn is-ghost" type="button" id="crCopy">Copy as text</button><span class="p-empty" id="crMsg" role="status"></span></div><div id="crBody">' + PX.loading + '</div>';
    const r = await safe(db().rpc('portal_client_report', { p_company:crCo, p_from:from, p_to:to }));
    if (!ok()) return;
    if (r.error || !r.data) { $('crBody').innerHTML = failed(r.error); return; }
    const d = r.data, t = d.totals;
    $('crBody').innerHTML = '<article class="p-card px-report"><header><span class="p-kick">Weekly report · ' + esc(fmtDay(from, { month:'short', day:'numeric' })) + ' to ' + esc(fmtDay(to, { month:'short', day:'numeric', year:'numeric' })) + '</span><h2>' + esc(d.client) + '</h2><p>Prepared by Amr Abdelgawad</p></header>' +
      '<div class="px-tiles">' + [[t.hours + ' h', 'calling'], [num(t.dials), 'dials'], [num(t.conversations), 'conversations'], [num(t.appointments), 'appointments set']].map(([v, k]) => '<div class="px-tile"><b>' + v + '</b><span>' + k + '</span></div>').join('') + '</div>' +
      (d.reps.length ? '<h3>By rep</h3>' + table(['Rep', 'Shifts', 'Hours', 'Dials', 'Conversations', 'Appointments'], d.reps.map(x => tr([esc(x.name), x.shifts, x.hours, num(x.dials), num(x.conversations), num(x.appointments)]))) : '<p>No shifts this week.</p>') +
      (d.days.length ? '<h3>By day</h3>' + table(['Day', 'Hours', 'Dials', 'Conversations', 'Appointments'], d.days.map(x => tr([esc(fmtDay(x.day)), x.hours, num(x.dials), num(x.conversations), num(x.appointments)]))) : '') +
      (d.notes.length ? '<h3>From the reps’ end-of-day notes</h3>' + d.notes.map(n => '<p class="px-pre"><b>' + esc(fmtDay(n.day)) + ', ' + esc(n.name.split(' ')[0]) + ':</b> ' + esc(n.brief) + '</p>').join('') : '') +
      '<footer><p>Billed this week: <b>' + usd(t.billed) + '</b></p></footer></article>';
    const text = () => d.client + ' · weekly report ' + fmtDay(from, { month:'short', day:'numeric' }) + ' to ' + fmtDay(to, { month:'short', day:'numeric' }) + '\n\n' +
      'Hours: ' + t.hours + '\nDials: ' + t.dials + '\nConversations: ' + t.conversations + '\nAppointments set: ' + t.appointments + '\n\n' +
      d.reps.map(x => x.name + ': ' + x.hours + ' h, ' + x.dials + ' dials, ' + x.conversations + ' conversations, ' + x.appointments + ' appointments').join('\n') +
      (d.notes.length ? '\n\nNotes from the floor:\n' + d.notes.map(n => '- ' + fmtDay(n.day) + ': ' + n.brief.replace(/\s+/g, ' ')).join('\n') : '') + '\n\nBilled: ' + usd(t.billed);
    $('crCo').addEventListener('change', e => { crCo = +e.target.value; reopen('clientreport', el, ok); });
    $('crWeek').addEventListener('change', e => { if (e.target.value) { crWeek = isoDay(monday(new Date(e.target.value + 'T12:00'))); reopen('clientreport', el, ok); } });
    $('crPrint').addEventListener('click', () => { document.body.classList.add('px-printing'); window.print(); setTimeout(() => document.body.classList.remove('px-printing'), 500); });
    $('crCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(text()); say('crMsg', 'Copied. Paste it into an email.'); } catch(e) { say('crMsg', 'Couldn’t copy on this device.'); } });
  }};

  // ======================================================================
  // Cash forecast: the next three months from the last two full months
  // ======================================================================
  V.forecast = { title:'Cash forecast', sec:'owner', async open(el, ok){
    const body = page(el, 'Money', 'Cash forecast', 'The next three months, from what came in and went out in the last two full months (EGP). A guide, not a promise: one-off debts and purchases are left out.');
    const r = await safe(db().rpc('portal_cash_forecast'));
    if (!ok()) return;
    if (r.error || !r.data) { body.innerHTML = failed(r.error); return; }
    const d = r.data, egp = +d.egp_rate || 50, m0 = new Date(); m0.setDate(1);
    const key = n => { const x = new Date(m0); x.setMonth(x.getMonth() + n); return isoDay(x).slice(0, 7); };
    const full = [key(-2), key(-1)];
    const ONE_OFF = ['Debt', 'Purchases'];
    const sum = (pred) => d.months.filter(x => full.includes(String(x.month).slice(0, 7)) && pred(x)).reduce((s, x) => s + +x.egp, 0) / 2;
    const inc = sum(x => x.kind === 'income'), bizOut = sum(x => x.kind === 'expense' && !x.personal), lifeOut = sum(x => x.kind === 'expense' && x.personal && !ONE_OFF.includes(x.category));
    const oneOff = sum(x => x.kind === 'expense' && ONE_OFF.includes(x.category));
    const net = inc - bizOut - lifeOut;
    const teamWeek = (+d.weekly_bill_usd - +d.weekly_pay_usd) * egp;
    const egpF = n => Math.round(n).toLocaleString('en-US') + ' EGP';
    let run = 0;
    const rows = [1, 2, 3].map(n => { run += net; return tr(['<b>' + esc(fmtDay(key(n - 1) + '-15', { month:'long', year:'numeric' })) + '</b>', egpF(inc), egpF(bizOut), egpF(lifeOut), '<b' + (net < 0 ? ' class="px-neg"' : '') + '>' + egpF(net) + '</b>', egpF(run)]); });
    body.innerHTML =
      (net < 0 ? '<p class="p-card px-warn">At this rate you spend about ' + egpF(-net) + ' more than you earn each month. Worth a look before it adds up.</p>' : '') +
      '<div class="px-tiles"><div class="px-tile"><b>' + egpF(inc) + '</b><span>income a month</span><small>average of the last two full months</small></div>' +
        '<div class="px-tile"><b>' + egpF(bizOut + lifeOut) + '</b><span>regular costs a month</span><small>' + egpF(bizOut) + ' business · ' + egpF(lifeOut) + ' personal</small></div>' +
        '<div class="px-tile"><b>' + egpF(net) + '</b><span>left each month</span></div>' +
        '<div class="px-tile"><b>' + usd(d.billed_uncollected_usd) + '</b><span>billed, not collected</span><small>' + usd(d.unpaid_reps_usd) + ' owed to reps</small></div></div>' +
      card('Next three months', 'if they look like the last two', table(['Month', 'Income', 'Business costs', 'Personal costs', 'Left', 'Saved by then'], rows)) +
      card('Team margin right now', '', '<p>From the last four weeks of shifts, the team earns you about <b>' + usd(+d.weekly_bill_usd - +d.weekly_pay_usd) + '</b> a week after rep pay (' + egpF(teamWeek) + ' at ' + egp + ' EGP to the dollar), about <b>' + egpF(teamWeek * 4.33) + '</b> a month.</p>' +
        '<p class="p-empty">One-off debt payments and purchases (' + egpF(oneOff) + ' a month on average lately) are left out of the forecast. Mark an entry “Repeats every month” in Cash and it will count as regular.</p>');
  }};

  // ======================================================================
  // Lead lists
  // ======================================================================
  V.lists = { title:'Lead lists', sec:'owner', async open(el, ok){
    const body = page(el, 'Calls', 'Lead lists', 'Name each list you dial. Reps pick the list on their call counter, so the funnel shows which lists turn into appointments and deals.');
    const r = await safe(db().from('lead_lists').select('*').order('active', { ascending:false }).order('created_at', { ascending:false }));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    body.innerHTML = card('Add a list', '', '<form class="px-form" id="llForm" novalidate>' + f('Name', '<input type="text" id="llName" maxlength="80" required placeholder="e.g. Polk County vacant land, Nov">', 'px-wide') +
        f('Kind', '<select id="llKind">' + opt('land', 'Land') + opt('house', 'Houses') + opt('other', 'Other') + '</select>') + f('State', '<select id="llState">' + opt('', '–') + PX.STATES.map(s => opt(s, s)).join('') + '</select>') +
        f('County', '<input type="text" id="llCounty" maxlength="60">') + f('Source', '<input type="text" id="llSource" maxlength="80" placeholder="e.g. PropStream, county records">') +
        f('Records', '<input type="number" id="llRecords" min="0" step="1">') + f('Cost ($)', '<input type="number" id="llCost" min="0" step="0.01">') +
        '<button class="p-btn" type="submit">Add list</button><p class="p-empty" id="llMsg" role="status"></p></form>') +
      card('Your lists', plural((r.data || []).filter(x => x.active).length, 'in use'), (r.data || []).length ? (r.data || []).map(l => '<div class="p-row"><span><b>' + esc(l.name) + '</b><br><small>' + esc([l.kind, [l.county, l.state].filter(Boolean).join(', '), l.source, l.records ? num(l.records) + ' records' : '', l.cost ? usd(l.cost) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
        '<button type="button" class="p-btn is-ghost" data-ll="' + l.id + '" aria-pressed="' + l.active + '">' + (l.active ? 'In use' : 'Retired') + '</button></div>').join('') : empty('No lists yet.'));
    $('llForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('llName').value.trim(); if (!name) return say('llMsg', 'Name the list first.');
      const x = await safe(db().from('lead_lists').insert({ name, kind:$('llKind').value, state:$('llState').value || null, county:$('llCounty').value.trim() || null, source:$('llSource').value.trim() || null,
        records:$('llRecords').value ? +$('llRecords').value : null, cost:$('llCost').value ? +$('llCost').value : null }));
      if (x.error) return say('llMsg', errText(x, 'Couldn’t add it. Try again.'));
      reopen('lists', el, ok);
    });
    body.addEventListener('click', async e => {
      const b = e.target.closest('[data-ll]'); if (!b) return; b.disabled = true;
      const x = await safe(db().from('lead_lists').update({ active:b.getAttribute('aria-pressed') !== 'true' }).eq('id', +b.dataset.ll));
      if (!x.error) reopen('lists', el, ok); else b.disabled = false;
    });
  }};

  // ======================================================================
  // Schedule (Amr): plan shifts, see who started late, approve time off
  // ======================================================================
  let schWeek = null;
  async function schedule(el, ok){
    const body = page(el, 'People', 'Schedule', 'Plan shifts in Cairo time (US Eastern shown beside). Lateness is the first clock-in against the planned start; 5 minutes of grace.');
    schWeek = schWeek || isoDay(monday(new Date()));
    const from = new Date(schWeek + 'T12:00'), to = addDays(from, 6);
    const [s, t, ppl, co] = await Promise.all([safe(db().rpc('portal_schedule', { p_from:isoDay(from), p_to:isoDay(to) })), safe(db().from('time_off').select('*').in('status', ['pending', 'approved']).gte('ends_on', daysAgo(1)).order('starts_on')),
      people(), safe(db().from('companies').select('id,name').order('name'))]);
    if (!ok()) return;
    if (s.error) { body.innerHTML = failed(s.error); return; }
    const rows = s.data || [], names = {}; ppl.forEach(p => names[p.user_id] = p.name);
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(from, i));
    const late = rows.filter(x => x.status === 'late'), missed = rows.filter(x => x.status === 'missed');
    const cell = x => '<div class="px-slot is-' + esc(x.status) + '"><b>' + esc(x.name.split(' ')[0]) + '</b><span>' + esc(fmtTime(x.starts_at, 'Africa/Cairo')) + '–' + esc(fmtTime(x.ends_at, 'Africa/Cairo')) + '</span>' +
      '<small>' + esc((PX.ST[x.status] || [x.status])[0]) + (x.status === 'late' ? ' ' + x.late_minutes + 'm' : '') + '</small><button type="button" class="px-x" data-del="' + x.id + '" aria-label="Remove this shift">×</button></div>';
    const pend = (t.data || []).filter(o => o.status === 'pending'), appr = (t.data || []).filter(o => o.status === 'approved');
    body.innerHTML =
      '<div class="px-tools"><button class="p-btn is-ghost" type="button" data-wk="-7">← Week before</button><b>' + esc(fmtDay(from, { month:'short', day:'numeric' })) + ' to ' + esc(fmtDay(to, { month:'short', day:'numeric' })) + '</b><button class="p-btn is-ghost" type="button" data-wk="7">Week after →</button>' +
        '<span class="p-empty">' + plural(rows.length, 'shift') + ' · ' + plural(late.length, 'late start') + ' · ' + plural(missed.length, 'missed') + '</span></div>' +
      (pend.length ? card('Time off to decide', plural(pend.length, 'request'), pend.map(o => '<div class="p-row"><span><b>' + esc(names[o.user_id] || 'Someone') + '</b> · ' + esc(fmtDay(o.starts_on)) + (o.ends_on !== o.starts_on ? ' to ' + esc(fmtDay(o.ends_on)) : '') + (o.reason ? '<br><small>' + esc(o.reason) + '</small>' : '') + '</span>' +
        '<input type="text" class="px-note" data-tonote="' + o.id + '" maxlength="300" placeholder="Note (optional)" aria-label="Note"><button type="button" class="p-btn" data-to="' + o.id + '" data-st="approved">Approve</button><button type="button" class="p-btn is-ghost" data-to="' + o.id + '" data-st="declined">Decline</button></div>').join('')) : '') +
      '<div class="px-week">' + days.map(d => { const k = isoDay(d), list = rows.filter(x => isoDay(new Date(new Date(x.starts_at).toLocaleString('en-US', { timeZone:'Africa/Cairo' }))) === k);
        const off = appr.filter(o => k >= o.starts_on && k <= o.ends_on);
        return '<div class="px-day"><h3>' + esc(fmtDay(d, { weekday:'short', day:'numeric' })) + '</h3>' + list.map(cell).join('') + off.map(o => '<div class="px-slot is-time_off"><b>' + esc((names[o.user_id] || '').split(' ')[0]) + '</b><small>Time off</small></div>').join('') + '</div>'; }).join('') + '</div>' +
      card('Add shifts', '', '<form class="px-form" id="shForm" novalidate>' + f('Who', '<select id="shWho">' + ppl.map(p => opt(p.user_id, p.name)).join('') + '</select>') +
        f('Client', '<select id="shCo">' + opt('', '–') + (co.data || []).map(c => opt(c.id, c.name)).join('') + '</select>') +
        f('First day', '<input type="date" id="shDay" value="' + isoDay(from) + '">') + f('Start (Cairo)', '<input type="time" id="shFrom" value="16:00" step="900">') + f('End (Cairo)', '<input type="time" id="shTo" value="20:00" step="900">') +
        '<fieldset class="sc-f px-wide"><legend>Days</legend><span class="px-days">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n, i) => '<label><input type="checkbox" name="shD" value="' + i + '"' + (i < 5 ? ' checked' : '') + '><span>' + n + '</span></label>').join('') + '</span></fieldset>' +
        f('For how many weeks', '<select id="shWeeks">' + [1, 2, 3, 4, 6, 8].map(n => opt(n, plural(n, 'week'))).join('') + '</select>') + f('Note (optional)', '<input type="text" id="shNote" maxlength="200">') +
        '<p class="p-empty px-wide" id="shEt"></p><button class="p-btn" type="submit">Add to the schedule</button><p class="p-empty" id="shMsg" role="status"></p></form>');
    const et = () => { const d = $('shDay').value; if (!d) return; const a = PX.zonedToUtc(d, $('shFrom').value || '16:00', 'Africa/Cairo'), b = PX.zonedToUtc(d, $('shTo').value || '20:00', 'Africa/Cairo'); say('shEt', 'That is ' + fmtTime(a, 'America/New_York') + ' to ' + fmtTime(b, 'America/New_York') + ' US Eastern.'); };
    ['shDay', 'shFrom', 'shTo'].forEach(id => $(id).addEventListener('input', et)); et();
    $('shForm').addEventListener('submit', async e => {
      e.preventDefault();
      const who = $('shWho').value, day = $('shDay').value, a = $('shFrom').value, b = $('shTo').value, picks = [...document.querySelectorAll('[name=shD]:checked')].map(x => +x.value);
      if (!who || !day || !a || !b) return say('shMsg', 'Fill in who, the day and the times.');
      if (!picks.length) return say('shMsg', 'Pick at least one day of the week.');
      const start = monday(new Date(day + 'T12:00')), out = [];
      for (let w = 0; w < +$('shWeeks').value; w++) picks.forEach(i => {
        const d = isoDay(addDays(start, w * 7 + i)); if (d < day) return;
        const s1 = PX.zonedToUtc(d, a, 'Africa/Cairo'); let e1 = PX.zonedToUtc(d, b, 'Africa/Cairo'); if (e1 <= s1) e1 = new Date(e1.getTime() + 864e5);
        out.push({ user_id:who, company_id:$('shCo').value ? +$('shCo').value : null, starts_at:s1.toISOString(), ends_at:e1.toISOString(), note:$('shNote').value.trim() || null });
      });
      if (!out.length) return say('shMsg', 'Nothing to add for those days.');
      say('shMsg', 'Adding ' + plural(out.length, 'shift') + '…');
      const x = await safe(db().from('schedule_shifts').insert(out));
      if (x.error) return say('shMsg', errText(x, 'Couldn’t add them. Try again.'));
      await safe(db().from('notifications').insert({ user_id:who, kind:'schedule', title:'New shifts on your schedule', body:plural(out.length, 'shift') + ' from ' + fmtDay(out[0].starts_at), link:'/app/#schedule' }));
      reopen('schedule', el, ok);
    });
    body.addEventListener('click', async e => {
      const w = e.target.closest('[data-wk]'); if (w) { schWeek = isoDay(addDays(new Date(schWeek + 'T12:00'), +w.dataset.wk)); return reopen('schedule', el, ok); }
      const d = e.target.closest('[data-del]'); if (d) { d.disabled = true; const x = await safe(db().from('schedule_shifts').delete().eq('id', +d.dataset.del)); if (!x.error) reopen('schedule', el, ok); return; }
      const o = e.target.closest('[data-to]'); if (o) { o.disabled = true; const note = (body.querySelector('[data-tonote="' + o.dataset.to + '"]') || {}).value || null;
        const x = await safe(db().rpc('time_off_decide', { p_id:+o.dataset.to, p_status:o.dataset.st, p_note:note })); if (!x.error) reopen('schedule', el, ok); else o.disabled = false; }
    });
  }

  // ======================================================================
  // Coaching (Amr): post a tip, a point to work on, or praise
  // ======================================================================
  async function coaching(el, ok){
    const body = page(el, 'People', 'Coaching', 'Post a daily tip for the whole team, or a point for one person. Each one rings their bell and shows on their home page. You see who has read it.');
    const [r, ppl] = await Promise.all([safe(db().rpc('portal_coaching', { p_limit:100 })), people()]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    body.innerHTML = card('New post', '', '<form class="px-form" id="coForm" novalidate>' +
        f('For', '<select id="coWho">' + opt('', 'The whole team') + ppl.map(p => opt(p.user_id, p.name)).join('') + '</select>') +
        f('Kind', '<select id="coKind">' + opt('tip', 'Tip') + opt('focus', 'Focus for today') + opt('improve', 'Something to work on') + opt('praise', 'Well done') + '</select>') +
        f('Title (optional)', '<input type="text" id="coTitle" maxlength="120" placeholder="e.g. Let them name the price first">', 'px-wide') +
        f('Message', '<textarea id="coBody" rows="5" maxlength="4000"></textarea>', 'px-wide') +
        '<label class="px-check"><input type="checkbox" id="coPin"> Pin it to the top</label><button class="p-btn" type="submit">Post</button><p class="p-empty" id="coMsg" role="status"></p></form>') +
      card('Posted', plural((r.data || []).length, 'post'), (r.data || []).length ? '<div class="px-posts">' + r.data.map(p => PX.postHtml(p, false).replace('</article>', '<button type="button" class="p-btn is-ghost px-del" data-codel="' + p.id + '">Delete</button></article>')).join('') + '</div>' : empty('Nothing posted yet.'));
    $('coForm').addEventListener('submit', async e => {
      e.preventDefault();
      const txt = $('coBody').value.trim(); if (!txt) return say('coMsg', 'Write the message first.');
      say('coMsg', 'Posting…');
      const x = await safe(db().rpc('coaching_post', { p_body:txt, p_kind:$('coKind').value, p_user:$('coWho').value || null, p_title:$('coTitle').value.trim() || null, p_pinned:$('coPin').checked }));
      if (x.error) return say('coMsg', errText(x, 'Couldn’t post it. Try again.'));
      coaching(el, ok);
    });
    body.addEventListener('click', async e => {
      const d = e.target.closest('[data-codel]'); if (!d) return;
      if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'Sure? Delete'; return; }
      d.disabled = true; const x = await safe(db().from('coaching_posts').delete().eq('id', +d.dataset.codel)); if (!x.error) coaching(el, ok);
    });
  }

  // ======================================================================
  // Referrals (Amr)
  // ======================================================================
  async function referrals(el, ok){
    const body = page(el, 'People', 'Referrals', 'People your team brought in. Mark them hired, then paid. The bonus is set below (now applies to new referrals).');
    const [r, ppl, b] = await Promise.all([safe(db().from('referrals').select('*').order('created_at', { ascending:false })), people(), safe(db().from('tracker_settings').select('value').eq('key', 'referral_bonus').maybeSingle())]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const names = {}; ppl.forEach(p => names[p.user_id] = p.name);
    const owed = (r.data || []).filter(x => x.status === 'hired').reduce((s, x) => s + +x.bonus, 0);
    body.innerHTML = '<div class="px-tools"><label class="sc-f px-inline">Bonus per hire ($)<input type="number" id="rbAmt" min="0" step="1" value="' + esc((b.data || {}).value || '25') + '"></label><button class="p-btn is-ghost" type="button" id="rbSave">Save</button><span class="p-empty" id="rbMsg" role="status">' + (owed ? usd(owed) + ' to pay out' : '') + '</span></div>' +
      card('All referrals', plural((r.data || []).length, 'person', 'people'), (r.data || []).length ? table(['Person', 'Sent by', 'Contact', 'Bonus', 'Status'], r.data.map(x => tr(['<b>' + esc(x.name) + '</b>' + (x.note ? '<br><small>' + esc(x.note) + '</small>' : '') + '<br><small>' + esc(fmtDay(x.created_at)) + '</small>',
        esc(names[x.referrer] || 'Someone'), esc([x.phone, x.email].filter(Boolean).join(' · ')), usd(x.bonus),
        '<select data-rf="' + x.id + '" aria-label="Status">' + Object.entries(PX.RS).map(([k, v]) => opt(k, v[0].replace(', bonus coming', ''), k === x.status)).join('') + '</select>']))) : empty('No referrals yet. Reps add them from Referrals in their menu.'));
    $('rbSave').addEventListener('click', async () => { const v = $('rbAmt').value; if (v === '' || +v < 0) return say('rbMsg', 'Type an amount.'); const x = await safe(db().from('tracker_settings').upsert({ key:'referral_bonus', value:String(+v) })); say('rbMsg', x.error ? 'Couldn’t save.' : 'Saved.'); });
    body.addEventListener('change', async e => {
      const s = e.target.closest('[data-rf]'); if (!s) return; s.disabled = true;
      const x = await safe(db().rpc('referral_set', { p_id:+s.dataset.rf, p_status:s.value })); s.disabled = false;
      if (x.error) say('rbMsg', errText(x, 'Couldn’t change it.')); else if (s.value === 'paid') say('rbMsg', 'Marked paid. Add it to their next payslip or in Cash › Expenses.');
    });
  }

  // ======================================================================
  // Applications from the website's Join the team page
  // ======================================================================
  const AS = { new:'New', shortlisted:'Shortlisted', interview:'Interview', hired:'Hired', declined:'Declined' };
  V.applications = { title:'Applications', sec:'owner', async open(el, ok){
    const body = page(el, 'People', 'Applications', 'People who applied on amrabdelgawad.site/join. Newest first.');
    const r = await safe(db().from('job_applications').select('*').order('created_at', { ascending:false }).limit(200));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const list = r.data || [];
    body.innerHTML = list.length ? list.map(a => '<details class="p-card px-app"><summary><b>' + esc(a.name) + '</b><span>' + esc([a.country, a.english && a.english + ' English', a.hours].filter(Boolean).join(' · ')) + '</span>' + pill(AS[a.status], a.status === 'hired' ? 'ok' : a.status === 'declined' ? 'no' : 'plain') + '<time>' + esc(fmtDay(a.created_at)) + '</time></summary>' +
      '<dl>' + [['Email', a.email], ['Phone / WhatsApp', a.phone], ['City', a.city], ['Can start', a.start_when], ['Experience', a.experience], ['Why this job', a.why], ['Referred by', a.referred_by]].filter(x => x[1]).map(([k, v]) => '<dt>' + esc(k) + '</dt><dd class="px-pre">' + esc(v) + '</dd>').join('') +
      (a.sample_link ? '<dt>Voice sample</dt><dd><a href="' + esc(a.sample_link) + '" target="_blank" rel="noopener noreferrer">Open the link</a></dd>' : '') + '</dl>' +
      '<div class="px-form"><label class="sc-f">Status<select data-ap="' + a.id + '">' + Object.entries(AS).map(([k, v]) => opt(k, v, k === a.status)).join('') + '</select></label>' +
      f('Your note', '<input type="text" data-apnote="' + a.id + '" maxlength="500" value="' + esc(a.note || '') + '">', 'px-wide') + '</div></details>').join('') : empty('No applications yet. Share amrabdelgawad.site/join to get some.');
    body.addEventListener('change', async e => {
      const s = e.target.closest('[data-ap]'), n = e.target.closest('[data-apnote]');
      if (s) await safe(db().from('job_applications').update({ status:s.value }).eq('id', +s.dataset.ap));
      if (n) await safe(db().from('job_applications').update({ note:n.value.trim() || null }).eq('id', +n.dataset.apnote));
    });
  }};

  // ======================================================================
  // Offboarding and exit surveys
  // ======================================================================
  const REASON = { resigned:'Resigned', let_go:'Let go', contract_end:'Contract ended', other:'Other' };
  V.offboarding = { title:'Offboarding', sec:'owner', async open(el, ok){
    const body = page(el, 'People', 'Offboarding', 'When someone leaves: send the exit survey first, then work down the list. Switch off portal access last, or they can’t answer the survey.');
    const [o, it, tk, ppl] = await Promise.all([safe(db().rpc('portal_offboardings')), safe(db().from('offboarding_items').select('*').order('sort')), safe(db().from('offboarding_ticks').select('*')), people()]);
    if (!ok()) return;
    if (o.error) { body.innerHTML = failed(o.error); return; }
    const items = (it.data || []).filter(i => i.active), ticks = tk.data || [], list = o.data || [];
    const leaving = new Set(list.filter(x => !x.finished_at).map(x => x.user_id));
    const survey = s => s ? '<dl class="px-survey-a">' + PX.EXIT_Q.filter(([k]) => s[k]).map(([k, q]) => '<dt>' + esc(q) + '</dt><dd class="px-pre">' + esc(s[k]) + '</dd>').join('') + '</dl>' : '<p class="p-empty">Exit survey not answered yet.</p>';
    body.innerHTML = card('Start an offboarding', '', '<form class="px-form" id="obfForm" novalidate>' + f('Who is leaving', '<select id="obfWho">' + ppl.filter(p => !leaving.has(p.user_id)).map(p => opt(p.user_id, p.name)).join('') + '</select>') +
        f('Last day', '<input type="date" id="obfDay" value="' + today() + '">') + f('Reason', '<select id="obfWhy">' + Object.entries(REASON).map(([k, v]) => opt(k, v)).join('') + '</select>') + f('Note (only you see it)', '<input type="text" id="obfNote" maxlength="1000">', 'px-wide') +
        '<button class="p-btn" type="submit">Start and send the exit survey</button><p class="p-empty" id="obfMsg" role="status"></p></form>') +
      (list.length ? list.map(x => '<section class="p-card px-off" data-off="' + esc(x.user_id) + '"><div class="p-card-head"><h2>' + esc(x.name || 'Someone') + '</h2><span>' + (x.finished_at ? 'Done ' + esc(fmtDay(x.finished_at)) : esc(x.done) + ' of ' + esc(x.total) + ' done') + '</span></div>' +
        '<p class="p-empty">' + esc(REASON[x.reason] || '') + (x.last_day ? ' · last day ' + esc(fmtDay(x.last_day)) : '') + (x.note ? ' · ' + esc(x.note) : '') + '</p>' +
        '<div class="ob-grp">' + items.map(i => { const done = ticks.some(t => t.user_id === x.user_id && t.item_id === i.id);
          return '<label class="ob-item' + (done ? ' is-done' : '') + '"><input type="checkbox" data-otick="' + i.id + '"' + (done ? ' checked' : '') + (x.finished_at ? ' disabled' : '') + '><span>' + esc(i.title) + '</span></label>'; }).join('') + '</div>' +
        '<h3 class="px-h3">Exit survey' + (x.survey_at ? ' · ' + esc(fmtDay(x.survey_at)) : '') + '</h3>' + survey(x.survey) +
        (x.finished_at ? '' : '<div class="px-form"><label class="sc-f">Would you rehire?<select data-rehire>' + opt('', '–') + ['yes', 'maybe', 'no'].map(v => opt(v, v[0].toUpperCase() + v.slice(1), x.rehire === v)).join('') + '</select></label><button type="button" class="p-btn" data-finish>Mark offboarding done</button></div>') + '</section>').join('') : '');
    $('obfForm').addEventListener('submit', async e => {
      e.preventDefault(); const who = $('obfWho').value; if (!who) return say('obfMsg', 'Nobody to pick.');
      const x = await safe(db().rpc('offboarding_start', { p_user:who, p_last_day:$('obfDay').value || null, p_reason:$('obfWhy').value, p_note:$('obfNote').value.trim() || null }));
      if (x.error) return say('obfMsg', errText(x, 'Couldn’t start it. Try again.'));
      reopen('offboarding', el, ok);
    });
    body.addEventListener('change', async e => {
      const sec = e.target.closest('[data-off]'); if (!sec) return; const who = sec.dataset.off;
      const c = e.target.closest('[data-otick]');
      if (c) { c.disabled = true; const x = await safe(c.checked ? db().from('offboarding_ticks').insert({ user_id:who, item_id:+c.dataset.otick }) : db().from('offboarding_ticks').delete().eq('user_id', who).eq('item_id', +c.dataset.otick));
        c.disabled = false; if (x.error) c.checked = !c.checked; else c.closest('.ob-item').classList.toggle('is-done', c.checked); }
      const r = e.target.closest('[data-rehire]'); if (r) await safe(db().from('offboardings').update({ rehire:r.value || null }).eq('user_id', who));
    });
    body.addEventListener('click', async e => {
      const b = e.target.closest('[data-finish]'); if (!b) return;
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Mark done'; return; }
      b.disabled = true; const x = await safe(db().from('offboardings').update({ finished_at:new Date().toISOString() }).eq('user_id', b.closest('[data-off]').dataset.off));
      if (!x.error) reopen('offboarding', el, ok); else b.disabled = false;
    });
  }};

  // ======================================================================
  // Call of the week
  // ======================================================================
  V.cotw = { title:'Call of the week', sec:'owner', async open(el, ok){
    const body = page(el, 'Calls', 'Call of the week', 'Pick a scored recording the team should hear. It goes on everyone’s home page, rings their bell, and stays as an example on the script or objection you pick.');
    const [u, e, h] = await Promise.all([safe(db().from('hub_uploads').select('id,title,kind,created_at,real_call,consent,status,score,user_id,path').neq('status', 'waiting').order('created_at', { ascending:false }).limit(60)),
      safe(db().from('library_entries').select('id,kind,title').eq('active', true).order('sort')), safe(db().rpc('portal_call_of_week', { p_limit:10 }))]);
    if (!ok()) return;
    if (u.error) { body.innerHTML = failed(u.error); return; }
    const ppl = await people(); const names = {}; ppl.forEach(p => names[p.user_id] = p.name.split(' ')[0]);
    const ups = (u.data || []).filter(x => !x.real_call || x.consent);
    const total = s => { if (!s || typeof s !== 'object') return ''; const v = s.total != null ? s.total : s.score; return v != null ? ' · score ' + v : ''; };
    body.innerHTML = card('Pick this week’s call', '', ups.length ? '<form class="px-form" id="cwForm" novalidate>' +
        f('Recording', '<select id="cwUp">' + ups.map(x => opt(x.id, (names[x.user_id] || 'Someone') + ' · ' + (x.title || x.kind || 'Recording') + ' · ' + fmtDay(x.created_at) + total(x.score))).join('') + '</select>', 'px-wide') +
        f('Script or objection it shows', '<select id="cwEntry">' + (e.data || []).map(x => opt(x.id, (x.kind === 'objection' ? 'Objection: ' : 'Script: ') + x.title)).join('') + '</select>', 'px-wide') +
        f('Title', '<input type="text" id="cwTitle" maxlength="120" placeholder="e.g. How Abdullah got past “just make me an offer”">', 'px-wide') +
        f('Why it’s good (what to listen for)', '<textarea id="cwWhy" rows="3" maxlength="1000"></textarea>', 'px-wide') +
        '<audio controls preload="none" id="cwPrev" class="px-wide"></audio><button class="p-btn" type="submit">Make it this week’s call</button><p class="p-empty" id="cwMsg" role="status"></p></form>'
        : empty('No reviewed recordings yet. Real calls need the rep’s consent to share.')) +
      card('Past picks', '', (h.data || []).length ? h.data.map(w => '<div class="p-row"><span><b>' + esc(w.title) + '</b><br><small>Week of ' + esc(fmtDay(w.week)) + (w.rep ? ' · ' + esc(w.rep) : '') + (w.entry_title ? ' · ' + esc(w.entry_title) : '') + '</small></span></div>').join('') : empty('None yet.'));
    if (!ups.length) return;
    const prev = async () => { const x = ups.find(y => y.id === $('cwUp').value); const s = x && await PX.signed(db(), x.path); if (s && $('cwPrev')) $('cwPrev').src = s; };
    $('cwUp').addEventListener('change', prev); prev();
    $('cwForm').addEventListener('submit', async ev => {
      ev.preventDefault(); const t = $('cwTitle').value.trim(); if (!t) return say('cwMsg', 'Give it a title.');
      const x = await safe(db().rpc('call_of_week_set', { p_upload:$('cwUp').value, p_title:t, p_why:$('cwWhy').value.trim() || null, p_entry:+$('cwEntry').value || null }));
      if (x.error) return say('cwMsg', errText(x, 'Couldn’t set it. Try again.'));
      reopen('cotw', el, ok);
    });
  }};

  // ======================================================================
  // What's new (Amr): pick which changes the team sees, with a plain note
  // ======================================================================
  async function whatsnew(el, ok){
    const body = page(el, 'Portal', 'What’s new for the team', 'Everything that shipped is in Logs. Tick the changes the team should hear about, and write one line in their words.');
    const r = await safe(db().rpc('portal_changes'));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const list = (r.data || []).slice(0, 60);
    body.innerHTML = '<section class="p-card">' + (list.length ? list.map(c => '<div class="px-news px-news-edit"><time>' + esc(fmtDay(c.at, { month:'short', day:'numeric' })) + '</time><div><b>' + esc(c.title) + '</b>' +
      '<label class="px-check"><input type="checkbox" data-share="' + c.id + '"' + (c.for_team ? ' checked' : '') + '> Show to the team</label>' +
      '<input type="text" data-sharenote="' + c.id + '" maxlength="400" placeholder="One line for the team (optional)" value="' + esc(c.team_note || '') + '" aria-label="Note for the team"></div></div>').join('') : empty('Nothing shipped yet.')) + '</section>';
    body.addEventListener('change', async e => {
      const c = e.target.closest('[data-share]'), n = e.target.closest('[data-sharenote]');
      const id = +(c ? c.dataset.share : n ? n.dataset.sharenote : 0); if (!id) return;
      const box = body.querySelector('[data-share="' + id + '"]'), note = body.querySelector('[data-sharenote="' + id + '"]');
      if (n && n.value.trim() && !box.checked) box.checked = true;
      await safe(db().rpc('change_share', { p_id:id, p_on:box.checked, p_note:note.value.trim() || null }));
    });
  }

  // ======================================================================
  // Announcements (Amr): news for the team, or a pay extra for one person; shows on their My hours and home page
  // ======================================================================
  V.announcements = { title:'Announcements', sec:'owner', async open(el, ok){
    const body = page(el, 'People', 'Announcements', 'Post news for the whole team, or a pay extra (bonus, overtime, a referral) for one person. It shows at the top of their My hours and home page and rings their bell. Pay extras also show in their My month.');
    const [r, ppl] = await Promise.all([safe(db().rpc('portal_announcements', { p_limit:100 })), people()]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    body.innerHTML = card('New announcement', '', '<form class="px-form" id="anForm" novalidate>' +
        f('Kind', '<select id="anKind">' + opt('news', 'Announcement') + opt('pay', 'Pay extra (bonus, overtime…)') + '</select>') +
        f('For', '<select id="anWho">' + opt('', 'The whole team') + ppl.map(p => opt(p.user_id, p.name)).join('') + '</select>') +
        f('Title', '<input type="text" id="anTitle" maxlength="120" placeholder="e.g. Saturday bonus">', 'px-wide') +
        f('Message (optional)', '<textarea id="anBody" rows="4" maxlength="2000"></textarea>', 'px-wide') +
        '<label class="sc-f px-pay" hidden>Amount<input type="number" id="anAmt" min="0" step="0.01"></label>' +
        '<label class="sc-f px-pay" hidden>Currency<select id="anCur">' + opt('USD', '$ USD') + opt('EGP', 'EGP') + '</select></label>' +
        f('Show until (optional)', '<input type="date" id="anUntil" min="' + today() + '">') +
        '<label class="px-check"><input type="checkbox" id="anPin"> Pin it to the top</label>' +
        '<button class="p-btn" type="submit">Post</button><p class="p-empty" id="anMsg" role="status"></p></form>') +
      card('Posted', plural((r.data || []).length, 'announcement'), (r.data || []).length ? '<div class="px-posts">' + r.data.map(a => PX.annHtml(a, false).replace('</article>', '<button type="button" class="p-btn is-ghost px-del" data-andel="' + a.id + '">Delete</button></article>')).join('') + '</div>' : empty('Nothing posted yet.'));
    const kind = () => { const pay = $('anKind').value === 'pay'; body.querySelectorAll('.px-pay').forEach(x => x.hidden = !pay); };
    $('anKind').addEventListener('change', kind);
    $('anForm').addEventListener('submit', async e => {
      e.preventDefault();
      const title = $('anTitle').value.trim(); if (!title) return say('anMsg', 'Give it a title.');
      const pay = $('anKind').value === 'pay', amt = $('anAmt').value;
      if (pay && !$('anWho').value) return say('anMsg', 'A pay extra is for one person. Pick who it is for.');
      if (pay && (amt === '' || +amt <= 0)) return say('anMsg', 'Type the amount of the extra.');
      say('anMsg', 'Posting…');
      const x = await safe(db().rpc('announcement_post', { p_title:title, p_body:$('anBody').value.trim() || null, p_user:$('anWho').value || null, p_kind:$('anKind').value,
        p_amount:pay ? +amt : null, p_currency:$('anCur').value, p_pinned:$('anPin').checked, p_expires:$('anUntil').value || null }));
      if (x.error) return say('anMsg', errText(x, 'Couldn’t post it. Try again.'));
      reopen('announcements', el, ok);
    });
    body.addEventListener('click', async e => {
      const d = e.target.closest('[data-andel]'); if (!d) return;
      if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'Sure? Delete'; return; }
      d.disabled = true; const x = await safe(db().from('announcements').delete().eq('id', +d.dataset.andel)); if (!x.error) reopen('announcements', el, ok);
    });
  }};

  window.PortalAdmin = { schedule, coaching, referrals, whatsnew };
})();
