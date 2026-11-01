// Phase 3: Call scoring and roleplay practice (#scoring), opened by portal-home.js inside #pView.
// A rep sends a real seller call (everyone on it agreed to be recorded) or a roleplay against one of Amr's scenarios:
// recorded here or picked from a file. It goes to the private "hub-uploads" bucket at <user>/calls/<file> and a
// hub_uploads row (course "calls"); Amr scores it in the Review center on the 50-point scorecard. Each rep sees
// their own scores over time and which parts to work on; Amr also sees the whole team and writes the scenarios.
// Everything goes through the page's Supabase client and the database's rules (see 20261101010000_call_scoring.sql).
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const CATS = ['Opening and upfront agreement', 'Rapport', 'Property discovery', 'Pain depth', 'Timeline, money, decision makers',
    'Getting their number', 'Offer framing', 'Objection handling', 'Listening and talk ratio', 'Close and next step'];
  const band = t => t >= 45 ? 'Ready for live leads' : t >= 38 ? 'Solid. Sharpen one or two areas' : t >= 30 ? 'Keep drilling the stages' : 'Back to the script daily';
  const LEVEL = { easy:'Easy', medium:'Medium', hard:'Hard' };
  const MAX_S = 30 * 60, MAX_B = 50 * 1024 * 1024;
  const clock = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const day = d => { try { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' }); } catch (e) { return ''; } };
  const extOf = m => /mp4|m4a|aac/.test(m) ? 'm4a' : /ogg/.test(m) ? 'ogg' : /mpeg|mp3/.test(m) ? 'mp3' : /wav/.test(m) ? 'wav' : 'webm';
  const pickMime = () => { if (!window.MediaRecorder) return null; for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported(t)) return t; return ''; };
  const safe = p => p.then(r => r, () => ({}));
  const S = { kind:'roleplay', scenario:null, blob:null, mime:'', secs:0, rec:null, stream:null, timer:null, started:0, scen:[], url:null };

  function stopRec(){ try { if (S.rec && S.rec.state !== 'inactive') S.rec.stop(); } catch (e) {} if (S.stream) S.stream.getTracks().forEach(t => t.stop()); S.stream = null; clearInterval(S.timer); }
  function clearTake(){ if (S.url) URL.revokeObjectURL(S.url); S.url = null; S.blob = null; S.secs = 0; }

  // ---------- parts ----------
  const scenCard = (x, owner) => '<article class="p-card sc-card"><div class="sc-head"><span class="p-pill is-plain">' + esc(x.kind === 'house' ? 'House' : 'Land') + '</span><span class="p-pill' + (x.level === 'hard' ? ' is-no' : x.level === 'easy' ? ' is-ok' : '') + '">' + esc(LEVEL[x.level] || '') + '</span>' +
      (owner && !x.active ? '<span class="p-pill is-plain">Turned off</span>' : '') + '</div><h3>' + esc(x.title) + '</h3>' +
    (x.seller ? '<p><b>Who you’re calling:</b> ' + esc(x.seller) + '</p>' : '') + (x.know ? '<p><b>What you know:</b> ' + esc(x.know) + '</p>' : '') + (x.goal ? '<p><b>A good call ends with:</b> ' + esc(x.goal) + '</p>' : '') +
    (x.hidden ? '<details class="sc-hidden"><summary>For the person playing the seller</summary><p>' + esc(x.hidden) + '</p></details>' : '') +
    '<div class="sc-acts"><button type="button" class="p-btn" data-practice="' + x.id + '">Practice this one</button>' + (owner ? '<button type="button" class="p-btn is-ghost" data-sedit="' + x.id + '">Edit</button>' : '') + '</div></article>';

  function sendForm(){
    return '<section class="p-card sc-send" aria-labelledby="scSendH"><div class="p-card-head"><h2 id="scSendH">Send a call to score</h2></div>' +
      '<div class="p-seg" role="group" aria-label="What kind of call"><button type="button" class="p-seg-b" data-kind="roleplay" aria-pressed="' + (S.kind === 'roleplay') + '">Roleplay</button><button type="button" class="p-seg-b" data-kind="real" aria-pressed="' + (S.kind === 'real') + '">Real call</button></div>' +
      '<div id="scKindBox"></div>' +
      '<label class="sc-f">Title (optional)<input type="text" id="scTitle" maxlength="120" autocomplete="off" placeholder="' + (S.kind === 'real' ? 'For example: Ross County seller, first call' : 'For example: Inherited land, take 2') + '"></label>' +
      '<div class="sc-rec"><button type="button" class="p-btn" id="scRec">Record here</button><button type="button" class="p-btn is-ghost" id="scPick">Choose a recording</button><input type="file" id="scFile" accept="audio/*" hidden><span id="scTake" aria-live="polite"></span></div>' +
      '<audio id="scPlay" controls hidden></audio>' +
      '<label class="sc-f">Note for Amr (optional)<textarea id="scNote" maxlength="600" rows="2"></textarea></label>' +
      '<button type="button" class="p-btn" id="scSend">Send for scoring</button><p class="p-empty" id="scMsg" role="status"></p></section>';
  }
  function kindBox(){
    if (S.kind === 'real') return '<label class="sc-tick"><input type="checkbox" id="scConsent"><span>Everyone on this call agreed to be recorded</span></label>';
    const list = S.scen.filter(x => x.active);
    return list.length ? '<label class="sc-f">Scenario<select id="scScen"><option value="">Pick a scenario</option>' + list.map(x => '<option value="' + x.id + '"' + (x.id === S.scenario ? ' selected' : '') + '>' + esc(x.title) + ' · ' + esc(LEVEL[x.level] || '') + '</option>').join('') + '</select></label>'
      : '<p class="p-empty">No scenarios yet. You can still send a roleplay; say in the note what you practiced.</p>';
  }

  function scoresHtml(rows, comments){
    const scored = rows.filter(r => r.score && Array.isArray(r.score.cats));
    if (!rows.length) return '<p class="p-card p-empty">No calls sent yet. Your scores and Amr’s notes show up here.</p>';
    let top = '';
    if (scored.length) {
      const last5 = scored.slice(0, 5), avg = Math.round(last5.reduce((a, r) => a + (+r.score.total || 0), 0) / last5.length);
      const best = Math.max(...scored.map(r => +r.score.total || 0));
      const cat = CATS.map((c, i) => ({ c, v:last5.reduce((a, r) => a + (+r.score.cats[i] || 0), 0) / last5.length }));
      const weak = cat.slice().sort((a, b) => a.v - b.v).slice(0, 2).map(x => x.c);
      const bars = scored.slice(0, 12).reverse();
      top = '<div class="p-today sc-tiles"><div class="p-tile"><b>' + avg + '</b><span>average of your last ' + last5.length + '</span></div><div class="p-tile"><b>' + best + '</b><span>best score</span></div><div class="p-tile"><b>' + scored.length + '</b><span>' + (scored.length === 1 ? 'call scored' : 'calls scored') + '</span></div></div>' +
        '<p class="sc-band">' + esc(band(avg)) + '</p>' +
        '<div class="sc-trend" role="img" aria-label="' + esc('Scores, oldest to newest: ' + bars.map(r => r.score.total).join(', ')) + '">' + bars.map(r => '<span class="sc-bar' + (r.real_call ? ' is-real' : '') + '" data-h="' + Math.round((+r.score.total || 0) * 2) + '"><i>' + esc(r.score.total) + '</i></span>').join('') + '</div>' +
        '<p class="sc-legend"><span class="sc-key"></span> Roleplay <span class="sc-key is-real"></span> Real call</p>' +
        '<h3 class="sc-h3">Each part, average of your last ' + last5.length + '</h3><div class="sc-cats">' + cat.map((x, i) => '<div class="sc-cat' + (weak.includes(x.c) ? ' is-weak' : '') + '"><span>' + esc(x.c) + (weak.includes(x.c) ? ' <b>Work on this</b> <a href="#library/part-' + (i + 1) + '">Read the library</a>' : '') + '</span><span class="sc-meter" data-w="' + Math.round(x.v * 20) + '"><i></i></span><em>' + x.v.toFixed(1) + '</em></div>').join('') + '</div>';
    }
    return top + '<h3 class="sc-h3">Your calls</h3><div class="p-card sc-list">' + rows.slice(0, 20).map(r => {
      const notes = comments.filter(c => c.upload_id === r.id);
      return '<div class="sc-row"><div><b>' + esc(r.title || (r.real_call ? 'Real call' : 'Roleplay')) + '</b><small>' + esc(day(r.created_at)) + ' · ' + (r.real_call ? 'Real call' : 'Roleplay') + '</small>' +
        (notes.length ? '<ul class="sc-notes">' + notes.map(c => '<li>' + (c.at_s != null ? '<b>' + clock(c.at_s) + '</b> ' : '') + esc(c.body) + '</li>').join('') + '</ul>' : '') + '</div>' +
        '<span class="p-pill' + (r.status === 'redo' ? ' is-no' : r.score ? ' is-ok' : ' is-plain') + '">' + esc(r.score ? r.score.total + ' of 50' : r.status === 'redo' ? 'Send it again' : r.status === 'approved' ? 'Reviewed' : 'Waiting for Amr') + '</span></div>';
    }).join('') + '</div>';
  }

  function teamHtml(rows, names){
    const by = {};
    rows.filter(r => r.score && r.score.total != null).forEach(r => (by[r.user_id] = by[r.user_id] || []).push(r));
    const waiting = rows.filter(r => r.status === 'waiting').length;
    const people = Object.keys(by).map(id => { const l = by[id], last5 = l.slice(0, 5), avg = Math.round(last5.reduce((a, r) => a + +r.score.total, 0) / last5.length);
      const prev = l.slice(5, 10), pAvg = prev.length ? Math.round(prev.reduce((a, r) => a + +r.score.total, 0) / prev.length) : null;
      return { id, name:names[id] || 'Someone', n:l.length, last:+l[0].score.total, avg, delta:pAvg == null ? null : avg - pAvg }; }).sort((a, b) => a.name.localeCompare(b.name));
    return '<section aria-labelledby="scTeamH"><h2 class="p-h2" id="scTeamH">Team scores</h2>' +
      '<p class="sc-wait">' + (waiting ? '<a class="p-btn" href="#review">' + waiting + (waiting === 1 ? ' call' : ' calls') + ' waiting to score</a>' : 'Nothing waiting to score.') + '</p>' +
      (people.length ? '<div class="p-tablewrap"><table class="p-table"><thead><tr><th scope="col">Name</th><th scope="col">Last score</th><th scope="col">Average of last 5</th><th scope="col">Trend</th><th scope="col">Scored</th></tr></thead><tbody>' +
        people.map(p => '<tr><td><a href="#review/' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a></td><td>' + p.last + ' of 50</td><td>' + p.avg + ' · ' + esc(band(p.avg)) + '</td><td>' + (p.delta == null ? '–' : p.delta > 0 ? 'Up ' + p.delta : p.delta < 0 ? 'Down ' + (-p.delta) : 'Same') + '</td><td>' + p.n + '</td></tr>').join('') + '</tbody></table></div>'
        : '<p class="p-card p-empty">No calls scored yet. Score them in the Review center; they show here.</p>') + '</section>';
  }

  function scenForm(x){
    x = x || {};
    return '<section class="p-card sc-sform" aria-labelledby="scSformH"><div class="p-card-head"><h2 id="scSformH">' + (x.id ? 'Edit scenario' : 'Add a scenario') + '</h2></div>' +
      '<label class="sc-f">Title<input type="text" id="sfTitle" maxlength="100" value="' + esc(x.title || '') + '"></label>' +
      '<div class="sc-2"><label class="sc-f">Kind<select id="sfKind"><option value="land"' + (x.kind === 'house' ? '' : ' selected') + '>Land</option><option value="house"' + (x.kind === 'house' ? ' selected' : '') + '>House</option></select></label>' +
      '<label class="sc-f">Level<select id="sfLevel">' + Object.entries(LEVEL).map(([k, v]) => '<option value="' + k + '"' + ((x.level || 'medium') === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label></div>' +
      '<label class="sc-f">Who the rep is calling<textarea id="sfSeller" maxlength="400" rows="2">' + esc(x.seller || '') + '</textarea></label>' +
      '<label class="sc-f">What the rep knows before dialing<textarea id="sfKnow" maxlength="1200" rows="3">' + esc(x.know || '') + '</textarea></label>' +
      '<label class="sc-f">A good call ends with<textarea id="sfGoal" maxlength="400" rows="2">' + esc(x.goal || '') + '</textarea></label>' +
      '<label class="sc-f">Only for the person playing the seller<textarea id="sfHidden" maxlength="1500" rows="3">' + esc(x.hidden || '') + '</textarea></label>' +
      (x.id ? '<label class="sc-tick"><input type="checkbox" id="sfActive"' + (x.active ? ' checked' : '') + '><span>Show it to the team</span></label>' : '') +
      '<div class="sc-acts"><button type="button" class="p-btn" id="sfSave" data-id="' + (x.id || '') + '">' + (x.id ? 'Save' : 'Add scenario') + '</button>' + (x.id ? '<button type="button" class="p-btn is-ghost" id="sfCancel">Cancel</button>' : '') + '</div><p class="p-empty" id="sfMsg" role="status"></p></section>';
  }

  // ---------- the page ----------
  async function open(el, isCurrent){
    const T = window.TalentsApp || {}, db = T.db, owner = T.role === 'owner';
    stopRec(); clearTake();
    el.innerHTML = '<div class="p-wrap"><section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">Calls</span><h1>Call scoring</h1><p>Send a real call or a roleplay. Amr scores it on the 50-point scorecard, and your scores show here over time.</p></div></section><p class="p-loading">Loading…</p></div>';
    const [sc, up, cm, nm] = await Promise.all([safe(db.from('roleplay_scenarios').select('*').order('created_at')),
      safe(db.from('hub_uploads').select('id,user_id,title,status,score,real_call,scenario_id,created_at').eq('course', 'calls').order('created_at', { ascending:false })),
      safe(db.from('hub_upload_comments').select('upload_id,at_s,body,created_at').order('created_at')),
      owner ? safe(db.from('members').select('user_id,name')) : Promise.resolve({})]);
    if (!isCurrent()) return;
    S.scen = sc.data || [];
    const rows = up.data || [], mine = rows.filter(r => r.user_id === (T.user || {}).id), names = {};
    (nm.data || []).forEach(x => { names[x.user_id] = x.name; });
    const wrap = el.querySelector('.p-wrap');
    wrap.querySelector('.p-loading').outerHTML =
      (up.error ? '<p class="p-card p-empty">Couldn’t load your calls. Check your connection and try again.</p>' : '') +
      (owner ? teamHtml(rows, names) : '') +
      '<div class="p-grid sc-top">' + sendForm() + '<section aria-labelledby="scMineH"><h2 class="p-h2" id="scMineH">' + (owner ? 'Your own calls' : 'Your scores') + '</h2>' + scoresHtml(mine, cm.data || []) + '</section></div>' +
      '<section aria-labelledby="scScenH"><h2 class="p-h2" id="scScenH">Roleplay scenarios</h2><p class="sc-how">Have a teammate play the seller using the notes under “For the person playing the seller”, record the whole call, and send it.</p>' +
        (owner ? '<div id="scSform">' + scenForm() + '</div>' : '') +
        '<div class="p-grid sc-scens">' + (S.scen.filter(x => owner || x.active).map(x => scenCard(x, owner)).join('') || '<p class="p-card p-empty">No scenarios yet.' + (owner ? ' Add the first one above.' : ' Amr adds them here.') + '</p>') + '</div></section>';
    wrap.querySelectorAll('[data-h]').forEach(b => { b.style.height = Math.max(4, +b.dataset.h) + '%'; });
    wrap.querySelectorAll('[data-w] i').forEach(i => { i.style.width = i.parentElement.dataset.w + '%'; });
    $('scKindBox').innerHTML = kindBox();
    wire(el, isCurrent, db, T);
    // From the library's "Practice this" (#scoring/obj-ID): a roleplay on that script or objection
    const m = (location.hash.split('/')[1] || '').match(/^obj-(\d+)$/);
    if (m) {
      const r = await safe(db.from('library_entries').select('id,kind,title').eq('id', +m[1]).maybeSingle());
      if (!isCurrent() || !r.data) return;
      S.kind = 'roleplay'; el.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === 'roleplay'))); $('scKindBox').innerHTML = kindBox();
      $('scTitle').value = (r.data.kind === 'objection' ? 'Objection: ' : 'Script: ') + r.data.title;
      $('scNote').value = 'Practicing ' + (r.data.kind === 'objection' ? 'the answer to “' + r.data.title + '”' : 'the “' + r.data.title + '” script') + ' from the library.';
      say('Have a teammate play the seller and use this line, then record your answer.');
      $('scSendH').scrollIntoView({ block:'start' });
    }
  }

  function say(m, bad){ const n = $('scMsg'); if (n) { n.textContent = m; n.classList.toggle('is-bad', !!bad); } }
  function showTake(){
    const p = $('scPlay'); if (!p) return;
    if (S.blob) { S.url = S.url || URL.createObjectURL(S.blob); p.src = S.url; p.hidden = false; $('scTake').textContent = 'Ready to send · ' + clock(S.secs); }
    else { p.hidden = true; p.removeAttribute('src'); $('scTake').textContent = ''; }
  }

  function wire(el, isCurrent, db, T){
    el.querySelector('.p-wrap').addEventListener('click', async e => {
      const k = e.target.closest('[data-kind]');
      if (k) { S.kind = k.dataset.kind; el.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b === k))); $('scKindBox').innerHTML = kindBox(); $('scTitle').placeholder = S.kind === 'real' ? 'For example: Ross County seller, first call' : 'For example: Inherited land, take 2'; return; }
      const pr = e.target.closest('[data-practice]');
      if (pr) { S.kind = 'roleplay'; S.scenario = +pr.dataset.practice; el.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === 'roleplay'))); $('scKindBox').innerHTML = kindBox(); $('scSendH').scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      if (e.target.closest('#scPick')) { $('scFile').click(); return; }
      if (e.target.closest('#scRec')) {
        const b = $('scRec');
        if (S.rec && S.rec.state === 'recording') { S.rec.stop(); return; }
        const mime = pickMime();
        if (mime === null) { say('This browser can’t record. Record on your phone’s recorder app and choose the file instead.', true); return; }
        try { S.stream = await navigator.mediaDevices.getUserMedia({ audio:true }); } catch (err) { say('The microphone is blocked. Allow it for this site, or choose a recording instead.', true); return; }
        clearTake(); showTake();
        const chunks = []; S.rec = new MediaRecorder(S.stream, mime ? { mimeType:mime } : undefined); S.mime = S.rec.mimeType || mime || 'audio/webm';
        S.rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
        S.rec.onstop = () => { clearInterval(S.timer); if (S.stream) S.stream.getTracks().forEach(t => t.stop()); S.stream = null; S.secs = (Date.now() - S.started) / 1000;
          S.blob = new Blob(chunks, { type:S.mime.split(';')[0] }); b.textContent = 'Record again'; showTake(); };
        S.started = Date.now(); S.rec.start(1000); b.textContent = 'Stop recording';
        S.timer = setInterval(() => { const s = (Date.now() - S.started) / 1000; $('scTake').textContent = 'Recording · ' + clock(s); if (s >= MAX_S) S.rec.stop(); }, 500);
        return;
      }
      if (e.target.closest('#scSend')) await send(db, T, isCurrent, el);
      const ed = e.target.closest('[data-sedit]');
      if (ed) { $('scSform').innerHTML = scenForm(S.scen.find(x => x.id === +ed.dataset.sedit)); $('scSformH').scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      if (e.target.closest('#sfCancel')) { $('scSform').innerHTML = scenForm(); return; }
      if (e.target.closest('#sfSave')) await saveScen(db, isCurrent, el);
    });
    el.querySelector('.p-wrap').addEventListener('change', e => {
      if (e.target.id === 'scScen') S.scenario = +e.target.value || null;
      if (e.target.id === 'scFile' && e.target.files && e.target.files[0]) {
        const f = e.target.files[0]; e.target.value = '';
        if (!/^audio\//.test(f.type || '')) { say('Choose an audio recording (for example .m4a, .mp3 or .wav).', true); return; }
        if (f.size > MAX_B) { say('That recording is over 50 MB. Send a shorter one (up to 30 minutes).', true); return; }
        clearTake(); S.blob = f; S.mime = f.type; S.secs = 0;
        const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => { if (isFinite(a.duration)) { S.secs = a.duration; showTake(); } URL.revokeObjectURL(a.src); }; a.src = URL.createObjectURL(f);
        showTake(); say('');
      }
    });
  }

  async function send(db, T, isCurrent, el){
    const b = $('scSend');
    if (!S.blob) { say('Record the call or choose a recording first.', true); return; }
    if (S.kind === 'real' && !($('scConsent') || {}).checked) { say('Tick that everyone on the call agreed to be recorded. Without that, send it as a roleplay instead.', true); return; }
    if (S.secs > MAX_S + 5) { say('That recording is over 30 minutes. Send a shorter one.', true); return; }
    const sc = S.kind === 'roleplay' ? S.scen.find(x => x.id === S.scenario) : null;
    const title = ($('scTitle').value || '').trim() || (S.kind === 'real' ? 'Real call' : 'Roleplay' + (sc ? ': ' + sc.title : ''));
    const mime = (S.mime || 'audio/webm').split(';')[0], path = T.user.id + '/calls/' + crypto.randomUUID() + '.' + extOf(mime);
    b.disabled = true; say('Sending…');
    const up = await safe(db.storage.from('hub-uploads').upload(path, S.blob, { contentType:mime, upsert:false }));
    if (!isCurrent()) return;
    if (up.error) { b.disabled = false; say('Couldn’t upload it. Check your connection and try again.', true); return; }
    const ins = await safe(db.from('hub_uploads').insert({ user_id:T.user.id, course:'calls', title:title.slice(0, 200), kind:'recording', path, file_name:(S.blob.name || 'call.' + extOf(mime)).slice(0, 200), mime,
      size_bytes:S.blob.size, duration_s:S.secs ? Math.round(S.secs) : null, note:($('scNote').value || '').trim().slice(0, 2000) || null, real_call:S.kind === 'real', consent:S.kind === 'real', scenario_id:sc ? sc.id : null }));
    if (!isCurrent()) return;
    if (ins.error) { await safe(db.storage.from('hub-uploads').remove([path])); b.disabled = false; say('Couldn’t send it. Try again.', true); return; }
    clearTake(); S.scenario = null;
    if (window.PortalHome) window.PortalHome.open('scoring');
    setTimeout(() => say('Sent. Amr will score it; you’ll get a notification.'), 600);
  }

  async function saveScen(db, isCurrent, el){
    const id = +$('sfSave').dataset.id || null, msg = $('sfMsg');
    const row = { title:$('sfTitle').value.trim(), kind:$('sfKind').value, level:$('sfLevel').value, seller:$('sfSeller').value.trim(), know:$('sfKnow').value.trim(), goal:$('sfGoal').value.trim(), hidden:$('sfHidden').value.trim() };
    if (!row.title) { msg.textContent = 'Give it a title.'; msg.classList.add('is-bad'); $('sfTitle').focus(); return; }
    if (id) row.active = $('sfActive').checked;
    $('sfSave').disabled = true;
    const r = await safe(id ? db.from('roleplay_scenarios').update(row).eq('id', id) : db.from('roleplay_scenarios').insert(row));
    if (!isCurrent()) return;
    if (r.error) { $('sfSave').disabled = false; msg.textContent = 'Couldn’t save it. Try again.'; msg.classList.add('is-bad'); return; }
    if (window.PortalHome) window.PortalHome.open('scoring');
  }

  window.CallScoring = { open, close(){ stopRec(); clearTake(); } };
})();
