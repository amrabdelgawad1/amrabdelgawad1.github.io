// /cash: your own time, your team, income, expenses, and the monthly statement.
// The Team tab lives in team.js; this file signs in once for the whole page.
(function(){
  const $ = id => document.getElementById(id);
  const cfg = window.TRACKER_CONFIG || {};
  if (!/^https:\/\//.test(cfg.supabaseUrl || '') || !window.supabase) {
    $('loginErr').textContent = 'Not connected yet: add the Supabase URL and key to tracker/config.js.';
    $('loginBtn').setAttribute('aria-busy', 'true');
    return;
  }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  const OWNER_NAME = 'Amr Abdelgawad';
  const VIEWS = ['overview', 'mytime', 'team', 'income', 'expense'];
  const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const thisMonth = () => iso(new Date()).slice(0, 7);
  let entries = [], shifts = [], companies = [];
  let view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  let month = thisMonth(), lastDeleted = null, toastTimer = null, team = null;
  let editing = null, fKind = 'income', fMode = 'fixed';

  const cents = n => Math.round(n * 100) / 100;
  const usd = n => (cents(n) < 0 ? '−' : '') + '$' + Math.abs(cents(n)).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const hm = s => Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';
  const clock = s => { s = Math.max(0, Math.floor(s)); return [Math.floor(s/3600), Math.floor(s%3600/60), s%60].map(x => String(x).padStart(2,'0')).join(':'); };
  const hhmm = d => String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  const hrs = h => (Math.round(h * 100) / 100) + 'h';
  const fmtDate = d => new Date(d+'T00:00').toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' });
  const dayDate = d => new Date(d+'T00:00').toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric' });
  const monthLabel = m => new Date(m+'-01T00:00').toLocaleDateString('en-US',{ month:'long', year:'numeric' });
  const stepMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); return iso(new Date(y, mo - 1 + n, 1)).slice(0, 7); };
  const inPeriod = d => month === 'all' || d.slice(0, 7) === month;
  const key = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const plural = (n, w) => n + ' ' + (n === 1 ? w : w === 'entry' ? 'entries' : w + 's');
  const company = id => companies.find(c => c.id === id) || null;
  const companyName = id => (company(id) || {}).name || '';
  const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch(e){} },
    del(k){ try { localStorage.removeItem(k); } catch(e){} }
  };
  const DONE = { income:'Received', expense:'Paid' }, OPEN = { income:'Not received', expense:'Unpaid' };
  const CATS = { income:['Salary', 'Hourly work', 'Project', 'Client', 'Other'], expense:['Subscriptions', 'Software', 'Equipment', 'Team', 'Transport', 'Other'] };
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  const PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';

  // ---------- auth ----------
  // After the password comes a code from an authenticator app. It's asked once per device:
  // the session stays verified until you sign out.
  let mfaFactor = null, mfaEmail = '';
  async function showDash(email){
    mfaEmail = email;
    const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel === 'aal2') return openDash();
    const { data: f } = await db.auth.mfa.listFactors();
    const verified = ((f && f.totp) || []).find(x => x.status === 'verified');
    $('loginView').hidden = true; $('dashView').hidden = true; $('mfaView').hidden = false;
    $('mfaErr').textContent = ''; $('mfaCode').value = '';
    if (verified) {
      mfaFactor = verified.id;
      // More than one app set up: ask which one you're using
      const apps = ((f && f.totp) || []).filter(x => x.status === 'verified');
      $('mfaWhichWrap').hidden = apps.length < 2;
      $('mfaWhich').innerHTML = '';
      apps.forEach(x => { const o = document.createElement('option'); o.value = x.id; o.textContent = factorName(x); $('mfaWhich').appendChild(o); });
      $('mfaSetup').hidden = true;
      $('mfaTitle').textContent = 'Enter your code';
      $('mfaSub').textContent = 'Open your authenticator app and type the 6-digit code for Cash. This device stays verified until you sign out.';
    } else {
      // Clear any half-finished setup, then start a fresh one
      for (const x of ((f && f.all) || []).filter(x => x.status !== 'verified')) await db.auth.mfa.unenroll({ factorId: x.id });
      const { data, error } = await db.auth.mfa.enroll({ factorType:'totp', friendlyName:'Cash ' + Date.now() });
      if (error) { $('mfaErr').textContent = "Couldn't start the setup. Refresh the page and try again."; return; }
      mfaFactor = data.id;
      $('mfaTitle').textContent = 'Set up two-step sign-in';
      $('mfaSub').textContent = 'Scan this with an authenticator app, like Google Authenticator, then type the 6-digit code it shows. You only do this once.';
      $('mfaQr').innerHTML = '';
      const img = document.createElement('img'); img.src = data.totp.qr_code; img.alt = 'QR code for your authenticator app';
      $('mfaQr').appendChild(img);
      $('mfaSecret').textContent = data.totp.secret;
      $('mfaSetup').hidden = false;
    }
    $('mfaCode').focus();
  }
  function openDash(){
    $('mfaView').hidden = true; $('loginView').hidden = true; $('dashView').hidden = false;
    $('meEmail').textContent = mfaEmail; $('meAv').textContent = (mfaEmail[0] || 'A').toUpperCase();
    load();
  }
  $('mfaForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('mfaCode').value.replace(/\D/g, '');
    if (code.length !== 6) { $('mfaErr').textContent = 'Enter the 6-digit code from your app.'; return; }
    $('mfaBtn').setAttribute('aria-busy', 'true');
    if (!$('mfaWhichWrap').hidden) mfaFactor = $('mfaWhich').value;
    const { error } = await db.auth.mfa.challengeAndVerify({ factorId: mfaFactor, code });
    $('mfaBtn').removeAttribute('aria-busy');
    if (error) { $('mfaErr').textContent = "That code didn't work. Codes change every 30 seconds, so try the one showing now."; $('mfaCode').select(); return; }
    openDash();
  });
  $('mfaCode').addEventListener('input', () => $('mfaErr').textContent = '');
  $('mfaOut').addEventListener('click', async () => { await db.auth.signOut(); showLogin(); });
  function showLogin(){ $('dashView').hidden = true; $('mfaView').hidden = true; $('loginView').hidden = false; entries = []; shifts = []; }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const em = $('em').value.trim(), pw = $('pw').value;
    if (!em || !em.includes('@')) { $('loginErr').textContent = 'Enter your email address.'; return; }
    if (!pw) { $('loginErr').textContent = 'Enter your password.'; return; }
    $('loginBtn').setAttribute('aria-busy', 'true');
    const { data, error } = await db.auth.signInWithPassword({ email: em, password: pw });
    $('loginBtn').removeAttribute('aria-busy');
    $('pw').value = '';
    if (error) {
      $('loginErr').textContent = /invalid/i.test(error.message) ? "That email and password don't match." : "Couldn't sign in. Check your connection and try again.";
      return;
    }
    showDash(data.user.email);
  });
  ['em','pw'].forEach(id => $(id).addEventListener('input', () => $('loginErr').textContent = ''));
  $('signOut').addEventListener('click', async () => { await db.auth.signOut(); showLogin(); });

  // ---------- data ----------
  const toEntry = x => ({
    id: x.id, kind: x.kind, date: x.entry_date, title: x.title, party: x.party || '', category: x.category || 'Other',
    hours: x.hours != null ? Number(x.hours) : null, rate: x.rate != null ? Number(x.rate) : null,
    amount: Number(x.amount), settled: x.settled, settledAt: x.settled_at, recurring: x.recurring, note: x.note || '', createdAt: x.created_at,
    periodStart: x.period_start || null, periodEnd: x.period_end || null,
    currency: x.currency || 'USD', fxRate: x.fx_rate != null ? Number(x.fx_rate) : null, spread: !!x.spread
  });
  // Money in pounds is converted at the rate saved with the entry
  const usdOf = e => e.currency === 'EGP' ? (e.fxRate ? e.amount / e.fxRate : 0) : e.amount;
  const egp = n => 'EGP ' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const inCur = (n, cur) => cur === 'EGP' ? egp(n) : usd(n);
  const money = e => e.currency === 'EGP' ? egp(e.amount) + ' · ' + usd(usdOf(e)) : usd(e.amount);
  // Project pay period, like "Sep 28 – Oct 9 · 12 days"
  const periodText = e => {
    const a = new Date(e.periodStart + 'T00:00'), b = new Date(e.periodEnd + 'T00:00');
    const f = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric', year: a.getFullYear() !== b.getFullYear() ? 'numeric' : undefined });
    const days = Math.round((b - a) / 86400000) + 1;
    return (e.periodStart === e.periodEnd ? f(a) : f(a) + ' – ' + f(b)) + ' · ' + plural(days, 'day');
  };
  const detailText = e => e.periodStart ? periodText(e) : e.hours != null && e.rate != null ? hrs(e.hours) + ' × ' + inCur(e.rate, e.currency) : '';
  // A spread project counts day by day: each month gets its share of the project's days
  const dayList = e => { const out = []; for (let d = new Date(e.periodStart + 'T00:00'), end = new Date(e.periodEnd + 'T00:00'); d <= end; d.setDate(d.getDate() + 1)) out.push(iso(d)); return out; };
  const shareOf = (e, inP) => { if (!(e.spread && e.periodStart)) return inP(e.date) ? 1 : 0; const days = dayList(e); return days.filter(inP).length / days.length; };
  // The part of an entry inside a period: same fields, amount scaled, src points at the real entry
  const partsIn = (list, inP) => list.map(e => [e, shareOf(e, inP)]).filter(([, f]) => f > 0)
    .map(([e, f]) => f === 1 ? e : Object.assign({}, e, { amount: e.amount * f, part: f, src: e }));
  const partNote = e => e.part ? Math.round(e.part * dayList(e).length) + ' of ' + plural(dayList(e).length, 'day') + ' here, of ' + money(e.src) : '';
  const entryMonths = e => e.spread && e.periodStart ? [...new Set(dayList(e).map(d => d.slice(0, 7)))] : [e.date.slice(0, 7)];
  const toShift = x => ({
    id: x.id, name: x.name.trim(), date: x.shift_date, work: x.work_seconds, brk: x.break_seconds || 0,
    startedAt: x.started_at, endedAt: x.ended_at, companyId: x.company_id, source: x.source, createdAt: x.created_at,
    owner: !!x.owner, paid: !!x.paid, paidAt: x.paid_at, paidFx: x.paid_fx != null ? Number(x.paid_fx) : null,
    // Team shifts: "paid" is you paying them; clientPaid is the company paying you for their hours
    clientPaid: !!x.client_paid, clientPaidAt: x.client_paid_at, clientFx: x.client_fx != null ? Number(x.client_fx) : null,
    // Your own hours never cost team pay
    payRate: x.owner ? 0 : Number(x.pay_rate), billRate: x.bill_rate != null ? Number(x.bill_rate) : null
  });
  async function fetchAll(table, cols, dateCol){
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select(cols).order(dateCol, { ascending:false }).range(from, from + 999);
      if (error) return { error };
      all.push(...data);
      if (data.length < 1000) break;
    }
    return { data: all };
  }
  async function fetchShifts(){
    const [sh, co] = await Promise.all([fetchAll('shifts', '*', 'shift_date'), db.from('companies').select('*').order('name')]);
    if (!co.error) companies = co.data;
    if (sh.error) { showNotice(/owner/.test(sh.error.message || '') ? 'My time isn’t set up yet. Run supabase/cash-my-time.sql in the Supabase SQL Editor, then refresh.' : "Couldn't load shifts, so hours and team profit show as $0. Refresh to try again."); return false; }
    shifts = sh.data.map(toShift);
    return true;
  }

  async function load(){
    clearNotice();
    const [en] = await Promise.all([fetchAll('cash_entries', '*', 'entry_date'), fetchShifts(), loadTimer()]);
    if (en.error) return showNotice(/cash_entries/.test(en.error.message || '') ? 'The finance table isn’t set up yet. Run supabase/cash-setup.sql in the Supabase SQL Editor, then refresh.' : "Couldn't load your finances. Refresh the page to try again.");
    entries = en.data.map(toEntry);
    switchView(view);
    loadFx();
    checkBackup();
    renderFactors();
  }
  function showNotice(msg){ $('notice').textContent = msg; $('notice').hidden = false; }
  function clearNotice(){ $('notice').hidden = true; }

  // ---------- money math ----------
  // Your own work = hours × the company's rate, all yours.
  // Team profit = what each company pays minus what the team is paid, at the rates locked onto each shift.
  const shiftValue = s => s.work / 3600 * s.billRate;
  const shiftProfit = s => s.work / 3600 * (s.billRate - s.payRate);
  function totals(inP){
    const sh = shifts.filter(s => inP(s.date)), counted = sh.filter(s => s.billRate != null);
    const own = counted.filter(s => s.owner), crew = counted.filter(s => !s.owner);
    const en = partsIn(entries, inP);
    const inc = en.filter(e => e.kind === 'income'), exp = en.filter(e => e.kind === 'expense');
    const sum = (l, f) => l.reduce((a, x) => a + f(x), 0);
    const ownAmt = sum(own, shiftValue), teamAmt = sum(crew, shiftProfit), income = sum(inc, usdOf), expense = sum(exp, usdOf);
    const ownDue = sum(own.filter(s => !s.paid), shiftValue);
    const crewDue = sum(crew.filter(s => !s.clientPaid), shiftValue); // companies still owe you for team hours
    return {
      own, crew, skipped: sh.filter(s => s.billRate == null), inc, exp,
      ownAmt, team: teamAmt, income, expense, net: ownAmt + teamAmt + income - expense,
      ownSecs: sum(own, s => s.work), teamSecs: sum(crew, s => s.work), ownDue, crewDue,
      toReceive: ownDue + crewDue + sum(inc.filter(e => !e.settled), usdOf), toPay: sum(exp.filter(e => !e.settled), usdOf)
    };
  }
  function byPerson(list){
    const m = new Map();
    list.forEach(s => {
      const k = key(s.name);
      if (!m.has(k)) m.set(k, { name:s.name, secs:0, profit:0, cos:new Set(), due:0 });
      const g = m.get(k); g.secs += s.work; g.profit += shiftProfit(s); g.cos.add(companyName(s.companyId));
      if (!s.clientPaid) g.due += shiftValue(s);
    });
    return [...m.values()].sort((a, b) => b.profit - a.profit);
  }
  function byCompany(list){
    const m = new Map();
    list.forEach(s => {
      if (!m.has(s.companyId)) m.set(s.companyId, { name:companyName(s.companyId), secs:0, amt:0, due:0, rates:new Set() });
      const g = m.get(s.companyId); g.secs += s.work; g.amt += shiftValue(s); g.rates.add(s.billRate); if (!s.paid) g.due += shiftValue(s);
    });
    return [...m.values()].sort((a, b) => b.amt - a.amt);
  }

  // ---------- period ----------
  function fillMonths(){
    const all = [...entries.flatMap(entryMonths), ...shifts.map(s => s.date.slice(0, 7))];
    const lo = all.reduce((a, b) => b < a ? b : a, thisMonth()), hi = all.reduce((a, b) => b > a ? b : a, thisMonth());
    const sel = $('month'); sel.innerHTML = '';
    const opt = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
    for (let m = hi; m >= lo; m = stepMonth(m, -1)) opt(m, monthLabel(m));
    opt('all', 'All time');
    if (month !== 'all' && (month < lo || month > hi)) month = thisMonth();
    sel.value = month;
    $('prevM').disabled = month === 'all' || month <= lo;
    $('nextM').disabled = month === 'all' || month >= hi;
    $('statementBtn').disabled = month === 'all';
    $('statementBtn').title = month === 'all' ? 'Pick a month first' : '';
  }
  $('month').addEventListener('change', () => { month = $('month').value; render(); });
  $('prevM').addEventListener('click', () => { month = stepMonth(month, -1); render(); });
  $('nextM').addEventListener('click', () => { month = stepMonth(month, 1); render(); });

  // ---------- view switch ----------
  async function switchView(v){
    const leavingTeam = view === 'team' && v !== 'team';
    view = v;
    document.querySelectorAll('#view button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
    history.replaceState(null, '', v === 'overview' ? location.pathname : '#' + v);
    $('teamView').hidden = v !== 'team';
    $('cashTools').hidden = v === 'team';
    $('addToggle').hidden = v === 'team' || v === 'mytime';
    if (v === 'team' || v === 'mytime') closeForm();
    if (v === 'team') {
      ['overviewView', 'mytimeView', 'listView'].forEach(id => $(id).hidden = true);
      $('pageTitle').textContent = 'Team';
      if (!team) team = window.CashTeam(db);
      team.load();
      return;
    }
    if (leavingTeam) await fetchShifts(); // pick up anything changed on the Team tab
    if (v === 'mytime') loadTimer().then(renderTimer);
    render();
  }
  $('view').addEventListener('click', e => { const b = e.target.closest('button'); if (b) switchView(b.dataset.v); });
  // The app's menu switches sections by changing the address
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== view && !$('dashView').hidden) switchView(v); });

  // ---------- render ----------
  function render(){
    if (view === 'team') return;
    fillMonths();
    const label = month === 'all' ? 'All time' : monthLabel(month);
    $('pageTitle').textContent = { overview:'Overview', mytime:'My time', income:'Income', expense:'Expenses' }[view];
    $('addLabel').textContent = view === 'expense' ? 'Add expense' : view === 'income' ? 'Add income' : 'Add entry';
    $('overviewView').hidden = view !== 'overview';
    $('mytimeView').hidden = view !== 'mytime';
    $('listView').hidden = view !== 'income' && view !== 'expense';
    $('periodLabel').textContent = label;
    fillSuggestions();
    if (view === 'overview') renderOverview();
    else if (view === 'mytime') renderMyTime();
    else renderList(view);
  }

  function renderOverview(){
    const t = totals(inPeriod);
    setUsd('tOwn', t.ownAmt);
    $('tOwnSub').textContent = hm(t.ownSecs) + ' worked';
    setUsd('tTeam', t.team);
    $('tTeamSub').textContent = hm(t.teamSecs) + ' of team hours';
    setUsd('tIncome', t.income);
    $('tIncomeSub').textContent = plural(t.inc.length, 'entry');
    setUsd('tExpense', t.expense);
    $('tExpenseSub').textContent = plural(t.exp.length, 'expense');
    setUsd('tNet', t.net);
    $('tNetBox').classList.toggle('neg', t.net < 0);
    const gross = t.ownAmt + t.team + t.income;
    $('tNetSub').textContent = gross > 0 ? Math.round(t.net / gross * 100) + '% of what came in' : '';
    paintEgp();

    const p = [];
    if (t.toReceive > 0) p.push('Still to receive <b>' + usd(t.toReceive) + '</b>');
    if (t.toPay > 0) p.push('Expenses still unpaid <b>' + usd(t.toPay) + '</b>');
    $('pending').innerHTML = p.map(x => '<span>' + x + '</span>').join('');
    $('pending').hidden = !p.length;

    const warn = $('teamWarn');
    if (t.skipped.length) {
      warn.textContent = plural(t.skipped.length, 'shift') + ' (' + hm(t.skipped.reduce((a, s) => a + s.work, 0)) + ') aren’t counted because the company had no rate when they were logged. Fix the rate on the Team tab, under Profit.';
      warn.hidden = false;
    } else warn.hidden = true;

    // Where it came from: your own work, each team member, then each income source
    const inRows = byCompany(t.own).map(g => ({ label:g.name, tag:'You', me:true, sub:hm(g.secs) + (g.due ? ' · ' + usd(g.due) + ' not paid yet' : ' · paid'), amt:g.amt, go:'mytime' }));
    byPerson(t.crew).forEach(g => inRows.push({ label:g.name, tag:'Team', sub:hm(g.secs) + ' · ' + [...g.cos].filter(Boolean).join(', ') + (g.due ? ' · company owes ' + usd(g.due) : ''), amt:g.profit, go:'team' }));
    const src = new Map();
    t.inc.forEach(e => {
      const k = key(e.party || e.title);
      if (!src.has(k)) src.set(k, { label:e.party || e.title, titles:new Set(), amt:0, open:0 });
      const g = src.get(k); g.amt += usdOf(e); g.titles.add(e.title); if (!e.settled) g.open += usdOf(e);
    });
    [...src.values()].sort((a, b) => b.amt - a.amt).forEach(g => inRows.push({
      label:g.label, sub:[...g.titles].slice(0, 3).join(', ') + (g.open ? ' · ' + usd(g.open) + ' not received' : ''), amt:g.amt, go:'income'
    }));
    drawBars($('cameFrom'), inRows, 'in', 'Nothing came in for this period yet.');

    const cat = new Map();
    t.exp.forEach(e => {
      const k = key(e.category);
      if (!cat.has(k)) cat.set(k, { label:e.category, titles:new Set(), amt:0 });
      const g = cat.get(k); g.amt += usdOf(e); g.titles.add(e.title);
    });
    drawBars($('wentTo'), [...cat.values()].sort((a, b) => b.amt - a.amt).map(g => ({ label:g.label, sub:[...g.titles].slice(0, 3).join(', '), amt:g.amt, go:'expense' })), 'out', 'No expenses for this period.');

    renderMonths();
  }

  // Dollar totals carry their value in data-usd; the line under each shows it in pounds at today's rate
  // Money in a total card: cents are set smaller in their own span
  const setUsd = (id, n) => {
    const el = $(id), t = usd(n), m = t.match(/^(.*[0-9])([.][0-9][0-9])$/);
    el.textContent = m ? m[1] : t; el.dataset.usd = n;
    if (m) { const c = document.createElement('span'); c.className = 'c'; c.textContent = m[2]; el.appendChild(c); }
  };
  function paintEgp(){
    document.querySelectorAll('[data-egp]').forEach(el => {
      const out = el.parentElement.querySelector('.egp'); if (!out) return;
      const v = parseFloat(el.dataset.usd);
      out.textContent = fx.rate && !isNaN(v) ? '= ' + (v < -0.004 ? '−' : '') + egp(Math.abs(v) * fx.rate) : '';
      out.title = fx.rate ? 'At ' + fx.rate.toFixed(2) + ' EGP per $1' : '';
    });
  }
  window.paintEgp = paintEgp;

  function drawBars(el, list, cls, emptyText){
    el.innerHTML = '';
    if (!list.length) { el.innerHTML = '<p class="empty">' + emptyText + '</p>'; return; }
    const max = Math.max(1, ...list.map(g => Math.abs(g.amt)));
    list.forEach(g => {
      const d = document.createElement(g.go ? 'button' : 'div'); d.className = 'crow' + (g.go ? ' go' : '');
      // Each row opens the tab where its entries can be edited
      if (g.go) { d.type = 'button'; d.title = 'Open ' + { mytime:'My time', team:'Team', income:'Income', expense:'Expenses' }[g.go]; d.addEventListener('click', () => { switchView(g.go); window.scrollTo({ top:0, behavior:'smooth' }); }); }
      d.innerHTML = '<span class="cname"><span class="l"></span><small></small></span><span class="cnum ' + cls + '"></span><div class="bbar ' + cls + '"><i></i></div>';
      d.querySelector('.l').textContent = g.label;
      if (g.tag) { const t = document.createElement('span'); t.className = 'tag' + (g.me ? ' me' : ''); t.textContent = g.tag; d.querySelector('.l').after(t); }
      d.querySelector('small').textContent = g.sub;
      d.querySelector('.cnum').textContent = usd(g.amt);
      el.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => { d.querySelector('.bbar i').style.width = (Math.max(0, g.amt) / max * 100) + '%'; }));
    });
  }

  function renderMonths(){
    const set = new Set([...entries.flatMap(entryMonths), ...shifts.map(s => s.date.slice(0, 7))]);
    const list = [...set].sort().reverse();
    const box = $('months'); box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<p class="empty">No history yet.</p>'; return; }
    list.forEach(m => {
      const t = totals(d => d.slice(0, 7) === m);
      const b = document.createElement('button'); b.className = 'mrow' + (m === month ? ' on' : '');
      b.innerHTML = '<span></span><span class="in"></span><span class="in"></span><span class="in"></span><span class="out"></span><span class="net"></span>';
      const c = b.children;
      c[0].textContent = monthLabel(m); c[1].textContent = usd(t.ownAmt); c[2].textContent = usd(t.team); c[3].textContent = usd(t.income);
      c[4].textContent = t.expense ? '−' + usd(t.expense) : usd(0); c[5].textContent = usd(t.net);
      c[5].classList.toggle('neg', t.net < 0);
      b.addEventListener('click', () => { month = m; render(); window.scrollTo({ top:0, behavior:'smooth' }); });
      box.appendChild(b);
    });
  }

  // ---------- my time: the clock ----------
  // Kept in the database so you can clock in on your laptop and out on your phone.
  const TIMER_KEY = 'owner_timer';
  let tmr = null;
  const workSecs = (now = Date.now()) => tmr ? (now - tmr.startedAt) / 1000 - tmr.breakSecs - (tmr.breakSince ? (now - tmr.breakSince) / 1000 : 0) : 0;
  const breakSecs = (now = Date.now()) => tmr ? tmr.breakSecs + (tmr.breakSince ? (now - tmr.breakSince) / 1000 : 0) : 0;
  const validTimer = t => t && typeof t.startedAt === 'number' && t.companyId != null ? t : null;
  async function loadTimer(){
    const { data, error } = await db.from('tracker_settings').select('*').eq('key', TIMER_KEY);
    let t = null;
    if (!error) { try { t = JSON.parse((data[0] || {}).value || 'null'); } catch(e){} }
    else { try { t = JSON.parse(store.get('cash-' + TIMER_KEY) || 'null'); } catch(e){} } // offline: this device's copy
    tmr = validTimer(t);
  }
  async function saveTimer(){
    const value = tmr ? JSON.stringify(tmr) : 'off';
    if (tmr) store.set('cash-' + TIMER_KEY, value); else store.del('cash-' + TIMER_KEY);
    const { error } = await db.from('tracker_settings').upsert({ key: TIMER_KEY, value });
    $('tmrErr').textContent = error ? 'Saved on this device only. Check your connection.' : '';
  }
  function fillCompanyPicker(sel, pick){
    const cur = sel.value;
    sel.innerHTML = '';
    companies.forEach(c => { const o = document.createElement('option'); o.value = String(c.id); o.textContent = c.name + (c.bill_rate != null ? ' · ' + usd(Number(c.bill_rate)) + '/h' : ' · no rate yet'); sel.appendChild(o); });
    sel.value = pick != null ? String(pick) : (companies.some(c => String(c.id) === cur) ? cur : (store.get('cash-last-company') || (companies[0] ? String(companies[0].id) : '')));
    if (!sel.value && companies[0]) sel.value = String(companies[0].id);
  }
  function renderTimer(){
    const box = $('timer'), running = !!tmr, onBreak = running && !!tmr.breakSince;
    if (!running) fillCompanyPicker($('tmrCo')); else if ($('tmrCo').value !== String(tmr.companyId)) fillCompanyPicker($('tmrCo'), tmr.companyId);
    $('tmrCo').disabled = running;
    box.classList.toggle('run', running && !onBreak);
    box.classList.toggle('brk', onBreak);
    $('tmrClock').textContent = clock(workSecs());
    $('tmrStart').hidden = running;
    $('tmrBreak').hidden = !running; $('tmrStop').hidden = !running; $('tmrCancel').hidden = !running;
    $('tmrBreak').textContent = onBreak ? 'Back to work' : 'Take a break';
    if (!running) { $('tmrSub').textContent = 'Not clocked in'; return; }
    const c = company(tmr.companyId), r = c && c.bill_rate != null ? Number(c.bill_rate) : null;
    const since = hhmm(new Date(onBreak ? tmr.breakSince : tmr.startedAt));
    $('tmrSub').innerHTML = '<span class="live-dot"></span>';
    $('tmrSub').append((onBreak ? 'On break since ' + since : 'Working since ' + hhmm(new Date(tmr.startedAt))) +
      (breakSecs() >= 60 ? ' · ' + hm(breakSecs()) + ' break' : '') +
      (r != null ? ' · ' + usd(workSecs() / 3600 * r) + ' so far' : ''));
  }
  setInterval(() => { if (tmr && view === 'mytime' && !document.hidden) renderTimer(); }, 1000);

  $('tmrStart').addEventListener('click', async () => {
    const id = Number($('tmrCo').value);
    if (!id) { $('tmrErr').textContent = 'Add a company on the Team tab first.'; return; }
    store.set('cash-last-company', String(id));
    tmr = { companyId:id, startedAt:Date.now(), breakSecs:0, breakSince:null };
    renderTimer(); await saveTimer();
  });
  $('tmrBreak').addEventListener('click', async () => {
    if (!tmr) return;
    if (tmr.breakSince) { tmr.breakSecs += (Date.now() - tmr.breakSince) / 1000; tmr.breakSince = null; }
    else tmr.breakSince = Date.now();
    renderTimer(); await saveTimer();
  });
  $('tmrCancel').addEventListener('click', async () => {
    if (!tmr || !confirm('Discard this shift? The time won’t be saved.')) return;
    tmr = null; renderTimer(); await saveTimer();
  });
  $('tmrStop').addEventListener('click', async () => {
    if (!tmr) return;
    const now = Date.now(), work = Math.round(workSecs(now)), brk = Math.round(breakSecs(now));
    if (work < 60) { $('tmrErr').textContent = 'Less than a minute worked. Keep going, or discard the shift.'; return; }
    if (work > 86400) { $('tmrErr').textContent = 'That’s over 24 hours. Discard it and add the hours by hand.'; return; }
    $('tmrStop').setAttribute('aria-busy', 'true');
    const { data, error } = await db.from('shifts').insert({
      name: OWNER_NAME, shift_date: iso(new Date(tmr.startedAt)), work_seconds: work, break_seconds: Math.min(brk, 86400),
      started_at: new Date(tmr.startedAt).toISOString(), ended_at: new Date(now).toISOString(),
      company_id: tmr.companyId, source: 'tracker', owner: true, pay_rate: 0
    }).select().single();
    $('tmrStop').removeAttribute('aria-busy');
    if (error) { $('tmrErr').textContent = "Couldn't save the shift. Your time is kept, so try again."; return; }
    shifts.push(toShift(data));
    tmr = null; await saveTimer();
    month = data.shift_date.slice(0, 7);
    renderTimer(); render();
    toast('Saved ' + hm(work) + ' at ' + companyName(data.company_id), false);
  });

  // ---------- my time: shifts ----------
  function renderMyTime(){
    renderTimer();
    const rows = shifts.filter(s => s.owner && inPeriod(s.date)).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);
    const counted = rows.filter(s => s.billRate != null), sum = (l, f) => l.reduce((a, x) => a + f(x), 0);
    const paid = counted.filter(s => s.paid), due = counted.filter(s => !s.paid);
    $('myLabel').textContent = month === 'all' ? 'All time' : monthLabel(month);
    $('myHours').textContent = hm(sum(rows, s => s.work));
    $('myShifts').textContent = plural(rows.length, 'shift');
    setUsd('myEarned', sum(counted, shiftValue));
    setUsd('myPaid', sum(paid, shiftValue)); $('myPaidH').textContent = hm(sum(paid, s => s.work));
    setUsd('myDue', sum(due, shiftValue)); paintEgp(); $('myDueH').textContent = hm(sum(due, s => s.work));
    $('myPayAll').hidden = !rows.some(s => !s.paid);

    const body = $('myRows'); body.innerHTML = '';
    if (!rows.length) body.innerHTML = '<tr><td colspan="6" class="empty">No hours logged for this period. Clock in above, or add hours by hand.</td></tr>';
    rows.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="c-what"><span class="what"></span><span class="sub-line"></span></td>' +
        '<td class="c-date muted"></td>' +
        '<td class="c-hrs num"></td>' +
        '<td class="c-amt num r in"></td>' +
        '<td class="c-status"><button class="status"><i></i><span></span></button></td>' +
        '<td class="c-act"><div class="acts"><button class="icon-btn del" aria-label="Delete shift">' + TRASH + '</button></div></td>';
      tr.querySelector('.what').textContent = companyName(s.companyId) || 'No company';
      tr.querySelector('.sub-line').textContent = s.source === 'manual' ? 'Added by hand'
        : 'Clocked' + (s.startedAt && s.endedAt ? ' · ' + hhmm(new Date(s.startedAt)) + '–' + hhmm(new Date(s.endedAt)) : '') + (s.brk >= 60 ? ' · ' + hm(s.brk) + ' break' : '');
      tr.querySelector('.c-date').textContent = dayDate(s.date);
      tr.querySelector('.c-hrs').textContent = hm(s.work);
      const amt = tr.querySelector('.c-amt');
      if (s.billRate != null) { amt.textContent = usd(shiftValue(s)); amt.title = hm(s.work) + ' × ' + usd(s.billRate) + '/hour'; }
      else { amt.textContent = 'No rate'; amt.classList.remove('in'); amt.classList.add('muted'); }
      const st = tr.querySelector('.status');
      st.classList.add(s.paid ? 'done' : 'open');
      st.querySelector('span').textContent = s.paid ? 'Paid' : 'Not paid';
      st.title = s.paid && s.paidAt ? 'Paid ' + new Date(s.paidAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'Click when the company pays you';
      st.addEventListener('click', () => setShiftsPaid([s], !s.paid));
      tr.querySelector('.del').addEventListener('click', () => removeShift(s));
      body.appendChild(tr);
    });
  }
  async function setShiftsPaid(list, paid){
    const patch = { paid, paid_at: paid ? new Date().toISOString() : null, paid_fx: paid ? fx.rate || null : null };
    const { error } = await db.from('shifts').update(patch).in('id', list.map(s => s.id));
    if (error) return showNotice("Couldn't save that change. Try again.");
    clearNotice();
    list.forEach(s => { s.paid = paid; s.paidAt = patch.paid_at; s.paidFx = patch.paid_fx; });
    render();
    return true;
  }
  $('myPayAll').addEventListener('click', async () => {
    const list = shifts.filter(s => s.owner && inPeriod(s.date) && !s.paid);
    if (!list.length) return;
    const amt = list.filter(s => s.billRate != null).reduce((a, s) => a + shiftValue(s), 0);
    if (!confirm('Mark ' + plural(list.length, 'shift') + ' (' + usd(amt) + ') as paid?')) return;
    if (await setShiftsPaid(list, true)) toast('Marked ' + plural(list.length, 'shift') + ' as paid', false);
  });

  $('myAddToggle').addEventListener('click', () => {
    const f = $('myForm'); f.hidden = !f.hidden;
    if (!f.hidden) { if (!$('mDate').value) $('mDate').value = month === 'all' || month === thisMonth() ? iso(new Date()) : month + '-01'; fillCompanyPicker($('mCo')); $('mH').focus(); }
  });
  ['mDate','mH','mM'].forEach(id => $(id).addEventListener('input', () => $('mErr').textContent = ''));
  $('myForm').addEventListener('submit', async e => {
    e.preventDefault();
    const h = parseInt($('mH').value || '0', 10), m = parseInt($('mM').value || '0', 10), co = Number($('mCo').value);
    if (!$('mDate').value) { $('mErr').textContent = 'Pick the date.'; return; }
    if (!co) { $('mErr').textContent = 'Pick the company.'; return; }
    if ([h, m].some(n => isNaN(n) || n < 0) || m > 59 || h > 24) { $('mErr').textContent = 'Check the hours and minutes.'; return; }
    const secs = h * 3600 + m * 60;
    if (secs <= 0 || secs > 86400) { $('mErr').textContent = 'Enter how long you worked.'; return; }
    const paid = $('mPaid').checked;
    $('mSave').setAttribute('aria-busy', 'true');
    const { data, error } = await db.from('shifts').insert({
      name: OWNER_NAME, shift_date: $('mDate').value, work_seconds: secs, break_seconds: 0, company_id: co,
      paid, paid_at: paid ? new Date().toISOString() : null, paid_fx: paid ? fx.rate || null : null, source: 'manual', owner: true, pay_rate: 0
    }).select().single();
    $('mSave').removeAttribute('aria-busy');
    if (error) { $('mErr').textContent = "Couldn't save that. Try again."; return; }
    store.set('cash-last-company', String(co));
    shifts.push(toShift(data));
    $('mH').value = ''; $('mM').value = ''; $('mPaid').checked = false;
    if (month !== 'all') month = data.shift_date.slice(0, 7);
    render(); toast('Added ' + hm(secs) + ' at ' + companyName(co) + ' on ' + dayDate(data.shift_date), false);
  });

  // ---------- my time: one payment for several shifts ----------
  // Marks the oldest unpaid shifts at that company as paid, up to the amount. Never part of a shift.
  $('lumpToggle').addEventListener('click', () => {
    const f = $('lumpForm'); f.hidden = !f.hidden; $('myForm').hidden = true;
    if (!f.hidden) { fillCompanyPicker($('lCo')); if (!$('lDate').value) $('lDate').value = iso(new Date()); lumpFx(); $('lAmt').focus(); }
  });
  $('myAddToggle').addEventListener('click', () => { $('lumpForm').hidden = true; });
  function lumpFx(){ const e = $('lCur').value === 'EGP'; $('lFxWrap').hidden = !e; if (e && !$('lFx').value && fx.rate) $('lFx').value = fx.rate; }
  $('lCur').addEventListener('change', lumpFx);
  ['lAmt','lFx','lDate','lCo'].forEach(id => $(id).addEventListener('input', () => $('lErr').textContent = ''));
  $('lumpForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = m => { $('lErr').textContent = m; };
    const co = Number($('lCo').value), amt = parseFloat($('lAmt').value), cur = $('lCur').value, date = $('lDate').value;
    const rate = cur === 'EGP' ? parseFloat($('lFx').value) : null;
    if (!co) return err('Pick the company that paid you.');
    if (isNaN(amt) || amt <= 0) return err('Enter the amount you received.');
    if (cur === 'EGP' && !(rate > 0)) return err('Enter how many pounds one dollar was, like 48.5.');
    if (!date) return err('Pick the day you were paid.');
    const usdAmt = cur === 'EGP' ? amt / rate : amt;
    const open = shifts.filter(sh => (sh.owner ? !sh.paid : !sh.clientPaid) && sh.companyId === co && sh.billRate != null)
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
    if (!open.length) return err('Nothing is unpaid at ' + companyName(co) + '.');
    const pick = []; let left = usdAmt;
    for (const sh of open) { const v = cents(shiftValue(sh)); if (v > left + 0.005) break; pick.push(sh); left -= v; }
    if (!pick.length) return err('That’s less than your oldest unpaid shift (' + usd(shiftValue(open[0])) + ' on ' + dayDate(open[0].date) + '), so nothing was marked.');
    const covered = pick.reduce((a, sh) => a + shiftValue(sh), 0);
    left = cents(left);
    const range = pick.length === 1 ? dayDate(pick[0].date) : dayDate(pick[0].date) + ' to ' + dayDate(pick[pick.length - 1].date);
    const mine = pick.filter(sh => sh.owner), theirs = pick.filter(sh => !sh.owner);
    const what = [mine.length ? plural(mine.length, 'of your shifts').replace('of your shiftss', 'of your shifts') : '', theirs.length ? plural(theirs.length, 'team shift') : ''].filter(Boolean).join(' and ');
    if (!confirm('Mark ' + what + ' at ' + companyName(co) + ' as paid by them?\n\n' + range + ' · ' + usd(covered) +
      (left >= 0.01 ? '\n\n' + usd(left) + ' is left over. It isn’t enough for the next unpaid shift, so that one stays unpaid.' : ''))) return;
    const at = new Date(date + 'T12:00:00').toISOString(), fxDay = rate || fx.rate || null;
    $('lSave').setAttribute('aria-busy', 'true');
    const r1 = mine.length ? await db.from('shifts').update({ paid: true, paid_at: at, paid_fx: fxDay }).in('id', mine.map(sh => sh.id)) : {};
    const r2 = theirs.length && !r1.error ? await db.from('shifts').update({ client_paid: true, client_paid_at: at, client_fx: fxDay }).in('id', theirs.map(sh => sh.id)) : {};
    $('lSave').removeAttribute('aria-busy');
    if (r1.error || r2.error) { await fetchShifts(); render(); return err("Couldn't save all of that. Check the shifts and try again."); }
    mine.forEach(sh => { sh.paid = true; sh.paidAt = at; sh.paidFx = fxDay; });
    theirs.forEach(sh => { sh.clientPaid = true; sh.clientPaidAt = at; sh.clientFx = fxDay; });
    $('lAmt').value = ''; $('lumpForm').hidden = true;
    render();
    toast('Marked ' + plural(pick.length, 'shift') + ' as paid' + (left >= 0.01 ? ' · ' + usd(left) + ' left over' : ''), false);
  });

  // ---------- income / expense list ----------
  function renderList(kind){
    const rows = partsIn(entries.filter(e => e.kind === kind), inPeriod).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);
    $('logTable').classList.toggle('is-expense', kind === 'expense');
    $('listTitle').textContent = kind === 'income' ? 'Income' : 'Expenses';
    const total = rows.reduce((a, e) => a + usdOf(e), 0), open = rows.filter(e => !e.settled).reduce((a, e) => a + usdOf(e), 0);
    $('listSum').textContent = (month === 'all' ? 'All time' : monthLabel(month)) + ' · ' + usd(total) + (open ? ' · ' + usd(open) + ' ' + OPEN[kind].toLowerCase() : '');
    renderRecurring(kind);

    const body = $('rows'); body.innerHTML = '';
    if (!rows.length) body.innerHTML = '<tr><td colspan="7" class="empty">' + (kind === 'income' ? 'No income logged for this period. Your hours and team profit are counted on their own tabs.' : 'No expenses logged for this period.') + '</td></tr>';
    rows.forEach(e => {
      const src = e.src || e;
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="c-what"><span class="what"></span><span class="sub-line party"></span></td>' +
        '<td class="c-date muted"></td>' +
        '<td class="c-cat muted"></td>' +
        '<td class="c-hrs num muted"></td>' +
        '<td class="c-amt num r ' + (kind === 'income' ? 'in' : 'out') + '"></td>' +
        '<td class="c-status"><button class="status"><i></i><span></span></button></td>' +
        '<td class="c-act"><div class="acts"><button class="icon-btn edit" aria-label="Edit">' + PEN + '</button><button class="icon-btn del" aria-label="Delete">' + TRASH + '</button></div></td>';
      tr.querySelector('.what').textContent = e.title;
      const sub = [e.party, e.note, partNote(e)].filter(Boolean).join(' · ');
      tr.querySelector('.party').textContent = sub;
      if (e.recurring) { const r = document.createElement('span'); r.className = 'rep'; r.textContent = (sub ? ' · ' : '') + 'Monthly'; tr.querySelector('.party').appendChild(r); }
      tr.querySelector('.c-date').textContent = fmtDate(e.date);
      tr.querySelector('.c-cat').textContent = e.category;
      tr.querySelector('.c-hrs').textContent = detailText(e);
      tr.querySelector('.c-amt').textContent = money(e);
      const st = tr.querySelector('.status');
      st.classList.add(e.settled ? 'done' : 'open');
      st.querySelector('span').textContent = e.settled ? DONE[kind] : OPEN[kind];
      st.title = e.settled && e.settledAt ? DONE[kind] + ' ' + new Date(e.settledAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'Click to mark as ' + DONE[kind].toLowerCase();
      st.addEventListener('click', async () => {
        const settled = !src.settled, patch = { settled, settled_at: settled ? new Date().toISOString() : null };
        const { error } = await db.from('cash_entries').update(patch).eq('id', src.id);
        if (error) return showNotice("Couldn't save that change. Try again.");
        clearNotice(); src.settled = settled; src.settledAt = patch.settled_at; render();
      });
      tr.querySelector('.edit').addEventListener('click', () => openForm(src.kind, src));
      tr.querySelector('.del').addEventListener('click', () => remove(src));
      body.appendChild(tr);
    });
  }

  // The same monthly item: same payer/payee and category ("October salary" and "September salary" from Acme match)
  const seriesKey = e => e.party ? 'p:' + key(e.party) + '|' + key(e.category) : 't:' + key(e.title);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const retitle = (title, m) => title.replace(new RegExp('\\b(' + MONTHS.join('|') + ')\\b', 'i'), MONTHS[Number(m.slice(5, 7)) - 1]);
  let missingRecurring = [];
  function renderRecurring(kind){
    missingRecurring = [];
    if (month !== 'all' && month <= thisMonth()) {
      const here = new Set(entries.filter(e => e.kind === kind && e.date.slice(0, 7) === month).map(seriesKey));
      const latest = new Map();
      entries.filter(e => e.kind === kind && e.recurring && e.date.slice(0, 7) < month)
        .sort((a, b) => a.date < b.date ? -1 : 1)
        .forEach(e => latest.set(seriesKey(e), e));
      missingRecurring = [...latest.entries()].filter(([k]) => !here.has(k)).map(([, e]) => e);
    }
    const box = $('recurBox');
    box.hidden = !missingRecurring.length;
    if (missingRecurring.length) {
      $('recurText').textContent = plural(missingRecurring.length, 'monthly ' + (kind === 'income' ? 'income' : 'expense')) + ' not logged for ' + monthLabel(month) + ' yet: ' +
        missingRecurring.map(e => retitle(e.title, month) + ' (' + inCur(e.amount, e.currency) + ')').join(', ') + '.';
    }
  }
  $('recurAdd').addEventListener('click', async () => {
    if (!missingRecurring.length) return;
    const [y, mo] = month.split('-').map(Number), last = new Date(y, mo, 0).getDate();
    const rows = missingRecurring.map(e => ({
      kind: e.kind, entry_date: month + '-' + String(Math.min(Number(e.date.slice(8, 10)), last)).padStart(2, '0'),
      title: retitle(e.title, month), party: e.party || null, category: e.category, hours: e.hours, rate: e.rate, amount: e.amount,
      currency: e.currency, fx_rate: e.currency === 'EGP' ? (fx.rate || e.fxRate) : null,
      // Subscriptions usually charge on their own; income still needs to arrive
      settled: e.kind === 'expense', settled_at: e.kind === 'expense' ? new Date().toISOString() : null,
      recurring: true, note: e.note || null
    }));
    $('recurAdd').setAttribute('aria-busy', 'true');
    const { data, error } = await db.from('cash_entries').insert(rows).select();
    $('recurAdd').removeAttribute('aria-busy');
    if (error) return showNotice("Couldn't add those. Try again.");
    clearNotice();
    entries.push(...(Array.isArray(data) ? data : [data]).map(toEntry));
    render(); toast('Added ' + plural(rows.length, 'monthly item') + ' to ' + monthLabel(month), false);
  });

  // ---------- add / edit income or expense ----------
  function fillSuggestions(){
    const parties = new Map(), cats = new Map();
    entries.forEach(e => {
      if (e.party && e.kind === fKind) parties.set(key(e.party), e.party);
      if (e.kind === fKind) cats.set(key(e.category), e.category);
    });
    CATS[fKind].forEach(c => { if (!cats.has(key(c))) cats.set(key(c), c); });
    const fill = (el, vals) => { el.innerHTML = ''; vals.forEach(v => { const o = document.createElement('option'); o.value = v; el.appendChild(o); }); };
    fill($('partyList'), [...parties.values()].sort());
    fill($('catList'), [...cats.values()]);
  }
  function setKind(k){
    fKind = k;
    document.querySelectorAll('#fKind button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    $('fMode').hidden = k === 'expense';
    if (k === 'expense') setMode('fixed');
    $('fPartyLabel').textContent = k === 'income' ? 'From (who paid you)' : 'Paid to';
    $('fTitle').placeholder = k === 'income' ? 'October salary' : 'Claude Max';
    $('fParty').placeholder = k === 'income' ? 'Company or client' : 'Anthropic';
    $('fCat').placeholder = k === 'income' ? 'Salary' : 'Subscriptions';
    $('fSettledLabel').textContent = k === 'income' ? 'Already received' : 'Already paid';
    fillSuggestions();
  }
  function setMode(m){
    fMode = m;
    document.querySelectorAll('#fMode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    document.querySelectorAll('.hourly').forEach(el => el.hidden = m !== 'hourly');
    document.querySelectorAll('.project').forEach(el => el.hidden = m !== 'project');
    $('fAmount').readOnly = m === 'hourly';
    $('fDateLabel').textContent = m === 'project' ? 'Counts on (month it goes in)' : 'Date';
    $('fSpreadWrap').hidden = m !== 'project';
    $('fCat').placeholder = m === 'project' ? 'Project' : fKind === 'income' ? 'Salary' : 'Subscriptions';
    if (m === 'project') syncProjectDate();
    if (m === 'hourly') calcAmount();
    showFx();
  }
  // ---- currency ----
  // A fixed rate Amr sets: 52 EGP = $1 (change EGP_PER_USD here and in app/app.js)
  const EGP_PER_USD = 52;
  const fx = { rate:EGP_PER_USD };
  async function loadFx(){
    window.cashFx = fx;
    paintEgp();
    document.dispatchEvent(new Event('fx-ready'));
  }
  function showFx(){
    const isEgp = $('fCur').value === 'EGP';
    $('fxWrap').hidden = !isEgp;
    $('fRateLabel').textContent = 'Rate ' + (isEgp ? 'EGP' : '$') + '/h';
    if (isEgp && !$('fFx').value && fx.rate) $('fFx').value = fx.rate;
    const a = parseFloat($('fAmount').value), r = parseFloat($('fFx').value);
    $('fFxHint').textContent = isEgp ? (!isNaN(a) && r > 0 ? '≈ ' + usd(a / r) : 'At ' + fx.rate + ' EGP per $1') : '';
  }
  $('fCur').addEventListener('change', showFx);
  ['fFx','fAmount','fHours','fRate'].forEach(id => $(id).addEventListener('input', showFx));
  // The project counts on its end date unless you pick another date (like the day you got paid)
  let dateTouched = false;
  function syncProjectDate(){ if (fMode === 'project' && !dateTouched && $('fTo').value) $('fDate').value = $('fTo').value; }
  $('fDate').addEventListener('input', () => { dateTouched = true; });
  $('fTo').addEventListener('change', syncProjectDate);
  $('fFrom').addEventListener('change', () => { if (!$('fTo').value || $('fTo').value < $('fFrom').value) { $('fTo').value = $('fFrom').value; syncProjectDate(); } });
  function calcAmount(){
    const h = parseFloat($('fHours').value), r = parseFloat($('fRate').value);
    $('fAmount').value = !isNaN(h) && !isNaN(r) ? cents(h * r).toFixed(2) : '';
  }
  $('fKind').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setKind(b.dataset.k);
    if (!editing) $('fSettled').checked = b.dataset.k === 'expense';
  });
  $('fMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
  ['fHours','fRate'].forEach(id => $(id).addEventListener('input', calcAmount));
  ['fTitle','fParty','fDate','fCat','fHours','fRate','fAmount','fFrom','fTo'].forEach(id => $(id).addEventListener('input', () => $('addErr').textContent = ''));

  function defaultDate(){ return month === 'all' || month === thisMonth() ? iso(new Date()) : month + '-01'; }
  function openForm(kind, e){
    editing = e || null;
    setKind(kind);
    $('formTitle').textContent = e ? 'Edit ' + (kind === 'income' ? 'income' : 'expense') : 'Add an entry';
    $('formHint').textContent = e ? '' : 'For money outside your tracked hours. Income adds to your profit, expenses take away from it';
    $('fTitle').value = e ? e.title : '';
    $('fParty').value = e ? e.party : '';
    $('fDate').value = e ? e.date : defaultDate();
    $('fCat').value = e ? e.category : '';
    $('fHours').value = e && e.hours != null ? e.hours : '';
    $('fRate').value = e && e.rate != null ? e.rate : '';
    $('fFrom').value = e && e.periodStart ? e.periodStart : '';
    $('fTo').value = e && e.periodEnd ? e.periodEnd : '';
    dateTouched = !!e;
    $('fAmount').value = e ? e.amount.toFixed(2) : '';
    $('fCur').value = e ? e.currency : 'USD';
    $('fFx').value = e && e.fxRate ? e.fxRate : (fx.rate || '');
    $('fNote').value = e ? e.note : '';
    $('fSettled').checked = e ? e.settled : kind === 'expense';
    $('fRecurring').checked = e ? e.recurring : false;
    $('fSpread').checked = e ? !!e.spread : false;
    setMode(e && e.periodStart ? 'project' : e && e.hours != null && e.rate != null ? 'hourly' : 'fixed');
    $('addErr').textContent = '';
    $('addSave').textContent = e ? 'Save changes' : 'Save';
    $('addBox').hidden = false;
    $('addBox').scrollIntoView({ behavior:'smooth', block:'nearest' });
    $('fTitle').focus({ preventScroll:true });
  }
  function closeForm(){ $('addBox').hidden = true; editing = null; $('addErr').textContent = ''; }
  $('addToggle').addEventListener('click', () => {
    if (!$('addBox').hidden && !editing) { closeForm(); return; }
    openForm(view === 'expense' ? 'expense' : 'income');
  });
  $('addCancel').addEventListener('click', closeForm);

  $('addForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = m => { $('addErr').textContent = m; };
    const title = $('fTitle').value.trim().replace(/\s+/g, ' ');
    const party = $('fParty').value.trim().replace(/\s+/g, ' ');
    const category = $('fCat').value.trim().replace(/\s+/g, ' ') || (fMode === 'project' ? 'Project' : 'Other');
    const date = $('fDate').value;
    if (!title) return err(fKind === 'income' ? 'Say what the money was for, like "October salary".' : 'Say what you paid for, like "Claude Max".');
    if (!date) return err('Pick the date.');
    let hours = null, rate = null, amount, from = null, to = null;
    if (fMode === 'project') {
      from = $('fFrom').value; to = $('fTo').value;
      if (!from || !to) return err('Pick when the project started and ended.');
      if (to < from) return err('The project ends before it starts. Check the dates.');
    }
    const currency = $('fCur').value, fxRate = currency === 'EGP' ? parseFloat($('fFx').value) : null;
    if (currency === 'EGP' && !(fxRate > 0)) return err('Enter how many pounds one dollar is, like 48.5.');
    if (fMode === 'hourly') {
      hours = parseFloat($('fHours').value); rate = parseFloat($('fRate').value);
      if (isNaN(hours) || hours <= 0) return err('Enter how many hours you worked.');
      if (isNaN(rate) || rate < 0) return err('Enter your hourly rate.');
      amount = cents(hours * rate);
    } else {
      amount = parseFloat($('fAmount').value);
      if (isNaN(amount) || amount <= 0) return err('Enter the amount, like 20.');
    }
    // Keep one spelling per person or company
    const match = entries.find(e => e.party && key(e.party) === key(party));
    const settled = $('fSettled').checked;
    const row = {
      kind: fKind, entry_date: date, title, party: party ? (match ? match.party : party) : null, category,
      hours, rate, amount: cents(amount), currency, fx_rate: fxRate, settled, recurring: $('fRecurring').checked, note: $('fNote').value.trim() || null
    };
    if (!editing || settled !== editing.settled) row.settled_at = settled ? new Date().toISOString() : null;
    if (from || (editing && editing.periodStart)) { row.period_start = from; row.period_end = to; }
    if (fMode === 'project' || (editing && editing.spread)) row.spread = fMode === 'project' && $('fSpread').checked;
    $('addSave').setAttribute('aria-busy', 'true');
    const q = editing ? db.from('cash_entries').update(row).eq('id', editing.id).select().single() : db.from('cash_entries').insert(row).select().single();
    const { data, error } = await q;
    $('addSave').removeAttribute('aria-busy');
    if (error) return err("Couldn't save that. Try again.");
    const saved = toEntry(data);
    if (editing) entries[entries.indexOf(editing)] = saved; else entries.push(saved);
    const wasEdit = !!editing;
    if (wasEdit) closeForm();
    else { $('fTitle').value = ''; $('fHours').value = ''; $('fAmount').value = ''; $('fNote').value = ''; $('fRecurring').checked = false; }
    if (month !== 'all' && saved.date.slice(0, 7) !== month) month = saved.date.slice(0, 7);
    render();
    toast((wasEdit ? 'Updated ' : 'Added ') + saved.title + ' · ' + money(saved), false);
  });

  // ---------- delete with undo ----------
  function toast(msg, withUndo){
    $('toastMsg').textContent = msg;
    $('undo').hidden = !withUndo;
    $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').classList.remove('show'); lastDeleted = null; }, 5000);
  }
  async function remove(e){
    const i = entries.indexOf(e); if (i < 0) return;
    const { error } = await db.from('cash_entries').delete().eq('id', e.id);
    if (error) return showNotice("Couldn't delete that. Try again.");
    entries.splice(i, 1);
    if (editing === e) closeForm();
    lastDeleted = { entry: e };
    toast('Deleted ' + e.title, true);
    render();
  }
  async function removeShift(s){
    const i = shifts.indexOf(s); if (i < 0) return;
    const { error } = await db.from('shifts').delete().eq('id', s.id);
    if (error) return showNotice("Couldn't delete that shift. Try again.");
    shifts.splice(i, 1);
    lastDeleted = { shift: s };
    toast('Deleted ' + hm(s.work) + ' on ' + dayDate(s.date), true);
    render();
  }
  $('undo').addEventListener('click', async () => {
    const d = lastDeleted; if (!d) return;
    lastDeleted = null; $('toast').classList.remove('show');
    if (d.entry) {
      const e = d.entry;
      const { data, error } = await db.from('cash_entries').insert({
        kind: e.kind, entry_date: e.date, title: e.title, party: e.party || null, category: e.category, hours: e.hours, rate: e.rate,
        amount: e.amount, currency: e.currency, fx_rate: e.fxRate, settled: e.settled, settled_at: e.settledAt, recurring: e.recurring, note: e.note || null, created_at: e.createdAt,
        ...(e.periodStart ? { period_start: e.periodStart, period_end: e.periodEnd } : {})
      }).select().single();
      if (error) return showNotice("Couldn't restore that entry.");
      entries.push(toEntry(data));
    } else {
      const s = d.shift;
      const { data, error } = await db.from('shifts').insert({
        name: s.name, shift_date: s.date, work_seconds: s.work, break_seconds: s.brk, started_at: s.startedAt, ended_at: s.endedAt,
        company_id: s.companyId, paid: s.paid, paid_at: s.paidAt, paid_fx: s.paidFx, source: s.source, created_at: s.createdAt,
        owner: true, pay_rate: 0, bill_rate: s.billRate
      }).select().single();
      if (error) return showNotice("Couldn't restore that shift.");
      shifts.push(toShift(data));
    }
    render();
  });

  // ---------- two-step sign-in: your apps ----------
  // A second app (say a laptop password manager) means losing your phone doesn't lock you out.
  const factorName = f => /^Cash \d+$/.test(f.friendly_name || '') || !f.friendly_name ? 'Authenticator app' : f.friendly_name;
  let addingFactor = null;
  async function renderFactors(){
    const { data, error } = await db.auth.mfa.listFactors();
    if (error) return;
    const list = ((data && data.totp) || []).filter(f => f.status === 'verified');
    const box = $('mfaList'); box.innerHTML = '';
    list.forEach(f => {
      const row = document.createElement('div'); row.className = 'fac';
      row.innerHTML = '<span class="fac-n"><b></b><small></small></span><button type="button" class="btn btn-ghost btn-sm">Remove</button>';
      row.querySelector('b').textContent = factorName(f);
      row.querySelector('small').textContent = 'Added ' + new Date(f.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
      const rm = row.querySelector('button');
      rm.disabled = list.length < 2;
      rm.title = list.length < 2 ? 'Add another app first, or you’d have no way to sign in' : '';
      rm.addEventListener('click', async () => {
        if (!confirm('Remove “' + factorName(f) + '”? Its codes will stop working for Cash.')) return;
        const { error } = await db.auth.mfa.unenroll({ factorId: f.id });
        if (error) { toast("Couldn't remove it. Try again.", false); return; }
        renderFactors(); toast('Removed ' + factorName(f), false);
      });
      box.appendChild(row);
    });
    $('mfaCount').textContent = list.length < 2 ? 'Only one app can sign you in. Add a backup so losing your phone doesn’t lock you out.' : plural(list.length, 'app') + ' can sign you in';
    $('mfaCount').classList.toggle('warn', list.length < 2);
  }
  function resetAdd(){
    addingFactor = null;
    $('mfaAddForm').hidden = true; $('mfaAddBtn').hidden = false;
    $('mfaAddStep1').hidden = false; $('mfaAddStep2').hidden = true;
    $('mfaName').value = ''; $('mfaAddCode').value = ''; $('mfaAddErr').textContent = '';
    $('mfaAddGo').textContent = 'Continue';
  }
  $('mfaAddBtn').addEventListener('click', () => { $('mfaAddForm').hidden = false; $('mfaAddBtn').hidden = true; $('mfaName').focus(); });
  $('mfaAddCancel').addEventListener('click', async () => {
    if (addingFactor) await db.auth.mfa.unenroll({ factorId: addingFactor }); // drop the half-made one
    resetAdd();
  });
  ['mfaName', 'mfaAddCode'].forEach(id => $(id).addEventListener('input', () => $('mfaAddErr').textContent = ''));
  $('mfaAddForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = m => { $('mfaAddErr').textContent = m; };
    $('mfaAddGo').setAttribute('aria-busy', 'true');
    try {
      if (!addingFactor) {
        const name = $('mfaName').value.trim().replace(/\s+/g, ' ');
        if (name.length < 2) return err('Give it a name you’ll recognise, like “Laptop password manager”.');
        const { data: f } = await db.auth.mfa.listFactors();
        if (((f && f.all) || []).some(x => (x.friendly_name || '').toLowerCase() === name.toLowerCase())) return err('You already have one called that. Pick another name.');
        const { data, error } = await db.auth.mfa.enroll({ factorType:'totp', friendlyName:name });
        if (error) return err("Couldn't start the setup. Refresh the page and try again.");
        addingFactor = data.id;
        $('mfaAddQr').innerHTML = '';
        const img = document.createElement('img'); img.src = data.totp.qr_code; img.alt = 'QR code for your backup authenticator';
        $('mfaAddQr').appendChild(img);
        $('mfaAddSecret').textContent = data.totp.secret;
        $('mfaAddStep1').hidden = true; $('mfaAddStep2').hidden = false;
        $('mfaAddGo').textContent = 'Verify';
        $('mfaAddCode').focus();
      } else {
        const code = $('mfaAddCode').value.replace(/\D/g, '');
        if (code.length !== 6) return err('Enter the 6-digit code the new app shows.');
        const { error } = await db.auth.mfa.challengeAndVerify({ factorId: addingFactor, code });
        if (error) return err("That code didn't work. Codes change every 30 seconds, so try the one showing now.");
        resetAdd(); renderFactors(); toast('Backup authenticator added', false);
      }
    } finally { $('mfaAddGo').removeAttribute('aria-busy'); }
  });

  // ---------- backup ----------
  // One JSON file with every table this page uses. Company codes stay out: they're stored scrambled and can't be read.
  async function checkBackup(){
    const { data } = await db.from('tracker_settings').select('*').eq('key', 'last_backup');
    showBackupAge(((data || [])[0] || {}).value || null);
  }
  function showBackupAge(last){
    const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
    $('backupAge').textContent = last ? (days === 0 ? 'Last backup: today' : 'Last backup: ' + plural(days, 'day') + ' ago') : 'No backup yet';
    $('backupNudge').hidden = !(days == null || days >= 30);
  }
  document.querySelectorAll('[data-backup]').forEach(btn => btn.addEventListener('click', async () => {
    btn.setAttribute('aria-busy', 'true');
    const out = { from:'amrabdelgawad.site/cash', made_at:new Date().toISOString(), tables:{} };
    const parts = [['cash_entries', () => fetchAll('cash_entries', '*', 'entry_date')], ['shifts', () => fetchAll('shifts', '*', 'shift_date')],
      ['companies', () => db.from('companies').select('*')], ['tracker_settings', () => db.from('tracker_settings').select('*')]];
    for (const [name, get] of parts) {
      const r = await get();
      if (r.error) { btn.removeAttribute('aria-busy'); toast("Couldn't make the backup. Try again.", false); return; }
      out.tables[name] = r.data;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type:'application/json' }));
    a.download = 'cash-backup-' + iso(new Date()) + '.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    const now = new Date().toISOString();
    await db.from('tracker_settings').upsert({ key:'last_backup', value:now });
    showBackupAge(now);
    btn.removeAttribute('aria-busy');
    toast('Backup downloaded', false);
  }));

  // ---------- monthly statement ----------
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][n % 10] || 'th');
  const longDate = d => ordinal(d.getDate()) + ' of ' + d.toLocaleDateString('en-US', { month:'long' }) + ', ' + d.getFullYear();
  const shortDay = d => new Date(d+'T00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
  const listJoin = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

  let stMonth = null;
  function openStatement(){
    if (month === 'all') return;
    stMonth = month;
    $('slipNote').value = '';
    drawStatement();
    $('slipOverlay').hidden = false; document.body.style.overflow = 'hidden';
    fitStatement();
  }
  function drawStatement(){
    const m = stMonth, label = monthLabel(m);
    const t = totals(d => d.slice(0, 7) === m);
    const mine = byCompany(t.own), crew = byPerson(t.crew);
    const inc = [...t.inc].sort((a, b) => a.date < b.date ? -1 : 1), exp = [...t.exp].sort((a, b) => a.date < b.date ? -1 : 1);

    // "This month you made $X for your work at ..., $Y from Youssef, ... so your total profit is ..."
    const bits = mine.map(g => '<b>' + usd(g.amt) + '</b> for your work at ' + escHtml(g.name));
    crew.forEach(g => bits.push('<b>' + usd(g.profit) + '</b> from ' + escHtml(g.name)));
    const src = new Map();
    inc.forEach(e => { const k = key(e.party || e.title); if (!src.has(k)) src.set(k, { e, amt:0 }); src.get(k).amt += usdOf(e); });
    [...src.values()].sort((a, b) => b.amt - a.amt).forEach(({ e, amt }) => bits.push('<b>' + usd(amt) + '</b> ' + (e.party ? 'from ' + escHtml(e.party) : 'for ' + escHtml(e.title))));
    let summary = bits.length ? 'This month you made ' + listJoin(bits) + '. ' : 'Nothing came in this month. ';
    summary += exp.length ? 'Your expenses were <b>' + usd(t.expense) + '</b>, so your total profit for ' + label + ' is <b>' + usd(t.net) + '</b>.'
      : 'You had no expenses, so your total profit for ' + label + ' is <b>' + usd(t.net) + '</b>.';
    if (t.toReceive > 0) summary += ' <b>' + usd(t.toReceive) + '</b> of this hasn’t reached you yet.';

    const section = (title, total, head, rows, empty) =>
      '<h3>' + title + '<span>' + total + '</span></h3>' +
      '<table><thead><tr>' + head + '</tr></thead><tbody>' + (rows || '<tr><td class="none" colspan="5">' + empty + '</td></tr>') + '</tbody></table>';
    const status = (done, yes, no) => done ? '<span class="ok">' + yes + '</span>' : '<span class="due">' + no + '</span>';

    const mineRows = mine.map(g => {
      const rates = [...g.rates];
      return '<tr><td><b>' + escHtml(g.name) + '</b></td><td class="r mono">' + hm(g.secs) + '</td><td class="r mono">' + (rates.length === 1 ? usd(rates[0]) : usd(Math.min(...rates)) + '–' + usd(Math.max(...rates))) + '</td>' +
        '<td>' + (g.due <= 0 ? '<span class="ok">Paid</span>' : g.due < g.amt ? '<span class="due">' + usd(g.due) + ' not paid</span>' : '<span class="due">Not paid</span>') + '</td><td class="r mono">' + usd(g.amt) + '</td></tr>';
    }).join('');
    const crewRows = crew.map(g => '<tr><td><b>' + escHtml(g.name) + '</b></td><td>' + escHtml([...g.cos].filter(Boolean).join(', ')) + '</td><td class="r mono">' + hm(g.secs) + '</td><td class="r mono">' + usd(g.profit) + '</td></tr>').join('');
    const incRows = inc.map(e => '<tr><td>' + shortDay(e.date) + '</td><td><b>' + escHtml(e.title) + '</b>' + (e.party || e.part ? '<small>' + escHtml([e.party, partNote(e)].filter(Boolean).join(' · ')) + '</small>' : '') + '</td>' +
      '<td class="r mono">' + detailText(e) + '</td>' +
      '<td>' + status(e.settled, 'Received', 'Not received') + '</td><td class="r mono">' + money(e) + '</td></tr>').join('');
    const expRows = exp.map(e => '<tr><td>' + shortDay(e.date) + '</td><td><b>' + escHtml(e.title) + '</b>' + (e.party ? '<small>' + escHtml(e.party) + '</small>' : '') + '</td>' +
      '<td>' + escHtml(e.category) + '</td><td>' + status(e.settled, 'Paid', 'Unpaid') + '</td><td class="r mono neg-amt">−' + money(e) + '</td></tr>').join('');

    const note = $('slipNote').value.trim();
    const number = 'ST-' + m;
    $('slip').innerHTML =
      '<div class="band"></div>' +
      '<div class="top"><div class="brand">Amr Abdelgawad<em>Talents</em><small>amrabdelgawad.site</small></div>' +
      '<div class="doc"><h1>Monthly statement</h1><p>No. <b>' + number + '</b></p><p>Issued <b>' + longDate(new Date()) + '</b></p></div></div>' +
      '<div class="meta">' +
        '<div class="box"><p>Period</p><strong>' + label + '</strong><span>' + hm(t.ownSecs) + ' yours · ' + hm(t.teamSecs) + ' team</span></div>' +
        '<div class="box"><p>Came in</p><strong>' + usd(t.ownAmt + t.team + t.income) + '</strong><span>Own ' + usd(t.ownAmt) + ' · Team ' + usd(t.team) + ' · Other ' + usd(t.income) + '</span></div>' +
        '<div class="box hi' + (t.net < 0 ? ' neg' : '') + '"><p>Total profit</p><strong>' + usd(t.net) + '</strong><span>after ' + usd(t.expense) + ' in expenses</span></div>' +
      '</div>' +
      '<p class="summary">' + summary + '</p>' +
      section('Your own work', usd(t.ownAmt), '<th>Company</th><th class="r">Hours</th><th class="r">Rate</th><th>Status</th><th class="r">Amount</th>', mineRows, 'You didn’t log any hours this month.') +
      section('Profit from your team', usd(t.team), '<th>Team member</th><th>Worked for</th><th class="r">Hours</th><th class="r">Your profit</th>', crewRows, 'No team hours this month.') +
      section('Other income', usd(t.income), '<th>Date</th><th>Description</th><th class="r">Hours or period</th><th>Status</th><th class="r">Amount</th>', incRows, 'No other income this month.') +
      section('Expenses', '−' + usd(t.expense), '<th>Date</th><th>Description</th><th>Category</th><th>Status</th><th class="r">Amount</th>', expRows, 'No expenses this month.') +
      '<div class="bottom"><div class="note"><b>How this is worked out.</b> Your own work is your hours × each company’s rate, with nothing taken out. Team profit is what each company pays per hour minus what the team is paid, at the rates locked onto each shift. Other income and expenses are what you logged for ' + label + '.' +
        (note ? '<span class="custom"><b>Note:</b> ' + escHtml(note) + '</span>' : '') + '</div>' +
        '<div class="totals"><div><span>Your own work</span><span class="mono">' + usd(t.ownAmt) + '</span></div>' +
        '<div><span>From your team</span><span class="mono">' + usd(t.team) + '</span></div>' +
        '<div><span>Other income</span><span class="mono">' + usd(t.income) + '</span></div>' +
        '<div><span>Expenses</span><span class="mono">−' + usd(t.expense) + '</span></div>' +
        (t.toReceive > 0 ? '<div><span>Not received yet</span><span class="mono">' + usd(t.toReceive) + '</span></div>' : '') +
        '<div class="grand"><span>Total profit</span><span class="mono">' + usd(t.net) + '</span></div>' +
        (fx.rate ? '<div class="in-egp"><span>' + usd(t.net) + ' = ' + egp(t.net * fx.rate) + '</span><span>at ' + fx.rate.toFixed(2) + ' per $1, ' + longDate(new Date()) + '</span></div>' : '') +
        '</div></div>' +
      '<div class="foot"><div><span>Amr Abdelgawad Talents · amrabdelgawad.site</span><span>' + number + '</span></div></div>';
  }
  function fitStatement(){
    if ($('slipOverlay').hidden) return;
    const el = $('slip'), fit = $('slipFit');
    el.style.transform = 'none';
    const w = el.offsetWidth, h = el.offsetHeight, avail = $('slipStage').clientWidth - 32;
    const s = Math.min(1, avail / w);
    el.style.transform = 'scale(' + s + ')'; el.style.transformOrigin = 'top left';
    fit.style.width = (w * s) + 'px'; fit.style.height = (h * s) + 'px';
  }
  $('statementBtn').addEventListener('click', openStatement);
  window.addEventListener('resize', fitStatement);
  $('slipNote').addEventListener('input', () => { drawStatement(); fitStatement(); });
  function closeStatement(){ $('slipOverlay').hidden = true; document.body.style.overflow = ''; stMonth = null; }
  $('slipClose').addEventListener('click', closeStatement);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('slipOverlay').hidden) closeStatement(); });

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
    if (!stMonth) return;
    const btn = $('slipDownload'); btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Preparing…';
    try {
      const html2pdf = await loadPdfLib();
      await document.fonts.ready;
      const clone = $('slip').cloneNode(true);
      clone.style.transform = 'none'; clone.style.boxShadow = 'none';
      await html2pdf().set({
        margin: [10, 0, 10, 0], filename: 'Statement-' + stMonth + '.pdf',
        image: { type:'jpeg', quality:0.96 },
        html2canvas: { scale:2, useCORS:true, backgroundColor:'#ffffff', scrollX:0, scrollY:0 }, // capture from the top, or a scrolled page gives a blank PDF
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' },
        pagebreak: { mode:['css', 'legacy'], avoid:['tr', '.bottom', '.summary'] }
      }).from(clone).save();
      toast('Statement downloaded', false);
    } catch (e) {
      toast("Couldn't make the PDF. Check your connection and try again.", false);
    }
    btn.removeAttribute('aria-busy'); btn.textContent = 'Download PDF';
  });

  // stay signed in on this device until you sign out
  db.auth.getSession().then(({ data }) => { if (data.session) showDash(data.session.user.email); });
  db.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') showLogin(); });
})();
