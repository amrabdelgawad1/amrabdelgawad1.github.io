// Round 17 (Nov 17 2026), part 3: lead lists with the records inside them.
//   #lists    Amr: upload a CSV, match its columns, remove duplicates (inside the file and against every list already
//             saved), check each number against your own do-not-call list (Logs › Do not call), then save. Each list:
//             assign reps, skip trace status (not sent / sent / back), download for skip tracing, upload the results,
//             download a clean CSV for the dialer, retire or delete. The old fields and call funnel numbers stay.
//   #mylists  reps: the lists assigned to them, without do-not-call or duplicate rows, with the seller's local time and
//             whether it's a legal hour to call (federal 8 AM to 9 PM plus the state rules in #callhours), and an outcome.
// Only your own do-not-call list is checked; the national registry needs a paid account (scrub before uploading).
// Database: lead_records, lead_lists.reps/skip_*, lead_dupes(), lead_list_counts(), my_lead_lists(), lead_record_outcome().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, fmtDay, num, usd, plural, card, empty, failed, pill, f, opt, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;

  // ---------- CSV ----------
  function parseCsv(text){
    const rows = []; let row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row);
    return rows;
  }
  const toCsv = (heads, rows) => [heads].concat(rows).map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
  const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type:'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  const slug = s => String(s || 'list').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'list';
  const phoneNorm = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; };
  const phoneShow = p => { const d = phoneNorm(p); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : (p || ''); };
  const addrKey = (a, z) => String(a || '').trim().toLowerCase() + '|' + String(z || '').slice(0, 5);
  const FIELDS = [
    ['owner_name', 'Owner name', /^(owner|owner ?1)?.*name|^first|^full ?name|^seller/i],
    ['phone', 'Phone', /phone|mobile|cell|wireless|^tel/i],
    ['phone2', 'Phone 2', /phone ?2|second.*phone|landline|alt.*phone/i],
    ['email', 'Email', /e-?mail/i],
    ['address', 'Property address', /(property|site|situs)?.*(address|street)|^addr/i],
    ['city', 'City', /city/i], ['state', 'State', /^(property )?state$|^st$/i], ['zip', 'ZIP', /zip|postal/i], ['county', 'County', /county/i]
  ];
  function guess(heads){
    const used = new Set(), map = {};
    const pick = (key, re, prefer) => { let i = heads.findIndex((h, j) => !used.has(j) && prefer && prefer.test(h)); if (i < 0) i = heads.findIndex((h, j) => !used.has(j) && re.test(h)); if (i >= 0) { used.add(i); map[key] = i; } };
    pick('phone2', FIELDS[2][2]); pick('email', FIELDS[3][2]); pick('zip', FIELDS[7][2]); pick('county', FIELDS[8][2]); pick('city', FIELDS[5][2]); pick('state', FIELDS[6][2]);
    pick('address', FIELDS[4][2], /property.*address|situs|site.*address/i); pick('phone', FIELDS[1][2], /^phone ?1?$|mobile|cell/i); pick('owner_name', FIELDS[0][2]);
    return map;
  }

  // ======================================================================
  // Lead lists (Amr)
  // ======================================================================
  const SKIP = [['not_sent', 'Not sent'], ['sent', 'Sent to skip trace'], ['partial', 'Partly back'], ['back', 'Back']];
  const OUTCOMES = ['No answer', 'Left voicemail', 'Callback', 'Not interested', 'Interested', 'Appointment set', 'Wrong number', 'Do not call'];
  V.lists = { title:'Lead lists', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Calls', 'Lead lists', 'Upload a list, clear out duplicates and do-not-call numbers, give it to reps and follow its skip tracing. The funnel shows which lists turn into appointments and deals.');
    const [r, st, cnt, mem] = await Promise.all([safe(db().from('lead_lists').select('*').order('active', { ascending:false }).order('created_at', { ascending:false })),
      safe(db().rpc('portal_list_stats')), safe(db().rpc('lead_list_counts')), safe(db().from('members').select('user_id,name,active').eq('active', true).order('name'))]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const lists = r.data || [], stats = new Map((st.data || []).map(x => [x.id, x])), counts = cnt.data || {}, reps = (mem.data || []).filter(m => m.user_id);
    const U = { rows:null, heads:null, map:{}, check:null, file:'' };
    let openId = null;

    const repName = id => ((reps.find(m => m.user_id === id) || {}).name || 'Someone').split(' ')[0];
    function listCard(l){
      const s = stats.get(l.id) || {}, c = counts[l.id] || {}, here = c.rows || 0;
      const line = [l.kind, [l.county, l.state].filter(Boolean).join(', '), l.source, here ? num(here) + ' records saved' : l.records ? num(l.records) + ' records' : '', l.cost ? usd(l.cost) : ''].filter(Boolean).join(' · ');
      const funnel = [s.dials ? num(s.dials) + ' dials' : '', s.appointments ? plural(+s.appointments, 'appointment') : '', s.deals ? plural(+s.deals, 'deal') : '', s.closed ? s.closed + ' closed' : ''].filter(Boolean).join(' · ');
      const skip = SKIP.find(x => x[0] === l.skip_status) || SKIP[0];
      return '<div class="r17-list" data-list="' + l.id + '"><div class="p-row"><span><b>' + esc(l.name) + '</b>' + (l.active ? '' : ' ' + pill('Retired', 'plain')) + '<br><small>' + esc(line) + '</small>' +
        (funnel ? '<br><small>' + esc(funnel) + '</small>' : '') + '<br><span class="r17-tags">' + pill(skip[1], l.skip_status === 'back' ? 'ok' : l.skip_status === 'not_sent' ? 'plain' : 'warn') +
        (l.reps || []).map(u => pill(repName(u))).join('') + (c.dnc ? pill(c.dnc + ' do-not-call', 'no') : '') + (c.dup ? pill(c.dup + ' duplicates', 'plain') : '') + (c.worked ? pill(num(c.worked) + ' worked', 'ok') : '') + '</span></span>' +
        '<span class="r17-acts"><button type="button" class="p-btn is-ghost" data-more="' + l.id + '" aria-expanded="' + (openId === l.id) + '">' + (openId === l.id ? 'Close' : 'Manage') + '</button></span></div>' +
        (openId === l.id ? manage(l, c) : '') + '</div>';
    }
    function manage(l, c){
      return '<div class="r17-manage">' +
        '<fieldset class="r17-box"><legend>Reps who call this list</legend><div class="r17-chips">' + (reps.length ? reps.map(m => '<label><input type="checkbox" data-rep="' + m.user_id + '"' + ((l.reps || []).includes(m.user_id) ? ' checked' : '') + '> ' + esc(m.name) + '</label>').join('') : '<small>No team members yet.</small>') + '</div>' +
        '<small class="p-hint">Reps see the list on their “My lead lists” page, without do-not-call or duplicate rows.</small></fieldset>' +
        '<fieldset class="r17-box"><legend>Skip trace</legend><div class="px-form r17-row">' +
          f('Status', '<select data-sk="skip_status">' + SKIP.map(x => opt(x[0], x[1], l.skip_status === x[0])).join('') + '</select>') +
          f('Company', '<input type="text" data-sk="skip_vendor" maxlength="60" value="' + esc(l.skip_vendor || '') + '" placeholder="e.g. BatchSkipTracing">') +
          f('Sent on', '<input type="date" data-sk="skip_sent_on" value="' + esc(l.skip_sent_on || '') + '">') + f('Back on', '<input type="date" data-sk="skip_back_on" value="' + esc(l.skip_back_on || '') + '">') +
          f('Cost ($)', '<input type="number" data-sk="skip_cost" min="0" step="0.01" value="' + (l.skip_cost == null ? '' : l.skip_cost) + '">') + '</div>' +
          '<p class="p-hint">' + num(c.rows || 0) + ' records · ' + num(c.phones || 0) + ' with a phone · ' + num(c.found || 0) + ' found by skip trace · ' + num(c.nf || 0) + ' not found</p>' +
          '<div class="px-tools"><button type="button" class="p-btn is-ghost" data-skipcsv="' + l.id + '">Download rows with no phone</button>' +
          '<label class="p-btn is-ghost r17-filebtn">Upload skip trace results<input type="file" accept=".csv,text/csv" data-skipup="' + l.id + '" hidden></label></div>' +
          '<small class="p-hint">Results are matched by property address and ZIP. Phones found go into the list and are checked against your do-not-call list.</small></fieldset>' +
        '<div class="px-tools"><button type="button" class="p-btn" data-clean="' + l.id + '">Download clean CSV</button>' +
          '<button type="button" class="p-btn is-ghost" data-ll="' + l.id + '" aria-pressed="' + l.active + '">' + (l.active ? 'Retire this list' : 'Put back in use') + '</button>' +
          '<button type="button" class="p-btn is-ghost" data-del="' + l.id + '">Delete list</button><span class="p-hint" id="llm' + l.id + '" role="status"></span></div></div>';
    }
    function uploadCard(){
      let inner = '<form class="px-form" id="llForm" novalidate>' + f('Name', '<input type="text" id="llName" maxlength="80" required placeholder="e.g. Polk County vacant land, Nov">', 'px-wide') +
        f('Kind', '<select id="llKind">' + opt('land', 'Land') + opt('house', 'Houses') + opt('other', 'Other') + '</select>') + f('State', '<select id="llState">' + opt('', '–') + PX.STATES.map(s => opt(s, s)).join('') + '</select>') +
        f('County', '<input type="text" id="llCounty" maxlength="60">') + f('Source', '<input type="text" id="llSource" maxlength="80" placeholder="e.g. PropStream, county records">') +
        f('Cost ($)', '<input type="number" id="llCost" min="0" step="0.01">') +
        f('CSV file (optional)', '<input type="file" id="llFile" accept=".csv,text/csv">', 'px-wide') + '<div id="llMap" class="px-wide"></div>' +
        '<div class="px-tools px-wide"><button class="p-btn" type="submit" id="llSave">Save list</button><span class="p-hint" id="llMsg" role="status"></span></div></form>';
      return card('Add a list', 'CSV from PropStream, DataTree, county records…', inner);
    }
    function mapHtml(){
      if (!U.rows) return '';
      const c = U.check;
      return '<div class="r17-map"><p><b>' + esc(U.file) + '</b>: ' + plural(U.rows.length, 'row') + '. Match the columns:</p><div class="r17-row">' +
        FIELDS.map(fl => f(fl[1], '<select data-map="' + fl[0] + '"><option value="">– not in file –</option>' + U.heads.map((h, i) => opt(i, h || 'Column ' + (i + 1), U.map[fl[0]] === i)).join('') + '</select>')).join('') + '</div>' +
        (c ? '<div class="px-tiles r17-checks">' +
          tile(num(c.total), 'rows in the file', num(c.noPhone) + ' with no phone') +
          tile(num(c.dupFile), 'duplicates in the file', 'same phone or same address') +
          tile(num(c.dupOld), 'already in a saved list', 'by phone or address') +
          tile(num(c.dnc), 'on your do-not-call list', c.dncNote || '') +
          tile(num(c.keep), 'rows to save', '') + '</div>' +
          '<label class="r17-check"><input type="checkbox" id="llDropDup" checked> Leave out duplicates</label>' +
          '<label class="r17-check"><input type="checkbox" id="llDropDnc" checked> Leave out do-not-call numbers (if kept, they’re marked and hidden from reps)</label>'
          : '<p class="p-loading">Checking duplicates and do-not-call…</p>') + '</div>';
    }
    const tile = (v, l, s) => '<div class="px-tile"><b>' + v + '</b><span>' + esc(l) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div>';
    function draw(){
      body.innerHTML = uploadCard() +
        card('Your lists', plural(lists.filter(x => x.active).length, 'in use'), lists.length ? lists.map(listCard).join('') : empty('No lists yet.')) +
        '<p class="p-hint">Do-not-call numbers live in <a href="#logs">Logs › Do not call</a>. Only your own list is checked here: scrub against the national registry before uploading.</p>';
    }
    const rec = row => { const o = {}; FIELDS.forEach(fl => { const i = U.map[fl[0]]; o[fl[0]] = i == null || i === '' ? null : (String(row[+i] || '').trim() || null); }); if (o.state) o.state = o.state.toUpperCase().slice(0, 2); return o; };
    async function runCheck(){
      U.check = null; const box = $('llMap'); if (box) box.innerHTML = mapHtml();
      const recs = U.rows.map(rec), seenP = new Set(), seenA = new Set();
      recs.forEach(x => { const p = phoneNorm(x.phone), a = x.address ? addrKey(x.address, x.zip) : '';
        x._dupFile = (p.length >= 10 && seenP.has(p)) || (a && seenA.has(a)); if (p.length >= 10) seenP.add(p); if (a) seenA.add(a); });
      const phones = [...new Set(recs.flatMap(x => [x.phone, x.phone2]).map(phoneNorm).filter(p => p.length >= 10))], addrs = [...new Set(recs.filter(x => x.address).map(x => addrKey(x.address, x.zip)))];
      let dnc = new Set(), oldP = new Set(), oldA = new Set(), note = '';
      for (let i = 0; i < phones.length; i += 2000) { const d = await safe(db().rpc('dnc_check_many', { p_phones:phones.slice(i, i + 2000) })); if (d.error) note = 'couldn’t check, try again'; (d.data || []).forEach(p => dnc.add(p)); }
      for (let i = 0; i < Math.max(phones.length, addrs.length); i += 1000) {
        const d = await safe(db().rpc('lead_dupes', { p_phones:phones.slice(i, i + 1000), p_addrs:addrs.slice(i, i + 1000) }));
        ((d.data || {}).phones || []).forEach(p => oldP.add(p)); ((d.data || {}).addrs || []).forEach(a => oldA.add(a));
      }
      recs.forEach(x => { const p = phoneNorm(x.phone), p2 = phoneNorm(x.phone2);
        x._dnc = dnc.has(p) || dnc.has(p2); x._dupOld = (p.length >= 10 && oldP.has(p)) || (x.address && oldA.has(addrKey(x.address, x.zip))); if (x._dnc && !dnc.has(p) && dnc.has(p2)) x.phone2 = null; });
      U.recs = recs;
      U.check = { total:recs.length, noPhone:recs.filter(x => phoneNorm(x.phone).length < 10).length, dupFile:recs.filter(x => x._dupFile).length, dupOld:recs.filter(x => x._dupOld && !x._dupFile).length, dnc:recs.filter(x => x._dnc).length, dncNote:note };
      count();
    }
    function count(){
      if (!U.check) return;
      const dd = !$('llDropDup') || $('llDropDup').checked, dn = !$('llDropDnc') || $('llDropDnc').checked;
      U.check.keep = U.recs.filter(x => !(dd && (x._dupFile || x._dupOld)) && !(dn && x._dnc)).length;
      const box = $('llMap'); if (!box) return;
      const keepD = $('llDropDup') ? $('llDropDup').checked : true, keepN = $('llDropDnc') ? $('llDropDnc').checked : true;
      box.innerHTML = mapHtml(); $('llDropDup').checked = keepD; $('llDropDnc').checked = keepN;
    }
    draw();

    async function reload(){ await V.lists.open(el, ok); }
    body.addEventListener('change', async e => {
      if (e.target.id === 'llFile') {
        const file = e.target.files[0]; if (!file) { U.rows = null; $('llMap').innerHTML = ''; return; }
        if (file.size > 25 * 1048576) { say('llMsg', 'That file is over 25 MB. Split it first.'); return; }
        const rows = parseCsv(await file.text());
        if (rows.length < 2) { say('llMsg', 'That file has no rows under the header.'); return; }
        U.heads = rows[0].map(h => h.trim()); U.rows = rows.slice(1); U.file = file.name; U.map = guess(U.heads);
        if (!$('llName').value.trim()) $('llName').value = file.name.replace(/\.csv$/i, '').slice(0, 80);
        say('llMsg', ''); await runCheck(); return;
      }
      if (e.target.dataset.map != null) { U.map[e.target.dataset.map] = e.target.value === '' ? undefined : +e.target.value; await runCheck(); return; }
      if (e.target.id === 'llDropDup' || e.target.id === 'llDropDnc') { count(); return; }
      const rep = e.target.closest('[data-rep]');
      if (rep) { const id = +rep.closest('[data-list]').dataset.list, l = lists.find(x => x.id === id), set = new Set(l.reps || []);
        rep.checked ? set.add(rep.dataset.rep) : set.delete(rep.dataset.rep);
        const x = await safe(db().from('lead_lists').update({ reps:[...set] }).eq('id', id)); if (x.error) { rep.checked = !rep.checked; say('llm' + id, errText(x, 'Couldn’t save.')); } else { l.reps = [...set]; say('llm' + id, 'Saved.'); }
        return; }
      const sk = e.target.closest('[data-sk]');
      if (sk) { const id = +sk.closest('[data-list]').dataset.list, l = lists.find(x => x.id === id), k = sk.dataset.sk;
        let v = sk.value === '' ? null : k === 'skip_cost' ? +sk.value : sk.value; if (k === 'skip_status') v = v || 'not_sent';
        const patch = { [k]:v }; if (k === 'skip_status' && v === 'sent' && !l.skip_sent_on) patch.skip_sent_on = PX.isoDay(new Date()); if (k === 'skip_status' && v === 'back' && !l.skip_back_on) patch.skip_back_on = PX.isoDay(new Date());
        const x = await safe(db().from('lead_lists').update(patch).eq('id', id)); if (x.error) say('llm' + id, errText(x, 'Couldn’t save.')); else { Object.assign(l, patch); say('llm' + id, 'Saved.'); if (patch.skip_sent_on || patch.skip_back_on) draw(); }
        return; }
      const up = e.target.closest('[data-skipup]');
      if (up && up.files[0]) await skipUpload(+up.dataset.skipup, up.files[0]);
    });
    body.addEventListener('submit', async e => {
      if (e.target.id !== 'llForm') return; e.preventDefault();
      const name = $('llName').value.trim(); if (!name) return say('llMsg', 'Name the list first.');
      if (U.rows && !U.check) return say('llMsg', 'Still checking the file. One moment.');
      const btn = $('llSave'); btn.disabled = true;
      const dd = $('llDropDup') ? $('llDropDup').checked : true, dn = $('llDropDnc') ? $('llDropDnc').checked : true;
      const keep = U.recs ? U.recs.filter(x => !(dd && (x._dupFile || x._dupOld)) && !(dn && x._dnc)) : [];
      const x = await safe(db().from('lead_lists').insert({ name, kind:$('llKind').value, state:$('llState').value || null, county:$('llCounty').value.trim() || null, source:$('llSource').value.trim() || null,
        records:U.recs ? keep.length : null, cost:$('llCost').value ? +$('llCost').value : null }).select('id').single());
      if (x.error) { btn.disabled = false; return say('llMsg', errText(x, 'Couldn’t add it. Try again.')); }
      const listId = x.data.id;
      for (let i = 0; i < keep.length; i += 500) {
        say('llMsg', 'Saving rows ' + num(i + 1) + ' to ' + num(Math.min(keep.length, i + 500)) + ' of ' + num(keep.length) + '…');
        const part = keep.slice(i, i + 500).map(k => ({ list_id:listId, owner_name:k.owner_name, phone:k.phone ? phoneShow(k.phone) : null, phone2:k.phone2 ? phoneShow(k.phone2) : null, email:k.email,
          address:k.address, city:k.city, state:k.state, zip:k.zip, county:k.county, dnc:!!k._dnc, dup:!!(k._dupFile || k._dupOld), skip_status:phoneNorm(k.phone).length >= 10 ? 'found' : 'not_sent' }));
        const w = await safe(db().from('lead_records').insert(part));
        if (w.error) { btn.disabled = false; return say('llMsg', 'Saved ' + num(i) + ' rows, then stopped: ' + errText(w, 'try again')); }
      }
      await reload();
    });
    async function allRecords(id){
      let out = [];
      for (let from = 0; ; from += 1000) { const r = await safe(db().from('lead_records').select('*').eq('list_id', id).order('id').range(from, from + 999)); if (r.error) throw r.error; out = out.concat(r.data || []); if (!r.data || r.data.length < 1000) break; }
      return out;
    }
    async function skipUpload(id, file){
      say('llm' + id, 'Reading the results…');
      const rows = parseCsv(await file.text()); if (rows.length < 2) return say('llm' + id, 'That file has no rows.');
      const heads = rows[0].map(h => h.trim()), m = guess(heads);
      const phoneCols = heads.map((h, i) => [h, i]).filter(([h]) => /phone|mobile|cell|wireless/i.test(h)).map(x => x[1]);
      if (m.address == null || !phoneCols.length) return say('llm' + id, 'The file needs an address column and at least one phone column.');
      const found = new Map();
      rows.slice(1).forEach(r => { const k = addrKey(r[m.address], m.zip != null ? r[m.zip] : ''); const ps = phoneCols.map(i => phoneNorm(r[i])).filter(p => p.length === 10); if (!found.has(k) || ps.length) found.set(k, ps); });
      let recs; try { recs = await allRecords(id); } catch (er) { return say('llm' + id, 'Couldn’t open the list. Try again.'); }
      const allP = [...new Set([...found.values()].flat())], dnc = new Set();
      for (let i = 0; i < allP.length; i += 2000) { const d = await safe(db().rpc('dnc_check_many', { p_phones:allP.slice(i, i + 2000) })); (d.data || []).forEach(p => dnc.add(p)); }
      let hit = 0, miss = 0, blocked = 0;
      const changes = recs.filter(x => found.has(addrKey(x.address, x.zip)) || found.has(addrKey(x.address, ''))).map(x => {
        const ps = (found.get(addrKey(x.address, x.zip)) || found.get(addrKey(x.address, ''))).filter(p => !dnc.has(p));
        const was = (found.get(addrKey(x.address, x.zip)) || found.get(addrKey(x.address, ''))).length;
        if (ps.length) hit++; else if (was) blocked++; else miss++;
        return { id:x.id, phone:ps[0] ? phoneShow(ps[0]) : x.phone, phone2:ps[1] ? phoneShow(ps[1]) : x.phone2, skip_status:ps.length ? 'found' : 'not_found', dnc:x.dnc || (!ps.length && was > 0) };
      });
      for (let i = 0; i < changes.length; i += 100) {
        say('llm' + id, 'Saving ' + num(Math.min(changes.length, i + 100)) + ' of ' + num(changes.length) + '…');
        await Promise.all(changes.slice(i, i + 100).map(c => safe(db().from('lead_records').update({ phone:c.phone, phone2:c.phone2, skip_status:c.skip_status, dnc:c.dnc }).eq('id', c.id))));
      }
      await safe(db().from('lead_lists').update({ skip_status:'back', skip_back_on:PX.isoDay(new Date()) }).eq('id', id));
      await reload();
      say('llm' + id, num(hit) + ' found, ' + num(miss) + ' not found' + (blocked ? ', ' + num(blocked) + ' only had do-not-call numbers' : '') + '. ' + num(recs.length - changes.length) + ' rows weren’t in the results.');
    }
    body.addEventListener('click', async e => {
      const mo = e.target.closest('[data-more]'); if (mo) { openId = openId === +mo.dataset.more ? null : +mo.dataset.more; draw(); return; }
      const ll = e.target.closest('[data-ll]');
      if (ll) { ll.disabled = true; const x = await safe(db().from('lead_lists').update({ active:ll.getAttribute('aria-pressed') !== 'true' }).eq('id', +ll.dataset.ll)); if (!x.error) await reload(); else ll.disabled = false; return; }
      const del = e.target.closest('[data-del]');
      if (del) { const id = +del.dataset.del, l = lists.find(x => x.id === id);
        if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Delete “' + l.name.slice(0, 30) + '” and its rows? Click again'; setTimeout(() => { if (del.isConnected) { del.dataset.sure = ''; del.textContent = 'Delete list'; } }, 5000); return; }
        del.disabled = true; const x = await safe(db().from('lead_lists').delete().eq('id', id));
        if (x.error) { del.disabled = false; say('llm' + id, /foreign key|violates/i.test(x.error.message || '') ? 'Calls or deals point to this list, so it can’t be deleted. Retire it instead.' : errText(x, 'Couldn’t delete.')); } else await reload();
        return; }
      const cl = e.target.closest('[data-clean]'), sc = e.target.closest('[data-skipcsv]');
      if (cl || sc) { const id = +(cl || sc).dataset[cl ? 'clean' : 'skipcsv'], l = lists.find(x => x.id === id);
        let recs; try { recs = await allRecords(id); } catch (er) { return say('llm' + id, 'Couldn’t open the list. Try again.'); }
        const H = ['Owner name', 'Phone', 'Phone 2', 'Email', 'Property address', 'City', 'State', 'ZIP', 'County'];
        if (cl) { const rows = recs.filter(x => !x.dnc && !x.dup && x.phone); download(slug(l.name) + '-clean.csv', toCsv(H.concat(['Outcome']), rows.map(x => [x.owner_name, x.phone, x.phone2, x.email, x.address, x.city, x.state, x.zip, x.county, x.outcome])));
          say('llm' + id, num(rows.length) + ' rows with a phone, no do-not-call, no duplicates.'); }
        else { const rows = recs.filter(x => !x.dup && !x.phone && x.address); download(slug(l.name) + '-for-skip-trace.csv', toCsv(['Owner name', 'Property address', 'City', 'State', 'ZIP'], rows.map(x => [x.owner_name, x.address, x.city, x.state, x.zip])));
          say('llm' + id, num(rows.length) + ' rows with an address and no phone.'); }
      }
    });
  }};

  // ======================================================================
  // My lead lists (reps)
  // ======================================================================
  V.mylists = { title:'My lead lists', sec:'member', async open(el, ok){
    const body = PX.page(el, 'Calls', 'My lead lists', 'The lists Amr gave you. Call only when the time shows green: it’s the seller’s local time, checked against the federal hours and their state’s rules.');
    const [r, rules] = await Promise.all([safe(db().rpc('my_lead_lists')), safe(db().from('calling_rules').select('*'))]);
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    const lists = r.data || [], CH = window.CallHours;
    if (CH && rules.data) CH.setRules(rules.data);
    let cur = null, recs = [], q = '';
    function drawLists(){
      body.innerHTML = card('Your lists', plural(lists.length, 'list'), lists.length ? lists.map(l => '<div class="p-row"><span><b>' + esc(l.name) + '</b><br><small>' + esc([[l.county, l.state].filter(Boolean).join(', '), num(l.rows) + ' to call', num(l.worked) + ' worked'].filter(Boolean).join(' · ')) + '</small></span>' +
        '<button type="button" class="p-btn" data-openl="' + l.id + '">Open</button></div>').join('') : empty('No lists yet. Amr gives you lists from his Lead lists page.'));
    }
    function drawOne(){
      const l = lists.find(x => x.id === cur), now = new Date();
      const rows = recs.filter(x => !q || (x.owner_name + ' ' + x.address + ' ' + x.phone + ' ' + x.city).toLowerCase().includes(q));
      body.innerHTML = '<div class="px-tools"><button type="button" class="p-btn is-ghost" data-back>All my lists</button><input class="wk-find" type="search" id="mlQ" placeholder="Search name, address or phone" value="' + esc(q) + '"></div>' +
        card(l ? l.name : 'List', plural(rows.length, 'row'), rows.length ? PX.table(['Owner', 'Phone', 'Property', 'Their time', 'Outcome'], rows.slice(0, 500).map(x => {
          const ch = CH ? CH.check(x.state || (l && l.state), now) : null;
          return '<tr><td>' + esc(x.owner_name || '–') + '</td><td>' + (x.phone ? '<a href="tel:' + esc(phoneNorm(x.phone)) + '">' + esc(x.phone) + '</a>' : '–') + (x.phone2 ? '<br><small>' + esc(x.phone2) + '</small>' : '') + '</td>' +
            '<td>' + esc([x.address, x.city, x.state, x.zip].filter(Boolean).join(', ') || '–') + '</td>' +
            '<td>' + (ch ? pill(ch.time, ch.ok ? 'ok' : 'no') + (ch.ok ? '' : '<br><small>' + esc(ch.why) + '</small>') : '<small>No state</small>') + '</td>' +
            '<td><select data-out="' + x.id + '" aria-label="Outcome">' + opt('', '–') + OUTCOMES.map(o => opt(o, o, x.outcome === o)).join('') + '</select></td></tr>';
        })) + (rows.length > 500 ? '<p class="p-hint">Showing the first 500. Search to find others.</p>' : '') : empty('Nothing here.')) +
        '<p class="p-hint">Picking “Do not call” also adds the number to the team’s do-not-call list.</p>';
    }
    drawLists();
    body.addEventListener('click', async e => {
      if (e.target.closest('[data-back]')) { cur = null; q = ''; drawLists(); return; }
      const o = e.target.closest('[data-openl]'); if (!o) return;
      cur = +o.dataset.openl; body.innerHTML = PX.loading;
      recs = [];
      for (let from = 0; ; from += 1000) { const x = await safe(db().from('lead_records').select('id,owner_name,phone,phone2,address,city,state,zip,outcome').eq('list_id', cur).eq('dnc', false).eq('dup', false).order('id').range(from, from + 999)); recs = recs.concat(x.data || []); if (!x.data || x.data.length < 1000) break; }
      drawOne();
    });
    body.addEventListener('input', e => { if (e.target.id === 'mlQ') { q = e.target.value.trim().toLowerCase(); const p = e.target.selectionStart; drawOne(); const i = $('mlQ'); i.focus(); i.setSelectionRange(p, p); } });
    body.addEventListener('change', async e => {
      const s = e.target.closest('[data-out]'); if (!s) return;
      const x = recs.find(r => r.id === +s.dataset.out), v = s.value || null;
      const w = await safe(db().rpc('lead_record_outcome', { p_id:x.id, p_outcome:v }));
      if (w.error) { s.value = x.outcome || ''; return; }
      x.outcome = v;
      if (v === 'Do not call' && x.phone) await safe(db().rpc('dnc_add', { p_phone:x.phone, p_reason:'asked', p_note:'From a lead list' }));
      if (v === 'Wrong number' && x.phone) await safe(db().rpc('dnc_add', { p_phone:x.phone, p_reason:'wrong_number', p_note:'From a lead list' }));
    });
  }};
})();
