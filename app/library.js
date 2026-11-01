// Phase 3: the script and objection library (#library), opened by portal-home.js inside #pView.
// Quick find (one hand, mid-call), the words to say, why they work (English and Arabic), state notes, example
// recordings from the team's best real calls, "Updated" on wording that changed since you read it, "A seller said
// this" counts, and "Practice this" into Call scoring. #library/part-N filters to one scorecard part (Call scoring links
// here from a rep's weakest parts); #library/e-ID opens one entry. Amr writes everything here; content lives only in
// the database (see 20261101030000_script_library.sql).
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const safe = p => p.then(r => r, () => ({}));
  const PARTS = ['Opening and upfront agreement', 'Rapport', 'Property discovery', 'Pain depth', 'Timeline, money, decision makers',
    'Getting their number', 'Offer framing', 'Objection handling', 'Listening and talk ratio', 'Close and next step'];
  const day = d => { try { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' }); } catch (e) { return ''; } };
  const norm = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
  const S = { rows:[], reads:new Map(), heard:new Map(), ex:[], vers:[], q:'', filter:'all', part:null, openId:null, calls:[], owner:false, editing:null, urls:new Map() };

  function filtered(){
    const q = norm(S.q).trim(), words = q ? q.split(' ') : [];
    let list = S.rows.filter(r => S.owner || r.active);
    if (S.part) list = list.filter(r => (r.parts || []).includes(S.part));
    if (S.filter === 'script' || S.filter === 'objection') list = list.filter(r => r.kind === S.filter);
    if (S.filter === 'updated') list = list.filter(isUpdated);
    if (words.length) list = list.filter(r => { const t = norm(r.title + ' ' + r.section + ' ' + r.body + ' ' + r.why); return words.every(w => t.includes(w)); });
    if (S.filter === 'heard') list = list.filter(r => r.kind === 'objection').sort((a, b) => ((S.heard.get(b.id) || {}).heard || 0) - ((S.heard.get(a.id) || {}).heard || 0));
    else list.sort((a, b) => a.section.localeCompare(b.section) || a.sort - b.sort || a.title.localeCompare(b.title));
    return list;
  }
  const isUpdated = r => { const v = S.reads.get(r.id); return v != null && v < r.version; };

  function rowHtml(r){
    const h = S.heard.get(r.id) || {}, ex = S.ex.filter(x => x.entry_id === r.id), open = S.openId === r.id;
    return '<article class="lb-entry' + (open ? ' is-open' : '') + (r.active ? '' : ' is-off') + '" data-entry="' + r.id + '">' +
      '<button type="button" class="lb-head" aria-expanded="' + open + '" data-open="' + r.id + '"><span class="lb-kind">' + (r.kind === 'objection' ? 'Objection' : 'Script') + '</span>' +
        '<b>' + esc(r.kind === 'objection' ? '“' + r.title + '”' : r.title) + '</b><span class="lb-tags">' + esc(r.section) +
        (isUpdated(r) ? ' <span class="p-pill">Updated</span>' : '') + (h.heard ? ' <span class="p-pill is-plain">Heard ' + h.heard + '</span>' : '') + (ex.length ? ' <span class="p-pill is-ok">Example</span>' : '') +
        (r.active ? '' : ' <span class="p-pill is-plain">Turned off</span>') + '</span></button>' +
      (open ? bodyHtml(r, h, ex) : '') + '</article>';
  }
  function bodyHtml(r, h, ex){
    const vs = S.vers.filter(v => v.entry_id === r.id).sort((a, b) => b.version - a.version);
    return '<div class="lb-body">' +
      (isUpdated(r) ? '<p class="lb-upd">The wording changed since you last read it.</p>' : '') +
      '<div class="lb-say">' + esc(r.body || '(No wording yet)') + '</div>' +
      (r.why ? '<h4>Why it works</h4><p>' + esc(r.why) + '</p>' : '') +
      (r.why_ar ? '<h4>بالعربي</h4><p dir="rtl" lang="ar" class="lb-ar">' + esc(r.why_ar) + '</p>' : '') +
      ((r.state_notes || []).length ? '<h4>By state</h4><ul class="lb-states">' + r.state_notes.map(s => '<li><b>' + esc(s.state) + '</b> ' + esc(s.note) + '</li>').join('') + '</ul>' : '') +
      ((r.parts || []).length ? '<p class="lb-parts">Trains: ' + r.parts.map(p => esc(PARTS[p - 1])).join(' · ') + '</p>' : '') +
      (ex.length ? '<h4>Hear it on a real call</h4>' + ex.map(x => '<div class="lb-ex"><span>' + esc(x.title || 'Real call') + ' · ' + esc(x.rep) + ' · ' + x.total + ' of 50</span><audio controls preload="none" data-path="' + esc(x.path) + '"></audio>' +
        (S.owner ? '<button type="button" class="p-btn lb-ghost" data-unex="' + esc(x.upload_id) + '">Remove example</button>' : '') + '</div>').join('') : '') +
      '<div class="lb-acts">' + (r.kind === 'objection' ? '<button type="button" class="p-btn lb-ghost" data-heard="' + r.id + '">A seller said this</button>' : '') +
        '<a class="p-btn" href="#scoring/obj-' + r.id + '">Practice this</a>' + (S.owner ? '<button type="button" class="p-btn lb-ghost" data-edit="' + r.id + '">Edit</button>' : '') + '</div>' +
      (r.kind === 'objection' ? '<p class="lb-heard" id="lbHeard' + r.id + '">' + heardTxt(h) + '</p>' : '') +
      (S.owner ? exPicker(r, ex) : '') +
      (vs.length ? '<details class="lb-old"><summary>Earlier wording (' + vs.length + ')</summary>' + vs.map(v => '<div><small>Version ' + v.version + ', until ' + esc(day(v.replaced_at)) + '</small><p>' + esc(v.body) + '</p></div>').join('') + '</details>' : '') + '</div>';
  }
  const heardTxt = h => h.heard ? 'Sellers said this ' + h.heard + (h.heard === 1 ? ' time' : ' times') + ' in the last 30 days' + (h.mine ? ' (' + h.mine + ' on your calls)' : '') + '.' : 'Tap “A seller said this” whenever you hear it, so the team knows what comes up most.';
  function exPicker(r, ex){
    const have = new Set(ex.map(x => x.upload_id)), c = S.calls.filter(x => !have.has(x.id));
    return c.length ? '<div class="lb-expick"><label class="sc-f">Add an example call (real calls scored 45 or more)<select data-expick="' + r.id + '"><option value="">Pick a call</option>' +
      c.map(x => '<option value="' + esc(x.id) + '">' + esc((x.title || 'Real call') + ' · ' + x.score.total + ' of 50 · ' + day(x.created_at)) + '</option>').join('') + '</select></label></div>' : '';
  }

  function listHtml(){
    const list = filtered();
    if (!S.rows.length) return '<p class="p-card p-empty">' + (S.owner ? 'The library is empty. Add the first script or objection above.' : 'Nothing here yet. Amr is adding the scripts and objection answers.') + '</p>';
    if (!list.length) return '<p class="p-card p-empty">Nothing matches. Try fewer words.</p>';
    let sec = '', out = '';
    list.forEach(r => { if (S.filter !== 'heard' && r.section !== sec) { sec = r.section; out += '<h3 class="lb-sec">' + esc(sec) + '</h3>'; } out += rowHtml(r); });
    return out;
  }
  function draw(){ $('lbList').innerHTML = listHtml(); signAudio(); }

  async function signAudio(){
    const T = window.TalentsApp || {}, els = [...document.querySelectorAll('#lbList audio[data-path]')];
    for (const a of els) {
      const p = a.dataset.path;
      if (!S.urls.has(p)) { const r = await safe(T.db.storage.from('hub-uploads').createSignedUrl(p, 3600)); if (r.data && r.data.signedUrl) S.urls.set(p, r.data.signedUrl); }
      if (S.urls.has(p)) a.src = S.urls.get(p);
    }
  }

  function editor(r){
    r = r || { kind:'objection', section:'', title:'', body:'', why:'', why_ar:'', state_notes:[], parts:[], applies:'both', active:true };
    return '<section class="p-card lb-form" aria-labelledby="lbFormH"><div class="p-card-head"><h2 id="lbFormH">' + (r.id ? 'Edit' : 'Add a script or objection') + '</h2></div>' +
      '<div class="sc-2"><label class="sc-f">Kind<select id="lfKind"><option value="objection"' + (r.kind === 'objection' ? ' selected' : '') + '>Objection</option><option value="script"' + (r.kind === 'script' ? ' selected' : '') + '>Script</option></select></label>' +
      '<label class="sc-f">Section<input type="text" id="lfSection" maxlength="60" value="' + esc(r.section) + '" placeholder="For example: Price, Opening, Timeline"></label></div>' +
      '<label class="sc-f">' + 'Title (for an objection: what the seller says)<input type="text" id="lfTitle" maxlength="160" value="' + esc(r.title) + '"></label>' +
      '<label class="sc-f">What to say (English)<textarea id="lfBody" rows="5" maxlength="6000">' + esc(r.body) + '</textarea></label>' +
      '<label class="sc-f">Why it works<textarea id="lfWhy" rows="2" maxlength="1500">' + esc(r.why) + '</textarea></label>' +
      '<label class="sc-f">Why it works, in Arabic (optional)<textarea id="lfWhyAr" rows="2" maxlength="1500" dir="rtl" lang="ar">' + esc(r.why_ar) + '</textarea></label>' +
      '<label class="sc-f">By state (one per line, like “OH: Ohio sellers expect the auditor value.”)<textarea id="lfStates" rows="2">' + esc((r.state_notes || []).map(s => s.state + ': ' + s.note).join('\n')) + '</textarea></label>' +
      '<fieldset class="lb-partpick"><legend>Which scorecard parts it trains</legend>' + PARTS.map((p, i) => '<label class="sc-tick"><input type="checkbox" value="' + (i + 1) + '"' + ((r.parts || []).includes(i + 1) ? ' checked' : '') + '><span>' + esc(p) + '</span></label>').join('') + '</fieldset>' +
      (r.id ? '<label class="sc-tick"><input type="checkbox" id="lfActive"' + (r.active ? ' checked' : '') + '><span>Show it to the team</span></label>' : '') +
      '<div class="sc-acts"><button type="button" class="p-btn" id="lfSave" data-id="' + (r.id || '') + '">' + (r.id ? 'Save' : 'Add it') + '</button>' + (r.id ? '<button type="button" class="p-btn lb-ghost" id="lfCancel">Cancel</button>' : '') + '</div>' +
      (r.id ? '<p class="p-empty">Changing the wording marks it “Updated” for everyone who read it, and keeps the old wording.</p>' : '') + '<p class="p-empty" id="lfMsg" role="status"></p></section>';
  }

  async function load(db){
    const [e, rd, hc, ex, vs, calls] = await Promise.all([safe(db.from('library_entries').select('*').order('sort')), safe(db.from('library_reads').select('entry_id,version')),
      safe(db.rpc('library_heard_counts', { p_days:30 })), safe(db.rpc('library_example_calls')), safe(db.from('library_versions').select('entry_id,version,body,replaced_at')),
      S.owner ? safe(db.from('hub_uploads').select('id,title,score,created_at,real_call,consent').eq('course', 'calls').eq('real_call', true).order('created_at', { ascending:false })) : Promise.resolve({})]);
    S.rows = e.data || []; S.reads = new Map((rd.data || []).map(x => [x.entry_id, x.version])); S.heard = new Map((hc.data || []).map(x => [x.entry_id, x]));
    S.ex = ex.data || []; S.vers = vs.data || []; S.calls = (calls.data || []).filter(x => x.consent && x.score && +x.score.total >= 45);
    return e.error;
  }

  async function open(el, isCurrent){
    const T = window.TalentsApp || {}, db = T.db;
    S.owner = T.role === 'owner'; S.editing = null; S.urls = new Map();
    const sub = (location.hash.split('/')[1] || '');
    S.part = /^part-([1-9]|10)$/.test(sub) ? +sub.slice(5) : null; S.openId = /^e-\d+$/.test(sub) ? +sub.slice(2) : null;
    el.innerHTML = '<div class="p-wrap"><section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">Calls</span><h1>Scripts and objections</h1><p>What to say, and why it works. Search it mid-call.</p></div></section><p class="p-loading">Loading…</p></div>';
    const err = await load(db);
    if (!isCurrent()) return;
    const wrap = el.querySelector('.p-wrap');
    wrap.querySelector('.p-loading').outerHTML = (err ? '<p class="p-card p-empty">Couldn’t load the library. Check your connection and try again.</p>' : '') +
      (S.owner ? '<div id="lbEdit">' + editor() + '</div>' : '') +
      (S.owner ? topHeard() : '') +
      '<div class="lb-find"><label class="lb-search"><span class="p-vh">Search the library</span><input type="search" id="lbQ" placeholder="What did the seller say? Like “too low”" autocomplete="off" enterkeyhint="search"></label>' +
      '<div class="lb-chips" role="group" aria-label="Show">' + [['all', 'All'], ['objection', 'Objections'], ['script', 'Scripts'], ['updated', 'Updated'], ['heard', 'Most heard']].map(([k, t]) => '<button type="button" class="lb-chip" data-filter="' + k + '" aria-pressed="' + (S.filter === k) + '">' + t + '</button>').join('') + '</div>' +
      (S.part ? '<p class="lb-partnote">Showing what trains <b>' + esc(PARTS[S.part - 1]) + '</b>. <a href="#library">Show everything</a></p>' : '') + '</div>' +
      '<div id="lbList"></div>';
    draw();
    if (S.openId) markRead(db, S.openId);
    wire(el, db, isCurrent);
    if (S.openId) { const a = el.querySelector('[data-entry="' + S.openId + '"]'); if (a) a.scrollIntoView({ block:'start' }); }
  }
  function topHeard(){
    const top = [...S.heard.values()].sort((a, b) => b.heard - a.heard).slice(0, 5).map(h => ({ h, r:S.rows.find(r => r.id === h.entry_id) })).filter(x => x.r);
    return '<section class="p-card lb-top"><div class="p-card-head"><h2>What sellers say most</h2><span>Last 30 days</span></div>' +
      (top.length ? top.map(x => '<div class="p-row"><span>“' + esc(x.r.title) + '”</span><span class="p-pill is-plain">' + x.h.heard + '</span></div>').join('') : '<p class="p-empty">Nothing tapped yet. Reps tap “A seller said this” on an objection when they hear it.</p>') + '</section>';
  }

  async function markRead(db, id){
    const r = S.rows.find(x => x.id === id); if (!r) return;
    if (S.reads.get(id) === r.version) return;
    const first = !S.reads.has(id);
    await safe(db.from('library_reads').upsert({ entry_id:id, version:r.version }, { onConflict:'user_id,entry_id' }));
    if (first) S.reads.set(id, r.version);   // a first read never shows as Updated; a re-read clears it next time the page opens
  }

  function wire(el, db, isCurrent){
    const wrap = el.querySelector('.p-wrap');
    wrap.addEventListener('input', e => { if (e.target.id === 'lbQ') { S.q = e.target.value; draw(); } });
    wrap.addEventListener('click', async e => {
      const f = e.target.closest('[data-filter]');
      if (f) { S.filter = f.dataset.filter; wrap.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === f))); draw(); return; }
      const o = e.target.closest('[data-open]');
      if (o) { const id = +o.dataset.open; S.openId = S.openId === id ? null : id; draw(); if (S.openId) markRead(db, id); return; }
      const h = e.target.closest('[data-heard]');
      if (h) {
        h.disabled = true; const id = +h.dataset.heard;
        const r = await safe(db.from('library_heard').insert({ entry_id:id })); if (!isCurrent()) return;
        if (r.error) { h.disabled = false; return; }
        const c = S.heard.get(id) || { entry_id:id, heard:0, mine:0 }; c.heard++; c.mine++; S.heard.set(id, c);
        const p = $('lbHeard' + id); if (p) p.textContent = heardTxt(c) + ' Counted.';
        setTimeout(() => { h.disabled = false; }, 1500);
        return;
      }
      const ed = e.target.closest('[data-edit]');
      if (ed) { $('lbEdit').innerHTML = editor(S.rows.find(r => r.id === +ed.dataset.edit)); $('lbFormH').scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      if (e.target.closest('#lfCancel')) { $('lbEdit').innerHTML = editor(); return; }
      if (e.target.closest('#lfSave')) { await save(db, isCurrent); return; }
      const ux = e.target.closest('[data-unex]');
      if (ux) { ux.disabled = true; const r = await safe(db.from('library_examples').delete().eq('entry_id', S.openId).eq('upload_id', ux.dataset.unex)); if (!isCurrent()) return;
        if (!r.error) { await load(db); draw(); } return; }
    });
    wrap.addEventListener('change', async e => {
      const p = e.target.closest('[data-expick]'); if (!p || !p.value) return;
      p.disabled = true; const r = await safe(db.from('library_examples').insert({ entry_id:+p.dataset.expick, upload_id:p.value })); if (!isCurrent()) return;
      if (r.error) { p.disabled = false; return; }
      await load(db); draw();
    });
  }

  async function save(db, isCurrent){
    const id = +$('lfSave').dataset.id || null, msg = $('lfMsg');
    const states = $('lfStates').value.split('\n').map(l => l.match(/^\s*([A-Za-z]{2})\s*[:\-]\s*(.+)$/)).filter(Boolean).map(m => ({ state:m[1].toUpperCase(), note:m[2].trim() }));
    const row = { kind:$('lfKind').value, section:$('lfSection').value.trim() || 'General', title:$('lfTitle').value.trim(), body:$('lfBody').value.trim(), why:$('lfWhy').value.trim(), why_ar:$('lfWhyAr').value.trim(),
      state_notes:states, parts:[...document.querySelectorAll('.lb-partpick input:checked')].map(i => +i.value) };
    if (!row.title) { msg.textContent = 'Give it a title.'; $('lfTitle').focus(); return; }
    if (id) row.active = $('lfActive').checked;
    $('lfSave').disabled = true;
    const r = await safe(id ? db.from('library_entries').update(row).eq('id', id) : db.from('library_entries').insert(row));
    if (!isCurrent()) return;
    if (r.error) { $('lfSave').disabled = false; msg.textContent = 'Couldn’t save it. Try again.'; return; }
    window.PortalHome.open('library');
  }

  window.ScriptLibrary = { open, parts:PARTS };
})();
