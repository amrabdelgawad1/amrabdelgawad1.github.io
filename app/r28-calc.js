// Round 28 of the plan (Nov 19 2026): two new calculators beside the Land and House calculators (those stay as they are).
//   #creative  C4 Creative finance: seller finance (price, down payment, rate, amortization, optional balloon) and
//              subject-to (existing loan taken over, escrow, cash to seller, arrears, optional seller carry on the equity,
//              optional rent for cash flow). Monthly payment, full amortization schedule (monthly or by year), printable.
//   #costdeal  C6 Cost per deal: marketing spend divided by deals closed for a period. Spend comes from Cash expenses in
//              the categories you tick (EGP turned into USD at each entry's rate) plus lead list and skip trace costs;
//              deals closed come from the Deal CRM (closed date in the period). Both can be typed over by hand.
// No new tables: reads cash_entries, lead_lists and deals (each only as far as this person may read them).
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, usd, num, card, empty, pill, f, opt, isoDay, fmtDay } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch(e) { return null; } };
  const n = v => { const x = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(x) ? x : 0; };
  const r2 = x => Math.round(x * 100) / 100;

  // ======================================================================
  // Amortization (shared, also used by the tests): monthly payment and the schedule
  // ======================================================================
  function payment(loan, ratePct, months){
    if (loan <= 0 || months <= 0) return 0;
    const i = ratePct / 100 / 12;
    return r2(i ? loan * i / (1 - Math.pow(1 + i, -months)) : loan / months);
  }
  // rows: { k, date, pay, int, prin, bal }; stops at `stop` months (balloon) or when paid off; pay can be fixed
  function schedule(loan, ratePct, months, stop, start, fixedPay){
    const i = ratePct / 100 / 12, pay = fixedPay || payment(loan, ratePct, months), rows = [];
    let bal = loan; const end = Math.min(stop || months, months, 1200);
    for (let k = 1; k <= end && bal > 0.004; k++) {
      const int = r2(bal * i); let prin = r2(pay - int), p = pay;
      if (prin >= bal || k === months) { prin = r2(bal); p = r2(prin + int); }
      bal = r2(bal - prin);
      const d = start ? new Date(start.getFullYear(), start.getMonth() + k - 1, 1) : null;
      rows.push({ k, date:d, pay:p, int, prin, bal });
    }
    return rows;
  }
  window.R28Calc = { payment, schedule };

  const monthName = d => d ? d.toLocaleDateString('en-US', { month:'short', year:'numeric' }) : '';
  const startOf = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, 1) : null; };
  const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  function schedTable(rows, byYear, label){
    if (!rows.length) return empty('No payments.');
    let body;
    if (byYear) {
      const ys = []; rows.forEach(r => { const y = Math.ceil(r.k / 12); let g = ys[y - 1]; if (!g) g = ys[y - 1] = { y, pay:0, int:0, prin:0, bal:0, last:null }; g.pay += r.pay; g.int += r.int; g.prin += r.prin; g.bal = r.bal; g.last = r.date; });
      body = PX.table(['Year', 'Ends', 'Paid', 'Interest', 'Principal', 'Balance after'], ys.map(g => '<tr><td>' + g.y + '</td><td>' + esc(monthName(g.last)) + '</td><td>' + usd(g.pay) + '</td><td>' + usd(g.int) + '</td><td>' + usd(g.prin) + '</td><td>' + usd(g.bal) + '</td></tr>'));
    } else {
      body = PX.table(['#', 'Month', 'Payment', 'Interest', 'Principal', 'Balance after'], rows.map(r => '<tr><td>' + r.k + '</td><td>' + esc(monthName(r.date)) + '</td><td>' + usd(r.pay) + '</td><td>' + usd(r.int) + '</td><td>' + usd(r.prin) + '</td><td>' + usd(r.bal) + '</td></tr>'));
    }
    const t = rows.reduce((a, r) => { a.pay += r.pay; a.int += r.int; a.prin += r.prin; return a; }, { pay:0, int:0, prin:0 });
    return '<div class="r28-sched"><h3>' + esc(label) + '</h3>' + body + '<p class="p-hint">' + rows.length + ' payments · paid ' + usd(t.pay) + ' · interest ' + usd(t.int) + ' · principal ' + usd(t.prin) + '</p></div>';
  }
  const tile = (v, l, s) => '<div class="px-tile"><b>' + v + '</b><span>' + esc(l) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div>';
  const inp = (name, v, extra) => '<input type="number" inputmode="decimal" name="' + name + '" value="' + esc(v) + '" step="any" min="0"' + (extra || '') + '>';

  // ======================================================================
  // C4: #creative
  // ======================================================================
  V.creative = { title:'Creative finance calculator', sec:'deals', async open(el, ok){
    const body = PX.page(el, 'Deals', 'Creative finance calculator', 'Seller finance and subject-to payments with the full amortization schedule. Change any number and everything updates. Print the table for the seller or your files.');
    if (!ok()) return;
    let saved = {}; try { saved = JSON.parse(store('r28-c4') || '{}') || {}; } catch(e) {}
    const S = Object.assign({ tab:'sf', byYear:false,
      sf:{ price:150000, down:15000, rate:6, amort:30, balloon:5, start:nextMonth() },
      st:{ price:180000, bal:140000, rate:3.5, left:300, escrow:350, cash:5000, arrears:0, costs:2500, carryRate:0, carryYears:10, rent:0, start:nextMonth() } }, saved);
    const keep = () => store('r28-c4', JSON.stringify({ tab:S.tab, byYear:S.byYear, sf:S.sf, st:S.st }));

    function sfForm(v){
      return '<form class="px-form r28-calc" data-c4="sf" novalidate>' + f('Purchase price ($)', inp('price', v.price)) + f('Down payment ($)', inp('down', v.down)) + f('Interest rate (% a year)', inp('rate', v.rate)) +
        f('Amortized over (years)', inp('amort', v.amort, ' max="50"')) + f('Balloon after (years, blank = none)', inp('balloon', v.balloon || '', ' max="50"')) + f('First payment', '<input type="month" name="start" value="' + esc(v.start) + '">') + '</form>';
    }
    function stForm(v){
      return '<form class="px-form r28-calc" data-c4="st" novalidate>' + f('Purchase price ($)', inp('price', v.price)) + f('Loan balance you take over ($)', inp('bal', v.bal)) + f('Loan rate (% a year)', inp('rate', v.rate)) +
        f('Months left on the loan', inp('left', v.left, ' max="480"')) + f('Taxes and insurance a month ($)', inp('escrow', v.escrow)) + f('Cash to seller at closing ($)', inp('cash', v.cash)) +
        f('Missed payments to catch up ($)', inp('arrears', v.arrears)) + f('Closing costs ($)', inp('costs', v.costs)) +
        f('Seller carry on the rest: rate (%, 0 = none)', inp('carryRate', v.carryRate)) + f('Seller carry: years', inp('carryYears', v.carryYears, ' max="40"')) +
        f('Rent a month (optional, $)', inp('rent', v.rent)) + f('First payment', '<input type="month" name="start" value="' + esc(v.start) + '">') + '</form>';
    }
    function sfOut(v){
      const loan = Math.max(0, n(v.price) - n(v.down)), months = Math.round(n(v.amort) * 12), stop = n(v.balloon) ? Math.round(n(v.balloon) * 12) : 0;
      if (!loan || !months) return empty('Enter a price above the down payment and how many years it’s amortized over.');
      const pay = payment(loan, n(v.rate), months), rows = schedule(loan, n(v.rate), months, stop, startOf(v.start));
      const last = rows[rows.length - 1] || { bal:0 }, intPaid = rows.reduce((a, r) => a + r.int, 0), paid = rows.reduce((a, r) => a + r.pay, 0);
      const balloon = stop && stop < months ? last.bal : 0;
      return '<div class="px-tiles">' + tile(usd(pay), 'Monthly payment', 'principal and interest') + tile(usd(loan), 'Seller carries', Math.round(loan / n(v.price) * 100) + '% of the price') +
        tile(balloon ? usd(balloon) : 'None', 'Balloon', balloon ? 'due ' + monthName(new Date(startOf(v.start).getFullYear(), startOf(v.start).getMonth() + stop, 1)) : 'paid off over the term') +
        tile(usd(intPaid), 'Interest to the seller', stop && stop < months ? 'before the balloon' : 'over the term') +
        tile(usd(n(v.down) + paid + balloon), 'Seller gets in all', 'down + payments + balloon') + '</div>' +
        schedTable(rows, S.byYear, 'Seller finance schedule: ' + usd(loan) + ' at ' + n(v.rate) + '% over ' + n(v.amort) + ' years' + (balloon ? ', balloon after ' + n(v.balloon) + ' years' : ''));
    }
    function stOut(v){
      const bal = n(v.bal), months = Math.round(n(v.left)); if (!bal || !months) return empty('Enter the loan balance and the months left on it.');
      const pi = payment(bal, n(v.rate), months), piti = r2(pi + n(v.escrow)), equity = r2(n(v.price) - bal), carry = Math.max(0, r2(n(v.price) - bal - n(v.cash)));
      const carryMonths = Math.round(n(v.carryYears) * 12), carryPay = n(v.carryRate) > 0 && carry > 0 && carryMonths ? payment(carry, n(v.carryRate), carryMonths) : 0;
      const total = r2(piti + carryPay), flow = n(v.rent) ? r2(n(v.rent) - total) : null, close = r2(n(v.cash) + n(v.arrears) + n(v.costs));
      const rows = schedule(bal, n(v.rate), months, 0, startOf(v.start)), crow = carryPay ? schedule(carry, n(v.carryRate), carryMonths, 0, startOf(v.start)) : [];
      return '<div class="px-tiles">' + tile(usd(pi), 'Loan payment', 'principal and interest') + tile(usd(piti), 'With taxes and insurance', 'PITI') +
        tile(usd(close), 'Cash you need at closing', 'cash to seller + catch-up + costs') + tile(usd(equity), 'Seller’s equity', 'price minus the loan') +
        (carryPay ? tile(usd(carryPay), 'Seller carry payment', usd(carry) + ' at ' + n(v.carryRate) + '%') : '') +
        tile(usd(total), 'All payments a month', '') + (flow != null ? tile((flow < 0 ? '-' : '') + usd(Math.abs(flow)), 'Cash flow a month', 'rent minus all payments') : '') + '</div>' +
        (n(v.cash) + bal > n(v.price) ? '<p class="r28-bad">Cash to seller plus the loan is more than the price.</p>' : '') +
        schedTable(rows, S.byYear, 'Existing loan: ' + usd(bal) + ' at ' + n(v.rate) + '%, ' + months + ' months left') +
        (crow.length ? schedTable(crow, S.byYear, 'Seller carry: ' + usd(carry) + ' at ' + n(v.carryRate) + '% over ' + n(v.carryYears) + ' years') : '');
    }
    function draw(){
      const v = S[S.tab];
      body.innerHTML = '<div class="px-tools r28-tabs r28-noprint" role="tablist">' + [['sf', 'Seller finance'], ['st', 'Subject-to']].map(([k, l]) => '<button type="button" role="tab" class="p-btn' + (S.tab === k ? '' : ' is-ghost') + '" aria-selected="' + (S.tab === k) + '" data-c4tab="' + k + '">' + l + '</button>').join('') + '</div>' +
        '<section class="p-card r28-noprint">' + (S.tab === 'sf' ? sfForm(v) : stForm(v)) + '</section>' +
        '<div class="px-tools r28-noprint"><label class="r17-check"><input type="checkbox" data-c4year' + (S.byYear ? ' checked' : '') + '> Show the schedule by year</label><button type="button" class="p-btn is-ghost" data-c4print>Print the table</button><button type="button" class="p-btn is-ghost" data-c4reset>Start over</button></div>' +
        '<section class="p-card r28-print" id="c4Out"><h2 class="r28-only-print">' + (S.tab === 'sf' ? 'Seller finance' : 'Subject-to') + ' · ' + esc(fmtDay(new Date(), { month:'long', day:'numeric', year:'numeric' })) + '</h2>' + (S.tab === 'sf' ? sfOut(v) : stOut(v)) + '</section>' +
        '<p class="p-hint r28-noprint">Payments are rounded to the cent; the last one takes the leftover cents. A guide for talking numbers, not loan documents. Have a title company or attorney draw up the note.</p>';
    }
    function out(){ const o = $('c4Out'); if (!o) return; const h = o.querySelector('.r28-only-print'); o.innerHTML = (h ? h.outerHTML : '') + (S.tab === 'sf' ? sfOut(S.sf) : stOut(S.st)); }
    draw();
    body.addEventListener('input', e => { const fm = e.target.closest('[data-c4]'); if (!fm) return; S[fm.dataset.c4][e.target.name] = e.target.value; keep(); out(); });
    body.addEventListener('change', e => { if (e.target.matches('[data-c4year]')) { S.byYear = e.target.checked; keep(); out(); } });
    body.addEventListener('click', e => {
      const t = e.target.closest('[data-c4tab]'); if (t) { S.tab = t.dataset.c4tab; keep(); draw(); return; }
      if (e.target.closest('[data-c4print]')) { document.body.classList.add('r28-printing'); const done = () => { document.body.classList.remove('r28-printing'); removeEventListener('afterprint', done); }; addEventListener('afterprint', done); window.print(); setTimeout(done, 2000); return; }
      if (e.target.closest('[data-c4reset]')) { store('r28-c4', '{}'); V.creative.open(el, ok); }
    });
  }};

  // ======================================================================
  // C6: #costdeal
  // ======================================================================
  const MKT = /market|advert|ads\b|^ads|mail|postcard|list|skip|lead|sms|text|ppc|facebook|google|cold call|dialer/i;
  V.costdeal = { title:'Cost per deal', sec:'deals', async open(el, ok){
    const body = PX.page(el, 'Deals', 'Cost per deal', 'Marketing spend divided by deals closed. Spend comes from Cash and your lead lists, deals from the Deal CRM. Type over either number if you know better.');
    const y = new Date().getFullYear();
    const S = { from:y + '-01-01', to:isoDay(new Date()), cats:null, lists:store('r28-c6-lists') !== '0', spendOver:'', dealsOver:'', data:null };
    try { const c = JSON.parse(store('r28-c6-cats') || 'null'); if (Array.isArray(c)) S.cats = new Set(c); } catch(e) {}
    async function fetchAll(){
      const [ce, ll, dl] = await Promise.all([
        safe(db().from('cash_entries').select('entry_date,category,amount,currency,fx_rate,title').eq('kind', 'expense').gte('entry_date', S.from).lte('entry_date', S.to)),
        safe(db().from('lead_lists').select('name,cost,created_at,skip_cost,skip_sent_on').gte('created_at', S.from).lte('created_at', S.to + 'T23:59:59')),
        safe(db().from('deals').select('id,closed_on,profit,stage').not('closed_on', 'is', null).gte('closed_on', S.from).lte('closed_on', S.to))
      ]);
      S.data = { cash:ce.error ? null : (ce.data || []), lists:ll.error ? null : (ll.data || []), deals:dl.error ? null : (dl.data || []) };
      if (S.data.cash && !S.cats) S.cats = new Set([...new Set(S.data.cash.map(x => x.category || 'Other'))].filter(c => MKT.test(c)));
    }
    const toUsd = x => { const a = n(x.amount); if ((x.currency || 'USD') === 'USD') return a; return x.fx_rate ? a / n(x.fx_rate) : null; };
    function sums(){
      const d = S.data, out = { cash:0, cashN:0, noRate:0, lists:0, skip:0, deals:d.deals ? d.deals.length : 0, profit:0 };
      (d.cash || []).forEach(x => { if (!S.cats.has(x.category || 'Other')) return; const u = toUsd(x); if (u == null) { out.noRate++; return; } out.cash += u; out.cashN++; });
      if (S.lists) (d.lists || []).forEach(l => { out.lists += n(l.cost); out.skip += n(l.skip_cost); });
      (d.deals || []).forEach(x => { out.profit += n(x.profit); });
      out.auto = r2(out.cash + out.lists + out.skip);
      return out;
    }
    function draw(){
      const d = S.data, s = sums(), spend = S.spendOver !== '' ? n(S.spendOver) : s.auto, deals = S.dealsOver !== '' ? Math.round(n(S.dealsOver)) : s.deals;
      const per = deals ? spend / deals : null;
      const cats = d.cash ? [...new Set(d.cash.map(x => x.category || 'Other'))].sort() : [];
      body.innerHTML = '<section class="p-card"><form class="px-form r17-row" data-c6 novalidate>' + f('From', '<input type="date" name="from" value="' + esc(S.from) + '">') + f('To', '<input type="date" name="to" value="' + esc(S.to) + '">') +
        f('Marketing spend ($, blank = from Cash and lists)', '<input type="number" inputmode="decimal" name="spend" min="0" step="any" value="' + esc(S.spendOver) + '" placeholder="' + esc(r2(s.auto)) + '">') +
        f('Deals closed (blank = from the Deal CRM)', '<input type="number" inputmode="numeric" name="deals" min="0" step="1" value="' + esc(S.dealsOver) + '" placeholder="' + s.deals + '">') + '</form></section>' +
        '<div class="px-tiles r28-big-tiles">' + tile(per == null ? '–' : usd(per), 'Cost per deal', deals ? usd(spend) + ' ÷ ' + deals + (deals === 1 ? ' deal' : ' deals') : 'No deals closed in these dates') +
          tile(usd(spend), 'Marketing spend', S.spendOver !== '' ? 'typed by you' : 'from Cash and lead lists') + tile(num(deals), 'Deals closed', S.dealsOver !== '' ? 'typed by you' : 'from the Deal CRM') +
          (s.profit && S.dealsOver === '' ? tile(usd(s.profit / Math.max(1, s.deals)), 'Profit per deal', 'from the deals’ profit') : '') +
          (s.profit && spend && S.dealsOver === '' ? tile((s.profit / spend).toFixed(1) + 'x', 'Profit for each $1 spent', '') : '') + '</div>' +
        card('Where the spend comes from', S.spendOver !== '' ? pill('Your number is used', 'warn') : '',
          (d.cash ? '<fieldset class="r17-box"><legend>Cash expense categories that count as marketing</legend><div class="r17-chips">' + (cats.length ? cats.map(c => '<label><input type="checkbox" data-c6cat="' + esc(c) + '"' + (S.cats.has(c) ? ' checked' : '') + '> ' + esc(c) + '</label>').join('') : '<small>No expenses in these dates.</small>') + '</div>' +
            '<p class="p-hint">' + usd(s.cash) + ' from ' + s.cashN + ' expense' + (s.cashN === 1 ? '' : 's') + ' (EGP turned into USD at each entry’s rate)' + (s.noRate ? '. ' + s.noRate + ' EGP entr' + (s.noRate === 1 ? 'y has' : 'ies have') + ' no rate and were left out' : '') + '.</p></fieldset>'
            : '<p class="p-hint">Cash isn’t open to you, so type the spend above.</p>') +
          (d.lists ? '<label class="r17-check"><input type="checkbox" data-c6lists' + (S.lists ? ' checked' : '') + '> Add lead list and skip trace costs (' + usd(s.lists) + ' lists + ' + usd(s.skip) + ' skip tracing, lists added in these dates)</label>' : '') +
          (d.deals ? '' : '<p class="p-hint">The Deal CRM isn’t open to you, so type the deals closed above.</p>')) +
        '<p class="p-hint">Cost per deal = marketing spend ÷ deals closed in the same dates. Deals count when their closed date is in the range. Lists count when they were added in the range, so pick dates long enough for lists to turn into deals (3 to 6 months is common).</p>';
    }
    async function reload(){ body.innerHTML = PX.loading; await fetchAll(); if (ok()) draw(); }
    await reload();
    body.addEventListener('change', async e => {
      const t = e.target;
      if (t.name === 'from' || t.name === 'to') { S[t.name] = t.value; S.cats = S.cats || null; if (S.from && S.to) await reload(); return; }
      if (t.matches('[data-c6cat]')) { t.checked ? S.cats.add(t.dataset.c6cat) : S.cats.delete(t.dataset.c6cat); store('r28-c6-cats', JSON.stringify([...S.cats])); draw(); return; }
      if (t.matches('[data-c6lists]')) { S.lists = t.checked; store('r28-c6-lists', t.checked ? '1' : '0'); draw(); }
    });
    body.addEventListener('input', e => {
      const t = e.target; if (t.name !== 'spend' && t.name !== 'deals') return;
      S[t.name === 'spend' ? 'spendOver' : 'dealsOver'] = t.value; const pos = t.selectionStart, name = t.name; draw();
      const i = body.querySelector('[name="' + name + '"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch(er) {} }
    });
  }};
})();
