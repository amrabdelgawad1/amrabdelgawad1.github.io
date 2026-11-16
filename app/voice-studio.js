// Amr Voice Studio (Amr only, #voice): narration in Amr's cloned voice, made on his own PC instead of ElevenLabs.
// Screens, in the studio's own menu:  #voice (Text to Speech)  #voice/projects (the course batch)
//   #voice/voices (voices, moods, blind test)  #voice/history (every narration)  #voice/pron (pronunciations)
//   #voice/computer ("Can my computer run it?": a quick check in the browser, and the PC's measured speed)
// The page only adds jobs to voice_jobs; the worker on yukis-pc (start-worker.bat) picks them up in the order they
// were added (your own scripts and one-line retakes first, then course lessons by module priority), narrates them and uploads the audio to the private "voice" bucket. Lesson jobs also save
// content/<module>/narration/<lesson>.* in the course bucket; new lesson videos are staged in content/<module>/videos/_new/.
// Database: voice_jobs, voice_pronunciations, voice_worker, voice_ab_votes, bucket "voice" (owner only through is_tracker_admin()).
// Looks: voice-studio.css, from the approved mockup "Amr Voice Studio".
(function(){
  'use strict';
  const PX = window.PX, V = window.PortalViews;
  if (!PX || !V) return;
  const { T, $, esc, safe, fmtDay, fmtTime, empty, failed, f, opt, bar, widths, say, errText } = PX;
  const db = () => T().db;
  const MOOD_NAMES = { teaching:'Teaching', warm:'Warm', serious:'Serious', energetic:'Energetic', teaching_ar:'Arabic teaching' };
  const MOOD_NOTES = { teaching:'Clear and steady, the default for lessons', warm:'Softer, for stories and encouragement', serious:'Slower, for warnings and legal points',
    energetic:'Brighter, for openings and wins', teaching_ar:'For the Arabic sections, in فصحى' };
  const STATUS = { queued:['Waiting', ''], running:['Making it', 'warn'], done:['Ready', 'ok'], failed:['Failed', 'bad'], cancelled:['Cancelled', ''] };
  const TABS = [
    ['tts', 'Text to Speech', '<path d="M4 6h16M4 12h10M4 18h7"/>'],
    ['projects', 'Projects', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>'],
    ['voices', 'Voices', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'],
    ['history', 'History', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
    ['pron', 'Pronunciations', '<path d="M4 12h4l2-6 4 12 2-6h4"/>'],
    ['computer', 'Your computer', '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>']];
  const JOB_COLS = 'id,title,status,progress,message,language,mood,target,settings,duration_s,needs_review,output_mp3,output_wav,output_json,parent_id,redo_piece,created_at,claimed_at,finished_at';
  const SLIDER_VERSION = [0, 4];   // the worker reads the sliders from version 0.4
  const tune = { pace:50, feel:50, pause:50 };   // Text to Speech sliders, kept while you move between screens
  let timer = null;

  const isAB = j => j.target && j.target.mode === 'ab';
  const isLesson = j => j.target && j.target.mode === 'lesson';
  const icon = (d, size) => '<svg class="vs-i" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>';
  const chip = (t, kind) => '<span class="vs-chip' + (kind ? ' is-' + kind : '') + '">' + esc(t) + '</span>';
  const box = (title, body, cls) => '<section class="vs-card' + (cls ? ' ' + cls : '') + '">' + (title ? '<h2 class="vs-cap">' + esc(title) + '</h2>' : '') + body + '</section>';
  const head = (title, sub, right) => '<div class="vs-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (right ? '<div class="vs-tools">' + right + '</div>' : '') + '</div>';
  // Which side is "A" in a blind-test pair: fixed per job and pair, so a reload doesn't reshuffle
  const oursIsA = (id, i) => { let h = i * 31; for (const c of id) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h % 2 === 0; };

  const signedUrl = async (path, download, bucket) => {
    if (!path) return null;
    const r = await safe(db().storage.from(bucket || 'voice').createSignedUrl(path, 3600, download ? { download } : undefined));
    return r.data && r.data.signedUrl;
  };
  const ago = d => { const s = (Date.now() - new Date(d)) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : fmtDay(d) + ' ' + fmtTime(d); };
  const mmss = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const hours = s => !s ? '0 min' : s < 3600 ? Math.max(1, Math.round(s / 60)) + ' min' : (s < 36000 ? Math.round(s / 360) / 10 : Math.round(s / 3600)) + ' h';
  const fileName = (t, ext) => (String(t || 'narration').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'narration') + '.' + ext;
  const took = j => j.claimed_at && j.finished_at ? (new Date(j.finished_at) - new Date(j.claimed_at)) / 1000 : 0;
  // "Lesson 1.1 1.1 What Acquisitions Is" -> "1.1 What Acquisitions Is"
  const lessonTitle = j => String(j.title || '').replace(/^Lesson\s+/, '').replace(/^(\S+)\s+\1\s+/, '$1 ');
  const lessonKey = j => String((j.target && j.target.lesson) || '').split('.').map(n => +n || 0);
  const byLesson = (a, b) => { const x = lessonKey(a), y = lessonKey(b); return (x[0] - y[0]) || ((x[1] || 0) - (y[1] || 0)); };

  // ───── How long the course queue will take ─────
  // done:    finished lesson jobs, each { audio: seconds of audio made, work: seconds the PC spent }
  // waiting: how many lesson jobs are still queued
  // running: the job being narrated now ({ progress: 0..1 }) or null
  // Returns the seconds of PC time left, or null when there's nothing to go on yet.
  // Uses the middle value (median), not the average: one bad run (lesson 1.4 took 2 hours while other apps filled the
  // graphics memory) would drag an average far off, but barely moves the median.
  const median = a => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : null; };
  const workRatio = done => median(done.filter(d => d.audio > 30 && d.work > 0).map(d => d.work / d.audio));
  function queueEta(done, waiting, running){
    const ratio = workRatio(done), audio = median(done.map(d => d.audio));
    if (!ratio || !audio) return null;
    const perLesson = ratio * audio;
    return Math.round(waiting * perLesson + (running ? (1 - Math.min(1, running.progress || 0)) * perLesson : 0));
  }

  // Everything the screens share: worker state, lesson jobs, other jobs
  async function load(){
    const [w, lessons, others] = await Promise.all([
      safe(db().from('voice_worker').select('*').eq('id', 'main').maybeSingle()),
      safe(db().from('voice_jobs').select('id,title,status,progress,message,target,priority,parent_id,duration_s,needs_review,output_mp3,output_wav,output_json,created_at,claimed_at,finished_at').eq('target->>mode', 'lesson').order('created_at').limit(2000)),
      safe(db().from('voice_jobs').select(JOB_COLS).or('target.is.null,target->>mode.is.null,target->>mode.neq.lesson').order('created_at', { ascending:false }).limit(60))]);
    const wk = w.data, online = !!(wk && (Date.now() - new Date(wk.last_seen)) < 70000);
    // the newest job per lesson is the one that counts (a redo replaces the first)
    // one row per lesson: the newest finished narration, plus a newer retake that's waiting, running or failed
    const latest = {};
    (lessons.data || []).forEach(j => {
      const k = j.target.module + '/' + j.target.lesson, row = latest[k] || (latest[k] = { job:null, extra:null });
      if (j.status === 'done') { row.job = j; row.extra = null; } else if (j.status !== 'cancelled' || !row.job) row.extra = j;
    });
    const lessonList = Object.values(latest).map(r => {
      const j = r.job || r.extra; if (!j) return null;
      return Object.assign({}, j, { retake:r.job && r.extra ? r.extra : null });
    }).filter(Boolean).sort(byLesson);
    const waiting = (lessons.data || []).filter(j => j.status === 'queued');
    const running = (lessons.data || []).find(j => j.status === 'running') || (others.data || []).find(j => j.status === 'running') || null;
    const done = lessonList.filter(j => j.status === 'done' && j.duration_s && took(j)).map(j => ({ audio:j.duration_s, work:took(j) }));
    let eta = null; try { eta = queueEta(done, waiting.length, running); } catch(e) { eta = null; }
    return { ratio:workRatio(done), wk, online, error:lessons.error || others.error, lessons:lessonList, waitingLessons:waiting, others:others.data || [], running, eta };
  }

  function railStatus(S){
    const wk = S.wk;
    const gpu = wk && wk.gpu ? (wk.gpu === 'loading' ? 'starting up' : String(wk.gpu).replace(/^NVIDIA GeForce /, '').replace(/\s*\(.*\)$/, '')) : '';
    const line2 = S.waitingLessons.length ? S.waitingLessons.length + ' lesson' + (S.waitingLessons.length === 1 ? '' : 's') + ' in queue' : (wk && wk.busy_job ? 'working' : 'queue empty');
    return '<div class="vs-wk"><div class="vs-wk-top"><span class="vs-dot' + (S.online ? ' is-on' : '') + '"></span>' + (S.online ? 'yukis-pc online' : 'yukis-pc offline') + '</div>' +
      '<div>' + esc(S.online ? (gpu ? gpu + ' · ' : '') + line2 : wk ? 'last seen ' + ago(wk.last_seen) : 'never connected') + '</div>' +
      (S.online && S.eta ? '<div>About ' + esc(hours(S.eta)) + ' left</div>' : '') +
      (S.online ? '' : '<div>Start <b>start-worker.bat</b> on the PC</div>') + '</div>';
  }

  function shell(tab){
    return '<div class="vs-app"><nav class="vs-rail" aria-label="Voice Studio">' +
      '<div class="vs-brand"><span class="vs-logo">' + icon('<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>') + '</span><span><b>Amr Voice Studio</b><small>Your voice, your PC</small></span></div>' +
      TABS.map(t => '<a class="vs-nav' + (t[0] === tab ? ' is-on' : '') + '" href="#voice' + (t[0] === 'tts' ? '' : '/' + t[0]) + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + icon(t[2]) + t[1] + '</a>').join('') +
      '<div id="vsWk" class="vs-wkbox" role="status"></div></nav><main class="vs-main" id="vsMain"><p class="p-loading">Loading…</p></main></div>';
  }

  // One audio player shared by every Play button on a screen
  // Each Play makes a fresh player where it was asked for, and closes the one before (and its opened row if that was all it held)
  async function play(main, path, bucket, near){
    const u = await signedUrl(path, null, bucket); if (!u) return;
    main.querySelectorAll('audio.vs-live').forEach(old => {
      old.pause(); const holder = old.closest('.vs-expand, .vs-jobmore'); old.remove();
      if (holder && holder !== (near && near.closest('.vs-expand, .vs-jobmore')) && !holder.querySelector('.vs-piece, .vs-ab')) holder.hidden = true;
    });
    const a = document.createElement('audio'); a.className = 'vs-live'; a.controls = true; a.src = u;
    (near || main).appendChild(a); a.play().catch(() => {});
  }

  // The blind test: each pair plays the same words twice, once ElevenLabs and once your clone, in a fixed random order.
  async function abTest(j, el){
    const u = await signedUrl(j.output_json); const man = u && await fetch(u).then(x => x.json()).catch(() => null);
    if (!man) { el.innerHTML = empty('Couldn’t load the test.'); return; }
    const votes = {}; const v = await safe(db().from('voice_ab_votes').select('pair,picked').eq('job_id', j.id));
    (v.data || []).forEach(x => votes[x.pair] = x.picked);
    const folder = j.output_json.replace(/pairs\.json$/, '');
    const score = () => {
      const all = Object.values(votes), n = all.length;
      if (!n) return 'Listen to each pair and pick the one that sounds better. Pick “Same” if you can’t tell.';
      const ours = all.filter(x => x === 'ours').length, same = all.filter(x => x === 'same').length, el2 = n - ours - same;
      const pct = Math.round((ours + same) / n * 100);
      return n + ' of ' + man.pairs.length + ' voted · yours better ' + ours + ' · same ' + same + ' · ElevenLabs better ' + el2 +
        ' · yours equal or better: ' + pct + '%' + (n === man.pairs.length ? (pct >= 50 ? ' · goal reached' : ' · goal is 50% or more') : '');
    };
    el.innerHTML = '<div class="vs-ab"><p class="vs-note" id="abScore">' + esc(score()) + '</p>' + man.pairs.map(p => {
      const a = oursIsA(j.id, p.i);
      return '<div class="vs-abpair" data-pair="' + (+p.i) + '"><small>Pair ' + (+p.i + 1) + '</small>' +
        '<div class="vs-abrow">A <audio controls preload="none" data-src="' + esc(folder + 'p' + p.i + '_' + (a ? 'o' : 'e') + p.ext) + '"></audio></div>' +
        '<div class="vs-abrow">B <audio controls preload="none" data-src="' + esc(folder + 'p' + p.i + '_' + (a ? 'e' : 'o') + p.ext) + '"></audio></div>' +
        '<div class="vs-btns"><button class="vs-btn" type="button" data-v="A">A better</button><button class="vs-btn" type="button" data-v="same">Same</button><button class="vs-btn" type="button" data-v="B">B better</button></div>' +
        '<small class="ab-reveal">' + (votes[p.i] ? 'A was ' + (a ? 'yours' : 'ElevenLabs') + ' · “' + esc(p.text) + '”' : '') + '</small></div>';
    }).join('') + '</div>';
    el.querySelectorAll('audio[data-src]').forEach(async au => { const s2 = await signedUrl(au.dataset.src); if (s2) au.src = s2; });
    el.querySelectorAll('[data-pair]').forEach(row => row.addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-v]'); if (!b) return;
      const i = +row.dataset.pair, a = oursIsA(j.id, i), p = man.pairs.find(x => x.i === i);
      const picked = b.dataset.v === 'same' ? 'same' : ((b.dataset.v === 'A') === a ? 'ours' : 'elevenlabs');
      const r = await safe(db().from('voice_ab_votes').upsert({ job_id:j.id, pair:i, picked }, { onConflict:'job_id,pair' }));
      if (r.error) { b.textContent = 'Couldn’t save'; return; }
      votes[i] = picked;
      row.querySelector('.ab-reveal').textContent = 'A was ' + (a ? 'yours' : 'ElevenLabs') + ' · “' + p.text + '”';
      el.querySelector('#abScore').textContent = score();
    }));
  }

  // The pieces of a narration, each with Redo (a redo builds on this exact version and reuses every other piece)
  async function pieces(j, el, reopen){
    const u = await signedUrl(j.output_json); const m = u && await fetch(u).then(x => x.json()).catch(() => null);
    if (!m || !m.pieces) { el.innerHTML = empty('Couldn’t load the pieces.'); return; }
    el.innerHTML = m.pieces.map(p => '<div class="vs-piece' + (p.ok ? '' : ' is-check') + '"><span><small>#' + (+p.i) + ' · ' + mmss(p.start) + ' · ' + esc(MOOD_NAMES[p.mood] || p.mood) + (p.language === 'ar' ? ' · Arabic' : '') +
      (p.ok ? '' : ' · ' + esc(p.reason || 'check this one')) + '</small>' + esc(p.text) + '</span>' +
      '<button class="vs-btn" type="button" data-redo="' + (+p.i) + '" aria-label="Retake line ' + (+p.i) + '">Retake</button></div>').join('');
    el.querySelectorAll('[data-redo]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      const full = await safe(db().from('voice_jobs').select('text,language,mood,settings').eq('id', j.id).single());
      if (!full.data) { b.textContent = 'Try again'; b.disabled = false; return; }
      const r = await safe(db().from('voice_jobs').insert({ title:j.title.replace(/ \(piece \d+ redone\)$/, '') + ' (piece ' + b.dataset.redo + ' redone)',
        text:full.data.text, language:full.data.language, mood:full.data.mood, settings:full.data.settings || null, parent_id:j.id, redo_piece:+b.dataset.redo, target:isLesson(j) ? j.target : null }));
      if (r.error) { b.textContent = 'Try again'; b.disabled = false; return; }
      b.textContent = 'Queued'; reopen();
    }));
  }

  // Where a job stands in the line: your own scripts, blind tests and one-line retakes go first (oldest first),
  // then course lessons. Whatever is being made right now always finishes first.
  const quick = j => !isLesson(j) || !!j.parent_id;
  function lineSpot(S, j){
    if (j.status !== 'queued') return '';
    const ahead = S.others.concat(S.waitingLessons).filter(x => x.status === 'queued' && quick(x) && x.created_at < j.created_at).length;
    return ahead ? ahead + ' job' + (ahead === 1 ? '' : 's') + ' ahead of it' : S.running ? 'next, after the narration being made now' : 'next in line';
  }
  const workerAtLeast = (wk, v) => { const p = String((wk && wk.version) || '0').split('.').map(n => +n || 0); return p[0] > v[0] || (p[0] === v[0] && (p[1] || 0) >= v[1]); };

  // ───── Text to Speech ─────
  async function viewTts(main, S, reopen){
    const moods = ((S.wk && S.wk.moods) || ['teaching']).filter(m => !/_ar$/.test(m)).sort((a, b) => (a === 'teaching' ? -1 : b === 'teaching' ? 1 : 0));
    const hasAr = !!(S.wk && (S.wk.moods || []).includes('teaching_ar'));
    const plain = S.others.filter(j => !isAB(j));
    const last = plain[0];
    let mood = 'teaching';
    const word = (k, v) => k === 'pause' ? (0.30 * (0.5 + v / 100)).toFixed(2) + ' s' : k === 'pace' ? (v < 35 ? 'Calmer' : v > 65 ? 'Brisker' : 'Natural') : (v < 35 ? 'Steady' : v > 65 ? 'Lively' : 'Natural');
    const slider = (k, label) => '<label class="vs-slide" for="vsS_' + k + '"><span>' + esc(label) + '</span><span class="vs-val" id="vsV_' + k + '">' + esc(word(k, tune[k])) + '</span></label>' +
      '<input type="range" class="vs-range" id="vsS_' + k + '" data-k="' + k + '" min="0" max="100" step="5" value="' + tune[k] + '" aria-valuetext="' + esc(word(k, tune[k])) + '">';

    main.innerHTML = '<div class="vs-split"><section class="vs-col" aria-labelledby="ttsH">' +
      head('Text to Speech', 'Type or paste a script. It’s read in your cloned voice, on your own PC.',
        '<a class="vs-btn" href="#voice/projects">Open a lesson</a><label class="vs-btn vs-file">Upload .txt<input type="file" id="vsTxt" accept=".txt,text/plain"></label>').replace('<h1>', '<h1 id="ttsH">') +
      '<form class="vs-card vs-script" id="vsForm" novalidate><div class="vs-titlerow"><label for="vsTitle" class="vs-cap">Title</label><input type="text" id="vsTitle" class="vs-titlein" maxlength="120" placeholder="Optional, the first line is used if empty"></div><label for="vsText" class="vs-cap">Script</label>' +
      '<textarea id="vsText" rows="12" maxlength="200000" placeholder="Paste the script. A blank line starts a new paragraph. Start a paragraph with a mood tag like [warm] to change the mood. English and Arabic can be mixed."></textarea>' +
      '<div class="vs-bar"><span id="vsEst" class="vs-note" role="status">Free, no credits</span><span class="vs-btns">' +
      '<label class="vs-sr" for="vsTag">Insert mood tag</label><select id="vsTag" class="vs-btn vs-select"><option value="">Insert mood tag</option>' + moods.map(m => opt(m, MOOD_NAMES[m] || m)).join('') + '</select>' +
      '<button class="vs-go" type="submit">' + PLAY + 'Generate</button></span></div><p class="vs-note vs-msg" id="vsMsg" role="status"></p></form>' +
      '<section class="vs-card" aria-labelledby="takeH"><div class="vs-cardhead"><h2 id="takeH">Latest take</h2><span class="vs-links" id="vsDl"></span></div><div id="vsTake"></div></section>' +
      '</section><aside class="vs-side" aria-label="Voice settings">' +
      box('Voice', '<div class="vs-voice"><span class="vs-avatar" aria-hidden="true">AA</span><span><b>Amr · cloned voice</b><small>English' + (hasAr ? ' and Arabic (فصحى)' : '') + '</small></span><a href="#voice/voices">Change</a></div>' +
        '<div class="vs-sub" id="moodL">Mood</div><div class="vs-moods" role="group" aria-labelledby="moodL">' +
        moods.map(m => '<button type="button" class="vs-mood" data-mood="' + esc(m) + '" aria-pressed="' + (m === mood) + '">' + esc(MOOD_NAMES[m] || m) + '</button>').join('') + '</div>' +
        '<label class="vs-sub" for="vsLang">Language</label><select id="vsLang" class="vs-input">' + opt('auto', 'Auto (each sentence)', true) + opt('en', 'English') + opt('ar', 'Arabic (فصحى)') + '</select>' +
        (hasAr ? '' : '<p class="vs-note">No Arabic clip on the PC yet, so Arabic will carry an English accent.</p>')) +
      box('Settings', slider('pace', 'Pace') + slider('feel', 'Expressiveness') + slider('pause', 'Pause between sentences') +
        '<button type="button" class="vs-link vs-reset" id="vsReset">Back to how your voice was tuned</button>' +
        (workerAtLeast(S.wk, SLIDER_VERSION) ? '' : '<p class="vs-note">The PC starts using these after its next restart. Until then, scripts use your voice as tuned.</p>') +
        '<p class="vs-note">Every line is checked with Whisper; up to 4 takes, the best one kept. Course lessons always use your voice as tuned.</p>') +
      box('History', plain.slice(0, 3).map(j => '<div class="vs-hist"><button type="button" class="vs-round" data-play="' + j.id + '" aria-label="Play ' + esc(j.title) + '"' + (j.status === 'done' ? '' : ' disabled') + '>' + PLAY + '</button><span><b>' + esc(j.title) + '</b><small>' +
        (j.duration_s ? mmss(j.duration_s) + ' · ' : '') + esc(MOOD_NAMES[j.mood] || j.mood || '') + ' · ' + esc(ago(j.created_at)) + '</small></span></div>').join('') +
        (plain.length ? '<a class="vs-more" href="#voice/history">All narrations</a>' : empty('Nothing yet.'))) +
      '</aside></div>';

    // the latest take: a player when it's ready, where it stands while it's waiting or being made
    const take = $('vsTake'), dl = $('vsDl');
    if (!last) take.innerHTML = empty('Your first narration shows here.');
    else if (last.status === 'done') {
      const checks = (last.needs_review || []).length;
      take.innerHTML = '<p class="vs-title">' + esc(last.title) + '</p><audio class="vs-player" id="vsLast" controls preload="metadata"></audio>' +
        '<div class="vs-chips">' + (checks ? chip(checks + ' line' + (checks === 1 ? '' : 's') + ' to check', 'warn') : chip('Word check passed on every line', 'ok')) +
        (last.duration_s ? chip(mmss(last.duration_s) + ' of audio') : '') + chip('-16 LUFS') + chip(ago(last.finished_at || last.created_at)) + '</div>' +
        (checks ? '<p class="vs-note">Open it in <a href="#voice/history">History</a> to hear the flagged lines and retake them.</p>' : '');
      signedUrl(last.output_mp3 || last.output_wav).then(u => { const a = $('vsLast'); if (u && a) a.src = u; });
      dl.innerHTML = (last.output_mp3 ? '<button type="button" class="vs-link" data-dl="mp3">Download MP3</button>' : '') + (last.output_wav ? '<button type="button" class="vs-link" data-dl="wav">Download WAV</button>' : '');
      dl.querySelectorAll('[data-dl]').forEach(b => b.addEventListener('click', async () => {
        const p = b.dataset.dl === 'mp3' ? last.output_mp3 : last.output_wav;
        const u = await signedUrl(p, fileName(last.title, p.split('.').pop())); if (u) location.href = u;
      }));
    } else {
      const [label, kind] = STATUS[last.status] || [last.status, ''];
      take.innerHTML = '<p class="vs-title">' + esc(last.title) + '</p><div class="vs-chips">' + chip(label, kind) + (lineSpot(S, last) ? chip(lineSpot(S, last)) : '') + '</div>' +
        (last.status === 'running' ? bar(Math.round((last.progress || 0) * 100), 100) + '<p class="vs-note">' + esc(last.message || '') + '</p>' : '') +
        (last.status === 'queued' && S.running && isLesson(S.running) ? '<p class="vs-note">Your scripts go before the course lessons, so this starts as soon as the lesson being made now is finished.</p>' : '') +
        (last.status === 'failed' ? '<p class="vs-note">' + esc(last.message || 'Something went wrong on the PC.') + '</p>' : '');
      widths(take);
    }

    const text = $('vsText');
    // rough time on the RTX 3050: about 15 characters a second of audio
    const est = () => { const n = text.value.length, secs = n / 15; say('vsEst', n ? n.toLocaleString() + ' characters · about ' + mmss(secs) + ' of audio' + (S.ratio ? ' · about ' + hours(secs * S.ratio) + ' to make' : '') + ' · free, no credits' : 'Free, no credits'); };
    text.addEventListener('input', est);
    $('vsTxt').addEventListener('change', async ev => {
      const file = ev.target.files[0]; if (!file) return;
      if (file.size > 400000) return say('vsMsg', 'That file is too big for one narration. Split it into parts.');
      text.value = (await file.text()).replace(/\r\n/g, '\n'); est(); text.focus();
    });
    $('vsTag').addEventListener('change', ev => {
      const m = ev.target.value; ev.target.value = ''; if (!m) return;
      // a mood tag starts a paragraph, so put it at the start of the paragraph the cursor is in
      const at = text.selectionStart || 0, before = text.value.slice(0, at), start = before.lastIndexOf('\n\n') + (before.lastIndexOf('\n\n') < 0 ? 0 : 2);
      const rest = text.value.slice(start).replace(/^\[[a-z_]+\]\s*/, '');
      text.value = text.value.slice(0, start) + '[' + m + '] ' + rest; text.focus(); est();
    });
    const syncSliders = () => main.querySelectorAll('.vs-range').forEach(r => { r.value = tune[r.dataset.k]; const w = word(r.dataset.k, tune[r.dataset.k]); r.setAttribute('aria-valuetext', w); say('vsV_' + r.dataset.k, w); });
    main.querySelectorAll('.vs-range').forEach(r => r.addEventListener('input', () => { tune[r.dataset.k] = +r.value; syncSliders(); }));
    $('vsReset').addEventListener('click', () => { tune.pace = tune.feel = tune.pause = 50; syncSliders(); });
    main.querySelectorAll('.vs-mood').forEach(b => b.addEventListener('click', () => {
      mood = b.dataset.mood; main.querySelectorAll('.vs-mood').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
    main.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => {
      const j = plain.find(x => x.id === b.dataset.play); if (j) play(main, j.output_mp3 || j.output_wav, null, b.closest('.vs-card'));
    }));
    $('vsForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const t = text.value.trim();
      if (!t) return say('vsMsg', 'Type or paste a script first.');
      const first = (t.split('\n').map(l => l.replace(/^\[[a-z_]+\]\s*/, '').trim()).find(Boolean) || 'Narration');
      const title = $('vsTitle').value.trim() || first.slice(0, 50) + (first.length > 50 ? '…' : '');
      ev.submitter && (ev.submitter.disabled = true);
      const custom = tune.pace !== 50 || tune.feel !== 50 || tune.pause !== 50;
      const r = await safe(db().from('voice_jobs').insert({ title, text:t, language:$('vsLang').value, mood, settings:custom ? { pace:tune.pace, feel:tune.feel, pause:tune.pause } : null }));
      if (r.error) { ev.submitter && (ev.submitter.disabled = false); return say('vsMsg', errText(r, 'Couldn’t add it. Try again.')); }
      reopen();
    });
    return { live:!!last && (last.status === 'queued' || last.status === 'running') };
  }

  // ───── Projects: the real estate course batch ─────
  // staged new videos: content/<module>/videos/_new/<lesson>.mp4 (kept for 2 minutes, so a refresh doesn't list them again)
  let stagedCache = { at:0, mods:'', map:{} };
  async function stagedVideos(mods){
    if (Date.now() - stagedCache.at < 120000 && stagedCache.mods === mods.join()) return stagedCache.map;
    const map = {};   // "m1/1.1" -> path of the staged mp4; map.files["m1/1.1"] -> every staged file name (mp4, json, jpg)
    Object.defineProperty(map, 'files', { value:{}, enumerable:false });
    await Promise.all(mods.map(async m => {
      const r = await safe(db().storage.from('course').list('content/' + m + '/videos/_new', { limit:1000 }));
      (r.data || []).forEach(o => {
        const k = o.name.match(/^(.+)\.(mp4|json|jpg)$/); if (!k) return;
        (map.files[m + '/' + k[1]] = map.files[m + '/' + k[1]] || []).push(o.name);
        if (k[2] === 'mp4') map[m + '/' + k[1]] = 'content/' + m + '/videos/_new/' + o.name;
      });
    }));
    stagedCache = { at:Date.now(), mods:mods.join(), map };
    return map;
  }

  // Cancel a waiting or running job; says so on the button when it didn't work
  // Put a module's new videos live: each live file moves to videos/_old/<time>/ (so it can be put back), then the new
  // video, captions and cover move from videos/_new/ to where the course reads them (content/<module>/videos/<lesson>.*).
  async function putLive(m, lessons, staged, report){
    const st = db().storage.from('course'), base = 'content/' + m + '/videos/';
    const live = await safe(st.list('content/' + m + '/videos', { limit:1000 }));
    if (live.error) { report('Couldn’t read the live videos. Nothing was changed.'); return 0; }
    const have = new Set((live.data || []).map(o => o.name)), stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    let ok = 0; const bad = [];
    for (const id of lessons) {
      const names = staged.files[m + '/' + id] || []; let fine = true;
      for (const name of names) {
        if (have.has(name)) { const r = await safe(st.move(base + name, base + '_old/' + stamp + '/' + name)); if (r.error) { fine = false; break; } }
        const r2 = await safe(st.move(base + '_new/' + name, base + name)); if (r2.error) { fine = false; break; }
      }
      if (fine) ok++; else bad.push(id);
      report('Putting Module ' + m.replace(/^m/, '') + ' live · ' + (ok + bad.length) + ' of ' + lessons.length);
    }
    report(ok + ' video' + (ok === 1 ? '' : 's') + ' live in Module ' + m.replace(/^m/, '') + (bad.length ? ' · didn’t work for ' + bad.join(', ') + ', try again' : '') + '. The old ones are kept in videos/_old/' + stamp + '.');
    stagedCache.at = 0;
    return ok;
  }

  const cancelJob = async (id, b) => {
    const r = await safe(db().from('voice_jobs').update({ status:'cancelled', message:'Cancelled' }).eq('id', id).in('status', ['queued', 'running']));
    if (r.error && b) { b.textContent = errText(r, 'Couldn’t cancel'); b.disabled = false; return false; }
    return true;
  };

  // ───── Projects: the real estate course batch ─────
  async function viewProjects(main, S, reopen){
    const L = S.lessons;
    const staged = await stagedVideos([...new Set(L.map(j => j.target.module))]);
    const vid = j => staged[j.target.module + '/' + j.target.lesson];
    const narrated = L.filter(j => j.status === 'done'), audio = narrated.reduce((s, j) => s + (j.duration_s || 0), 0);
    const ready = L.filter(vid).length;
    const stat = (label, value, sub) => '<div class="vs-stat"><span class="vs-cap">' + esc(label) + '</span><b>' + esc(value) + '</b><small>' + esc(sub) + '</small></div>';
    const state = j => j.status === 'running' ? chip('Narrating · ' + Math.round((j.progress || 0) * 100) + '%', 'run') : j.status === 'done' ? chip((j.needs_review || []).length ? 'Narrated · ' + j.needs_review.length + ' to check' : 'Narrated', (j.needs_review || []).length ? 'warn' : 'ok') :
      j.status === 'queued' ? (firstUp && j.id === firstUp.id ? chip('Next', 'run') : chip('In queue')) : chip((STATUS[j.status] || [j.status])[0], j.status === 'failed' ? 'bad' : '');
    const retake = r => r ? ' ' + chip(r.status === 'running' ? 'Retake running' : r.status === 'queued' ? 'Retake waiting' : r.status === 'failed' ? 'Retake failed' : 'Retake ' + r.status, r.status === 'failed' ? 'bad' : '') : '';
    const video = j => vid(j) ? chip('Ready for review', 'ok') : j.status === 'done' ? chip('Not built yet') : chip('Waits for voice');
    const live = j => j.status === 'queued' || j.status === 'running';
    const name = j => esc('lesson ' + lessonTitle(j));

    const modName = m => 'Module ' + String(m).replace(/^m/, '');
    const modNum = m => +String(m).replace(/\D/g, '') || 0;
    const queuedMods = [...new Set(S.waitingLessons.map(j => j.target.module))].sort((a, b) => modNum(a) - modNum(b));
    const firstUp = S.waitingLessons.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.created_at < b.created_at ? -1 : 1))[0];
    const liveMods = {}; L.forEach(j => { if (vid(j)) (liveMods[j.target.module] = liveMods[j.target.module] || []).push(j.target.lesson); });
    const liveList = Object.keys(liveMods).sort((a, b) => modNum(a) - modNum(b));
    const tools = '<div class="vs-card vs-ops">' +
      '<div class="vs-op"><label class="vs-sub" for="vsFront">Narrate next</label><div class="vs-btns"><select id="vsFront" class="vs-input vs-narrow">' +
        (queuedMods.length ? queuedMods.map(m => opt(m, modName(m) + ' · ' + S.waitingLessons.filter(j => j.target.module === m).length + ' waiting', firstUp && firstUp.target.module === m)).join('') : '<option value="">Nothing waiting</option>') +
        '</select><button type="button" class="vs-btn" id="vsFrontGo"' + (queuedMods.length ? '' : ' disabled') + '>Move to the front</button></div>' +
        '<p class="vs-note" id="vsFrontMsg" role="status">' + (firstUp ? 'Next lesson: ' + esc(lessonTitle(firstUp)) + ' (' + esc(modName(firstUp.target.module)) + ')' : '') + '</p></div>' +
      '<div class="vs-op"><label class="vs-sub" for="vsLive">Put new videos live</label><div class="vs-btns"><select id="vsLive" class="vs-input vs-narrow">' +
        (liveList.length ? liveList.map(m => opt(m, modName(m) + ' · ' + liveMods[m].length + ' ready')).join('') : '<option value="">No new videos yet</option>') +
        '</select><button type="button" class="vs-go" id="vsLiveGo"' + (liveList.length ? '' : ' disabled') + '>Put live</button></div>' +
        '<p class="vs-note" id="vsLiveMsg" role="status">Learners see the new videos right away. The old ones are kept, so a module can be put back.</p></div></div>';

    main.innerHTML = head('Acquisitions Playbook', L.length + ' lessons · narration and videos built on your PC, in course order', '<a class="vs-btn" href="/course/">Open the course</a>') + tools +
      '<div class="vs-stats">' + stat('Narrated', narrated.length + ' / ' + L.length, S.eta ? 'about ' + hours(S.eta) + ' to go' : S.waitingLessons.length + ' waiting') +
      stat('Audio made', hours(audio), 'of finished narration') + stat('Videos ready', String(ready), 'waiting for your review') + stat('Credits used', '0', 'runs on your own PC') + '</div>' +
      '<section class="vs-card vs-flush"><div class="vs-tablewrap"><table class="vs-table"><caption class="vs-sr">Lessons in course order</caption><thead><tr><th scope="col">Lesson</th><th scope="col">Length</th><th scope="col">Voice</th><th scope="col">Video</th><th scope="col" class="vs-r">Actions</th></tr></thead><tbody>' +
      (L.length ? L.map(j => '<tr data-id="' + j.id + '"><td><b>' + esc(lessonTitle(j)) + '</b><small>Module ' + esc(String(j.target.module).replace(/^m/, '')) + '</small></td><td>' + (j.duration_s ? mmss(j.duration_s) : '·') + '</td><td>' + state(j) + retake(j.retake) + '</td><td>' + video(j) + '</td>' +
        '<td class="vs-r">' + (j.status === 'done' ? '<button type="button" class="vs-link" data-act="play" aria-label="Play ' + name(j) + '">Play</button><button type="button" class="vs-link" data-act="pieces" aria-expanded="false" aria-label="Retake a line in ' + name(j) + '">Retake a line</button>' : '') +
        (vid(j) ? '<button type="button" class="vs-link" data-act="video" aria-label="Open the new video of ' + name(j) + '">Open video</button>' : '') +
        (live(j) || (j.retake && live(j.retake)) ? '<button type="button" class="vs-link" data-act="cancel" aria-label="Cancel ' + (live(j) ? '' : 'the retake of ') + name(j) + '">Cancel' + (live(j) ? '' : ' retake') + '</button>' : '') + '</td></tr>' +
        '<tr class="vs-expand" hidden><td colspan="5"><div></div></td></tr>').join('') : '<tr><td colspan="5">' + empty('No lessons sent yet. Use “Narrate the lessons not done yet” on a module page in the course.') + '</td></tr>') +
      '</tbody></table></div></section>';

    $('vsFrontGo').addEventListener('click', async ev => {
      const m = $('vsFront').value; if (!m) return;
      const top = Math.max(0, ...S.waitingLessons.map(j => j.priority || 0)) + 1;
      ev.target.disabled = true;
      const r = await safe(db().from('voice_jobs').update({ priority:top }).eq('status', 'queued').eq('target->>mode', 'lesson').eq('target->>module', m));
      if (r.error) { ev.target.disabled = false; return say('vsFrontMsg', errText(r, 'Couldn’t move it. Try again.')); }
      reopen();
    });
    let armed = '';
    $('vsLiveGo').addEventListener('click', async ev => {
      const m = $('vsLive').value, b = ev.target; if (!m) return;
      if (armed !== m) {   // two clicks: the first says exactly what will happen
        armed = m; b.textContent = 'Yes, put ' + liveMods[m].length + ' live';
        say('vsLiveMsg', 'This replaces the videos learners see in ' + modName(m) + ' (' + liveMods[m].join(', ') + '). Click again to go ahead.');
        return;
      }
      armed = ''; b.disabled = true; b.textContent = 'Working…';
      await putLive(m, liveMods[m], staged, t => say('vsLiveMsg', t));
      b.textContent = 'Put live'; b.disabled = false;
      setTimeout(reopen, 2500);
    });
    $('vsLive').addEventListener('change', () => { armed = ''; $('vsLiveGo').textContent = 'Put live'; });

    main.querySelector('tbody').addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-act]'); if (!b) return;
      const row = b.closest('tr'), j = L.find(x => x.id === row.dataset.id); if (!j) return;
      const more = row.nextElementSibling, cell = more.querySelector('div');
      if (b.dataset.act === 'play') { more.hidden = false; if (!cell.querySelector('.vs-piece')) cell.innerHTML = ''; play(main, j.output_mp3 || j.output_wav, null, cell); }
      else if (b.dataset.act === 'pieces') {
        if (!more.hidden && cell.querySelector('.vs-piece')) { more.hidden = true; b.setAttribute('aria-expanded', 'false'); return; }
        more.hidden = false; b.setAttribute('aria-expanded', 'true'); cell.innerHTML = '<p class="p-loading">Loading…</p>'; pieces(j, cell, reopen);
      }
      else if (b.dataset.act === 'video') { const w = window.open('', '_blank'); const u = await signedUrl(vid(j), null, 'course'); if (u && w) w.location = u; else if (w) w.close(); }
      else if (b.dataset.act === 'cancel') { b.disabled = true; if (await cancelJob(live(j) ? j.id : j.retake.id, b)) reopen(); }
    });
    return { live:!!S.running };
  }

  // ───── Voices: moods on the PC and the blind test ─────
  async function viewVoices(main, S, reopen){
    const ORDER = ['teaching', 'warm', 'serious', 'energetic', 'teaching_ar'];
    const moods = ((S.wk && S.wk.moods) || []).slice().sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
    const tests = S.others.filter(isAB);
    main.innerHTML = head('Voices', 'The voices your PC can speak in. Each mood is a short clip of you the clone copies.') +
      box('', '<div class="vs-voice is-big"><span class="vs-avatar" aria-hidden="true">AA</span><span><b>Amr · cloned voice</b><small>Made from your ElevenLabs Lesson 4.2 narration · lives on yukis-pc</small></span></div>' +
        (moods.length ? '<ul class="vs-moodlist">' + moods.map(m => '<li><b>' + esc(MOOD_NAMES[m] || m) + '</b><span>' + esc(MOOD_NOTES[m] || '') + '</span></li>').join('') + '</ul>' : empty('The worker hasn’t reported its voices yet.')) +
        '<p class="vs-note">Adding a new voice from a recording comes in a later round.</p>') +
      '<section class="vs-card" aria-labelledby="abH"><div class="vs-cardhead"><h2 id="abH">Blind test</h2><span class="vs-note">your voice vs ElevenLabs</span></div>' +
      (tests.length ? tests.map(j => { const [label, kind] = STATUS[j.status] || [j.status, '']; return '<div class="vs-job" data-id="' + j.id + '"><span><b>' + esc(j.title) + '</b> ' + chip(label, kind) + '<small>' + esc(ago(j.created_at)) + '</small></span>' +
        (j.status === 'done' ? '<button type="button" class="vs-btn" data-act="ab" aria-expanded="false">Take the blind test</button>' : '') +
        (j.status === 'queued' || j.status === 'running' ? '<button type="button" class="vs-btn" data-act="cancel" aria-label="Cancel ' + esc(j.title) + '">Cancel</button>' : '') + '<div class="vs-jobmore" hidden></div></div>'; }).join('') : '') +
      '<form class="vs-form" id="vsAb" novalidate><p class="vs-note">Upload a voice-only ElevenLabs narration (at least a minute). Your PC makes the same sentences in your voice, then you listen to the pairs without knowing which is which.</p>' +
      '<label class="vs-sub" for="vsAbFile">ElevenLabs file (MP3 or WAV)</label><input type="file" id="vsAbFile" accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav">' +
      '<button class="vs-go" type="submit">Make the blind test</button><p class="vs-note" id="vsAbMsg" role="status"></p></form></section>';

    main.querySelectorAll('.vs-job [data-act="ab"]').forEach(b => b.addEventListener('click', () => {
      const row = b.closest('.vs-job'), j = tests.find(x => x.id === row.dataset.id), more = row.querySelector('.vs-jobmore');
      if (!more.hidden) { more.hidden = true; b.setAttribute('aria-expanded', 'false'); return; }
      more.hidden = false; b.setAttribute('aria-expanded', 'true'); more.innerHTML = '<p class="p-loading">Loading…</p>'; abTest(j, more);
    }));
    main.querySelectorAll('.vs-job [data-act="cancel"]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; if (await cancelJob(b.closest('.vs-job').dataset.id, b)) reopen(); }));
    $('vsAb').addEventListener('submit', async ev => {
      ev.preventDefault(); const file = $('vsAbFile').files[0];
      if (!file) return say('vsAbMsg', 'Choose the ElevenLabs file first.');
      if (file.size > 50 * 1024 * 1024) return say('vsAbMsg', 'That file is over 50 MB.');
      const ext = /\.wav$/i.test(file.name) ? 'wav' : 'mp3';
      const path = 'ab/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) + '/eleven.' + ext;
      say('vsAbMsg', 'Uploading…');
      const up = await safe(db().storage.from('voice').upload(path, file, { contentType:ext === 'wav' ? 'audio/wav' : 'audio/mpeg' }));
      if (up.error) return say('vsAbMsg', errText(up, 'The upload didn’t work. Try again.'));
      const r = await safe(db().from('voice_jobs').insert({ title:'Blind test: ' + file.name.replace(/\.[^.]+$/, ''), text:'Blind test against ElevenLabs', language:'en', mood:'teaching', target:{ mode:'ab', source:path } }));
      if (r.error) return say('vsAbMsg', errText(r, 'Couldn’t start it. Try again.'));
      reopen();
    });
    return { live:tests.some(j => j.status === 'queued' || j.status === 'running') };
  }

  // ───── History: every narration that isn't a course lesson ─────
  async function viewHistory(main, S, reopen){
    const jobs = S.others.filter(j => !isAB(j));
    main.innerHTML = head('History', 'Your narrations, newest first. Course lessons are in Projects.') +
      '<section class="vs-card">' + (jobs.length ? jobs.map(j => {
        const [label, kind] = STATUS[j.status] || [j.status, ''], live = j.status === 'queued' || j.status === 'running', checks = (j.needs_review || []).length;
        return '<div class="vs-job" data-id="' + j.id + '"><span><b>' + esc(j.title) + '</b> ' + chip(label, kind) + (checks ? ' ' + chip(checks + ' to check', 'warn') : '') +
          '<small>' + esc(ago(j.created_at)) + (j.duration_s ? ' · ' + mmss(j.duration_s) : '') + (j.mood ? ' · ' + esc(MOOD_NAMES[j.mood] || j.mood) : '') + (j.redo_piece != null ? ' · piece ' + j.redo_piece + ' redone' : '') + (j.settings ? ' · own settings' : '') +
          (lineSpot(S, j) ? ' · ' + esc(lineSpot(S, j)) : '') + (j.message && j.status !== 'done' && j.status !== 'queued' ? ' · ' + esc(j.message) : '') + '</small>' +
          (j.status === 'running' ? bar(Math.round((j.progress || 0) * 100), 100) : '') + '</span><span class="vs-btns">' +
          (j.status === 'done' ? '<button class="vs-btn" type="button" data-act="play" aria-label="Play ' + esc(j.title) + '">Play</button>' + (j.output_mp3 ? '<button class="vs-btn" type="button" data-act="mp3" aria-label="Download MP3 of ' + esc(j.title) + '">MP3</button>' : '') + (j.output_wav ? '<button class="vs-btn" type="button" data-act="wav" aria-label="Download WAV of ' + esc(j.title) + '">WAV</button>' : '') + '<button class="vs-btn" type="button" data-act="pieces" aria-expanded="false" aria-label="Lines of ' + esc(j.title) + '">Lines</button>' : '') +
          (live ? '<button class="vs-btn" type="button" data-act="cancel" aria-label="Cancel ' + esc(j.title) + '">Cancel</button>' : '') + '</span><div class="vs-jobmore" hidden></div></div>';
      }).join('') : empty('Nothing yet. Make one in Text to Speech.')) + '</section>';
    widths(main);
    main.querySelectorAll('.vs-job').forEach(row => row.addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-act]'); if (!b) return;
      const j = jobs.find(x => x.id === row.dataset.id); if (!j) return;
      const more = row.querySelector('.vs-jobmore');
      if (b.dataset.act === 'play') { more.hidden = false; if (!more.querySelector('.vs-piece')) more.innerHTML = ''; play(main, j.output_mp3 || j.output_wav, null, more); }
      else if (b.dataset.act === 'mp3' || b.dataset.act === 'wav') { const p = b.dataset.act === 'mp3' ? j.output_mp3 : j.output_wav; const u = await signedUrl(p, fileName(j.title, p.split('.').pop())); if (u) location.href = u; }
      else if (b.dataset.act === 'cancel') { b.disabled = true; if (await cancelJob(j.id, b)) reopen(); }
      else if (b.dataset.act === 'pieces') {
        if (!more.hidden && more.querySelector('.vs-piece')) { more.hidden = true; b.setAttribute('aria-expanded', 'false'); return; }
        more.hidden = false; b.setAttribute('aria-expanded', 'true'); more.innerHTML = '<p class="p-loading">Loading…</p>'; pieces(j, more, reopen);
      }
    }));
    return { live:jobs.some(j => j.status === 'queued' || j.status === 'running') };
  }

  // ───── Pronunciations ─────
  async function viewPron(main, S, reopen){
    const pron = await safe(db().from('voice_pronunciations').select('id,written,spoken,language').order('written'));
    main.innerHTML = head('Pronunciations', 'How names and words are said. Used for every narration, lessons included.') +
      '<section class="vs-card">' + ((pron.data || []).length ? pron.data.map(p => '<div class="vs-job"><span><b>' + esc(p.written) + '</b> → ' + esc(p.spoken) + ' <small>' + (p.language === 'ar' ? 'Arabic' : 'English') + '</small></span>' +
        '<button class="vs-btn" type="button" data-pron="' + p.id + '" aria-label="Remove ' + esc(p.written) + '">Remove</button></div>').join('') : empty('None yet.')) +
      '<form class="vs-form vs-row" id="vsPron" novalidate>' + f('Written', '<input class="vs-input" type="text" id="vsPw" maxlength="80" placeholder="Hillsborough">') +
      f('Say it as', '<input class="vs-input" type="text" id="vsPs" maxlength="120" placeholder="Hills burrow">') +
      f('Language', '<select class="vs-input" id="vsPl">' + opt('en', 'English', true) + opt('ar', 'Arabic') + '</select>') +
      '<button class="vs-go" type="submit">Add</button><p class="vs-note" id="vsPmsg" role="status"></p></form></section>';
    $('vsPron').addEventListener('submit', async ev => {
      ev.preventDefault(); const w1 = $('vsPw').value.trim(), s1 = $('vsPs').value.trim();
      if (!w1 || !s1) return say('vsPmsg', 'Fill in both.');
      const r = await safe(db().from('voice_pronunciations').upsert({ written:w1, spoken:s1, language:$('vsPl').value }, { onConflict:'written,language' }));
      if (r.error) return say('vsPmsg', errText(r, 'Couldn’t save it.'));
      reopen();
    });
    main.querySelectorAll('[data-pron]').forEach(b => b.addEventListener('click', async () => {
      await safe(db().from('voice_pronunciations').delete().eq('id', b.dataset.pron)); reopen();
    }));
    return { live:false };
  }


  // ───── Your computer: "Can my computer run it?" ─────
  // A browser can't see graphics memory, so the card's name is matched against known cards. The worker app (a later
  // round) checks the real numbers and measures the speed after install; until then yukis-pc's measured speed is shown.
  const CARDS = [   // [pattern, GB of graphics memory; the smallest version when a card came in several]
    [/rtx\s*50(90)/i, 32], [/rtx\s*50(80)/i, 16], [/rtx\s*5070\s*ti/i, 16], [/rtx\s*50(70)/i, 12], [/rtx\s*5060\s*ti/i, 8], [/rtx\s*50(60)/i, 8], [/rtx\s*50(50)/i, 8],
    [/rtx\s*40(90)/i, 24], [/rtx\s*40(80)/i, 16], [/rtx\s*4070/i, 12], [/rtx\s*4060\s*ti/i, 8], [/rtx\s*40(60)/i, 8], [/rtx\s*40(50)/i, 6],
    [/rtx\s*30(90)/i, 24], [/rtx\s*30(80)/i, 10], [/rtx\s*3070/i, 8], [/rtx\s*3060\s*ti/i, 8], [/rtx\s*30(60)/i, 12], [/rtx\s*30(50)/i, 6],
    [/rtx\s*20(80)/i, 8], [/rtx\s*20(70)/i, 8], [/rtx\s*20(60)/i, 6], [/titan/i, 12],
    [/gtx\s*16(60)/i, 6], [/gtx\s*16(50)/i, 4], [/gtx\s*10(80)/i, 8], [/gtx\s*10(70)/i, 8], [/gtx\s*10(60)/i, 3], [/gtx\s*10(50)/i, 2],
    [/rtx\s*a?(2000)/i, 6], [/rtx\s*a?(4000)/i, 16], [/rtx\s*a?(5000)/i, 24], [/rtx\s*a?(6000)/i, 48]];
  const RATINGS = {
    rec:{ label:'Recommended', kind:'ok', speed:'About 2x real time: a 10-minute lesson takes about 20 to 25 minutes' },
    slow:{ label:'Works, but slow', kind:'warn', speed:'Roughly 4x to 8x real time: fine for short scripts' },
    no:{ label:'Not recommended', kind:'bad', speed:'Roughly 10x to 15x real time on the processor: short clips only' }};

  async function detect(){
    const d = { gpu:'', cores:navigator.hardwareConcurrency || 0, ram:navigator.deviceMemory || 0, os:'', bits:'', mobile:false };
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      d.gpu = gl ? String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '') : '';
    } catch(e) {}
    const ua = navigator.userAgent || '', uad = navigator.userAgentData;
    d.mobile = uad ? !!uad.mobile : /Android|iPhone|iPad|Mobile/i.test(ua);
    try {
      if (uad && uad.getHighEntropyValues) {
        const h = await uad.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'bitness']);
        d.os = h.platform === 'Windows' ? (parseInt(h.platformVersion, 10) >= 13 ? 'Windows 11' : 'Windows 10 or older') : h.platform;
        d.bits = h.bitness ? h.bitness + '-bit' : ''; d.arch = h.architecture;
      }
    } catch(e) {}
    if (!d.os) d.os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
    if (!d.bits) d.bits = /WOW64|Win64|x64|x86_64|arm64|aarch64/i.test(ua) || d.os === 'macOS' ? '64-bit' : '';
    // tidy "ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 (0x00002584) Direct3D11 vs_5_0 ps_5_0, D3D11)" -> "NVIDIA GeForce RTX 3050"
    d.card = (d.gpu.match(/(NVIDIA[^,(]*|AMD[^,(]*|Radeon[^,(]*|Intel[^,(]*|Apple M\d[^,(]*)/i) || [d.gpu])[0].replace(/\s+/g, ' ').trim();
    if (/swiftshader|llvmpipe|software|basic render/i.test(d.gpu)) d.card = 'None shared (the browser is drawing in software)';
    else if (d.card === d.gpu) d.card = d.gpu.replace(/^ANGLE \(|\)$/g, '');
    return d;
  }

  function rate(d){
    const why = [];
    const nvidia = /nvidia|geforce|rtx|gtx|quadro/i.test(d.gpu), apple = /apple m\d/i.test(d.gpu) || (d.os === 'macOS' && /apple/i.test(d.gpu));
    const hit = nvidia && CARDS.find(c => c[0].test(d.gpu)), laptop = /laptop|mobile|max-q/i.test(d.gpu);
    let vram = hit ? hit[1] : 0;
    if (hit && laptop) vram = /30(50)/.test(d.gpu) ? 4 : /30(60)/.test(d.gpu) ? 6 : vram;   // laptop versions have less
    if (d.mobile) return { r:'no', vram, why:['This is a phone or tablet. The voice app needs a Windows PC or a Mac.'] };
    if (!d.gpu) why.push('Your browser didn’t share the graphics card, so this is a guess. The worker checks it exactly after install.');
    if (d.bits === '32-bit') return { r:'no', vram, why:why.concat('32-bit system; the voice app needs 64-bit.') };
    if (d.ram && d.ram < 8) return { r:'no', vram, why:why.concat('Less than 8 GB of memory (16 GB recommended).') };
    if (nvidia && vram >= 6) return { r:d.os.indexOf('Windows') === 0 ? 'rec' : 'slow', vram, why:why.concat('NVIDIA card with about ' + vram + ' GB of graphics memory.', d.os.indexOf('Windows') === 0 ? 'Windows, like yukis-pc.' : 'The installer is Windows-first; other systems come later.') };
    if (nvidia && vram) return { r:'slow', vram, why:why.concat('NVIDIA card with about ' + vram + ' GB of graphics memory; 6 GB or more is recommended.') };
    if (nvidia) return { r:'slow', vram, why:why.concat('An NVIDIA card this check doesn’t know yet. The worker measures it after install.') };
    if (apple) return { r:'slow', vram, why:why.concat('Apple Silicon Mac: it works, slower than an NVIDIA card. 16 GB of memory recommended.') };
    return { r:'no', vram, why:why.concat(d.gpu ? 'No NVIDIA or Apple Silicon graphics (' + d.card + '), so the voice would run on the processor.' : 'No graphics card could be found.') };
  }

  async function viewComputer(main, S){
    main.innerHTML = head('Can my computer run it?', 'Amr Voice Studio runs on your own computer, so your voice and audio never leave it. Here’s how this one looks.') + '<p class="p-loading">Checking this computer…</p>';
    const d = await detect(), res = rate(d), R = RATINGS[res.r];
    const row = (k, v) => '<div class="vs-spec"><span>' + esc(k) + '</span><b>' + esc(v || 'Not shared by the browser') + '</b></div>';
    const pc = S.wk, ratio = S.ratio;
    const pcRate = pc && /\d+(\.\d+)?\s*GB/.test(pc.gpu || '') ? (parseFloat((pc.gpu.match(/(\d+(\.\d+)?)\s*GB/) || [])[1]) >= 5.5 ? 'rec' : 'slow') : null;
    main.innerHTML = head('Can my computer run it?', 'Amr Voice Studio runs on your own computer, so your voice and audio never leave it. Here’s how this one looks.') +
      '<div class="vs-split"><section class="vs-col">' +
      '<section class="vs-card vs-verdict is-' + R.kind + '" aria-labelledby="vsVerdict"><span class="vs-cap">This computer</span><h2 id="vsVerdict">' + esc(R.label) + '</h2>' +
        '<p>' + esc(R.speed) + '</p><ul class="vs-facts">' + res.why.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' +
        '<div class="vs-btns"><button type="button" class="vs-go" disabled>Windows app coming soon</button><span class="vs-note">This is a quick check from the browser. The app confirms it with the exact numbers and a speed test.</span></div></section>' +
      box('What the browser could see', row('Graphics card', d.card) + row('Graphics memory', res.vram ? 'About ' + res.vram + ' GB (estimated from the card’s name)' : '') +
        row('Processor', d.cores ? d.cores + ' threads' : '') + row('Memory', d.ram ? (d.ram >= 8 ? '8 GB or more' : d.ram + ' GB') : '') + row('System', [d.os, d.bits].filter(Boolean).join(', '))) +
      '</section><aside class="vs-side">' +
      box('yukis-pc, measured', pc ? '<div class="vs-chips">' + chip(pcRate ? RATINGS[pcRate].label : 'Not measured', pcRate ? RATINGS[pcRate].kind : '') + '</div>' +
        row('Graphics card', String(pc.gpu || '').replace(/^NVIDIA GeForce /, '')) + row('Speed', ratio ? 'About ' + ratio.toFixed(1) + 'x real time (from the finished lessons)' : 'Not enough lessons yet') +
        '<p class="vs-note">When other apps fill the graphics memory (NVIDIA Broadcast, Discord, browsers), narration can get about 10x slower. Close them for full speed.</p>' : empty('The PC hasn’t connected yet.')) +
      '</aside></div>' +
      '<section class="vs-card vs-flush"><div class="vs-tablewrap"><table class="vs-table"><caption class="vs-sr">What each rating means</caption><thead><tr><th scope="col">Rating</th><th scope="col">Graphics card</th><th scope="col">Memory and disk</th><th scope="col">Expected speed</th></tr></thead><tbody>' +
      '<tr><td>' + chip('Recommended', 'ok') + '</td><td>NVIDIA with 6 GB or more (RTX 3050 6 GB, 3060, 4060 and up)</td><td>16 GB memory, 15 GB free disk, Windows 10 or 11, 64-bit</td><td>About 2x real time</td></tr>' +
      '<tr><td>' + chip('Works, but slow', 'warn') + '</td><td>NVIDIA with 4 GB; Apple Silicon Mac (M1 or newer) with 16 GB</td><td>16 GB memory, 15 GB free disk</td><td>Roughly 4x to 8x real time</td></tr>' +
      '<tr><td>' + chip('Not recommended', 'bad') + '</td><td>Intel or AMD graphics only, under 8 GB memory, or 32-bit</td><td>Any</td><td>Roughly 10x to 15x real time</td></tr>' +
      '</tbody></table></div></section>';
    return { live:false };
  }

  const VIEWS = { tts:viewTts, projects:viewProjects, voices:viewVoices, history:viewHistory, pron:viewPron, computer:viewComputer };

  let openId = 0;
  V.voice = { title:'Voice Studio', sec:'owner', async open(el, ok){
    if (timer) { clearInterval(timer); timer = null; }
    const me = ++openId, mine = () => me === openId && ok();
    const sub = location.hash.split('/')[1] || 'tts', tab = VIEWS[sub] ? sub : 'tts';
    el.innerHTML = shell(tab);
    const main = el.querySelector('#vsMain'), wkBox = el.querySelector('#vsWk');
    const reopen = () => V.voice.open(el, ok);
    let wkHtml = '';
    const showWk = S2 => { const h = railStatus(S2); if (h !== wkHtml) { wkHtml = h; wkBox.innerHTML = h; } };
    // what the screen shows depends on these; a redraw only happens when one of them changes
    const sig = S2 => S2.lessons.concat(S2.others).map(j => j.id + j.status + Math.round((j.progress || 0) * 20) + (j.retake ? j.retake.status : '')).join();
    let S = await load();
    if (!mine()) return;
    let res = {};
    const draw = async () => {
      if (S.error) { main.innerHTML = failed(S.error); return; }
      showWk(S); res = await VIEWS[tab](main, S, reopen) || {};
    };
    await draw();
    if (!mine()) return;

    // Every 15 s while something is being made (every minute otherwise, or after a failed load): refresh the PC status,
    // and redraw this screen in place when a job changed and you're not typing, listening or looking at an opened row.
    let rate = 0, mineTimer = null;
    const stop = () => { clearInterval(mineTimer); if (timer === mineTimer) timer = null; mineTimer = null; };
    const tick = async () => {
      if (!mine() || !document.body.contains(main)) { stop(); return; }
      const fresh = await load();
      if (!mine() || !document.body.contains(main)) { stop(); return; }
      if (fresh.error) return;
      showWk(fresh);
      const act = document.activeElement;
      const busy = (act && main.contains(act) && /INPUT|TEXTAREA|SELECT/.test(act.tagName)) || [...main.querySelectorAll('audio')].some(a => !a.paused) ||
        !!main.querySelector('.vs-jobmore:not([hidden]), .vs-expand:not([hidden])') || !!($('vsText') && $('vsText').value.trim()) || !!($('vsTitle') && $('vsTitle').value.trim());
      if (busy || (!S.error && sig(fresh) === sig(S))) return;
      const y = window.scrollY; S = fresh; await draw(); if (!mine()) return; window.scrollTo(0, y); every();
    };
    // the pace follows what's on screen: faster while something is being made
    const every = () => { const want = res.live && !S.error ? 15000 : 60000; if (want === rate && mineTimer) return; stop(); rate = want; timer = mineTimer = setInterval(tick, want); };
    every();
  } };
})();
