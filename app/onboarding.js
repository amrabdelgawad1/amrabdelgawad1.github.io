// Phase 3: onboarding checklist (#onboarding for Amr; a "Your onboarding" card on each person's Team home).
// Items tick themselves from what the person really did (signed in, Deal CRM ready, a shift, 50 dials, calls scored)
// or Amr ticks them (paperwork, tools). Nothing private is stored: a tick only says it's done.
// portal_onboarding_summary (Amr), portal_onboarding(user) (Amr for anyone; everyone else their own); see
// 20261101020000_onboarding.sql.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const safe = p => p.then(r => r, () => ({}));
  const GROUPS = ['Paperwork', 'Tools', 'Training', 'Going live'];
  const day = d => { try { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); } catch (e) { return ''; } };
  const S = { open:null, items:[] };

  function listHtml(rows, can){
    return GROUPS.filter(g => rows.some(r => r.grp === g)).map(g => '<div class="ob-grp"><h3>' + esc(g) + '</h3>' + rows.filter(r => r.grp === g).map(r =>
      '<label class="ob-item' + (r.done ? ' is-done' : '') + (r.auto ? ' is-auto' : '') + '"><input type="checkbox"' + (r.done ? ' checked' : '') + (can && !r.auto ? ' data-tick="' + r.item_id + '"' : ' disabled') + '>' +
      '<span>' + esc(r.title) + (r.auto ? '<small>' + (r.done ? 'Done' : 'Ticks itself once it’s done') + '</small>' : r.done && r.done_at ? '<small>Ticked ' + esc(day(r.done_at)) + '</small>' : '') + '</span></label>').join('') + '</div>').join('');
  }
  const bar = (done, total) => '<span class="ob-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '" aria-label="' + done + ' of ' + total + ' done"><i data-w="' + (total ? Math.round(done / total * 100) : 0) + '"></i></span>';
  const widths = el => el.querySelectorAll('.ob-bar i[data-w]').forEach(i => { i.style.width = i.dataset.w + '%'; });

  // ---------- Team home card (everyone but Amr) ----------
  async function card(db, el, isCurrent){
    const r = await safe(db.rpc('portal_onboarding'));
    if (!isCurrent() || !Array.isArray(r.data) || !r.data.length || !el) return;
    const done = r.data.filter(x => x.done).length;
    if (done === r.data.length) return;   // all done: the card goes away
    el.innerHTML = '<section class="p-card ob-card" aria-labelledby="obMineH"><div class="p-card-head"><h2 id="obMineH">Your onboarding</h2><span>' + done + ' of ' + r.data.length + ' done</span></div>' + bar(done, r.data.length) +
      '<details class="ob-more"><summary>See the checklist</summary>' + listHtml(r.data, false) + '</details></section>';
    el.hidden = false; widths(el);
  }

  // ---------- Amr's page ----------
  async function open(el, isCurrent){
    const T = window.TalentsApp || {}, db = T.db;
    el.innerHTML = '<div class="p-wrap"><section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">People</span><h1>Onboarding</h1><p>Each new hire’s paperwork, tools, training and first live work. Items marked “ticks itself” follow what they really did.</p></div></section><div id="obBody"><p class="p-loading">Loading…</p></div></div>';
    const [sm, it] = await Promise.all([safe(db.rpc('portal_onboarding_summary')), safe(db.from('onboarding_items').select('id,grp,title,auto,sort,active').order('sort'))]);
    if (!isCurrent()) return;
    if (sm.error || !Array.isArray(sm.data)) { $('obBody').innerHTML = '<p class="p-card p-empty">' + (/Not allowed/.test((sm.error || {}).message || '') ? 'Onboarding needs your authenticator code. Sign in again with it to see this page.' : 'Couldn’t load onboarding. Check your connection and try again.') + '</p>'; return; }
    S.items = it.data || [];
    const people = sm.data.filter(x => x.user_id !== (T.user || {}).id);
    $('obBody').innerHTML = (people.length ? '<div class="p-card ob-people">' + people.map(p => '<div class="ob-person" data-person="' + esc(p.user_id) + '"><button type="button" class="ob-head" aria-expanded="false" data-open="' + esc(p.user_id) + '"><b>' + esc(p.name || 'Someone') + '</b><small>' + (p.joined ? 'Joined ' + esc(day(p.joined)) : '') + '</small>' + bar(p.done, p.total) + '<span class="p-pill' + (p.done === p.total ? ' is-ok' : ' is-plain') + '">' + (p.done === p.total ? 'All done' : p.done + ' of ' + p.total) + '</span></button><div class="ob-list" hidden></div></div>').join('') + '</div>'
        : '<p class="p-card p-empty">No one on the team yet. Invite people from Invite and access.</p>') +
      '<details class="p-card ob-edit"><summary>Change the checklist</summary><p class="p-empty">Turning an item off takes it off everyone’s list; ticks are kept if you turn it back on.</p>' +
        '<div class="ob-items">' + S.items.map(i => '<div class="ob-erow"><span><b>' + esc(i.title) + '</b><small>' + esc(i.grp) + (i.auto ? ' · ticks itself' : '') + '</small></span><button type="button" class="p-btn is-ghost" data-toggle="' + i.id + '" aria-pressed="' + i.active + '">' + (i.active ? 'On' : 'Off') + '</button></div>').join('') + '</div>' +
        '<div class="ob-add"><label class="sc-f">Group<select id="obGrp">' + GROUPS.map(g => '<option>' + g + '</option>').join('') + '</select></label><label class="sc-f">New item<input type="text" id="obTitle" maxlength="120" autocomplete="off"></label><button type="button" class="p-btn" id="obAdd">Add item</button></div><p class="p-empty" id="obMsg" role="status"></p></details>';
    widths(el);
    el.querySelector('.p-wrap').addEventListener('click', async e => {
      const o = e.target.closest('[data-open]');
      if (o) { const box = o.nextElementSibling, show = box.hidden; box.hidden = !show; o.setAttribute('aria-expanded', String(show)); if (show) await person(db, o.dataset.open, box, isCurrent); return; }
      const t = e.target.closest('[data-toggle]');
      if (t) { t.disabled = true; const on = t.getAttribute('aria-pressed') !== 'true'; const r = await safe(db.from('onboarding_items').update({ active:on }).eq('id', +t.dataset.toggle)); if (!isCurrent()) return;
        if (r.error) { t.disabled = false; $('obMsg').textContent = 'Couldn’t change it. Try again.'; return; } window.PortalHome.open('onboarding'); return; }
      if (e.target.closest('#obAdd')) {
        const title = $('obTitle').value.trim(); if (!title) { $('obMsg').textContent = 'Write the item first.'; $('obTitle').focus(); return; }
        $('obAdd').disabled = true; const r = await safe(db.from('onboarding_items').insert({ grp:$('obGrp').value, title, sort:200 })); if (!isCurrent()) return;
        if (r.error) { $('obAdd').disabled = false; $('obMsg').textContent = 'Couldn’t add it. Try again.'; return; } window.PortalHome.open('onboarding');
      }
    });
    el.querySelector('.p-wrap').addEventListener('change', async e => {
      const c = e.target.closest('[data-tick]'); if (!c) return;
      const who = c.closest('[data-person]').dataset.person; c.disabled = true;
      const r = await safe(c.checked ? db.from('onboarding_ticks').insert({ user_id:who, item_id:+c.dataset.tick }) : db.from('onboarding_ticks').delete().eq('user_id', who).eq('item_id', +c.dataset.tick));
      if (!isCurrent()) return;
      if (r.error) { c.checked = !c.checked; c.disabled = false; return; }
      await person(db, who, c.closest('.ob-list'), isCurrent, true);
    });
  }
  async function person(db, id, box, isCurrent, refreshHead){
    box.innerHTML = box.innerHTML || '<p class="p-loading">Loading…</p>';
    const r = await safe(db.rpc('portal_onboarding', { p_user:id }));
    if (!isCurrent()) return;
    if (r.error || !Array.isArray(r.data)) { box.innerHTML = '<p class="p-empty">Couldn’t load the checklist. Try again.</p>'; return; }
    box.innerHTML = listHtml(r.data, true);
    if (refreshHead) {
      const done = r.data.filter(x => x.done).length, total = r.data.length, head = box.previousElementSibling;
      head.querySelector('.ob-bar').outerHTML = bar(done, total); widths(head);
      const p = head.querySelector('.p-pill'); p.className = 'p-pill' + (done === total ? ' is-ok' : ' is-plain'); p.textContent = done === total ? 'All done' : done + ' of ' + total;
    }
  }

  window.Onboarding = { open, card };
})();
