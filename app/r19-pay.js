// Round 19 of the Portal Master Feature Plan (Nov 18 2026): payroll. Amr only.
//   #payroll      T1 + T2. One screen per two-week pay cycle (same cycles as Cash › Team): who is owed what (unpaid
//                 hourly shifts up to the cycle's end, earned rule bonuses, owed commissions, bonuses and deductions).
//                 Approve saves the run; Mark paid records each payment (date, $1 in pounds, how, reference) and marks
//                 those exact shifts, bonuses, commissions and adjustments paid. The money itself is sent outside the
//                 portal. Payslip opens the person's payslip in Team hours for that cycle, now with bonuses,
//                 commissions and deductions on it. Bonuses and deductions always carry a reason.
//   #commissions  T3. Commission ledger for everyone: from closed deals (as before), per appointment from saved shifts
//                 (a rate per person), or added by hand. Owed or paid, per rep.
//   #billing      T17. Hours worked against what each client was billed: should bill (hours × rate), invoiced, not on
//                 any invoice yet, paid by the client, hours with no rate, team pay and margin.
// Database: pay_adjustments, commission_rates, commissions.source/shift_id/appointments, payroll_runs, payroll_lines;
// payroll_preview(), payroll_approve(), payroll_reopen(), payroll_line_paid(), payroll_line_unpaid(),
// payroll_slip_extras(), payroll_billing(), commission_sync(), my_pay_adjustments().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, fmtTime, usd, num, plural, card, empty, failed, pill, f, opt, table, tr, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const day = d => d ? fmtDay(d, { month:'short', day:'numeric', year:'numeric' }) : '–';
  const short = d => fmtDay(d, { month:'short', day:'numeric' });
  const today = () => isoDay(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoDay(d); };
  const hrs = h => (Math.round((+h || 0) * 100) / 100) + ' h';
  const tile = (v, k, s, hot) => '<div class="p-tile' + (hot ? ' r19-hot' : '') + '"><b>' + esc(v) + '</b><span>' + esc(k) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div>';
  const tiles = list => '<div class="p-tiles r20-tiles">' + list.join('') + '</div>';

  // Same two-week cycles as Cash › Team: Monday Sep 28 2026, every 14 days, work Monday to Friday twice
  const CYCLE_START = '2026-09-28';
  const cycleOf = d => { const n = Math.round((new Date(d + 'T12:00') - new Date(CYCLE_START + 'T12:00')) / 864e5); return addDays(CYCLE_START, Math.floor(n / 14) * 14); };
  const cycleText = from => short(from) + ' – ' + day(addDays(from, 11));
  const cycles = () => { const out = []; for (let c = cycleOf(today()), i = 0; c >= CYCLE_START && i < 26; c = addDays(c, -14), i++) out.push(c); return out; };
  const cycleOpts = sel => cycles().map((c, i) => opt(c, (i === 0 ? 'This cycle · ' : i === 1 ? 'Last cycle · ' : '') + cycleText(c), c === sel)).join('');

  const KIND = { shift:'Hours', award:'Bonus (rule)', bonus:'Bonus', commission:'Commission', deduction:'Deduction' };
  const METHODS = ['Remitly', 'Bank transfer', 'InstaPay', 'Vodafone Cash', 'Cash', 'Other'];

  async function latestFx(){
    const x = await safe(db().from('fx_rates').select('rate,from_date').order('from_date', { ascending:false }).limit(1));
    return x.data && x.data[0] ? +x.data[0].rate : null;
  }
  async function people(){
    const x = await safe(db().from('members').select('user_id,name,role,active').eq('active', true).neq('role', 'owner').order('name'));
    return (x.data || []).map(m => m.name);
  }
  // Payslip: Cash › Team hours opens it for this person and cycle (it reads this note once, within 5 minutes)
  function openSlip(name, from){
    try { localStorage.setItem('r19-slip', JSON.stringify({ name, from, at:Date.now() })); } catch(e) {}
    location.hash = '#team/' + encodeURIComponent(name);
  }

  // ======================================================================
  // #payroll
  // ======================================================================
  V.payroll = { title:'Payroll', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Team', 'Payroll', 'Every other Friday: who is owed what for the pay cycle, approve it, mark each person paid, and make their payslip. This page prepares and tracks pay only; you send the money yourself.');
    // Opens on the current cycle: its pay day is the Friday it ends (earlier unpaid shifts carry into it)
    const S = { from:cycleOf(today()), open:null, paying:null, fx:null, names:[] };
    [S.fx, S.names] = await Promise.all([latestFx(), people()]);
    let D = null;
    async function load(){
      body.innerHTML = PX.loading;
      const [p, adj] = await Promise.all([
        safe(db().rpc('payroll_preview', { p_from:S.from })),
        safe(db().from('pay_adjustments').select('*').eq('cycle_from', S.from).neq('status', 'cancelled').order('created_at', { ascending:false }))
      ]);
      if (!ok()) return;
      if (p.error) { body.innerHTML = failed(p.error); return; }
      D = p.data || {}; D.adj = adj.data || [];
      draw();
    }
    function draw(){
      const run = D.run, ppl = D.people || [], lines = run ? run.lines || [] : [];
      const rows = run ? lines : ppl.filter(x => +x.net > 0 || (x.items || []).length);
      const sum = (l, k) => l.reduce((a, x) => a + (+x[k] || 0), 0);
      const total = sum(rows, 'net'), paid = run ? sum(lines.filter(l => l.status === 'paid'), 'net') : 0;
      const status = !run ? pill('Not approved yet', '') : run.status === 'paid' ? pill('All paid', 'ok') : pill('Approved', 'plain');
      const payDayNote = D.pay_days_setting ? '' : ' · set your pay days on Earnings to move this';
      // Since approval: anything new owed for this cycle shows up here, to add by reopening or to roll into the next run
      const newer = run ? ppl.map(x => { const l = lines.find(y => y.person_key === x.k); const extra = Math.round(((+x.net) - (l && l.status === 'owed' ? +l.net : 0)) * 100) / 100; return { name:x.name, extra }; }).filter(x => x.extra > 0.004 && run.status !== 'paid') : [];
      body.innerHTML =
        '<div class="px-form r20-row">' + f('Pay cycle', '<select id="r19Cyc">' + cycleOpts(S.from) + '</select>') +
          '<div class="px-tools r19-status">' + status + ' <span class="p-hint">Pay day ' + esc(fmtDay(D.pay_day, { weekday:'long', month:'short', day:'numeric' })) + esc(payDayNote) + '</span></div></div>' +
        '<p class="p-card r19-note">Payroll here only prepares and records pay. Send the money yourself (Remitly, bank, InstaPay), then press <b>Mark paid</b> for that person.</p>' +
        tiles([
          tile(usd(total), run ? 'in this run' : 'owed for this cycle', plural(rows.length, 'person', 'people'), total > 0 && (!run || run.status !== 'paid')),
          tile(hrs(sum(rows, run ? 'hours' : 'hours_due')), 'hours to pay', 'Commission-based hours aren’t paid by the hour'),
          tile(usd(sum(rows, 'bonuses') + sum(rows, 'commissions')), 'bonuses and commissions', ''),
          tile(usd(sum(rows, 'deductions')), 'deductions', ''),
          tile(usd(paid), 'marked paid', run && run.paid_at ? 'all paid ' + day(run.paid_at) : '')
        ]) +
        (newer.length ? '<p class="p-card r19-warn">Owed since you approved: ' + newer.map(x => esc(x.name) + ' ' + usd(x.extra)).join(', ') + '. Reopen the run to add it, or it moves into the next cycle on its own.</p>' : '') +
        card(run ? 'This run' : 'Who is owed what', run ? 'approved ' + esc(day(run.approved_at)) + ' ' + esc(fmtTime(run.approved_at)) : esc(cycleText(D.cycle_from)),
          rows.length ? '<div class="p-tablewrap"><table class="p-table px-table r19-table"><thead><tr>' + ['Person', 'Hours', 'Pay', 'Bonuses', 'Commissions', 'Deductions', 'To pay', run ? 'Status' : '', ''].map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
            rows.map(x => personRow(x, run)).join('') + '</tbody></table></div>' : empty('Nobody is owed anything for this cycle.')) +
        (run ? '' : '<form class="px-form r20-row" id="r19ApForm" novalidate>' + f('Note on this run (optional)', '<input type="text" id="r19ApNote" maxlength="300" placeholder="e.g. Youssef asked for Monday">', 'px-wide') +
          '<div class="px-tools px-wide"><button type="submit" class="p-btn"' + (rows.length ? '' : ' disabled') + '>Approve this run</button><span class="p-hint" id="r19ApMsg" role="status">Approving saves exactly what each person is owed now. Nothing is paid or sent.</span></div></form>') +
        (run && run.status !== 'paid' && !lines.some(l => l.status === 'paid') ? '<div class="px-tools"><button type="button" class="p-btn is-ghost" id="r19Reopen">Reopen this run</button><span class="p-hint" id="r19RoMsg" role="status"></span></div>' : '') +
        adjCard() +
        card('Past runs', plural((D.runs || []).length, 'run'), (D.runs || []).length ? table(['Cycle', 'Pay day', 'People', 'Total', 'Paid', 'Status'], D.runs.map(r => tr(['<a href="#payroll" data-r19go="' + esc(r.cycle_from) + '">' + esc(cycleText(r.cycle_from)) + '</a>', esc(day(r.pay_day)), num(r.people), usd(r.total), usd(r.paid), r.status === 'paid' ? pill('All paid', 'ok') : pill('Approved', 'plain')]))) : empty('No runs approved yet.'));
    }
    function personRow(x, run){
      const name = x.name, key = x.person_key || x.k, items = x.items || [], openNow = S.open === key;
      const earlier = !run && +x.pay_earlier > 0 ? '<small class="r19-sub">' + usd(x.pay_earlier) + ' from earlier cycles</small>' : '';
      const st = run ? (x.status === 'paid' ? pill('Paid ' + short(x.paid_on), 'ok') + (x.method ? '<small class="r19-sub">' + esc(x.method) + (x.ref ? ' · ' + esc(x.ref) : '') + '</small>' : '') : pill('To pay', '')) : '';
      const acts = '<span class="r17-acts">' + '<button type="button" class="p-btn is-ghost" data-r19det="' + esc(key) + '" aria-expanded="' + openNow + '">' + (openNow ? 'Hide' : 'Details') + '</button>' +
        '<button type="button" class="p-btn is-ghost" data-r19slip="' + esc(name) + '">Payslip</button>' +
        (run && x.status === 'owed' ? '<button type="button" class="p-btn" data-r19pay="' + x.id + '">Mark paid</button>' : '') +
        (run && x.status === 'paid' ? '<button type="button" class="p-btn is-ghost" data-r19unpay="' + x.id + '">Undo paid</button>' : '') + '</span>';
      let html = '<tr><td><b>' + esc(name) + '</b></td><td>' + hrs(run ? x.hours : x.hours_due) + (!run && +x.commission_hours ? '<small class="r19-sub">' + hrs(x.commission_hours) + ' commission based</small>' : '') + '</td><td>' + usd(x.pay) + earlier + '</td><td>' + usd(x.bonuses) + '</td><td>' + usd(x.commissions) + '</td><td>' + (+x.deductions ? '−' + usd(x.deductions) : usd(0)) + '</td><td><b>' + usd(x.net) + '</b></td><td>' + st + '</td><td>' + acts + '</td></tr>';
      if (openNow) html += '<tr class="r19-detail"><td colspan="9">' + (items.length ? table(['What', 'Date', 'Detail', 'Amount'], items.map(i => tr([esc(KIND[i.t] || i.t), esc(day(i.d)), i.t === 'shift' ? hrs(i.secs / 3600) + (i.d < D.cycle_from ? ' · earlier cycle' : '') : esc(i.label || ''), (i.t === 'deduction' ? '−' : '') + usd(i.amt)]))) : empty('Nothing owed.')) + '</td></tr>';
      if (run && S.paying === x.id) html += '<tr class="r19-detail"><td colspan="9">' + payForm(x) + '</td></tr>';
      return html;
    }
    function payForm(x){
      return '<form class="px-form r20-row" id="r19PayForm" data-line="' + x.id + '" novalidate>' +
        '<p class="p-hint px-wide"><b>Record a payment of ' + usd(x.net) + ' to ' + esc(x.name) + '.</b> This only records it: send the money yourself first. Their shifts, bonuses, commissions and deductions in this run are marked paid. They get a bell in the portal for paid bonuses and commissions, the same as when you mark those paid on their own.</p>' +
        f('Paid on', '<input type="date" id="r19PayOn" value="' + today() + '" max="' + addDays(today(), 1) + '">') +
        f('$1 in pounds that day', '<input type="number" id="r19PayFx" min="1" max="1000" step="0.01" value="' + (S.fx || '') + '">') +
        f('How', '<select id="r19PayM">' + METHODS.map(m => opt(m, m, m === 'Remitly')).join('') + '</select>') +
        f('Reference (optional)', '<input type="text" id="r19PayRef" maxlength="80" placeholder="e.g. Remitly transfer number">') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">Mark ' + esc(x.name.split(' ')[0]) + ' paid</button><button type="button" class="p-btn is-ghost" id="r19PayX">Cancel</button><span class="p-hint" id="r19PayMsg" role="status"></span></div></form>';
    }
    function adjCard(){
      const names = [...new Set((D.people || []).map(p => p.name).concat(S.names))].sort();
      const list = D.adj;
      return card('Bonuses and deductions', list.length ? plural(list.length, 'line') + ' this cycle' : 'none this cycle',
        (list.length ? table(['Person', 'Type', 'Reason', 'Amount', 'Status', ''], list.map(a => tr([esc(a.name), a.kind === 'bonus' ? pill('Bonus', 'ok') : pill('Deduction', ''), esc(a.reason), (a.kind === 'deduction' ? '−' : '+') + usd(a.amount),
            a.status === 'paid' ? pill('Paid ' + short(a.paid_on), 'ok') : pill('Not paid yet', 'plain'), a.status === 'open' ? '<button type="button" class="p-btn is-ghost" data-r19adel="' + a.id + '">Remove</button>' : '']))) : empty('None for this cycle yet.')) +
        '<form class="px-form r20-row" id="r19AdjForm" novalidate>' +
          f('Person', '<select id="r19AdjP">' + names.map(n => opt(n, n)).join('') + '</select>') +
          f('Type', '<select id="r19AdjK">' + opt('bonus', 'Bonus') + opt('deduction', 'Deduction') + '</select>') +
          f('Amount (USD)', '<input type="number" id="r19AdjA" min="0.5" step="0.5" placeholder="10">') +
          f('Reason (shown on the payslip)', '<input type="text" id="r19AdjR" maxlength="200" placeholder="e.g. Best week in October / Advance paid on Nov 3">', 'px-wide') +
          '<div class="px-tools px-wide"><button type="submit" class="p-btn">Add to this cycle</button><span class="p-hint" id="r19AdjMsg" role="status">Open ones carry into the next run until they are paid.</span></div></form>');
    }
    await load();
    body.addEventListener('change', e => { if (e.target.id === 'r19Cyc') { S.from = e.target.value; S.open = S.paying = null; load(); } });
    body.addEventListener('click', async e => {
      const go = e.target.closest('[data-r19go]'); if (go) { e.preventDefault(); S.from = go.dataset.r19go; S.open = S.paying = null; load(); window.scrollTo(0, 0); return; }
      const det = e.target.closest('[data-r19det]'); if (det) { S.open = S.open === det.dataset.r19det ? null : det.dataset.r19det; draw(); return; }
      const sl = e.target.closest('[data-r19slip]'); if (sl) { openSlip(sl.dataset.r19slip, D.cycle_from); return; }
      const pay = e.target.closest('[data-r19pay]'); if (pay) { S.paying = +pay.dataset.r19pay; draw(); const fx = $('r19PayFx'); if (fx) fx.focus(); return; }
      if (e.target.id === 'r19PayX') { S.paying = null; draw(); return; }
      const un = e.target.closest('[data-r19unpay]');
      if (un) {
        if (un.dataset.sure !== '1') { un.dataset.sure = '1'; un.textContent = 'Sure? Back to owed'; setTimeout(() => { if (un.isConnected) { un.dataset.sure = ''; un.textContent = 'Undo paid'; } }, 4000); return; }
        un.disabled = true; const x = await safe(db().rpc('payroll_line_unpaid', { p_line:+un.dataset.r19unpay })); if (x.error) { un.disabled = false; un.textContent = errText(x, 'Couldn’t undo it.'); return; } load(); return;
      }
      if (e.target.id === 'r19Reopen') {
        const b = e.target; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? You approve it again after'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = 'Reopen this run'; } }, 4000); return; }
        b.disabled = true; const x = await safe(db().rpc('payroll_reopen', { p_run:D.run.id })); if (x.error) { b.disabled = false; say('r19RoMsg', errText(x, 'Couldn’t reopen it.')); return; } load(); return;
      }
      const ad = e.target.closest('[data-r19adel]');
      if (ad) { ad.disabled = true; const x = await safe(db().from('pay_adjustments').update({ status:'cancelled' }).eq('id', +ad.dataset.r19adel).eq('status', 'open')); if (x.error) { ad.disabled = false; return; } load(); }
    });
    body.addEventListener('submit', async e => {
      e.preventDefault();
      if (e.target.id === 'r19ApForm') {
        const b = e.target.querySelector('button'); b.disabled = true; say('r19ApMsg', 'Saving…');
        const x = await safe(db().rpc('payroll_approve', { p_from:S.from, p_note:$('r19ApNote').value }));
        if (x.error) { b.disabled = false; say('r19ApMsg', errText(x, 'Couldn’t approve it. Try again.')); return; }
        load(); return;
      }
      if (e.target.id === 'r19PayForm') {
        const fx = +$('r19PayFx').value, on = $('r19PayOn').value;
        if (!(fx > 0)) return say('r19PayMsg', 'Type what $1 was in pounds on the day you paid.');
        if (!on) return say('r19PayMsg', 'Pick the day you paid.');
        const b = e.target.querySelector('button[type=submit]'); b.disabled = true; say('r19PayMsg', 'Saving…');
        const x = await safe(db().rpc('payroll_line_paid', { p_line:+e.target.dataset.line, p_fx:fx, p_on:on, p_method:$('r19PayM').value, p_ref:$('r19PayRef').value }));
        if (x.error) { b.disabled = false; say('r19PayMsg', errText(x, 'Couldn’t save it. Try again.')); return; }
        S.paying = null; S.fx = fx; load(); return;
      }
      if (e.target.id === 'r19AdjForm') {
        const row = { name:$('r19AdjP').value, kind:$('r19AdjK').value, amount:+$('r19AdjA').value, reason:$('r19AdjR').value.trim(), cycle_from:S.from, person_key:'' };
        if (!row.name) return say('r19AdjMsg', 'Pick a person.');
        if (!(row.amount > 0)) return say('r19AdjMsg', 'Type an amount.');
        if (row.reason.length < 2) return say('r19AdjMsg', 'Add a reason. It shows on the payslip.');
        const x = await safe(db().from('pay_adjustments').insert(row));
        if (x.error) return say('r19AdjMsg', errText(x, 'Couldn’t add it. Try again.'));
        if (D.run && D.run.status !== 'paid') say('r19AdjMsg', 'Added. Reopen the run to include it, or it goes into the next one.');
        load();
      }
    });
  } };

  // ======================================================================
  // #commissions: the ledger
  // ======================================================================
  const SRC = { deal:'Deal', appointment:'Appointments', manual:'Added by you' };
  V.commissions = { title:'Commissions', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Team', 'Commissions', 'Every commission in one place: from closed deals, per appointment from saved shifts, or added by hand. Owed or paid, per person. Owed ones are paid with the next payroll run.');
    const S = { who:'', st:'', src:'', synced:null, names:[] };
    S.names = await people();
    const sy = await safe(db().rpc('commission_sync'));
    S.synced = sy.error ? null : +sy.data || 0;
    async function load(){
      body.innerHTML = PX.loading;
      const [c, r] = await Promise.all([safe(db().from('commissions').select('*').order('closed_on', { ascending:false, nullsFirst:false }).order('id', { ascending:false }).limit(1000)), safe(db().from('commission_rates').select('*').order('name'))]);
      if (!ok()) return;
      if (c.error) { body.innerHTML = failed(c.error); return; }
      draw(c.data || [], r.data || []);
    }
    function draw(list, rates){
      const who = n => (n.rep_name || '').trim();
      const names = [...new Set(list.map(who).concat(S.names))].filter(Boolean).sort();
      const shown = list.filter(c => (!S.who || who(c) === S.who) && (!S.st || c.status === S.st) && (!S.src || (c.source || 'deal') === S.src));
      const owed = list.filter(c => c.status === 'owed'), month = today().slice(0, 7);
      const sum = l => l.reduce((a, c) => a + +c.amount, 0);
      const per = names.map(n => { const l = list.filter(c => who(c) === n); return { n, owed:sum(l.filter(c => c.status === 'owed')), paid:sum(l.filter(c => c.status === 'paid')), cnt:l.length }; }).filter(p => p.cnt);
      body.innerHTML =
        (S.synced ? '<p class="p-card r19-note">' + plural(S.synced, 'appointment commission') + ' added from saved shifts just now.</p>' : '') +
        tiles([tile(usd(sum(owed)), 'owed', plural(owed.length, 'commission'), owed.length > 0), tile(usd(sum(list.filter(c => c.status === 'paid' && (c.paid_on || '').slice(0, 7) === month))), 'paid this month', ''), tile(usd(sum(list)), 'all time', plural(list.length, 'commission'))]) +
        card('By person', plural(per.length, 'person', 'people'), per.length ? table(['Person', 'Owed', 'Paid', 'Commissions'], per.map(p => tr(['<a href="#commissions" data-r19who="' + esc(p.n) + '"><b>' + esc(p.n) + '</b></a>', p.owed ? '<b>' + usd(p.owed) + '</b>' : usd(0), usd(p.paid), num(p.cnt)]))) : empty('No commissions yet.')) +
        card('Ledger', plural(shown.length, 'line'),
          '<div class="px-form r20-row">' + f('Person', '<select id="r19cW">' + opt('', 'Everyone') + names.map(n => opt(n, n, n === S.who)).join('') + '</select>') +
            f('Status', '<select id="r19cS">' + opt('', 'Owed and paid') + opt('owed', 'Owed', S.st === 'owed') + opt('paid', 'Paid', S.st === 'paid') + '</select>') +
            f('From', '<select id="r19cR">' + opt('', 'All') + Object.keys(SRC).map(k => opt(k, SRC[k], S.src === k)).join('') + '</select>') + '</div>' +
          (shown.length ? table(['Date', 'Person', 'For', 'From', 'Amount', 'Status', ''], shown.map(c => tr([esc(day(c.closed_on)), esc(who(c) || '–'), esc(c.deal_label) + (c.note ? '<small class="r19-sub">' + esc(c.note) + '</small>' : ''), esc(SRC[c.source || 'deal']) + (c.source === 'appointment' && c.per_appointment ? '<small class="r19-sub">' + usd(c.per_appointment) + ' each</small>' : ''),
              '<b>' + usd(c.amount) + '</b>', c.status === 'paid' ? pill('Paid ' + short(c.paid_on), 'ok') : pill('Owed', ''),
              '<span class="r17-acts">' + (c.status === 'owed' ? '<button type="button" class="p-btn is-ghost" data-r19cpaid="' + c.id + '">Mark paid</button>' : '<button type="button" class="p-btn is-ghost" data-r19cowed="' + c.id + '">Back to owed</button>') +
              (c.status === 'owed' && c.source !== 'deal' ? '<button type="button" class="p-btn is-ghost" data-r19cdel="' + c.id + '">Delete</button>' : '') + '</span>']))) : empty('Nothing matches.')) +
          '<p class="p-hint">Paying through Payroll marks these paid for you. Mark paid here only for one you paid on its own. Each commission is also a line in Cash › Expenses (category Commissions).</p>') +
        card('Per-appointment rates', plural(rates.filter(r => r.active).length, 'active rate'),
          (rates.length ? rates.map(r => '<div class="p-row"><span><b>' + esc(r.name) + '</b> ' + (r.active ? pill('On', 'ok') : pill('Off', 'plain')) + '<br><small>' + usd(r.per_appointment) + ' per appointment · from ' + esc(day(r.starts_on)) + (r.on_commission_shifts ? ' · also on commission-based shifts' : ' · hourly shifts only') + '</small></span>' +
            '<span class="r17-acts"><button type="button" class="p-btn is-ghost" data-r19rtog="' + r.id + '">' + (r.active ? 'Turn off' : 'Turn on') + '</button><button type="button" class="p-btn is-ghost" data-r19rdel="' + r.id + '">Delete</button></span></div>').join('') : empty('No rates yet. Add one to pay a person per appointment they set.')) +
          '<form class="px-form r20-row" id="r19RateForm" novalidate>' +
            f('Person', '<select id="r19rP">' + names.map(n => opt(n, n)).join('') + '</select>') +
            f('Per appointment (USD)', '<input type="number" id="r19rA" min="0.5" step="0.5" placeholder="5">') +
            f('Count from', '<input type="date" id="r19rD" value="' + today() + '">') +
            '<label class="r20-sw px-wide"><input type="checkbox" id="r19rC"> Also count commission-based shifts (normally the client pays those)</label>' +
            '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save rate</button><span class="p-hint" id="r19rMsg" role="status">Appointments come from what reps type when they clock out. A shift’s commission is added when you open this page or Payroll.</span></div></form>') +
        card('Add a commission by hand', '',
          '<form class="px-form r20-row" id="r19ManForm" novalidate>' +
            f('Person', '<select id="r19mP">' + names.map(n => opt(n, n)).join('') + '</select>') +
            f('For', '<input type="text" id="r19mL" maxlength="120" placeholder="e.g. Referral that closed">', 'px-wide') +
            f('Amount (USD)', '<input type="number" id="r19mA" min="0.5" step="0.5">') +
            f('Date', '<input type="date" id="r19mD" value="' + today() + '" max="' + today() + '">') +
            '<div class="px-tools px-wide"><button type="submit" class="p-btn">Add commission</button><span class="p-hint" id="r19mMsg" role="status">They get a bell in the portal when it is added.</span></div></form>');
    }
    await load();
    body.addEventListener('change', e => {
      if (e.target.id === 'r19cW') { S.who = e.target.value; load(); }
      if (e.target.id === 'r19cS') { S.st = e.target.value; load(); }
      if (e.target.id === 'r19cR') { S.src = e.target.value; load(); }
    });
    body.addEventListener('click', async e => {
      const w = e.target.closest('[data-r19who]'); if (w) { e.preventDefault(); S.who = w.dataset.r19who; load(); return; }
      const pd = e.target.closest('[data-r19cpaid]'), ow = e.target.closest('[data-r19cowed]');
      if (pd || ow) { const b = pd || ow; b.disabled = true; const x = await safe(db().from('commissions').update(pd ? { status:'paid', paid_on:today() } : { status:'owed', paid_on:null }).eq('id', +(b.dataset.r19cpaid || b.dataset.r19cowed))); if (x.error) { b.disabled = false; b.textContent = errText(x, 'Couldn’t change it.'); return; } load(); return; }
      const dl = e.target.closest('[data-r19cdel]');
      if (dl) {
        if (window.PortalUI && PortalUI.del) { PortalUI.del(dl, { text:'Commission deleted.', label:'Delete', sel:'tr', run:() => safe(db().from('commissions').delete().eq('id', +dl.dataset.r19cdel).eq('status', 'owed')), after:() => load() }); return; }
        if (dl.dataset.sure !== '1') { dl.dataset.sure = '1'; dl.textContent = 'Sure?'; setTimeout(() => { if (dl.isConnected) { dl.dataset.sure = ''; dl.textContent = 'Delete'; } }, 4000); return; }
        dl.disabled = true; const x = await safe(db().from('commissions').delete().eq('id', +dl.dataset.r19cdel).eq('status', 'owed')); if (x.error) { dl.disabled = false; return; } load(); return;
      }
      const tg = e.target.closest('[data-r19rtog]');
      if (tg) { tg.disabled = true; const x = await safe(db().from('commission_rates').update({ active:tg.textContent === 'Turn on' }).eq('id', +tg.dataset.r19rtog)); if (x.error) { tg.disabled = false; return; } load(); return; }
      const rd = e.target.closest('[data-r19rdel]');
      if (rd) {
        if (window.PortalUI && PortalUI.del) { PortalUI.del(rd, { text:'Rate deleted. Commissions already added stay.', label:'Delete', sel:'.p-row', run:() => safe(db().from('commission_rates').delete().eq('id', +rd.dataset.r19rdel)), after:() => load() }); return; }
        if (rd.dataset.sure !== '1') { rd.dataset.sure = '1'; rd.textContent = 'Sure? Added ones stay'; setTimeout(() => { if (rd.isConnected) { rd.dataset.sure = ''; rd.textContent = 'Delete'; } }, 4000); return; }
        rd.disabled = true; const x = await safe(db().from('commission_rates').delete().eq('id', +rd.dataset.r19rdel)); if (x.error) { rd.disabled = false; return; } load();
      }
    });
    body.addEventListener('submit', async e => {
      e.preventDefault();
      if (e.target.id === 'r19RateForm') {
        const row = { name:$('r19rP').value, person_key:'', per_appointment:+$('r19rA').value, starts_on:$('r19rD').value || today(), on_commission_shifts:$('r19rC').checked, active:true };
        if (!row.name) return say('r19rMsg', 'Pick a person.');
        if (!(row.per_appointment > 0)) return say('r19rMsg', 'Type the amount per appointment.');
        const x = await safe(db().from('commission_rates').upsert(row, { onConflict:'person_key' }));
        if (x.error) return say('r19rMsg', errText(x, 'Couldn’t save it. Try again.'));
        const sy = await safe(db().rpc('commission_sync')); S.synced = sy.error ? null : +sy.data || 0;
        load(); return;
      }
      if (e.target.id === 'r19ManForm') {
        const row = { source:'manual', rep_name:$('r19mP').value, deal_label:$('r19mL').value.trim(), amount:+$('r19mA').value, closed_on:$('r19mD').value || today(), status:'owed' };
        if (!row.rep_name) return say('r19mMsg', 'Pick a person.');
        if (row.deal_label.length < 2) return say('r19mMsg', 'Say what it is for.');
        if (!(row.amount > 0)) return say('r19mMsg', 'Type an amount.');
        const x = await safe(db().from('commissions').insert(row));
        if (x.error) return say('r19mMsg', errText(x, 'Couldn’t add it. Try again.'));
        S.synced = null; load();
      }
    });
  } };

  // ======================================================================
  // #billing: hours worked vs what each client was billed
  // ======================================================================
  V.billing = { title:'Hours vs billing', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Team', 'Hours vs billing', 'For each client: the hours your team worked, what that should bill at the client’s rate, what is on invoices, what is not on any invoice yet, and what the client has paid.');
    const d = new Date();
    const PRE = {
      month:['This month', () => [today().slice(0, 8) + '01', today()]],
      last:['Last month', () => [isoDay(new Date(d.getFullYear(), d.getMonth() - 1, 1)), isoDay(new Date(d.getFullYear(), d.getMonth(), 0))]],
      cycle:['This pay cycle', () => [cycleOf(today()), addDays(cycleOf(today()), 13)]],
      lastcycle:['Last pay cycle', () => [addDays(cycleOf(today()), -14), addDays(cycleOf(today()), -1)]],
      custom:['Pick dates', null]
    };
    const S = { pre:'last', from:'', to:'', open:null };
    [S.from, S.to] = PRE.last[1]();
    async function load(){
      body.innerHTML = PX.loading;
      const x = await safe(db().rpc('payroll_billing', { p_from:S.from, p_to:S.to }));
      if (!ok()) return;
      if (x.error) { body.innerHTML = failed(x.error); return; }
      draw(x.data || []);
    }
    function flag(c){
      const out = [];
      const inv = +c.invoiced_amount, should = +c.should_bill, diff = Math.round((should - inv) * 100) / 100;
      if (c.invoices.some(i => !i.inside)) out.push(pill('An invoice crosses these dates', 'plain'));
      if (+c.no_rate_hours) out.push(pill(hrs(c.no_rate_hours) + ' with no rate', ''));
      if (+c.uninvoiced_hours) out.push(pill(hrs(c.uninvoiced_hours) + ' not invoiced', ''));
      if (inv && Math.abs(diff) >= 1) out.push(pill(diff > 0 ? 'Billed ' + usd(diff) + ' less' : 'Billed ' + usd(-diff) + ' more', ''));
      if (!out.length && should) out.push(pill('Matches', 'ok'));
      return out.join(' ');
    }
    function draw(list){
      const sum = k => list.reduce((a, c) => a + (+c[k] || 0), 0);
      body.innerHTML =
        '<div class="px-form r20-row">' + f('Dates', '<select id="r19bP">' + Object.keys(PRE).map(k => opt(k, PRE[k][0], k === S.pre)).join('') + '</select>') +
          f('From', '<input type="date" id="r19bF" value="' + S.from + '"' + (S.pre === 'custom' ? '' : ' disabled') + '>') + f('To', '<input type="date" id="r19bT" value="' + S.to + '"' + (S.pre === 'custom' ? '' : ' disabled') + '>') +
          '<div class="px-tools"><a class="p-btn is-ghost" href="#invoices">Make an invoice</a></div></div>' +
        tiles([tile(hrs(sum('hours')), 'team hours', sum('commission_hours') ? hrs(sum('commission_hours')) + ' commission based, not billed by the hour' : ''), tile(usd(sum('should_bill')), 'should bill', 'hours × each shift’s client rate'),
          tile(usd(sum('invoiced_amount')), 'on invoices', 'invoices inside these dates'), tile(usd(sum('uninvoiced_amount')), 'not on any invoice', hrs(sum('uninvoiced_hours')), sum('uninvoiced_hours') > 0), tile(usd(sum('client_paid')), 'paid by clients', sum('paid_before_invoices') ? usd(sum('paid_on_invoices')) + ' on invoices · ' + usd(sum('paid_before_invoices')) + ' marked paid before invoices' : 'payments recorded on invoices')]) +
        card('By client', esc(day(S.from) + ' to ' + day(S.to)), list.length ? '<div class="p-tablewrap"><table class="p-table px-table r19-table"><thead><tr>' + ['Client', 'Hours', 'Rate', 'Should bill', 'On invoices', 'Not invoiced', 'Client paid', 'Team pay', 'Margin', 'Check', ''].map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
          list.map(c => { const k = String(c.company_id), o = S.open === k;
            let h = '<tr><td><b>' + esc(c.name) + '</b></td><td>' + hrs(c.hours) + '</td><td>' + (c.bill_rate != null ? usd(c.bill_rate) + '/h' : '–') + '</td><td>' + usd(c.should_bill) + '</td><td>' + usd(c.invoiced_amount) + (+c.invoiced_hours ? '<small class="r19-sub">' + hrs(c.invoiced_hours) + '</small>' : '') + '</td><td>' + usd(c.uninvoiced_amount) + '</td><td>' + usd(c.client_paid) + (+c.paid_before_invoices ? '<small class="r19-sub">' + usd(c.paid_before_invoices) + ' before invoices</small>' : '') + '</td><td>' + usd(c.team_pay) + '</td><td>' + usd(+c.should_bill - +c.team_pay) + '</td><td>' + flag(c) + '</td><td><button type="button" class="p-btn is-ghost" data-r19bopen="' + esc(k) + '" aria-expanded="' + o + '">' + (o ? 'Hide' : 'Details') + '</button></td></tr>';
            if (o) h += '<tr class="r19-detail"><td colspan="11">' +
              (+c.uninvoiced_hours && c.company_id ? '<div class="px-tools"><a class="p-btn" href="#invoices/new/' + c.company_id + '/' + c.uninvoiced_from + '/' + c.uninvoiced_to + '">Invoice the ' + hrs(c.uninvoiced_hours) + ' not invoiced</a></div>' : '') + '<h3 class="r20-h">Invoices</h3>' + (c.invoices.length ? table(['#', 'Dates', 'Hours', 'Amount', 'Paid', 'Status'], c.invoices.map(i => tr(['<a href="#invoices/' + i.id + '"><b>' + esc(i.number) + '</b></a>', esc(short(i.from) + ' to ' + day(i.to)) + (i.inside ? '' : ' <small class="r19-sub">crosses these dates, not counted above</small>'), hrs(i.hours), usd(i.amount), usd(i.paid || 0), esc(i.status === 'paid' ? 'Paid' : i.status === 'part' ? 'Part paid' : i.status === 'sent' ? 'Sent' : 'Draft')]))) : empty('No invoice touches these dates.')) +
              '<h3 class="r20-h">By person</h3>' + (c.people.length ? table(['Person', 'Hours', 'Should bill', 'Not invoiced', 'Shifts with no rate'], c.people.map(p => tr([esc(p.name), hrs(p.hours), usd(p.should_bill), hrs(p.uninvoiced_hours), p.no_rate ? '<b>' + num(p.no_rate) + '</b>' : '0']))) : empty('No hourly shifts.')) + '</td></tr>';
            return h; }).join('') + '</tbody></table></div>' : empty('No team hours or invoices in these dates.')) +
        '<p class="p-hint">Should bill uses the rate saved on each shift when it was logged. A shift counts as invoiced when an invoice for that client covers its date. Client paid comes from payments recorded on invoices; shifts marked paid before invoices existed still count, shown apart. Set a missing rate in Cash › Team hours › Clients.</p>';
    }
    await load();
    body.addEventListener('change', e => {
      if (e.target.id === 'r19bP') { S.pre = e.target.value; if (PRE[S.pre][1]) [S.from, S.to] = PRE[S.pre][1](); load(); }
      if (e.target.id === 'r19bF' || e.target.id === 'r19bT') { const a = $('r19bF').value, b = $('r19bT').value; if (a && b && a <= b) { S.from = a; S.to = b; load(); } }
    });
    body.addEventListener('click', e => { const b = e.target.closest('[data-r19bopen]'); if (b) { S.open = S.open === b.dataset.r19bopen ? null : b.dataset.r19bopen; load(); } });
  } };
})();
