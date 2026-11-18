// Seller upload page at /upload/#t=<link>. A rep makes the link in the Deal CRM (round 20) and texts it to the seller.
// The page can only: read who asked and whether the link is open (seller_link_info), put files into the link's own
// folder in the private "seller-uploads" storage (allowed only while the link is open and has room), and record each
// file (seller_upload_done, which also checks for spam and rings the rep's bell). Nothing about the deal is shown here.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const startedAt = new Date().toISOString();
  const cfg = window.TRACKER_CONFIG || {};
  const db = window.supabase && cfg.supabaseUrl ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth:{ persistSession:false } }) : null;
  const token = ((location.hash.match(/t=([0-9a-f-]{36})/i) || location.search.match(/t=([0-9a-f-]{36})/i) || [])[1] || '').toLowerCase();
  const MAX = 100 * 1048576;
  const OK = /^(image\/|video\/(mp4|quicktime|webm|3gpp)$|application\/pdf$)/;
  let left = 0, files = [];
  const say = t => { $('uMsg').textContent = t; $('uMsg').hidden = !t; };
  const size = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const clean = n => (n || 'file').normalize('NFKD').replace(/[^A-Za-z0-9._ -]+/g, '').replace(/\s+/g, ' ').trim().slice(-100) || 'file';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  async function start(){
    if (!token) return closed('This link is missing a part. Open it again from the text you got.');
    if (!db) return closed('The page couldn’t load. Refresh it, or reply to the text you got.');
    const r = await db.rpc('seller_link_info', { p_token:token });
    const i = r.data || {};
    if (r.error || !i.ok) return closed(i.why === 'closed' ? 'This link is closed now. Ask ' + (i.rep || 'the person who sent it') + ' for a new one.' : 'This link doesn’t work. Ask for a new one.');
    left = +i.left || 0;
    $('uTitle').textContent = 'Send photos to ' + (i.rep || 'us');
    $('uLede').textContent = 'Pick photos or a short video of the property. ' + (i.rep ? i.rep + ' gets them' : 'They arrive') + ' right away. No account needed.' + (left < 40 ? ' You can send ' + left + ' more file' + (left === 1 ? '' : 's') + '.' : '');
    $('uForm').hidden = false;
  }
  function closed(t){ $('uLede').textContent = t; $('uForm').hidden = true; }
  function draw(){
    $('uList').innerHTML = files.map((f, i) => '<li><span>' + esc(f.file.name) + '<br><small>' + size(f.file.size) + (f.err ? '' : f.done ? '' : f.pct ? ' · sending' : '') + '</small></span>' +
      (f.err ? '<span class="no">' + esc(f.err) + '</span>' : f.done ? '<span class="ok">Sent</span>' : '<button type="button" class="btn" data-rm="' + i + '" aria-label="Remove ' + esc(f.file.name) + '" style="padding:6px 12px;font-size:13px">Remove</button>') +
      '<span class="bar"><i style="width:' + (f.done ? 100 : f.pct || 0) + '%"></i></span></li>').join('');
    $('uGo').disabled = !files.some(f => !f.done && !f.err);
  }
  $('uFiles').addEventListener('change', e => {
    say('');
    [...e.target.files].forEach(file => {
      const f = { file };
      if (file.size > MAX) f.err = 'Over 100 MB'; else if (file.type && !OK.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) f.err = 'Photos, videos or PDFs only';
      files.push(f);
    });
    const waiting = files.filter(f => !f.done && !f.err);
    if (waiting.length > left) { waiting.slice(left).forEach(f => { f.err = 'Too many files for this link'; }); }
    e.target.value = ''; draw();
  });
  $('uList').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; files.splice(+b.dataset.rm, 1); draw(); });
  $('uForm').addEventListener('submit', async e => {
    e.preventDefault(); say('');
    const todo = files.filter(f => !f.done && !f.err); if (!todo.length) return;
    $('uGo').disabled = true; $('uGo').textContent = 'Sending…';
    let sent = 0;
    for (const f of todo) {
      const path = token + '/' + uuid() + '-' + clean(f.file.name);
      const type = f.file.type || (/\.(heic|heif)$/i.test(f.file.name) ? 'image/heic' : 'application/octet-stream');
      f.pct = 15; draw();
      const up = await db.storage.from('seller-uploads').upload(path, f.file, { contentType:type, upsert:false });
      if (up.error) { f.err = /exceed|size/i.test(up.error.message || '') ? 'Too big' : /policy|security/i.test(up.error.message || '') ? 'Link closed or full' : 'Didn’t send. Try again'; draw(); continue; }
      f.pct = 85; draw();
      const x = await db.rpc('seller_upload_done', { p_token:token, p_path:path, p_name:f.file.name, p_mime:type, p_note:$('uNote').value.trim() || null, p_started_at:startedAt, p_website:$('uWebsite').value || null });
      if (x.error) { f.err = (x.error.message || '').length < 80 ? x.error.message : 'Didn’t send. Try again'; draw(); continue; }
      f.done = true; left--; sent++; draw();
    }
    $('uGo').textContent = 'Send';
    if (sent && !files.some(f => f.err)) { $('uForm').hidden = true; $('uDone').hidden = false; $('uDone').focus(); $('uDoneP').textContent = sent + ' file' + (sent === 1 ? '' : 's') + ' sent. They got a message that your files arrived.'; }
    else if (files.some(f => f.err)) say(sent ? sent + ' sent. Some files didn’t go; see the list.' : 'Nothing was sent. See the list, then try again.');
  });
  $('uMore').addEventListener('click', () => { files = []; draw(); $('uDone').hidden = true; start(); });
  start();
})();
