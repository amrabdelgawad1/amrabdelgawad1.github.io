// Tool files (Nov 2026): Amr's page for putting a new build of a private tool live, at /app/#logs/files.
// The Deal CRM and the two calculators are single HTML files in the private storage bucket "deal-tools"; nothing of
// them is on this website. Before this page, a new build went up by hand from the browser console. Here it's one step:
//   1. pick the built file; its size and sha256 are worked out in this browser (compare with the build's hash)
//   2. checks: an .html file, not tiny, and it still has the portal guard (runs only on this site, after deal-gate.js)
//   3. Put it live: the current file is moved to "<name>-before-<date-time>.html", the new one uploaded, then
//      downloaded back and its hash compared. If the upload fails, the old file is moved back.
// Storage rule "Deal tools: owner manage" lets only Amr (is_tracker_admin) write this bucket; nobody else gets here.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const BUCKET = 'deal-tools';
  const TOOLS = [
    { file:'crm.html', name:'Deal CRM', page:'/app/deals/', guard:'\\/app\\/deals\\/' },
    { file:'land-calculator-v2.html', name:'Land calculator', page:'/land-calculator/', guard:'(land|house)-calculator' },
    { file:'house-calculator-v2.html', name:'House calculator', page:'/house-calculator/', guard:'(land|house)-calculator' }
  ];
  const kb = n => n == null ? '–' : n >= 1024 ? Math.round(n / 1024).toLocaleString('en-US') + ' KB' : n + ' bytes';
  const when = d => { try { return new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); } catch(e) { return ''; } };
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); };
  async function sha256(buf){ const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }

  // What's wrong with a picked file for this tool, or '' when it's fine
  function problem(tool, file, text){
    if (!/\.html?$/i.test(file.name)) return 'That isn’t an .html file.';
    if (file.size < 20 * 1024) return 'That file is very small (' + kb(file.size) + '). It doesn’t look like a full build.';
    if (!/<html[\s>]/i.test(text) || !/<\/html>/i.test(text)) return 'That file doesn’t look like a whole web page.';
    if (text.indexOf('window.DealGate') < 0 || text.indexOf('amrabdelgawad\\.site') < 0 || text.indexOf(tool.guard) < 0)
      return 'The portal guard is missing, so this file would also run outside the portal. Build it again with the guard (portal-backups: crm-build or calc-build).';
    return '';
  }

  let picked = {}, box = null, db = null, run = 0;
  function draw(list){
    const live = name => list.find(o => o.name === name);
    const backups = list.filter(o => /-before-/.test(o.name)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    box.innerHTML = '<p class="tf-intro">Put a new build of a private tool live. The file you pick is checked here first; the current one is kept as a backup, and the upload is read back to make sure it arrived whole.</p>' +
      TOOLS.map((t, i) => {
        const o = live(t.file), p = picked[t.file];
        return '<section class="p-card tf-tool" aria-labelledby="tfH' + i + '"><div class="p-card-head"><h2 id="tfH' + i + '">' + esc(t.name) + '</h2><span>' + esc(t.file) + '</span></div>' +
          '<p class="tf-now">' + (o ? 'Live now: ' + kb(o.metadata && o.metadata.size) + ', updated ' + esc(when(o.updated_at)) : 'Not in storage yet.') + ' · <a href="' + esc(t.page) + '">Open it</a></p>' +
          '<label class="tf-pick"><span>New build</span><input type="file" accept=".html,text/html" data-tf="' + esc(t.file) + '"></label>' +
          (p && p.name ? '<div class="tf-info">' +
              '<p><b>' + esc(p.name) + '</b> · ' + kb(p.size) + '</p>' +
              '<p class="tf-hash">sha256 <code>' + esc(p.hash) + '</code></p>' +
              '<label class="tf-want"><span>Hash from the build (optional)</span><input type="text" spellcheck="false" autocomplete="off" placeholder="Paste it to compare" data-want="' + esc(t.file) + '" value="' + esc(p.want || '') + '"></label>' +
              (p.want ? '<p class="tf-' + (p.want === p.hash ? 'ok">Matches the build.' : 'bad">Doesn’t match the build. Check you picked the right file.') + '</p>' : '') +
              (p.problem ? '<p class="tf-bad" role="alert">' + esc(p.problem) + '</p>' : '') +
              '<div class="tf-acts"><button type="button" class="p-btn" data-go="' + esc(t.file) + '"' + (p.problem || (p.want && p.want !== p.hash) || p.busy ? ' disabled' : '') + '>' + (p.busy ? 'Putting it live…' : 'Put it live') + '</button>' +
              '<button type="button" class="p-btn is-ghost" data-clear="' + esc(t.file) + '"' + (p.busy ? ' disabled' : '') + '>Cancel</button></div>' +
            '</div>' : '') +
          (p && p.result ? '<p class="tf-' + (p.result.ok ? 'ok' : 'bad') + '" role="status">' + esc(p.result.msg) + '</p>' : '') +
          '</section>';
      }).join('') +
      '<section class="p-card" aria-labelledby="tfBk"><div class="p-card-head"><h2 id="tfBk">Backups</h2><span>' + backups.length + '</span></div>' +
        (backups.length ? '<ul class="tf-backups">' + backups.slice(0, 12).map(o => '<li><span>' + esc(o.name) + '</span><small>' + kb(o.metadata && o.metadata.size) + ' · ' + esc(when(o.updated_at)) + '</small></li>').join('') + '</ul>' +
          (backups.length > 12 ? '<p class="tf-now">And ' + (backups.length - 12) + ' older.</p>' : '') : '<p class="p-empty">No backups yet.</p>') +
        '<p class="tf-now">To roll back, download a backup from Supabase storage and put it live here as the new build.</p></section>';
  }

  async function load(){
    const my = ++run;
    box.innerHTML = '<p class="p-loading">Loading…</p>';
    const a = await db.storage.from(BUCKET).list('', { limit:200, sortBy:{ column:'updated_at', order:'desc' } });
    if (my !== run) return;
    if (a.error) { box.innerHTML = '<p class="p-card p-empty">Couldn’t read the tool files. Only you can open this, signed in with two-step. Refresh to try again.</p>'; return; }
    draw((a.data || []).filter(o => o.id));
  }

  async function pick(input){
    const t = TOOLS.find(x => x.file === input.dataset.tf), f = input.files && input.files[0];
    if (!t || !f) return;
    const buf = await f.arrayBuffer(), text = new TextDecoder().decode(buf);
    picked[t.file] = { name:f.name, size:f.size, buf, hash:await sha256(buf), problem:problem(t, f, text), want:'' };
    load();
  }

  async function goLive(file){
    const p = picked[file]; if (!p || !p.name || p.busy || p.problem) return;
    p.busy = true; p.result = null; load();
    const store = db.storage.from(BUCKET), backup = file.replace(/\.html$/, '') + '-before-' + stamp() + '.html';
    const done = (ok, msg) => { p.busy = false; p.result = { ok, msg }; if (ok) picked[file] = { result:p.result }; load(); };
    const had = await store.list('', { search:file });
    const exists = !had.error && (had.data || []).some(o => o.name === file);
    if (exists) {
      const mv = await store.move(file, backup);
      if (mv.error) return done(false, 'Couldn’t back up the current file, so nothing changed. ' + (mv.error.message || ''));
    }
    const up = await store.upload(file, new Blob([p.buf], { type:'text/html' }), { contentType:'text/html', upsert:false, cacheControl:'60' });
    if (up.error) {
      const back = exists ? await store.move(backup, file) : { error:null };
      return done(false, 'The upload failed. ' + (back.error ? 'Putting the old file back also failed: rename ' + backup + ' to ' + file + ' in Supabase storage.' : 'The old file is back in place, so nothing changed.'));
    }
    // Read it back fresh: a plain download can come from the browser's cache of the old file (seen Nov 13)
    let got = null;
    for (let i = 0; i < 3 && got !== p.hash; i++) {
      if (i) await new Promise(r => setTimeout(r, 1500));
      const su = await store.createSignedUrl(file, 120);
      if (su.error || !su.data) continue;
      try { const r = await fetch(su.data.signedUrl + '&fresh=' + Date.now(), { cache:'no-store' }); if (r.ok) got = await sha256(await r.arrayBuffer()); } catch(e) {}
    }
    if (got !== p.hash) return done(false, 'Uploaded, but reading it back ' + (got ? 'gave a different file (sha256 ' + got.slice(0, 12) + '…)' : 'failed') + '. Open the tool to check; the old one is kept as ' + backup + '.');
    done(true, 'Live and checked: what’s in storage matches the file you picked. The old one is kept as ' + backup + '. Browsers may show the old version for a minute; tell the team to refresh.');
  }

  document.addEventListener('change', e => { const i = e.target.closest && e.target.closest('input[data-tf]'); if (i && box && box.contains(i)) pick(i); });
  document.addEventListener('input', e => {
    const i = e.target.closest && e.target.closest('input[data-want]'); if (!i || !box || !box.contains(i)) return;
    const p = picked[i.dataset.want]; if (!p) return;
    p.want = i.value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
    clearTimeout(i._t); i._t = setTimeout(() => { load().then(() => { const n = box.querySelector('input[data-want="' + i.dataset.want + '"]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); }, 500);
  });
  document.addEventListener('click', e => {
    if (!box || !box.contains(e.target)) return;
    const g = e.target.closest('[data-go]'); if (g) { goLive(g.dataset.go); return; }
    const c = e.target.closest('[data-clear]'); if (c) { delete picked[c.dataset.clear]; load(); }
  });

  window.ToolFiles = {
    open(el, client){ box = el; db = client; load(); },
    close(){ run++; box = null; }
  };
})();
