// Round 14 (handoff R14), part 1: deals paperwork and team tools.
//   #contracts   Contracts by state: state sheets, templates, a step-by-step walkthrough and a filled copy to print
//   Messages     saved replies (everyone keeps their own; Amr can share his with the team)
//   Tasks        checklist templates (Amr): "New client", "New hire", "Month end"; starting one makes the tasks
//   Schedule     shift swaps: a rep gives away or swaps a shift, another rep takes it, Amr approves
// Database: portal-backups docs/sql/2026-11-12-round14-r5-*.sql (contract_templates, contract_states,
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

  V.contracts = { title:'Contracts', sec:'deals', async open(el, ok){
    const tab = (location.hash.split('/')[1] || 'states');
    const body = PX.page(el, 'Deals', 'Contracts by state', 'Starting templates and one sheet per state, for states with title-company closings and public sold prices. Not legal advice: have an attorney in that state review each template once before you first use it.');
    const [tp, st] = await Promise.all([safe(db().from('contract_templates').select('*').order('sort')), safe(db().from('contract_states').select('*').order('sort').order('name'))]);
    if (!ok()) return;
    if (tp.error || st.error) { body.innerHTML = failed(tp.error || st.error); return; }
    const temps = tp.data || [], states = st.data || [], owner = isOwner();
    const tabs = [['states', 'States'], ['templates', 'Templates'], ['steps', 'Step by step'], ['fill', 'Fill a contract']];
    const head = '<div class="p-seg r5-seg" role="tablist" aria-label="Contracts">' + tabs.map(([k, l]) => '<a role="tab" class="wk-seg' + (k === tab ? ' on' : '') + '" aria-selected="' + (k === tab) + '" href="#contracts/' + k + '">' + esc(l) + '</a>').join('') + '</div>';
    if (!states.length || !temps.length) {
      body.innerHTML = head + card('Nothing here yet', '', owner ? '<p class="tp-note">Load the starting set: 6 templates and sheets for 8 states (Michigan, Florida, Colorado, Nevada, Minnesota, Arkansas, plus Indiana and Washington to check) and the states to avoid. You can edit all of it after.</p><button class="p-btn" type="button" id="r5Seed">Load the starting set</button><p class="p-empty" id="r5SeedMsg" role="status"></p>' : empty('Amr hasn’t added contracts yet.'));
      const b = $('r5Seed'); if (b) b.addEventListener('click', async () => { b.disabled = true; say('r5SeedMsg', 'Loading…'); const m = await loadStart(); say('r5SeedMsg', m); if (/^Loaded/.test(m)) V.contracts.open(el, ok); else b.disabled = false; });
      return;
    }
    const sheet = s => { const h = s.sheet || {}, row = (k, v) => v ? '<div class="r5-kv"><b>' + esc(k) + '</b><span>' + esc(v) + '</span></div>' : '';
      return '<article class="p-card r5-sheet" id="st-' + esc(s.state) + '"><div class="p-card-head"><h2>' + esc(s.name) + ' <small>' + esc(s.state) + '</small></h2><span>' + pill(FIT[s.fit][0], FIT[s.fit][1]) + '</span></div>' +
        row('Who closes', h.closing) + row('Sold prices', h.disclosure) + row('Wholesaling rules', h.wholesaling) + row('Deed', h.deed) +
        ((h.addenda || []).length ? '<div class="r5-kv"><b>Papers to add</b><ul>' + h.addenda.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul></div>' : '') + row('Notes', h.notes) +
        ((h.sources || []).length ? '<div class="r5-kv"><b>Sources</b><ul>' + h.sources.map(x => '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + '</a></li>').join('') + '</ul></div>' : '') +
        '<p class="tp-note">Last checked ' + esc(h.checked_on ? fmtDay(h.checked_on, { month:'short', day:'numeric', year:'numeric' }) : '–') + '. Laws change: check the sources again before your first deal there.</p>' +
        (owner ? '<button type="button" class="p-btn is-ghost" data-edst="' + esc(s.state) + '">Edit this sheet</button>' : '') + '</article>'; };
    if (tab === 'states') {
      const good = states.filter(s => s.fit !== 'avoid'), bad = states.filter(s => s.fit === 'avoid');
      body.innerHTML = head + card('States to work', plural(good.length, 'state'), '<p class="tp-note">Good fit means: a title company closes (no attorney needed), sold prices are public, and no wholesaling law was found when last checked. “Check first” states work but have a rule to follow.</p>' +
        '<div class="r5-chips">' + good.map(s => '<a class="r5-chip is-' + s.fit + (s === (good.find(x => x.state === location.hash.split('/')[2]) || good[0]) ? ' on' : '') + '" href="#contracts/states/' + esc(s.state) + '"><b>' + esc(s.state) + '</b>' + esc(s.name) + '</a>').join('') + '</div>') +
        sheet(good.find(s => s.state === location.hash.split('/')[2]) || good[0]) +
        (bad.length ? card('States to avoid for now', plural(bad.length, 'state'), bad.map(s => '<div class="p-row"><span><b>' + esc(s.name) + '</b><br><small>' + esc((s.sheet || {}).wholesaling || '') + '</small></span>' + pill('Avoid', 'no') + '</div>').join('')) : '');
    } else if (tab === 'templates') {
      body.innerHTML = head + temps.map(t => '<article class="p-card r5-temp"><div class="p-card-head"><h2>' + esc(t.title) + '</h2><span><a class="p-btn is-ghost" href="#contracts/fill/' + esc(t.id) + '">Fill</a></span></div><p class="tp-note">' + esc(t.about || '') + '</p>' +
        '<details><summary>Read the template</summary>' + (owner ? '<textarea class="r5-body" data-tbody="' + esc(t.id) + '" rows="18" maxlength="60000">' + esc(t.body) + '</textarea><div class="wk-row"><button type="button" class="p-btn" data-tsave="' + esc(t.id) + '">Save changes</button><span class="p-empty" data-tmsg="' + esc(t.id) + '" role="status"></span></div>'
          : '<pre class="r5-pre">' + esc(t.body) + '</pre>') + '</details></article>').join('') +
        (owner ? '<p class="tp-note">Words in {curly brackets} become boxes on the fill form. Keep them as they are, or add your own like {pet_policy}.</p>' : '');
    } else if (tab === 'steps') {
      body.innerHTML = head + card('From “yes” to signed', plural(STEPS.length, 'step'), '<ol class="r5-steps">' + STEPS.map(([h, p]) => '<li><b>' + esc(h) + '</b><p>' + esc(p) + '</p></li>').join('') + '</ol>' +
        '<p class="tp-note">Times to call sellers: 8 AM to 9 PM their time. Michigan is on Eastern time, 7 hours behind Cairo in winter.</p><a class="p-btn" href="#contracts/fill">Fill a contract</a>');
    } else drawFill(body, head, temps, states);

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
        m.textContent = x.error ? errText(x, 'Couldn’t save. Try again.') : 'Saved.'; }
    });
  }};

  async function loadStart(){
    let data; try { const r = await fetch('contracts-start.json', { cache:'no-store' }); data = await r.json(); } catch (e) { return 'Couldn’t load the starting set. Check your connection.'; }
    const a = await safe(db().from('contract_templates').upsert(data.templates)), b = await safe(db().from('contract_states').upsert(data.states));
    return a.error || b.error ? errText(a.error ? a : b, 'Couldn’t save it. Sign in with your authenticator code and try again.') : 'Loaded ' + plural(data.templates.length, 'template') + ' and ' + plural(data.states.length, 'state') + '.';
  }

  // The fill form: boxes for every {word}, a live preview, then print or save as PDF
  const SAVED = 'r5-fill';
  function drawFill(body, head, temps, states){
    const want = location.hash.split('/')[2];
    let t = temps.find(x => x.id === want) || temps[0];
    let vals = {}; try { vals = JSON.parse(localStorage.getItem(SAVED) || '{}'); } catch (e) {}
    vals.today = vals.today || today();
    const good = states.filter(s => s.fit !== 'avoid');
    const render = () => {
      const st = states.find(s => s.state === (vals.state || '').toUpperCase());
      const v = Object.assign({}, vals, { state:st ? st.name : (vals.state || '') });
      if (!v.state_rule) v.state_rule = st && st.fit === 'check' ? 'State rule: ' + ((st.sheet || {}).wholesaling || '') : 'You can ask Buyer any question about this agreement before you sign.';
      return t.body.replace(/\{([a-z_]+)\}/g, (m, k) => { const raw = v[k]; if (raw == null || raw === '') return '________'; const ty = (FIELDS[k] || [])[1];
        return ty === 'money' ? money(raw) : ty === 'date' ? fmtDay(raw, { month:'long', day:'numeric', year:'numeric' }) : raw; });
    };
    const draw = () => {
      const keys = keysOf(t.body).filter(k => k !== 'state_rule');
      body.innerHTML = head + card('Fill a contract', '', '<form class="px-form r5-fill" id="r5Form" novalidate>' +
        f('Template', '<select id="r5Temp">' + temps.map(x => opt(x.id, x.title, x === t)).join('') + '</select>') +
        f('State', '<select data-f="state">' + opt('', 'Pick a state') + good.map(s => opt(s.state, s.name, s.state === vals.state)).join('') + '</select>') +
        keys.filter(k => k !== 'state').map(k => { const [label, ty] = FIELDS[k] || [k.replace(/_/g, ' ')]; const v = esc(vals[k] || '');
          return f(label, ty === 'long' ? '<textarea data-f="' + k + '" rows="2">' + v + '</textarea>' : '<input data-f="' + k + '" type="' + (ty === 'date' ? 'date' : 'text') + '"' + (ty === 'money' || ty === 'num' ? ' inputmode="decimal"' : '') + ' value="' + v + '" autocomplete="off">', ty === 'long' ? 'px-wide' : ''); }).join('') +
        '</form><p class="tp-note">What you type stays on this device only, so the next contract starts with it. Nothing is saved to the database.</p>' +
        '<div class="wk-row"><button class="p-btn" type="button" id="r5Print">Print or save as PDF</button><button class="p-btn is-ghost" type="button" id="r5Clear">Clear the boxes</button></div>') +
        card('Preview', esc(t.title), '<pre class="r5-pre" id="r5Prev">' + esc(render()) + '</pre>');
    };
    draw();
    body.addEventListener('input', e => { const k = e.target.dataset.f; if (!k) return; vals[k] = e.target.value; try { localStorage.setItem(SAVED, JSON.stringify(vals)); } catch (er) {} const p = $('r5Prev'); if (p) p.textContent = render(); });
    body.addEventListener('change', e => { if (e.target.id === 'r5Temp') { t = temps.find(x => x.id === e.target.value) || t; draw(); } else if (e.target.dataset.f === 'state') { const p = $('r5Prev'); if (p) p.textContent = render(); } });
    body.addEventListener('click', e => {
      if (e.target.id === 'r5Clear') { vals = { today:today() }; try { localStorage.removeItem(SAVED); } catch (er) {} draw(); }
      if (e.target.id === 'r5Print') {
        const w = window.open('', '_blank'); if (!w) { alertBox('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
        w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(t.title) + '</title><style>body{font:14px/1.6 Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111}pre{white-space:pre-wrap;font:inherit}</style></head><body><pre>' + esc(render()) + '</pre></body></html>');
        w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
      }
    });
    function alertBox(t1){ const p = $('r5Prev'); if (p) p.insertAdjacentHTML('beforebegin', '<p class="p-empty" role="status">' + esc(t1) + '</p>'); }
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
