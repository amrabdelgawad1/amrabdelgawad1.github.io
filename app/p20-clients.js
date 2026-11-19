// Plan Round 20 of the Portal Master Feature Plan (Nov 19 2026): clients. Everything here is Amr only.
//   #clients       O1  Client records on top of the companies list ("Works for" still reads companies): contact, rate,
//                      start date, status (active, paused, past), notes. #clients/ID is one client's page with its team,
//                      outreach, proposals, invoices and profit. Past clients (Fortune Consultants) stay, never deleted.
//   #pipeline      O2  Client pipeline board, Deal CRM style: stages as columns, drag a card left or right (or use the
//                      arrows), drag the board or swipe on a phone to scroll. Won turns the lead into a client in O1.
//   #outreach      O3  Calls, emails, LinkedIn and Upwork touches per lead or client, with the next follow-up date.
//                      Due follow-ups ring the bell at 7 AM New York (private.client_followup_bells), so the daily alert
//                      email carries them too. Messages come from #templates (outreach_templates); nothing is sent from here.
//   #proposals     O4  Proposals filled from the client or lead and the service package (rate, scope, hours). Print,
//                      download or save as a PDF in the Files hub (files bucket, mine/clients/proposals/). Nothing is sent.
//   #invoices      F1  Replaces the Round 13 page: invoices from Hours vs billing, numbered, PDF in the Files hub, sent date,
//                      payments with date and amount (full or part) through invoice_pay(); #billing reads these payments.
//   #profit        F5  Client paid minus team pay (hourly shifts and commissions on that client's shifts) minus the
//                      client's expenses in Cash. Per month and all time. Expenses get a client here. Cash shows a summary card.
//   #clientreport  O6  Weekly report draft per client from Shifts and Numbers, in plain words. Never sent: review, then copy,
//                      download or print. Drafts are kept (client_report_drafts).
// Database (plan Round 20): client_details, client_leads, client_touches, client_packages, client_proposals, invoice_payments,
// client_report_drafts, cash_entries.company_id; client_lead_won(), invoice_pay(), invoice_unpay(), client_profit(),
// payroll_billing() and portal_client_report() updated. RLS is_tracker_admin() on every new table.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, num, plural, card, empty, failed, pill, f, opt, table, tr, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const usd = n => (Number(n) < 0 ? '−$' : '$') + Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const egp = n => 'EGP ' + Math.round(Number(n) || 0).toLocaleString('en-US');
  const nyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoDay(d); };
  const day = d => d ? fmtDay(d, { month:'short', day:'numeric', year:'numeric' }) : '–';
  const short = d => d ? fmtDay(d, { month:'short', day:'numeric' }) : '–';
  const longDay = d => d ? fmtDay(d, { month:'long', day:'numeric', year:'numeric' }) : '';
  const mon = d => fmtDay(String(d).slice(0, 10), { month:'short', year:'numeric' });
  const when = at => window.PortalUI ? window.PortalUI.when(at) : new Date(at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  const tile = (v, k, s, hot) => '<div class="p-tile' + (hot ? ' r19-hot' : '') + '"><b>' + esc(v) + '</b><span>' + esc(k) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div>';
  const tiles = list => '<div class="p-tiles r20-tiles">' + list.join('') + '</div>';
  const sure = (b, text, back) => { if (b.dataset.sure === '1') return true; b.dataset.sure = '1'; b.textContent = text; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = back; } }, 4000); return false; };
  const toast = t => { if (window.PortalUI) window.PortalUI.toast(t); };
  const ownerOnly = el => { if (isOwner()) return false; el.innerHTML = '<div class="p-wrap px"><p class="p-card p-empty">This page is only for Amr.</p></div>'; return true; };
  const hashParts = () => location.hash.slice(1).split('/');
  const first = n => String(n || '').trim().split(/\s+/)[0] || '';
  const val = id => { const e = $(id); return e ? e.value.trim() : ''; };
  const numOrNull = id => { const v = val(id); return v === '' ? null : Math.max(0, +v || 0); };
  const monthly = (rate, hrs) => (+rate || 0) * (+hrs || 0) * 52 / 12;
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : (u ? 'https://' + u : '');
  // Plain wording for anything a client reads: no em or en dashes
  const plain = s => String(s || '').replace(/\s*[—–]\s*/g, ', ').replace(/ ,/g, ',');
  const STATUS = { active:['Active', 'ok'], paused:['Paused', ''], past:['Past client', 'plain'] };
  const STAGES = [['new', 'New'], ['contacted', 'Contacted'], ['talking', 'Talking'], ['proposal', 'Proposal sent'], ['won', 'Won'], ['lost', 'Lost']];
  const STAGE = Object.fromEntries(STAGES);
  const CH = { call:'Call', email:'Email', linkedin:'LinkedIn', upwork:'Upwork', text:'Text', meeting:'Meeting', other:'Other' };
  const SOURCES = ['Upwork', 'LinkedIn', 'Referral', 'Cold call', 'Cold email', 'Website', 'Other'];
  const OUTCOMES = ['No answer', 'Left a message', 'Sent', 'Replied', 'Booked a call', 'Had a call', 'Asked for a proposal', 'Said later', 'Not interested'];
  const PST = { draft:['Draft', 'plain'], sent:['Sent', ''], accepted:['Accepted', 'ok'], declined:['Declined', 'plain'] };
  const IST = { draft:['Draft', 'plain'], sent:['Sent', ''], part:['Part paid', ''], paid:['Paid', 'ok'] };

  // ======================================================================
  // A small PDF writer (text, headings, rows): no outside library, works offline
  // ======================================================================
  const P20Pdf = window.P20Pdf = (function(){
    const W = 612, H = 792, M = 54;
    const cw = (ch, bold) => { let w = /[il.,:;|!'\s]/.test(ch) ? 0.28 : /[mwMW@]/.test(ch) ? 0.85 : /[A-Z]/.test(ch) ? 0.68 : /[0-9$]/.test(ch) ? 0.556 : 0.52; return bold ? w * 1.06 : w; };
    const width = (s, size, bold) => [...s].reduce((a, c) => a + cw(c, bold), 0) * size;
    const MAP = { '’':146, '‘':145, '“':147, '”':148, '•':149, '–':150, '—':150, '·':183, '×':215, '€':128, '…':133 };
    const enc = s => [...String(s)].map(c => { let k = MAP[c] != null ? MAP[c] : c.charCodeAt(0); if (k > 255) k = 63; if (c === '(' || c === ')' || c === '\\') return '\\' + c; return k < 32 ? ' ' : k > 126 ? '\\' + k.toString(8).padStart(3, '0') : c; }).join('');
    function wrap(text, size, bold, maxW){
      const out = [];
      String(text || '').split('\n').forEach(par => {
        const words = par.split(/\s+/).filter(Boolean); let line = '';
        if (!words.length) { out.push(''); return; }
        words.forEach(w => { const t = line ? line + ' ' + w : w; if (width(t, size, bold) > maxW && line) { out.push(line); line = w; } else line = t; });
        out.push(line);
      });
      return out;
    }
    // blocks: { h1 }, { h2 }, { p }, { small }, { gap }, { row:[...], bold, right } (row cells spread over the width; last cell right-aligned)
    function build(blocks){
      const pages = []; let ops = [], y = H - M;
      const newPage = () => { if (ops.length) pages.push(ops.join('\n')); ops = []; y = H - M; };
      const text = (x, yy, s, size, bold, color) => ops.push('BT ' + (color || '0.1 0.1 0.12') + ' rg /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + x.toFixed(1) + ' ' + yy.toFixed(1) + ' Td (' + enc(s) + ') Tj ET');
      const need = h => { if (y - h < M) newPage(); };
      blocks.forEach(b => {
        if (b.gap) { y -= b.gap; return; }
        if (b.rule) { need(10); ops.push('0.8 0.8 0.82 RG 0.6 w ' + M + ' ' + (y - 4).toFixed(1) + ' m ' + (W - M) + ' ' + (y - 4).toFixed(1) + ' l S'); y -= 12; return; }
        if (b.row) {
          const size = b.size || 10, n = b.row.length, colW = (W - 2 * M) / n; need(size + 6);
          b.row.forEach((c, i) => { const s = String(c == null ? '' : c), last = i === n - 1 && n > 1; let x = M + i * colW; if (last || (b.right && i > 0)) x = M + (i + 1) * colW - width(s, size, b.bold); text(x, y - size, s, size, b.bold); });
          y -= size + 6; return;
        }
        const kind = b.h1 != null ? 'h1' : b.h2 != null ? 'h2' : b.small != null ? 'small' : 'p';
        const size = { h1:20, h2:12.5, small:8.5, p:10.5 }[kind], bold = kind === 'h1' || kind === 'h2', lead = size * 1.42;
        const color = kind === 'small' ? '0.4 0.4 0.45' : null;
        if (kind === 'h2') y -= 6;
        wrap(b[kind], size, bold, W - 2 * M - (b.indent || 0)).forEach(line => { need(lead); text(M + (b.indent || 0), y - size, line, size, bold, color); y -= lead; });
        if (kind === 'h1') y -= 4;
      });
      newPage();
      const objs = [];
      objs.push('<< /Type /Catalog /Pages 2 0 R >>');
      const kids = pages.map((_, i) => (5 + i * 2) + ' 0 R').join(' ');
      objs.push('<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>');
      objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      pages.forEach((c, i) => {
        objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (6 + i * 2) + ' 0 R >>');
        const foot = 'BT 0.5 0.5 0.55 rg /F1 8 Tf ' + M + ' 30 Td (' + enc('Page ' + (i + 1) + ' of ' + pages.length) + ') Tj ET';
        const body = c + '\n' + foot;
        objs.push('<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream');
      });
      let out = '%PDF-1.4\n'; const offs = [];
      objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
      const xref = out.length;
      out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
      out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
      return new Blob([out], { type:'application/pdf' });
    }
    const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
    // Save into the Files hub (owner's private side). Same name again replaces the old file.
    async function save(blob, folder, name){
      const path = 'mine/clients/' + folder + '/' + name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-');
      const x = await safe(db().storage.from('files').upload(path, blob, { contentType:'application/pdf', upsert:true }));
      return x.error ? { error:x.error } : { path };
    }
    return { build, download, save, wrap };
  })();

  // ======================================================================
  // shared loaders
  // ======================================================================
  async function loadClients(){
    const [c, d] = await Promise.all([safe(db().from('companies').select('id,name,bill_rate,created_at').order('name')), safe(db().from('client_details').select('*'))]);
    if (c.error) return { error:c.error };
    const det = {}; (d.data || []).forEach(x => det[x.company_id] = x);
    return { list:(c.data || []).map(x => Object.assign({ status:'active' }, det[x.company_id] || det[x.id] || {}, { id:x.id, name:x.name, bill_rate:x.bill_rate, created_at:x.created_at })) };
  }
  const loadLeads = () => safe(db().from('client_leads').select('*').order('sort').order('created_at'));
  const loadTemplates = () => safe(db().from('outreach_templates').select('*').order('audience').order('title'));
  function fillTemplate(t, vals, channel){
    let b = t.body.replace(/\{([a-z_]+)\}/g, (m, k) => vals[k] || m), s = (t.subject || '').replace(/\{([a-z_]+)\}/g, (m, k) => vals[k] || m);
    // the opt-out rule from #templates: always on texts and emails
    if (channel === 'text' || (t.channel === 'sms' && !['linkedin', 'upwork', 'email'].includes(channel))) { if (!/reply stop/i.test(b)) b = b.replace(/\s+$/, '') + ' Reply STOP to opt out'; }
    else if (channel === 'email' && !/reply stop|unsubscribe/i.test(b)) b = b.replace(/\s+$/, '') + '\n\n--\nIf you’d rather not get these emails, reply STOP and I won’t email you again.';
    return { subject:s, body:b };
  }
  const copy = async (text, msgId) => { try { await navigator.clipboard.writeText(text); say(msgId, 'Copied.'); toast('Copied.'); } catch (e) { say(msgId, 'Couldn’t copy on this device. Select the text and copy it.'); } };

  // ======================================================================
  // O1  #clients and #clients/ID
  // ======================================================================
  function clientForm(c){
    c = c || { status:'active' };
    return '<form class="px-form r20-row p20-form" id="p20CForm" data-id="' + (c.id || '') + '" novalidate>' +
      f('Client name', '<input type="text" id="p20cName" maxlength="120" value="' + esc(c.name || '') + '" required>') +
      f('Status', '<select id="p20cStatus">' + Object.keys(STATUS).map(k => opt(k, STATUS[k][0], c.status === k)).join('') + '</select>') +
      f('Hourly rate (USD)', '<input type="number" id="p20cRate" min="0" step="0.01" value="' + esc(c.bill_rate == null ? '' : c.bill_rate) + '">') +
      f('Hours a week', '<input type="number" id="p20cHours" min="0" step="0.5" value="' + esc(c.hours_week == null ? '' : c.hours_week) + '">') +
      f('Contact name', '<input type="text" id="p20cContact" maxlength="120" value="' + esc(c.contact_name || '') + '">') +
      f('Their role', '<input type="text" id="p20cRole" maxlength="80" value="' + esc(c.contact_role || '') + '" placeholder="e.g. Owner">') +
      f('Email', '<input type="email" id="p20cEmail" maxlength="160" value="' + esc(c.email || '') + '">') +
      f('Phone', '<input type="tel" id="p20cPhone" maxlength="40" value="' + esc(c.phone || '') + '">') +
      f('Website', '<input type="text" id="p20cWeb" maxlength="200" value="' + esc(c.website || '') + '">') +
      f('Found through', '<select id="p20cSource">' + opt('', '–') + SOURCES.map(s => opt(s, s, c.source === s)).join('') + '</select>') +
      f('Start date', '<input type="date" id="p20cStart" value="' + esc(c.start_date || '') + '">') +
      f('End date (past clients)', '<input type="date" id="p20cEnd" value="' + esc(c.end_date || '') + '">') +
      f('Notes', '<textarea id="p20cNotes" rows="3" maxlength="4000">' + esc(c.notes || '') + '</textarea>', 'px-wide') +
      '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save client</button><button type="button" class="p-btn is-ghost" data-p20cx>Cancel</button><span class="p-hint" id="p20cMsg" role="status"></span></div></form>';
  }
  async function saveClient(form){
    const id = +form.dataset.id || null, name = val('p20cName');
    if (!name) { say('p20cMsg', 'Type the client’s name.'); return null; }
    const rate = numOrNull('p20cRate');
    let co = id;
    if (id) { const x = await safe(db().from('companies').update({ name, bill_rate:rate }).eq('id', id)); if (x.error) { say('p20cMsg', errText(x, 'Couldn’t save it.')); return null; } }
    else { const x = await safe(db().from('companies').insert({ name, bill_rate:rate }).select('id').single()); if (x.error) { say('p20cMsg', errText(x, 'Couldn’t save it. Is that name already on the list?')); return null; } co = x.data.id; }
    const det = { company_id:co, status:val('p20cStatus') || 'active', contact_name:val('p20cContact') || null, contact_role:val('p20cRole') || null, email:val('p20cEmail') || null,
      phone:val('p20cPhone') || null, website:val('p20cWeb') || null, source:val('p20cSource') || null, start_date:val('p20cStart') || null, end_date:val('p20cEnd') || null,
      hours_week:numOrNull('p20cHours'), notes:val('p20cNotes') || null, updated_at:new Date().toISOString() };
    const y = await safe(db().from('client_details').upsert(det, { onConflict:'company_id' }));
    if (y.error) { say('p20cMsg', errText(y, 'Saved the name, but not the details. Try again.')); return null; }
    return co;
  }

  V.clients = { title:'Clients', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const id = +hashParts()[1];
    if (id) return clientPage(el, ok, id);
    const body = PX.page(el, 'Clients', 'Clients', 'Everyone you do client work for: contact, rate, start date, status and notes. A rep’s “Works for” comes from this list. Past clients stay here; they are never deleted.');
    const S = { st:'open', adding:false };
    let L = [], agents = {};
    async function load(){
      const [r, ac, ag] = await Promise.all([loadClients(), safe(db().from('agent_companies').select('agent_id,company_id')), safe(db().from('agents').select('id,name,active'))]);
      if (!ok()) return;
      if (r.error) { body.innerHTML = failed(r.error); return; }
      L = r.list; agents = {};
      const nm = {}; (ag.data || []).filter(a => a.active !== false).forEach(a => nm[a.id] = a.name);
      (ac.data || []).forEach(x => { if (nm[x.agent_id]) (agents[x.company_id] = agents[x.company_id] || []).push(nm[x.agent_id]); });
      draw();
    }
    function draw(){
      const t = nyDay(), act = L.filter(c => c.status === 'active'), due = L.filter(c => c.status !== 'past' && c.follow_up_on && c.follow_up_on <= t);
      const rows = L.filter(c => S.st === 'all' || (S.st === 'open' ? c.status !== 'past' : c.status === S.st));
      body.innerHTML =
        tiles([tile(act.length, 'active clients', act.map(c => c.name).join(', ')), tile(L.filter(c => c.status === 'paused').length, 'paused'), tile(L.filter(c => c.status === 'past').length, 'past clients'),
          tile(due.length, 'follow-ups due', due.map(c => c.name).join(', '), due.length > 0)]) +
        '<div class="px-tools"><select id="p20cSt" aria-label="Show">' + [['open', 'Active and paused'], ['active', 'Active'], ['paused', 'Paused'], ['past', 'Past clients'], ['all', 'All']].map(([k, v]) => opt(k, v, S.st === k)).join('') + '</select>' +
          '<button type="button" class="p-btn" id="p20cAdd">+ Add a client</button><a class="p-btn is-ghost" href="#pipeline">Pipeline</a><a class="p-btn is-ghost" href="#outreach">Outreach log</a></div>' +
        (S.adding ? card('New client', '', clientForm(null)) : '') +
        card('Your clients', plural(rows.length, 'client'), rows.length ? table(['Client', 'Status', 'Contact', 'Rate', 'Started', 'Team', 'Next follow-up', ''], rows.map(c => tr([
          '<a href="#clients/' + c.id + '"><b>' + esc(c.name) + '</b></a>', pill(STATUS[c.status][0], STATUS[c.status][1]),
          esc(c.contact_name || '–') + (c.email ? '<small class="r19-sub">' + esc(c.email) + '</small>' : ''),
          c.bill_rate != null ? usd(c.bill_rate) + '/h' : '–', esc(c.start_date ? day(c.start_date) : '–'),
          esc((agents[c.id] || []).join(', ') || '–'),
          c.follow_up_on ? (c.follow_up_on <= t ? '<b class="p20-due">' + esc(short(c.follow_up_on)) + '</b>' : esc(short(c.follow_up_on))) : '–',
          '<a class="p-btn is-ghost" href="#clients/' + c.id + '">Open</a>']))) : empty(S.st === 'past' ? 'No past clients.' : 'No clients here yet. Add one, or win a lead on the pipeline.'));
    }
    await load();
    body.addEventListener('change', e => { if (e.target.id === 'p20cSt') { S.st = e.target.value; draw(); } });
    body.addEventListener('click', e => {
      if (e.target.id === 'p20cAdd') { S.adding = true; draw(); const n = $('p20cName'); if (n) n.focus(); }
      if (e.target.closest('[data-p20cx]')) { S.adding = false; draw(); }
    });
    body.addEventListener('submit', async e => { if (e.target.id !== 'p20CForm') return; e.preventDefault(); const co = await saveClient(e.target); if (co) { S.adding = false; toast('Client saved.'); location.hash = '#clients/' + co; } });
  }};

  async function clientPage(el, ok, id){
    const body = PX.page(el, 'Clients', 'Client', '');
    const S = { edit:false };
    let c = null, data = {};
    async function load(){
      const [r, ac, ag, lt, tc, pr, iv, pf] = await Promise.all([loadClients(), safe(db().from('agent_companies').select('agent_id').eq('company_id', id)), safe(db().from('agents').select('id,name,active')),
        safe(db().from('client_leads').select('id,name,stage').eq('company_id', id)), safe(db().from('client_touches').select('*').order('at', { ascending:false }).limit(200)),
        safe(db().from('client_proposals').select('id,number,title,status,rate,hours_week,created_at,pdf_path').eq('company_id', id).order('created_at', { ascending:false })),
        safe(db().from('invoices').select('*').eq('company_id', id).order('period_start', { ascending:false })), safe(db().rpc('client_profit', { p_months:12, p_company:id }))]);
      if (!ok()) return;
      if (r.error) { body.innerHTML = failed(r.error); return; }
      c = r.list.find(x => x.id === id);
      if (!c) { body.innerHTML = empty('That client isn’t on the list.') + '<p><a href="#clients">Back to clients</a></p>'; return; }
      const leadIds = (lt.data || []).map(l => l.id), nm = {}; (ag.data || []).forEach(a => nm[a.id] = a.name);
      data = { team:(ac.data || []).map(x => nm[x.agent_id]).filter(Boolean), leads:lt.data || [], touches:(tc.data || []).filter(t => t.company_id === id || leadIds.includes(t.lead_id)),
        props:pr.data || [], invs:iv.data || [], profit:((pf.data || {}).clients || [])[0], rate:(pf.data || {}).egp_rate || 52 };
      draw();
    }
    function draw(){
      const h = el.querySelector('.p-hero h1'); if (h) h.textContent = c.name;
      const hp = el.querySelector('.p-hero p'); if (hp) hp.textContent = [STATUS[c.status][0], c.start_date ? 'since ' + day(c.start_date) : '', c.bill_rate != null ? usd(c.bill_rate) + ' an hour' : ''].filter(Boolean).join(' · ');
      const p = data.profit || { all:{}, months:[] }, a = p.all || {}, t = nyDay();
      const thisM = (p.months || []).find(m => String(m.month).slice(0, 7) === t.slice(0, 7)) || {};
      const site = safeUrl(c.website);
      body.innerHTML =
        '<div class="px-tools"><a class="p-btn is-ghost" href="#clients">← All clients</a><a class="p-btn" href="#outreach/c/' + id + '">Log a touch</a><a class="p-btn is-ghost" href="#proposals/new/c/' + id + '">Make a proposal</a>' +
          '<a class="p-btn is-ghost" href="#invoices/new/' + id + '">Make an invoice</a><a class="p-btn is-ghost" href="#clientreport/' + id + '">Weekly report</a></div>' +
        tiles([tile(usd(a.profit || 0), 'profit, all time', usd(a.paid || 0) + ' paid · ' + usd(a.team || 0) + ' team · ' + usd(a.expenses || 0) + ' costs', (a.profit || 0) < 0),
          tile(usd(thisM.profit || 0), 'profit this month', egp((thisM.profit || 0) * data.rate)), tile(num(a.hours || 0), 'team hours, all time'),
          tile(c.follow_up_on ? short(c.follow_up_on) : '–', 'next follow-up', c.follow_up_on && c.follow_up_on <= t ? 'due' : '', c.follow_up_on && c.follow_up_on <= t)]) +
        (S.edit ? card('Edit client', '', clientForm(c)) :
          card('Details', '<button type="button" class="p-btn is-ghost" id="p20cEdit">Edit</button>',
            '<dl class="p20-dl">' + [['Status', pill(STATUS[c.status][0], STATUS[c.status][1])], ['Contact', esc([c.contact_name, c.contact_role].filter(Boolean).join(', ') || '–')],
              ['Email', c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '–'], ['Phone', c.phone ? '<a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a>' : '–'],
              ['Website', site ? '<a href="' + esc(site) + '" target="_blank" rel="noopener">' + esc(c.website) + '</a>' : '–'], ['Rate', c.bill_rate != null ? usd(c.bill_rate) + ' an hour' : '–'],
              ['Hours a week', c.hours_week != null ? esc(c.hours_week) : '–'], ['Found through', esc(c.source || '–')], ['Started', esc(c.start_date ? day(c.start_date) : '–')],
              ['Ended', esc(c.end_date ? day(c.end_date) : '–')], ['Team on it', esc(data.team.join(', ') || 'Nobody yet (set it in Invite and access › Works for)')]].map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>').join('') + '</dl>' +
            (c.notes ? '<p class="px-pre p20-notes">' + esc(c.notes) + '</p>' : ''))) +
        card('Profit by month', 'client paid − team pay − client costs', (p.months || []).length ? table(['Month', 'Hours', 'Should bill', 'Client paid', 'Team pay', 'Costs', 'Profit'], p.months.slice().reverse().map(m => tr([esc(mon(m.month)), esc(m.hours), usd(m.billed), usd(m.paid), usd(m.team), usd(m.expenses), '<b' + (m.profit < 0 ? ' class="px-neg"' : '') + '>' + usd(m.profit) + '</b>']))) : empty('No hours, payments or costs yet.')) +
        card('Outreach', plural(data.touches.length, 'touch', 'touches'), data.touches.length ? table(['When', 'How', 'Outcome', 'Note', 'Next follow-up'], data.touches.slice(0, 30).map(x => tr([esc(when(x.at)), esc(CH[x.channel]), esc(x.outcome || '–'), esc(x.note || ''), esc(x.follow_up_on ? short(x.follow_up_on) : '–')]))) : empty('Nothing logged yet.')) +
        card('Proposals', '', data.props.length ? table(['#', 'Title', 'Monthly', 'Status', ''], data.props.map(x => tr(['P-' + x.number, esc(x.title), usd(monthly(x.rate, x.hours_week)), pill(PST[x.status][0], PST[x.status][1]), '<a class="p-btn is-ghost" href="#proposals/' + x.id + '">Open</a>']))) : empty('No proposals yet.')) +
        card('Invoices', '', data.invs.length ? table(['#', 'Dates', 'Amount', 'Paid', 'Status', ''], data.invs.map(i => tr(['<b>' + i.number + '</b>', esc(short(i.period_start) + ' to ' + day(i.period_end)), usd(i.amount), usd(i.amount_paid), pill(IST[i.status][0], IST[i.status][1]), '<a class="p-btn is-ghost" href="#invoices/' + i.id + '">Open</a>']))) : empty('No invoices yet.'));
    }
    await load();
    body.addEventListener('click', e => {
      if (e.target.id === 'p20cEdit') { S.edit = true; draw(); }
      if (e.target.closest('[data-p20cx]')) { S.edit = false; draw(); }
    });
    body.addEventListener('submit', async e => { if (e.target.id !== 'p20CForm') return; e.preventDefault(); const co = await saveClient(e.target); if (co) { S.edit = false; toast('Saved.'); load(); } });
  }

  // ======================================================================
  // O2  #pipeline
  // ======================================================================
  function leadForm(l){
    l = l || { stage:'new' };
    return '<form class="px-form r20-row p20-form" id="p20LForm" data-id="' + (l.id || '') + '" novalidate>' +
      f('Business', '<input type="text" id="p20lName" maxlength="120" value="' + esc(l.name || '') + '" required>') +
      f('Stage', '<select id="p20lStage">' + STAGES.filter(s => s[0] !== 'won' || l.stage === 'won').map(([k, v]) => opt(k, v, l.stage === k)).join('') + '</select>') +
      f('Contact name', '<input type="text" id="p20lContact" maxlength="120" value="' + esc(l.contact_name || '') + '">') +
      f('Found through', '<select id="p20lSource">' + opt('', '–') + SOURCES.map(s => opt(s, s, l.source === s)).join('') + '</select>') +
      f('Email', '<input type="email" id="p20lEmail" maxlength="160" value="' + esc(l.email || '') + '">') +
      f('Phone', '<input type="tel" id="p20lPhone" maxlength="40" value="' + esc(l.phone || '') + '">') +
      f('Website or profile link', '<input type="text" id="p20lWeb" maxlength="200" value="' + esc(l.website || '') + '">') +
      f('Rate you’d charge (USD/h)', '<input type="number" id="p20lRate" min="0" step="0.01" value="' + esc(l.rate == null ? '' : l.rate) + '">') +
      f('Hours a week', '<input type="number" id="p20lHours" min="0" step="0.5" value="' + esc(l.hours_week == null ? '' : l.hours_week) + '">') +
      f('Next follow-up', '<input type="date" id="p20lFollow" value="' + esc(l.follow_up_on || '') + '">') +
      (l.stage === 'lost' ? f('Why it was lost', '<input type="text" id="p20lLost" maxlength="300" value="' + esc(l.lost_reason || '') + '">', 'px-wide') : '') +
      f('Notes', '<textarea id="p20lNotes" rows="3" maxlength="4000">' + esc(l.notes || '') + '</textarea>', 'px-wide') +
      '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save lead</button><button type="button" class="p-btn is-ghost" data-p20lx>Close</button><span class="p-hint" id="p20lMsg" role="status"></span></div></form>';
  }
  V.pipeline = { title:'Client pipeline', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Clients', 'Client pipeline', 'Businesses you might work for, by stage. Drag a card left or right (or use the arrows), and drag the board or swipe to scroll. Won adds the lead to your clients.');
    const S = { open:null, adding:false, lost:false };
    let L = [], Tc = [];
    async function load(){
      const [r, t] = await Promise.all([loadLeads(), safe(db().from('client_touches').select('id,lead_id,at,channel,outcome,note').not('lead_id', 'is', null).order('at', { ascending:false }).limit(500))]);
      if (!ok()) return;
      if (r.error) { body.innerHTML = failed(r.error); return; }
      L = r.data || []; Tc = t.data || []; draw();
      const pid = +hashParts()[1]; if (pid && !S.open && L.some(l => l.id === pid)) { S.open = pid; draw(); }
    }
    function cardHtml(l){
      const t = nyDay(), i = STAGES.findIndex(s => s[0] === l.stage), last = Tc.find(x => x.lead_id === l.id);
      const m = monthly(l.rate, l.hours_week);
      return '<article class="p20-lead' + (S.open === l.id ? ' on' : '') + '" draggable="true" data-p20lead="' + l.id + '" tabindex="0" aria-label="' + esc(l.name + ', ' + STAGE[l.stage]) + '">' +
        '<b>' + esc(l.name) + '</b>' + (l.contact_name ? '<small>' + esc(l.contact_name) + '</small>' : '') +
        '<small>' + esc([l.source, m ? usd(m) + ' a month' : ''].filter(Boolean).join(' · ')) + '</small>' +
        (l.follow_up_on ? '<small class="' + (l.follow_up_on <= t ? 'p20-due' : '') + '">Follow up ' + esc(short(l.follow_up_on)) + '</small>' : '') +
        (last ? '<small class="p20-last">' + esc(CH[last.channel] + (last.outcome ? ', ' + last.outcome : '') + ' · ' + short(isoDay(new Date(last.at)))) + '</small>' : '') +
        '<span class="p20-move">' + (i > 0 && l.stage !== 'won' ? '<button type="button" class="p20-arrow" data-p20mv="' + l.id + '" data-to="' + STAGES[i - 1][0] + '" aria-label="Move to ' + esc(STAGES[i - 1][1]) + '">‹</button>' : '<span></span>') +
        (i < STAGES.length - 1 && l.stage !== 'won' ? '<button type="button" class="p20-arrow" data-p20mv="' + l.id + '" data-to="' + STAGES[i + 1][0] + '" aria-label="Move to ' + esc(STAGES[i + 1][1]) + '">›</button>' : '') + '</span></article>';
    }
    function draw(){
      const open = L.filter(l => !['won', 'lost'].includes(l.stage)), t = nyDay();
      const pipe = open.reduce((a, l) => a + monthly(l.rate, l.hours_week), 0);
      const sel = S.open && L.find(l => l.id === S.open);
      const cols = STAGES.filter(s => s[0] !== 'lost' || S.lost);
      body.innerHTML =
        tiles([tile(open.length, 'open leads'), tile(usd(pipe), 'a month if all open leads say yes', 'rate × hours a week'), tile(L.filter(l => l.stage === 'won').length, 'won'),
          tile(open.filter(l => l.follow_up_on && l.follow_up_on <= t).length, 'follow-ups due', '', open.some(l => l.follow_up_on && l.follow_up_on <= t))]) +
        '<div class="px-tools"><button type="button" class="p-btn" id="p20lAdd">+ New lead</button><label class="p20-chk"><input type="checkbox" id="p20lLostT"' + (S.lost ? ' checked' : '') + '> Show lost</label>' +
          '<a class="p-btn is-ghost" href="#outreach">Outreach log</a><span class="p-hint" id="p20bMsg" role="status"></span></div>' +
        (S.adding ? card('New lead', '', leadForm(null)) : '') +
        (sel ? leadPanel(sel) : '') +
        '<div class="p20-board" id="p20Board">' + cols.map(([k, v]) => { const list = L.filter(l => l.stage === k);
          return '<section class="p20-col" data-p20col="' + k + '"><header><b>' + esc(v) + '</b><span>' + list.length + '</span></header><div class="p20-cards">' +
            (list.length ? list.map(cardHtml).join('') : '<p class="p20-drop">' + (k === 'won' ? 'Drop here when they say yes' : 'Drop a card here') + '</p>') + '</div></section>'; }).join('') + '</div>';
      wireBoard();
    }
    function leadPanel(l){
      const ts = Tc.filter(x => x.lead_id === l.id);
      return card(l.name, STAGE[l.stage] + (l.company_id ? ' · <a href="#clients/' + l.company_id + '">Client page</a>' : ''),
        leadForm(l) +
        '<div class="px-tools"><a class="p-btn is-ghost" href="#outreach/l/' + l.id + '">Log a touch</a><a class="p-btn is-ghost" href="#proposals/new/l/' + l.id + '">Make a proposal</a>' +
          (l.stage !== 'won' ? '<button type="button" class="p-btn" data-p20won="' + l.id + '">They said yes: add as a client</button>' : '') +
          '<button type="button" class="p-btn is-ghost" data-p20ldel="' + l.id + '">Delete lead</button></div>' +
        '<h3 class="r20-h">Touches</h3>' + (ts.length ? table(['When', 'How', 'Outcome', 'Note'], ts.slice(0, 15).map(x => tr([esc(when(x.at)), esc(CH[x.channel]), esc(x.outcome || '–'), esc(x.note || '')]))) : empty('Nothing logged yet.')), 'p20Panel');
    }
    async function move(id, to){
      const l = L.find(x => x.id === id); if (!l || l.stage === to) return;
      if (to === 'won') return won(id);
      const prev = l.stage; l.stage = to; l.stage_at = new Date().toISOString();
      l.sort = Date.now() / 1e3; draw();
      const x = await safe(db().from('client_leads').update({ stage:to, stage_at:l.stage_at, sort:l.sort, updated_at:l.stage_at }).eq('id', id));
      if (x.error) { l.stage = prev; draw(); say('p20bMsg', errText(x, 'Couldn’t move it. Try again.')); return; }
      if (to === 'lost') { S.open = id; S.lost = true; draw(); const r = $('p20lLost'); if (r) r.focus(); say('p20bMsg', 'Moved to Lost. Add why, if you know.'); }
    }
    async function won(id){
      const x = await safe(db().rpc('client_lead_won', { p_lead:id }));
      if (x.error) { say('p20bMsg', errText(x, 'Couldn’t add the client. Try again.')); return; }
      toast('Added to your clients.'); say('p20bMsg', 'Added to your clients.');
      S.open = id; await load();
      const pnl = $('p20Panel'); if (pnl) pnl.insertAdjacentHTML('afterbegin', '<p class="p-card p20-won">Won. <a href="#clients/' + x.data + '">Open the client page</a> to set the start date, rate and team.</p>');
    }
    // drag and drop between columns (mouse); press-and-drag on the board background scrolls it sideways
    function wireBoard(){
      const b = $('p20Board'); if (!b) return;
      let dragId = null;
      b.addEventListener('dragstart', e => { const c = e.target.closest('[data-p20lead]'); if (!c) return; dragId = +c.dataset.p20lead; c.classList.add('drag'); try { e.dataTransfer.setData('text/plain', String(dragId)); e.dataTransfer.effectAllowed = 'move'; } catch (er) {} });
      b.addEventListener('dragend', e => { const c = e.target.closest('[data-p20lead]'); if (c) c.classList.remove('drag'); b.querySelectorAll('.p20-col.over').forEach(x => x.classList.remove('over')); });
      b.addEventListener('dragover', e => { const col = e.target.closest('[data-p20col]'); if (!col || dragId == null) return; e.preventDefault(); b.querySelectorAll('.p20-col.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over');
        const r = b.getBoundingClientRect(); if (e.clientX > r.right - 60) b.scrollLeft += 18; else if (e.clientX < r.left + 60) b.scrollLeft -= 18; });
      b.addEventListener('drop', e => { const col = e.target.closest('[data-p20col]'); if (!col || dragId == null) return; e.preventDefault(); const id = dragId; dragId = null; move(id, col.dataset.p20col); });
      b.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.target.closest('[data-p20lead], button, a, input')) return; down = { b, x:e.clientX, s:b.scrollLeft }; b.classList.add('grab'); });
    }
    // one pair of window listeners per page open (the board itself is redrawn often)
    let down = null;
    const onMove = e => { if (!ok()) return off(); if (down) down.b.scrollLeft = down.s - (e.clientX - down.x); };
    const onUp = () => { if (down) down.b.classList.remove('grab'); down = null; if (!ok()) off(); };
    const off = () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
    await load();
    body.addEventListener('click', async e => {
      const mv = e.target.closest('[data-p20mv]'); if (mv) { e.stopPropagation(); move(+mv.dataset.p20mv, mv.dataset.to); return; }
      const w = e.target.closest('[data-p20won]'); if (w) { w.disabled = true; won(+w.dataset.p20won); return; }
      const dl = e.target.closest('[data-p20ldel]');
      if (dl) { if (!sure(dl, 'Sure? Its touches go too', 'Delete lead')) return; if (window.PortalUI && PortalUI.del) { const id = +dl.dataset.p20ldel; PortalUI.del(dl, { text:'Lead deleted, with its touches.', label:'Delete lead', rows:[dl.closest('.p-card')].concat([...body.querySelectorAll('[data-p20lead="' + id + '"]')]), run:() => safe(db().from('client_leads').delete().eq('id', id)), after:() => { S.open = null; load(); } }); return; } dl.disabled = true; const x = await safe(db().from('client_leads').delete().eq('id', +dl.dataset.p20ldel)); if (x.error) { say('p20lMsg', errText(x, 'Couldn’t delete it.')); dl.disabled = false; return; } S.open = null; toast('Lead deleted.'); load(); return; }
      if (e.target.id === 'p20lAdd') { S.adding = true; S.open = null; draw(); const n = $('p20lName'); if (n) n.focus(); return; }
      if (e.target.closest('[data-p20lx]')) { S.adding = false; S.open = null; history.replaceState(null, '', '#pipeline'); draw(); return; }
      const c = e.target.closest('[data-p20lead]'); if (c) { S.open = +c.dataset.p20lead; S.adding = false; history.replaceState(null, '', '#pipeline/' + S.open); draw(); window.scrollTo({ top:0, behavior:'smooth' }); }
    });
    body.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('[data-p20lead]'); if (c && e.key === 'Enter') c.click(); });
    body.addEventListener('change', e => { if (e.target.id === 'p20lLostT') { S.lost = e.target.checked; draw(); } });
    body.addEventListener('submit', async e => {
      if (e.target.id !== 'p20LForm') return; e.preventDefault();
      const id = +e.target.dataset.id || null, name = val('p20lName');
      if (!name) return say('p20lMsg', 'Type the business name.');
      const stage = val('p20lStage') || 'new';
      const row = { name, stage, contact_name:val('p20lContact') || null, source:val('p20lSource') || null, email:val('p20lEmail') || null, phone:val('p20lPhone') || null, website:val('p20lWeb') || null,
        rate:numOrNull('p20lRate'), hours_week:numOrNull('p20lHours'), follow_up_on:val('p20lFollow') || null, notes:val('p20lNotes') || null, updated_at:new Date().toISOString() };
      if ($('p20lLost')) row.lost_reason = val('p20lLost') || null;
      const old = id && L.find(l => l.id === id);
      if (old && old.stage !== stage) row.stage_at = row.updated_at;
      if (!id) row.sort = Date.now() / 1e3;
      const x = id ? await safe(db().from('client_leads').update(row).eq('id', id)) : await safe(db().from('client_leads').insert(row).select('id').single());
      if (x.error) return say('p20lMsg', errText(x, 'Couldn’t save it. Try again.'));
      S.adding = false; if (!id) S.open = null; toast('Lead saved.'); load();
    });
  }};

  // ======================================================================
  // O3  #outreach
  // ======================================================================
  V.outreach = { title:'Outreach log', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Clients', 'Outreach log', 'Every call, email, LinkedIn and Upwork message to a lead or client, and when to follow up. Due follow-ups ring the bell at 7 AM New York and go in your daily alert email. Nothing is sent from here: copy the message and send it yourself.');
    const [h0, k0, id0] = hashParts();
    const S = { who:k0 && id0 ? k0 + ':' + id0 : '', tpl:'', ch:'email', range:14 };
    let C = [], L = [], Tc = [], TP = [];
    async function load(){
      const [c, l, t, tp] = await Promise.all([loadClients(), loadLeads(), safe(db().from('client_touches').select('*').order('at', { ascending:false }).limit(300)), loadTemplates()]);
      if (!ok()) return;
      if (c.error || l.error) { body.innerHTML = failed(c.error || l.error); return; }
      C = c.list; L = l.data || []; Tc = t.data || []; TP = (tp.data || []).slice().sort((a, b) => (a.audience === 'client' ? 0 : 1) - (b.audience === 'client' ? 0 : 1));
      draw();
    }
    const target = k => { const [kind, id] = String(k).split(':'); return kind === 'l' ? L.find(x => x.id === +id) : C.find(x => x.id === +id); };
    const nameOf = x => x.lead_id ? ((L.find(l => l.id === x.lead_id) || {}).name || 'Lead') : ((C.find(c => c.id === x.company_id) || {}).name || 'Client');
    function draw(){
      const t = nyDay(), soon = addDays(t, S.range);
      const due = [...L.filter(l => !['won', 'lost'].includes(l.stage) && l.follow_up_on && l.follow_up_on <= soon).map(l => ({ k:'l:' + l.id, name:l.name, on:l.follow_up_on, what:STAGE[l.stage], link:'#pipeline/' + l.id })),
        ...C.filter(c => c.status !== 'past' && c.follow_up_on && c.follow_up_on <= soon).map(c => ({ k:'c:' + c.id, name:c.name, on:c.follow_up_on, what:'Client', link:'#clients/' + c.id }))].sort((a, b) => a.on < b.on ? -1 : 1);
      const weekAgo = Date.now() - 7 * 864e5, wk = Tc.filter(x => new Date(x.at) >= weekAgo);
      const by = {}; wk.forEach(x => by[x.channel] = (by[x.channel] || 0) + 1);
      body.innerHTML =
        tiles([tile(due.filter(d => d.on <= t).length, 'follow-ups due today or late', '', due.some(d => d.on <= t)), tile(wk.length, 'touches in the last 7 days', Object.keys(by).map(k => CH[k] + ' ' + by[k]).join(' · ')),
          tile(wk.filter(x => /repl|booked|had a call|proposal/i.test(x.outcome || '')).length, 'replies or calls this week')]) +
        card('Log a touch', '', logForm()) +
        card('Follow-ups', '<select id="p20oR" aria-label="Show">' + [[0, 'Due today or late'], [7, 'Next 7 days'], [14, 'Next 14 days'], [30, 'Next 30 days']].map(([v, n]) => opt(v, n, S.range === v)).join('') + '</select>',
          due.length ? table(['Follow up', 'Who', 'Where they are', ''], due.map(d => tr(['<b' + (d.on <= t ? ' class="p20-due"' : '') + '>' + esc(d.on < t ? short(d.on) + ' (late)' : d.on === t ? 'Today' : short(d.on)) + '</b>',
            '<a href="' + d.link + '">' + esc(d.name) + '</a>', esc(d.what), '<button type="button" class="p-btn is-ghost" data-p20olog="' + d.k + '">Log a touch</button>']))) : empty('Nothing to follow up in these dates.')) +
        card('Recent touches', plural(Tc.length, 'touch', 'touches'), Tc.length ? table(['When', 'Who', 'How', 'Outcome', 'Note', 'Next'], Tc.slice(0, 60).map(x => tr([esc(when(x.at)),
          '<a href="' + (x.lead_id ? '#pipeline/' + x.lead_id : '#clients/' + x.company_id) + '">' + esc(nameOf(x)) + '</a>', esc(CH[x.channel]), esc(x.outcome || '–'), esc(x.note || ''), esc(x.follow_up_on ? short(x.follow_up_on) : '–')]))) : empty('Nothing logged yet.'));
      drawMsg();
    }
    function logForm(){
      const leads = L.filter(l => !['won', 'lost'].includes(l.stage)), cls = C.filter(c => c.status !== 'past');
      const now = new Date(), local = new Date(now.getTime() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
      return '<form class="px-form r20-row p20-form" id="p20OForm" novalidate>' +
        f('Who', '<select id="p20oWho">' + opt('', 'Pick a lead or client') + (leads.length ? '<optgroup label="Leads">' + leads.map(l => opt('l:' + l.id, l.name + ' · ' + STAGE[l.stage], S.who === 'l:' + l.id)).join('') + '</optgroup>' : '') +
          (cls.length ? '<optgroup label="Clients">' + cls.map(c => opt('c:' + c.id, c.name, S.who === 'c:' + c.id)).join('') + '</optgroup>' : '') + '</select>') +
        f('How', '<select id="p20oCh">' + Object.keys(CH).map(k => opt(k, CH[k], S.ch === k)).join('') + '</select>') +
        f('Outcome', '<input type="text" id="p20oOut" maxlength="80" list="p20oOuts" placeholder="e.g. Left a message"><datalist id="p20oOuts">' + OUTCOMES.map(o => '<option value="' + esc(o) + '">').join('') + '</datalist>') +
        f('When', '<input type="datetime-local" id="p20oAt" value="' + local + '">') +
        f('Next follow-up', '<input type="date" id="p20oNext" value="' + addDays(nyDay(), 3) + '">') +
        '<div class="sc-f p20-quick"><span>Quick</span><span>' + [[1, 'Tomorrow'], [3, '3 days'], [7, '1 week'], [14, '2 weeks'], [0, 'None']].map(([n, t]) => '<button type="button" class="p-btn is-ghost" data-p20next="' + n + '">' + t + '</button>').join('') + '</span></div>' +
        f('Note', '<textarea id="p20oNote" rows="2" maxlength="3000" placeholder="What was said, what they asked for"></textarea>', 'px-wide') +
        f('Message template (optional)', '<select id="p20oTpl">' + opt('', 'None') + TP.map(t => opt(t.id, (t.audience === 'client' ? '' : '[' + t.audience + '] ') + t.title, String(S.tpl) === String(t.id))).join('') + '</select>', 'px-wide') +
        '<div id="p20oMsgBox" class="px-wide"></div>' +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save touch</button><a class="p-btn is-ghost" href="#templates">Edit templates</a><span class="p-hint" id="p20oMsg" role="status"></span></div></form>';
    }
    function drawMsg(){
      const box = $('p20oMsgBox'); if (!box) return;
      const t = TP.find(x => String(x.id) === String(val('p20oTpl'))); if (!t) { box.innerHTML = ''; return; }
      const w = target(val('p20oWho')) || {};
      const out = fillTemplate(t, { first_name:first(w.contact_name), company:w.name || '', my_name:'Amr', my_phone:((T().profile || {}).phone || '') }, val('p20oCh'));
      box.innerHTML = '<div class="p20-msg">' + (out.subject ? '<p><b>Subject:</b> ' + esc(out.subject) + '</p>' : '') + '<pre class="px-pre">' + esc(out.body) + '</pre>' +
        '<div class="px-tools"><button type="button" class="p-btn is-ghost" id="p20oCopy">Copy message</button>' + (out.subject ? '<button type="button" class="p-btn is-ghost" id="p20oCopyS">Copy subject</button>' : '') +
        (/\{[a-z_]+\}/.test(out.body + out.subject) ? '<span class="p-hint"><b>Fill in every blank before sending.</b></span>' : '') + '</div></div>';
      box.dataset.body = out.body; box.dataset.subject = out.subject;
    }
    await load();
    body.addEventListener('change', e => {
      if (e.target.id === 'p20oR') { S.range = +e.target.value; S.who = val('p20oWho'); S.tpl = val('p20oTpl'); S.ch = val('p20oCh'); draw(); }
      if (['p20oTpl', 'p20oWho', 'p20oCh'].includes(e.target.id)) { if (e.target.id === 'p20oTpl') { const t = TP.find(x => String(x.id) === e.target.value); if (t && t.channel === 'sms' && val('p20oCh') === 'email') $('p20oCh').value = 'text'; } drawMsg(); }
    });
    body.addEventListener('click', e => {
      const n = e.target.closest('[data-p20next]'); if (n) { const d = +n.dataset.p20next; $('p20oNext').value = d ? addDays(nyDay(), d) : ''; return; }
      const lg = e.target.closest('[data-p20olog]'); if (lg) { $('p20oWho').value = lg.dataset.p20olog; drawMsg(); $('p20OForm').scrollIntoView({ behavior:'smooth', block:'start' }); $('p20oOut').focus(); return; }
      const box = $('p20oMsgBox');
      if (e.target.id === 'p20oCopy') copy(box.dataset.body, 'p20oMsg');
      if (e.target.id === 'p20oCopyS') copy(box.dataset.subject, 'p20oMsg');
    });
    body.addEventListener('submit', async e => {
      if (e.target.id !== 'p20OForm') return; e.preventDefault();
      const who = val('p20oWho'); if (!who) return say('p20oMsg', 'Pick who it was with.');
      const [kind, id] = who.split(':'), at = val('p20oAt');
      const row = { lead_id:kind === 'l' ? +id : null, company_id:kind === 'c' ? +id : null, channel:val('p20oCh'), outcome:val('p20oOut') || null, note:val('p20oNote') || null,
        template_id:+val('p20oTpl') || null, at:at ? new Date(at).toISOString() : new Date().toISOString(), follow_up_on:val('p20oNext') || null };
      const b = e.target.querySelector('[type=submit]'); b.disabled = true;
      const x = await safe(db().from('client_touches').insert(row));
      b.disabled = false;
      if (x.error) return say('p20oMsg', errText(x, 'Couldn’t save it. Try again.'));
      toast('Touch saved.' + (row.follow_up_on ? ' Follow up ' + short(row.follow_up_on) + '.' : ''));
      S.who = ''; S.tpl = ''; S.ch = row.channel; history.replaceState(null, '', '#outreach'); load();
    });
  }};

  // ======================================================================
  // O4  #proposals
  // ======================================================================
  const propBlocks = p => {
    const m = monthly(p.rate, p.hours_week), scope = String(p.scope || '').split('\n').map(s => s.trim()).filter(Boolean);
    return [{ small:'Proposal P-' + p.number + ' · ' + longDay(isoDay(new Date(p.created_at || Date.now()))) }, { h1:plain(p.title) }, { p:'Prepared for ' + plain(p.client_name) + (p.contact_name ? ', attention ' + plain(p.contact_name) : '') + '. Prepared by Amr Abdelgawad, amrabdelgawad.site.' }, { rule:true },
      ...(p.intro ? [{ p:plain(p.intro) }] : []),
      { h2:'What I’ll do' }, ...scope.map(s => ({ p:'•  ' + plain(s), indent:6 })),
      { h2:'Hours and price' }, { row:['Hours a week', (+p.hours_week || 0) + ' hours'] }, { row:['Rate', usd(p.rate) + ' an hour'] }, { row:['About a month', usd(m)], bold:true },
      ...(p.start_on ? [{ row:['Can start', longDay(p.start_on)] }] : []), ...(p.valid_until ? [{ row:['This offer is good until', longDay(p.valid_until)] }] : []),
      ...(p.terms ? [{ h2:'Terms' }, ...String(p.terms).split('\n').filter(s => s.trim()).map(s => ({ p:plain(s) }))] : []),
      { gap:14 }, { p:'To go ahead, reply to this proposal or call me. Thank you for considering it.' }];
  };
  const propText = p => propBlocks(p).map(b => b.h1 || b.h2 ? '\n' + (b.h1 || b.h2).toUpperCase() : b.p ? b.p : b.small ? b.small : b.row ? b.row.join(': ') : '').filter(s => s !== '').join('\n').trim();
  V.proposals = { title:'Proposals', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Clients', 'Proposals', 'Filled in from the client or lead and your service package. Print it, download the PDF, or save it to Files. Nothing is sent from the portal: you attach or paste it yourself.');
    const parts = hashParts();
    const S = { open:parts[1] && parts[1] !== 'new' ? +parts[1] : null, draft:null, pkgEdit:null };
    let P = [], C = [], L = [], K = [];
    async function load(){
      const [p, c, l, k] = await Promise.all([safe(db().from('client_proposals').select('*').order('created_at', { ascending:false })), loadClients(), loadLeads(), safe(db().from('client_packages').select('*').order('sort').order('id'))]);
      if (!ok()) return;
      if (p.error) { body.innerHTML = failed(p.error); return; }
      P = p.data || []; C = c.list || []; L = l.data || []; K = k.data || [];
      if (parts[1] === 'new' && !S.draft && !S.open) S.draft = fresh(parts[2], +parts[3]);
      draw();
    }
    function fresh(kind, id){
      const k = K.find(x => x.active) || {}, src = kind === 'l' ? L.find(x => x.id === id) : kind === 'c' ? C.find(x => x.id === id) : null;
      const rate = src ? (kind === 'l' ? src.rate : src.bill_rate) : null, hrs = src && src.hours_week != null ? src.hours_week : k.hours_week;
      const nm = src ? src.name : '', ct = src ? src.contact_name : '';
      return { number:P.reduce((a, x) => Math.max(a, x.number), 1000) + 1, company_id:kind === 'c' ? id : (src && src.company_id) || null, lead_id:kind === 'l' ? id : null, package_id:k.id || null,
        client_name:nm, contact_name:ct || '', title:(k.name || 'Calling support') + (nm ? ' for ' + nm : ''),
        intro:(ct ? 'Hi ' + first(ct) + ',\n\n' : '') + 'Thank you for your time. Here is what I would do' + (nm ? ' for ' + nm : '') + ', what it costs and how we can start.',
        scope:k.scope || '', hours_week:hrs != null ? hrs : 20, rate:rate != null ? rate : (k.rate != null ? k.rate : ''), start_on:addDays(nyDay(), 7), valid_until:addDays(nyDay(), 14), terms:k.terms || '', status:'draft' };
    }
    function form(p){
      return '<form class="px-form r20-row p20-form" id="p20PForm" data-id="' + (p.id || '') + '" novalidate>' +
        f('For', '<select id="p20pFor">' + opt('', 'Type a name below') + '<optgroup label="Clients">' + C.map(c => opt('c:' + c.id, c.name, p.company_id === c.id && !p.lead_id)).join('') + '</optgroup>' +
          '<optgroup label="Leads">' + L.filter(l => l.stage !== 'lost').map(l => opt('l:' + l.id, l.name, p.lead_id === l.id)).join('') + '</optgroup></select>') +
        f('Package', '<select id="p20pPkg">' + opt('', '–') + K.map(k => opt(k.id, k.name, p.package_id === k.id)).join('') + '</select>') +
        f('Client name on the proposal', '<input type="text" id="p20pClient" maxlength="120" value="' + esc(p.client_name || '') + '">') +
        f('Contact name', '<input type="text" id="p20pContact" maxlength="120" value="' + esc(p.contact_name || '') + '">') +
        f('Title', '<input type="text" id="p20pTitle" maxlength="160" value="' + esc(p.title || '') + '">', 'px-wide') +
        f('Opening', '<textarea id="p20pIntro" rows="3" maxlength="3000">' + esc(p.intro || '') + '</textarea>', 'px-wide') +
        f('What you’ll do (one line each)', '<textarea id="p20pScope" rows="5" maxlength="4000">' + esc(p.scope || '') + '</textarea>', 'px-wide') +
        f('Hours a week', '<input type="number" id="p20pHours" min="0" step="0.5" value="' + esc(p.hours_week) + '">') +
        f('Rate (USD/h)', '<input type="number" id="p20pRate" min="0" step="0.01" value="' + esc(p.rate) + '">') +
        f('Can start', '<input type="date" id="p20pStart" value="' + esc(p.start_on || '') + '">') +
        f('Good until', '<input type="date" id="p20pValid" value="' + esc(p.valid_until || '') + '">') +
        f('Terms (one line each)', '<textarea id="p20pTerms" rows="3" maxlength="2000">' + esc(p.terms || '') + '</textarea>', 'px-wide') +
        f('Status', '<select id="p20pStatus">' + Object.keys(PST).map(k => opt(k, PST[k][0], p.status === k)).join('') + '</select>') +
        '<p class="p-hint px-wide" id="p20pMonthly">About ' + usd(monthly(p.rate, p.hours_week)) + ' a month (rate × hours × 52 ÷ 12).</p>' +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save proposal</button><button type="button" class="p-btn is-ghost" data-p20px>Close</button><span class="p-hint" id="p20pMsg" role="status"></span></div></form>';
    }
    const read = () => ({ client_name:val('p20pClient'), contact_name:val('p20pContact') || null, title:val('p20pTitle'), intro:val('p20pIntro') || null, scope:val('p20pScope') || null,
      hours_week:numOrNull('p20pHours'), rate:numOrNull('p20pRate'), start_on:val('p20pStart') || null, valid_until:val('p20pValid') || null, terms:val('p20pTerms') || null, status:val('p20pStatus') || 'draft',
      package_id:+val('p20pPkg') || null });
    function paper(p){
      return '<article class="p-card p20-paper" id="p20Paper">' + propBlocks(p).map(b => b.small ? '<p class="p20-small">' + esc(b.small) + '</p>' : b.h1 ? '<h2>' + esc(b.h1) + '</h2>' : b.h2 ? '<h3>' + esc(b.h2) + '</h3>' :
        b.rule ? '<hr>' : b.row ? '<p class="p20-row' + (b.bold ? ' b' : '') + '"><span>' + esc(b.row[0]) + '</span><span>' + esc(b.row[1]) + '</span></p>' : b.gap ? '' : String(b.p).split(/\n+/).map(x => '<p>' + esc(x) + '</p>').join('')).join('') +
        '<div class="px-tools px-noprint"><button type="button" class="p-btn" data-p20ppdf="save">Save PDF to Files</button><button type="button" class="p-btn is-ghost" data-p20ppdf="dl">Download PDF</button>' +
        '<button type="button" class="p-btn is-ghost" id="p20pPrint">Print</button><button type="button" class="p-btn is-ghost" id="p20pCopy">Copy as text</button>' +
        (p.pdf_path ? '<span class="p-hint">Saved in Files › mine/clients/proposals</span>' : '') + '<span class="p-hint" id="p20pDoc" role="status"></span></div></article>';
    }
    function draw(){
      const p = S.draft || (S.open && P.find(x => x.id === S.open));
      body.innerHTML =
        '<div class="px-tools"><button type="button" class="p-btn" id="p20pNew">+ New proposal</button></div>' +
        (p ? card(p.id ? 'Proposal P-' + p.number : 'New proposal P-' + p.number, p.id ? pill(PST[p.status][0], PST[p.status][1]) : '', form(p)) + (p.id ? paper(p) : '<p class="p-hint">Save it to see the finished proposal and make the PDF.</p>') : '') +
        card('Proposals', plural(P.length, 'proposal'), P.length ? table(['#', 'For', 'Title', 'A month', 'Status', 'PDF', ''], P.map(x => tr(['P-' + x.number, esc(x.client_name), esc(x.title), usd(monthly(x.rate, x.hours_week)),
          pill(PST[x.status][0], PST[x.status][1]), x.pdf_path ? pill('In Files', 'ok') : '–', '<a class="p-btn is-ghost" href="#proposals/' + x.id + '">Open</a>']))) : empty('No proposals yet.')) +
        card('Your service package', 'fills new proposals', K.map(k => S.pkgEdit === k.id ? pkgForm(k) : '<div class="r20-rule"><div class="r20-rl"><b>' + esc(k.name) + '</b>' + (k.active ? '' : ' ' + pill('Off', 'plain')) +
          '<small>' + usd(k.rate) + ' an hour · ' + esc(k.hours_week) + ' hours a week · about ' + usd(monthly(k.rate, k.hours_week)) + ' a month</small><small class="px-pre">' + esc(k.scope || '') + '</small></div>' +
          '<div class="r20-rc"><button type="button" class="p-btn is-ghost" data-p20kedit="' + k.id + '">Edit</button></div></div>').join('') +
          (S.pkgEdit === 'new' ? pkgForm({ active:true }) : '<div class="px-tools"><button type="button" class="p-btn is-ghost" data-p20kedit="new">+ Add a package</button></div>'));
    }
    function pkgForm(k){
      return '<form class="px-form r20-row" id="p20KForm" data-id="' + (k.id || '') + '" novalidate>' + f('Package name', '<input type="text" id="p20kName" maxlength="100" value="' + esc(k.name || '') + '">') +
        f('Rate (USD/h)', '<input type="number" id="p20kRate" min="0" step="0.01" value="' + esc(k.rate == null ? '' : k.rate) + '">') + f('Hours a week', '<input type="number" id="p20kHours" min="0" step="0.5" value="' + esc(k.hours_week == null ? '' : k.hours_week) + '">') +
        f('In use', '<select id="p20kAct">' + opt('1', 'Yes', k.active !== false) + opt('', 'No', k.active === false) + '</select>') +
        f('Scope (one line each)', '<textarea id="p20kScope" rows="5" maxlength="4000">' + esc(k.scope || '') + '</textarea>', 'px-wide') + f('Terms (one line each)', '<textarea id="p20kTerms" rows="3" maxlength="2000">' + esc(k.terms || '') + '</textarea>', 'px-wide') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save package</button><button type="button" class="p-btn is-ghost" data-p20kx>Cancel</button><span class="p-hint" id="p20kMsg" role="status"></span></div></form>';
    }
    async function pdf(mode, b){
      const p = P.find(x => x.id === S.open); if (!p) return;
      const blob = P20Pdf.build(propBlocks(p)), name = 'Proposal P-' + p.number + ' ' + p.client_name + '.pdf';
      if (mode === 'dl') { P20Pdf.download(blob, name); return; }
      b.disabled = true; say('p20pDoc', 'Saving…');
      const r = await P20Pdf.save(blob, 'proposals', name); b.disabled = false;
      if (r.error) { say('p20pDoc', errText(r, 'Couldn’t save it to Files.')); return; }
      await safe(db().from('client_proposals').update({ pdf_path:r.path }).eq('id', p.id));
      p.pdf_path = r.path; say('p20pDoc', 'Saved to Files.'); toast('Saved in Files › mine/clients/proposals.');
    }
    await load();
    body.addEventListener('input', e => { if (e.target.id === 'p20pRate' || e.target.id === 'p20pHours') { const m = $('p20pMonthly'); if (m) m.textContent = 'About ' + usd(monthly(val('p20pRate'), val('p20pHours'))) + ' a month (rate × hours × 52 ÷ 12).'; } });
    body.addEventListener('change', e => {
      if (e.target.id === 'p20pFor' && e.target.value) {
        const [k, id] = e.target.value.split(':'), cur = Object.assign({}, S.draft || P.find(x => x.id === S.open) || {}, read()), nf = fresh(k, +id);
        S.draft = Object.assign(cur, { company_id:nf.company_id, lead_id:nf.lead_id, client_name:nf.client_name, contact_name:nf.contact_name, title:nf.title, intro:nf.intro, rate:nf.rate !== '' ? nf.rate : cur.rate, hours_week:nf.hours_week });
        if (!S.draft.id) S.draft.number = nf.number; draw();
      }
      if (e.target.id === 'p20pPkg') { const k = K.find(x => x.id === +e.target.value); if (k) { $('p20pScope').value = k.scope || ''; $('p20pTerms').value = k.terms || ''; if (k.rate != null && !val('p20pRate')) $('p20pRate').value = k.rate; if (k.hours_week != null) $('p20pHours').value = k.hours_week; } }
    });
    body.addEventListener('click', e => {
      if (e.target.id === 'p20pNew') { S.open = null; S.draft = fresh(); history.replaceState(null, '', '#proposals/new'); draw(); return; }
      if (e.target.closest('[data-p20px]')) { S.open = null; S.draft = null; history.replaceState(null, '', '#proposals'); draw(); return; }
      const pd = e.target.closest('[data-p20ppdf]'); if (pd) { pdf(pd.dataset.p20ppdf, pd); return; }
      if (e.target.id === 'p20pPrint') { document.body.classList.add('px-printing', 'p20-printing'); window.print(); setTimeout(() => document.body.classList.remove('px-printing', 'p20-printing'), 500); return; }
      if (e.target.id === 'p20pCopy') { const p = P.find(x => x.id === S.open); if (p) copy(propText(p), 'p20pDoc'); return; }
      const ke = e.target.closest('[data-p20kedit]'); if (ke) { S.pkgEdit = ke.dataset.p20kedit === 'new' ? 'new' : +ke.dataset.p20kedit; draw(); return; }
      if (e.target.closest('[data-p20kx]')) { S.pkgEdit = null; draw(); }
    });
    body.addEventListener('submit', async e => {
      e.preventDefault();
      if (e.target.id === 'p20KForm') {
        const id = +e.target.dataset.id || null, row = { name:val('p20kName'), rate:numOrNull('p20kRate'), hours_week:numOrNull('p20kHours'), active:!!val('p20kAct'), scope:val('p20kScope') || null, terms:val('p20kTerms') || null };
        if (!row.name) return say('p20kMsg', 'Name the package.');
        const x = id ? await safe(db().from('client_packages').update(row).eq('id', id)) : await safe(db().from('client_packages').insert(row));
        if (x.error) return say('p20kMsg', errText(x, 'Couldn’t save it.'));
        S.pkgEdit = null; load(); return;
      }
      if (e.target.id !== 'p20PForm') return;
      const id = +e.target.dataset.id || null, cur = S.draft || P.find(x => x.id === id) || {}, row = read();
      if (!row.client_name) return say('p20pMsg', 'Type who it’s for.');
      if (!row.title) return say('p20pMsg', 'Give it a title.');
      row.company_id = cur.company_id || null; row.lead_id = cur.lead_id || null; row.updated_at = new Date().toISOString();
      let x;
      if (id) x = await safe(db().from('client_proposals').update(row).eq('id', id).select('id').single());
      else { row.number = cur.number; x = await safe(db().from('client_proposals').insert(row).select('id').single()); }
      if (x.error) return say('p20pMsg', errText(x, 'Couldn’t save it. Try again.'));
      // a proposal marked sent moves its lead to "Proposal sent" on the pipeline
      if (row.status === 'sent' && row.lead_id) await safe(db().from('client_leads').update({ stage:'proposal', stage_at:new Date().toISOString() }).eq('id', row.lead_id).in('stage', ['new', 'contacted', 'talking']));
      S.draft = null; S.open = x.data.id; history.replaceState(null, '', '#proposals/' + S.open); toast('Proposal saved.'); load();
    });
  }};

  // ======================================================================
  // F1  #invoices (replaces the Round 13 page in numbers-plus.js)
  // ======================================================================
  V.invoices = { title:'Client invoices', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Money', 'Client invoices', 'Build an invoice from a client’s hours on Hours vs billing, then print it or save the PDF to Files. Mark it sent, and record each payment with its date and amount. Payments go into Cash as income, and Hours vs billing reads them. Payments themselves happen outside the portal.');
    const parts = hashParts();
    const S = { open:parts[1] && parts[1] !== 'new' ? +parts[1] : null, pre:parts[1] === 'new' ? { co:+parts[2] || null, from:parts[3] || '', to:parts[4] || '' } : null, act:null, filter:'' };
    let I = [], C = [], PAY = [];
    async function load(){
      const [i, c, p] = await Promise.all([safe(db().from('invoices').select('*').order('number', { ascending:false }).limit(300)), loadClients(), safe(db().from('invoice_payments').select('*').order('paid_on'))]);
      if (!ok()) return;
      if (i.error) { body.innerHTML = failed(i.error); return; }
      I = i.data || []; C = c.list || []; PAY = p.data || []; draw();
      if (S.open) showDoc(S.open);
    }
    const coName = id => (C.find(c => c.id === id) || {}).name || 'Client';
    function draw(){
      const d = new Date(), lastStart = isoDay(new Date(d.getFullYear(), d.getMonth() - 1, 1)), lastEnd = isoDay(new Date(d.getFullYear(), d.getMonth(), 0));
      const pre = S.pre || {}, out = I.filter(i => i.status === 'sent' || i.status === 'part'), t = nyDay();
      const owed = out.reduce((a, i) => a + (+i.amount - +i.amount_paid), 0), late = out.filter(i => i.due_on && i.due_on < t);
      const rows = I.filter(i => !S.filter || i.status === S.filter || (S.filter === 'open' && ['draft', 'sent', 'part'].includes(i.status)));
      body.innerHTML =
        tiles([tile(usd(owed), 'sent and not paid yet', plural(out.length, 'invoice'), owed > 0), tile(late.length, 'past their due date', late.map(i => '#' + i.number).join(', '), late.length > 0),
          tile(usd(PAY.filter(p => p.paid_on.slice(0, 7) === t.slice(0, 7)).reduce((a, p) => a + +p.amount, 0)), 'paid this month')]) +
        card('New invoice', '<a href="#billing">Hours vs billing</a>', '<form class="px-form r20-row" id="p20IForm" novalidate>' +
          f('Client', '<select id="p20iCo">' + C.filter(c => c.status !== 'past' || c.id === pre.co).concat(C.filter(c => c.status === 'past' && c.id !== pre.co)).map(c => opt(c.id, c.name + (c.bill_rate ? ' · $' + c.bill_rate + '/h' : '') + (c.status === 'past' ? ' (past)' : ''), c.id === pre.co)).join('') + '</select>') +
          f('From', '<input type="date" id="p20iFrom" value="' + esc(pre.from || lastStart) + '">') + f('To', '<input type="date" id="p20iTo" value="' + esc(pre.to || lastEnd) + '">') +
          f('Due', '<input type="date" id="p20iDue" value="' + addDays(t, 7) + '">') +
          f('Note on the invoice (optional)', '<input type="text" id="p20iNote" maxlength="300" placeholder="e.g. Payment by bank transfer within 7 days">', 'px-wide') +
          '<div class="px-tools px-wide"><button class="p-btn is-ghost" type="button" id="p20iPrev">Preview</button><button class="p-btn" type="submit">Create invoice</button><span class="p-hint" id="p20iMsg" role="status"></span></div><div id="p20iOut" class="px-wide"></div></form>') +
        card('Invoices', '<select id="p20iF" aria-label="Show">' + [['', 'All'], ['open', 'Not paid'], ['draft', 'Drafts'], ['sent', 'Sent'], ['part', 'Part paid'], ['paid', 'Paid']].map(([k, v]) => opt(k, v, S.filter === k)).join('') + '</select>',
          rows.length ? table(['#', 'Client', 'Dates', 'Hours', 'Amount', 'Paid', 'Status', ''], rows.map(i => tr(['<b>' + i.number + '</b>', '<a href="#clients/' + i.company_id + '">' + esc(coName(i.company_id)) + '</a>',
            esc(short(i.period_start) + ' to ' + day(i.period_end)), esc(i.hours), '<b>' + usd(i.amount) + '</b>', usd(i.amount_paid),
            pill(IST[i.status][0], IST[i.status][1]) + (i.paid_on ? ' <small>' + esc(short(i.paid_on)) + '</small>' : i.due_on && i.status !== 'paid' ? ' <small' + (i.due_on < t && i.status !== 'draft' ? ' class="p20-due"' : '') + '>due ' + esc(short(i.due_on)) + '</small>' : ''),
            '<button type="button" class="p-btn is-ghost" data-p20iv="' + i.id + '">Open</button>']))) : empty('No invoices here yet.')) +
        '<div id="p20iDoc"></div>';
    }
    async function preview(){
      const x = await safe(db().rpc('portal_invoice_preview', { p_company:+val('p20iCo'), p_from:val('p20iFrom'), p_to:val('p20iTo') }));
      if (x.error) { say('p20iMsg', errText(x, 'Couldn’t work it out. Try again.')); return null; }
      const p = x.data || { hours:0, amount:0, people:[] };
      const clash = I.filter(i => i.company_id === +val('p20iCo') && i.period_start <= val('p20iTo') && i.period_end >= val('p20iFrom'));
      $('p20iOut').innerHTML = tiles([tile(p.hours, 'hours'), tile(usd(p.amount), 'amount'), tile(p.shifts || 0, 'shifts')]) + (p.people.length ? table(['Person', 'Hours', 'Amount'], p.people.map(q => tr([esc(q.name), q.hours, usd(q.amount)]))) : '') +
        (clash.length ? '<p class="p-card px-warn">Invoice ' + clash.map(i => '#' + i.number).join(', ') + ' already covers some of these dates. Those hours would be billed twice.</p>' : '');
      return p;
    }
    const lines = (inv, people) => [{ small:'amrabdelgawad.site' }, { h1:'Invoice #' + inv.number }, { row:['Date', longDay(isoDay(new Date(inv.created_at)))] }, ...(inv.due_on ? [{ row:['Due', longDay(inv.due_on)] }] : []),
      { row:['From', 'Amr Abdelgawad'] }, { row:['Bill to', coName(inv.company_id)] }, { row:['Period', longDay(inv.period_start) + ' to ' + longDay(inv.period_end)] }, { rule:true },
      { row:['Team member', 'Hours', 'Amount'], bold:true, right:true }, ...(people || []).map(q => ({ row:[q.name, String(q.hours), usd(q.amount)], right:true })), { rule:true },
      { row:['Total', String(inv.hours), usd(inv.amount)], bold:true, right:true },
      ...(+inv.amount_paid ? [{ row:['Paid', '', usd(inv.amount_paid)], right:true }, { row:['Left to pay', '', usd(+inv.amount - +inv.amount_paid)], bold:true, right:true }] : []),
      ...(inv.note ? [{ gap:10 }, { p:plain(inv.note) }] : []), { gap:10 }, { small:'Thank you for your business.' }];
    async function showDoc(id){
      const inv = I.find(i => i.id === id), box = $('p20iDoc'); if (!inv || !box) return;
      S.open = id;
      const pp = (await safe(db().rpc('portal_invoice_preview', { p_company:inv.company_id, p_from:inv.period_start, p_to:inv.period_end }))).data || { people:[] };
      if (!ok()) return;
      inv._people = pp.people || [];
      const pays = PAY.filter(p => p.invoice_id === id), left = Math.max(0, +inv.amount - +inv.amount_paid), t = nyDay();
      box.innerHTML = '<section class="p-card np-invoice p20-paper" id="p20iPaper">' + lines(inv, inv._people).map(b => b.small ? '<p class="p20-small">' + esc(b.small) + '</p>' : b.h1 ? '<h2>' + esc(b.h1) + '</h2>' : b.rule ? '<hr>' :
          b.row ? '<p class="p20-row' + (b.bold ? ' b' : '') + (b.row.length === 3 ? ' three' : '') + '">' + b.row.map(c => '<span>' + esc(c) + '</span>').join('') + '</p>' : b.gap ? '' : '<p>' + esc(b.p) + '</p>').join('') +
        '<div class="px-noprint p20-acts"><div class="px-tools"><button type="button" class="p-btn" data-p20ipdf="save">Save PDF to Files</button><button type="button" class="p-btn is-ghost" data-p20ipdf="dl">Download PDF</button><button type="button" class="p-btn is-ghost" id="p20iPrint">Print</button>' +
          (inv.pdf_path ? '<span class="p-hint">Saved in Files › mine/clients/invoices</span>' : '') + '<span class="p-hint" id="p20iDocMsg" role="status"></span></div>' +
        '<h3 class="r20-h">Sent</h3>' + (inv.sent_on ? '<p>Marked sent ' + esc(day(inv.sent_on)) + '.</p>' : '<form class="px-form r20-row" id="p20iSent" novalidate>' + f('Sent on', '<input type="date" id="p20iSentOn" value="' + t + '">') + '<div class="px-tools"><button type="submit" class="p-btn is-ghost">Mark sent</button></div></form>') +
        '<h3 class="r20-h">Payments</h3>' + (pays.length ? table(['Paid on', 'Amount', 'How', 'Reference', ''], pays.map(p => tr([esc(day(p.paid_on)), '<b>' + usd(p.amount) + '</b>', esc(p.method || '–'), esc(p.reference || '–'), '<button type="button" class="p-btn is-ghost" data-p20unpay="' + p.id + '">Undo</button>']))) : empty('No payments recorded.')) +
        (left > 0.004 ? '<form class="px-form r20-row" id="p20iPay" novalidate>' + f('Paid on', '<input type="date" id="p20iPayOn" value="' + t + '">') + f('Amount (USD)', '<input type="number" id="p20iPayAmt" min="0.01" step="0.01" value="' + left.toFixed(2) + '">') +
          f('How (optional)', '<input type="text" id="p20iPayHow" maxlength="40" list="p20iHows" placeholder="e.g. Bank transfer"><datalist id="p20iHows"><option value="Bank transfer"><option value="PayPal"><option value="Wise"><option value="Payoneer"><option value="Upwork"></datalist>') +
          f('Reference (optional)', '<input type="text" id="p20iPayRef" maxlength="120">') +
          '<div class="px-tools px-wide"><button type="submit" class="p-btn">Record payment</button><span class="p-hint">Adds it to Cash as income. Part payments are fine.</span></div></form>' : '<p>' + pill('Paid in full', 'ok') + '</p>') +
        '<p class="p-hint" id="p20iPayMsg" role="status"></p></div></section>';
      $('p20iPaper').scrollIntoView({ behavior:'smooth', block:'start' });
    }
    await load();
    body.addEventListener('change', e => { if (e.target.id === 'p20iF') { S.filter = e.target.value; draw(); if (S.open) showDoc(S.open); } });
    body.addEventListener('click', async e => {
      if (e.target.id === 'p20iPrev') { preview(); return; }
      const v = e.target.closest('[data-p20iv]'); if (v) { history.replaceState(null, '', '#invoices/' + v.dataset.p20iv); showDoc(+v.dataset.p20iv); return; }
      if (e.target.id === 'p20iPrint') { document.body.classList.add('px-printing', 'p20-printing'); window.print(); setTimeout(() => document.body.classList.remove('px-printing', 'p20-printing'), 500); return; }
      const pd = e.target.closest('[data-p20ipdf]');
      if (pd) { const inv = I.find(i => i.id === S.open); if (!inv) return; const blob = P20Pdf.build(lines(inv, inv._people)), name = 'Invoice ' + inv.number + ' ' + coName(inv.company_id) + '.pdf';
        if (pd.dataset.p20ipdf === 'dl') { P20Pdf.download(blob, name); return; }
        pd.disabled = true; const r = await P20Pdf.save(blob, 'invoices', name); pd.disabled = false;
        if (r.error) { say('p20iDocMsg', errText(r, 'Couldn’t save it to Files.')); return; }
        await safe(db().from('invoices').update({ pdf_path:r.path }).eq('id', inv.id)); inv.pdf_path = r.path; say('p20iDocMsg', 'Saved to Files.'); toast('Saved in Files › mine/clients/invoices.'); return; }
      const up = e.target.closest('[data-p20unpay]');
      if (up) { if (!sure(up, 'Sure? Takes it out of Cash too', 'Undo')) return; up.disabled = true; const x = await safe(db().rpc('invoice_unpay', { p_payment:+up.dataset.p20unpay })); if (x.error) { say('p20iPayMsg', errText(x, 'Couldn’t undo it.')); up.disabled = false; return; } toast('Payment taken off.'); load(); }
    });
    body.addEventListener('submit', async e => {
      e.preventDefault();
      if (e.target.id === 'p20IForm') {
        const p = await preview(); if (!p) return;
        if (!(+p.amount > 0)) return say('p20iMsg', 'No billable hours in those dates.');
        const n = I.reduce((m, i) => Math.max(m, i.number), 1000) + 1;
        const x = await safe(db().from('invoices').insert({ company_id:+val('p20iCo'), number:n, period_start:val('p20iFrom'), period_end:val('p20iTo'), hours:p.hours, amount:p.amount, due_on:val('p20iDue') || null, note:val('p20iNote') || null }).select('id').single());
        if (x.error) return say('p20iMsg', errText(x, 'Couldn’t create it. Try again.'));
        S.pre = null; S.open = x.data.id; history.replaceState(null, '', '#invoices/' + S.open); toast('Invoice #' + n + ' created.'); load(); return;
      }
      if (e.target.id === 'p20iSent') {
        const x = await safe(db().from('invoices').update({ status:'sent', sent_on:val('p20iSentOn') || nyDay() }).eq('id', S.open).eq('status', 'draft'));
        if (x.error) return say('p20iPayMsg', errText(x, 'Couldn’t save it.'));
        toast('Marked sent.'); load(); return;
      }
      if (e.target.id === 'p20iPay') {
        const b = e.target.querySelector('[type=submit]'); b.disabled = true;
        const x = await safe(db().rpc('invoice_pay', { p_invoice:S.open, p_paid_on:val('p20iPayOn'), p_amount:+val('p20iPayAmt'), p_method:val('p20iPayHow') || null, p_reference:val('p20iPayRef') || null }));
        b.disabled = false;
        if (x.error) return say('p20iPayMsg', errText(x, 'Couldn’t record it. Try again.'));
        toast(+x.data.left > 0 ? 'Payment recorded. ' + usd(x.data.left) + ' still to pay.' : 'Paid in full.'); load();
      }
    });
  }};

  // ======================================================================
  // F5  #profit (replaces the Nov 9 page in extras-admin.js)
  // ======================================================================
  V.profit = { title:'Profit per client', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Clients', 'Profit per client', 'What each client paid, minus team pay (hourly shifts and commissions on that client’s shifts), minus that client’s costs in Cash. By month and all time, in dollars with pounds beside.');
    const S = { co:'' };
    let D = null, EX = [], C = [];
    async function load(){
      const [r, ex, c] = await Promise.all([safe(db().rpc('client_profit', { p_months:12 })), safe(db().from('cash_entries').select('id,entry_date,title,party,category,amount,currency,fx_rate,company_id').eq('kind', 'expense').eq('personal', false).order('entry_date', { ascending:false }).limit(150)), loadClients()]);
      if (!ok()) return;
      if (r.error || !r.data) { body.innerHTML = failed(r.error); return; }
      D = r.data; EX = ex.data || []; C = c.list || []; draw();
    }
    function draw(){
      const rate = +D.egp_rate || 52, list = D.clients || [], t = nyDay().slice(0, 7);
      const sumAll = k => list.reduce((a, c) => a + +(c.all[k] || 0), 0);
      const thisM = list.reduce((a, c) => a + +(((c.months || []).find(m => String(m.month).slice(0, 7) === t) || {}).profit || 0), 0);
      const months = []; list.forEach(c => (c.months || []).forEach(m => { if (!S.co || +S.co === c.company_id) months.push(Object.assign({ client:c.name }, m)); }));
      months.sort((a, b) => a.month < b.month ? 1 : a.month > b.month ? -1 : a.client < b.client ? -1 : 1);
      const both = n => usd(n) + '<small class="r19-sub">' + egp(n * rate) + '</small>';
      body.innerHTML =
        tiles([tile(usd(sumAll('profit')), 'profit, all time', egp(sumAll('profit') * rate), sumAll('profit') < 0), tile(usd(thisM), 'profit this month', egp(thisM * rate), thisM < 0),
          tile(usd(sumAll('paid')), 'clients paid, all time'), tile(usd(sumAll('team') + sumAll('expenses')), 'team pay and client costs', usd(sumAll('team')) + ' team · ' + usd(sumAll('expenses')) + ' costs')]) +
        card('All time, by client', 'EGP at ' + rate + ' to the dollar', list.length ? table(['Client', 'Hours', 'Client paid', 'Team pay', 'Costs', 'Profit', 'Margin'], list.map(c => tr([
          '<a href="#clients/' + c.company_id + '"><b>' + esc(c.name) + '</b></a>' + (c.status === 'past' ? ' ' + pill('Past', 'plain') : ''), esc(c.all.hours), usd(c.all.paid), usd(c.all.team), usd(c.all.expenses),
          '<b' + (c.all.profit < 0 ? ' class="px-neg"' : '') + '>' + both(c.all.profit) + '</b>', +c.all.paid ? Math.round(c.all.profit / c.all.paid * 100) + '%' : '–']))) : empty('No clients yet.')) +
        card('By month', '<select id="p20fCo" aria-label="Client">' + opt('', 'All clients') + list.map(c => opt(c.company_id, c.name, String(S.co) === String(c.company_id))).join('') + '</select>',
          months.length ? table(['Month', 'Client', 'Hours', 'Should bill', 'Client paid', 'Team pay', 'Costs', 'Profit'], months.map(m => tr([esc(mon(m.month)), esc(m.client), esc(m.hours), usd(m.billed), usd(m.paid), usd(m.team), usd(m.expenses), '<b' + (m.profit < 0 ? ' class="px-neg"' : '') + '>' + both(m.profit) + '</b>']))) : empty('Nothing in the last 12 months.')) +
        card('Client costs in Cash', 'pick the client a business expense was for', EX.length ? '<div class="p20-exp">' + EX.slice(0, 40).map(x => '<div class="tp-doc"><span class="tp-row-t"><b>' + esc(x.title) + '</b><small>' + esc([day(x.entry_date), x.category, x.party].filter(Boolean).join(' · ')) + '</small></span>' +
          '<b class="np-amt">' + (x.currency === 'EGP' ? egp(x.amount) : usd(x.amount)) + '</b><select data-p20exp="' + x.id + '" aria-label="Client for ' + esc(x.title) + '">' + opt('', 'Not for a client') + C.map(c => opt(c.id, c.name, x.company_id === c.id)).join('') + '</select></div>').join('') + '</div>' : empty('No business expenses in Cash yet.')) +
        '<p class="p-hint">Client paid counts payments recorded on invoices (by the date paid) and shifts marked paid before invoices existed. Team pay counts hourly pay on each shift and commissions tied to that client’s shifts; deal commissions and pay bonuses aren’t tied to a client, so they stay out. Costs are business expenses in Cash you pick a client for, above.</p>';
    }
    await load();
    body.addEventListener('change', async e => {
      if (e.target.id === 'p20fCo') { S.co = e.target.value; draw(); return; }
      const s = e.target.closest('[data-p20exp]');
      if (s) { s.disabled = true; const x = await safe(db().from('cash_entries').update({ company_id:+s.value || null }).eq('id', +s.dataset.p20exp)); s.disabled = false; if (x.error) { toast('Couldn’t save that. Try again.'); return; } toast('Saved.'); const r = await safe(db().rpc('client_profit', { p_months:12 })); if (r.data) { D = r.data; const y = window.scrollY; EX.find(z => z.id === +s.dataset.p20exp).company_id = +s.value || null; draw(); window.scrollTo(0, y); } }
    });
  }};

  // ======================================================================
  // O6  #clientreport (replaces the Nov 9 page in extras-admin.js): a draft to review, never sent
  // ======================================================================
  const mondayOf = iso => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDay(d); };
  function draftText(d, next){
    const t = d.totals, from = short(d.from), to = short(d.to);
    const out = [];
    out.push('Hi ' + (first(d.contact) || 'there') + ',', '');
    if (+t.shifts) {
      out.push('Here is how the week of ' + from + ' to ' + to + ' went for ' + d.client + '.', '');
      out.push('- Hours on the phones: ' + t.hours, '- Dials: ' + num(t.dials), '- Conversations: ' + num(t.conversations), '- Appointments set: ' + num(t.appointments));
      if (+t.offers) out.push('- Offers made: ' + num(t.offers));
      if (d.reps.length > 1) out.push('', 'By caller:', ...d.reps.map(r => '- ' + first(r.name) + ': ' + r.hours + ' hours, ' + num(r.dials) + ' dials, ' + num(r.appointments) + ' appointments'));
    } else out.push('There were no calling hours for ' + d.client + ' in the week of ' + from + ' to ' + to + '.');
    // reps' end-of-day notes are internal: they stay under "The numbers behind it" for Amr to pick from, not in the draft
    out.push('', 'What’s next:', ...(String(next || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => '- ' + s.replace(/^-\s*/, '')) || []));
    if (!String(next || '').trim()) out.push('- More calling on the same lists next week');
    out.push('', 'Let me know if you’d like anything changed.', '', 'Thanks,', 'Amr');
    return plain(out.join('\n'));
  }
  V.clientreport = { title:'Client report', sec:'owner', async open(el, ok){
    if (ownerOnly(el)) return;
    const body = PX.page(el, 'Clients', 'Weekly client report', 'A draft per client per week, from Shifts and Numbers, in plain words. It is never sent from here: read it, change anything, then copy, download or print it.');
    const r = await loadClients();
    if (!ok()) return;
    const list = (r.list || []).slice().sort((a, b) => (a.status === 'past') - (b.status === 'past') || (a.name < b.name ? -1 : 1));
    if (!list.length) { body.innerHTML = empty('No clients yet.'); return; }
    const hid = +hashParts()[1];
    const S = { co:list.some(c => c.id === hid) ? hid : list[0].id, week:addDays(mondayOf(nyDay()), -7) };
    async function load(){
      const from = S.week, to = addDays(S.week, 6);
      body.innerHTML = '<div class="px-tools px-noprint"><select id="p20rCo" aria-label="Client">' + list.map(c => opt(c.id, c.name + (c.status === 'past' ? ' (past)' : ''), c.id === S.co)).join('') + '</select>' +
        '<input type="date" id="p20rWeek" value="' + from + '" aria-label="Week starting"><span class="p-hint">Week of ' + esc(short(from) + ' to ' + day(to)) + '</span></div><div id="p20rBody">' + PX.loading + '</div>';
      const [x, dr] = await Promise.all([safe(db().rpc('portal_client_report', { p_company:S.co, p_from:from, p_to:to })), safe(db().from('client_report_drafts').select('*').eq('company_id', S.co).eq('week_start', from).maybeSingle())]);
      if (!ok()) return;
      if (x.error || !x.data) { $('p20rBody').innerHTML = failed(x.error); return; }
      const d = x.data, t = d.totals, saved = dr.data;
      const nextDefault = saved && saved.next_steps != null ? saved.next_steps : (d.follow_up_on ? 'Check in with you on ' + longDay(d.follow_up_on) : '');
      const text = saved && saved.body ? saved.body : draftText(d, nextDefault);
      $('p20rBody').innerHTML =
        tiles([tile(t.hours + ' h', 'calling'), tile(num(t.dials), 'dials'), tile(num(t.conversations), 'conversations'), tile(num(t.appointments), 'appointments set')]) +
        card('Draft', saved ? 'saved ' + esc(when(saved.updated_at)) : 'not saved yet',
          f('What’s next (one line each)', '<textarea id="p20rNext" rows="3" maxlength="2000">' + esc(nextDefault) + '</textarea>') +
          '<div class="px-tools"><button type="button" class="p-btn is-ghost" id="p20rRe">Rebuild the draft from the numbers</button></div>' +
          f('The message', '<textarea id="p20rText" class="p20-report" rows="18" maxlength="8000">' + esc(text) + '</textarea>') +
          '<div class="px-tools"><button type="button" class="p-btn" id="p20rSave">Save draft</button><button type="button" class="p-btn is-ghost" id="p20rCopy">Copy</button><button type="button" class="p-btn is-ghost" id="p20rDl">Download PDF</button>' +
            '<button type="button" class="p-btn is-ghost" id="p20rTxt">Download as text</button><span class="p-hint" id="p20rMsg" role="status"></span></div>' +
          '<p class="p-hint">Nothing here sends it. Dashes and “AI” words are kept out; read it once before you paste it.</p>') +
        card('The numbers behind it', '', (d.reps.length ? table(['Rep', 'Shifts', 'Hours', 'Dials', 'Conversations', 'Appointments'], d.reps.map(x => tr([esc(x.name), x.shifts, x.hours, num(x.dials), num(x.conversations), num(x.appointments)]))) : empty('No shifts this week.')) +
          (d.days.length ? table(['Day', 'Hours', 'Dials', 'Conversations', 'Appointments'], d.days.map(x => tr([esc(fmtDay(x.day)), x.hours, num(x.dials), num(x.conversations), num(x.appointments)]))) : '') +
          ((d.touches || []).length ? '<h3 class="r20-h">Your outreach to them this week</h3>' + table(['When', 'How', 'Outcome', 'Note'], d.touches.map(x => tr([esc(when(x.at)), esc(CH[x.channel]), esc(x.outcome || '–'), esc(x.note || '')]))) : '') +
          (d.notes.length ? '<h3 class="r20-h">Reps’ end-of-day notes</h3>' + d.notes.map(n => '<p class="px-pre"><b>' + esc(fmtDay(n.day)) + ', ' + esc(first(n.name)) + ':</b> ' + esc(n.brief) + '</p>').join('') : ''));
      const words = () => plain($('p20rText').value);
      $('p20rRe').addEventListener('click', () => { $('p20rText').value = draftText(d, $('p20rNext').value); say('p20rMsg', 'Rebuilt. Save it to keep it.'); });
      $('p20rSave').addEventListener('click', async () => {
        $('p20rText').value = words();
        const y = await safe(db().from('client_report_drafts').upsert({ company_id:S.co, week_start:from, body:$('p20rText').value, next_steps:$('p20rNext').value.trim(), updated_at:new Date().toISOString() }, { onConflict:'company_id,week_start' }));
        say('p20rMsg', y.error ? errText(y, 'Couldn’t save it.') : 'Saved.');
      });
      $('p20rCopy').addEventListener('click', () => copy(words(), 'p20rMsg'));
      const fname = d.client + ' weekly report ' + from;
      $('p20rTxt').addEventListener('click', () => P20Pdf.download(new Blob([words()], { type:'text/plain' }), fname + '.txt'));
      $('p20rDl').addEventListener('click', () => P20Pdf.download(P20Pdf.build([{ small:'Weekly report · ' + short(from) + ' to ' + day(to) }, { h1:d.client }, { rule:true }, ...words().split('\n').map(s => s.trim() ? { p:s } : { gap:6 })]), fname + '.pdf'));
      $('p20rCo').addEventListener('change', e => { S.co = +e.target.value; history.replaceState(null, '', '#clientreport/' + S.co); load(); });
      $('p20rWeek').addEventListener('change', e => { if (e.target.value) { S.week = mondayOf(e.target.value); load(); } });
    }
    load();
  }};

  // window.P20Clients.summary() → small numbers for other pages (Cash card reads client_profit itself)
  window.P20Clients = { STAGES, CH };
})();
