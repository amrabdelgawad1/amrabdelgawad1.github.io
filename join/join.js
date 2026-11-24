// "Join the team" page at /join/. Anyone can fill it in.
// Round 34 (Nov 24 2026): open jobs come from job_posts (Amr edits them in /app > People and access > Job posts), the form
// says which job, and applicants can record a short voice test right here. The recording goes to a private bucket
// (voice-tests) with a one-time ticket from voice_test_ticket() (spam-guarded); only Amr can listen to it. The form calls
// apply_for_job(), which checks the fields, stops spam and saves one row. Amr sees it on the Applicant board (/app/#hiring).
// apply_to_team() still works for pages cached before this change.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const startedAt = new Date().toISOString();
  const cfg = window.TRACKER_CONFIG || {};
  const db = window.supabase && cfg.supabaseUrl ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth:{ persistSession:false } }) : null;
  const say = t => { $('jMsg').textContent = t; $('jMsg').hidden = !t; };
  const fail = (id, t) => { say(t); const el = $(id); if (el) el.focus(); };
  // ?ref=Name in a rep's share link fills "Did someone on the team send you?"
  try { const r = new URLSearchParams(location.search).get('ref'); if (r) $('jRef').value = r.slice(0, 80); } catch(e) {}

  // ---------- open jobs ----------
  let posts = [];
  const post = () => posts.find(p => String(p.id) === $('jPost').value) || null;
  const lines = s => String(s || '').split('\n').map(l => l.trim()).filter(Boolean);
  function drawJobs(){
    const box = $('jJobs');
    if (!posts.length) {
      box.innerHTML = '<p class="fine">No open jobs right now. You can still send your details below and I will keep them for the next opening.</p>';
      $('jPostBox').hidden = true; showScript(); return;
    }
    box.innerHTML = posts.map(p => '<article class="job" id="job-' + esc(p.slug) + '"><h3>' + esc(p.title) + '</h3>' +
      '<p class="job-meta">' + esc([p.kind, p.place].filter(Boolean).join(' · ')) + '</p>' +
      (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') +
      '<ul class="job-facts">' + (p.pay ? '<li><b>Pay</b>' + esc(p.pay) + '</li>' : '') + (p.hours ? '<li><b>Hours</b>' + esc(p.hours) + '</li>' : '') + '</ul>' +
      ((p.body || p.needs) ? '<details><summary>What the job is and what you need</summary>' +
        (lines(p.body).length ? '<ul>' + lines(p.body).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') +
        (lines(p.needs).length ? '<p class="job-need">You need</p><ul>' + lines(p.needs).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') + '</details>' : '') +
      '<p><button type="button" class="btn btn-sm" data-apply="' + p.id + '">Apply for this job</button></p></article>').join('');
    $('jPost').innerHTML = posts.map(p => '<option value="' + p.id + '">' + esc(p.title) + '</option>').join('');
    $('jPostBox').hidden = false;
    const want = (location.hash || '').replace(/^#/, '') || new URLSearchParams(location.search).get('job') || '';
    const hit = posts.find(p => p.slug === want);
    if (hit) { $('jPost').value = String(hit.id); const a = $('job-' + hit.slug); if (a) a.scrollIntoView({ block:'start' }); }
    showScript();
  }
  function showScript(){
    const p = post();
    $('jScript').textContent = (p && p.voice_script) || 'Hi, this is Sara calling about the land you own on County Road 12. I’m not trying to sell you anything. I work with a small team that buys land for cash, and I wanted to ask if you would ever consider an offer on it. If now isn’t a good time, I’m happy to call back whenever suits you. Thank you for your time.';
    $('jVoiceNeed').textContent = p && p.voice_required ? '(needed for this job)' : '(about 30 seconds, it helps a lot)';
  }
  $('jJobs').addEventListener('click', e => {
    const b = e.target.closest('[data-apply]'); if (!b) return;
    $('jPost').value = b.dataset.apply; showScript();
    $('jForm').scrollIntoView({ behavior:'smooth', block:'start' }); setTimeout(() => $('jName').focus({ preventScroll:true }), 400);
  });
  $('jPost').addEventListener('change', showScript);
  (async () => {
    if (!db) { drawJobs(); return; }
    const r = await db.from('job_posts').select('id,slug,title,kind,pay,hours,place,summary,body,needs,voice_script,voice_required').eq('open', true).order('sort').order('id');
    posts = r.error ? [] : (r.data || []);
    drawJobs();
  })();

  // ---------- voice test, recorded in the browser ----------
  const V = { rec:null, stream:null, chunks:[], blob:null, mime:'', secs:0, t0:0, timer:0, url:'' };
  const MAX = 90;
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const vsay = t => { $('jVMsg').textContent = t; };
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  if (!canRecord) { $('jRecRow').hidden = true; vsay('This browser can’t record here. Paste a link to a voice note below instead, or open this page in Chrome or Safari.'); }
  function pickMime(){
    const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch(e) { return false; } }) || '';
  }
  function tick(){ V.secs = (Date.now() - V.t0) / 1000; $('jTimer').textContent = fmt(V.secs) + ' / ' + fmt(MAX); if (V.secs >= MAX) stop(); }
  async function start(){
    vsay('');
    try { V.stream = await navigator.mediaDevices.getUserMedia({ audio:true }); }
    catch(e) { vsay('The microphone is blocked. Allow it in your browser’s address bar and press Record again, or paste a link below.'); return; }
    V.mime = pickMime(); V.chunks = [];
    try { V.rec = V.mime ? new MediaRecorder(V.stream, { mimeType:V.mime }) : new MediaRecorder(V.stream); } catch(e) { V.rec = new MediaRecorder(V.stream); }
    V.rec.ondataavailable = e => { if (e.data && e.data.size) V.chunks.push(e.data); };
    V.rec.onstop = done;
    V.rec.start(1000); V.t0 = Date.now(); V.timer = setInterval(tick, 250); tick();
    $('jRec').hidden = true; $('jStop').hidden = false; $('jRedo').hidden = true; $('jPlay').hidden = true;
    $('jRecRow').classList.add('is-on'); $('jStop').focus();
  }
  function stop(){ if (V.rec && V.rec.state !== 'inactive') V.rec.stop(); clearInterval(V.timer); }
  function done(){
    if (V.stream) V.stream.getTracks().forEach(t => t.stop());
    $('jRecRow').classList.remove('is-on');
    const type = (V.rec && V.rec.mimeType) || V.mime || 'audio/webm';
    V.blob = new Blob(V.chunks, { type:type.split(';')[0] });
    if (V.url) URL.revokeObjectURL(V.url);
    V.url = URL.createObjectURL(V.blob);
    $('jPlay').src = V.url; $('jPlay').hidden = false;
    $('jStop').hidden = true; $('jRec').hidden = true; $('jRedo').hidden = false;
    if (V.secs < 5) { vsay('That was very short. Press Record again and read the whole text.'); V.blob = null; $('jRedo').hidden = true; $('jRec').hidden = false; $('jPlay').hidden = true; return; }
    vsay('Recorded ' + fmt(V.secs) + '. Play it back if you like. It is sent with your application.');
  }
  function redo(){ V.blob = null; V.secs = 0; $('jPlay').hidden = true; $('jPlay').removeAttribute('src'); $('jTimer').textContent = '0:00 / ' + fmt(MAX); start(); }
  $('jRec').addEventListener('click', start);
  $('jStop').addEventListener('click', stop);
  $('jRedo').addEventListener('click', redo);

  async function uploadVoice(){
    if (!V.blob) return { path:null };
    const t = await db.rpc('voice_test_ticket', { p_website:$('jWebsite').value, p_started_at:startedAt });
    if (t.error) return { error:t.error.code === 'P0001' ? t.error.message : 'The voice test couldn’t be sent. Try again, or send the form without it.' };
    const base = V.blob.type || 'audio/webm', ext = /mp4/.test(base) ? 'mp4' : /ogg/.test(base) ? 'ogg' : /mpeg/.test(base) ? 'mp3' : /wav/.test(base) ? 'wav' : 'webm';
    const path = 't/' + t.data + '.' + ext;
    const up = await db.storage.from('voice-tests').upload(path, V.blob, { contentType:base, upsert:false });
    if (up.error) return { error:'The voice test couldn’t upload (' + (up.error.message || 'network') + '). Try again, or press Record again.' };
    return { path, secs:Math.round(V.secs) };
  }

  // ---------- send ----------
  $('jForm').addEventListener('submit', async e => {
    e.preventDefault(); say('');
    const v = id => $(id).value.trim();
    const p = post();
    if (v('jName').length < 2) return fail('jName', 'Please add your full name.');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('jEmail'))) return fail('jEmail', 'Please check your email.');
    if (!v('jPhone')) return fail('jPhone', 'Please add a phone or WhatsApp number so I can reach you.');
    if (!$('jEnglish').value) return fail('jEnglish', 'Please pick your spoken English level.');
    if (v('jSample') && !/^https:\/\//i.test(v('jSample'))) return fail('jSample', 'The voice note link should start with https://');
    if (V.rec && V.rec.state === 'recording') return fail('jStop', 'Press Stop to finish your voice test first.');
    if (p && p.voice_required && !V.blob) return fail(canRecord ? 'jRec' : 'jSample', 'This job needs the short voice test. Press Record and read the text.');
    if (!db) return say('The form couldn’t load. Please refresh the page or email me instead.');
    $('jGo').disabled = true; $('jGo').textContent = V.blob ? 'Sending your voice test…' : 'Sending…';
    const voice = await uploadVoice();
    if (voice.error) { $('jGo').disabled = false; $('jGo').textContent = 'Send my application'; return say(voice.error); }
    $('jGo').textContent = 'Sending…';
    const { data, error } = await db.rpc('apply_for_job', {
      p_post:p ? p.id : null, p_name:v('jName'), p_email:v('jEmail'), p_phone:v('jPhone'), p_country:v('jCountry'), p_city:v('jCity'), p_english:$('jEnglish').value,
      p_experience:v('jExp'), p_hours:$('jHours').value, p_start:$('jStart').value, p_why:v('jWhy'), p_referred_by:v('jRef'), p_sample:v('jSample'),
      p_voice:voice.path, p_voice_seconds:voice.secs || null, p_website:$('jWebsite').value, p_started_at:startedAt
    });
    $('jGo').disabled = false; $('jGo').textContent = 'Send my application';
    if (error) return say(error.code === 'P0001' ? error.message : 'Something went wrong sending this. Please try again in a minute.');
    if (window.countEvent) window.countEvent('apply-team', 'Applied to join the team');
    $('jForm').hidden = true; $('jDone').hidden = false;
    if (data === 'already') $('jDone').querySelector('p').textContent = 'You already applied recently, thank you. I read every application myself and reply within a few days.';
    $('jDone').focus();
  });
})();
