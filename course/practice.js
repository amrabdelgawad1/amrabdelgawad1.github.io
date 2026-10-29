// Practice out loud: on every lesson, a learner records themselves (or uploads a recording) and sends it to Amr.
// Uploads go to the private "hub-uploads" bucket at <user>/acq/<file> and a row in hub_uploads; Amr scores and
// comments in the Review center (/app/#review). Learners see their own recordings, status, score and comments here.
(function(){
  'use strict';
  const MAX_S = 30 * 60, MAX_B = 50 * 1024 * 1024;
  const CATS = ['Opening and upfront agreement', 'Rapport', 'Property discovery', 'Pain depth', 'Timeline, money, decision makers',
    'Getting their number', 'Offer framing', 'Objection handling', 'Listening and talk ratio', 'Close and next step'];
  const band = t => t >= 45 ? 'Ready for live leads' : t >= 38 ? 'Solid. Sharpen one or two areas' : t >= 30 ? 'Keep drilling the stages' : 'Back to the script daily';
  const clock = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pickMime = () => {
    if (!window.MediaRecorder) return null;
    for (const t of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  };
  const extOf = mime => /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /mpeg|mp3/.test(mime) ? 'mp3' : /wav/.test(mime) ? 'wav' : 'webm';

  function html(lessonTitle, prompt){
    return '<section class="practice" aria-labelledby="prH">' +
      '<div class="pr-top"><span class="label o">Practice out loud</span><h2 class="sub" id="prH">Record yourself and send it to Amr</h2>' +
      '<p class="note">' + (prompt ? CourseMarkdown.inline(prompt) : 'Say this lesson’s lines out loud, or run a short role-play with a colleague or with Claude playing the seller. Amr listens, scores it and leaves comments at the exact moments that matter.') + '</p></div>' +
      '<div class="pr-rec" id="prRec">' +
        '<div class="pr-row"><button class="btn orange" type="button" data-pr="start" id="prStart">Start recording</button>' +
          '<label class="btn line pr-file"><input type="file" class="vh" id="prFile" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg">Upload a recording</label></div>' +
        '<div class="pr-live" id="prLive" hidden><span class="pr-dot" aria-hidden="true"></span><span id="prClock" aria-live="off">0:00</span><button class="btn dark" type="button" data-pr="stop">Stop</button></div>' +
        '<div class="pr-review" id="prReview" hidden>' +
          '<audio controls id="prPreview"></audio>' +
          '<label class="field-lbl" for="prTitle">Title</label><input type="text" id="prTitle" maxlength="200" value="' + CourseMarkdown.esc('Practice: ' + lessonTitle) + '">' +
          '<label class="field-lbl" for="prNote">Anything Amr should know? (optional)</label><textarea id="prNote" rows="2" maxlength="2000"></textarea>' +
          '<label class="pr-check"><input type="checkbox" id="prReal"> This is a real seller call, not a role-play</label>' +
          '<label class="pr-check" id="prConsentRow" hidden><input type="checkbox" id="prConsent"> Everyone on the call agreed to be recorded, and I’ve left out the seller’s name, phone and address</label>' +
          '<p class="err" id="prErr" role="alert"></p>' +
          '<div class="pr-row"><button class="btn line" type="button" data-pr="discard">Discard</button><button class="btn orange" type="button" data-pr="send" id="prSend">Send to Amr</button></div>' +
        '</div>' +
        '<p class="note" id="prMsg" role="status"></p>' +
      '</div>' +
      '<div class="pr-mine" id="prMine"></div>' +
    '</section>';
  }

  async function mount(root, o){
    // o: { db, user, mod, it, title, toast }
    const { db, user, mod, it } = o;
    const $ = id => root.querySelector('#' + id);
    root.innerHTML = html(o.title, it.practice && it.practice.prompt);
    let rec = null, chunks = [], stream = null, started = 0, tick = null, blob = null, mime = '', fileName = '', dur = null;

    const reset = () => {
      if (tick) clearInterval(tick); tick = null;
      if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
      rec = null; chunks = []; blob = null; dur = null;
      $('prLive').hidden = true; $('prReview').hidden = true; $('prStart').hidden = false; root.querySelector('.pr-file').hidden = false;
      const p = $('prPreview'); if (p.src) { URL.revokeObjectURL(p.src); p.removeAttribute('src'); }
      $('prErr').textContent = ''; $('prReal').checked = false; $('prConsent').checked = false; $('prConsentRow').hidden = true; $('prNote').value = '';
    };
    const ready = (b, m, name, seconds) => {
      blob = b; mime = (m || b.type || 'audio/webm').split(';')[0]; fileName = name; dur = seconds;
      $('prLive').hidden = true; $('prStart').hidden = true; root.querySelector('.pr-file').hidden = true; $('prReview').hidden = false;
      $('prPreview').src = URL.createObjectURL(b);
      $('prMsg').textContent = seconds ? 'Recorded ' + clock(seconds) + '. Listen back, then send it.' : 'Listen back, then send it.';
    };

    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-pr]'); if (!b) return;
      const act = b.dataset.pr;
      if (act === 'start') {
        const m = pickMime();
        if (m === null || !navigator.mediaDevices) { $('prMsg').textContent = 'This browser can’t record. Use “Upload a recording” instead, or try Chrome or Safari.'; return; }
        try { stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true } }); }
        catch(err){ $('prMsg').textContent = 'The microphone is blocked. Allow it in your browser’s site settings, then try again.'; return; }
        chunks = [];
        rec = new MediaRecorder(stream, m ? { mimeType:m, audioBitsPerSecond:48000 } : undefined);
        rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
        rec.onstop = () => {
          const secs = Math.round((Date.now() - started) / 1000);
          const type = rec.mimeType || m || 'audio/webm';
          stream.getTracks().forEach(t => t.stop()); stream = null;
          ready(new Blob(chunks, { type }), type, 'recording.' + extOf(type), secs);
        };
        rec.start(1000); started = Date.now();
        $('prStart').hidden = true; root.querySelector('.pr-file').hidden = true; $('prLive').hidden = false; $('prMsg').textContent = 'Recording…';
        tick = setInterval(() => { const s = (Date.now() - started) / 1000; $('prClock').textContent = clock(s); if (s >= MAX_S) rec.stop(), clearInterval(tick); }, 500);
      }
      if (act === 'stop' && rec && rec.state !== 'inactive') { clearInterval(tick); rec.stop(); }
      if (act === 'discard') { reset(); $('prMsg').textContent = ''; }
      if (act === 'send') {
        if (!blob) return;
        const real = $('prReal').checked, consent = $('prConsent').checked;
        if (real && !consent) { $('prErr').textContent = 'For a real call, confirm that everyone agreed to be recorded.'; $('prConsent').focus(); return; }
        if (blob.size > MAX_B) { $('prErr').textContent = 'That recording is over 50 MB. Keep it under about 30 minutes.'; return; }
        b.setAttribute('aria-busy', 'true'); $('prErr').textContent = ''; $('prMsg').textContent = 'Sending…';
        const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-60);
        const path = user.id + '/acq/' + Date.now() + '-' + safe;
        const up = await db.storage.from('hub-uploads').upload(path, blob, { contentType:mime, upsert:false });
        if (up.error) { b.removeAttribute('aria-busy'); $('prMsg').textContent = ''; $('prErr').textContent = /mime|type/i.test(up.error.message || '') ? 'That kind of file isn’t allowed. Send an audio file (m4a, mp3, wav, webm).' : /size|large/i.test(up.error.message || '') ? 'That recording is too large.' : 'It didn’t send. Check your connection and try again.'; return; }
        const row = { course:'acq', module:mod.id, item:it.id, title:($('prTitle').value || '').trim().slice(0, 200) || 'Practice', kind:'recording', path, file_name:fileName.slice(0, 200), mime, size_bytes:blob.size, duration_s:dur, note:($('prNote').value || '').trim().slice(0, 2000) || null, real_call:real, consent:real && consent };
        const ins = await db.from('hub_uploads').insert(row);
        b.removeAttribute('aria-busy');
        if (ins.error) { await db.storage.from('hub-uploads').remove([path]); $('prMsg').textContent = ''; $('prErr').textContent = /hub_uploads/.test(ins.error.message || '') ? 'Recordings aren’t switched on yet. Ask Amr.' : 'It didn’t send. Try again.'; return; }
        reset(); $('prMsg').textContent = ''; if (o.toast) o.toast('Sent to Amr');
        mine();
      }
      if (act === 'del') {
        const id = b.dataset.id, p = b.dataset.path;
        b.setAttribute('aria-busy', 'true');
        const r = await db.from('hub_uploads').delete().eq('id', id);
        if (!r.error) await db.storage.from('hub-uploads').remove([p]);
        mine();
      }
      if (act === 'seek') { const a = root.querySelector('audio[data-id="' + CSS.escape(b.dataset.id) + '"]'); if (a) { a.currentTime = +b.dataset.t; a.play().catch(() => {}); } }
    });
    root.addEventListener('change', e => {
      if (e.target.id === 'prReal') { $('prConsentRow').hidden = !e.target.checked; return; }
      if (e.target.id !== 'prFile') return;
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      if (f.size > MAX_B) { $('prMsg').textContent = 'That file is over 50 MB.'; return; }
      if (!/^audio\//.test(f.type) && !/\.(m4a|mp3|wav|webm|ogg|aac)$/i.test(f.name)) { $('prMsg').textContent = 'Choose an audio file (m4a, mp3, wav, webm).'; return; }
      const type = f.type || ('audio/' + (extOf(f.name) === 'm4a' ? 'mp4' : extOf(f.name)));
      ready(f, type, f.name, null);
      $('prTitle').value = 'Practice: ' + o.title;
    });

    // My recordings for this lesson
    async function mine(){
      const box = $('prMine');
      const { data, error } = await db.from('hub_uploads').select('*').eq('user_id', user.id).eq('course', 'acq').eq('module', mod.id).eq('item', it.id).order('created_at', { ascending:false });
      if (error) { box.innerHTML = ''; return; }
      if (!data.length) { box.innerHTML = ''; return; }
      const ids = data.map(d => d.id);
      const [cm, sg] = await Promise.all([
        db.from('hub_upload_comments').select('*').in('upload_id', ids).order('created_at'),
        db.storage.from('hub-uploads').createSignedUrls(data.map(d => d.path), 3600)
      ]);
      const urls = {}; ((sg && sg.data) || []).forEach(s => urls[s.path] = s.signedUrl);
      const cs = {}; ((cm && cm.data) || []).forEach(c => (cs[c.upload_id] = cs[c.upload_id] || []).push(c));
      const esc = CourseMarkdown.esc;
      box.innerHTML = '<h3 class="sub">Your recordings</h3><ul class="pr-list">' + data.map(d => {
        const tot = d.score && d.score.total;
        const st = d.status === 'approved' ? '<span class="chip ok">Approved</span>' : d.status === 'redo' ? '<span class="chip warm">Redo it</span>' : '<span class="chip">Waiting for Amr</span>';
        return '<li class="pr-item"><div class="between"><b>' + esc(d.title) + '</b>' + st + '</div>' +
          (urls[d.path] ? '<audio controls preload="metadata" src="' + esc(urls[d.path]) + '" data-id="' + esc(d.id) + '"></audio>' : '') +
          (tot ? '<details class="pr-score"><summary>Score: <b>' + tot + ' of 50</b> · ' + esc(band(tot)) + '</summary><ul>' + d.score.cats.map((v, i) => '<li><span>' + esc(CATS[i]) + '</span><b>' + v + '</b></li>').join('') + '</ul></details>' : '') +
          ((cs[d.id] || []).length ? '<ul class="pr-cms">' + cs[d.id].map(c => '<li>' + (c.at_s != null ? '<button class="pr-at" type="button" data-pr="seek" data-id="' + esc(d.id) + '" data-t="' + esc(c.at_s) + '">' + clock(c.at_s) + '</button>' : '') + '<span class="pr-cm-who">' + (c.author === user.id ? 'You' : 'Amr') + ':</span> ' + esc(c.body) + '</li>').join('') + '</ul>' : '') +
          (d.status === 'waiting' ? '<button class="link-btn" type="button" data-pr="del" data-id="' + esc(d.id) + '" data-path="' + esc(d.path) + '">Delete</button>' : '') +
          '</li>';
      }).join('') + '</ul>';
    }
    mine();
    return () => reset();
  }
  window.CoursePractice = { mount };
})();
