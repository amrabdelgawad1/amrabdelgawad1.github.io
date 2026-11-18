// Round 17 (Nov 17 2026), part 2: Handbook version history, leaderboard weekly targets and streaks, and the call library.
//   #handbook     Amr: "Version history" under each page. Every save keeps the old words (database trigger), and any
//                 version can be put back. Putting one back saves the current words as a version first, so nothing is lost.
//   #leaderboard  everyone: "This week" with each rep's weekly targets and their streak of days that hit the daily targets.
//                 Amr: set weekly targets per rep (daily targets stay where they were).
//   #calllib      Amr and reps with call scoring: real calls tagged by objection and by stage of the call; filter by tag.
//                 Amr tags; reps see their own calls and the tagged calls Amr made examples in the script library.
// Database: handbook_versions (+ trigger), rep_targets.weekly_*, portal_streaks(), call_tags, library_calls().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, isOwner, fmtDay, fmtTime, plural, card, empty, failed, pill, f, opt, table, tr, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const when = t => fmtDay(t, { month:'short', day:'numeric', year:'numeric' }) + ', ' + fmtTime(t);
  const extra = (el, id) => { const w = el.querySelector('.p-wrap') || el; let x = w.querySelector('#' + id); if (!x) { x = document.createElement('div'); x.id = id; w.appendChild(x); } return x; };

  // ======================================================================
  // Handbook: version history (Amr)
  // ======================================================================
  const hb = V.handbook;
  if (hb && !hb.r17) {
    const open0 = hb.open;
    V.handbook = Object.assign({}, hb, { r17:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok() || !isOwner()) return;
      const box = extra(el, 'hbHist');
      const pageId = () => { const a = el.querySelector('.wk-hb-link.on'); return a ? +a.dataset.hb : +(location.hash.split('/')[1] || 0); };
      const addBtn = () => { const foot = el.querySelector('.wk-hb-foot'); if (foot && !foot.querySelector('#hbHistBtn')) foot.insertAdjacentHTML('beforeend', '<button type="button" class="p-btn is-ghost" id="hbHistBtn">Version history</button>'); };
      addBtn();
      const mo = new MutationObserver(() => { if (!document.body.contains(el)) { mo.disconnect(); return; } addBtn(); if (box.dataset.page && +box.dataset.page !== pageId()) { box.innerHTML = ''; delete box.dataset.page; } });
      mo.observe(el, { childList:true, subtree:true });
      let list = [];
      async function show(){
        const id = pageId(); if (!id) return;
        box.dataset.page = id; box.innerHTML = card('Version history', '', '<p class="p-loading">Loading…</p>');
        const r = await safe(db().from('handbook_versions').select('id,title,body,saved_at').eq('page_id', id).order('saved_at', { ascending:false }).limit(100));
        if (r.error) { box.innerHTML = failed(r.error); return; }
        list = r.data || [];
        box.innerHTML = card('Version history', plural(list.length, 'older version'),
          (list.length ? list.map(v => '<div class="p-row r17-ver"><span><b>' + esc(v.title) + '</b><br><small>Saved ' + esc(when(v.saved_at)) + ' · ' + plural(v.body.split('\n').filter(l => l.trim()).length, 'line') + '</small></span>' +
            '<span class="r17-acts"><button type="button" class="p-btn is-ghost" data-hbv="' + v.id + '">View</button><button type="button" class="p-btn is-ghost" data-hbback="' + v.id + '">Put this version back</button></span></div>' +
            '<ul class="wk-hb-body r17-verbody" id="hbv' + v.id + '" hidden>' + v.body.split('\n').filter(l => l.trim()).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>').join('')
            : empty('No older versions yet. Each time you save this page, the words before the save are kept here.')) +
          '<p class="p-hint">Putting a version back keeps the current words as a version too.</p><p class="p-hint" id="hbvMsg" role="status"></p>');
      }
      el.addEventListener('click', async e => {
        if (e.target.id === 'hbHistBtn') { if (box.dataset.page && +box.dataset.page === pageId() && box.innerHTML) { box.innerHTML = ''; delete box.dataset.page; } else { await show(); box.scrollIntoView({ behavior:'smooth', block:'start' }); } return; }
        const v = e.target.closest('[data-hbv]'); if (v) { const u = el.querySelector('#hbv' + v.dataset.hbv); if (u) { u.hidden = !u.hidden; v.textContent = u.hidden ? 'View' : 'Hide'; } return; }
        const b = e.target.closest('[data-hbback]'); if (!b) return;
        if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Click again'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = 'Put this version back'; } }, 4000); return; }
        const ver = list.find(x => x.id === +b.dataset.hbback); if (!ver) return;
        b.disabled = true;
        const r = await safe(db().from('handbook_pages').update({ title:ver.title, body:ver.body, updated_at:new Date().toISOString(), updated_by:(T().user || {}).id }).eq('id', box.dataset.page));
        if (r.error) { b.disabled = false; const m = el.querySelector('#hbvMsg'); if (m) m.textContent = errText(r, 'Couldn’t put it back. Try again.'); return; }
        const id = box.dataset.page; mo.disconnect();
        history.replaceState(null, '', '#handbook/' + id);
        await V.handbook.open(el, ok);
      });
    } });
  }

  // ======================================================================
  // Leaderboard: weekly targets and streaks
  // ======================================================================
  const KEYS = [['dials', 'Dials'], ['conversations', 'Conversations'], ['offers', 'Offers'], ['appointments', 'Appointments']];
  const lb = V.leaderboard;
  if (lb && !lb.r17) {
    const open0 = lb.open;
    V.leaderboard = Object.assign({}, lb, { r17:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok()) return;
      const box = extra(el, 'lbWeek'), owner = isOwner();
      box.innerHTML = card('This week', '', '<p class="p-loading">Loading…</p>');
      const r = await safe(db().rpc('portal_streaks'));
      if (!ok()) return;
      if (r.error) { box.innerHTML = failed(r.error); return; }
      const rows = r.data || [];
      const cell = (got, goal) => goal ? '<span class="r17-goal"><b>' + got + '</b> / ' + goal + '<span class="px-bar"><i data-w="' + Math.min(100, Math.max(2, Math.round(got / goal * 100))) + '"' + (got >= goal ? ' class="ok"' : '') + '></i></span></span>' : '<b>' + got + '</b>';
      const flame = x => (x.streak ? '<span class="r17-streak" title="Best: ' + x.best + '">' + plural(x.streak, 'day') + '</span>' : '<small>–</small>') + (x.best > x.streak ? '<br><small>best ' + x.best + '</small>' : '');
      let html = rows.length ? table(['Rep', 'Streak'].concat(KEYS.map(k => k[1])).concat(['Days worked']),
        rows.map(x => '<tr' + (x.me ? ' class="np-me"' : '') + '><td>' + esc(x.name) + (x.me ? ' ' + pill('You', 'ok') : '') + '</td><td>' + flame(x) + '</td>' +
          KEYS.map(k => '<td>' + cell(+x.week[k[0]] || 0, +x.target[k[0]] || 0) + '</td>').join('') + '<td>' + (x.week.days || 0) + '</td></tr>'))
        : empty('No team members yet.');
      html += '<p class="p-hint">A streak counts the working days in a row that hit your daily targets. A weekend doesn’t break it; more than 3 days without a shift, or a worked day under target, starts it again. With no daily targets set, every worked day counts.</p>';
      if (owner) {
        html += '<h3 class="r17-h">Weekly targets</h3><form class="px-form r17-wt" id="lbWt" novalidate>' + table(['Rep'].concat(KEYS.map(k => k[1])),
          rows.filter(x => x.user_id).map(x => '<tr><td>' + esc(x.name) + '</td>' + KEYS.map(k => '<td><input class="np-num" type="number" min="0" step="1" inputmode="numeric" aria-label="' + esc(x.name + ' weekly ' + k[1]) + '" data-u="' + x.user_id + '" data-k="weekly_' + k[0] + '" value="' + (x.target[k[0]] == null ? '' : x.target[k[0]]) + '"></td>').join('') + '</tr>')) +
          '<div class="px-tools"><button type="submit" class="p-btn">Save weekly targets</button><span class="p-hint" id="lbWtMsg" role="status"></span></div></form>';
      }
      box.innerHTML = card('This week', 'Monday to today, Cairo time', html);
      PX.widths(box); box.querySelectorAll('.px-bar i.ok').forEach(i => i.classList.add('ok'));
      const form = box.querySelector('#lbWt');
      if (form) form.addEventListener('submit', async e => {
        e.preventDefault();
        const by = {};
        form.querySelectorAll('input[data-u]').forEach(i => { (by[i.dataset.u] = by[i.dataset.u] || { user_id:i.dataset.u })[i.dataset.k] = i.value === '' ? null : Math.max(0, Math.round(+i.value)); });
        const rowsUp = Object.values(by).map(x => Object.assign(x, { updated_at:new Date().toISOString() }));
        const w = await safe(db().from('rep_targets').upsert(rowsUp, { onConflict:'user_id' }));
        PX.say('lbWtMsg', w.error ? errText(w, 'Couldn’t save. Try again.') : 'Saved.');
        if (!w.error) setTimeout(() => V.leaderboard.open(el, ok), 600);
      });
    } });
  }

  // ======================================================================
  // Call library: tag calls by objection and stage
  // ======================================================================
  const STAGES = ['Opening', 'Building rapport', 'Motivation', 'Timeline', 'Property condition', 'Price and numbers', 'Making the offer', 'Handling objections', 'Closing and next step', 'Follow-up call'];
  V.calllib = { title:'Call library', sec:'scoring', async open(el, ok){
    const owner = isOwner();
    const body = PX.page(el, 'Learning', 'Call library', owner ? 'Real calls tagged by objection and by stage of the call. Tag a call once, then anyone can find calls that show how a moment is handled.'
      : 'Your calls and the example calls Amr tagged, by objection and by stage of the call.');
    const [c, e] = await Promise.all([safe(db().rpc('library_calls')), safe(db().from('library_entries').select('id,title,kind').eq('kind', 'objection').eq('active', true).order('sort'))]);
    if (!ok()) return;
    if (c.error) { body.innerHTML = failed(c.error); return; }
    const calls = c.data || [], objs = e.data || [], objName = id => (objs.find(o => o.id === id) || {}).title || 'Objection';
    // Several recordings of the same lesson read share a title: number them Take 1, 2, 3 (oldest first) and show the time
    const sameTitle = {}; calls.slice().sort((a, b) => a.created_at < b.created_at ? -1 : 1).forEach(x => { const k = x.rep + '|' + x.title; (sameTitle[k] = sameTitle[k] || []).push(x); });
    Object.values(sameTitle).forEach(g => { if (g.length > 1) g.forEach((x, i) => { x.take = i + 1; }); });
    const clock = d => new Date(d).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
    const urls = new Map();
    const S = { obj:'', stage:'', q:'', untagged:false, edit:null };
    function draw(){
      const list = calls.filter(x => (!S.obj || x.objections.includes(+S.obj)) && (!S.stage || x.stages.includes(S.stage)) && (!S.untagged || (!x.objections.length && !x.stages.length))
        && (!S.q || (x.title + ' ' + x.rep + ' ' + (x.note || '')).toLowerCase().includes(S.q)));
      const counts = { o:{}, s:{} }; calls.forEach(x => { x.objections.forEach(o => counts.o[o] = (counts.o[o] || 0) + 1); x.stages.forEach(s => counts.s[s] = (counts.s[s] || 0) + 1); });
      body.innerHTML = '<div class="px-tools r17-filters">' +
        f('Objection', '<select id="clObj"><option value="">Any objection</option>' + objs.map(o => opt(o.id, o.title + (counts.o[o.id] ? ' (' + counts.o[o.id] + ')' : ''), +S.obj === o.id)).join('') + '</select>') +
        f('Stage', '<select id="clStage"><option value="">Any stage</option>' + STAGES.map(s => opt(s, s + (counts.s[s] ? ' (' + counts.s[s] + ')' : ''), S.stage === s)).join('') + '</select>') +
        f('Search', '<input type="search" id="clQ" value="' + esc(S.q) + '" placeholder="Title, rep or note">') +
        (owner ? '<label class="r17-check"><input type="checkbox" id="clUn"' + (S.untagged ? ' checked' : '') + '> Not tagged yet</label>' : '') + '</div>' +
        card(plural(list.length, 'call'), calls.length !== list.length ? 'of ' + calls.length : '', list.length ? list.map(x =>
          '<div class="r17-call" data-id="' + x.upload_id + '"><div class="p-row"><span><b>' + esc(x.title) + (x.take ? ' · Take ' + x.take : '') + '</b><br><small>' + esc([x.rep, fmtDay(x.created_at, { month:'short', day:'numeric', year:'numeric' }) + ', ' + clock(x.created_at), x.total != null ? 'score ' + x.total : ''].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="r17-acts"><button type="button" class="p-btn is-ghost" data-play="' + x.upload_id + '">Play</button>' + (owner ? '<button type="button" class="p-btn is-ghost" data-tag="' + x.upload_id + '">' + (x.objections.length || x.stages.length ? 'Edit tags' : 'Tag') + '</button>' : '') + '</span></div>' +
          '<div class="r17-tags">' + x.stages.map(s => pill(s)).join('') + x.objections.map(o => pill(objName(o), 'warn')).join('') + (x.note ? '<small>' + esc(x.note) + '</small>' : '') + '</div>' +
          (S.edit === x.upload_id ? tagForm(x) : '') + '<div class="r17-audio" id="au' + x.upload_id + '"></div></div>').join('')
          : empty(calls.length ? 'No calls match. Clear a filter.' : owner ? 'No call recordings yet. Recordings sent in the course show here.' : 'No calls here yet.'));
    }
    const tagForm = x => '<form class="px-form r17-tagform" data-form="' + x.upload_id + '" novalidate><fieldset><legend>Stage of the call</legend><div class="r17-chips">' +
      STAGES.map(s => '<label><input type="checkbox" name="st" value="' + esc(s) + '"' + (x.stages.includes(s) ? ' checked' : '') + '> ' + esc(s) + '</label>').join('') + '</div></fieldset>' +
      '<fieldset><legend>Objections in this call</legend><div class="r17-chips">' + (objs.length ? objs.map(o => '<label><input type="checkbox" name="ob" value="' + o.id + '"' + (x.objections.includes(o.id) ? ' checked' : '') + '> ' + esc(o.title) + '</label>').join('') : '<small>Add objections in Scripts and objections first.</small>') + '</div></fieldset>' +
      f('Note (optional)', '<input type="text" name="note" maxlength="200" value="' + esc(x.note || '') + '" placeholder="e.g. Good save at 4:10">', 'px-wide') +
      '<div class="px-tools"><button type="submit" class="p-btn">Save tags</button><button type="button" class="p-btn is-ghost" data-cancel>Cancel</button><span class="p-hint" role="status"></span></div></form>';
    draw();
    body.addEventListener('change', e => {
      if (e.target.id === 'clObj') { S.obj = e.target.value; draw(); } else if (e.target.id === 'clStage') { S.stage = e.target.value; draw(); } else if (e.target.id === 'clUn') { S.untagged = e.target.checked; draw(); }
    });
    body.addEventListener('input', e => { if (e.target.id === 'clQ') { S.q = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; draw(); const q = body.querySelector('#clQ'); q.focus(); q.setSelectionRange(pos, pos); } });
    body.addEventListener('click', async e => {
      const t = e.target.closest('[data-tag]'); if (t) { S.edit = S.edit === t.dataset.tag ? null : t.dataset.tag; draw(); return; }
      if (e.target.closest('[data-cancel]')) { S.edit = null; draw(); return; }
      const p = e.target.closest('[data-play]'); if (!p) return;
      const x = calls.find(c => c.upload_id === p.dataset.play), box = body.querySelector('#au' + p.dataset.play); if (!x || !box) return;
      if (box.innerHTML) { box.innerHTML = ''; return; }
      if (!urls.has(x.path)) { const r = await safe(db().storage.from('hub-uploads').createSignedUrl(x.path, 3600)); if (r.data && r.data.signedUrl) urls.set(x.path, r.data.signedUrl); }
      box.innerHTML = urls.has(x.path) ? '<audio controls preload="metadata" src="' + esc(urls.get(x.path)) + '"></audio>' : '<p class="p-hint">Couldn’t open this recording.</p>';
      const a = box.querySelector('audio'); if (a) a.play().catch(() => {});
    });
    body.addEventListener('submit', async e => {
      const fm = e.target.closest('[data-form]'); if (!fm) return; e.preventDefault();
      const id = fm.dataset.form, x = calls.find(c => c.upload_id === id), msg = fm.querySelector('[role="status"]');
      const st = [...fm.querySelectorAll('[name="st"]:checked')].map(i => i.value), ob = [...fm.querySelectorAll('[name="ob"]:checked')].map(i => +i.value), note = fm.note.value.trim() || null;
      const r = await safe(db().from('call_tags').upsert({ upload_id:id, stages:st, objections:ob, note, tagged_at:new Date().toISOString(), tagged_by:(T().user || {}).id }, { onConflict:'upload_id' }));
      if (r.error) { msg.textContent = errText(r, 'Couldn’t save. Try again.'); return; }
      Object.assign(x, { stages:st, objections:ob, note }); S.edit = null; draw();
    });
  }};
})();
