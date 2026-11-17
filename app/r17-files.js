// Round 17 (Nov 17 2026), part 7a: the Files hub.
//   #files  Amr: every file the portal keeps, in one place: your own files and the team's shared folder (new "files"
//           bucket), person files, receipts, contract files, call recordings, payslips, Deal tools files and backups.
//           Search, filter by place, open, upload (to My files or Team shared, optional folder), delete (files bucket only;
//           other places keep their own delete buttons on their pages so nothing they point to breaks).
//           Team: the shared folder only, to open and download.
// Encrypted deal files (Deal CRM) are not listed: they open only inside the CRM with the passphrase.
// Database: storage bucket "files" (owner all; members read files/shared/...), portal_files(), portal_shared_files().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, isOwner, fmtDay, fmtTime, num, plural, card, empty, failed, pill, f, opt, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const PLACES = [['files', 'My files'], ['shared', 'Team shared'], ['people-docs', 'Person files'], ['receipts', 'Receipts'], ['contract-files', 'Contract files'], ['hub-uploads', 'Call recordings'], ['payslips', 'Payslips'], ['deal-tools', 'Deal tools'], ['backups', 'Backups']];
  const placeOf = x => x.bucket === 'files' && x.name.startsWith('shared/') ? 'shared' : x.bucket;
  const placeName = p => (PLACES.find(x => x[0] === p) || [p, p])[1];
  const size = b => { b = +b || 0; return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B'; };
  const kindOf = (n, m) => /pdf/i.test(m || n) ? 'PDF' : /image|\.(png|jpe?g|gif|webp|heic)$/i.test(m || n) ? 'Image' : /audio|\.(mp3|m4a|wav|webm|ogg)$/i.test(m || n) ? 'Audio' : /video|\.mp4$/i.test(m || n) ? 'Video'
    : /sheet|csv|excel|\.xlsx?$/i.test(m || n) ? 'Sheet' : /word|\.docx?$/i.test(m || n) ? 'Word' : /html/i.test(m || n) ? 'Web page' : /gzip|json/i.test(m || n) ? 'Data' : 'File';
  const base = n => n.split('/').pop();
  const safeName = n => n.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-120) || 'file';

  V.files = { title:'Files', sec:'everyone', async open(el, ok){
    const owner = isOwner();
    const body = PX.page(el, 'Work', 'Files', owner ? 'Every file the portal keeps, in one place. Upload your own files or share some with the team.' : 'Files Amr shares with the team.');
    const r = await safe(db().rpc(owner ? 'portal_files' : 'portal_shared_files'));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    let files = (r.data || []).map(x => Object.assign({ bucket:'files' }, x));
    const S = { place:owner ? '' : 'shared', q:'', kind:'' };
    function draw(){
      const list = files.filter(x => (!S.place || placeOf(x) === S.place) && (!S.kind || kindOf(x.name, x.mime) === S.kind) && (!S.q || x.name.toLowerCase().includes(S.q)));
      const tot = {}; files.forEach(x => { const p = placeOf(x); (tot[p] = tot[p] || { n:0, b:0 }).n++; tot[p].b += +x.size || 0; });
      const kinds = [...new Set(files.map(x => kindOf(x.name, x.mime)))].sort();
      body.innerHTML = (owner ? card('Upload', 'up to 50 MB a file', '<form class="px-form r17-row" id="fuForm" novalidate>' +
          f('Put it in', '<select id="fuWhere">' + opt('files', 'My files (only you)') + opt('shared', 'Team shared (your team can open it)') + '</select>') +
          f('Folder (optional)', '<input type="text" id="fuFolder" maxlength="40" placeholder="e.g. Contracts 2026">') +
          f('Files', '<input type="file" id="fuFile" multiple>', 'px-wide') +
          '<div class="px-tools px-wide"><button type="submit" class="p-btn">Upload</button><span class="p-hint" id="fuMsg" role="status"></span></div></form>') +
        '<div class="px-tiles r17-places">' + PLACES.filter(p => tot[p[0]]).map(p => '<button type="button" class="px-tile r17-place' + (S.place === p[0] ? ' on' : '') + '" data-place="' + p[0] + '"><b>' + num(tot[p[0]].n) + '</b><span>' + esc(p[1]) + '</span><small>' + size(tot[p[0]].b) + '</small></button>').join('') + '</div>' : '') +
        '<div class="px-tools r17-filters">' + (owner ? f('Place', '<select id="fPlace">' + opt('', 'Everywhere') + PLACES.map(p => opt(p[0], p[1], S.place === p[0])).join('') + '</select>') : '') +
          f('Type', '<select id="fKind">' + opt('', 'Any type') + kinds.map(k => opt(k, k, S.kind === k)).join('') + '</select>') +
          f('Search', '<input type="search" id="fQ" value="' + esc(S.q) + '" placeholder="File or folder name">') + '</div>' +
        card(plural(list.length, 'file'), S.place ? placeName(S.place) : 'everywhere', list.length ? PX.table(['File', 'Place', 'Type', 'Size', 'Added', ''], list.slice(0, 400).map(x => {
          const folder = x.name.split('/').slice(x.bucket === 'files' ? 1 : 0, -1).join(' / ');
          return '<tr><td><b>' + esc(x.bucket === 'files' ? base(x.name).replace(/^[a-z0-9]{6,10}-/, '') : base(x.name)) + '</b>' + (folder ? '<br><small>' + esc(folder) + '</small>' : '') + '</td><td>' + esc(placeName(placeOf(x))) + '</td><td>' + esc(kindOf(x.name, x.mime)) + '</td><td>' + size(x.size) + '</td>' +
            '<td>' + esc(fmtDay(x.at, { month:'short', day:'numeric', year:'numeric' }) + ', ' + fmtTime(x.at)) + '</td><td class="r17-acts"><button type="button" class="p-btn is-ghost" data-open="' + esc(x.bucket + '|' + x.name) + '">Open</button>' +
            (owner && x.bucket === 'files' ? '<button type="button" class="p-btn is-ghost" data-rm="' + esc(x.name) + '">Delete</button>' : '') + '</td></tr>';
        })) + (list.length > 400 ? '<p class="p-hint">Showing the newest 400. Search to find others.</p>' : '') : empty(files.length ? 'No files match.' : owner ? 'No files yet. Upload the first one above.' : 'Nothing shared yet.')) +
        (owner ? '<p class="p-hint">Only My files and Team shared can be deleted here. Other files keep their delete buttons on their own pages. Encrypted Deal CRM files open only inside the CRM.</p>' : '');
    }
    draw();
    async function reload(){ const x = await safe(db().rpc(owner ? 'portal_files' : 'portal_shared_files')); if (!x.error) files = (x.data || []).map(y => Object.assign({ bucket:'files' }, y)); draw(); }
    body.addEventListener('change', e => {
      if (e.target.id === 'fPlace') { S.place = e.target.value; draw(); } else if (e.target.id === 'fKind') { S.kind = e.target.value; draw(); }
    });
    body.addEventListener('input', e => { if (e.target.id === 'fQ') { S.q = e.target.value.trim().toLowerCase(); const p = e.target.selectionStart; draw(); const i = body.querySelector('#fQ'); i.focus(); i.setSelectionRange(p, p); } });
    body.addEventListener('click', async e => {
      const pl = e.target.closest('[data-place]'); if (pl) { S.place = S.place === pl.dataset.place ? '' : pl.dataset.place; draw(); return; }
      const o = e.target.closest('[data-open]');
      if (o) { const [b, ...rest] = o.dataset.open.split('|'), name = rest.join('|'); o.disabled = true;
        const u = await safe(db().storage.from(b).createSignedUrl(name, 600)); o.disabled = false;
        if (u.data && u.data.signedUrl) window.open(u.data.signedUrl, '_blank', 'noopener'); else o.textContent = 'Couldn’t open';
        return; }
      const rm = e.target.closest('[data-rm]');
      if (rm) { if (rm.dataset.sure !== '1') { rm.dataset.sure = '1'; rm.textContent = 'Sure? Click again'; setTimeout(() => { if (rm.isConnected) { rm.dataset.sure = ''; rm.textContent = 'Delete'; } }, 4000); return; }
        rm.disabled = true; const x = await safe(db().storage.from('files').remove([rm.dataset.rm]));
        if (x.error) { rm.disabled = false; rm.textContent = 'Couldn’t delete'; return; } files = files.filter(y => !(y.bucket === 'files' && y.name === rm.dataset.rm)); draw(); }
    });
    body.addEventListener('submit', async e => {
      if (e.target.id !== 'fuForm') return; e.preventDefault();
      const picked = [...body.querySelector('#fuFile').files]; if (!picked.length) return say('fuMsg', 'Pick a file first.');
      const big = picked.find(x => x.size > 50 * 1048576); if (big) return say('fuMsg', base(big.name) + ' is over 50 MB.');
      const where = body.querySelector('#fuWhere').value, folder = body.querySelector('#fuFolder').value.trim().replace(/[\\/]+/g, ' ').replace(/[^\w .\-]+/g, '').trim();
      let done = 0;
      for (const file of picked) {
        say('fuMsg', 'Uploading ' + (done + 1) + ' of ' + picked.length + '…');
        const path = (where === 'shared' ? 'shared/' : 'mine/') + (folder ? folder + '/' : '') + Date.now().toString(36) + '-' + safeName(file.name);
        const x = await safe(db().storage.from('files').upload(path, file, { contentType:file.type || 'application/octet-stream', upsert:false }));
        if (x.error) return say('fuMsg', (done ? done + ' uploaded, then ' : '') + errText(x, 'Couldn’t upload ' + base(file.name) + '.'));
        done++;
      }
      await reload(); say('fuMsg', plural(done, 'file') + ' uploaded.');
    });
  }};
})();
