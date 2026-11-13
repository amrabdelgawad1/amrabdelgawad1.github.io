// Round 14 (handoff R14), part 1: deals paperwork and team tools.
//   #contracts   Contracts by state: state sheets, templates (text and Word files), a step-by-step walkthrough, and a
//                filled copy: a filled Word file to download, or the text template to print
//   Messages     saved replies (everyone keeps their own; Amr can share his with the team)
//   Tasks        checklist templates (Amr): "New client", "New hire", "Month end"; starting one makes the tasks
//   Schedule     shift swaps: a rep gives away or swaps a shift, another rep takes it, Amr approves
// Database: portal-backups docs/sql/2026-11-12-round14-r5-*.sql (contract_templates, contract_states,
// and talents-database 20261113130000_contract_files.sql for contract_files and the bucket contract-files,
// portal_saved_replies, portal_checklists + portal_checklist_start, shift_swaps + portal_swap_*).
// Buyers and deal files stay in the Deal CRM (encrypted with the team passphrase), so they are not repeated here.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, fmtTime, plural, card, empty, failed, pill, f, opt, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db, uid = () => (T().user || {}).id;
  const today = () => isoDay(new Date());

  // ======================================================================
  // Contracts by state
  // ======================================================================
  // Every {word} in a template becomes a box on the fill form. Labels and hints for the common ones:
  const FIELDS = {
    today:['Date', 'date'], seller_name:['Seller name(s)'], buyer_name:['Your company (buyer)'], property_address:['Property address or location'],
    county:['County'], state:['State (2 letters)'], parcel_id:['Parcel number (APN)'], legal_description:['Legal description (or "see Exhibit A")'],
    price:['Price', 'money'], earnest_money:['Earnest money', 'money'], em_days:['Days to deposit earnest money', 'num'], inspection_days:['Inspection period (days)', 'num'],
    closing_date:['Closing on or before', 'date'], title_company:['Title company'], deed_type:['Deed type'], other_terms:['Other terms (or "None")', 'long'],
    assignee_name:['End buyer (assignee)'], assignment_fee:['Assignment fee', 'money'], assignee_deposit:['End buyer deposit', 'money'], contract_date:['Date of the purchase agreement', 'date'],
    down_payment:['Down payment', 'money'], financed_amount:['Amount financed', 'money'], interest_rate:['Interest rate (% a year)', 'num'], monthly_payment:['Monthly payment', 'money'],
    payment_day:['Payment day of the month (e.g. 1st)'], first_payment:['First payment date', 'date'], term_months:['Term (months)', 'num'], balloon_date:['Balance due by', 'date'], late_fee:['Late fee', 'money'],
    seller_net:['Owner’s net at closing', 'money'], repairs:['Repairs you will make', 'long'], list_price:['List price', 'money'], marketing_days:['Days to find a buyer', 'num'],
    lender_name:['Lender'], repair_budget:['Repair budget', 'money'], arv:['After-repair value', 'money'], loan_amount:['Loan amount', 'money'], ltv:['Loan to cost / value'],
    points:['Points', 'num'], extension:['Extension (e.g. 3 months)'], extension_fee:['Extension fee'], exit_plan:['Exit plan (sell, rent, refinance)', 'long'],
    state_rule:['State rule line (filled from the state sheet)', 'long']
  };
  const keysOf = body => [...new Set((body.match(/\{([a-z_]+)\}/g) || []).map(x => x.slice(1, -1)))];
  const money = v => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return String(v).trim() && isFinite(n) ? '$' + n.toLocaleString('en-US', { minimumFractionDigits:n % 1 ? 2 : 0, maximumFractionDigits:2 }) : v; };
  const FIT = { good:['Good fit', 'ok'], check:['Check first', ''], avoid:['Avoid for now', 'no'] };
  const STEPS = [
    ['The seller says yes', 'Agree the price, closing date and earnest money out loud, then say you will send a simple agreement to sign today. Note the seller’s full legal name(s) exactly as on the deed.'],
    ['Check the state', 'Open the state’s sheet here. Make sure it is a title-company state, see which disclosures the seller must sign, and whether a wholesaling law applies.'],
    ['Pull the details', 'From the county site or the tax bill: owner names on title, parcel number and legal description. If the names don’t match the person you spoke to, stop and find out why before you send anything.'],
    ['Fill the agreement', 'Pick “Cash purchase agreement” (or “Seller finance” if they are carrying the note), fill the boxes, and add the wholesaling disclosure addendum. Read it once top to bottom.'],
    ['Send it to sign', 'Save as PDF and send it through an e-sign app (free plans work for a few a month) or by email for a printed signature. Stay on the phone while they open it if you can.'],
    ['Open title', 'Send the signed agreement to the title company the same day. Ask for the title commitment and the wire or check details for earnest money.'],
    ['Deposit earnest money', 'Send it within the days in the agreement and keep the receipt. Put the inspection deadline and closing date in the Deal CRM.'],
    ['Find the end buyer', 'Use “Buyers who fit” in the Deal CRM. When a buyer commits, fill the Assignment of contract and collect their deposit before you tell anyone else it is sold.'],
    ['Close', 'Title prepares the settlement statement. Check every number against the agreement and the assignment, then sign. Log the closed deal and the commission.']
  ];

  // Nov 13 (round 3): Word files. Amr uploads a .docx per template, for all states or one state; each upload is a new
  // version in contract_files (bucket contract-files) with its own attorney review. "Fill a contract" fills the newest
  // Word file for the template and state in the browser (docx-fill.js) and downloads it. Signature, initials and
  // signing-date boxes ({sign_...}, {initial_...}, anything with "signature") are never filled: they stay blank lines.
  const isSign = k => /^(sign_|initial_)|signature/.test(k);
  // A plain label for any box: the known ones from FIELDS, signature lines by who signs, the rest from the name
  const nice = w => w.replace(/_/g, ' ').trim().replace(/^./, c => c.toUpperCase());
  const labelOf = k => FIELDS[k] ? FIELDS[k][0] : k === 'sign_date' ? 'Date signed' : /^sign_/.test(k) ? 'Signature: ' + nice(k.slice(5)) : /^initial_/.test(k) ? 'Initials: ' + nice(k.slice(8)) : nice(k);
  const SIGN_LINE = '____________________', BLANK = '________';
  const days = d => d ? Math.floor((Date.now() - new Date(d + 'T12:00').getTime()) / 864e5) : null;
  const pickFile = (files, tid, state) => {
    const live = files.filter(x => x.template_id === tid && !x.retired).sort((a, b) => b.version - a.version);
    return live.find(x => state && x.state === state) || live.find(x => !x.state) || null;
  };
  const docCache = new Map();
  async function loadDoc(file){
    if (docCache.has(file.path)) return docCache.get(file.path);
    const r = await db().storage.from('contract-files').download(file.path);
    if (r.error) throw new Error('Couldn’t download the Word file. Check your connection and try again.');
    const d = await window.DocxFill.read(await r.data.arrayBuffer());
    docCache.set(file.path, d); return d;
  }
  const reviewPill = f => f.reviewed_by ? pill('Reviewed by ' + f.reviewed_by + ', ' + fmtDay(f.reviewed_on, { month:'short', day:'numeric', year:'numeric' }), 'ok') : pill('Not reviewed by an attorney', 'no');

  V.contracts = { title:'Contracts', sec:'deals', async open(el, ok){
    const tab = (location.hash.split('/')[1] || 'states');
    const body = PX.page(el, 'Deals', 'Contracts by state', 'Starting templates and one sheet per state, for states with title-company closings and public sold prices. Not legal advice: have an attorney in that state review each template once before you first use it.');
    const [tp, st, cf, rs] = await Promise.all([safe(db().from('contract_templates').select('*').order('sort')), safe(db().from('contract_states').select('*').order('sort').order('name')),
      safe(db().from('contract_files').select('*').order('version', { ascending:false })), safe(db().from('tracker_settings').select('value').eq('key', 'contracts_recheck_days').maybeSingle())]);
    if (!ok()) return;
    if (tp.error || st.error) { body.innerHTML = failed(tp.error || st.error); return; }
    const temps = tp.data || [], states = st.data || [], owner = isOwner(), files = cf.error ? [] : (cf.data || []);
    const recheck = Math.max(1, +((rs.data || {}).value) || 45);
    const tabs = [['states', 'States'], ['templates', 'Templates'], ['steps', 'Step by step'], ['fill', 'Fill a contract']];
    const head = '<div class="p-seg r5-seg" role="tablist" aria-label="Contracts">' + tabs.map(([k, l]) => '<a role="tab" class="wk-seg' + (k === tab ? ' on' : '') + '" aria-selected="' + (k === tab) + '" href="#contracts/' + k + '">' + esc(l) + '</a>').join('') + '</div>';
    if (!states.length || !temps.length) {
      body.innerHTML = head + card('Nothing here yet', '', owner ? '<p class="tp-note">Load the starting set: 6 templates and sheets for 8 states (Michigan, Florida, Colorado, Nevada, Minnesota, Arkansas, plus Indiana and Washington to check) and the states to avoid. You can edit all of it after.</p><button class="p-btn" type="button" id="r5Seed">Load the starting set</button><p class="p-empty" id="r5SeedMsg" role="status"></p>' : empty('Amr hasn’t set up the contracts yet.'));
      const b = $('r5Seed'); if (b) b.addEventListener('click', async () => { b.disabled = true; say('r5SeedMsg', 'Loading…'); const m = await loadStart(); say('r5SeedMsg', m); if (/^Loaded/.test(m)) V.contracts.open(el, ok); else b.disabled = false; });
      return;
    }
    const stale = s => { const n = days((s.sheet || {}).checked_on); return n == null || n > recheck; };
    const sheet = s => { const h = s.sheet || {}, row = (k, v) => v ? '<div class="r5-kv"><b>' + esc(k) + '</b><span>' + esc(v) + '</span></div>' : '', old = stale(s);
      return '<article class="p-card r5-sheet" id="st-' + esc(s.state) + '"><div class="p-card-head"><h2>' + esc(s.name) + ' <small>' + esc(s.state) + '</small></h2><span class="r5-pills">' + (old ? pill('Re-check', 'no') : '') + pill(FIT[s.fit][0], FIT[s.fit][1]) + '</span></div>' +
        row('Who closes', h.closing) + row('Sold prices', h.disclosure) + row('Wholesaling rules', h.wholesaling) + row('Deed', h.deed) +
        ((h.addenda || []).length ? '<div class="r5-kv"><b>Papers to add</b><ul>' + h.addenda.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul></div>' : '') + row('Notes', h.notes) +
        ((h.sources || []).length ? '<div class="r5-kv"><b>Sources</b><ul>' + h.sources.map(x => '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + '</a></li>').join('') + '</ul></div>' : '') +
        '<p class="tp-note">Last checked ' + esc(h.checked_on ? fmtDay(h.checked_on, { month:'short', day:'numeric', year:'numeric' }) : '–') + '. ' +
          (old ? '<b>Older than ' + plural(recheck, 'day') + ': check the sources again before your next deal there.</b>' : 'Laws change: check the sources again before your first deal there.') + '</p>' +
        (owner ? '<button type="button" class="p-btn is-ghost" data-edst="' + esc(s.state) + '">Edit this sheet</button>' : '') + '</article>'; };
    if (tab === 'states') {
      const good = states.filter(s => s.fit !== 'avoid'), bad = states.filter(s => s.fit === 'avoid'), cur = good.find(x => x.state === location.hash.split('/')[2]) || good[0];
      body.innerHTML = head + card('States to work', plural(good.length, 'state'), '<p class="tp-note">Good fit means: a title company closes (no attorney needed), sold prices are public, and no wholesaling law was found when last checked. “Check first” states work but have a rule to follow.</p>' +
        '<div class="r5-chips">' + good.map(s => '<a class="r5-chip is-' + s.fit + (s === cur ? ' on' : '') + (stale(s) ? ' is-old' : '') + '" href="#contracts/states/' + esc(s.state) + '"><b>' + esc(s.state) + '</b>' + esc(s.name) + '</a>').join('') + '</div>' +
        (good.some(stale) ? '<p class="tp-note">A dotted outline means the sheet was last checked more than ' + plural(recheck, 'day') + ' ago.</p>' : '') +
        (owner ? '<div class="wk-row r5-recheck"><label class="sc-f px-inline">Show “Re-check” after<input type="number" id="r5Days" min="1" max="365" step="1" inputmode="numeric" value="' + recheck + '"></label><span>days</span><button type="button" class="p-btn is-ghost" id="r5DaysSave">Save</button><span class="p-empty" id="r5DaysMsg" role="status"></span></div>' : '')) +
        sheet(cur) +
        (bad.length ? card('States to avoid for now', plural(bad.length, 'state'), bad.map(s => '<div class="p-row"><span><b>' + esc(s.name) + '</b><br><small>' + esc((s.sheet || {}).wholesaling || '') + '</small></span>' + pill('Avoid', 'no') + '</div>').join('')) : '');
    } else if (tab === 'templates') {
      const stName = c => c ? ((states.find(s => s.state === c) || {}).name || c) : 'All states';
      const fileRow = x => '<div class="r5-file' + (x.retired ? ' is-retired' : '') + '"><div class="r5-file-main"><b>' + esc(stName(x.state)) + ' · version ' + x.version + '</b><small>' + esc(x.file_name) + ' · ' + plural((x.fields || []).filter(k => !isSign(k)).length, 'box', 'boxes') + ' · added ' + esc(fmtDay(String(x.uploaded_at).slice(0, 10), { month:'short', day:'numeric' })) + '</small>' +
          (x.review_notes ? '<small class="r5-note">' + esc(x.review_notes) + '</small>' : '') + '</div><div class="r5-file-side">' + (x.retired ? pill('Out of use') : reviewPill(x)) +
          '<button type="button" class="p-btn is-ghost" data-fdl="' + esc(x.id) + '">Download</button>' +
          (owner && !x.retired ? '<button type="button" class="p-btn is-ghost" data-frev="' + esc(x.id) + '">' + (x.reviewed_by ? 'Change review' : 'Record review') + '</button><button type="button" class="p-btn is-ghost" data-fret="' + esc(x.id) + '">Take out of use</button>' : '') + '</div></div>';
      const fileBox = t => { const mine = files.filter(x => x.template_id === t.id), live = mine.filter(x => !x.retired), old = mine.filter(x => x.retired);
        return '<div class="r5-files"><h3 class="r5-h3">Word files</h3>' +
          (live.length ? live.map(fileRow).join('') : '<p class="tp-note">No Word file yet. “Fill a contract” uses the text template below until one is added.</p>') +
          (old.length ? '<details class="r5-list"><summary>Out of use (' + old.length + ')</summary>' + old.map(fileRow).join('') + '</details>' : '') +
          (owner ? '<div class="r5-up"><label class="sc-f">For<select data-ust="' + esc(t.id) + '">' + opt('', 'All states') + states.filter(s => s.fit !== 'avoid').map(s => opt(s.state, s.name)).join('') + '</select></label>' +
            '<label class="sc-f">Word file (.docx)<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-ufile="' + esc(t.id) + '"></label>' +
            '<button type="button" class="p-btn" data-up="' + esc(t.id) + '">Add as a new version</button><p class="p-empty r5-upmsg" data-umsg="' + esc(t.id) + '" role="status"></p></div>' : '') + '</div>'; };
      body.innerHTML = head + temps.map(t => '<article class="p-card r5-temp"><div class="p-card-head"><h2>' + esc(t.title) + '</h2><span><a class="p-btn is-ghost" href="#contracts/fill/' + esc(t.id) + '">Fill</a></span></div><p class="tp-note">' + esc(t.about || '') + '</p>' +
        fileBox(t) +
        '<details><summary>Read the text template</summary>' + (owner ? '<textarea class="r5-body" data-tbody="' + esc(t.id) + '" rows="18" maxlength="60000">' + esc(t.body) + '</textarea><div class="wk-row"><button type="button" class="p-btn" data-tsave="' + esc(t.id) + '">Save changes</button><span class="p-empty" data-tmsg="' + esc(t.id) + '" role="status"></span></div>'
          : '<pre class="r5-pre">' + esc(t.body) + '</pre>') + '</details></article>').join('') +
        (owner ? '<p class="tp-note">In a Word file, type each box in curly brackets, like {seller_name} or {Seller Name}. Use {sign_seller}, {initial_seller} or {sign_date} for anything signed by hand: those always stay blank. A new version starts as not reviewed.</p>' : '');
    } else if (tab === 'steps') {
      body.innerHTML = head + card('From “yes” to signed', plural(STEPS.length, 'step'), '<ol class="r5-steps">' + STEPS.map(([h, p]) => '<li><b>' + esc(h) + '</b><p>' + esc(p) + '</p></li>').join('') + '</ol>' +
        '<p class="tp-note">Times to call sellers: 8 AM to 9 PM their time. Michigan is on Eastern time, 7 hours behind Cairo in winter.</p><a class="p-btn" href="#contracts/fill">Fill a contract</a>');
    } else drawFill(body, head, temps, states, files);

    const reopen = () => V.contracts.open(el, ok);
    body.addEventListener('click', async e => {
      const s = e.target.closest('[data-tsave]');
      if (s) { const id = s.dataset.tsave, box = body.querySelector('[data-tbody="' + id + '"]'), m = body.querySelector('[data-tmsg="' + id + '"]');
        s.disabled = true; const x = await safe(db().from('contract_templates').update({ body:box.value, updated_at:new Date().toISOString() }).eq('id', id)); s.disabled = false;
        if (m) m.textContent = x.error ? errText(x, 'Couldn’t save. Try again.') : 'Saved.'; return; }
      const ed = e.target.closest('[data-edst]');
      if (ed) { const s1 = states.find(x => x.state === ed.dataset.edst), art = ed.closest('article');
        art.insertAdjacentHTML('beforeend', '<div class="r5-edit"><label class="sc-f">Fit<select data-k="fit">' + Object.keys(FIT).map(k => opt(k, FIT[k][0], k === s1.fit)).join('') + '</select></label>' +
          '<label class="sc-f">The sheet (edit the text inside the quotes)<textarea data-k="sheet" rows="16">' + esc(JSON.stringify(s1.sheet, null, 2)) + '</textarea></label><div class="wk-row"><button type="button" class="p-btn" data-svst="' + esc(s1.state) + '">Save sheet</button><span class="p-empty" role="status"></span></div></div>');
        ed.remove(); return; }
      const sv = e.target.closest('[data-svst]');
      if (sv) { const box = sv.closest('.r5-edit'), m = box.querySelector('[role=status]'); let sh;
        try { sh = JSON.parse(box.querySelector('[data-k=sheet]').value); } catch (er) { m.textContent = 'The sheet has a typo (a missing quote or comma). Check the last thing you changed.'; return; }
        const x = await safe(db().from('contract_states').update({ fit:box.querySelector('[data-k=fit]').value, sheet:sh, updated_at:new Date().toISOString() }).eq('state', sv.dataset.svst));
        m.textContent = x.error ? errText(x, 'Couldn’t save. Try again.') : 'Saved.'; return; }
      if (e.target.id === 'r5DaysSave') {
        const n = Math.round(+$('r5Days').value);
        if (!(n >= 1 && n <= 365)) { say('r5DaysMsg', 'Type a number of days from 1 to 365.'); return; }
        const x = await safe(db().from('tracker_settings').upsert({ key:'contracts_recheck_days', value:String(n) }));
        if (x.error) { say('r5DaysMsg', errText(x, 'Couldn’t save. Try again.')); return; }
        reopen(); return; }
      // ---- Word files ----
      const dl = e.target.closest('[data-fdl]');
      if (dl) { const x = files.find(f => f.id === dl.dataset.fdl); dl.disabled = true;
        const r = await db().storage.from('contract-files').download(x.path); dl.disabled = false;
        if (r.error) { alertIn(dl, 'Couldn’t download it. Try again.'); return; }
        saveBlob(r.data, x.file_name); return; }
      const up = e.target.closest('[data-up]');
      if (up) { await upload(up.dataset.up, up); return; }
      const rv = e.target.closest('[data-frev]');
      if (rv) { const x = files.find(f => f.id === rv.dataset.frev), row = rv.closest('.r5-file');
        if (row.querySelector('.r5-revform')) return;
        row.insertAdjacentHTML('beforeend', '<form class="r5-revform px-form" novalidate>' + f('Attorney who reviewed it', '<input type="text" data-r="by" maxlength="120" value="' + esc(x.reviewed_by || '') + '" autocomplete="off">') +
          f('Date of the review', '<input type="date" data-r="on" value="' + esc(x.reviewed_on || today()) + '">') + f('Notes (optional)', '<textarea data-r="notes" rows="2" maxlength="2000">' + esc(x.review_notes || '') + '</textarea>', 'px-wide') +
          '<div class="wk-row"><button type="button" class="p-btn" data-rsave="' + esc(x.id) + '">Save review</button>' + (x.reviewed_by ? '<button type="button" class="p-btn is-ghost" data-rclear="' + esc(x.id) + '">Mark as not reviewed</button>' : '') + '<span class="p-empty" role="status"></span></div></form>');
        row.querySelector('[data-r=by]').focus(); return; }
      const rsv = e.target.closest('[data-rsave], [data-rclear]');
      if (rsv) { const form = rsv.closest('form'), m = form.querySelector('[role=status]'), clear = !!rsv.dataset.rclear;
        const by = form.querySelector('[data-r=by]').value.trim(), on = form.querySelector('[data-r=on]').value, notes = form.querySelector('[data-r=notes]').value.trim();
        if (!clear && (by.length < 2 || !on)) { m.textContent = 'Add the attorney’s name and the date.'; return; }
        const x = await safe(db().from('contract_files').update(clear ? { reviewed_by:null, reviewed_on:null, review_notes:null } : { reviewed_by:by, reviewed_on:on, review_notes:notes || null }).eq('id', rsv.dataset.rsave || rsv.dataset.rclear));
        if (x.error) { m.textContent = errText(x, 'Couldn’t save. Try again.'); return; }
        reopen(); return; }
      const ret = e.target.closest('[data-fret]');
      if (ret) { const x = files.find(f => f.id === ret.dataset.fret);
        const yes = await window.ask({ title:'Take version ' + x.version + ' out of use?', msg:'“Fill a contract” stops using it. The file stays here under “Out of use”, so you can still download it.', ok:'Take out of use', cancel:'Keep it' });
        if (!yes) return;
        const r = await safe(db().from('contract_files').update({ retired:true }).eq('id', x.id));
        if (r.error) { alertIn(ret, errText(r, 'Couldn’t save. Try again.')); return; }
        reopen(); }
    });

    async function upload(tid, btn){
      const input = body.querySelector('[data-ufile="' + tid + '"]'), state = body.querySelector('[data-ust="' + tid + '"]').value || null, m = body.querySelector('[data-umsg="' + tid + '"]');
      const file = input.files && input.files[0];
      if (!file) { m.textContent = 'Pick a Word file first.'; return; }
      if (!/\.docx$/i.test(file.name)) { m.textContent = 'That isn’t a Word file. Save it as .docx (Word: File, Save As, Word Document) and pick it again.'; return; }
      if (file.size > 10485760) { m.textContent = 'That file is larger than 10 MB. Remove big pictures and try again.'; return; }
      btn.disabled = true; m.textContent = 'Reading the file…';
      let found;
      try { found = window.DocxFill.fields(await window.DocxFill.read(await file.arrayBuffer())); }
      catch (er) { btn.disabled = false; m.textContent = 'Couldn’t read it: ' + (er.message || 'not a Word file') + '. Open it in Word, save it as .docx again, and pick it again.'; return; }
      if (!found.fields.length) { btn.disabled = false; m.textContent = 'No boxes found. Type each one in curly brackets, like {seller_name}, then add the file again.'; return; }
      const version = 1 + Math.max(0, ...files.filter(x => x.template_id === tid && (x.state || null) === state).map(x => x.version));
      const path = tid + '/' + (state || 'all') + '/v' + version + '-' + Date.now().toString(36) + '.docx';
      m.textContent = 'Saving version ' + version + '…';
      const u = await db().storage.from('contract-files').upload(path, file, { contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert:false });
      if (u.error) { btn.disabled = false; m.textContent = errText(u, 'Couldn’t save the file. Sign in with your authenticator code and try again.'); return; }
      const r = await safe(db().from('contract_files').insert({ template_id:tid, state, version, path, file_name:file.name.slice(0, 200), fields:found.fields, size_bytes:file.size }));
      if (r.error) { await db().storage.from('contract-files').remove([path]).catch(() => {}); btn.disabled = false; m.textContent = errText(r, 'Couldn’t save it. Try again.'); return; }
      const boxes = found.fields.filter(k => !isSign(k)), signs = found.fields.filter(isSign);
      const note = 'Version ' + version + ' saved, not reviewed yet. ' + plural(boxes.length, 'box', 'boxes') + ' to fill' + (signs.length ? ', ' + plural(signs.length, 'signature line') + ' left blank' : '') + '.' +
        (found.odd.length ? ' These weren’t read as boxes, so they print as they are: ' + found.odd.join(', ') + '. Use letters, numbers, spaces or underscores only.' : '');
      await reopen();
      const m2 = document.querySelector('[data-umsg="' + tid + '"]'); if (m2) { m2.textContent = note; m2.scrollIntoView({ block:'nearest' }); }
    }
    function alertIn(near, t1){ near.insertAdjacentHTML('afterend', '<span class="p-empty" role="status">' + esc(t1) + '</span>'); }
  }};

  function saveBlob(blob, name){
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function loadStart(){
    let data; try { const r = await fetch('contracts-start.json', { cache:'no-store' }); data = await r.json(); } catch (e) { return 'Couldn’t load the starting set. Check your connection.'; }
    const a = await safe(db().from('contract_templates').upsert(data.templates)), b = await safe(db().from('contract_states').upsert(data.states));
    return a.error || b.error ? errText(a.error ? a : b, 'Couldn’t save it. Sign in with your authenticator code and try again.') : 'Loaded ' + plural(data.templates.length, 'template') + ' and ' + plural(data.states.length, 'state') + '.';
  }

  // The fill form: boxes for every {word}. With a Word file for the template (and state), it downloads the filled
  // .docx; without one it shows the text template and prints it, as before.
  const SAVED = 'r5-fill';
  function drawFill(body, head, temps, states, files){
    const want = location.hash.split('/')[2];
    let t = temps.find(x => x.id === want) || temps[0];
    let vals = {}; try { vals = JSON.parse(localStorage.getItem(SAVED) || '{}'); } catch (e) {}
    vals.today = vals.today || today();
    const good = states.filter(s => s.fit !== 'avoid');
    const stOf = () => states.find(s => s.state === (vals.state || '').toUpperCase());
    const value = k => {
      const st = stOf(), v = Object.assign({}, vals, { state:st ? st.name : (vals.state || '') });
      if (!v.state_rule) v.state_rule = st && st.fit === 'check' ? 'State rule: ' + ((st.sheet || {}).wholesaling || '') : 'You can ask Buyer any question about this agreement before you sign.';
      const raw = v[k]; if (raw == null || String(raw).trim() === '') return null;
      const ty = (FIELDS[k] || [])[1];
      return ty === 'money' ? money(raw) : ty === 'date' ? fmtDay(raw, { month:'long', day:'numeric', year:'numeric' }) : String(raw);
    };
    const render = () => t.body.replace(/\{([a-z_]+)\}/g, (m, k) => value(k) == null ? BLANK : value(k));
    const fileNow = () => pickFile(files, t.id, (vals.state || '').toUpperCase());
    const keysNow = () => { const fl = fileNow(); return (fl ? fl.fields : keysOf(t.body)).filter(k => k !== 'state_rule' && !isSign(k)); };
    const stateNote = () => {
      const st = stOf(); if (!st) return '';
      const h = st.sheet || {}, papers = (h.addenda || []);
      if (st.fit === 'avoid') return '<div class="r5-warn" role="alert"><b>' + esc(st.name) + ' is on the avoid list.</b> ' + esc(h.wholesaling || '') + ' Check with Amr before you send anything.</div>';
      return '<div class="r5-statenote"><b>For ' + esc(st.name) + '</b>' + (papers.length ? '<span>Papers to add: ' + esc(papers.join('; ')) + '</span>' : '') + (h.deed ? '<span>Deed: ' + esc(h.deed) + '</span>' : '') +
        (st.fit === 'check' && h.wholesaling ? '<span>Rule to follow: ' + esc(h.wholesaling) + '</span>' : '') +
        (t.id !== 'disclosure' && temps.some(x => x.id === 'disclosure') ? '<span>Send the Wholesaling disclosure addendum with it.</span>' : '') + '</div>';
    };
    const fileNote = () => {
      const fl = fileNow();
      if (!fl) return '<p class="tp-note r5-src">No Word file for this one yet, so this uses the text template. ' + pill('Not reviewed by an attorney', 'no') + '</p>';
      return '<p class="tp-note r5-src">Fills the Word file <b>' + esc(fl.file_name) + '</b>, version ' + fl.version + (fl.state ? ' for ' + esc(stOf() ? stOf().name : fl.state) : ', all states') + '. ' + reviewPill(fl) + '</p>' +
        (fl.reviewed_by ? '' : '<div class="r5-warn" role="alert"><b>Not reviewed by an attorney yet.</b> Don’t send it to a seller until it is. Amr records the review on the Templates tab.</div>');
    };
    const preview = () => {
      const fl = fileNow();
      if (!fl) return '<pre class="r5-pre" id="r5Prev">' + esc(render()) + '</pre>';
      const ks = fl.fields.filter(k => k !== 'state_rule');
      return '<dl class="r5-boxes" id="r5Prev">' + ks.map(k => { const v = isSign(k) ? null : value(k);
        return '<dt>' + esc(labelOf(k)) + '</dt><dd' + (v == null ? ' class="is-empty"' : '') + '>' + esc(isSign(k) ? 'Left blank to sign by hand' : v == null ? 'Empty: prints as a blank line' : v) + '</dd>'; }).join('') + '</dl>';
    };
    let shown = null;
    const draw = () => {
      const keys = keysNow(), fl = fileNow(); shown = (fl || {}).id || null;
      body.innerHTML = head + card('Fill a contract', '', '<form class="px-form r5-fill" id="r5Form" novalidate>' +
        f('Template', '<select id="r5Temp">' + temps.map(x => opt(x.id, x.title, x === t)).join('') + '</select>') +
        f('State', '<select data-f="state">' + opt('', 'Pick a state') + good.map(s => opt(s.state, s.name, s.state === vals.state)).join('') +
          (vals.state && !good.some(s => s.state === vals.state) && stOf() ? opt(vals.state, stOf().name + ' (avoid)', true) : '') + '</select>') +
        keys.filter(k => k !== 'state').map(k => { const label = labelOf(k), ty = (FIELDS[k] || [])[1]; const v = esc(vals[k] || '');
          return f(label, ty === 'long' ? '<textarea data-f="' + k + '" rows="2">' + v + '</textarea>' : '<input data-f="' + k + '" type="' + (ty === 'date' ? 'date' : 'text') + '"' + (ty === 'money' || ty === 'num' ? ' inputmode="decimal"' : '') + ' value="' + v + '" autocomplete="off">', ty === 'long' ? 'px-wide' : ''); }).join('') +
        '</form>' + '<div id="r5StateNote">' + stateNote() + '</div><div id="r5FileNote">' + fileNote() + '</div>' +
        '<p class="tp-note">What you type stays on this device only, so the next contract starts with it. Nothing is saved to the database.</p>' +
        '<div class="wk-row">' + (fl ? '<button class="p-btn" type="button" id="r5Docx">Download the filled Word file</button>' : '<button class="p-btn" type="button" id="r5Print">Print or save as PDF</button>') +
        '<button class="p-btn is-ghost" type="button" id="r5Clear">Clear the boxes</button></div><p class="p-empty" id="r5Msg" role="status"></p>') +
        card('Preview', esc(t.title), preview());
    };
    draw();
    const refresh = () => { const p = $('r5Prev'); if (p) p.outerHTML = preview(); };
    body.addEventListener('input', e => { const k = e.target.dataset.f; if (!k) return; vals[k] = e.target.value; try { localStorage.setItem(SAVED, JSON.stringify(vals)); } catch (er) {} refresh(); });
    body.addEventListener('change', e => {
      if (e.target.id === 'r5Temp') { t = temps.find(x => x.id === e.target.value) || t; draw(); }
      else if (e.target.dataset.f === 'state') {
        vals.state = e.target.value; try { localStorage.setItem(SAVED, JSON.stringify(vals)); } catch (er) {}
        if (((fileNow() || {}).id || null) !== shown) draw(); else { $('r5StateNote').innerHTML = stateNote(); $('r5FileNote').innerHTML = fileNote(); refresh(); }
      }
    });
    body.addEventListener('click', async e => {
      if (e.target.id === 'r5Clear') { vals = { today:today() }; try { localStorage.removeItem(SAVED); } catch (er) {} draw(); }
      if (e.target.id === 'r5Print') {
        const w = window.open('', '_blank'); if (!w) { say('r5Msg', 'Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
        w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(t.title) + '</title><style>body{font:14px/1.6 Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111}pre{white-space:pre-wrap;font:inherit}</style></head><body><pre>' + esc(render()) + '</pre></body></html>');
        w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
      }
      if (e.target.id === 'r5Docx') {
        const fl = fileNow(), btn = e.target; if (!fl) return;
        const missing = fl.fields.filter(k => k !== 'state_rule' && !isSign(k) && value(k) == null).map(labelOf);
        if (missing.length) {
          const yes = await window.ask({ title:plural(missing.length, 'box', 'boxes') + ' still empty', msg:missing.join(', ') + '. They print as blank lines. Download anyway?', ok:'Download anyway', cancel:'Fill them first' });
          if (!yes) return;
        }
        btn.disabled = true; say('r5Msg', 'Filling the Word file…');
        try {
          const blob = await window.DocxFill.fill(await loadDoc(fl), k => isSign(k) ? SIGN_LINE : (value(k) == null ? BLANK : value(k)));
          const who = String(vals.seller_name || vals.property_address || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60);
          saveBlob(blob, t.title + (who ? ' - ' + who : '') + ' - ' + (vals.today || today()) + '.docx');
          say('r5Msg', 'Downloaded. Open it in Word and read it once top to bottom before you send it.');
        } catch (er) { say('r5Msg', er.message || 'Couldn’t fill the Word file. Try again.'); }
        btn.disabled = false;
      }
    });
  }

  // ======================================================================
  // Saved replies in Messages
  // ======================================================================
  const origMessages = V.messages && V.messages.open;
  if (origMessages) V.messages.open = async function(el, ok){
    await origMessages.call(this, el, ok);
    if (!ok() || !$('msForm')) return;
    const r = await safe(db().from('portal_saved_replies').select('*').order('title'));
    if (!ok() || r.error) return;
    let list = r.data || [];
    const bar = document.createElement('div'); bar.className = 'r5-replies'; $('msForm').before(bar);
    const draw = () => {
      bar.innerHTML = '<label class="sc-f px-inline">Saved replies<select id="r5Pick">' + opt('', list.length ? 'Pick one to add it' : 'None yet') + list.map(x => opt(x.id, x.title + (x.shared ? ' (team)' : ''))).join('') + '</select></label>' +
        '<button type="button" class="p-btn is-ghost" id="r5SaveRep">Save what I typed</button>' + (list.some(x => x.owner === uid()) ? '<button type="button" class="p-btn is-ghost" id="r5Manage">Manage</button>' : '') +
        '<div id="r5RepBox"></div>';
    };
    draw();
    bar.addEventListener('change', e => {
      if (e.target.id !== 'r5Pick' || !e.target.value) return;
      const x = list.find(y => String(y.id) === e.target.value), box = $('msBody');
      if (x && box) { box.value = box.value ? box.value.replace(/\s*$/, '\n') + x.body : x.body; box.focus(); }
      e.target.value = '';
    });
    bar.addEventListener('click', async e => {
      const rb = $('r5RepBox');
      if (e.target.id === 'r5SaveRep') {
        const text = ($('msBody') || {}).value || '';
        if (!text.trim()) { rb.innerHTML = '<p class="p-empty">Type the message first, then save it.</p>'; return; }
        rb.innerHTML = '<div class="wk-row"><input type="text" id="r5RepName" maxlength="80" placeholder="Short name, e.g. Shift reminder" aria-label="Name for this reply">' +
          (isOwner() ? '<label class="px-check"><input type="checkbox" id="r5RepTeam"> Share with the team</label>' : '') + '<button type="button" class="p-btn" id="r5RepOk">Save</button></div>';
        $('r5RepName').focus(); return;
      }
      if (e.target.id === 'r5RepOk') {
        const name = $('r5RepName').value.trim(); if (!name) { $('r5RepName').focus(); return; }
        const x = await safe(db().from('portal_saved_replies').insert({ title:name, body:$('msBody').value.trim(), shared:!!($('r5RepTeam') && $('r5RepTeam').checked) }).select('*').single());
        if (x.error) { rb.innerHTML = '<p class="p-empty">' + esc(errText(x, 'Couldn’t save it. Try again.')) + '</p>'; return; }
        list = list.concat(x.data).sort((a, b) => a.title.localeCompare(b.title)); draw(); $('r5RepBox').innerHTML = '<p class="p-empty" role="status">Saved.</p>'; return;
      }
      if (e.target.id === 'r5Manage') {
        rb.innerHTML = list.filter(x => x.owner === uid()).map(x => '<div class="p-row"><span><b>' + esc(x.title) + '</b>' + (x.shared ? ' ' + pill('Team', 'plain') : '') + '<br><small>' + esc(x.body.slice(0, 120)) + '</small></span><button type="button" class="p-btn is-ghost" data-rdel="' + x.id + '">Delete</button></div>').join(''); return;
      }
      const d = e.target.closest('[data-rdel]');
      if (d) { if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'Sure?'; return; }
        const x = await safe(db().from('portal_saved_replies').delete().eq('id', +d.dataset.rdel));
        if (!x.error) { list = list.filter(y => y.id !== +d.dataset.rdel); d.closest('.p-row').remove(); } }
    });
  };

  // ======================================================================
  // Checklists on Tasks (Amr)
  // ======================================================================
  const origTasks = V.tasks && V.tasks.open;
  if (origTasks) V.tasks.open = async function(el, ok){
    await origTasks.call(this, el, ok);
    if (!ok() || !isOwner()) return;
    const body = el.querySelector('.px-body'); if (!body) return;
    const [c, p] = await Promise.all([safe(db().from('portal_checklists').select('*').order('title')), safe(db().from('members').select('user_id,name').eq('active', true).order('name'))]);
    if (!ok() || c.error) return;
    const lists = c.data || [], ppl = p.data || [];
    const stepsText = s => (s || []).map(x => 'Day ' + (x.days || 0) + ': ' + x.title).join('\n');
    const parse = txt => txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^day\s*(\d+)\s*[:\-.]\s*(.+)$/i); return m ? { days:+m[1], title:m[2].trim() } : { days:0, title:l }; });
    const box = document.createElement('div'); box.id = 'r5Lists'; body.appendChild(box);
    box.innerHTML = card('Checklists', plural(lists.length, 'checklist'), '<p class="tp-note">Start one and every step becomes a task, due that many days after the start day.</p>' +
      lists.map(l => '<details class="r5-list" data-cl="' + l.id + '"><summary><b>' + esc(l.title) + '</b> · ' + plural((l.steps || []).length, 'step') + '</summary>' +
        '<fieldset class="sc-f"><legend>For</legend><span class="r5-ppl"><label class="px-check"><input type="checkbox" value="' + esc(uid()) + '" checked> Me</label>' + ppl.filter(x => x.user_id !== uid()).map(x => '<label class="px-check"><input type="checkbox" value="' + esc(x.user_id) + '"> ' + esc(x.name) + '</label>').join('') + '</span></fieldset>' +
        f('Start day', '<input type="date" data-k="start" value="' + today() + '">') +
        '<div class="wk-row"><button type="button" class="p-btn" data-clgo="' + l.id + '">Start this checklist</button><span class="p-empty" role="status"></span></div>' +
        f('Steps (one a line, “Day 3: what to do”)', '<textarea data-k="steps" rows="' + Math.min(12, (l.steps || []).length + 2) + '">' + esc(stepsText(l.steps)) + '</textarea>', 'px-wide') +
        '<div class="wk-row"><button type="button" class="p-btn is-ghost" data-clsave="' + l.id + '">Save steps</button><button type="button" class="p-btn is-ghost" data-cldel="' + l.id + '">Delete checklist</button></div></details>').join('') +
      '<details class="r5-list"><summary><b>+ New checklist</b></summary>' + f('Name', '<input type="text" id="r5ClName" maxlength="80">') +
        f('Steps (one a line, “Day 3: what to do”)', '<textarea id="r5ClSteps" rows="6" placeholder="Day 0: First thing&#10;Day 2: Second thing"></textarea>', 'px-wide') + '<div class="wk-row"><button type="button" class="p-btn" id="r5ClAdd">Add checklist</button><span class="p-empty" id="r5ClMsg" role="status"></span></div></details>');
    box.addEventListener('click', async e => {
      const go = e.target.closest('[data-clgo]');
      if (go) { const d = go.closest('[data-cl]'), m = d.querySelector('[role=status]'), who = [...d.querySelectorAll('.r5-ppl input:checked')].map(x => x.value);
        if (!who.length) { m.textContent = 'Pick at least one person.'; return; }
        go.disabled = true; const x = await safe(db().rpc('portal_checklist_start', { p_id:+go.dataset.clgo, p_people:who, p_start:d.querySelector('[data-k=start]').value || null })); go.disabled = false;
        if (x.error) { m.textContent = errText(x, 'Couldn’t start it. Try again.'); return; }
        m.textContent = plural(x.data || 0, 'task') + ' added.'; setTimeout(() => V.tasks.open(el, ok), 900); return; }
      const sv = e.target.closest('[data-clsave]');
      if (sv) { const d = sv.closest('[data-cl]'), steps = parse(d.querySelector('[data-k=steps]').value);
        const x = await safe(db().from('portal_checklists').update({ steps, updated_at:new Date().toISOString() }).eq('id', +sv.dataset.clsave));
        d.querySelector('[role=status]').textContent = x.error ? errText(x, 'Couldn’t save.') : 'Steps saved.'; return; }
      const dl = e.target.closest('[data-cldel]');
      if (dl) { if (dl.dataset.sure !== '1') { dl.dataset.sure = '1'; dl.textContent = 'Sure? Delete it'; return; }
        const x = await safe(db().from('portal_checklists').delete().eq('id', +dl.dataset.cldel)); if (!x.error) dl.closest('[data-cl]').remove(); return; }
      if (e.target.id === 'r5ClAdd') { const name = $('r5ClName').value.trim(), steps = parse($('r5ClSteps').value);
        if (!name) return say('r5ClMsg', 'Give it a name.'); if (!steps.length) return say('r5ClMsg', 'Add at least one step.');
        const x = await safe(db().from('portal_checklists').insert({ title:name, steps }));
        if (x.error) return say('r5ClMsg', errText(x, 'Couldn’t add it.')); V.tasks.open(el, ok); }
    });
  };

  // ======================================================================
  // Shift swaps on Schedule
  // ======================================================================
  const origSchedule = V.schedule && V.schedule.open;
  const when = (a, b) => fmtDay(a, { weekday:'short', month:'short', day:'numeric', timeZone:'Africa/Cairo' }) + ', ' + fmtTime(a, 'Africa/Cairo') + ' to ' + fmtTime(b, 'Africa/Cairo') + ' Cairo';
  if (origSchedule) V.schedule.open = async function(el, ok){
    await origSchedule.call(this, el, ok);
    if (!ok()) return;
    const body = el.querySelector('.px-body'); if (!body) return;
    const owner = isOwner(), now = new Date();
    const [w, mine] = await Promise.all([safe(db().rpc('portal_swaps')), owner ? Promise.resolve({ data:[] }) : safe(db().rpc('portal_schedule', { p_from:isoDay(now), p_to:isoDay(new Date(Date.now() + 28 * 864e5)) }))]);
    if (!ok() || w.error) return;
    const swaps = w.data || [], my = (mine.data || []).filter(s => new Date(s.starts_at) > now);
    const openOn = new Set(swaps.filter(s => s.mine && ['open', 'taken'].includes(s.status)).map(s => s.starts_at));
    const kindWord = s => s.kind === 'give' ? 'Giving away' : 'Swap';
    const line = (s, act) => '<div class="p-row"><span><b>' + esc(s.from_name) + '</b> · ' + esc(kindWord(s)) + '<br><small>' + esc(when(s.starts_at, s.ends_at)) + '</small>' +
      (s.their_starts_at ? '<br><small>In return: ' + esc(s.taker_name || '') + ' gives ' + esc(when(s.their_starts_at, s.their_ends_at)) + '</small>' : s.taker_name ? '<br><small>Taken by ' + esc(s.taker_name) + '</small>' : '') + (s.note ? '<br><small>“' + esc(s.note) + '”</small>' : '') + '</span>' + act + '</div>';
    const ST = { open:['Open', 'plain'], taken:['Waiting for Amr', ''], approved:['Approved', 'ok'], declined:['Declined', 'no'], cancelled:['Cancelled', 'plain'] };
    const box = document.createElement('div'); box.id = 'r5Swaps';
    if (owner) {
      const wait = swaps.filter(s => s.status === 'taken'), open = swaps.filter(s => s.status === 'open'), done = swaps.filter(s => ['approved', 'declined', 'cancelled'].includes(s.status));
      if (!swaps.length) return;
      box.innerHTML = card('Shift swaps', wait.length ? plural(wait.length, 'to approve') : '', (wait.length ? wait.map(s => line(s, '<span class="wk-row"><button type="button" class="p-btn" data-swd="' + s.id + '" data-ok="1">Approve</button><button type="button" class="p-btn is-ghost" data-swd="' + s.id + '" data-ok="0">Decline</button></span>')).join('') : '') +
        (open.length ? '<h3 class="r5-h3">Still open</h3>' + open.map(s => line(s, pill('Open', 'plain'))).join('') : '') +
        (done.length ? '<h3 class="r5-h3">Last two weeks</h3>' + done.map(s => line(s, pill(ST[s.status][0], ST[s.status][1]))).join('') : ''));
      body.prepend(box);
    } else {
      const others = swaps.filter(s => !s.mine && s.status === 'open'), myReq = swaps.filter(s => s.mine || s.taker_is_me);
      box.innerHTML = card('Swap or give away a shift', '', '<p class="tp-note">Can’t make a shift? Offer it here. Another rep takes it, Amr approves, and both schedules change. Everyone gets a bell at each step.</p>' +
        (my.length ? my.map(s => '<div class="p-row"><span>' + esc(when(s.starts_at, s.ends_at)) + '</span>' + (openOn.has(s.starts_at) ? pill('Offered', 'plain') :
          '<span class="wk-row"><button type="button" class="p-btn is-ghost" data-swa="' + s.id + '" data-k="give">Give away</button><button type="button" class="p-btn is-ghost" data-swa="' + s.id + '" data-k="swap">Swap</button></span>') + '</div>').join('') : empty('No coming shifts to offer.')) +
        '<div id="r5SwAsk"></div>' +
        '<h3 class="r5-h3">Up for grabs</h3>' + (others.length ? others.map(s => line(s, s.kind === 'swap' ? (my.length ? '<span class="wk-row"><select data-their="' + s.id + '" aria-label="Your shift to give in return">' + my.map(m => opt(m.id, fmtDay(m.starts_at, { weekday:'short', month:'short', day:'numeric', timeZone:'Africa/Cairo' }) + ' ' + fmtTime(m.starts_at, 'Africa/Cairo'))).join('') + '</select><button type="button" class="p-btn" data-swt="' + s.id + '">Swap</button></span>' : '<small>You need a coming shift to swap</small>') :
          '<button type="button" class="p-btn" data-swt="' + s.id + '">Take it</button>')).join('') : empty('Nothing offered right now.')) +
        (myReq.length ? '<h3 class="r5-h3">Your requests</h3>' + myReq.map(s => line(s, '<span class="wk-row">' + pill(ST[s.status][0], ST[s.status][1]) + (['open', 'taken'].includes(s.status) ? '<button type="button" class="p-btn is-ghost" data-swc="' + s.id + '">' + (s.mine ? 'Cancel' : 'Back out') + '</button>' : '') + '</span>')).join('') : '') +
        '<p class="p-empty" id="r5SwMsg" role="status"></p>');
      body.appendChild(box);
    }
    const reopen = () => V.schedule.open(el, ok);
    box.addEventListener('click', async e => {
      const a = e.target.closest('[data-swa]');
      if (a) { $('r5SwAsk').innerHTML = '<div class="wk-row"><input type="text" id="r5SwNote" maxlength="300" placeholder="Why (optional)" aria-label="Why"><button type="button" class="p-btn" id="r5SwGo" data-id="' + a.dataset.swa + '" data-k="' + a.dataset.k + '">' + (a.dataset.k === 'give' ? 'Offer it to the team' : 'Ask for a swap') + '</button></div>'; $('r5SwNote').focus(); return; }
      if (e.target.id === 'r5SwGo') { const b = e.target; b.disabled = true;
        const x = await safe(db().rpc('portal_swap_ask', { p_shift:+b.dataset.id, p_kind:b.dataset.k, p_note:$('r5SwNote').value.trim() || null }));
        if (x.error) { b.disabled = false; return say('r5SwMsg', errText(x, 'Couldn’t send it. Try again.')); } return reopen(); }
      const t = e.target.closest('[data-swt]');
      if (t) { t.disabled = true; const sel = box.querySelector('[data-their="' + t.dataset.swt + '"]');
        const x = await safe(db().rpc('portal_swap_take', { p_id:+t.dataset.swt, p_their_shift:sel ? +sel.value : null }));
        if (x.error) { t.disabled = false; return say('r5SwMsg', errText(x, 'Couldn’t take it. Try again.')); } return reopen(); }
      const c = e.target.closest('[data-swc]');
      if (c) { c.disabled = true; const x = await safe(db().rpc('portal_swap_cancel', { p_id:+c.dataset.swc })); if (x.error) { c.disabled = false; return say('r5SwMsg', errText(x, 'Couldn’t do that. Try again.')); } return reopen(); }
      const d = e.target.closest('[data-swd]');
      if (d) { d.disabled = true; const x = await safe(db().rpc('portal_swap_decide', { p_id:+d.dataset.swd, p_ok:d.dataset.ok === '1' })); if (x.error) { d.disabled = false; return; } return reopen(); }
    });
  };
})();
