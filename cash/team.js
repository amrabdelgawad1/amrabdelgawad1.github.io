// Team tab on /cash: everything that used to live on /tracker/admin.
// Every element id here starts with "tm-" so it can sit next to the finance tabs.
window.CashTeam = function(db){
  const $ = id => document.getElementById('tm-' + id);

  let log = [], companies = [], rate = 2.5, payslipCounter = 0;
  let range = 'week', view = 'hours', lastDeleted = null, toastTimer = null;
  let picked = null; // a person the app's menu asked for (#team/<name>), applied on the next render
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
    fresh: x.source === 'tracker' && Date.now() - new Date(x.created_at).getTime() < 24*3600*1000,
    brief: (x.brief || '').trim(), editedAt: x.edited_at || null,
    original: x.original || null, // the shift as first sent, saved on the first edit
    aiNote: (x.ai_note || '').trim(), // a suggestion written from the brief (filled in later by the AI step)
    // Optional numbers sent with the brief; null means not given
    dials: x.dials != null ? Number(x.dials) : null, convos: x.conversations != null ? Number(x.conversations) : null, appts: x.appointments != null ? Number(x.appointments) : null
  });
  const hasNums = r => r.dials != null || r.convos != null || r.appts != null;
  const num = n => n.toLocaleString('en-US');
  const numsText = r => [[r.dials, 'dial'], [r.convos, 'conversation'], [r.appts, 'appointment']].filter(p => p[0] != null).map(p => num(p[0]) + ' ' + p[1] + (p[0] === 1 ? '' : 's')).join(' · ');
  // "Originally Mon, Oct 19 · 09:00–16:17 · 6h 42m worked · 0h 35m break · Fortune Consultants"
  function originalText(r){
    const o = r.original; if (!o) return '';
    const parts = [fmtDate(o.date)];
    if (o.started_at && o.ended_at) parts.push(hhmmIso(o.started_at) + '–' + hhmmIso(o.ended_at));
    parts.push(hm(o.work) + ' worked', hm(o.brk) + ' break');
    if (o.company_id !== r.companyId && companyName(o.company_id)) parts.push(companyName(o.company_id));
    return 'Originally ' + parts.join(' · ') + (o.brief !== undefined && (o.brief || '') !== r.brief ? ' · brief was ' + (o.brief ? '“' + o.brief + '”' : 'empty') : '');
  }
  const snapshot = r => ({ date: r.date, started_at: r.startedAt, ended_at: r.endedAt, work: r.work, brk: r.brk, company_id: r.companyId, brief: r.brief || '', dials: r.dials, conversations: r.convos, appointments: r.appts });
  const NOTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 13h6M9 17h4"/></svg>';
  const PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/></svg>';

  async function load(){
    $('notice').hidden = true;
    $('rows').innerHTML = '<tr class="loading"><td colspan="10">Loading shifts…</td></tr>';
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
    const name = (await ask({ title:'Add a company', ok:'Next', input:{ label:'Company name' } }) || '').trim();
    if (!name) return null;
    const existing = companies.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const r = parseFloat((await ask({ title:'What does ' + name + ' pay you per hour?', ok:'Add company', cancel:'Skip', input:{ label:'In $, like 6', inputMode:'decimal' } }) || '').replace('$', ''));
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
        const code = (await ask({ title:'Code for ' + c.name, ok:'Save code', input:{ label:'At least 4 characters, capitals don’t matter' } }) || '').trim();
        if (!code) return;
        const { error } = await db.rpc('set_company_code', { p_company_id: c.id, p_code: code });
        if (error) { err.textContent = /already uses/i.test(error.message) ? 'Another company already uses that code. Pick a different one.' : /4 characters/.test(error.message) ? 'Codes need at least 4 characters.' : "Couldn't save the code. Try again."; return; }
        codeStatus.set(c.id, true); renderCompanies(); toast('Code saved for ' + c.name, false);
      });
      row.querySelector('.rm').addEventListener('click', async () => {
        if (!await ask({ title:'Remove the code for ' + c.name + '?', msg:'Your team won’t be able to log shifts for it until you set a new one.', ok:'Remove code', danger:true })) return;
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
  // Phones (iOS Safari especially) may only fire "input" while the picker is open, so listen to both
  const onRangePick = () => {
    const f = $('from').value, t = $('to').value;
    if (f && t && f > t) { $('rangeErr').textContent = 'The start date is after the end date. Pick an earlier start or a later end.'; return; }
    $('rangeErr').textContent = '';
    render();
  };
  ['from','to'].forEach(id => ['input','change'].forEach(ev => $(id).addEventListener(ev, onRangePick)));
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

  // ---------- agents: the names people pick on /tracker ----------
  // Each agent's number is their id (01, 02, …), so numbers are never reused.
  // Switching someone off hides them on /tracker but keeps their number and past hours.
  let agents = [];
  const agentNo = id => String(id).padStart(2, '0');
  async function loadAgents(){
    const [a, ac] = await Promise.all([
      db.from('agents').select('id,name,active').order('id'),
      db.from('agent_companies').select('agent_id,company_id')
    ]);
    if (a.error || ac.error) { $('agentErr').textContent = "Couldn't load agents. Refresh the page to try again."; return; }
    $('agentErr').textContent = '';
    agents = a.data.map(x => ({ ...x, cos: new Set(ac.data.filter(r => r.agent_id === x.id).map(r => r.company_id)) }));
    renderAgents();
  }
  function coChip(c, on, onClick){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'co-chip'; b.dataset.co = c.id; b.textContent = c.name;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', () => onClick(b));
    return b;
  }
  function renderAgents(){
    // Companies for a new agent: keep what was ticked; with one company, tick it for them
    const box = $('agentCos');
    const ticked = new Set([...box.querySelectorAll('[aria-pressed="true"]')].map(b => Number(b.dataset.co)));
    box.innerHTML = '';
    companies.forEach(c => box.appendChild(coChip(c, ticked.size ? ticked.has(c.id) : companies.length === 1,
      b => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'))));

    const rows = $('agentRows');
    rows.innerHTML = '';
    if (!agents.length) { rows.innerHTML = '<p class="agent-empty">No agents yet. Add your first one above.</p>'; return; }
    agents.forEach(a => {
      const row = document.createElement('div'); row.className = 'agent-row' + (a.active ? '' : ' off');
      const no = document.createElement('span'); no.className = 'agent-no'; no.textContent = agentNo(a.id);
      const nm = document.createElement('span'); nm.className = 'agent-name'; nm.textContent = a.name;
      const cos = document.createElement('div'); cos.className = 'co-chips';
      companies.forEach(c => cos.appendChild(coChip(c, a.cos.has(c.id), () => toggleAgentCompany(a, c.id))));
      const sw = document.createElement('button');
      sw.type = 'button'; sw.className = 'btn btn-ghost btn-sm'; sw.textContent = a.active ? 'Switch off' : 'Switch on';
      sw.title = a.active ? 'Hide ' + a.name + ' on /tracker' : 'Show ' + a.name + ' on /tracker again';
      sw.addEventListener('click', () => setAgentActive(a, !a.active));
      row.append(no, nm, cos, sw);
      rows.appendChild(row);
    });
  }
  async function toggleAgentCompany(a, coId){
    const on = !a.cos.has(coId);
    const { error } = on
      ? await db.from('agent_companies').insert({ agent_id: a.id, company_id: coId })
      : await db.from('agent_companies').delete().eq('agent_id', a.id).eq('company_id', coId);
    if (error) { toast("Couldn't save that. Try again."); return; }
    on ? a.cos.add(coId) : a.cos.delete(coId);
    renderAgents();
  }
  async function setAgentActive(a, active){
    const { error } = await db.from('agents').update({ active }).eq('id', a.id);
    if (error) { toast("Couldn't save that. Try again."); return; }
    a.active = active;
    renderAgents();
    toast(agentNo(a.id) + ' ' + a.name + (active ? ' is back on /tracker' : ' is hidden on /tracker'));
  }
  $('agentName').addEventListener('input', () => { $('agentErr').textContent = ''; });
  $('agentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('agentName').value.trim().replace(/\s+/g, ' ');
    const cos = [...$('agentCos').querySelectorAll('[aria-pressed="true"]')].map(b => Number(b.dataset.co));
    const same = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (name.length < 2) { $('agentErr').textContent = "Type the agent's full name."; $('agentName').focus(); return; }
    if (same) { $('agentErr').textContent = name + ' is already on the list as ' + agentNo(same.id) + '. Tick another company on their row instead.'; return; }
    if (!cos.length) { $('agentErr').textContent = 'Pick at least one company they work for.'; return; }
    $('agentSave').setAttribute('aria-busy', 'true');
    const { data, error } = await db.from('agents').insert({ name }).select('id,name,active').single();
    let linkErr = null;
    if (!error) ({ error: linkErr } = await db.from('agent_companies').insert(cos.map(company_id => ({ agent_id: data.id, company_id }))));
    $('agentSave').removeAttribute('aria-busy');
    if (error) { $('agentErr').textContent = "Couldn't add the agent. Check your connection and try again."; return; }
    agents.push({ ...data, cos: new Set(linkErr ? [] : cos) });
    $('agentName').value = '';
    renderAgents();
    if (linkErr) $('agentErr').textContent = 'Added ' + agentNo(data.id) + ' ' + name + ", but the companies didn't save. Tick them on their row.";
    else toast('Added ' + agentNo(data.id) + ' ' + name);
  });

  // ---------- view switch ----------
  const VIEW_TITLE = { hours:'Team hours', profit:'Rates', agents:'Agents', notes:'Team notes' };
  $('view').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    view = b.dataset.v;
    document.querySelectorAll('#tm-view button').forEach(x => x.classList.toggle('on', x === b));
    $('hoursView').hidden = view !== 'hours';
    $('profitView').hidden = view !== 'profit';
    $('agentsView').hidden = view !== 'agents';
    $('notesView').hidden = view !== 'notes';
    $('status').hidden = view === 'profit' || view === 'notes';
    // Date range, filters and Add shift don't apply to the agents list
    document.querySelector('#teamView .tools').hidden = view === 'agents';
    $('addToggle').hidden = view === 'agents' || view === 'notes';
    $('customBox').hidden = view === 'agents' || range !== 'custom';
    if (view === 'agents') { $('addBox').hidden = true; loadAgents(); }
    $('pageTitle').textContent = VIEW_TITLE[view];
    render();
  });

  // ---------- render ----------
  function render(){
    // people filter + name suggestions
    const sel = $('person'), names = new Map();
    let cur = sel.value;
    if (picked !== null) { cur = nameKey(picked); if (cur) names.set(cur, picked.trim()); picked = null; }
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
    if (!rows.length) body.innerHTML = '<tr><td colspan="10" class="empty">No shifts match these filters.</td></tr>';
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
        '<td class="c-note"></td>' +
        '<td class="c-del" style="text-align:right"><button class="del edit" aria-label="Edit shift">' + PENCIL + '</button><button class="del" aria-label="Delete shift"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></td>';
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

      const nc = tr.querySelector('.c-note');
      if (r.brief) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'note-btn';
        b.innerHTML = NOTE_ICON + '<span>View</span>'; b.setAttribute('aria-label', 'View ' + r.name + "'s note for " + fmtDate(r.date));
        b.addEventListener('click', () => openNote(r)); nc.appendChild(b);
      } else nc.innerHTML = '<span class="no-note">No note</span>';
      if (r.editedAt) { const e = document.createElement('span'); e.className = 'edited'; e.textContent = 'Edited'; e.title = 'Edited ' + new Date(r.editedAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); tr.querySelector('.c-date').appendChild(e); }

      tr.querySelector('.del.edit').addEventListener('click', () => openEdit(r));
      tr.querySelector('.del:not(.edit)').addEventListener('click', () => remove(r));
      body.appendChild(tr);
    });
    updateBulk(rows);
    renderProfit();
    renderNotes();
    paint();
  }

  // ---------- notes: every brief in the period, newest first ----------
  function renderNotes(){
    if (view !== 'notes') return;
    const rows = visible(true).slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.endedAt || b.createdAt || '').localeCompare(a.endedAt || a.createdAt || ''));
    renderScore(rows);
    const withNote = rows.filter(r => r.brief), missing = rows.length - withNote.length;
    $('notesLabel').textContent = rangeLabel() + ' · ' + withNote.length + ' note' + (withNote.length === 1 ? '' : 's') + (missing ? ' · ' + missing + ' shift' + (missing === 1 ? '' : 's') + ' without one' : '');
    const box = $('notesList'); box.innerHTML = '';
    if (!withNote.length) { box.innerHTML = '<p class="empty">No notes in this period yet. Notes come in when your team ends a shift.</p>'; return; }
    let day = '';
    withNote.forEach(r => {
      if (r.date !== day) { day = r.date; const h = document.createElement('h3'); h.className = 'note-day'; h.textContent = fmtDate(r.date); box.appendChild(h); }
      const card = document.createElement('article'); card.className = 'note-card';
      card.innerHTML = '<div class="nc-head"><span class="av"></span><div class="nc-who"><b></b><small></small></div><button type="button" class="del edit owner-only" aria-label="Edit shift">' + PENCIL + '</button></div><p class="nc-brief"></p>';
      card.querySelector('.av').textContent = initials(r.name);
      card.querySelector('b').textContent = r.name;
      const times = r.startedAt && r.endedAt ? hhmmIso(r.startedAt) + '–' + hhmmIso(r.endedAt) + ' · ' : '';
      card.querySelector('small').textContent = times + hm(r.work) + ' worked' + (companyName(r.companyId) ? ' · ' + companyName(r.companyId) : '') + (r.editedAt ? ' · Edited' : '');
      card.querySelector('.nc-brief').textContent = r.brief;
      if (hasNums(r)) { const n = document.createElement('p'); n.className = 'nc-nums'; n.textContent = numsText(r); card.querySelector('.nc-brief').before(n); }
      if (r.aiNote) { const a = document.createElement('p'); a.className = 'nc-ai owner-only'; a.textContent = r.aiNote; card.appendChild(a); }
      if (r.original) { const o = document.createElement('p'); o.className = 'nc-orig'; o.textContent = originalText(r); card.appendChild(o); }
      card.querySelector('.edit').addEventListener('click', () => openEdit(r));
      box.appendChild(card);
    });
  }

  // ---------- scoreboard: each person's numbers for the period (This week starts Saturday) ----------
  function renderScore(rows){
    const per = new Map();
    rows.forEach(r => {
      const k = nameKey(r.name);
      if (!per.has(k)) per.set(k, { name:r.name, n:0, work:0, withNums:0, numWork:0, dials:0, convos:0, appts:0 });
      const v = per.get(k); v.n++; v.work += r.work;
      if (hasNums(r)) { v.withNums++; v.numWork += r.work; v.dials += r.dials || 0; v.convos += r.convos || 0; v.appts += r.appts || 0; }
    });
    const list = [...per.values()].sort((a, b) => b.appts - a.appts || b.convos - a.convos || b.dials - a.dials || b.work - a.work);
    const anyNums = list.some(v => v.withNums);
    $('scoreLabel').textContent = rangeLabel() + (anyNums ? ' · from the numbers sent with each brief' : '');
    const body = $('scoreRows'); body.innerHTML = '';
    if (!list.length) { body.innerHTML = '<tr><td colspan="7" class="empty">No shifts in this period.</td></tr>'; return; }
    const tot = { n:0, work:0, withNums:0, numWork:0, dials:0, convos:0, appts:0 };
    list.forEach(v => { Object.keys(tot).forEach(k => tot[k] += v[k]); body.appendChild(scoreRow(v, false)); });
    if (list.length > 1) body.appendChild(scoreRow(Object.assign({ name:'Team' }, tot), true));
    if (!anyNums) { const tr = document.createElement('tr'); tr.innerHTML = '<td colspan="7" class="score-hint">No numbers yet. They come in when your team fills in Dials, Conversations and Appointments as they end a shift.</td>'; body.appendChild(tr); }
  }
  function scoreRow(v, total){
    const tr = document.createElement('tr'); if (total) tr.className = 'score-total';
    const perHour = v.numWork >= 60 && v.withNums ? (v.dials / (v.numWork / 3600)).toFixed(1) : '–';
    const cell = (t, cls) => { const td = document.createElement('td'); td.textContent = t; if (cls) td.className = cls; tr.appendChild(td); return td; };
    cell(v.name, 'sc-name');
    const sh = cell(String(v.n), 'num'); if (v.withNums < v.n) sh.title = v.withNums + ' of ' + v.n + ' with numbers';
    cell(hm(v.work), 'num');
    [v.dials, v.convos, v.appts].forEach((x, i) => cell(v.withNums ? num(x) : '–', 'num' + (i === 2 ? ' sc-appt' : '')));
    cell(perHour, 'num');
    return tr;
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
      row.innerHTML = '<span class="n"></span><div class="rate-input"><span>$</span><input type="number" min="0" step="0.25" /></div><span class="num pay"></span><span></span>';
      row.querySelector('.n').textContent = c.name;
      const inp = row.querySelector('input'); inp.value = c.bill_rate != null ? Number(c.bill_rate) : '';
      inp.setAttribute('aria-label', 'What ' + c.name + ' pays you per hour');
      const show = () => { row.querySelector('.pay').textContent = usd(rate); };
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

  // Rates only: team profit isn't worked out here, Amr adds it himself on Overview
  function renderProfit(keepRateBoxes){
    if (!keepRateBoxes || !$('rateRows').children.length) renderRates();
    const skipped = visible(true).filter(r => billFor(r) == null);
    $('profitLabel').textContent = 'For new shifts';
    const warn = $('profitWarn');
    if (skipped.length) {
      warn.textContent = skipped.length + ' shift' + (skipped.length === 1 ? '' : 's') + ' (' + hm(skipped.reduce((a,r) => a + r.work, 0)) + ') ' + (skipped.length === 1 ? 'has' : 'have') + ' no company rate. Select ' + (skipped.length === 1 ? 'it' : 'them') + ' in History and use Change company rate.';
      warn.hidden = false;
    } else warn.hidden = true;
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
      s.integrity = 'sha384-Yv5O+t3uE3hunW8uyrbpPW3iw6/5/Y7HitWJBLgqfMoA36NogMmy+8wWZMpn3HWc'; s.crossOrigin = 'anonymous'; // browser refuses a changed copy
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

  // ---------- monthly report for one client company ----------
  // Hours, numbers and daily briefs for a month, as a PDF to send the company. No pay or rates on it.
  let rep = null;
  const monthOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  $('report').addEventListener('click', () => {
    companyOptions($('repCo'), { current: $('company').value && $('company').value !== 'none' ? $('company').value : (companies[0] ? String(companies[0].id) : '') });
    if (!$('repMonth').value) { const d = new Date(); if (d.getDate() <= 10) d.setMonth(d.getMonth() - 1, 1); $('repMonth').value = monthOf(d); } // early in a month, last month is the one to send
    $('repMonth').max = monthOf(new Date());
    try { $('repPay').value = localStorage.getItem(PAY_KEY) || ''; } catch(e){}
    rep = {};
    drawReport();
    $('repOverlay').hidden = false; document.body.style.overflow = 'hidden';
    fitReport();
  });
  ['repCo', 'repMonth', 'repNotes', 'repInv'].forEach(id => $(id).addEventListener('change', () => { if (rep) { drawReport(); fitReport(); } }));
  // The payment line is the same for every invoice, so it's remembered on this device
  const PAY_KEY = 'talents-invoice-pay';
  $('repPay').addEventListener('input', () => { try { localStorage.setItem(PAY_KEY, $('repPay').value); } catch(e){} if (rep) { drawInvoice(); fitReport(); } });
  function drawReport(){
    const coId = Number($('repCo').value), month = $('repMonth').value, notes = $('repNotes').checked;
    const co = companies.find(c => c.id === coId), mDate = month ? new Date(month + '-01T00:00') : new Date();
    const mText = mDate.toLocaleDateString('en-US', { month:'long', year:'numeric' });
    const rows = log.filter(r => r.companyId === coId && month && r.date.slice(0, 7) === month)
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name));
    rep = { rows, coName: co ? co.name : '', month };
    const secs = rows.reduce((a, r) => a + r.work, 0), days = new Set(rows.map(r => r.date)).size;
    const withNums = rows.filter(hasNums), anyNums = withNums.length > 0;
    const sumOf = (list, k) => list.reduce((a, r) => a + (r[k] || 0), 0);
    const per = new Map();
    rows.forEach(r => {
      const k = nameKey(r.name);
      if (!per.has(k)) per.set(k, { name:r.name, rows:[] });
      per.get(k).rows.push(r);
    });
    const people = [...per.values()].sort((a, b) => sumOf(b.rows, 'work') - sumOf(a.rows, 'work'));
    const numCols = list => { const w = list.filter(hasNums); return w.length ? '<td class="r mono">' + num(sumOf(w, 'dials')) + '</td><td class="r mono">' + num(sumOf(w, 'convos')) + '</td><td class="r mono">' + num(sumOf(w, 'appts')) + '</td>' : '<td class="r">–</td><td class="r">–</td><td class="r">–</td>'; };
    const dayNums = r => '<td class="r mono">' + (r.dials != null ? num(r.dials) : '–') + '</td><td class="r mono">' + (r.convos != null ? num(r.convos) : '–') + '</td><td class="r mono">' + (r.appts != null ? num(r.appts) : '–') + '</td>';
    const numHead = anyNums ? '<th class="r">Dials</th><th class="r">Conv.</th><th class="r">Appts</th>' : '';
    const summary = rows.length
      ? 'In <b>' + mText + '</b>, ' + people.length + ' team member' + (people.length === 1 ? '' : 's') + ' worked <b>' + hm(secs) + '</b> for ' + escHtml(rep.coName) + ' across ' + rows.length + ' shift' + (rows.length === 1 ? '' : 's') + ' on ' + days + ' day' + (days === 1 ? '' : 's') + '.' +
        (anyNums ? ' Together they made <b>' + num(sumOf(withNums, 'dials')) + ' dials</b>, had <b>' + num(sumOf(withNums, 'convos')) + ' conversations</b> and set <b>' + num(sumOf(withNums, 'appts')) + ' appointment' + (sumOf(withNums, 'appts') === 1 ? '' : 's') + '</b>' + (withNums.length < rows.length ? ' (from the ' + withNums.length + ' shifts where numbers were logged)' : '') + '.' : '')
      : 'No shifts were logged for ' + escHtml(rep.coName) + ' in ' + mText + '.';
    $('rep').innerHTML =
      '<div class="band"></div>' +
      '<div class="top"><div class="brand">Amr Abdelgawad<em>Talents</em><small>amrabdelgawad.site</small></div>' +
      '<div class="doc"><h1>Monthly Report</h1><p>For <b>' + escHtml(rep.coName) + '</b></p><p>Issued <b>' + longDate(new Date()) + '</b></p></div></div>' +
      '<div class="meta">' +
        '<div class="box"><p>Month</p><strong>' + mText + '</strong><span>' + days + ' working day' + (days === 1 ? '' : 's') + '</span></div>' +
        '<div class="box"><p>Hours worked</p><strong>' + hm(secs) + '</strong><span>' + rows.length + ' shift' + (rows.length === 1 ? '' : 's') + (rows.length ? ', avg ' + hm(secs / rows.length) : '') + '</span></div>' +
        '<div class="box"><p>Team</p><strong>' + people.length + ' member' + (people.length === 1 ? '' : 's') + '</strong><span>' + escHtml(people.map(p => p.name.split(' ')[0]).join(', ') || '–') + '</span></div>' +
      '</div>' +
      (anyNums ? '<div class="meta nums">' +
        '<div class="box hi"><p>Dials</p><strong>' + num(sumOf(withNums, 'dials')) + '</strong></div>' +
        '<div class="box hi"><p>Conversations</p><strong>' + num(sumOf(withNums, 'convos')) + '</strong></div>' +
        '<div class="box hi"><p>Appointments</p><strong>' + num(sumOf(withNums, 'appts')) + '</strong></div></div>' : '') +
      '<p class="summary">' + summary + '</p>' +
      (rows.length ?
        '<h3>By team member</h3><table><thead><tr><th>Team member</th><th class="r">Shifts</th><th class="r">Hours</th><th class="r">Avg shift</th>' + numHead + '</tr></thead><tbody>' +
        people.map(p => { const w = sumOf(p.rows, 'work'); return '<tr><td><b>' + escHtml(p.name) + '</b></td><td class="r mono">' + p.rows.length + '</td><td class="r mono">' + hm(w) + '</td><td class="r mono">' + hm(w / p.rows.length) + '</td>' + (anyNums ? numCols(p.rows) : '') + '</tr>'; }).join('') +
        '</tbody></table>' +
        '<h3>Day by day</h3><table class="days"><thead><tr><th>Date</th><th>Team member</th><th class="r">Hours</th>' + numHead + '</tr></thead><tbody>' +
        rows.map(r => '<tr><td>' + new Date(r.date + 'T00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) + '</td><td>' + escHtml(r.name) +
          (notes && r.brief ? '<small class="brief">' + escHtml(r.brief) + '</small>' : '') + '</td><td class="r mono">' + hm(r.work) + '</td>' + (anyNums ? dayNums(r) : '') + '</tr>').join('') +
        '</tbody></table>' : '') +
      '<div class="foot"><div><span>Amr Abdelgawad Talents · amrabdelgawad.site</span><span>' + escHtml(rep.coName) + ' · ' + mText + '</span></div></div>';
    $('repDownload').disabled = !rows.length;
    rep.mText = mText; rep.coId = coId;
    drawInvoice();
  }

  // Invoice page: hours × the company rate locked onto each shift, one line per person and rate
  function drawInvoice(){
    const inv = $('inv'), on = $('repInv').checked && rep.rows.length;
    inv.hidden = !on;
    const noRate = rep.rows.filter(r => r.billRate == null);
    $('repWarn').hidden = !(on && noRate.length);
    $('repWarn').textContent = noRate.length + ' shift' + (noRate.length === 1 ? ' has' : 's have') + ' no company rate and ' + (noRate.length === 1 ? 'is' : 'are') + ' left off the invoice. Set it in History › Change company rate.';
    if (!on) return;
    const cents = n => Math.round(n * 100) / 100;
    const lines = new Map();
    rep.rows.filter(r => r.billRate != null).forEach(r => {
      const k = nameKey(r.name) + '|' + r.billRate;
      if (!lines.has(k)) lines.set(k, { name:r.name, rate:r.billRate, secs:0, n:0, rows:[] });
      const l = lines.get(k); l.secs += r.work; l.n++; l.rows.push(r);
    });
    const list = [...lines.values()].sort((a, b) => a.name.localeCompare(b.name) || a.rate - b.rate);
    list.forEach(l => { l.amt = cents(l.secs / 3600 * l.rate); });
    const total = cents(list.reduce((a, l) => a + l.amt, 0)), secs = list.reduce((a, l) => a + l.secs, 0);
    const billed = list.flatMap(l => l.rows), paidRows = billed.filter(r => r.clientPaid);
    const allPaid = billed.length && paidRows.length === billed.length;
    const paidAmt = cents(paidRows.reduce((a, r) => a + r.work / 3600 * r.billRate, 0));
    const lastPaid = paidRows.map(r => r.clientPaidAt).filter(Boolean).sort().pop();
    const number = 'INV-' + rep.month.replace('-', '') + '-' + String(rep.coId).padStart(2, '0');
    const pay = $('repPay').value.trim();
    const stamp = allPaid ? '<div class="stamp"><i></i>Paid' + (lastPaid ? ' on ' + longDate(lastPaid) : '') + '</div>'
      : paidRows.length ? '<div class="stamp due"><i></i>Partly paid</div>' : '<div class="stamp due"><i></i>Amount due</div>';
    const due = allPaid ? 0 : cents(total - paidAmt);
    inv.innerHTML =
      '<div class="band"></div>' +
      '<div class="top"><div class="brand">Amr Abdelgawad<em>Talents</em><small>amrabdelgawad.site</small></div>' +
      '<div class="doc"><h1>Invoice</h1><p>No. <b>' + number + '</b></p><p>Issued <b>' + longDate(new Date()) + '</b></p></div></div>' +
      '<div class="meta">' +
        '<div class="box"><p>Bill to</p><strong>' + escHtml(rep.coName) + '</strong><span>Remote team services</span></div>' +
        '<div class="box"><p>Period</p><strong>' + rep.mText + '</strong><span>' + billed.length + ' shift' + (billed.length === 1 ? '' : 's') + ' · ' + hm(secs) + '</span></div>' +
        '<div class="box"><p>From</p><strong>Amr Abdelgawad Talents</strong><span>amrabdelgawad.site</span></div>' +
      '</div>' +
      '<table><thead><tr><th>Description</th><th class="r">Hours</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>' +
      list.map(l => '<tr><td><b>' + escHtml(l.name) + '</b><small>' + l.n + ' shift' + (l.n === 1 ? '' : 's') + ' in ' + rep.mText + '</small></td><td class="r mono">' + hm(l.secs) + '</td><td class="r mono">' + usd(l.rate) + '</td><td class="r mono">' + usd(l.amt) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<div class="bottom"><div class="note"><b>Hours are worked time only.</b> Breaks aren’t billed. Each line is hours × hourly rate, rounded to the cent. Details per day are in the monthly report.' +
        (pay ? '<span class="custom"><b>Payment:</b> ' + escHtml(pay) + '</span>' : '') + stamp + '</div>' +
        '<div class="totals"><div><span>Total hours</span><span class="mono">' + hm(secs) + '</span></div>' +
        '<div><span>Subtotal</span><span class="mono">' + usd(total) + '</span></div>' +
        (paidRows.length && !allPaid ? '<div><span>Already paid</span><span class="mono">' + usd(paidAmt) + '</span></div>' : '') +
        '<div class="grand"><span>' + (allPaid ? 'Total paid' : 'Amount due') + '</span><span class="mono">' + usd(allPaid ? total : due) + '</span></div></div></div>' +
      '<div class="foot"><div><span>Amr Abdelgawad Talents · amrabdelgawad.site</span><span>' + number + '</span></div></div>';
    rep.invNumber = number;
  }
  function fitReport(){
    if ($('repOverlay').hidden) return;
    const el = $('repSheets'), fit = $('repFit');
    el.style.transform = 'none';
    const w = el.offsetWidth, h = el.offsetHeight, s = Math.min(1, ($('repStage').clientWidth - 32) / w);
    el.style.transform = 'scale(' + s + ')'; el.style.transformOrigin = 'top left';
    fit.style.width = (w * s) + 'px'; fit.style.height = (h * s) + 'px';
  }
  window.addEventListener('resize', fitReport);
  function closeReport(){ $('repOverlay').hidden = true; document.body.style.overflow = ''; rep = null; }
  $('repClose').addEventListener('click', closeReport);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('repOverlay').hidden) closeReport(); });
  $('repDownload').addEventListener('click', async () => {
    if (!rep || !rep.rows.length) return;
    const btn = $('repDownload'); btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Preparing…';
    try {
      const html2pdf = await loadPdfLib();
      await document.fonts.ready;
      // The report, then the invoice on a page of its own
      const clone = document.createElement('div'), withInv = !$('inv').hidden;
      const sheet = el => { const c = el.cloneNode(true); c.removeAttribute('id'); c.style.boxShadow = 'none'; return c; };
      clone.appendChild(sheet($('rep')));
      if (withInv) { const br = document.createElement('div'); br.className = 'html2pdf__page-break'; clone.append(br, sheet($('inv'))); }
      const file = (withInv ? 'Report-and-Invoice-' : 'Monthly-Report-') + rep.coName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + rep.month + '.pdf';
      await html2pdf().set({
        margin: [10, 0, 10, 0], filename: file,
        image: { type:'jpeg', quality:0.96 },
        html2canvas: { scale:2, useCORS:true, backgroundColor:'#ffffff', scrollX:0, scrollY:0 },
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' },
        pagebreak: { mode:['css', 'legacy'], avoid:['tr', '.summary', '.meta', 'h3'] }
      }).from(clone).save();
      toast('Report downloaded', false);
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
      const ans = await ask({ title:(isPay ? 'New pay rate' : 'New company rate') + ' for ' + ids.length + ' shift' + (ids.length === 1 ? '' : 's'), ok:'Save rate',
        input:{ label:(isPay ? 'What you pay them per hour' : 'What the company pays you per hour') + ', in $', inputMode:'decimal' } });
      if (ans === null) return;
      const v = parseFloat(ans.replace('$', ''));
      if (isNaN(v) || v < 0) { toast('Enter a rate like 2.5', false); return; }
      const ok = await updateShifts(ids, isPay ? { pay_rate: v } : { bill_rate: v });
      if (ok) { selected.clear(); render(); toast((isPay ? 'Pay rate' : 'Company rate') + ' set to ' + usd(v) + '/hour on ' + ids.length + ' shift' + (ids.length === 1 ? '' : 's'), false); }
      return;
    }
    // Only touch shifts whose status actually changes, so already-paid ones keep their paid date and rate
    const changing = test => ids.filter(id => { const r = log.find(x => x.id === id); return r && test(r); });
    if (b.dataset.bulk === 'cpaid' || b.dataset.bulk === 'cunpaid') {
      const cpaid = b.dataset.bulk === 'cpaid';
      const todo = changing(r => r.clientPaid !== cpaid);
      const ok = !todo.length || await updateShifts(todo, { client_paid: cpaid });
      if (ok) { selected.clear(); render(); toast((cpaid ? 'Company paid you for ' : 'Company still owes for ') + ids.length + ' shift' + (ids.length === 1 ? '' : 's'), false); }
      return;
    }
    const paid = b.dataset.bulk === 'paid';
    b.setAttribute('aria-busy', 'true');
    const todo = changing(r => r.paid !== paid);
    const ok = !todo.length || await updateShifts(todo, { paid, paid_at: paid ? new Date().toISOString() : null });
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
      paid, paid_at: paid ? new Date().toISOString() : null, paid_fx: paid ? fxNow() : null, source: 'manual'
    }).select().single();
    $('addSave').removeAttribute('aria-busy');
    if (error) { $('addErr').textContent = "Couldn't save that shift. Try again."; return; }
    log.push(toRow(data));
    $('aH').value = ''; $('aM').value = ''; $('aB').value = ''; $('aPaid').checked = false;
    render(); toast('Added ' + hm(secs) + ' for ' + name + ' on ' + fmtDate(data.shift_date), false);
  });

  // ---------- one day's note, and editing a shift ----------
  // Both are <dialog>s styled like the ask() box. The edit fixes a wrong time, date, break or brief without deleting the shift.
  let noteDlg = null, editDlg = null, editing = null;
  const hhmmVal = s => s ? hhmmIso(s) : '';
  function dialog(html){
    const d = document.createElement('dialog'); d.className = 'ask wide shift-dlg'; d.innerHTML = html;
    d.addEventListener('click', e => { if (e.target === d) d.close(); }); // tap outside
    d.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => d.close()));
    document.body.appendChild(d); return d;
  }

  function openNote(r){
    if (!noteDlg) {
      noteDlg = dialog('<form method="dialog"><div class="sd-head"><div><h3 class="ask-t"></h3><p class="sd-sub"></p></div><button type="button" class="sd-x" data-close aria-label="Close">×</button></div>' +
        '<div class="sd-stats"></div><div class="sd-sec"><h4>How the day went</h4><p class="sd-brief"></p></div><div class="sd-sec sd-ai owner-only" hidden><h4>Suggestion</h4><p></p></div><p class="sd-orig" hidden></p>' +
        '<div class="ask-b"><span class="sd-meta"></span><button type="button" class="sd-edit">Edit shift</button><button type="submit" class="ask-ok">Close</button></div></form>');
      noteDlg.querySelector('.sd-edit').addEventListener('click', () => { const r = noteDlg.r; noteDlg.close(); openEdit(r); });
      noteDlg.querySelector('.sd-edit').classList.add('owner-only');
    }
    noteDlg.r = r;
    noteDlg.querySelector('.ask-t').textContent = r.name;
    noteDlg.querySelector('.sd-sub').textContent = fmtDate(r.date) + (companyName(r.companyId) ? ' · ' + companyName(r.companyId) : '');
    const times = r.startedAt && r.endedAt ? hhmmIso(r.startedAt) + '–' + hhmmIso(r.endedAt) : 'Not clocked';
    const nn = x => x == null ? '–' : num(x);
    noteDlg.querySelector('.sd-stats').innerHTML = '<div>Worked<strong>' + hm(r.work) + '</strong></div><div>Break<strong>' + hm(r.brk) + '</strong></div><div>Shift<strong>' + times + '</strong></div>' +
      (hasNums(r) ? '<div>Dials<strong>' + nn(r.dials) + '</strong></div><div>Conversations<strong>' + nn(r.convos) + '</strong></div><div>Appointments<strong>' + nn(r.appts) + '</strong></div>' : '');
    noteDlg.querySelector('.sd-brief').textContent = r.brief;
    const ai = noteDlg.querySelector('.sd-ai'); ai.hidden = !r.aiNote; ai.querySelector('p').textContent = r.aiNote || '';
    const og = noteDlg.querySelector('.sd-orig'); og.hidden = !r.original; og.textContent = originalText(r);
    noteDlg.querySelector('.sd-meta').textContent = r.editedAt ? 'Edited by you' : r.endedAt ? 'Sent at ' + hhmmIso(r.endedAt) : '';
    noteDlg.showModal(); noteDlg.querySelector('.ask-ok').focus();
  }

  function openEdit(r){
    if (!editDlg) {
      editDlg = dialog('<form method="dialog" novalidate><div class="sd-head"><div><h3 class="ask-t">Edit shift</h3><p class="sd-sub"></p></div><button type="button" class="sd-x" data-close aria-label="Close">×</button></div>' +
        '<p class="sd-warn" role="note" hidden></p><p class="sd-orig" hidden></p>' +
        '<div class="sd-grid"><label>Shift date<input class="ask-i" type="date" name="date" required></label><label>Company<select class="ask-i" name="co"></select></label></div>' +
        '<div class="sd-grid three"><label>Started<input class="ask-i" type="time" name="start"></label><label>Ended<input class="ask-i" type="time" name="end"></label><label>Break (minutes)<input class="ask-i" type="number" name="brk" min="0" step="1" inputmode="numeric"></label></div>' +
        '<div class="sd-calc"><span class="sd-calc-l">Worked</span><span class="sd-wk"><input class="ask-i" type="number" name="h" min="0" max="24" step="1" inputmode="numeric" aria-label="Hours worked"><b>h</b><input class="ask-i" type="number" name="m" min="0" max="59" step="1" inputmode="numeric" aria-label="Minutes worked"><b>m</b></span><span class="sd-amt"></span></div>' +
        '<div class="sd-grid three"><label>Dials<input class="ask-i" type="number" name="dials" min="0" step="1" inputmode="numeric" placeholder="–"></label><label>Conversations<input class="ask-i" type="number" name="convos" min="0" step="1" inputmode="numeric" placeholder="–"></label><label>Appointments<input class="ask-i" type="number" name="appts" min="0" step="1" inputmode="numeric" placeholder="–"></label></div>' +
        '<label>Brief<textarea class="ask-i ask-ta" name="brief" rows="4" placeholder="No note for this shift"></textarea></label>' +
        '<p class="ask-e" role="alert" hidden></p>' +
        '<div class="ask-b"><button type="button" data-close>Cancel</button><button type="submit" class="ask-ok">Save changes</button></div></form>');
      const f = editDlg.querySelector('form');
      ['start', 'end', 'brk', 'h', 'm'].forEach(n => f[n].addEventListener('input', () => { editDlg.querySelector('.ask-e').hidden = true; recalc(n); }));
      f.addEventListener('submit', e => { e.preventDefault(); saveEdit(); });
    }
    editing = r;
    const f = editDlg.querySelector('form');
    editDlg.querySelector('.sd-sub').textContent = r.name;
    const w = editDlg.querySelector('.sd-warn');
    w.hidden = !r.paid;
    w.textContent = 'This shift is already marked paid' + (r.paidAt ? ' (' + new Date(r.paidAt).toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ')' : '') +
      '. Changing the hours changes its amount here, but not what you already paid ' + r.name.split(' ')[0] + '.';
    const og = editDlg.querySelector('.sd-orig'); og.hidden = !r.original; og.textContent = originalText(r);
    f.date.value = r.date;
    companyOptions(f.co, { pick: r.companyId ? null : 'Pick a company', current: r.companyId ? String(r.companyId) : '' });
    f.start.value = hhmmVal(r.startedAt); f.end.value = hhmmVal(r.endedAt);
    f.brk.value = Math.round(r.brk / 60);
    f.h.value = Math.floor(r.work / 3600); f.m.value = Math.floor(r.work % 3600 / 60);
    f.brief.value = r.brief;
    f.dials.value = r.dials != null ? r.dials : ''; f.convos.value = r.convos != null ? r.convos : ''; f.appts.value = r.appts != null ? r.appts : '';
    editDlg.querySelector('.ask-e').hidden = true;
    recalc();
    editDlg.showModal(); (f.start.value ? f.start : f.h).focus();
  }

  // Start + end times work out the hours (minus the break); with no times, the hours are typed in
  function editTimes(f){
    if (!f.start.value || !f.end.value) return null;
    const [y, mo, d] = f.date.value.split('-').map(Number), at = t => { const [h, m] = t.split(':').map(Number); return new Date(y, mo - 1, d, h, m); };
    const s = at(f.start.value), e = at(f.end.value);
    if (e <= s) e.setDate(e.getDate() + 1); // finished after midnight
    return { s, e };
  }
  function recalc(changed){
    const f = editDlg.querySelector('form'), t = f.date.value ? editTimes(f) : null;
    const auto = !!t && changed !== 'h' && changed !== 'm';
    if (auto) {
      const secs = Math.max(0, Math.round((t.e - t.s) / 60000) * 60 - (parseInt(f.brk.value, 10) || 0) * 60);
      f.h.value = Math.floor(secs / 3600); f.m.value = Math.floor(secs % 3600 / 60);
    }
    const secs = (parseInt(f.h.value, 10) || 0) * 3600 + (parseInt(f.m.value, 10) || 0) * 60;
    editDlg.querySelector('.sd-amt').textContent = secs > 0 ? usd(secs / 3600 * editing.payRate) : '';
  }

  async function saveEdit(){
    const r = editing, f = editDlg.querySelector('form'), err = editDlg.querySelector('.ask-e');
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (!f.date.value) return fail('Pick the shift date.');
    if (!f.co.value || f.co.value === 'add') return fail('Pick the company.');
    if (!!f.start.value !== !!f.end.value) return fail('Fill in both the start and end time, or clear both.');
    const bm = parseInt(f.brk.value || '0', 10), h = parseInt(f.h.value || '0', 10), m = parseInt(f.m.value || '0', 10);
    if ([bm, h, m].some(n => isNaN(n) || n < 0) || m > 59) return fail('Check the break and worked minutes.');
    const secs = h * 3600 + m * 60;
    if (secs < 60 || secs > 86400) return fail(secs < 60 ? 'Worked time has to be at least a minute. Check the times and the break.' : 'Worked time can’t be more than 24 hours.');
    const t = editTimes(f);
    if (t && (t.e - t.s) / 1000 < secs + bm * 60 - 59) return fail('Worked plus break is longer than the time between start and end.');
    const nums = ['dials', 'convos', 'appts'].map(n => f[n].value.trim() === '' ? null : parseInt(f[n].value, 10));
    if (nums.some(n => n !== null && (isNaN(n) || n < 0 || n > 100000))) return fail('Dials, conversations and appointments need whole numbers, or leave them empty.');
    const patch = {
      shift_date: f.date.value, company_id: Number(f.co.value), work_seconds: secs, break_seconds: bm * 60,
      started_at: t ? t.s.toISOString() : null, ended_at: t ? t.e.toISOString() : null,
      brief: f.brief.value.trim() || null, dials: nums[0], conversations: nums[1], appointments: nums[2], edited_at: new Date().toISOString()
    };
    if (!r.original) patch.original = snapshot(r); // keep the shift as it was first sent, only once
    const ok = editDlg.querySelector('.ask-ok'); ok.setAttribute('aria-busy', 'true');
    const { data, error } = await db.from('shifts').update(patch).eq('id', r.id).select().single();
    ok.removeAttribute('aria-busy');
    if (error) return fail("Couldn't save the changes. Check your connection and try again.");
    const i = log.indexOf(r); if (i >= 0) log[i] = toRow(data);
    editDlg.close(); render();
    toast('Updated ' + r.name + "'s shift on " + fmtDate(data.shift_date), false);
  }

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
      pay_rate: r.payRate, bill_rate: r.billRate, brief: r.brief || null, edited_at: r.editedAt, original: r.original, ai_note: r.aiNote || null,
      dials: r.dials, conversations: r.convos, appointments: r.appts
    }).select().single();
    if (error) { showNotice("Couldn't restore that shift."); return; }
    log.splice(i, 0, toRow(data)); render();
  });

  // ---------- CSV export ----------
  $('export').addEventListener('click', () => {
    const esc = v => { let s = String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const lines = [['Name','Shift date','Worked (hours)','Break (hours)','Company','Status','Company paid you','Amount (USD)','Clock in','Clock out','Dials','Conversations','Appointments','Brief'].map(esc).join(',')];
    const blank = n => n == null ? '' : n;
    visible().forEach(r => lines.push([
      r.name, r.date, (r.work/3600).toFixed(2), (r.brk/3600).toFixed(2), companyName(r.companyId),
      r.paid ? 'Paid' : 'Unpaid', r.clientPaid ? 'Yes' : 'No', earned([r]).toFixed(2),
      r.startedAt ? hhmmIso(r.startedAt) : '', r.endedAt ? hhmmIso(r.endedAt) : '', blank(r.dials), blank(r.convos), blank(r.appts), r.brief
    ].map(esc).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type:'text/csv' }));
    a.download = 'team-shifts-' + (range === 'custom' ? ($('from').value || 'start') + '_to_' + ($('to').value || 'today') : range) + '.csv';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // The app's menu opens one person's hours (#team/<name>); applied on the next render
  function pick(name, now){
    picked = name || '';
    if (now && log.length) render();
  }

  return { load, pick };
};
