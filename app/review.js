// Review center (#review, Amr only): every recording and file learners send from the Learning Hub courses,
// with the people picker, progress across courses, the 50-point call scorecard and time-stamped comments.
//   #review          the feed, filtered by the people you pick
//   #review/<user>   one person: progress in every course, then their uploads
// Data: hub_uploads and hub_upload_comments (supabase/migrations/20261029060000_review_center.sql), the private
// "hub-uploads" bucket, Acquisitions drills from course_admin_waiting, progress from course_admin_learners and
// portal_learner_progress() (pass counts only: nobody but the learner reads their saved course data).
(function(){
  'use strict';
  const A = () => window.TalentsApp || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const COURSES = { acq:'Acquisitions', mkt:'Marketing', psy:'Psychology' };
  const CATS = ['Opening and upfront agreement', 'Rapport', 'Property discovery', 'Pain depth', 'Timeline, money, decision makers',
    'Getting their number', 'Offer framing', 'Objection handling', 'Listening and talk ratio', 'Close and next step'];
  const band = t => t >= 45 ? 'Ready for live leads' : t >= 38 ? 'Solid. Sharpen one or two areas' : t >= 30 ? 'Keep drilling the stages' : 'Back to the script daily';
  const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const clock = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function ago(ts){
    if (!ts) return '';
    const s = (Date.now() - new Date(ts)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
    return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' });
  }

  // ---------- state ----------
  let people = [], uploads = [], comments = {}, drills = [], acqProgress = {}, hubProgress = {}, missing = false;
  let pick = new Set();            // picked user ids; empty = everyone
  let status = 'waiting', course = 'all';
  try { pick = new Set(JSON.parse(sessionStorage.getItem('rv-pick') || '[]')); status = sessionStorage.getItem('rv-status') || 'waiting'; course = sessionStorage.getItem('rv-course') || 'all'; } catch(e){}
  const remember = () => { try { sessionStorage.setItem('rv-pick', JSON.stringify([...pick])); sessionStorage.setItem('rv-status', status); sessionStorage.setItem('rv-course', course); } catch(e){} };
  const waitingOf = id => uploads.concat(drills).filter(x => x.user_id === id && x.status === 'waiting').length;
  const nameOf = id => (people.find(p => p.user_id === id) || {}).name || 'Someone';
  const signed = new Map();

  async function load(){
    const db = A().db;
    const [mem, up, lr, acq, wait] = await Promise.all([
      db.from('members').select('user_id,name,email,active,access').order('name'),
      db.from('hub_uploads').select('*').order('created_at', { ascending:false }).limit(400),
      db.rpc('portal_learner_progress'),
      db.rpc('course_admin_learners'),
      db.rpc('course_admin_waiting')
    ]);
    missing = !!(up.error && /hub_uploads/.test(up.error.message || ''));
    people = (mem.data || []).filter(p => p.user_id);
    uploads = up.data || [];
    drills = (wait.data || []).map(w => ({ drill:true, user_id:w.userId, course:'acq', title:w.title || 'Written drill', created_at:w.submittedAt, href:'/course/#/admin/u/' + encodeURIComponent(w.userId) + '/s/' + encodeURIComponent(w.moduleId) + '/' + encodeURIComponent(w.itemId), status:'waiting' }));
    acqProgress = {}; (acq.data || []).forEach(l => acqProgress[l.userId] = l);
    hubProgress = {}; (lr.data || []).forEach(r => { (hubProgress[r.user_id] = hubProgress[r.user_id] || {})[r.course] = r; });   // { passed, sent, updated_at }
    comments = {};
    if (uploads.length) {
      const c = await db.from('hub_upload_comments').select('*').in('upload_id', uploads.map(u => u.id)).order('created_at');
      (c.data || []).forEach(x => (comments[x.upload_id] = comments[x.upload_id] || []).push(x));
    }
  }
  async function sign(paths){
    const need = paths.filter(p => p && !signed.has(p));
    if (!need.length) return;
    const { data } = await A().db.storage.from('hub-uploads').createSignedUrls(need, 3600);
    (data || []).forEach(d => { if (d.signedUrl) signed.set(d.path, d.signedUrl); });
  }

  // ---------- progress in each course ----------
  function progressRows(uid){
    const rows = [];
    const a = acqProgress[uid];
    if (a) rows.push({ c:'Acquisitions', pct:a.total ? Math.round(a.done * 100 / a.total) : 0,
      t:(a.module ? 'Module ' + a.module + ' · ' + a.done + ' of ' + a.total : 'Not started') + (a.checkpoint ? ' · checkpoint ' + a.checkpoint.score + '%' : ''), at:a.lastActive, href:'/course/#/admin/u/' + encodeURIComponent(uid) });
    const h = hubProgress[uid] || {};
    if (h.mkt2) {
      const passed = h.mkt2.passed || 0, asg = h.mkt2.sent || 0;
      const total = (window.COURSE && window.COURSE.plan && window.COURSE.plan.length) || 16;
      rows.push({ c:'Marketing', pct:Math.round(passed * 100 / total), t:passed + ' of ' + total + ' modules passed · ' + asg + (asg === 1 ? ' assignment' : ' assignments') + ' sent', at:h.mkt2.updated_at });
    }
    if (h.psy) {
      const passed = h.psy.passed || 0, total = (window.PSY_COURSE && window.PSY_COURSE.modules) || 27;
      rows.push({ c:'Psychology', pct:Math.round(passed * 100 / total), t:passed + ' of ' + total + ' modules passed', at:h.psy.updated_at });
    }
    return rows;
  }
  const progressHtml = uid => {
    const rows = progressRows(uid);
    return rows.length ? rows.map(r => '<div class="rv-prog"><div class="rv-prog-top"><b>' + esc(r.c) + '</b>' + (r.href ? '<a href="' + esc(r.href) + '">Open</a>' : '') + '</div>' +
      (r.pct != null ? '<div class="rv-bar" role="progressbar" aria-label="' + esc(r.c) + ' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r.pct + '"><i style="width:' + r.pct + '%"></i></div>' : '') +
      '<small>' + esc(r.t) + (r.at ? ' · active ' + esc(ago(r.at)) : '') + '</small></div>').join('') : '<p class="empty">No course activity yet.</p>';
  };

  // ---------- feed ----------
  function feedItems(uid){
    let items = uploads.concat(drills);
    if (uid) items = items.filter(x => x.user_id === uid);
    else if (pick.size) items = items.filter(x => pick.has(x.user_id));
    if (course !== 'all') items = items.filter(x => x.course === course);
    if (status === 'waiting') items = items.filter(x => x.status === 'waiting');
    else if (status === 'reviewed') items = items.filter(x => x.status !== 'waiting');
    return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  function card(u){
    const who = nameOf(u.user_id);
    const head = '<div class="rv-head"><span class="rv-av" aria-hidden="true">' + esc(initials(who)) + '</span><div class="rv-who"><b><a href="#review/' + esc(u.user_id) + '">' + esc(who) + '</a></b>' +
      '<small>' + esc(COURSES[u.course] || u.course) + (u.module ? ' · Module ' + esc(String(u.module).replace(/^m/, '')) : '') + ' · ' + esc(ago(u.created_at)) + '</small></div>' +
      '<span class="pill ' + (u.status === 'approved' ? 'ok' : u.status === 'redo' ? 'warn' : 'due') + '">' + (u.status === 'approved' ? 'Approved' : u.status === 'redo' ? 'Sent back' : 'Waiting') + '</span></div>';
    if (u.drill) return '<article class="card rv-card">' + head + '<h3 class="rv-t">' + esc(u.title) + '</h3><p class="rv-note">Written drill, reviewed in the Acquisitions course.</p><a class="btn small ghost" href="' + esc(u.href) + '">Review the drill</a></article>';
    const url = signed.get(u.path);
    const media = u.kind === 'recording' || /^audio\//.test(u.mime || '')
      ? (url ? '<audio class="rv-audio" controls preload="metadata" src="' + esc(url) + '" data-id="' + esc(u.id) + '"></audio>' : '<p class="empty">Loading the recording…</p>')
      : (url ? '<a class="btn small ghost" href="' + esc(url) + '" target="_blank" rel="noopener">Open ' + esc(u.file_name || 'the file') + '</a>' : '');
    const cs = (comments[u.id] || []).map(c => '<li><span class="rv-cm-who">' + esc(c.author === u.user_id ? who : 'Amr') + '</span>' +
      (c.at_s != null ? '<button class="rv-at" type="button" data-seek="' + esc(c.at_s) + '" data-id="' + esc(u.id) + '">' + clock(c.at_s) + '</button>' : '') + esc(c.body) + '</li>').join('');
    const sc = u.score && u.score.cats ? u.score.cats : null;
    const scoreRows = CATS.map((c, i) => '<div class="rv-cat"><span>' + esc(c) + '</span><div class="rv-dots" role="radiogroup" aria-label="' + esc(c) + '">' +
      [1, 2, 3, 4, 5].map(v => '<button type="button" role="radio" aria-checked="' + !!(sc && sc[i] === v) + '" tabindex="' + ((sc ? sc[i] === v : v === 1) ? 0 : -1) + '" data-cat="' + i + '" data-v="' + v + '">' + v + '</button>').join('') + '</div></div>').join('');
    const total = sc ? sc.reduce((a, b) => a + b, 0) : null;
    return '<article class="card rv-card" data-id="' + esc(u.id) + '">' + head +
      '<h3 class="rv-t">' + esc(u.title || (u.kind === 'recording' ? 'Recording' : 'File')) + (u.real_call ? ' <span class="pill">Real call, consent given</span>' : '') + '</h3>' +
      (u.note ? '<p class="rv-note">' + esc(u.note) + '</p>' : '') + media +
      '<details class="rv-score"' + (sc ? ' open' : '') + '><summary>50-point call scorecard' + (total != null ? ' · <b>' + total + ' of 50</b> · ' + esc(band(total)) : '') + '</summary>' + scoreRows +
        '<p class="rv-total" aria-live="polite">' + (total != null ? 'Total ' + total + ' of 50 · ' + esc(band(total)) : 'Score all 10 to see the total.') + '</p></details>' +
      '<ul class="rv-cms">' + cs + '</ul>' +
      '<form class="rv-form" data-id="' + esc(u.id) + '"><label class="rv-vh" for="cm-' + esc(u.id) + '">Comment</label><textarea class="field" id="cm-' + esc(u.id) + '" rows="2" maxlength="2000" placeholder="Leave a comment for ' + esc(who.split(' ')[0]) + '"></textarea>' +
        '<div class="rv-actions">' + (u.kind === 'recording' ? '<label class="rv-pin"><input type="checkbox" checked> Pin to where the recording is</label>' : '<span></span>') +
        '<button class="btn small ghost" type="submit">Add comment</button></div></form>' +
      '<div class="rv-actions"><button class="btn small" type="button" data-review="approved">Approve</button><button class="btn small ghost" type="button" data-review="redo">Send back to redo</button>' +
        (u.status !== 'waiting' ? '<button class="btn small ghost" type="button" data-review="waiting">Mark as waiting</button>' : '') + '</div>' +
      '</article>';
  }

  // ---------- page ----------
  function pickerLabel(){
    if (!pick.size) return 'Everyone';
    const names = [...pick].map(nameOf);
    return names.length <= 2 ? names.join(', ') : names.length + ' people';
  }
  function filters(){
    return '<div class="rv-bar-top">' +
      '<div class="rv-pick"><button class="field rv-pickbtn" type="button" id="rvPickBtn" aria-haspopup="dialog" aria-expanded="false" aria-controls="rvPickBox"><span>People: ' + esc(pickerLabel()) + '</span>' +
        '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="rv-pickbox card" id="rvPickBox" role="dialog" aria-label="Pick people" hidden><input class="field" type="search" id="rvPickQ" placeholder="Find a person" aria-label="Find a person">' +
        '<div class="rv-pickacts"><button class="btn small ghost" type="button" data-pick="all">Everyone</button><button class="btn small ghost" type="button" data-pick="done">Done</button></div>' +
        '<div class="rv-picklist" id="rvPickList">' + people.map(p => '<label class="rv-pickrow" data-name="' + esc((p.name || '').toLowerCase()) + '"><input type="checkbox" value="' + esc(p.user_id) + '"' + (pick.has(p.user_id) ? ' checked' : '') + '><span>' + esc(p.name || p.email) + '</span>' +
          (waitingOf(p.user_id) ? '<span class="pill due">' + waitingOf(p.user_id) + '</span>' : '') + '</label>').join('') + '</div></div></div>' +
      '<div class="rv-chips" role="group" aria-label="Status">' + [['waiting', 'Waiting'], ['reviewed', 'Reviewed'], ['all', 'All']].map(s => '<button class="chip" type="button" data-status="' + s[0] + '" aria-pressed="' + (status === s[0]) + '">' + s[1] + '</button>').join('') + '</div>' +
      '<select class="field rv-course" id="rvCourse" aria-label="Course"><option value="all">All courses</option>' + Object.keys(COURSES).map(k => '<option value="' + k + '"' + (course === k ? ' selected' : '') + '>' + COURSES[k] + '</option>').join('') + '</select>' +
    '</div>';
  }
  async function draw(person){
    const box = $('reviewBody'); if (!box) return;
    if (missing) { box.innerHTML = '<p class="empty">The Review center isn’t set up yet. Run supabase/migrations/20261029060000_review_center.sql in Supabase.</p>'; return; }
    const one = person && people.find(p => p.user_id === person);
    const items = feedItems(one ? person : null);
    await sign(items.filter(x => !x.drill).map(x => x.path));
    let h = '';
    if (one) {
      h += '<a class="rv-back" href="#review">← All people</a><section class="card rv-person"><div class="rv-head"><span class="rv-av big" aria-hidden="true">' + esc(initials(one.name)) + '</span><div class="rv-who"><b>' + esc(one.name) + '</b><small>' + esc(one.email || '') + (one.active === false ? ' · access switched off' : '') + '</small></div></div>' +
        '<div class="rv-progs">' + progressHtml(person) + '</div></section>';
      h += '<div class="rv-bar-top">' + '<div class="rv-chips" role="group" aria-label="Status">' + [['waiting', 'Waiting'], ['reviewed', 'Reviewed'], ['all', 'All']].map(s => '<button class="chip" type="button" data-status="' + s[0] + '" aria-pressed="' + (status === s[0]) + '">' + s[1] + '</button>').join('') + '</div></div>';
    } else {
      h += filters();
      const shown = pick.size ? people.filter(p => pick.has(p.user_id)) : people.filter(p => progressRows(p.user_id).length || uploads.some(u => u.user_id === p.user_id));
      if (shown.length) h += '<div class="rv-people">' + shown.map(p => '<a class="card rv-pcard" href="#review/' + esc(p.user_id) + '"><div class="rv-head"><span class="rv-av" aria-hidden="true">' + esc(initials(p.name)) + '</span><div class="rv-who"><b>' + esc(p.name) + '</b>' +
        '<small>' + (waitingOf(p.user_id) || 'Nothing') + ' waiting</small></div></div>' + progressHtml(p.user_id).replace(/<a href="[^"]*">Open<\/a>/g, '') + '</a>').join('') + '</div>';
    }
    h += '<h2 class="rv-h">' + (status === 'waiting' ? 'Waiting for you' : status === 'reviewed' ? 'Reviewed' : 'Everything') + ' (' + items.length + ')</h2>';
    h += items.length ? '<div class="rv-feed">' + items.map(card).join('') + '</div>' : '<p class="empty">' + (status === 'waiting' ? 'Nothing waiting. You’re all caught up.' : 'Nothing here yet.') + '</p>';
    box.innerHTML = h;
  }

  // ---------- actions ----------
  let current = '', pickWas = '';
  async function open(person){
    current = person || '';
    const box = $('reviewBody'); if (!box) return;
    if (!box.dataset.bound) bind(box);
    box.innerHTML = '<p class="empty">Loading…</p>';
    try { await load(); } catch(e){ box.innerHTML = '<p class="empty">Couldn’t load the Review center. Check your connection and try again.</p>'; return; }
    draw(current);
  }
  async function refresh(){ await load(); draw(current); count(); }
  // Redraw one card in place, so half-entered scores and playing audio on the other cards are kept
  async function redrawCard(id){
    await load();
    const u = uploads.find(x => x.id === id), el = $('reviewBody').querySelector('.rv-card[data-id="' + CSS.escape(id) + '"]');
    if (!u || !el) return draw(current);
    const keep = (status === 'waiting' && u.status !== 'waiting');
    if (keep) { el.remove(); const h = $('reviewBody').querySelector('.rv-h'); if (h) h.textContent = h.textContent.replace(/\((\d+)\)/, (m, n) => '(' + Math.max(0, n - 1) + ')'); }
    else { await sign([u.path]); el.outerHTML = card(u); }
    count();
  }
  function bind(box){
    box.dataset.bound = '1';
    box.addEventListener('click', async e => {
      const t = e.target;
      const pb = t.closest('#rvPickBtn');
      if (pb) { const open = $('rvPickBox').hidden; $('rvPickBox').hidden = !open; pb.setAttribute('aria-expanded', open); if (open) { pickWas = [...pick].sort().join(); $('rvPickQ').focus(); } else closePick(); return; }
      const pa = t.closest('[data-pick]');
      if (pa) { if (pa.dataset.pick === 'all') { pick.clear(); remember(); pickWas = '\u0000'; } closePick(true); return; }
      const st = t.closest('[data-status]');
      if (st) { status = st.dataset.status; remember(); draw(current); return; }
      const sk = t.closest('[data-seek]');
      if (sk) { const au = box.querySelector('audio[data-id="' + CSS.escape(sk.dataset.id) + '"]'); if (au) { au.currentTime = +sk.dataset.seek; au.play().catch(() => {}); } return; }
      const dot = t.closest('[data-cat]');
      if (dot) {
        const g = dot.parentElement; g.querySelectorAll('button').forEach(b => { b.setAttribute('aria-checked', b === dot); b.tabIndex = b === dot ? 0 : -1; });
        const cardEl = dot.closest('.rv-card'), vals = [...cardEl.querySelectorAll('.rv-dots')].map(d => { const on = d.querySelector('[aria-checked="true"]'); return on ? +on.dataset.v : null; });
        const tot = cardEl.querySelector('.rv-total');
        tot.textContent = vals.every(v => v) ? 'Total ' + vals.reduce((a, b) => a + b, 0) + ' of 50 · ' + band(vals.reduce((a, b) => a + b, 0)) + '. Approve or send back to save it.' : vals.filter(v => v).length + ' of 10 scored.';
        return;
      }
      const rv = t.closest('[data-review]');
      if (rv) {
        const cardEl = rv.closest('.rv-card'), id = cardEl.dataset.id;
        const vals = [...cardEl.querySelectorAll('.rv-dots')].map(d => { const on = d.querySelector('[aria-checked="true"]'); return on ? +on.dataset.v : null; });
        const scored = vals.filter(v => v).length;
        if (scored && scored < 10) { A().toast('Score all 10 parts of the scorecard, or none.'); return; }
        rv.setAttribute('aria-busy', 'true');
        const { error } = await A().db.rpc('hub_review', { p_id:id, p_status:rv.dataset.review, p_score:scored === 10 ? { cats:vals } : null });
        rv.removeAttribute('aria-busy');
        if (error) { A().toast('Couldn’t save that. Try again.'); return; }
        A().toast(rv.dataset.review === 'approved' ? 'Approved' : rv.dataset.review === 'redo' ? 'Sent back to redo' : 'Marked as waiting');
        redrawCard(id);
      }
    });
    box.addEventListener('change', e => {
      const t = e.target;
      if (t.closest('#rvPickList')) { t.checked ? pick.add(t.value) : pick.delete(t.value); remember(); const b = $('rvPickBtn'); if (b) b.querySelector('span').textContent = 'People: ' + pickerLabel(); return; }
      if (t.id === 'rvCourse') { course = t.value; remember(); draw(current); }
    });
    box.addEventListener('input', e => {
      if (e.target.id !== 'rvPickQ') return;
      const v = e.target.value.trim().toLowerCase();
      box.querySelectorAll('.rv-pickrow').forEach(r => r.hidden = v && !r.dataset.name.includes(v));
    });
    box.addEventListener('submit', async e => {
      const f = e.target.closest('.rv-form'); if (!f) return;
      e.preventDefault();
      const ta = f.querySelector('textarea'), body = ta.value.trim(); if (!body) { ta.focus(); return; }
      const pin = f.querySelector('.rv-pin input'), au = f.closest('.rv-card').querySelector('audio');
      const at_s = pin && pin.checked && au ? Math.round(au.currentTime * 10) / 10 : null;
      const btn = f.querySelector('button[type=submit]'); btn.setAttribute('aria-busy', 'true');
      const { error } = await A().db.from('hub_upload_comments').insert({ upload_id:f.dataset.id, body, at_s });
      btn.removeAttribute('aria-busy');
      if (error) { A().toast('Couldn’t add the comment. Try again.'); return; }
      ta.value = ''; redrawCard(f.dataset.id);
    });
    function closePick(focus){
      const b = $('rvPickBox'); if (!b) return;
      b.hidden = true; $('rvPickBtn').setAttribute('aria-expanded', 'false');
      if (focus) $('rvPickBtn').focus();
      if ([...pick].sort().join() !== pickWas) draw(current);
    }
    document.addEventListener('click', e => { const b = $('rvPickBox'); if (b && !b.hidden && !e.target.closest('.rv-pick')) closePick(); });
    document.addEventListener('keydown', e => {
      const b = $('rvPickBox');
      if (e.key === 'Escape' && b && !b.hidden) { closePick(true); return; }
      // Scorecard: arrow keys move between 1 to 5 inside a category
      const dot = e.target.closest && e.target.closest('.rv-dots button');
      if (dot && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
        e.preventDefault();
        const all = [...dot.parentElement.querySelectorAll('button')], i = all.indexOf(dot);
        const nx = all[(i + (/Right|Down/.test(e.key) ? 1 : -1) + all.length) % all.length];
        nx.focus(); nx.click();
      }
    });
  }

  // Waiting count for the menu
  async function count(){
    const db = A().db; if (!db) return 0;
    const [u, w] = await Promise.all([db.from('hub_uploads').select('id', { count:'exact', head:true }).eq('status', 'waiting'), db.rpc('course_admin_waiting')]);
    const n = (u.count || 0) + ((w.data || []).length);
    const el = $('reviewCnt'); if (el) { el.hidden = !n; el.textContent = n + ' waiting'; }
    return n;
  }
  window.HubReview = { open, count };
})();
