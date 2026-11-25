// Client portal (plan Round 36, O5). A client signs in at /app with the login Amr made for them and lands here.
// They see only their own account: hours and numbers of the reps Amr picked, calls he shared, and invoices he sent.
// Every read goes through a database function that checks client_company() (talents-database migration
// round36_client_portal), so this page can't show another client's data or any pay, rate, note or score.
// Arabic: the /app dictionary (app/i18n.js + app/ar-more.js), same "appLang" switch per device.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.TRACKER_CONFIG || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const num = n => (Number(n) || 0).toLocaleString('en-US');
  const hrs = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits:1, maximumFractionDigits:1 });
  const usd = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const fday = (d, o) => new Date(String(d).length === 10 ? d + 'T12:00' : d).toLocaleDateString('en-US', o || { weekday:'short', month:'short', day:'numeric' });
  const clock = at => at ? new Date(at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }) : '';
  const lang = (window.AppLang && window.AppLang.lang) || 'en';
  if (!window.supabase || !cfg.supabaseUrl) { $('cLoad').textContent = 'This page couldn’t load. Please refresh.'; return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  // language switch (same key as /app)
  $('cLang').textContent = lang === 'ar' ? 'English' : 'عربي';
  $('cLang').addEventListener('click', () => { try { localStorage.setItem('appLang', lang === 'ar' ? 'en' : 'ar'); } catch(e) {} location.reload(); });
  $('cOut').addEventListener('click', async () => { await db.auth.signOut(); location.replace('/app/'); });

  const table = (heads, rows) => '<div class="tw"><table><thead><tr>' + heads.map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  const L = t => (lang === 'ar' && window.AppLang.AR[t]) || t;   // column names shown on phones (data-l isn't walked by i18n.js)
  const tr = (cells, label) => '<tr>' + cells.map((c, i) => '<td data-l="' + esc(L(label[i])) + '">' + c + '</td>').join('') + '</tr>';
  const empty = t => '<p class="empty">' + esc(t) + '</p>';
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
  const loaded = {};
  function show(tab){
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    document.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== tab);
    try { history.replaceState(null, '', '#' + tab); } catch(e) {}
    if (tab === 'calls' && !loaded.calls) loadCalls();
    if (tab === 'invoices' && !loaded.inv) loadInvoices();
  }

  // ---------- hours and numbers ----------
  function range(){
    const v = $('cRange').value, now = new Date(), d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monday = x => { const y = new Date(x); y.setDate(y.getDate() - ((y.getDay() + 6) % 7)); return y; };
    if (v === 'week') return [monday(d), d];
    if (v === 'last') { const m = monday(d); m.setDate(m.getDate() - 7); const e = new Date(m); e.setDate(e.getDate() + 6); return [m, e]; }
    if (v === 'month') return [new Date(d.getFullYear(), d.getMonth(), 1), d];
    if (v === 'lastmonth') return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)];
    if (v === '90') { const s = new Date(d); s.setDate(s.getDate() - 89); return [s, d]; }
    const a = $('cFrom').value, b = $('cTo').value;
    return a && b ? [new Date(a + 'T12:00'), new Date(b + 'T12:00')] : [new Date(d.getFullYear(), d.getMonth(), 1), d];
  }
  $('cRange').addEventListener('change', () => { $('cCustom').hidden = $('cRange').value !== 'custom'; if ($('cRange').value === 'custom' && !$('cFrom').value) { const [a, b] = range(); $('cFrom').value = iso(a); $('cTo').value = iso(b); } loadNumbers(); });
  ['cFrom', 'cTo'].forEach(id => $(id).addEventListener('change', loadNumbers));
  const tile = (v, k) => '<div class="tile"><b>' + esc(v) + '</b><span>' + esc(k) + '</span></div>';
  async function loadNumbers(){
    const [a, b] = range(); const from = iso(a), to = iso(b);
    $('cRangeTxt').textContent = fday(from, { month:'short', day:'numeric', year:'numeric' }) + ' to ' + fday(to, { month:'short', day:'numeric', year:'numeric' });
    $('cTiles').innerHTML = ''; $('cReps').innerHTML = $('cDays').innerHTML = $('cShifts').innerHTML = '<p class="muted">Loading…</p>';
    const { data, error } = await db.rpc('client_numbers', { p_from:from, p_to:to });
    if (error) { const m = /400 days/.test(error.message) ? 'Pick a range up to 400 days.' : 'Couldn’t load your numbers. Please refresh.'; $('cReps').innerHTML = empty(m); $('cDays').innerHTML = $('cShifts').innerHTML = ''; return; }
    const t = data.total || {};
    $('cTiles').innerHTML = tile(hrs(t.hours), 'Hours worked') + tile(num(t.dials), 'Dials') + tile(num(t.conversations), 'Conversations') + tile(num(t.appointments), 'Appointments') + tile(num(t.offers), 'Offers') + tile(num(t.shifts), 'Shifts');
    const H = ['Rep', 'Shifts', 'Hours', 'Dials', 'Conversations', 'Appointments', 'Offers'];
    $('cReps').innerHTML = data.reps.length ? table(H, data.reps.map(r => tr([esc(r.name), num(r.shifts), hrs(r.hours), num(r.dials), num(r.conversations), num(r.appointments), num(r.offers)], H))) : empty('No shifts in these dates.');
    const D = ['Day', 'Hours', 'Dials', 'Conversations', 'Appointments', 'Offers'];
    $('cDays').innerHTML = data.days.length ? table(D, data.days.map(r => tr([esc(fday(r.day)), hrs(r.hours), num(r.dials), num(r.conversations), num(r.appointments), num(r.offers)], D))) : empty('No shifts in these dates.');
    const S = ['Day', 'Rep', 'Time', 'Hours', 'Dials', 'Conversations', 'Appointments', 'Offers'];
    $('cShifts').innerHTML = data.shifts.length ? table(S, data.shifts.map(r => tr([esc(fday(r.day)), esc(r.rep), esc(r.start ? clock(r.start) + (r.end ? ' to ' + clock(r.end) : '') : '–'), hrs(r.hours), num(r.dials), num(r.conversations), num(r.appointments), num(r.offers)], S))) : empty('No shifts in these dates.');
  }

  // ---------- calls ----------
  async function loadCalls(){
    loaded.calls = true; $('cCalls').innerHTML = '<p class="muted">Loading…</p>';
    const { data, error } = await db.rpc('client_recordings');
    if (error) { loaded.calls = false; $('cCalls').innerHTML = empty('Couldn’t load the calls. Please refresh.'); return; }
    if (!data.length) { $('cCalls').innerHTML = empty('No calls shared with you yet.'); return; }
    $('cCalls').innerHTML = data.map((r, i) => '<article class="call"><div><b>' + esc(r.title) + '</b><span class="muted small">' + esc([r.rep, fday(r.recorded_at, { month:'short', day:'numeric', year:'numeric' }) + ', ' + clock(r.recorded_at), r.duration_s ? Math.max(1, Math.round(r.duration_s / 60)) + ' min' : ''].filter(Boolean).join(' · ')) + '</span></div>' +
      '<button type="button" class="btn ghost" data-play="' + i + '">Play</button><div class="player" id="cPl' + i + '"></div></article>').join('');
    $('cCalls').querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', async () => {
      const r = data[+b.dataset.play]; b.disabled = true; b.textContent = 'Loading…';
      const { data: s, error: e } = await db.storage.from('hub-uploads').createSignedUrl(r.path, 3600);
      b.hidden = true;
      $('cPl' + b.dataset.play).innerHTML = e || !s ? empty('This call couldn’t load. Please try again later.') : '<audio controls preload="metadata" src="' + esc(s.signedUrl) + '"></audio>';
      const au = $('cPl' + b.dataset.play).querySelector('audio'); if (au) au.play().catch(() => {});
    }));
  }

  // ---------- invoices ----------
  const ST = { sent:['Not paid yet', ''], part:['Part paid', ''], paid:['Paid', 'ok'] };
  async function loadInvoices(){
    loaded.inv = true; $('cInv').innerHTML = '<p class="muted">Loading…</p>';
    const { data, error } = await db.rpc('client_invoices');
    if (error) { loaded.inv = false; $('cInv').innerHTML = empty('Couldn’t load your invoices. Please refresh.'); return; }
    if (!data.length) { $('cInv').innerHTML = empty('No invoices yet.'); return; }
    const owed = data.reduce((s, x) => s + Math.max(0, (+x.amount || 0) - (+x.amount_paid || 0)), 0);
    $('cInv').innerHTML = '<div class="tiles">' + tile(usd(owed), 'Still to pay') + tile(num(data.length), data.length === 1 ? 'Invoice' : 'Invoices') + '</div>' +
      data.map((x, i) => { const st = ST[x.status] || ST.sent, left = Math.max(0, (+x.amount || 0) - (+x.amount_paid || 0));
        return '<article class="inv"><div class="inv-head"><b>Invoice #' + esc(x.number) + '</b><span class="pill ' + st[1] + '">' + esc(st[0]) + '</span></div>' +
          '<dl><div><dt>Period</dt><dd>' + esc(fday(x.period_start, { month:'short', day:'numeric' }) + ' to ' + fday(x.period_end, { month:'short', day:'numeric', year:'numeric' })) + '</dd></div>' +
          '<div><dt>Hours</dt><dd>' + hrs(x.hours) + '</dd></div><div><dt>Amount</dt><dd>' + usd(x.amount) + '</dd></div>' +
          (+x.amount_paid ? '<div><dt>Paid</dt><dd>' + usd(x.amount_paid) + '</dd></div>' : '') + (left > 0 ? '<div><dt>Left to pay</dt><dd>' + usd(left) + '</dd></div>' : '') +
          (x.due_on ? '<div><dt>Due</dt><dd>' + esc(fday(x.due_on, { month:'short', day:'numeric', year:'numeric' })) + '</dd></div>' : '') +
          (x.paid_on ? '<div><dt>Paid on</dt><dd>' + esc(fday(x.paid_on, { month:'short', day:'numeric', year:'numeric' })) + '</dd></div>' : '') + '</dl>' +
          (x.pdf_path ? '<button type="button" class="btn ghost" data-pdf="' + i + '">Download PDF</button>' : '<p class="muted small">The PDF for this invoice isn’t ready yet. Ask Amr if you need it now.</p>') + '</article>'; }).join('');
    $('cInv').querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', async () => {
      const x = data[+b.dataset.pdf]; b.disabled = true;
      const { data: s, error: e } = await db.storage.from('files').createSignedUrl(x.pdf_path, 600, { download:'Invoice ' + x.number + '.pdf' });
      b.disabled = false;
      if (e || !s) { b.textContent = 'Couldn’t open it. Try again'; return; }
      location.href = s.signedUrl;
    }));
  }

  // ---------- start ----------
  (async () => {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { location.replace('/app/'); return; }
    $('cOut').hidden = false;
    const { data: me, error } = await db.rpc('client_me');
    $('cLoad').hidden = true;
    if (error || !me || me.off) {
      if (!me && !error) { location.replace('/app/'); return; }   // a team login: the team portal
      $('cOff').hidden = false; return;
    }
    $('cCo').textContent = me.company;
    $('cHello').textContent = 'Welcome, ' + String(me.name).split(' ')[0];
    $('cTitle').textContent = me.company + ': your team’s work';
    document.title = me.company + ' · Client portal';
    $('cApp').hidden = false;
    db.rpc('client_seen').then(() => {}, () => {});
    loadNumbers();
    const h = location.hash.slice(1); show(['numbers', 'calls', 'invoices'].includes(h) ? h : 'numbers');
  })();
  db.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.replace('/app/'); });
})();
