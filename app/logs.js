// Logs (Phase 0): Amr's view of what happened, at /app/#logs. Owner only; the database refuses everyone else.
//   Activity  sign-ins, Deal CRM saves, shift requests decided, recordings and drills sent, role and access changes
//             (portal_activity: never deal contents, hours or pay)
//   Errors    errors the signed-in pages hit in people's browsers (portal_errors, sent by portal-shell.js)
//   Changes   what shipped and what database changes ran (portal_changes)
//   Feedback  "Report a problem or idea" from every page (portal_feedback), with Mark done
//   Do not call  the do-not-call list reps add to (portal_dnc), with a CSV download for the dialer
// Tables: supabase/migrations/20261031090000_portal_logs.sql. Styles: /portal.css (.p-*) and app.css (#pLogs).
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const KIND = { signed_in:'Signed in', deal_saved:'Saved deals', request_decided:'Decided a shift request', drill_sent:'Sent a recording or drill', access_changed:'Changed access' };
  // access_log changes are stored as { field: { from, to } } or { added: {...} }: say them in words
  function words(detail){
    const m = String(detail || '').match(/^(.*?: )?(\{.*\})$/);
    if (!m) return detail || '';
    let o; try { o = JSON.parse(m[2]); } catch(e) { return detail; }
    const out = [];
    Object.keys(o).forEach(k => {
      const v = o[k] || {};
      if (k === 'added') { out.push('invited'); return; }
      if (Array.isArray(v.from) || Array.isArray(v.to)) {
        const a = (v.to || []).filter(x => !(v.from || []).includes(x)), r = (v.from || []).filter(x => !(v.to || []).includes(x));
        if (a.length) out.push(k + ' added: ' + a.join(', '));
        if (r.length) out.push(k + ' removed: ' + r.join(', '));
      } else out.push(k + ': ' + (v.from == null ? 'none' : v.from) + ' to ' + (v.to == null ? 'none' : v.to));
    });
    return (m[1] || '') + (out.join('; ') || 'changed');
  }
  const REASON = { asked:'Asked not to be called', wrong_number:'Wrong number', registry:'Do Not Call Registry', attorney:'Has an attorney', other:'Other' };
  const fmt = p => /^\d{10}$/.test(p) ? '(' + p.slice(0, 3) + ') ' + p.slice(3, 6) + '-' + p.slice(6) : p;
  let dncRows = [];
  document.addEventListener('click', async e => {
    if (e.target.closest('#lgCsv')) {
      const csv = 'phone,reason,added\n' + dncRows.map(x => x.phone + ',' + x.reason + ',' + String(x.added_at).slice(0, 10)).join('\n') + '\n';
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' })); a.download = 'do-not-call.csv';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return;
    }
    const dn = e.target.closest('.lg-done-btn');
    if (dn) { const db = window.TalentsApp && window.TalentsApp.db; if (!db) return; dn.disabled = true; await db.rpc('feedback_done', { p_id:Number(dn.dataset.id), p_done:dn.dataset.done === '1' }); load(); return; }
    const rm = e.target.closest('.lg-rm'); if (!rm) return;
    if (!rm.dataset.armed) { rm.dataset.armed = '1'; rm.textContent = 'Remove for good?'; return; }
    const db = window.TalentsApp && window.TalentsApp.db; if (!db) return;
    rm.disabled = true; const r = await db.rpc('dnc_remove', { p_phone:rm.dataset.phone });
    if (r.error) { rm.disabled = false; rm.textContent = 'Couldn’t remove'; return; }
    load();
  });
  const when = d => { try { return new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); } catch(e) { return ''; } };
  let tab = 'activity', days = 7, run = 0;

  function frame(){
    $('pLogs').innerHTML = '<div class="p-main"><div class="p-wrap">' +
      '<section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">Site</span><h1>Logs</h1><p>What happened on the portal, newest first. Only you see this.</p></div></section>' +
      '<div class="lg-bar"><nav class="p-mode" aria-label="Which log">' +
        ['activity', 'feedback', 'errors', 'changes', 'dnc'].map(t => '<a href="#logs/' + t + '" data-tab="' + t + '"' + (t === tab ? ' aria-current="page"' : '') + '>' + { activity:'Activity', feedback:'Feedback', errors:'Errors', changes:'Changes', dnc:'Do not call' }[t] + '</a>').join('') +
      '</nav><label class="lg-days"' + (tab === 'changes' || tab === 'dnc' ? ' hidden' : '') + '><span>Period</span><select id="lgDays"><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label></div>' +
      '<div id="lgBody"><p class="p-loading">Loading…</p></div></div></div>';
    $('lgDays').value = String(days);
    $('lgDays').addEventListener('change', () => { days = Number($('lgDays').value) || 7; load(); });
  }
  const table = (heads, rows) => '<div class="p-tablewrap"><table class="p-table lg-table"><thead><tr>' + heads.map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  const empty = t => '<p class="p-card p-empty">' + esc(t) + '</p>';

  async function load(){
    const my = ++run, db = window.TalentsApp && window.TalentsApp.db, box = $('lgBody');
    if (!db) return;
    box.innerHTML = '<p class="p-loading">Loading…</p>';
    let r;
    try { r = tab === 'feedback' ? await db.rpc('portal_feedback', { p_days:Math.max(days, 30) }) : tab === 'dnc' ? await db.rpc('portal_dnc') : tab === 'changes' ? await db.rpc('portal_changes') : await db.rpc(tab === 'errors' ? 'portal_errors' : 'portal_activity', { p_days:days }); }
    catch(e) { r = { error:e }; }
    if (my !== run) return;
    if (r.error) { box.innerHTML = empty(/does not exist|not find|404/i.test(r.error.message || '') ? 'Logs aren’t set up in the database yet.' : 'Couldn’t load the log. Check your connection and try again.'); return; }
    const rows = r.data || [];
    if (tab === 'activity') box.innerHTML = rows.length ? table(['When', 'Who', 'What', 'Details'], rows.map(x => '<tr><td class="lg-when">' + esc(when(x.at)) + '</td><td>' + esc(x.who) + '</td><td><span class="p-pill' + (x.kind === 'access_changed' ? '' : ' is-plain') + '">' + esc(KIND[x.kind] || x.kind) + '</span></td><td class="lg-detail">' + esc(x.kind === 'access_changed' ? words(x.detail) : x.detail || '') + '</td></tr>')) : empty('Nothing in this period.');
    else if (tab === 'errors') box.innerHTML = rows.length ? table(['When', 'Who', 'Page', 'Error'], rows.map(x => '<tr><td class="lg-when">' + esc(when(x.at)) + '</td><td>' + esc(x.who) + '</td><td class="lg-detail">' + esc(x.page || '') + '</td><td class="lg-detail"><b>' + esc(x.message) + '</b>' + (x.source ? '<small>' + esc(x.source) + (x.line ? ':' + x.line : '') + '</small>' : '') + '</td></tr>')) : empty('No errors in this period. Nice.');
    else if (tab === 'feedback') box.innerHTML = rows.length ? table(['When', 'Who', 'What', ''], rows.map(x => '<tr' + (x.done ? ' class="lg-done"' : '') + '><td class="lg-when">' + esc(when(x.at)) + '</td><td>' + esc(x.who) +
        '</td><td><span class="p-pill' + (x.kind === 'idea' ? ' is-plain' : '') + '">' + (x.kind === 'idea' ? 'Idea' : 'Problem') + '</span> <span class="lg-fb">' + esc(x.message) + '</span>' + (x.page ? '<small>' + esc(x.page) + '</small>' : '') +
        '</td><td><button type="button" class="p-btn is-ghost lg-done-btn" data-id="' + x.id + '" data-done="' + (x.done ? '0' : '1') + '">' + (x.done ? 'Reopen' : 'Mark done') + '</button></td></tr>')) : empty('Nothing yet. Everyone can send one from the Apps menu: Report a problem or idea.');
    else if (tab === 'dnc') {
      dncRows = rows;
      box.innerHTML = (rows.length ? '<div class="lg-acts"><button type="button" class="p-btn is-ghost" id="lgCsv">Download for the dialer (CSV)</button></div>' +
        table(['Number', 'Why', 'Added by', 'When', ''], rows.map(x => '<tr><td class="lg-when">' + esc(fmt(x.phone)) + '</td><td>' + esc(REASON[x.reason] || x.reason) + (x.note ? '<small>' + esc(x.note) + '</small>' : '') +
          '</td><td>' + esc(x.who) + '</td><td class="lg-when">' + esc(when(x.added_at)) + '</td><td><button type="button" class="p-btn is-ghost lg-rm" data-phone="' + esc(x.phone) + '">Remove</button></td></tr>'))
        : empty('No numbers yet. Reps add them from My hours while they call.'));
    }
    else box.innerHTML = rows.length ? table(['When', 'What shipped', 'Database changes'], rows.map(x => '<tr><td class="lg-when">' + esc(when(x.at)) + '</td><td><b>' + (x.link ? '<a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a>' : esc(x.title)) + '</b>' + (x.detail ? '<small>' + esc(x.detail) + '</small>' : '') + '</td><td class="lg-detail">' + esc(x.sql_ran || '') + '</td></tr>')) : empty('No releases logged yet.');
  }

  window.PortalLogs = {
    open(which){ tab = ['activity', 'feedback', 'errors', 'changes', 'dnc'].includes(which) ? which : 'activity'; frame(); load(); },
    close(){ run++; }
  };
})();
