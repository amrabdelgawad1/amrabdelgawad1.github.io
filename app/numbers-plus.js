// Round 13 (plan rounds 3): targets and the leaderboard, the weekly summary, client invoices, receipts on expenses,
// commissions from closed deals, what each lead list brought in, and script testing.
//   #leaderboard  the week's ranking for everyone; Amr also sets each rep's daily targets here
//   #weekly       Amr's Monday page: hours, pay owed, calls to deals, who is behind, what is overdue, money waiting
//   #invoices     build an invoice from a client's hours, print it, mark it sent, mark it paid (adds it to Cash)
//   #receipts     attach a photo or file to each expense
//   #scripttest   which script books more appointments
//   #lists        + cost per appointment and per deal for each list
//   Team home     + today's targets with progress, and "script I'm using today"
(function(){
  'use strict';
  const PX = window.PX;
  if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, usd, num, plural, card, empty, failed, pill, f, opt, say, errText, table, tr } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const uid = () => (T().user || {}).id;
  const page = PX.page;
  const today = () => isoDay(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoDay(d); };
  const monday = () => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoDay(d); };
  const rate = (a, b) => b ? Math.round(a / b * 1000) / 10 + '%' : '–';
  const tiles = list => '<div class="px-tiles">' + list.map(([v, l, hot]) => '<div class="px-tile' + (hot ? ' np-hot' : '') + '"><b>' + esc(v) + '</b>' + esc(l) + '</div>').join('') + '</div>';
  const KEYS = [['dials', 'Dials'], ['conversations', 'Conversations'], ['offers', 'Offers'], ['appointments', 'Appointments']];

  // ======================================================================
  // Leaderboard and targets
  // ======================================================================
  const PERIODS = { week:['This week', () => [monday(), today()]], last:['Last week', () => [addDays(monday(), -7), addDays(monday(), -1)]], month:['This month', () => [today().slice(0, 8) + '01', today()]] };
  V.leaderboard = { title:'Leaderboard', sec:'everyone', async open(el, ok){
    const owner = isOwner(), per = (location.hash.split('/')[1] || 'week');
    const body = page(el, 'Numbers', 'Leaderboard', 'Ranked by appointments, then conversations, then dials. Today’s taps count while people are on the clock.');
    const [from, to] = (PERIODS[per] || PERIODS.week)[1]();
    const [r, tg, ppl] = await Promise.all([safe(db().rpc('portal_leaderboard', { p_from:from, p_to:to })), owner ? safe(db().from('rep_targets').select('*')) : Promise.resolve({ data:[] }),
      owner ? safe(db().from('members').select('user_id,name,active').eq('active', true).order('name')) : Promise.resolve({ data:[] })]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const rows = r.data || [], medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
    const top = rows[0] && (rows[0].appointments || rows[0].conversations || rows[0].dials) ? rows[0] : null;
    body.innerHTML = '<div class="p-seg np-seg" role="tablist" aria-label="Period">' + Object.entries(PERIODS).map(([k, v]) => '<a role="tab" class="wk-seg' + (k === per ? ' on' : '') + '" aria-selected="' + (k === per) + '" href="#leaderboard/' + k + '">' + v[0] + '</a>').join('') + '</div>' +
      (top ? '<p class="np-lead">' + esc(top.name) + ' leads ' + esc((PERIODS[per] || PERIODS.week)[0].toLowerCase()) + ' with ' + (top.appointments ? plural(top.appointments, 'appointment') : top.conversations ? plural(top.conversations, 'conversation') : plural(top.dials, 'dial')) + '.</p>' : '') +
      card('Ranking', fmtDay(from, { month:'short', day:'numeric' }) + ' to ' + fmtDay(to, { month:'short', day:'numeric' }),
        rows.length ? table(['#', 'Name', 'Shifts', 'Hours', 'Dials', 'Conv.', 'Offers', 'Appts', 'Conv. rate'], rows.map((x, i) => '<tr' + (x.me ? ' class="np-me"' : '') + '><td>' + medal(i) + '</td><td><b>' + esc(x.name) + '</b>' + (x.me ? ' ' + pill('You', '') : '') + (x.live ? ' ' + pill('On the clock now', 'ok') : '') + '</td><td>' + x.shifts + '</td><td>' + x.hours + '</td><td>' + num(x.dials) + '</td><td>' + num(x.conversations) + '</td><td>' + num(x.offers) + '</td><td><b>' + num(x.appointments) + '</b></td><td>' + rate(x.conversations, x.dials) + '</td></tr>')) : empty('No shifts in this period yet.')) +
      (owner ? card('Daily targets', 'Shown on each rep’s home', '<p class="tp-note">Leave a box empty for no target. Reps see their progress during the day.</p>' +
        table(['Rep'].concat(KEYS.map(k => k[1] + ' a day')).concat(['']), (ppl.data || []).map(p => { const t = (tg.data || []).find(x => x.user_id === p.user_id) || {};
          return '<tr data-tg="' + esc(p.user_id) + '"><td><b>' + esc(p.name) + '</b></td>' + KEYS.map(([k]) => '<td><input class="np-num" type="number" min="0" step="1" data-k="daily_' + k + '" value="' + (t['daily_' + k] != null ? t['daily_' + k] : '') + '" aria-label="' + esc(k) + ' target for ' + esc(p.name) + '"></td>').join('') +
            '<td><button type="button" class="p-btn is-ghost" data-tgsave>Save</button></td></tr>'; })) + '<p class="p-empty" id="tgMsg" role="status"></p>') : '');
    if (owner) body.addEventListener('click', async e => {
      const b = e.target.closest('[data-tgsave]'); if (!b) return;
      const rw = b.closest('[data-tg]'), row = { user_id:rw.dataset.tg, updated_at:new Date().toISOString() };
      rw.querySelectorAll('[data-k]').forEach(i => row[i.dataset.k] = i.value === '' ? null : Math.max(0, Math.round(+i.value)));
      const x = await safe(db().from('rep_targets').upsert(row));
      say('tgMsg', x.error ? errText(x, 'Couldn’t save. Try again.') : 'Saved.');
    });
  }};

  // Team home: today's targets and the script picker (reps only)
  async function targetsHtml(){
    if (T().role !== 'member') return '';
    const me = uid();
    const [tg, td, sh, lib, su] = await Promise.all([safe(db().from('rep_targets').select('*').eq('user_id', me).maybeSingle()), safe(db().rpc('portal_my_today')),
      safe(db().from('shifts').select('dials,conversations,offers,appointments').eq('user_id', me).eq('shift_date', today())),
      safe(db().from('library_entries').select('id,title,section,kind').eq('active', true).order('sort').limit(200)), safe(db().from('script_usage').select('entry_id').eq('user_id', me).eq('day', today()).maybeSingle())]);
    const t = tg.data || {}, taps = (Array.isArray(td.data) ? td.data[0] : td.data) || {}, done = {};
    KEYS.forEach(([k]) => { done[k] = Math.max(+taps[k] || 0, (sh.data || []).reduce((n, s) => n + (+s[k] || 0), 0)); });
    const goals = KEYS.filter(([k]) => t['daily_' + k]);
    const scripts = (lib.data || []).filter(e => !e.kind || /script|opener|call/i.test(e.kind + ' ' + (e.section || '')));
    const pick = scripts.length ? '<label class="sc-f np-script">Script I’m using today<select id="npScript">' + opt('', 'Pick one (helps Amr see what works)') + scripts.map(e => opt(e.id, e.title, su.data && su.data.entry_id === e.id)).join('') + '</select></label><span class="p-empty" id="npScriptMsg" role="status"></span>' : '';
    if (!goals.length && !pick) return '';
    return card('Today’s targets', goals.length ? goals.filter(([k]) => done[k] >= t['daily_' + k]).length + ' of ' + goals.length + ' hit' : '',
      (goals.length ? goals.map(([k, l]) => { const g = t['daily_' + k], v = done[k], p = Math.min(100, Math.round(v / g * 100));
        return '<div class="np-goal"><span>' + esc(l) + '</span><span class="np-bar"><i style="width:' + p + '%"' + (v >= g ? ' class="ok"' : '') + '></i></span><b>' + v + ' / ' + g + '</b></div>'; }).join('') + '<p class="tp-note">Counts from your taps today, or from your clock-out numbers.</p>' : '') + pick, 'npTargets');
  }
  if (window.PortalExtras && window.PortalExtras.home) {
    const orig = window.PortalExtras.home;
    window.PortalExtras.home = async function(dbx, el, ok){
      const p = orig.apply(this, arguments);
      if (el && T().role === 'member') {
        const [h] = await Promise.all([targetsHtml().catch(() => ''), Promise.resolve(p).catch(() => {})]);
        if (ok() && h) { const old = $('npTargets'); if (old) old.remove(); const box = el.parentNode.querySelector('.tp-home'); (box || el).insertAdjacentHTML(box ? 'beforeend' : 'beforebegin', h); }
      }
      return p;
    };
  }
  document.addEventListener('change', async e => {
    if (e.target.id !== 'npScript') return;
    const v = e.target.value; let x;
    if (v) x = await safe(db().from('script_usage').upsert({ user_id:uid(), day:today(), entry_id:+v }));
    else x = await safe(db().from('script_usage').delete().eq('user_id', uid()).eq('day', today()));
    const m = $('npScriptMsg'); if (m) m.textContent = x.error ? 'Couldn’t save.' : 'Saved.';
  });

  // ======================================================================
  // Weekly summary (Amr)
  // ======================================================================
  V.weekly = { title:'Weekly summary', sec:'owner', async open(el, ok){
    const which = location.hash.split('/')[1] === 'this' ? 'this' : 'last';
    const from = which === 'this' ? monday() : addDays(monday(), -7);
    const body = page(el, 'Numbers', 'Weekly summary', 'Everything that needs you this week on one page. Last week by default; switch to this week so far.');
    const r = await safe(db().rpc('portal_weekly_summary', { p_from:from }));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const d = r.data || {}, ppl = d.people || [], sum = k => ppl.reduce((n, p) => n + (+p[k] || 0), 0);
    const needs = [
      d.requests && ['#requests', plural(d.requests, 'missed-shift request'), 'Waiting for you'],
      d.time_off && ['#schedule', plural(d.time_off, 'time-off request'), 'Waiting for you'],
      d.applicants_new && ['#applications', plural(d.applicants_new, 'new applicant'), 'Not looked at yet'],
      +d.invoices_unpaid && ['#invoices', usd(d.invoices_unpaid) + ' in sent invoices', 'Not paid yet'],
      +d.commissions_owed && ['#weekly', usd(d.commissions_owed) + ' in commissions', 'Owed to reps']
    ].filter(Boolean);
    body.innerHTML = '<div class="p-seg np-seg"><a class="wk-seg' + (which === 'last' ? ' on' : '') + '" href="#weekly">Last week</a><a class="wk-seg' + (which === 'this' ? ' on' : '') + '" href="#weekly/this">This week so far</a></div>' +
      '<p class="np-lead">' + esc(fmtDay(d.from, { month:'short', day:'numeric' }) + ' to ' + fmtDay(d.to, { month:'short', day:'numeric' })) + '</p>' +
      tiles([[sum('hours').toFixed(1), 'hours worked'], [usd(sum('pay')), 'pay earned'], [usd(d.owed_all), 'pay owed (all time)', +d.owed_all > 0], [d.deals_closed + ' · ' + usd(d.profit_closed), 'deals closed · profit']]) +
      card('Calls to deals', '', '<div class="np-funnel">' + [['Dials', sum('dials')], ['Conversations', sum('conversations')], ['Offers', sum('offers')], ['Appointments', sum('appointments')], ['New deals', d.deals_new], ['Under contract', d.deals_contract], ['Closed', d.deals_closed]]
        .map(([l, v], i, a) => '<div class="np-step"><b>' + num(v) + '</b><span>' + l + '</span>' + (i && a[i - 1][1] ? '<small>' + rate(v, a[i - 1][1]) + '</small>' : '') + '</div>').join('') + '</div>') +
      card('By person', plural(ppl.length, 'person', 'people'), ppl.length ? table(['Name', 'Shifts', 'Hours', 'Pay', 'Not paid', 'Dials', 'Conv.', 'Offers', 'Appts'], ppl.map(p => tr(['<b>' + esc(p.name) + '</b>', p.shifts, p.hours, usd(p.pay), +p.unpaid ? '<b class="tp-bad">' + usd(p.unpaid) + '</b>' : usd(0), num(p.dials), num(p.conversations), num(p.offers), num(p.appointments)]))) : empty('No shifts this week.')) +
      '<div class="wk-two"><div>' +
      card('Needs you', needs.length ? String(needs.length) : 'All clear', needs.length ? needs.map(n => '<a class="p-row tp-row" href="' + n[0] + '"><span class="tp-row-t"><b>' + esc(n[1]) + '</b><small>' + esc(n[2]) + '</small></span></a>').join('') : empty('Nothing waiting on you.')) +
      card('Overdue tasks', String((d.overdue || []).length), (d.overdue || []).length ? d.overdue.map(t => '<a class="p-row tp-row" href="#tasks"><span class="tp-row-t"><b>' + esc(t.title) + '</b><small>' + esc(t.who) + ' · due ' + esc(fmtDay(t.due, { month:'short', day:'numeric' })) + '</small></span></a>').join('') : empty('No overdue tasks.')) +
      '</div><div>' +
      card('Late starts', String((d.late || []).length), (d.late || []).length ? d.late.map(l => '<div class="p-row"><span>' + esc(l.name) + '</span><span>' + esc(fmtDay(l.at, { weekday:'short', month:'short', day:'numeric' })) + '</span></div>').join('') : empty('Nobody started late.')) +
      card('Behind on lessons', String((d.behind || []).length), (d.behind || []).length ? d.behind.map(b => '<a class="p-row tp-row" href="#progress"><span class="tp-row-t"><b>' + esc(b.name) + '</b><small>' + (b.last ? 'Last lesson ' + esc(fmtDay(b.last, { month:'short', day:'numeric' })) : 'No lesson started yet') + '</small></span></a>').join('') : empty('Everyone studied this week.')) +
      '</div></div>' +
      card('Commissions to add', (d.no_commission || []).length ? plural(d.no_commission.length, 'closed deal') : 'None', (d.no_commission || []).length ? '<p class="tp-note">Closed deals with profit and no commission yet. Set the percent and add it; the rep sees it on their home and My month, and it shows in what you owe.</p>' +
        d.no_commission.map(c => '<form class="np-comm" data-deal="' + esc(c.deal_id) + '"><span class="tp-row-t"><b>' + esc([c.kind === 'house' ? 'House' : 'Land', c.county, c.state].filter(Boolean).join(', ')) + '</b><small>' + esc(c.rep) + ' · closed ' + esc(fmtDay(c.closed_on, { month:'short', day:'numeric' })) + ' · profit ' + usd(c.profit) + '</small></span>' +
          '<label class="sc-f px-inline">Percent<input type="number" min="1" max="100" step="0.5" value="10" data-pct></label><b data-amt>' + usd(c.profit * 0.1) + '</b><button class="p-btn" type="submit">Add</button></form>').join('') + '<p class="p-empty" id="ncMsg" role="status"></p>' : empty('Every closed deal has its commission.'));
    body.addEventListener('input', e => { const fm = e.target.closest('.np-comm'); if (!fm) return; const c = (d.no_commission || []).find(x => x.deal_id === fm.dataset.deal); fm.querySelector('[data-amt]').textContent = usd(c.profit * (+e.target.value || 0) / 100); });
    body.addEventListener('submit', async e => {
      const fm = e.target.closest('.np-comm'); if (!fm) return; e.preventDefault();
      const c = (d.no_commission || []).find(x => x.deal_id === fm.dataset.deal), pct = +fm.querySelector('[data-pct]').value;
      if (!(pct > 0 && pct <= 100)) return say('ncMsg', 'Type a percent between 1 and 100.');
      const x = await safe(db().from('commissions').insert({ deal_id:c.deal_id, deal_label:[c.kind === 'house' ? 'House' : 'Land', c.county, c.state].filter(Boolean).join(', ').slice(0, 120) || 'Deal', user_id:c.owner, rep_name:(c.rep || '').slice(0, 80),
        closed_on:c.closed_on, profit:c.profit, percent:pct, amount:Math.round(c.profit * pct) / 100, status:'owed', created_by:uid() }));
      if (x.error) return say('ncMsg', errText(x, 'Couldn’t add it. Try again.'));
      fm.remove(); say('ncMsg', 'Commission added for ' + c.rep + '.');
    });
  }};

  // ======================================================================
  // Client invoices (Amr)
  // ======================================================================
  const IST = { draft:['Draft', 'plain'], sent:['Sent', ''], paid:['Paid', 'ok'] };
  V.invoices = { title:'Client invoices', sec:'owner', async open(el, ok){
    const body = page(el, 'Money', 'Client invoices', 'Build an invoice from a client’s hours and rate, print it or save it as a PDF, mark it sent, then paid. A paid invoice is added to Cash as income, and its team shifts are marked paid by the client.');
    const [co, inv] = await Promise.all([safe(db().from('companies').select('id,name,bill_rate').order('name')), safe(db().from('invoices').select('*').order('created_at', { ascending:false }).limit(100))]);
    if (!ok()) return;
    if (inv.error) { body.innerHTML = failed(inv.error); return; }
    const cos = co.data || [], coName = id => (cos.find(c => c.id === id) || {}).name || 'Client', list = inv.data || [];
    const d = new Date(); const lastStart = isoDay(new Date(d.getFullYear(), d.getMonth() - 1, 1)), lastEnd = isoDay(new Date(d.getFullYear(), d.getMonth(), 0));
    body.innerHTML = card('New invoice', '', '<form class="px-form" id="ivForm" novalidate>' + f('Client', '<select id="ivCo">' + cos.map(c => opt(c.id, c.name + (c.bill_rate ? ' · $' + c.bill_rate + '/h' : ''))).join('') + '</select>') +
        f('From', '<input type="date" id="ivFrom" value="' + lastStart + '">') + f('To', '<input type="date" id="ivTo" value="' + lastEnd + '">') +
        f('Note on the invoice (optional)', '<input type="text" id="ivNote" maxlength="300" placeholder="e.g. Payment by bank transfer within 7 days">', 'px-wide') +
        '<div class="wk-row px-wide"><button class="p-btn is-ghost" type="button" id="ivPrev">Preview</button><button class="p-btn" type="submit">Create invoice</button></div><div id="ivOut" class="px-wide"></div><p class="p-empty" id="ivMsg" role="status"></p></form>') +
      card('Invoices', plural(list.length, 'invoice'), list.length ? table(['#', 'Client', 'Period', 'Hours', 'Amount', 'Status', ''], list.map(i => tr(['<b>' + i.number + '</b>', esc(coName(i.company_id)),
        esc(fmtDay(i.period_start, { month:'short', day:'numeric' }) + ' to ' + fmtDay(i.period_end, { month:'short', day:'numeric', year:'numeric' })), i.hours, '<b>' + usd(i.amount) + '</b>', pill(IST[i.status][0], IST[i.status][1]) + (i.paid_on ? ' <small>' + esc(fmtDay(i.paid_on, { month:'short', day:'numeric' })) + '</small>' : ''),
        '<div class="wk-row"><button type="button" class="p-btn is-ghost" data-ivview="' + i.id + '">View</button>' + (i.status === 'draft' ? '<button type="button" class="p-btn is-ghost" data-ivsent="' + i.id + '">Mark sent</button>' : '') + (i.status !== 'paid' ? '<button type="button" class="p-btn" data-ivpaid="' + i.id + '">Mark paid</button>' : '') + '</div>']))) : empty('No invoices yet.')) +
      '<div id="ivDoc"></div>';
    const preview = async () => {
      const x = await safe(db().rpc('portal_invoice_preview', { p_company:+$('ivCo').value, p_from:$('ivFrom').value, p_to:$('ivTo').value }));
      if (x.error) { say('ivMsg', errText(x, 'Couldn’t work it out. Try again.')); return null; }
      const p = x.data || { hours:0, amount:0, people:[] };
      $('ivOut').innerHTML = '<div class="np-prev">' + tiles([[p.hours, 'hours'], [usd(p.amount), 'amount'], [p.shifts, 'shifts']]) + (p.people.length ? table(['Person', 'Hours', 'Amount'], p.people.map(q => tr([esc(q.name), q.hours, usd(q.amount)]))) : '') + '</div>';
      return p;
    };
    $('ivPrev').addEventListener('click', preview);
    $('ivForm').addEventListener('submit', async e => {
      e.preventDefault(); const p = await preview(); if (!p) return;
      if (!(+p.amount > 0)) return say('ivMsg', 'No billable hours in that period.');
      const n = list.reduce((m, i) => Math.max(m, i.number), 1000) + 1;
      const x = await safe(db().from('invoices').insert({ company_id:+$('ivCo').value, number:n, period_start:$('ivFrom').value, period_end:$('ivTo').value, hours:p.hours, amount:p.amount, note:$('ivNote').value.trim() || null }));
      if (x.error) return say('ivMsg', errText(x, 'Couldn’t create it. Try again.'));
      V.invoices.open(el, ok);
    });
    body.addEventListener('click', async e => {
      const v = e.target.closest('[data-ivview]'), s = e.target.closest('[data-ivsent]'), pd = e.target.closest('[data-ivpaid]');
      const inv1 = list.find(i => i.id === +((v || s || pd || {}).dataset || {})[v ? 'ivview' : s ? 'ivsent' : 'ivpaid']);
      if (!inv1) { if (e.target.id === 'ivPrint') window.print(); return; }
      if (v) {
        const p = (await safe(db().rpc('portal_invoice_preview', { p_company:inv1.company_id, p_from:inv1.period_start, p_to:inv1.period_end }))).data || { people:[] };
        $('ivDoc').innerHTML = '<section class="p-card np-invoice" id="ivPaper"><div class="np-inv-head"><div><h2>Invoice #' + inv1.number + '</h2><p>Date: ' + esc(fmtDay(inv1.created_at, { month:'long', day:'numeric', year:'numeric' })) + '</p></div><div class="np-inv-from"><b>Amr Abdelgawad</b><p>amrabdelgawad.site</p></div></div>' +
          '<p><b>Bill to:</b> ' + esc(coName(inv1.company_id)) + '<br><b>Period:</b> ' + esc(fmtDay(inv1.period_start, { month:'long', day:'numeric' }) + ' to ' + fmtDay(inv1.period_end, { month:'long', day:'numeric', year:'numeric' })) + '</p>' +
          table(['Team member', 'Hours', 'Amount'], (p.people || []).map(q => tr([esc(q.name), q.hours, usd(q.amount)])).concat(['<tr class="np-total"><td><b>Total</b></td><td><b>' + inv1.hours + '</b></td><td><b>' + usd(inv1.amount) + '</b></td></tr>'])) +
          (inv1.note ? '<p class="np-inv-note">' + esc(inv1.note) + '</p>' : '') + '<div class="wk-row px-noprint"><button type="button" class="p-btn" id="ivPrint">Print or save as PDF</button></div></section>';
        $('ivPaper').scrollIntoView({ behavior:'smooth' });
      }
      if (s) { await safe(db().from('invoices').update({ status:'sent', sent_on:today() }).eq('id', inv1.id)); V.invoices.open(el, ok); }
      if (pd) {
        if (pd.dataset.sure !== '1') { pd.dataset.sure = '1'; pd.textContent = 'Sure? Adds ' + usd(inv1.amount) + ' to Cash'; return; }
        const c = await safe(db().from('cash_entries').insert({ kind:'income', entry_date:today(), title:('Invoice #' + inv1.number + ' · ' + coName(inv1.company_id)).slice(0, 120), party:coName(inv1.company_id).slice(0, 80), category:'Client invoice',
          amount:inv1.amount, hours:inv1.hours, settled:true, settled_at:new Date().toISOString(), currency:'USD', period_start:inv1.period_start, period_end:inv1.period_end }).select('id').single());
        if (c.error) { say('ivMsg', 'Couldn’t add it to Cash: ' + errText(c, 'try again.')); return; }
        await safe(db().from('invoices').update({ status:'paid', paid_on:today(), cash_entry_id:c.data.id }).eq('id', inv1.id));
        // The team shifts on this invoice are now paid by the client too, so Cash > Team doesn't ask for them again
        await safe(db().from('shifts').update({ client_paid:true, client_paid_at:new Date().toISOString() }).eq('company_id', inv1.company_id).eq('owner', false).eq('client_paid', false)
          .gte('shift_date', inv1.period_start).lte('shift_date', inv1.period_end));
        V.invoices.open(el, ok);
      }
    });
  }};

  // ======================================================================
  // Receipts on expenses (Amr)
  // ======================================================================
  V.receipts = { title:'Receipts', sec:'owner', async open(el, ok){
    const body = page(el, 'Money', 'Receipts', 'Attach a photo or PDF to each expense, so every cost has its proof. Files are private to you.');
    const r = await safe(db().from('cash_entries').select('id,entry_date,title,party,category,amount,currency,receipt_path').eq('kind', 'expense').order('entry_date', { ascending:false }).limit(200));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const list = r.data || [], missing = list.filter(x => !x.receipt_path).length;
    body.innerHTML = tiles([[list.length, 'recent expenses'], [list.length - missing, 'with a receipt'], [missing, 'missing a receipt', missing > 0]]) +
      card('Expenses', '', list.length ? list.map(x => '<div class="tp-doc" data-ex="' + x.id + '"><span class="tp-row-t"><b>' + esc(x.title) + '</b><small>' + esc([fmtDay(x.entry_date, { month:'short', day:'numeric', year:'numeric' }), x.category, x.party].filter(Boolean).join(' · ')) + '</small></span>' +
        '<b class="np-amt">' + (x.currency === 'EGP' ? num(x.amount) + ' EGP' : usd(x.amount)) + '</b>' +
        (x.receipt_path ? pill('Receipt', 'ok') + '<button type="button" class="p-btn is-ghost" data-rcview>View</button><button type="button" class="p-btn is-ghost" data-rcdel>Remove</button>'
          : '<label class="p-btn is-ghost np-file">Attach<input type="file" accept="image/*,application/pdf" data-rcfile hidden></label>') + '</div>').join('') : empty('No expenses yet. Add them in Cash.')) +
      '<p class="p-empty" id="rcMsg" role="status"></p>';
    body.addEventListener('change', async e => {
      const inp = e.target.closest('[data-rcfile]'); if (!inp || !inp.files[0]) return;
      const id = +inp.closest('[data-ex]').dataset.ex, file = inp.files[0];
      if (file.size > 15 * 1024 * 1024) return say('rcMsg', 'That file is over 15 MB.');
      say('rcMsg', 'Uploading…');
      const path = id + '/' + Date.now() + '-' + file.name.replace(/[^\w.\-]+/g, '_').slice(-60);
      const up = await db().storage.from('receipts').upload(path, file, { contentType:file.type || 'application/octet-stream' });
      if (up.error) return say('rcMsg', 'Couldn’t upload: ' + (up.error.message || 'try again.'));
      const x = await safe(db().from('cash_entries').update({ receipt_path:path }).eq('id', id));
      if (x.error) return say('rcMsg', errText(x, 'Couldn’t save it.'));
      V.receipts.open(el, ok);
    });
    body.addEventListener('click', async e => {
      const row = e.target.closest('[data-ex]'); if (!row) return;
      const x = list.find(y => y.id === +row.dataset.ex); if (!x || !x.receipt_path) return;
      if (e.target.closest('[data-rcview]')) { const s = await db().storage.from('receipts').createSignedUrl(x.receipt_path, 300); if (s.data) window.open(s.data.signedUrl, '_blank', 'noopener'); }
      const del = e.target.closest('[data-rcdel]');
      if (del) { if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Sure?'; return; } await db().storage.from('receipts').remove([x.receipt_path]); await safe(db().from('cash_entries').update({ receipt_path:null }).eq('id', x.id)); V.receipts.open(el, ok); }
    });
  }};

  // ======================================================================
  // Script testing (Amr)
  // ======================================================================
  V.scripttest = { title:'Script testing', sec:'owner', async open(el, ok){
    const body = page(el, 'Numbers', 'Script testing', 'Reps pick the script they use each day on their home page. This compares the results of each script over the last 60 days.');
    const r = await safe(db().rpc('portal_script_stats', { p_days:60 }));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const list = (r.data || []).map(x => Object.assign(x, { per100:x.dials ? Math.round(x.appointments / x.dials * 1000) / 10 : 0 }));
    const best = list.filter(x => x.dials >= 100).sort((a, b) => b.per100 - a.per100)[0];
    body.innerHTML = (best ? '<p class="np-lead">Best so far: <b>' + esc(best.title) + '</b>, ' + best.per100 + ' appointments per 100 dials.</p>' : '') +
      card('Results by script', 'Last 60 days', list.length ? table(['Script', 'Reps', 'Shifts', 'Dials', 'Conv. rate', 'Offers', 'Appts', 'Appts per 100 dials'], list.map(x => tr(['<b>' + esc(x.title) + '</b>' + (best && x.entry_id === best.entry_id ? ' ' + pill('Best', 'ok') : ''), x.reps, x.shifts, num(x.dials), rate(x.conversations, x.dials), num(x.offers), num(x.appointments), '<b>' + x.per100 + '</b>']))) :
        empty('No data yet. Once reps pick “Script I’m using today” on their home page, results show here.')) +
      '<p class="tp-note">A script needs at least 100 dials before it can be called the best. Results only count shifts where the rep picked a script.</p>';
  }};

  // ======================================================================
  // Lead lists: what each list brought in
  // ======================================================================
  if (V.lists) {
    const orig = V.lists.open;
    V.lists.open = async function(el, ok){
      await orig.call(this, el, ok);
      if (!ok()) return;
      const r = await safe(db().rpc('portal_list_stats'));
      const body = el.querySelector('.px-body'); if (!ok() || r.error || !body) return;
      const list = r.data || []; if (!list.length) return;
      const per = (cost, n) => cost && n ? usd(cost / n) : '–';
      body.insertAdjacentHTML('afterbegin', card('What each list brought in', 'Cost per result', table(['List', 'Cost', 'Dials', 'Conv.', 'Appts', 'Deals', 'Contracts', 'Closed', 'Profit', 'Per appt', 'Per deal'],
        list.map(l => tr(['<b>' + esc(l.name) + '</b>', l.cost != null ? usd(l.cost) : '–', num(l.dials), num(l.conversations), num(l.appointments), l.deals, l.contracts, l.closed, usd(l.profit), per(l.cost, l.appointments), per(l.cost, l.closed || l.contracts)])))));
    };
  }
})();
