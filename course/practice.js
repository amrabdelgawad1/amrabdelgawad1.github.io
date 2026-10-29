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
    // mp4 first: it keeps the length, so seeking works
    for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  };
  const extOf = mime => /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /mpeg|mp3/.test(mime) ? 'mp3' : /wav/.test(mime) ? 'wav' : 'webm';


  // Drills shown above the recorder, so the words are on screen while the learner records.
  // A lesson's "practice" is { intro, drills:[...] } or a single drill. Each drill has a level:
  //   read    lines:[{who:'you'|'seller', say}]      read the script out loud, word for word
  //   respond pairs:[{them, you, why}]                 answer the seller's line; the model answer stays hidden until asked
  //   run     brief:{who, know:[], goal, hidden:[]}   no script; run the whole call from a brief
  const LEVELS = { read:['Level 1', 'Read it'], respond:['Level 2', 'Respond to it'], run:['Level 3', 'Run it'] };
  const HOW = {
    read:'Read every line out loud, word for word, at the pace you would use on a real call. Record the whole script in one take.',
    respond:'Press record, read the seller’s line out loud, then answer it in your own voice before you look at the model answer. Move to the next line without stopping the recording.',
    run:'No script. Read the brief, have a colleague (or Claude) play the seller using the secret notes, and run the full call. Amr scores it on the 50-point scorecard.'
  };
  function drillsOf(pr){
    if (!pr) return [];
    const list = Array.isArray(pr.drills) ? pr.drills : (pr.level ? [pr] : []);
    return list.filter(d => d && LEVELS[d.level]);
  }
  function drillHtml(d, i, n){
    const md = CourseMarkdown.inline, esc = CourseMarkdown.esc, lv = LEVELS[d.level];
    let body = '';
    if (d.level === 'read') {
      body = '<ol class="dr-script">' + (d.lines || []).map(l => {
        const you = (l.who || 'you') === 'you';
        return '<li class="' + (you ? 'you' : 'them') + '"><span class="dr-who">' + (you ? 'You' : 'Seller') + '</span><p>' + md(l.say || '') + '</p></li>';
      }).join('') + '</ol>';
    } else if (d.level === 'respond') {
      const ps = d.pairs || [];
      body = '<div class="dr-step" data-n="' + ps.length + '">' +
        '<p class="dr-count" aria-live="polite">Line <span data-dr="pos">1</span> of ' + ps.length + '</p>' +
        ps.map((p, k) => '<div class="dr-pair" data-k="' + k + '"' + (k ? ' hidden' : '') + '>' +
          '<p class="dr-them"><span class="dr-who">Seller</span>' + md(p.them || '') + '</p>' +
          '<button class="link-btn" type="button" data-pr="ans" aria-expanded="false" aria-controls="drA' + i + '_' + k + '">Show the model answer</button>' +
          '<div class="dr-ans" id="drA' + i + '_' + k + '" hidden><p><span class="dr-who">You</span>' + md(p.you || '') + '</p>' + (p.why ? '<p class="note">' + md(p.why) + '</p>' : '') + '</div>' +
        '</div>').join('') +
        '<div class="pr-row"><button class="btn line" type="button" data-pr="prev" disabled>Back</button><button class="btn dark" type="button" data-pr="next"' + (ps.length < 2 ? ' disabled' : '') + '>Next line</button><button class="btn line" type="button" data-pr="mix"' + (ps.length < 3 ? ' hidden' : '') + '>Mix the order</button></div>' +
      '</div>';
    } else {
      const b = d.brief || {}, li = a => '<ul>' + (a || []).map(x => '<li>' + md(x) + '</li>').join('') + '</ul>';
      body = '<div class="dr-brief">' +
        (b.who ? '<p><b>Who you’re calling:</b> ' + md(b.who) + '</p>' : '') +
        ((b.know || []).length ? '<p><b>What you know before you dial:</b></p>' + li(b.know) : '') +
        (b.goal ? '<p><b>Your goal on this call:</b> ' + md(b.goal) + '</p>' : '') +
        ((b.hidden || []).length ? '<details class="dr-secret"><summary>For the person playing the seller (the caller doesn’t read this)</summary>' + li(b.hidden) + '</details>' : '') +
      '</div>';
    }
    return '<div class="drill" data-i="' + i + '"' + (i ? ' hidden' : '') + '>' +
      '<p class="dr-level"><span class="chip">' + lv[0] + '</span> <b>' + lv[1] + '</b>' + (n > 1 ? ' · Drill ' + (i + 1) + ' of ' + n : '') + '</p>' +
      '<h3 class="sub">' + esc(d.title || lv[1]) + '</h3>' +
      '<p class="note">' + md(d.intro || HOW[d.level]) + '</p>' + body +
    '</div>';
  }

  function html(lessonTitle, prompt, drills){
    return '<section class="practice" aria-labelledby="prH">' +
      '<div class="pr-top"><span class="label o">Practice out loud</span><h2 class="sub" id="prH">Record yourself and send it to Amr</h2>' +
      '<p class="note">' + (prompt ? CourseMarkdown.inline(prompt) : drills.length ? 'Pick a drill, press record and say it out loud. The words stay on screen while you record. Amr listens, scores it and leaves comments at the exact moments that matter.' : 'Say this lesson’s lines out loud, or run a short role-play with a colleague or with Claude playing the seller. Amr listens, scores it and leaves comments at the exact moments that matter.') + '</p></div>' +
      (drills.length > 1 ? '<div class="dr-pick" role="group" aria-label="Choose a drill">' + drills.map((d, i) => '<button type="button" class="dr-tab" data-pr="pick" data-i="' + i + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + (i + 1) + '. ' + CourseMarkdown.esc(d.title || LEVELS[d.level][1]) + '</button>').join('') + '</div>' : '') +
      (drills.length ? '<div class="drills">' + drills.map((d, i) => drillHtml(d, i, drills.length)).join('') + '</div>' : '') +
      '<div class="pr-rec" id="prRec">' +
        '<div class="pr-row"><button class="btn orange" type="button" data-pr="start" id="prStart">Start recording</button>' +
          '<label class="btn line pr-file"><input type="file" class="vh" id="prFile" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg">Upload a recording</label></div>' +
        '<div class="pr-live" id="prLive" hidden><span class="pr-dot" aria-hidden="true"></span><span id="prClock" aria-live="off">0:00</span><button class="btn dark" type="button" data-pr="stop">Stop</button></div>' +
        '<div class="pr-review" id="prReview" hidden>' +
          '<audio controls id="prPreview"></audio>' +
          '<label class="field-lbl" for="prTitle">Title</label><input type="text" id="prTitle" maxlength="200" value="">' +
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
    const drills = drillsOf(it.practice);
    root.innerHTML = html(o.title, it.practice && it.practice.prompt, drills);
    let cur = 0; // the drill on screen
    const titleFor = () => {
      const d = drills[cur];
      return d ? (LEVELS[d.level][1] + ': ' + (d.title || o.title)).slice(0, 200) : 'Practice: ' + o.title;
    };
    const showPair = (box, k) => {
      const n = +box.dataset.n; k = Math.max(0, Math.min(n - 1, k));
      box.querySelectorAll('.dr-pair').forEach(p => { p.hidden = +p.dataset.k !== k; });
      box.dataset.at = k;
      box.querySelector('[data-dr="pos"]').textContent = k + 1;
      box.querySelector('[data-pr="prev"]').disabled = k === 0;
      box.querySelector('[data-pr="next"]').disabled = k >= n - 1;
    };
    const lockPick = on => root.querySelectorAll('.dr-tab').forEach(t => { t.disabled = on; });
    let rec = null, chunks = [], stream = null, started = 0, tick = null, blob = null, mime = '', fileName = '', dur = null;

    const stopMic = s => { if (s) s.getTracks().forEach(t => t.stop()); };
    const reset = () => {
      if (tick) clearInterval(tick); tick = null;
      if (rec) { rec.onstop = rec.ondataavailable = null; try { if (rec.state !== 'inactive') rec.stop(); } catch(err){} }
      stopMic(stream); stream = null;
      rec = null; chunks = []; blob = null; dur = null;
      $('prLive').hidden = true; $('prReview').hidden = true; $('prStart').hidden = false; root.querySelector('.pr-file').hidden = false; lockPick(false);
      const p = $('prPreview'); if (p.src) { URL.revokeObjectURL(p.src); p.removeAttribute('src'); }
      $('prErr').textContent = ''; $('prReal').checked = false; $('prConsent').checked = false; $('prConsentRow').hidden = true; $('prNote').value = '';
    };
    const ready = (b, m, name, seconds) => {
      blob = b; mime = (m || b.type || 'audio/webm').split(';')[0]; fileName = name; dur = seconds;
      $('prLive').hidden = true; $('prStart').hidden = true; root.querySelector('.pr-file').hidden = true; $('prReview').hidden = false;
      $('prPreview').src = URL.createObjectURL(b); $('prTitle').value = titleFor(); lockPick(true);
      $('prMsg').textContent = seconds ? 'Recorded ' + clock(seconds) + '. Listen back, then send it.' : 'Listen back, then send it.';
    };

    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-pr]'); if (!b) return;
      const act = b.dataset.pr;
      if (act === 'pick') {
        if (b.disabled) return;
        cur = +b.dataset.i;
        root.querySelectorAll('.dr-tab').forEach(t => t.setAttribute('aria-pressed', String(t === b)));
        root.querySelectorAll('.drill').forEach(d => { d.hidden = +d.dataset.i !== cur; });
        return;
      }
      if (act === 'ans') {
        const a = root.querySelector('#' + CSS.escape(b.getAttribute('aria-controls')));
        const open = b.getAttribute('aria-expanded') !== 'true';
        a.hidden = !open; b.setAttribute('aria-expanded', String(open));
        b.textContent = open ? 'Hide the model answer' : 'Show the model answer';
        return;
      }
      if (act === 'prev' || act === 'next') {
        const box = b.closest('.dr-step');
        showPair(box, +(box.dataset.at || 0) + (act === 'next' ? 1 : -1));
        if (b.disabled) box.querySelector('[data-pr="' + (act === 'next' ? 'prev' : 'next') + '"]').focus(); // keep focus on a live button at either end
        return;
      }
      if (act === 'mix') {
        const box = b.closest('.dr-step'), ps = [...box.querySelectorAll('.dr-pair')];
        for (let k = ps.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [ps[k], ps[j]] = [ps[j], ps[k]]; }
        const anchor = box.querySelector('.pr-row');
        ps.forEach((p, k) => {
          p.dataset.k = k; box.insertBefore(p, anchor);
          const btn = p.querySelector('[data-pr="ans"]'); btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'Show the model answer';
          p.querySelector('.dr-ans').hidden = true;
        });
        showPair(box, 0);
        if (o.toast) o.toast('Order mixed');
        return;
      }
      if (act === 'start') {
        if (b.disabled || rec) return;
        const m = pickMime();
        if (m === null || !navigator.mediaDevices) { $('prMsg').textContent = 'This browser can’t record. Use “Upload a recording” instead, or try Chrome or Safari.'; return; }
        b.disabled = true; // one tap only while the browser asks for the microphone
        let s;
        try { s = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true } }); }
        catch(err){ b.disabled = false; $('prMsg').textContent = 'The microphone is blocked. Allow it in your browser’s site settings, then try again.'; return; }
        if (!root.isConnected) { stopMic(s); return; } // they left the lesson while the browser was asking
        let r;
        try { r = new MediaRecorder(s, m ? { mimeType:m, audioBitsPerSecond:48000 } : undefined); }
        catch(err){ stopMic(s); b.disabled = false; $('prMsg').textContent = 'Recording didn’t start on this browser. Use “Upload a recording” instead.'; return; }
        stream = s; rec = r; chunks = [];
        const mine0 = chunks;
        r.ondataavailable = ev => { if (ev.data && ev.data.size) mine0.push(ev.data); };
        r.onstop = () => {
          const secs = Math.round((Date.now() - started) / 1000);
          const type = r.mimeType || m || 'audio/webm';
          stopMic(s); if (stream === s) stream = null;
          if (rec === r) rec = null;
          ready(new Blob(mine0, { type }), type, 'recording.' + extOf(type), secs);
        };
        try { r.start(1000); } catch(err){ stopMic(s); stream = null; rec = null; b.disabled = false; $('prMsg').textContent = 'Recording didn’t start. Try again, or upload a recording.'; return; }
        started = Date.now(); b.disabled = false;
        $('prStart').hidden = true; root.querySelector('.pr-file').hidden = true; $('prLive').hidden = false; $('prMsg').textContent = 'Recording…'; lockPick(true);
        tick = setInterval(() => { const t = (Date.now() - started) / 1000; $('prClock').textContent = clock(t); if (t >= MAX_S && rec && rec.state !== 'inactive') { clearInterval(tick); rec.stop(); } }, 500);
      }
      if (act === 'stop' && rec && rec.state !== 'inactive') { clearInterval(tick); rec.stop(); }
      if (act === 'discard') { reset(); $('prMsg').textContent = ''; }
      if (act === 'send') {
        if (!blob) return;
        const real = $('prReal').checked, consent = $('prConsent').checked;
        if (real && !consent) { $('prErr').textContent = 'For a real call, confirm that everyone agreed to be recorded.'; $('prConsent').focus(); return; }
        if (blob.size > MAX_B) { $('prErr').textContent = 'That recording is over 50 MB. Keep it under about 30 minutes.'; return; }
        if (b.disabled) return;
        b.disabled = true; b.setAttribute('aria-busy', 'true'); $('prErr').textContent = ''; $('prMsg').textContent = 'Sending…';
        const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-60);
        const path = user.id + '/acq/' + Date.now() + '-' + safe;
        const up = await db.storage.from('hub-uploads').upload(path, blob, { contentType:mime, upsert:false });
        if (up.error) { b.disabled = false; b.removeAttribute('aria-busy'); $('prMsg').textContent = ''; $('prErr').textContent = /mime|type/i.test(up.error.message || '') ? 'That kind of file isn’t allowed. Send an audio file (m4a, mp3, wav, webm).' : /size|large/i.test(up.error.message || '') ? 'That recording is too large.' : 'It didn’t send. Check your connection and try again.'; return; }
        const row = { course:'acq', module:mod.id, item:it.id, title:($('prTitle').value || '').trim().slice(0, 200) || 'Practice', kind:'recording', path, file_name:fileName.slice(0, 200), mime, size_bytes:blob.size, duration_s:dur, note:($('prNote').value || '').trim().slice(0, 2000) || null, real_call:real, consent:real && consent };
        const ins = await db.from('hub_uploads').insert(row);
        b.disabled = false; b.removeAttribute('aria-busy');
        if (ins.error) { await db.storage.from('hub-uploads').remove([path]); $('prMsg').textContent = ''; $('prErr').textContent = /hub_uploads/.test(ins.error.message || '') ? 'Recordings aren’t switched on yet. Ask Amr.' : 'It didn’t send. Try again.'; return; }
        reset(); $('prMsg').textContent = ''; if (o.toast) o.toast('Sent to Amr');
        mine();
      }
      if (act === 'del') {
        const id = b.dataset.id, p = b.dataset.path;
        if (b.disabled) return;
        b.disabled = true; b.setAttribute('aria-busy', 'true');
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
