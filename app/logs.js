// Logs (Phase 0): Amr's view of what happened, at /app/#logs. Owner only; the database refuses everyone else.
//   Activity  sign-ins, Deal CRM saves, shift requests decided, recordings and drills sent, role and access changes
//             (portal_activity: never deal contents, hours or pay)
//   Errors    errors the signed-in pages hit in people's browsers (portal_errors, sent by portal-shell.js)
//   Changes   what shipped and what database changes ran (portal_changes)
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
  const when = d => { try { return new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); } catch(e) { return ''; } };
  let tab = 'activity', days = 7, run = 0;

  function frame(){
    $('pLogs').innerHTML = '<div class="p-main"><div class="p-wrap">' +
      '<section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">Site</span><h1>Logs</h1><p>What happened on the portal, newest first. Only you see this.</p></div></section>' +
      '<div class="lg-bar"><nav class="p-mode" aria-label="Which log">' +
        ['activity', 'errors', 'changes'].map(t => '<a href="#logs/' + t + '" data-tab="' + t + '"' + (t === tab ? ' aria-current="page"' : '') + '>' + { activity:'Activity', errors:'Errors', changes:'Changes' }[t] + '</a>').join('') +
      '</nav><label class="lg-days"' + (tab === 'changes' ? ' hidden' : '') + '><span>Period</span><select id="lgDays"><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label></div>' +
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
    try { r = tab === 'changes' ? await db.rpc('portal_changes') : await db.rpc(tab === 'errors' ? 'portal_errors' : 'portal_activity', { p_days:days }); }
    catch(e) { r = { error:e }; }
    if (my !== run) return;
    if (r.error) { box.innerHTML = empty(/does not exist|not find|404/i.test(r.error.message || '') ? 'Logs aren’t set up in the database yet.' : 'Couldn’t load the log. Check your connection and try again.'); return; }
    const rows = r.data || [];
    if (tab === 'activity') box.innerHTML = rows.length ? table(['When', 'Who', 'What', 'Details'], rows.map(x => '<tr><td class="lg-when">' + esc(when(x.at)) + '</td><td>' + esc(x.who) + '</td><td><span class="p-pill' + (x.kind === 'access_changed' ? '' : ' is-plain') + '">' + esc(KIND[x.kind] || x.kind) + '</span></td><td class="lg-detail">' + esc(x.kind === 'access_changed' ? words(x.detail) : x.detail || '') + '</td></tr>')) : empty('Nothing in this period.');
    else if (tab === 'errors') box.innerHTML = rows.length ? table(['When', 'Who', 'Page', 'Error'], rows.map(x => '<tr><td class="lg-when">' + esc(when(x.at)) + '</td><td>' + esc(x.who) + '</td><td class="lg-detail">' + esc(x.page || '') + '</td><td class="lg-detail"><b>' + esc(x.message) + '</b>' + (x.source ? '<small>' + esc(x.source) + (x.line ? ':' + x.line : '') + '</small>' : '') + '</td></tr>')) : empty('No errors in this period. Nice.');
    else box.innerHTML = rows.length ? table(['When', 'What shipped', 'Database changes'], rows.map(x => '<tr><td class="lg-when">' + esc(when(x.at)) + '</td><td><b>' + (x.link ? '<a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a>' : esc(x.title)) + '</b>' + (x.detail ? '<small>' + esc(x.detail) + '</small>' : '') + '</td><td class="lg-detail">' + esc(x.sql_ran || '') + '</td></tr>')) : empty('No releases logged yet.');
  }

  window.PortalLogs = {
    open(which){ tab = ['activity', 'errors', 'changes'].includes(which) ? which : 'activity'; frame(); load(); },
    close(){ run++; }
  };
})();
