// Team tab on /cash: everything that used to live on /tracker/admin.
// Every element id here starts with "tm-" so it can sit next to the finance tabs.
window.CashTeam = function(db){
  const $ = id => document.getElementById('tm-' + id);

  let log = [], companies = [], rate = 2.5, payslipCounter = 0;
  let range = 'week', view = 'hours', lastDeleted = null, toastTimer = null;
  const selected = new Set();

  const hm = s => Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';
  const usd = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const initials = n => n.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0,2).join('').toUpperCase();
  const fmtDate = d => new Date(d+'T00:00').toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric' });
  const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const nameKey = n => n.trim().toLowerCase().replace(/\s+/g, ' ');
  const hhmmIso = s => { const d = new Date(s); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  const companyName = id => (companies.find(c => c.id === id) || {}).name || '';
  // Pounds: today's rate is loaded by cash.js; each paid shift keeps the rate from the day it was marked paid
  const fxNow = () => (window.cashFx && window.cashFx.rate) || null;
  const egp = n => 'EGP ' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  // Money in a total card: cents are set smaller in their own span
  const setUsd = (id, n) => {
    const el = $(id), t = usd(n), m = t.match(/^(.*[0-9])([.][0-9][0-9])$/);
    el.textContent = m ? m[1] : t; el.dataset.usd = n;
    if (m) { const c = document.createElement('span'); c.className = 'c'; c.textContent = m[2]; el.appendChild(c); }
  };
  const paint = () => { if (window.paintEgp) window.paintEgp(); };
  document.addEventListener('fx-ready', () => { if (log.length) render(); });

  // ---------- data ----------
  const toRow = x => ({
    id: x.id, name: x.name.trim(), date: x.shift_date, work: x.work_seconds, brk: x.break_seconds,
    startedAt: x.started_at, endedAt: x.ended_at, companyId: x.company_id,
    paid: x.paid, paidAt: x.paid_at, paidFx: x.paid_fx != null ? Number(x.paid_fx) : null, source: x.source, createdAt: x.created_at,
    // Whether the company has paid you for these hours (separate from you paying the team member)
    clientPaid: !!x.client_paid, clientPaidAt: x.client_paid_at, clientFx: x.client_fx != null ? Number(x.client_fx) : null,
    // Rates are locked onto each shift when it's logged, so later rate changes don't rewrite history.
    payRate: x.pay_rate != null ? Number(x.pay_rate) : rate,
    billRate: x.bill_rate != null ? Number(x.bill_rate) : null,
    clocked: x.source === 'manual' ? 'Manually'
      : 'Tracker' + (x.started_at && x.ended_at ? ' · ' + hhmmIso(x.started_at) + '–' + hhmmIso(x.ended_at) : ''),
    fresh: x.source === 'tracker' && Date.now() - new Date(x.created_at).getTime() < 24*3600*1000
  });

  async function load(){
    $('notice').hidden = true;
    $('rows').innerHTML = '<tr class="loading"><td colspan="9">Loading shifts…</td></tr>';
    const [co, st] = await Promise.all([
      db.from('companies').select('*').order('name'),
      db.from('tracker_settings').select('*')
    ]);
    if (co.error) return showNotice("Couldn't load data. Refresh the page to try again.");
    companies = co.data;
    (st.data || []).forEach(s => {
      const v = parseFloat(s.value); if (isNaN(v)) return;
      if (s.key === 'hourly_rate') rate = v;
      if (s.key === 'payslip_counter') payslipCounter = v;
    });
    $('rate').value = rate; $('payRate2').value = rate;

    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('shifts').select('*').eq('owner', false).order('shift_date', { ascending:false }).order('created_at', { ascending:false }).range(from, from + 999);
      if (error) return showNotice("Couldn't load shifts. Refresh the page to try again.");
      all.push(...data);
      if (data.length < 1000) break;
    }
    log = all.map(toRow);
    fillCompanySelects();
    render();
    loadCodeStatus();
  }
  function showNotice(msg){ $('notice').textContent = msg; $('notice').hidden = false; }
  function clearNotice(){ $('notice').hidden = true; }

  async function updateShifts(ids, patch){
    if ('paid' in patch) patch = Object.assign({}, patch, { paid_fx: patch.paid ? fxNow() : null });
    if ('client_paid' in patch) patch = Object.assign({}, patch, { client_paid_at: patch.client_paid ? new Date().toISOString() : null, client_fx: patch.client_paid ? fxNow() : null });
    const { error } = await db.from('shifts').update(patch).in('id', ids);
    if (error) { showNotice("Couldn't save that change. Try again."); return false; }
    clearNotice();
    log.forEach(r => { if (ids.includes(r.id)) {
      if ('paid' in patch) { r.paid = patch.paid; r.paidAt = patch.paid_at; r.paidFx = patch.paid_fx; }
      if ('client_paid' in patch) { r.clientPaid = patch.client_paid; r.clientPaidAt = patch.client_paid_at; r.clientFx = patch.client_fx; }
      if ('company_id' in patch && patch.company_id !== r.companyId) {
        r.companyId = patch.company_id;
        const c = companies.find(x => x.id === r.companyId); r.billRate = c && c.bill_rate != null ? Number(c.bill_rate) : null; // same as the database trigger
      }
      if ('pay_rate' in patch) r.payRate = patch.pay_rate;
      if ('bill_rate' in patch) r.billRate = patch.bill_rate;
    }});
    return true;
  }
  // What the team earns for a set of shifts, each at its own locked rate
  const earned = list => list.reduce((a, r) => a + r.work / 3600 * r.payRate, 0);

  // ---------- companies ----------
  function companyOptions(sel, { all, pick, add, current }){
    sel.innerHTML = '';
    const opt = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); return o; };
    if (all) opt('', all);
    if (pick) { const o = opt('', pick); o.disabled = true; }
    companies.forEach(c => opt(String(c.id), c.name));
    if (add) opt('add', '+ Add company…');
    if (current !== undefined) sel.value = current;
  }
  function fillCompanySelects(){
    const cur = $('company').value;
    companyOptions($('company'), { all:'All companies', current:cur });
    if ($('company').value !== cur) $('company').value = '';
    const aCur = $('aCo').value;
    companyOptions($('aCo'), { add:true, current: companies.some(c => String(c.id) === aCur) ? aCur : (companies.length ? String(companies[0].id) : '') });
    companyOptions($('bulkCo'), { all:'Set company…', add:true, current:'' });
  }
  async function addCompany(){
    const name = (prompt('New company name') || '').trim();
    if (!name) return null;
    const existing = companies.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const r = parseFloat((prompt('What does ' + name + ' pay you per hour? (in $, like 6)') || '').replace('$', ''));
    const { data, error } = await db.from('companies').insert({ name, bill_rate: isNaN(r) || r < 0 ? null : r }).select().single();
    if (error) { showNotice("Couldn't add that company. Try again."); return null; }
    companies.push(data); companies.sort((a,b) => a.name.localeCompare(b.name));
    fillCompanySelects(); renderCompanies();
    return data.id;
  }

  // ---------- company codes ----------
  const codeStatus = new Map();
  async function loadCodeStatus(){
    const { data, error } = await db.rpc('company_code_status');
    if (!error) { codeStatus.clear(); data.forEach(r => codeStatus.set(r.company_id, r.has_code)); }
    renderCompanies();
  }
  function renderCompanies(){
    const list = $('coList'); list.innerHTML = '';
    if (!companies.length) { list.innerHTML = '<p class="empty">No companies yet.</p>'; return; }
    companies.forEach(c => {
      const has = !!codeStatus.get(c.id);
      const row = document.createElement('div'); row.className = 'co-row';
      row.innerHTML = '<span class="n"></span><span class="pill"></span><button class="btn btn-ghost btn-sm set"></button><button class="btn btn-ghost btn-sm rm">Remove code</button><span class="co-err"></span>';
      row.querySelector('.n').textContent = c.name;
      const pill = row.querySelector('.pill'); pill.className = 'pill ' + (has ? 'on' : 'off'); pill.textContent = has ? 'Code set' : 'No code';
      row.querySelector('.set').textContent = has ? 'Change code' : 'Set code';
      row.querySelector('.rm').hidden = !has;
      const err = row.querySelector('.co-err');
      row.querySelector('.set').addEventListener('click', async () => {
        const code = (prompt('Code for ' + c.name + ' (at least 4 characters, capitals don’t matter)') || '').trim();
        if (!code) return;
        const { error } = await db.rpc('set_company_code', { p_company_id: c.id, p_code: code });
        if (error) { err.textContent = /already uses/i.test(error.message) ? 'Another company already uses that code. Pick a different one.' : /4 characters/.test(error.message) ? 'Codes need at least 4 characters.' : "Couldn't save the code. Try again."; return; }
        codeStatus.set(c.id, true); renderCompanies(); toast('Code saved for ' + c.name, false);
      });
      row.querySelector('.rm').addEventListener('click', async () => {
        if (!confirm('Remove the code for ' + c.name + '? Your team won’t be able to log shifts for it until you set a new one.')) return;
        const { error } = await db.rpc('set_company_code', { p_company_id: c.id, p_code: '' });
        if (error) { err.textContent = "Couldn't remove the code. Try again."; return; }
        codeStatus.set(c.id, false); renderCompanies(); toast('Code removed for ' + c.name, false);
      });
      list.appendChild(row);
    });
  }
  $('coAdd').addEventListener('click', addCompany);

  // ---------- filters ----------
  function inRange(r){
    if (range === 'all') return true;
    if (range === 'custom') {
      const f = $('from').value, t = $('to').value;
      return (!f || r.date >= f) && (!t || r.date <= t);
    }
    const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === 'week') start.setDate(start.getDate() - ((start.getDay() + 1) % 7)); // weeks start Saturday
    else start.setDate(1);
    return r.date >= iso(start);
  }
  const RANGE_LABEL = { week:'This week (from Saturday)', month:'This month', all:'All time' };
  const shortDate = d => new Date(d+'T00:00').toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' });
  function rangeLabel(){
    if (range !== 'custom') return RANGE_LABEL[range];
    const f = $('from').value, t = $('to').value;
    if (f && t) return f === t ? shortDate(f) : shortDate(f) + ' – ' + shortDate(t);
    if (f) return 'From ' + shortDate(f);
    if (t) return 'Up to ' + shortDate(t);
    return 'Pick a start and end date';
  }

  $('range').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    range = b.dataset.r;
    document.querySelectorAll('#tm-range button').forEach(x => x.classList.toggle('on', x === b));
    $('customBox').hidden = range !== 'custom';
    if (range === 'custom' && !$('from').value && !$('to').value) quick('lastmonth');
    render();
  });
  function quick(q){
    const now = new Date(); let f = new Date(now), t = new Date(now);
    if (q === '7') f.setDate(f.getDate() - 6);
    if (q === 'lastmonth') { f = new Date(now.getFullYear(), now.getMonth() - 1, 1); t = new Date(now.getFullYear(), now.getMonth(), 0); }
    if (q === '3m') f.setMonth(f.getMonth() - 3);
    $('from').value = iso(f); $('to').value = iso(t); $('rangeErr').textContent = '';
  }
  $('customBox').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    quick(b.dataset.q); render();
  });
  ['from','to'].forEach(id => $(id).addEventListener('change', () => {
    const f = $('from').value, t = $('to').value;
    if (f && t && f > t) { $('rangeErr').textContent = 'The start date is after the end date. Pick an earlier start or a later end.'; return; }
    $('rangeErr').textContent = '';
    render();
  }));
  ['person','company','status'].forEach(id => $(id).addEventListener('change', render));

  function visible(ignoreStatus){
    const p = $('person').value, c = $('company').value, s = ignoreStatus ? '' : $('status').value;
    return log.filter(r =>
      inRange(r) &&
      (!p || nameKey(r.name) === p) &&
      (!c || (c === 'none' ? !r.companyId : r.companyId === Number(c))) &&
      (!s || (s === 'paid') === r.paid)
    ).sort((a,b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  }

  // ---------- rates ----------
  const saveTimers = {};
  function saveSetting(key, value, note, okText){
    note.textContent = 'Saving…';
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(async () => {
      const { error } = await db.from('tracker_settings').upsert({ key, value:String(value) });
      note.textContent = error ? "Couldn't save the rate" : okText;
    }, 600);
  }
  function onPayRate(input, note){
    const v = parseFloat(input.value);
    if (isNaN(v) || v < 0) { note.textContent = 'Enter a rate like 2.5'; return; }
    rate = v;
    if ($('rate') !== input) $('rate').value = v;
    if ($('payRate2') !== input) $('payRate2').value = v;
    render();
    saveSetting('hourly_rate', v, note, note === $('rateNote') ? 'Saved. Applies to new shifts only' : 'Saved. New rates apply to new shifts only');
  }
  $('rate').addEventListener('input', () => onPayRate($('rate'), $('rateNote')));
  $('payRate2').addEventListener('input', () => onPayRate($('payRate2'), $('billNote')));

  // ---------- view switch ----------
  $('view').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    view = b.dataset.v;
    document.querySelectorAll('#tm-view button').forEach(x => x.classList.toggle('on', x === b));
    $('hoursView').hidden = view !== 'hours';
    $('profitView').hidden = view !== 'profit';
    $('status').hidden = view === 'profit';
    $('pageTitle').textContent = view === 'profit' ? 'Profit' : 'Team hours';
    render();
  });

  // ---------- render ----------
  function render(){
    // people filter + name suggestions
    const sel = $('person'), cur = sel.value, names = new Map();
    log.forEach(r => { const k = nameKey(r.name); if (!names.has(k)) names.set(k, r.name); });
    const sorted = [...names.entries()].sort((a,b) => a[1].localeCompare(b[1]));
    sel.innerHTML = '<option value="">Everyone</option>';
    sorted.forEach(([k, n]) => { const o = document.createElement('option'); o.value = k; o.textContent = n; sel.appendChild(o); });
    sel.value = names.has(cur) ? cur : '';
    $('nameList').innerHTML = '';
    sorted.forEach(([, n]) => { const o = document.createElement('option'); o.value = n; $('nameList').appendChild(o); });

    const rows = visible();
    const sum = (list, f) => list.reduce((a,r) => a + f(r), 0);
    const tw = sum(rows, r => r.work), tb = sum(rows, r => r.brk);
    const paidRows = rows.filter(r => r.paid), owedRows = rows.filter(r => !r.paid);
    const pw = sum(paidRows, r => r.work), ow = sum(owedRows, r => r.work);

    $('sN').textContent = rows.length;
    $('sW').textContent = hm(tw);
    $('sB').textContent = hm(tb);
    $('sA').textContent = rows.length ? hm(tw / rows.length) : '0h 00m';
    setUsd('mTotal', earned(rows)); $('hTotal').textContent = hm(tw);
    setUsd('mPaid', earned(paidRows)); $('hPaid').textContent = hm(pw);
    setUsd('mOwed', earned(owedRows)); $('hOwed').textContent = hm(ow);
    $('rangeLabel').textContent = rangeLabel();
    $('payLabel').textContent = rangeLabel() + ' · worked hours × rate (breaks not paid)';
    $('histCount').textContent = rows.length + ' shift' + (rows.length === 1 ? '' : 's');

    // by person
    const per = new Map();
    rows.forEach(r => {
      const k = nameKey(r.name);
      if (!per.has(k)) per.set(k, { name:r.name, p:0, u:0, n:0, owe:0 });
      const v = per.get(k); v.n++;
      if (r.paid) v.p += r.work; else { v.u += r.work; v.owe += r.work / 3600 * r.payRate; }
    });
    const list = [...per.values()].sort((a,b) => (b.p + b.u) - (a.p + a.u));
    const max = Math.max(1, ...list.map(v => v.p + v.u));
    const pl = $('peopleList'); pl.innerHTML = '';
    if (!list.length) pl.innerHTML = '<p class="empty">No shifts match these filters.</p>';
    list.forEach(v => {
      const d = document.createElement('div'); d.className = 'person';
      d.innerHTML = '<div class="pname"><span class="av"></span><span class="n"></span></div><div class="pbar"><i class="p"></i><i class="u"></i></div><div class="pnums"><span class="t"></span><small class="s"></small></div>';
      d.querySelector('.av').textContent = initials(v.name);
      d.querySelector('.n').textContent = v.name;
      const t = d.querySelector('.t');
      t.textContent = hm(v.p + v.u) + ' · ';
      const owe = document.createElement('span'); owe.className = 'owe'; owe.textContent = usd(v.owe) + ' owed'; t.appendChild(owe);
      d.querySelector('.s').textContent = v.n + ' shift' + (v.n === 1 ? '' : 's') + ' · ' + hm(v.p) + ' paid';
      pl.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        d.querySelector('.p').style.width = (v.p / max * 100) + '%';
        d.querySelector('.u').style.width = (v.u / max * 100) + '%';
      }));
    });

    // history
    const visibleIds = new Set(rows.map(r => r.id));
    [...selected].forEach(id => { if (!visibleIds.has(id)) selected.delete(id); });
    const body = $('rows'); body.innerHTML = '';
    if (!rows.length) body.innerHTML = '<tr><td colspan="9" class="empty">No shifts match these filters.</td></tr>';
    rows.forEach(r => {
      const tr = document.createElement('tr'); if (selected.has(r.id)) tr.className = 'sel-row';
      tr.innerHTML =
        '<td class="c-sel"><input type="checkbox" aria-label="Select shift" /></td>' +
        '<td class="c-name"><div class="who"><span class="av"></span><span class="nm"></span></div></td>' +
        '<td class="c-date muted"><span class="dt"></span><span class="sub-line ck"></span></td>' +
        '<td class="c-work num w"></td>' +
        '<td class="c-brk num b"></td>' +
        '<td class="c-co"><select class="co" aria-label="Company"></select></td>' +
        '<td class="c-amt num"></td>' +
        '<td class="c-status"><button class="status team"><i></i><span></span></button><button class="status client"><i></i><span></span></button></td>' +
        '<td class="c-del" style="text-align:right"><button class="del" aria-label="Delete shift"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></td>';
      const cb = tr.querySelector('.c-sel input');
      cb.checked = selected.has(r.id);
      cb.addEventListener('change', () => { cb.checked ? selected.add(r.id) : selected.delete(r.id); tr.classList.toggle('sel-row', cb.checked); updateBulk(rows); });
      tr.querySelector('.av').textContent = initials(r.name);
      tr.querySelector('.nm').textContent = r.name;
      if (r.fresh) { const b = document.createElement('span'); b.className = 'new'; b.textContent = 'New'; tr.querySelector('.who').appendChild(b); }
      tr.querySelector('.dt').textContent = fmtDate(r.date);
      tr.querySelector('.ck').textContent = r.clocked;
      tr.querySelector('.c-work').textContent = hm(r.work);
      tr.querySelector('.c-brk').textContent = hm(r.brk);
      tr.querySelector('.c-amt').textContent = usd(earned([r]));
      if (r.payRate !== rate) tr.querySelector('.c-amt').title = 'At ' + usd(r.payRate) + '/hour';

      const co = tr.querySelector('.co');
      companyOptions(co, { pick: r.companyId ? null : 'Pick a company', add:true, current: r.companyId ? String(r.companyId) : '' });
      co.classList.toggle('none', !r.companyId);
      co.addEventListener('change', async () => {
        let v = co.value;
        if (v === 'add') { const id = await addCompany(); if (!id) { co.value = r.companyId ? String(r.companyId) : ''; return; } v = String(id); }
        const ok = await updateShifts([r.id], { company_id: Number(v) });
        if (ok) render();
      });

      const st = tr.querySelector('.status.team');
      st.classList.add(r.paid ? 'paid' : 'unpaid');
      st.querySelector('span').textContent = r.paid ? 'Paid' : 'Unpaid';
      st.title = r.paid && r.paidAt ? 'Marked paid ' + new Date(r.paidAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'Click to mark as paid';
      st.addEventListener('click', async () => {
        const ok = await updateShifts([r.id], { paid: !r.paid, paid_at: r.paid ? null : new Date().toISOString() });
        if (ok) render();
      });
      // Second pill: has the company paid you for these hours?
      const cp = tr.querySelector('.status.client');
      cp.classList.add(r.clientPaid ? 'paid' : 'unpaid');
      cp.querySelector('span').textContent = r.clientPaid ? 'Company paid' : 'Company owes';
      cp.title = r.clientPaid && r.clientPaidAt ? 'The company paid you ' + new Date(r.clientPaidAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'Click when the company pays you for these hours';
      cp.addEventListener('click', async () => {
        const ok = await updateShifts([r.id], { client_paid: !r.clientPaid });
        if (ok) render();
      });

      tr.querySelector('.del').addEventListener('click', () => remove(r));
      body.appendChild(tr);
    });
    updateBulk(rows);
    renderProfit();
    paint();
  }

  // ---------- profit ----------
  // Each company pays you its own rate (companies.bill_rate); the team rate is the same everywhere.
  // Revenue uses the company rate locked onto each shift; the boxes below set the rate for new shifts.
  const billFor = r => r.billRate;
  const billTimers = {};
  function renderRates(){
    const box = $('rateRows'); box.innerHTML = '';
    companies.forEach(c => {
      const row = document.createElement('div'); row.className = 'rt-row';
      row.innerHTML = '<span class="n"></span><div class="rate-input"><span>$</span><input type="number" min="0" step="0.25" /></div><span class="num pay"></span><span class="num keep"></span>';
      row.querySelector('.n').textContent = c.name;
      const inp = row.querySelector('input'); inp.value = c.bill_rate != null ? Number(c.bill_rate) : '';
      inp.setAttribute('aria-label', 'What ' + c.name + ' pays you per hour');
      const keep = row.querySelector('.keep');
      const show = () => {
        row.querySelector('.pay').textContent = usd(rate);
        if (c.bill_rate == null) { keep.innerHTML = '<span class="missing">Set a rate</span>'; return; }
        const k = Number(c.bill_rate) - rate; keep.textContent = usd(k); keep.classList.toggle('neg', k < 0);
      };
      show();
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (isNaN(v) || v < 0) { $('billNote').textContent = 'Enter a rate like 6'; return; }
        c.bill_rate = v; show(); renderProfit(true); // keep this box, so typing isn't interrupted
        $('billNote').textContent = 'Saving…';
        clearTimeout(billTimers[c.id]);
        billTimers[c.id] = setTimeout(async () => {
          const { error } = await db.from('companies').update({ bill_rate: v }).eq('id', c.id);
          $('billNote').textContent = error ? "Couldn't save that rate" : 'Saved. New rates apply to new shifts only';
        }, 600);
      });
      box.appendChild(row);
    });
  }

  function renderProfit(keepRateBoxes){
    if (!keepRateBoxes || !$('rateRows').children.length) renderRates();
    const all = visible(true);
    const rows = all.filter(r => billFor(r) != null);
    const skipped = all.filter(r => billFor(r) == null);
    const secs = rows.reduce((a,r) => a + r.work, 0);
    const rev = rows.reduce((a,r) => a + r.work / 3600 * billFor(r), 0);
    const cost = earned(rows);
    $('profitLabel').textContent = rangeLabel();
    $('pHours').textContent = hm(secs);
    $('pShifts').textContent = rows.length + ' shift' + (rows.length === 1 ? '' : 's');
    setUsd('pRevenue', rev); $('pRevenueSub').textContent = 'at each shift’s company rate';
    setUsd('pCost', cost);  $('pCostSub').textContent = 'at each shift’s pay rate';
    setUsd('pProfit', rev - cost); paint();
    $('pMargin').textContent = rev > 0 ? Math.round((rev - cost) / rev * 100) + '% of what you get' : '';
    const warn = $('profitWarn');
    if (skipped.length) {
      warn.textContent = skipped.length + ' shift' + (skipped.length === 1 ? '' : 's') + ' (' + hm(skipped.reduce((a,r) => a + r.work, 0)) + ') aren’t counted because ' + (skipped.length === 1 ? 'its company had' : 'their company had') + ' no rate when ' + (skipped.length === 1 ? 'it was' : 'they were') + ' logged. Select ' + (skipped.length === 1 ? 'it' : 'them') + ' in History and use Change company rate.';
      warn.hidden = false;
    } else warn.hidden = true;

    const group = keyFn => {
      const m = new Map();
      rows.forEach(r => {
        const [k, label] = keyFn(r);
        if (!m.has(k)) m.set(k, { label, secs:0, rev:0, cost:0 });
        const g = m.get(k); g.secs += r.work; g.rev += r.work / 3600 * billFor(r); g.cost += r.work / 3600 * r.payRate;
      });
      return m;
    };
    const draw = (el, map, sortFn) => {
      const list = [...map.values()].sort(sortFn);
      const max = Math.max(1, ...list.map(g => g.rev - g.cost));
      el.innerHTML = '';
      if (!list.length) { el.innerHTML = '<p class="empty">No shifts match these filters.</p>'; return; }
      list.forEach(g => {
        const d = document.createElement('div'); d.className = 'brow';
        d.innerHTML = '<span class="bname"></span><div class="pbar"><i></i></div><div class="bnums"><span class="t"></span><small class="s"></small></div>';
        d.querySelector('.bname').textContent = g.label;
        d.querySelector('.t').textContent = usd(g.rev - g.cost);
        d.querySelector('.s').textContent = hm(g.secs) + ' · ' + usd(g.rev) + ' in, ' + usd(g.cost) + ' out';
        el.appendChild(d);
        requestAnimationFrame(() => requestAnimationFrame(() => { d.querySelector('.pbar i').style.width = (Math.max(0, g.rev - g.cost) / max * 100) + '%'; }));
      });
    };
    draw($('byMonth'), group(r => [r.date.slice(0, 7), new Date(r.date.slice(0, 7) + '-01T00:00').toLocaleDateString('en-US', { month:'long', year:'numeric' })]),
      () => 0); // rows are newest first, so months already are
    draw($('byCompany'), group(r => [r.companyId, companyName(r.companyId)]), (a, b) => (b.rev - b.cost) - (a.rev - a.cost));
    draw($('byPerson'), group(r => [nameKey(r.name), r.name]), (a, b) => (b.rev - b.cost) - (a.rev - a.cost));
  }

  // ---------- payslip ----------
  const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][n % 10] || 'th');
  const monthName = d => d.toLocaleDateString('en-US', { month:'long' });
  const asDate = v => v instanceof Date ? v : new Date(v.length === 10 ? v + 'T00:00' : v);
  const longDate = v => { const d = asDate(v); return ordinal(d.getDate()) + ' of ' + monthName(d) + ', ' + d.getFullYear(); };
  const dayLine = v => { const d = asDate(v); return '<b>' + d.toLocaleDateString('en-US', { weekday:'long' }) + '</b> ' + longDate(d); };
  function periodText(a, b){
    const x = asDate(a), y = asDate(b);
    if (a === b) return longDate(x);
    if (x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()) return ordinal(x.getDate()) + ' – ' + ordinal(y.getDate()) + ' of ' + monthName(y) + ', ' + y.getFullYear();
    if (x.getFullYear() === y.getFullYear()) return ordinal(x.getDate()) + ' of ' + monthName(x) + ' – ' + longDate(y);
    return longDate(x) + ' – ' + longDate(y);
  }

  let slip = null;
  function openPayslip(ids){
    const rows = log.filter(r => ids.includes(r.id)).sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    if (!rows.length) return;
    if (new Set(rows.map(r => nameKey(r.name))).size > 1) { toast('Pick shifts for one person to make a payslip.', false); return; }
    slip = { rows, number: 'PS-' + new Date().getFullYear() + '-' + String(payslipCounter + 1).padStart(4, '0'), counted:false };
    $('slipNote').value = '';
    drawPayslip();
    $('slipOverlay').hidden = false; document.body.style.overflow = 'hidden';
    fitPayslip();
  }
  function drawPayslip(){
    const { rows, number } = slip;
    const secs = rows.reduce((a,r) => a + r.work, 0);
    const cents = n => Math.round(n * 100) / 100;
    const total = cents(earned(rows)), paidAmt = cents(earned(rows.filter(r => r.paid))), due = cents(total - paidAmt);
    const rates = [...new Set(rows.map(r => r.payRate))], oneRate = rates.length === 1;
    const rateText = oneRate ? 'Rate ' + usd(rates[0]) + ' / hour' : 'Rates ' + usd(Math.min(...rates)) + '–' + usd(Math.max(...rates)) + ' / hour';
    const allPaid = rows.every(r => r.paid), nonePaid = rows.every(r => !r.paid);
    // Each line rounds to the cent; the last line absorbs the leftover so lines add up to the total.
    const amts = rows.map(r => cents(earned([r])));
    amts[amts.length - 1] = Math.round((total - amts.slice(0, -1).reduce((a,b) => a + b, 0)) * 100) / 100;
    const lastPaid = rows.filter(r => r.paidAt).map(r => r.paidAt).sort().pop();
    const stamp = allPaid ? '<div class="stamp"><i></i>Paid on ' + longDate(lastPaid || new Date()) + '</div>'
      : nonePaid ? '<div class="stamp due"><i></i>Amount due</div>'
      : '<div class="stamp due"><i></i>Partly paid</div>';
    const grand = allPaid ? ['Total paid', total] : ['Amount due', nonePaid ? total : due];
    const note = $('slipNote').value.trim();
    // Paid shifts use the rate saved when they were marked paid; anything still due uses today's rate
    const paidRows = rows.filter(r => r.paid);
    const fxPaid = paidRows.every(r => r.paidFx) ? paidRows.reduce((a, r, i) => a + amts[rows.indexOf(r)] * r.paidFx, 0) : null;
    const fxRates = [...new Set(paidRows.map(r => r.paidFx))];
    const fxDay = lastPaid ? longDate(lastPaid) : longDate(new Date());
    let egpRow = '';
    if (allPaid && fxPaid != null) egpRow = '<div class="in-egp"><span>' + usd(total) + ' = ' + egp(fxPaid) + '</span><span>' + (fxRates.length === 1 ? 'at ' + fxRates[0].toFixed(2) + ' per $1, ' + fxDay : 'at the rate on each payment day') + '</span></div>';
    else if (fxNow()) egpRow = '<div class="in-egp"><span>' + usd(grand[1]) + ' = ' + egp(grand[1] * fxNow()) + '</span><span>at ' + fxNow().toFixed(2) + ' per $1, ' + longDate(new Date()) + '</span></div>';
    $('slip').innerHTML =
      '<div class="band"></div>' +
      '<div class="top"><div class="brand">Amr Abdelgawad<em>Talents</em><small>amrabdelgawad.site</small></div>' +
      '<div class="doc"><h1>Payslip</h1><p>No. <b>' + number + '</b></p><p>Issued <b>' + longDate(new Date()) + '</b></p></div></div>' +
      '<div class="meta">' +
        '<div class="box"><p>Paid to</p><strong>' + escHtml(rows[0].name) + '</strong><span>Team member</span></div>' +
        '<div class="box"><p>Pay period</p><strong>' + periodText(rows[0].date, rows[rows.length - 1].date) + '</strong><span>' + rows.length + ' shift' + (rows.length === 1 ? '' : 's') + '</span></div>' +
        '<div class="box"><p>Worked under</p><strong>Amr Abdelgawad Talents</strong><span>' + rateText + '</span></div>' +
      '</div>' +
      '<table><thead><tr><th>Date</th><th class="r">Hours</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>' +
      rows.map((r, i) => '<tr><td>' + dayLine(r.date) + '</td><td class="r mono">' + hm(r.work) + '</td><td class="r mono">' + usd(r.payRate) + '</td><td class="r mono">' + usd(amts[i]) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<div class="bottom"><div class="note"><b>Breaks aren’t paid.</b> Amounts are worked hours × hourly rate, rounded to the cent.<br>Questions about this payslip? Reach out to Amr directly.' +
        (note ? '<span class="custom"><b>Note:</b> ' + escHtml(note) + '</span>' : '') + stamp + '</div>' +
        '<div class="totals"><div><span>Total hours</span><span class="mono">' + hm(secs) + '</span></div>' +
        (oneRate ? '<div><span>Hourly rate</span><span class="mono">' + usd(rates[0]) + '</span></div>' : '') +
        (!allPaid && !nonePaid ? '<div><span>Already paid</span><span class="mono">' + usd(paidAmt) + '</span></div>' : '') +
        '<div class="grand"><span>' + grand[0] + '</span><span class="mono">' + usd(grand[1]) + '</span></div>' + egpRow + '</div></div>' +
      '<div class="foot"><div><span>Amr Abdelgawad Talents · amrabdelgawad.site</span><span>' + number + '</span></div></div>';
  }
  function fitPayslip(){
    if ($('slipOverlay').hidden) return;
    const el = $('slip'), fit = $('slipFit');
    const w = el.offsetWidth, h = el.offsetHeight, avail = $('slipStage').clientWidth - 32;
    const s = Math.min(1, avail / w);
    el.style.transform = 'scale(' + s + ')'; el.style.transformOrigin = 'top left';
    fit.style.width = (w * s) + 'px'; fit.style.height = (h * s) + 'px';
  }
  window.addEventListener('resize', fitPayslip);
  $('slipNote').addEventListener('input', () => { drawPayslip(); fitPayslip(); });
  function closePayslip(){ $('slipOverlay').hidden = true; document.body.style.overflow = ''; slip = null; }
  $('slipClose').addEventListener('click', closePayslip);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('slipOverlay').hidden) closePayslip(); });

  let pdfLib = null;
  function loadPdfLib(){
    if (pdfLib) return pdfLib;
    pdfLib = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = () => res(window.html2pdf); s.onerror = () => { pdfLib = null; rej(new Error('load')); };
      document.head.appendChild(s);
    });
    return pdfLib;
  }
  $('slipDownload').addEventListener('click', async () => {
    if (!slip) return;
    const btn = $('slipDownload'); btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Preparing…';
    try {
      const html2pdf = await loadPdfLib();
      await document.fonts.ready;
      const clone = $('slip').cloneNode(true);
      clone.style.transform = 'none'; clone.style.boxShadow = 'none';
      const first = slip.rows[0], last = slip.rows[slip.rows.length - 1];
      const file = 'Payslip-' + first.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + first.date + (first.date === last.date ? '' : '-to-' + last.date) + '.pdf';
      await html2pdf().set({
        margin: [10, 0, 10, 0], filename: file,
        image: { type:'jpeg', quality:0.96 },
        html2canvas: { scale:2, useCORS:true, backgroundColor:'#ffffff', scrollX:0, scrollY:0 }, // capture from the top, or a scrolled page gives a blank PDF
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' },
        pagebreak: { mode:['css', 'legacy'], avoid:['tr', '.bottom'] }
      }).from(clone).save();
      if (!slip.counted) {
        slip.counted = true; payslipCounter += 1;
        await db.from('tracker_settings').upsert({ key:'payslip_counter', value:String(payslipCounter) });
      }
      toast('Payslip downloaded', false);
    } catch (e) {
      toast("Couldn't make the PDF. Check your connection and try again.", false);
    }
    btn.removeAttribute('aria-busy'); btn.textContent = 'Download PDF';
  });

  // ---------- bulk ----------
  function updateBulk(rows){
    const n = selected.size;
    $('bulk').hidden = n === 0;
    if (n) {
      const owe = earned(log.filter(r => selected.has(r.id) && !r.paid));
      $('bulkN').textContent = n + ' selected' + (owe ? ' · ' + usd(owe) + ' unpaid' : '');
    }
    const all = $('selAll');
    all.checked = rows.length > 0 && rows.every(r => selected.has(r.id));
    all.indeterminate = n > 0 && !all.checked;
  }
  $('selAll').addEventListener('change', () => {
    const rows = visible();
    if ($('selAll').checked) rows.forEach(r => selected.add(r.id)); else selected.clear();
    render();
  });
  $('bulk').addEventListener('click', async e => {
    const b = e.target.closest('[data-bulk]'); if (!b) return;
    const ids = [...selected];
    if (b.dataset.bulk === 'clear') { selected.clear(); render(); return; }
    if (b.dataset.bulk === 'payslip') { openPayslip(ids); return; }
    if (b.dataset.bulk === 'payrate' || b.dataset.bulk === 'billrate') {
      const isPay = b.dataset.bulk === 'payrate';
      const ans = prompt((isPay ? 'New pay rate (what you pay them per hour)' : 'New company rate (what the company pays you per hour)') + ' for the ' + ids.length + ' selected shift' + (ids.length === 1 ? '' : 's') + ', in $:');
      if (ans === null) return;
      const v = parseFloat(ans.replace('$', ''));
      if (isNaN(v) || v < 0) { toast('Enter a rate like 2.5', false); return; }
      const ok = await updateShifts(ids, isPay ? { pay_rate: v } : { bill_rate: v });
      if (ok) { selected.clear(); render(); toast((isPay ? 'Pay rate' : 'Company rate') + ' set to ' + usd(v) + '/hour on ' + ids.length + ' shift' + (ids.length === 1 ? '' : 's'), false); }
      return;
    }
    if (b.dataset.bulk === 'cpaid' || b.dataset.bulk === 'cunpaid') {
      const cpaid = b.dataset.bulk === 'cpaid';
      const ok = await updateShifts(ids, { client_paid: cpaid });
      if (ok) { selected.clear(); render(); toast((cpaid ? 'Company paid you for ' : 'Company still owes for ') + ids.length + ' shift' + (ids.length === 1 ? '' : 's'), false); }
      return;
    }
    const paid = b.dataset.bulk === 'paid';
    b.setAttribute('aria-busy', 'true');
    const ok = await updateShifts(ids, { paid, paid_at: paid ? new Date().toISOString() : null });
    b.removeAttribute('aria-busy');
    if (ok) { selected.clear(); render(); toast((paid ? 'Marked ' : 'Unmarked ') + ids.length + ' shift' + (ids.length === 1 ? '' : 's') + (paid ? ' as paid' : ''), false); }
  });
  $('bulkCo').addEventListener('change', async () => {
    let v = $('bulkCo').value; if (!v) return;
    if (v === 'add') { const id = await addCompany(); if (!id) { $('bulkCo').value = ''; return; } v = String(id); }
    const ids = [...selected];
    const ok = await updateShifts(ids, { company_id: Number(v) });
    $('bulkCo').value = '';
    if (ok) { selected.clear(); render(); toast('Updated company for ' + ids.length + ' shift' + (ids.length === 1 ? '' : 's'), false); }
  });

  // ---------- add shift by hand ----------
  $('addToggle').addEventListener('click', () => {
    $('addBox').hidden = !$('addBox').hidden;
    if (!$('addBox').hidden) { if (!$('aDate').value) $('aDate').value = iso(new Date()); $('aName').focus(); }
  });
  $('addCancel').addEventListener('click', () => { $('addBox').hidden = true; $('addErr').textContent = ''; });
  $('aCo').addEventListener('change', async () => {
    if ($('aCo').value !== 'add') return;
    const id = await addCompany();
    $('aCo').value = id ? String(id) : (companies.length ? String(companies[0].id) : '');
  });
  ['aName','aDate','aH','aM','aB'].forEach(id => $(id).addEventListener('input', () => $('addErr').textContent = ''));
  $('addForm').addEventListener('submit', async e => {
    e.preventDefault();
    let name = $('aName').value.trim().replace(/\s+/g, ' ');
    const h = parseInt($('aH').value || '0', 10), m = parseInt($('aM').value || '0', 10), bm = parseInt($('aB').value || '0', 10);
    if (name.length < 2) { $('addErr').textContent = 'Enter the person’s full name.'; return; }
    if (!$('aDate').value) { $('addErr').textContent = 'Pick the shift date.'; return; }
    if ([h, m, bm].some(n => isNaN(n) || n < 0) || m > 59 || h > 24) { $('addErr').textContent = 'Check the hours and minutes.'; return; }
    const secs = h * 3600 + m * 60;
    if (secs <= 0 || secs > 86400) { $('addErr').textContent = 'Enter how long they worked.'; return; }
    const match = log.find(r => nameKey(r.name) === nameKey(name)); if (match) name = match.name; // keep one spelling per person
    const co = $('aCo').value, paid = $('aPaid').checked;
    if (!co || co === 'add') { $('addErr').textContent = 'Pick the company they worked for.'; return; }
    $('addSave').setAttribute('aria-busy', 'true');
    const { data, error } = await db.from('shifts').insert({
      name, shift_date: $('aDate').value, work_seconds: secs, break_seconds: bm * 60,
      company_id: Number(co),
      paid, paid_at: paid ? new Date().toISOString() : null, source: 'manual'
    }).select().single();
    $('addSave').removeAttribute('aria-busy');
    if (error) { $('addErr').textContent = "Couldn't save that shift. Try again."; return; }
    log.push(toRow(data));
    $('aH').value = ''; $('aM').value = ''; $('aB').value = ''; $('aPaid').checked = false;
    render(); toast('Added ' + hm(secs) + ' for ' + name + ' on ' + fmtDate(data.shift_date), false);
  });

  // ---------- delete with undo ----------
  function toast(msg, withUndo){
    $('toastMsg').textContent = msg;
    $('undo').hidden = !withUndo;
    $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').classList.remove('show'); lastDeleted = null; }, 5000);
  }
  async function remove(r){
    const i = log.indexOf(r); if (i < 0) return;
    const { error } = await db.from('shifts').delete().eq('id', r.id);
    if (error) { showNotice("Couldn't delete that shift. Try again."); return; }
    log.splice(i, 1); selected.delete(r.id);
    lastDeleted = { r, i };
    toast('Deleted ' + r.name + "'s shift on " + fmtDate(r.date), true);
    render();
  }
  $('undo').addEventListener('click', async () => {
    if (!lastDeleted) return;
    const { r, i } = lastDeleted; lastDeleted = null; $('toast').classList.remove('show');
    const { data, error } = await db.from('shifts').insert({
      name: r.name, shift_date: r.date, work_seconds: r.work, break_seconds: r.brk,
      started_at: r.startedAt, ended_at: r.endedAt, company_id: r.companyId,
      paid: r.paid, paid_at: r.paidAt, paid_fx: r.paidFx, client_paid: r.clientPaid, client_paid_at: r.clientPaidAt, client_fx: r.clientFx, source: r.source, created_at: r.createdAt,
      pay_rate: r.payRate, bill_rate: r.billRate
    }).select().single();
    if (error) { showNotice("Couldn't restore that shift."); return; }
    log.splice(i, 0, toRow(data)); render();
  });

  // ---------- CSV export ----------
  $('export').addEventListener('click', () => {
    const esc = v => { let s = String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const lines = [['Name','Shift date','Worked (hours)','Break (hours)','Company','Status','Company paid you','Amount (USD)','Clock in','Clock out'].map(esc).join(',')];
    visible().forEach(r => lines.push([
      r.name, r.date, (r.work/3600).toFixed(2), (r.brk/3600).toFixed(2), companyName(r.companyId),
      r.paid ? 'Paid' : 'Unpaid', r.clientPaid ? 'Yes' : 'No', earned([r]).toFixed(2),
      r.startedAt ? hhmmIso(r.startedAt) : '', r.endedAt ? hhmmIso(r.endedAt) : ''
    ].map(esc).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type:'text/csv' }));
    a.download = 'team-shifts-' + (range === 'custom' ? ($('from').value || 'start') + '_to_' + ($('to').value || 'today') : range) + '.csv';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  return { load };
};
