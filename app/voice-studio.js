// Amr Voice Studio (Amr only, #voice): narration in Amr's cloned voice, made on his own PC instead of ElevenLabs.
// Screens, in the studio's own menu:  #voice (Text to Speech)  #voice/projects (the course batch)
//   #voice/voices (voices, moods, blind test)  #voice/history (every narration)  #voice/pron (pronunciations)
//   #voice/computer ("Can my computer run it?": a quick check in the browser, and the PC's measured speed)
// The page only adds jobs to voice_jobs; the worker on yukis-pc (start-worker.bat) picks them up in the order they
// were added (your own scripts and one-line retakes first, then course lessons by module priority), narrates them and uploads the audio to the private "voice" bucket. Lesson jobs also save
// content/<module>/narration/<lesson>.* in the course bucket; new lesson videos are staged in content/<module>/videos/_new/.
// Database: voice_jobs, voice_pronunciations, voice_worker, voice_ab_votes, bucket "voice". Phase 3 (Nov 16): every row has an owner; people with the
// 'voice' switch in Invite and access see only their own (Text to Speech, Review, History, Pronunciations, Your computer). Projects (the course) and
// Voices (Amr's moods and blind test) stay Amr's. Their files go in voice/<their user id>/.
// Looks: voice-studio.css, from the approved mockup "Amr Voice Studio". Round 3 (Nov 16): Review screen, modules with search and filters, phone tab row and settings drawer,
// mood samples, line playback, before/after on retakes, Today summary, Pause the queue (voice_settings), alerts on this device.
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
    ['review', 'Review', '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'],
    ['voices', 'Voices', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'],
    ['history', 'History', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
    ['pron', 'Pronunciations', '<path d="M4 12h4l2-6 4 12 2-6h4"/>'],
    ['computer', 'Your computer', '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>']];
  const isAmr = () => T().role === 'owner';
  const AMR_ONLY = ['projects', 'voices'];   // the course batch, and Amr's own voice and moods
  const tabsFor = () => TABS.filter(t => isAmr() || !AMR_ONLY.includes(t[0]));
  const uid = () => (T().user && T().user.id) || '';
  const wkName = wk => (wk && wk.name) || (isAmr() ? 'yukis-pc' : 'Your computer');
  const SAMPLE = 'Mood sample · ';   // title of the short clips made to hear a mood before picking it
  const SAMPLE_TEXT = { en:'Here is how this mood sounds. When a seller tells you the price is firm, slow down, ask one more question, and listen to the answer.',
    ar:'هكذا يبدو هذا الصوت. عندما يخبرك البائع أن السعر نهائي، تمهّل، واطرح سؤالًا آخر، واستمع إلى الإجابة جيدًا.' };
  const JOB_COLS = 'id,title,status,progress,message,language,mood,target,settings,duration_s,needs_review,output_mp3,output_wav,output_json,parent_id,redo_piece,created_at,claimed_at,finished_at';
  const SLIDER_VERSION = [0, 4];   // the worker reads the sliders from version 0.4
  const tune = { pace:50, feel:50, pause:50 };   // Text to Speech sliders, kept while you move between screens
  let timer = null;

  const isAB = j => j.target && j.target.mode === 'ab';
  const isLesson = j => j.target && j.target.mode === 'lesson';
  const isTake = j => !!(j && j.settings && j.settings.take_group);   // one of the 3 takes of a line (target.mode 'take')
  const TAKES = [{ k:'A', feel:40 }, { k:'B', feel:55 }, { k:'C', feel:70 }];
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
    const [w, lessons, others, set, samples, saved] = await Promise.all([
      isAmr() ? safe(db().from('voice_worker').select('*').eq('id', 'main').maybeSingle())
        : safe(db().from('voice_worker').select('*').eq('owner', uid()).order('last_seen', { ascending:false }).limit(1).maybeSingle()),
      isAmr() ? safe(db().from('voice_jobs').select('id,title,status,progress,message,target,priority,parent_id,duration_s,needs_review,output_mp3,output_wav,output_json,created_at,claimed_at,finished_at').eq('target->>mode', 'lesson').order('created_at').limit(2000)) : { data:[] },
      safe(db().from('voice_jobs').select(JOB_COLS).or('target.is.null,target->>mode.is.null,target->>mode.neq.lesson').not('title', 'like', SAMPLE + '%').order('created_at', { ascending:false }).limit(60)),
      isAmr() ? safe(db().from('voice_settings').select('*').eq('id', 'main').maybeSingle()) : { data:null, error:'not yours' },
      safe(db().from('voice_jobs').select('id,title,status,output_mp3,output_wav,created_at').like('title', SAMPLE + '%').neq('status', 'cancelled').order('created_at', { ascending:false }).limit(40)),
      safe(db().rpc('voice_saved_stats'))]);
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
    const waiting = (lessons.data || []).filter(j => j.status === 'queued' && !j.parent_id);
    const running = (lessons.data || []).find(j => j.status === 'running') || (others.data || []).find(j => j.status === 'running') || null;
    const done = lessonList.filter(j => j.status === 'done' && !j.parent_id && j.duration_s && took(j)).map(j => ({ audio:j.duration_s, work:took(j) }));
    let eta = null; try { eta = queueEta(done, waiting.length, running); } catch(e) { eta = null; }
    // today, from midnight on this device: what got made, how much audio, what failed
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const isToday = d => d && new Date(d) >= midnight;
    const all = (lessons.data || []).concat(others.data || []);
    const madeToday = all.filter(j => j.status === 'done' && isToday(j.finished_at));
    const today = { lessons:madeToday.filter(j => isLesson(j) && !j.parent_id).length, scripts:madeToday.filter(j => !isLesson(j) && !isAB(j) && !j.parent_id).length,
      retakes:madeToday.filter(j => j.parent_id).length, audio:madeToday.filter(j => !j.parent_id).reduce((t, j) => t + (j.duration_s || 0), 0),
      work:madeToday.reduce((t, j) => t + took(j), 0), failed:all.filter(j => j.status === 'failed' && isToday(j.finished_at || j.created_at)).length };
    // the newest finished sample per mood
    const moodSamples = {};
    (samples.data || []).forEach(j => { const m = j.title.slice(SAMPLE.length); if (!moodSamples[m] || (moodSamples[m].status !== 'done' && j.status === 'done')) moodSamples[m] = j; });
    // what needs a listen: finished narrations with lines the word check flagged
    const review = lessonList.filter(j => j.status === 'done' && (j.needs_review || []).length).concat((others.data || []).filter(j => j.status === 'done' && !isAB(j) && !isTake(j) && (j.needs_review || []).length));
    return { ratio:workRatio(done), wk, online, error:lessons.error || others.error, lessons:lessonList, waitingLessons:waiting, others:others.data || [], running, eta,
      paused:!!(set.data && set.data.paused), pausedAt:set.data && set.data.paused_at, pauseReady:!set.error && isAmr(), set:set.data || {}, offHours:offHours(set.data), saved:(saved.data && saved.data[0]) || null, today, moodSamples, review, all };
  }

  function railStatus(S){
    const wk = S.wk;
    const gpu = wk && wk.gpu ? (wk.gpu === 'loading' ? 'starting up' : String(wk.gpu).replace(/^NVIDIA GeForce /, '').replace(/\s*\(.*\)$/, '')) : '';
    if (S.paused) return '<div class="vs-wk"><div class="vs-wk-top"><span class="vs-dot is-pause"></span>Queue paused</div><div>' + esc(S.running ? 'Finishing ' + (isLesson(S.running) ? 'lesson ' + lessonTitle(S.running) : S.running.title) + ', then it waits' : 'Nothing new starts until you resume') + '</div>' +
      '<button type="button" class="vs-wkbtn" data-pause="0">Resume</button></div>';
    if (S.offHours && S.waitingLessons.length && !S.running) return '<div class="vs-wk"><div class="vs-wk-top"><span class="vs-dot is-pause"></span>' + esc(wkName(S.wk)) + (S.online ? ' online' : ' offline') + '</div><div>Lessons wait until ' + esc(hourName(S.set.hour_start)) + ' (working hours)</div>' +
      '<div><a href="#voice/computer" class="vs-wklink">Change the hours</a></div></div>';
    if (!wk && !isAmr()) return '<div class="vs-wk"><div class="vs-wk-top"><span class="vs-dot"></span>No computer connected yet</div>' +
      '<div>Narration runs on your own computer. The app for it comes in the next update; until then your scripts wait in the queue.</div>' +
      '<div><a href="#voice/computer" class="vs-wklink">Can my computer run it?</a></div></div>';
    const line2 = S.waitingLessons.length ? S.waitingLessons.length + ' lesson' + (S.waitingLessons.length === 1 ? '' : 's') + ' in queue' : (wk && wk.busy_job ? 'working' : 'queue empty');
    return '<div class="vs-wk"><div class="vs-wk-top"><span class="vs-dot' + (S.online ? ' is-on' : '') + '"></span>' + esc(wkName(wk)) + (S.online ? ' online' : ' offline') + '</div>' +
      '<div>' + esc(S.online ? (gpu ? gpu + ' · ' : '') + line2 : wk ? 'last seen ' + ago(wk.last_seen) : 'never connected') + '</div>' +
      (S.online && S.eta ? '<div>About ' + esc(hours(S.eta)) + ' left</div>' : '') +
      (S.online ? '' : isAmr() ? '<div>Start <b>start-worker.bat</b> on the PC</div>' : '<div>Open the Voice Studio app on your computer</div>') +
      (S.pauseReady && (S.running || S.waitingLessons.length) ? '<button type="button" class="vs-wkbtn" data-pause="1">Pause the queue</button>' : '') + '</div>';
  }

  function shell(tab){
    return '<div class="vs-app"><nav class="vs-rail" aria-label="Voice Studio">' +
      '<div class="vs-brand"><span class="vs-logo">' + icon('<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>') + '</span><span><b>Amr Voice Studio</b><small>Your voice, your PC</small></span></div>' +
      '<div class="vs-navs">' + tabsFor().map(t => '<a class="vs-nav' + (t[0] === tab ? ' is-on' : '') + '" href="#voice' + (t[0] === 'tts' ? '' : '/' + t[0]) + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + icon(t[2]) + '<span>' + t[1] + '</span>' + (t[0] === 'review' ? '<span class="vs-badge" id="vsRevN" hidden></span>' : '') + '</a>').join('') + '</div>' +
      '<div class="vs-wkbox"><div id="vsWk" role="status"></div><button type="button" class="vs-alerts" id="vsAlerts" aria-expanded="false">Phone alerts</button></div></nav><main class="vs-main" id="vsMain"><p class="p-loading">Loading…</p></main></div>';
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

  // ───── Word checks, before anything is narrated ─────
  // 1. Names, places and short forms the voice may say wrong: capitalised words in the middle of a sentence and
  //    all-caps short forms (ARV, LLC), minus ones already in Pronunciations and everyday words.
  // 2. Colloquial Arabic: the narration must be فصحى, so common spoken words are flagged with the فصحى word to use.
  const COMMON = new Set(('I Im Ive Id Ill Mr Mrs Ms Dr OK Okay Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December ' +
    'English Arabic America American US USA Google Zillow Facebook YouTube Excel Word PDF Module Lesson Step Part Chapter Section Rule Note Tip Example Yes No The A An And But Or So If When What Why How Who Where Which This That These Those ' +
    'He She We They You It Your My Our Their His Her Linda Amr Kyle Florida Texas Georgia California New York North South East West Street Road Avenue County City State Mom Dad God').split(' '));
  const AR_FIX = { 'ده':'هذا', 'دا':'هذا', 'دي':'هذه', 'دول':'هؤلاء', 'إزاي':'كيف', 'ازاي':'كيف', 'ليه':'لماذا', 'فين':'أين', 'إمتى':'متى', 'امتى':'متى', 'عايز':'يريد / أريد', 'عاوز':'يريد / أريد',
    'عايزة':'تريد', 'عاوزة':'تريد', 'عايزين':'يريدون', 'كده':'هكذا', 'كدا':'هكذا', 'بتاع':'الخاص بـ', 'بتاعة':'الخاصة بـ', 'بتاعك':'الخاص بك', 'بتاعي':'الخاص بي', 'مش':'ليس / لا', 'اللي':'الذي / التي / الذين',
    'إيه':'ماذا / ما', 'ايه':'ماذا / ما', 'علشان':'لأن / لكي', 'عشان':'لأن / لكي', 'لسه':'ما زال / لم بعد', 'دلوقتي':'الآن', 'دلوقت':'الآن', 'برضه':'أيضًا', 'برضو':'أيضًا', 'كمان':'أيضًا', 'أوي':'جدًا', 'اوي':'جدًا',
    'خالص':'إطلاقًا', 'حاجة':'شيء', 'حاجات':'أشياء', 'مفيش':'لا يوجد', 'مافيش':'لا يوجد', 'إحنا':'نحن', 'احنا':'نحن', 'إنتو':'أنتم', 'انتو':'أنتم', 'شوية':'قليلًا', 'كويس':'جيد', 'كويسة':'جيدة', 'زي':'مثل',
    'طب':'حسنًا', 'لازم':'يجب', 'يلا':'هيا', 'خلاص':'انتهى / إذن', 'ماشي':'حسنًا', 'بس':'لكن / فقط', 'هنعمل':'سنفعل', 'بنعمل':'نفعل', 'بيقول':'يقول', 'بتقول':'تقول', 'هيقول':'سيقول' };
  function checkWords(text, pron){
    const known = new Set((pron || []).map(p => String(p.written).toLowerCase()));
    const names = {}, ar = {};
    String(text || '').split(/(?<=[.!?؟:\n])\s+/).forEach(sentence => {
      const words = sentence.replace(/^\[[a-z_]+\]\s*/, '').match(/[A-Za-z][A-Za-z'’\-]*|[\u0600-\u06FF]+/g) || [];
      words.forEach((w, i) => {
        if (/[\u0600-\u06FF]/.test(w)) {
          const bare = w.replace(/[\u064B-\u0652]/g, ''), core = AR_FIX[bare] ? bare : /^[وف]/.test(bare) && AR_FIX[bare.slice(1)] ? bare.slice(1) : null;
          if (core) (ar[core] = ar[core] || { w:core, fix:AR_FIX[core], n:0 }).n++;
          return;
        }
        const clean = w.replace(/['’]s$/, '').replace(/['’\-]+$/, '');
        const acronym = /^[A-Z]{2,6}s?$/.test(clean), mid = i > 0 && /^[A-Z][a-z]/.test(clean);
        if (!acronym && !mid) return;
        if (COMMON.has(clean.replace(/['’]/g, '')) || known.has(clean.toLowerCase())) return;
        (names[clean] = names[clean] || { w:clean, n:0, acronym }).n++;
      });
    });
    return { names:Object.values(names).sort((a, b) => b.n - a.n), ar:Object.values(ar).sort((a, b) => b.n - a.n) };
  }
  // The list of what was found, with "Add how to say it" for names and the فصحى word for Arabic
  function showChecks(el, res, opts){
    let dismissed = []; try { dismissed = JSON.parse(localStorage.getItem('vsWordsOk') || '[]'); } catch(e) {}
    const names = res.names.filter(x => !dismissed.includes(x.w));
    if (!names.length && !res.ar.length) { el.innerHTML = '<p class="vs-note vs-okline">No unusual names and no colloquial Arabic found.</p>'; return 0; }
    el.innerHTML = (names.length ? '<div class="vs-sub">Names and short forms to check (' + names.length + ')</div><p class="vs-note">The voice guesses these. Add how to say any it might get wrong; it’s used everywhere from then on.</p>' +
        names.slice(0, 40).map(x => '<div class="vs-word" data-w="' + esc(x.w) + '"><b>' + esc(x.w) + '</b><small>' + (x.acronym ? 'short form · ' : '') + x.n + '×' + (x.where ? ' · ' + esc(x.where) : '') + '</small>' +
          '<span class="vs-btns"><label class="vs-sr" for="vsSay_' + esc(x.w) + '">Say ' + esc(x.w) + ' as</label><input class="vs-input vs-say" id="vsSay_' + esc(x.w) + '" placeholder="' + (x.acronym ? esc(x.w.split('').join(' ')) : 'Say it as') + '">' +
          '<button type="button" class="vs-btn" data-add>Add</button><button type="button" class="vs-link" data-fine>It’s fine</button></span></div>').join('') : '') +
      (res.ar.length ? '<div class="vs-sub">Colloquial Arabic (' + res.ar.length + ')</div><p class="vs-note">The narration is فصحى. Use the word on the right instead.</p><div class="vs-arlist" dir="rtl" lang="ar">' +
        res.ar.map(x => '<div class="vs-word"><b>' + esc(x.w) + '</b><span>← ' + esc(x.fix) + '</span><small>' + x.n + '×' + (x.where ? ' · ' + esc(x.where) : '') + '</small>' +
          (opts && opts.replace && x.fix.indexOf('/') < 0 ? '<button type="button" class="vs-link" data-fix="' + esc(x.w) + '">Replace</button>' : '') + '</div>').join('') + '</div>' : '');
    el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', async () => {
      const row = b.closest('.vs-word'), w = row.dataset.w, said = row.querySelector('.vs-say').value.trim();
      if (!said) { row.querySelector('.vs-say').focus(); return; }
      b.disabled = true;
      const r = await safe(db().from('voice_pronunciations').upsert({ written:w, spoken:said, language:'en' }, { onConflict:'owner,written,language' }));
      if (r.error) { b.disabled = false; b.textContent = 'Try again'; return; }
      row.innerHTML = '<b>' + esc(w) + '</b><small>said as “' + esc(said) + '” from now on</small>';
    }));
    el.querySelectorAll('[data-fine]').forEach(b => b.addEventListener('click', () => {
      const row = b.closest('.vs-word'); dismissed.push(row.dataset.w);
      try { localStorage.setItem('vsWordsOk', JSON.stringify(dismissed.slice(-500))); } catch(e) {}
      row.remove();
    }));
    el.querySelectorAll('[data-fix]').forEach(b => b.addEventListener('click', () => { opts.replace(b.dataset.fix, AR_FIX[b.dataset.fix]); b.closest('.vs-word').remove(); }));
    return names.length + res.ar.length;
  }
  const loadPron = async () => (await safe(db().from('voice_pronunciations').select('written,spoken,language'))).data || [];

  // ───── Versions of a lesson's narration ─────
  // The course plays content/<module>/narration/<lesson>.mp3 (+ .json captions). Before anything replaces them, they're
  // copied to narration/_versions/<lesson>/<time>.mp3/.json, so an earlier narration can be put back.
  const VER = (m, l) => 'content/' + m + '/narration/_versions/' + l + '/';
  async function saveVersion(m, l){
    const st = db().storage.from('course'), dir = 'content/' + m + '/narration/';
    const cur = await safe(st.list('content/' + m + '/narration', { limit:1000, search:l + '.' }));
    const mp3 = (cur.data || []).find(o => o.name === l + '.mp3'); if (!mp3) return true;   // nothing live yet
    const tag = new Date(mp3.updated_at || mp3.created_at || Date.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const have = await safe(st.list(VER(m, l).replace(/\/$/, ''), { limit:1000 }));
    if ((have.data || []).some(o => o.name === tag + '.mp3')) return true;   // already kept
    for (const ext of ['mp3', 'json']) {
      const r = await safe(st.copy(dir + l + '.' + ext, VER(m, l) + tag + '.' + ext));
      if (r.error && ext === 'mp3') return false;
    }
    return true;
  }
  async function versions(j, el, reopen){
    const m = j.target.module, l = j.target.lesson, st = db().storage.from('course');
    const r = await safe(st.list(VER(m, l).replace(/\/$/, ''), { limit:1000, sortBy:{ column:'name', order:'desc' } }));
    const list = (r.data || []).filter(o => /\.mp3$/.test(o.name));
    const when = n => { const p2 = n.replace(/\.mp3$/, '').split('-'); const d = new Date(Date.UTC(+p2[0], +p2[1] - 1, +p2[2], +p2[3], +p2[4])); return isNaN(d) ? n : fmtDay(d) + ' ' + fmtTime(d); };
    el.innerHTML = '<div class="vs-sub">Earlier narrations of ' + esc(lessonTitle(j)) + '</div>' + (list.length ? list.map(o =>
      '<div class="vs-piece"><span><b>' + esc(when(o.name)) + '</b><small>' + Math.round(((o.metadata && o.metadata.size) || 0) / 1e6 * 10) / 10 + ' MB</small></span><span class="vs-btns">' +
      '<button type="button" class="vs-btn" data-vplay="' + esc(o.name) + '">' + PLAY + 'Play</button><button type="button" class="vs-btn" data-vuse="' + esc(o.name) + '">Use this one</button></span></div>').join('') :
      '<p class="vs-note">None kept yet. From now on, the narration learners hear is kept here before a retake or “Narrate again” replaces it.</p>') +
      '<p class="vs-note vs-msg" role="status" data-vmsg></p>';
    const msg = t => { const m2 = el.querySelector('[data-vmsg]'); if (m2) m2.textContent = t; };
    el.querySelectorAll('[data-vplay]').forEach(b => b.addEventListener('click', () => play(el.closest('.vs-main') || el, VER(m, l) + b.dataset.vplay, 'course', b.closest('.vs-piece'))));
    el.querySelectorAll('[data-vuse]').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Yes, use it'; msg('Learners will hear this one. The one live now is kept here too, so you can switch back.'); return; }
      b.disabled = true; msg('Switching…');
      if (!(await saveVersion(m, l))) { b.disabled = false; msg('Couldn’t keep the current one, so nothing was changed. Try again.'); return; }
      const base = VER(m, l) + b.dataset.vuse.replace(/\.mp3$/, ''), dir = 'content/' + m + '/narration/' + l;
      let ok = true;
      for (const ext of ['mp3', 'json']) {
        await safe(st.remove([dir + '.' + ext]));
        const c = await safe(st.copy(base + '.' + ext, dir + '.' + ext));
        if (c.error && ext === 'mp3') ok = false;
      }
      if (!ok) { msg('Something went wrong. The live narration may be missing; use “Use this one” again on any version.'); b.disabled = false; return; }
      msg('Done. Learners hear this narration now. The lesson video still has the voice it was built with until it’s rebuilt.');
      setTimeout(reopen, 2500);
    }));
  }

  // Share: a private link to the MP3 that works for 7 days, copied for you to paste anywhere
  async function share(j, b){
    const p = j.output_mp3 || j.output_wav; if (!p) return;
    const r = await safe(db().storage.from('voice').createSignedUrl(p, 7 * 24 * 3600, { download:fileName(isLesson(j) ? 'Lesson ' + lessonTitle(j) : j.title, p.split('.').pop()) }));
    const u = r.data && r.data.signedUrl, was = b.textContent;
    if (!u) { b.textContent = 'Couldn’t make a link'; return; }
    let copied = false; try { await navigator.clipboard.writeText(u); copied = true; } catch(e) {}
    if (!copied) { window.prompt('Copy this link (works for 7 days):', u); return; }
    b.textContent = 'Link copied · 7 days'; setTimeout(() => { b.textContent = was; }, 4000);
  }

  // A zip of MP3s, made in the browser. MP3s are already compressed, so the files are stored as they are.
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files){   // files: [{ name, data:Uint8Array }]
    const enc = new TextEncoder(), parts = [], dir = []; let off = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    files.forEach(f => {
      const nm = enc.encode(f.name), c = crc32(f.data), n = f.data.length;
      const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(n), ...u32(n), ...u16(nm.length), ...u16(0)]);
      parts.push(local, nm, f.data);
      dir.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(n), ...u32(n), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += local.length + nm.length + n;
    });
    const size = dir.reduce((t, d) => t + d.length, 0);
    return new Blob(parts.concat(dir, [new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(size), ...u32(off), ...u16(0)])]), { type:'application/zip' });
  }
  async function moduleZip(m, ls, b){
    const done = ls.filter(j => j.status === 'done' && j.output_mp3); if (!done.length) return;
    b.disabled = true; const files = [];
    for (const j of done) {
      b.textContent = 'Getting ' + (files.length + 1) + ' of ' + done.length + '…';
      const u = await signedUrl(j.output_mp3); const buf = u && await fetch(u).then(x => x.ok ? x.arrayBuffer() : null).catch(() => null);
      if (buf) files.push({ name:fileName(lessonTitle(j), 'mp3'), data:new Uint8Array(buf) });
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(zip(files)); a.download = 'Module_' + String(m).replace(/^m/, '') + '_narration.zip';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    b.disabled = false; b.textContent = files.length === done.length ? 'Downloaded ' + files.length + ' MP3s' : 'Downloaded ' + files.length + ' of ' + done.length + ' (try again for the rest)';
  }

  // A narration's manifest (its lines with start times and checks), kept so opening a row twice doesn't fetch it twice
  const manCache = {};
  async function manifest(j){
    if (!j || !j.output_json) return null;
    if (manCache[j.id]) return manCache[j.id];
    const u = await signedUrl(j.output_json); const m = u && await fetch(u).then(x => x.json()).catch(() => null);
    if (m && m.pieces) manCache[j.id] = m;
    return m;
  }
  // Where one line sits in the audio: from its start to the next line's start (the end of the file for the last one)
  const span = (m, i) => { const ps = m.pieces, k = ps.findIndex(p => +p.i === +i); if (k < 0) return null; const nx = ps[k + 1]; return [ps[k].start || 0, nx ? nx.start : (ps[k].end || null)]; };
  // Play just that stretch of a narration. Resolves when it stops: { finished:true } when it reached the end of the
  // stretch, { finished:false } when it was paused or another Play took over (Play all uses this to know when to go on).
  async function playPart(main, path, from, to, near){
    await play(main, path, null, near);
    const a = near ? near.querySelector('audio.vs-live') : main.querySelector('audio.vs-live'); if (!a) return { finished:false };
    a.pause();
    return new Promise(resolve => {
      let started = false, over = false;
      const end = fin => { if (over) return; over = true; a.removeEventListener('timeupdate', stopAt); a.removeEventListener('pause', paused); a.removeEventListener('ended', ended); resolve({ finished:fin, a }); };
      const stopAt = () => { if (to && a.currentTime >= to + 0.1) { end(true); a.pause(); } };
      const paused = () => { if (started) end(a.ended); };
      const ended = () => end(true);
      const go = () => { try { a.currentTime = Math.max(0, from - 0.05); } catch(e) {} a.addEventListener('playing', () => { started = true; }, { once:true }); a.play().catch(() => end(false)); };
      a.addEventListener('timeupdate', stopAt); a.addEventListener('pause', paused); a.addEventListener('ended', ended);
      if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once:true });
    });
  }
  // Play a line, with a second before and after it when "Play with a second around each line" is on
  const ctxOn = () => { try { return localStorage.getItem('vsCtx') === '1'; } catch(e) { return false; } };
  function hearLine(j, m, i, near, main){
    const sp = span(m, i); if (!sp) return Promise.resolve({ finished:false });
    const pad = ctxOn() ? 1 : 0;
    return playPart(main, j.output_mp3 || j.output_wav, Math.max(0, sp[0] - pad), sp[1] != null ? sp[1] + pad : null, near);
  }

  // What Whisper heard next to the script, word by word: words it missed are struck through, words it added are underlined
  const normW = w => w.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
  function heardDiff(said, heard){
    const a = String(said || '').split(/\s+/).filter(Boolean), b = String(heard || '').split(/\s+/).filter(Boolean);
    const A = a.map(normW), B = b.map(normW), n = A.length, k = B.length;
    const L = Array.from({ length:n + 1 }, () => new Array(k + 1).fill(0));
    for (let x = n - 1; x >= 0; x--) for (let y = k - 1; y >= 0; y--) L[x][y] = A[x] === B[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
    const out = []; let x = 0, y = 0, diff = 0;
    while (x < n || y < k) {
      if (x < n && y < k && A[x] === B[y]) { out.push(esc(b[y])); x++; y++; }
      else if (x < n && (y >= k || L[x + 1][y] >= L[x][y + 1])) { if (A[x]) diff++; out.push('<del title="In the script, but not heard">' + esc(a[x]) + '</del>'); x++; }
      else { if (B[y]) diff++; out.push('<ins title="Heard, but not in the script">' + esc(b[y]) + '</ins>'); y++; }
    }
    return { html:out.join(' '), diff };
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
  // onlyFlagged is the Review screen: just the lines still to check, with Sounds fine, 3 takes, Play all and keyboard keys
  async function pieces(j, el, reopen, onlyFlagged){
    const m = await manifest(j);
    if (!m || !m.pieces) { el.innerHTML = empty('Couldn’t load the pieces.'); return; }
    const flagged = Array.isArray(j.needs_review) ? j.needs_review.map(Number) : null;
    const isFlag = p => flagged ? flagged.includes(+p.i) : !p.ok;
    const list = onlyFlagged ? m.pieces.filter(isFlag) : m.pieces;
    if (!list.length) { el.innerHTML = empty('Every line passed the word check.'); return; }
    const rv = !!onlyFlagged, main = el.closest('.vs-main') || el;
    el.innerHTML = (rv && list.length > 1 ? '<div class="vs-pbar"><button class="vs-btn" type="button" data-all>' + PLAY + 'Play all ' + list.length + '</button></div>' : '') +
      list.map(p => { const chk = isFlag(p), d = chk && p.heard != null ? heardDiff(p.text, p.heard) : null;
        return '<div class="vs-piece' + (chk ? ' is-check' : '') + '" data-i="' + (+p.i) + '" tabindex="-1"><span><small>#' + (+p.i) + ' · ' + mmss(p.start) + ' · ' + esc(MOOD_NAMES[p.mood] || p.mood) + (p.language === 'ar' ? ' · Arabic' : '') +
        (chk ? ' · ' + esc(p.reason || 'check this one') : '') + '</small>' + esc(p.text) +
        (d ? '<span class="vs-heard"' + (p.language === 'ar' ? ' dir="rtl" lang="ar"' : '') + '><em>Whisper heard</em> ' + (d.diff ? d.html : esc(p.heard) + ' <i>(every word)</i>') + '</span>' : '') + '</span>' +
        '<span class="vs-btns"><button class="vs-btn" type="button" data-hear="' + (+p.i) + '" aria-label="Play line ' + (+p.i) + '">' + PLAY + 'Play</button>' +
        (rv ? '<button class="vs-btn" type="button" data-fine="' + (+p.i) + '" aria-label="Line ' + (+p.i) + ' sounds fine">Sounds fine</button>' : '') +
        '<button class="vs-btn" type="button" data-redo="' + (+p.i) + '" aria-label="Retake line ' + (+p.i) + '">Retake</button>' +
        (rv ? '<button class="vs-btn" type="button" data-takes="' + (+p.i) + '" aria-label="Make 3 takes of line ' + (+p.i) + ' to pick from">3 takes</button>' : '') + '</span></div>'; }).join('');
    const cur = row => { main.querySelectorAll('.vs-piece.is-cur').forEach(x => x.classList.remove('is-cur')); if (row) row.classList.add('is-cur'); };
    el.querySelectorAll('[data-hear]').forEach(b => b.addEventListener('click', () => { const row = b.closest('.vs-piece'); cur(row); hearLine(j, m, b.dataset.hear, row, main); }));
    // Play all: the flagged lines one after another; stops when you pause or press Stop
    let seq = 0;
    const all = el.querySelector('[data-all]');
    if (all) all.addEventListener('click', async () => {
      if (all.dataset.on === '1') { seq++; main.querySelectorAll('audio.vs-live').forEach(a => a.pause()); return; }
      const me = ++seq; all.dataset.on = '1'; all.innerHTML = 'Stop';
      for (const row of [...el.querySelectorAll('.vs-piece')]) {
        if (me !== seq || !row.isConnected) break;
        cur(row); row.scrollIntoView({ block:'nearest' });
        const r = await hearLine(j, m, row.dataset.i, row, main);
        if (me !== seq || !r.finished) break;
        await new Promise(ok => setTimeout(ok, 500));
      }
      all.dataset.on = ''; all.innerHTML = PLAY + 'Play all ' + el.querySelectorAll('.vs-piece').length;
    });
    // Sounds fine: the line leaves the "to check" list without a retake
    el.querySelectorAll('[data-fine]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      const left = (j.needs_review || []).filter(x => +x !== +b.dataset.fine);
      const r = await safe(db().from('voice_jobs').update({ needs_review:left }).eq('id', j.id));
      if (r.error) { b.textContent = 'Try again'; b.disabled = false; return; }
      j.needs_review = left;
      const row = b.closest('.vs-piece'), next = row.nextElementSibling; row.remove();
      if (next && next.classList.contains('vs-piece')) cur(next);
      el.dispatchEvent(new CustomEvent('vs-lines', { bubbles:true, detail:{ id:j.id, left:left.length } }));
    }));
    // 3 takes: the same line made three times with a little less to a little more expressiveness, to pick the best.
    // They don't touch what learners hear until you pick one.
    el.querySelectorAll('[data-takes]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      const full = await safe(db().from('voice_jobs').select('text,language,mood,settings').eq('id', j.id).single());
      if (!full.data) { b.textContent = 'Try again'; b.disabled = false; return; }
      const i = +b.dataset.takes, base = Object.assign({ pace:50, pause:50 }, full.data.settings || {}), group = j.id.slice(0, 8) + '-' + i + '-' + Date.now().toString(36);
      const rows = TAKES.map((t, n) => ({ title:j.title.replace(/ \((piece|line) \d+ (redone|take [ABC])\)$/, '') + ' (line ' + i + ' take ' + t.k + ')',
        text:full.data.text, language:full.data.language, mood:full.data.mood, parent_id:j.id, redo_piece:i,
        target:Object.assign({}, j.target || {}, { mode:'take' }),
        settings:Object.assign({}, base, { feel:t.feel, seed:1000 + Math.floor(Math.random() * 9000) + n, take_group:group, take:t.k }) }));
      const r = await safe(db().from('voice_jobs').insert(rows));
      if (r.error) { b.textContent = 'Try again'; b.disabled = false; return; }
      b.textContent = 'Queued'; reopen();
    }));
    el.querySelectorAll('[data-redo]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      if (isLesson(j) && !(await saveVersion(j.target.module, j.target.lesson))) { b.textContent = 'Couldn’t keep the current one'; b.disabled = false; return; }
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
    const retakes = S.lessons.map(x => x.retake).filter(r => r && r.status === 'queued');
    const ahead = S.others.concat(S.waitingLessons, retakes).filter(x => x.status === 'queued' && quick(x) && x.created_at < j.created_at).length;
    return ahead ? ahead + ' job' + (ahead === 1 ? '' : 's') + ' ahead of it' : S.running ? 'next, after the narration being made now' : 'next in line';
  }
  const workerAtLeast = (wk, v) => { const p = String((wk && wk.version) || '0').split('.').map(n => +n || 0); return p[0] > v[0] || (p[0] === v[0] && (p[1] || 0) >= v[1]); };

  // Before and after a one-line retake: the same line from the version it was retaken from, then from the new one
  const isRetake = j => j && j.parent_id && j.redo_piece != null && j.status === 'done';
  const compareBtns = j => isRetake(j) ? '<button type="button" class="vs-btn" data-cmp="before" aria-label="Line ' + (+j.redo_piece) + ' before the retake">Before</button><button type="button" class="vs-btn" data-cmp="after" aria-label="Line ' + (+j.redo_piece) + ' after the retake">After</button>' : '';
  async function compare(main, S, j, which, near){
    let src = j;
    if (which === 'before') {
      src = S.all.find(x => x.id === j.parent_id);
      if (!src || !src.output_json) { const r = await safe(db().from('voice_jobs').select(JOB_COLS).eq('id', j.parent_id).maybeSingle()); src = r.data; }
    }
    const m = await manifest(src), sp = m && span(m, j.redo_piece);
    if (!sp) { near.insertAdjacentHTML('beforeend', '<p class="vs-note">The earlier version isn’t there anymore.</p>'); return; }
    playPart(main, src.output_mp3 || src.output_wav, sp[0], sp[1], near);
  }

  // Mood samples: one short clip per mood, made once on the PC, to hear a mood before picking it
  function sampleRow(S, moods){
    const missing = moods.filter(m => !S.moodSamples[m] || S.moodSamples[m].status === 'failed');
    const making = moods.some(m => S.moodSamples[m] && /queued|running/.test(S.moodSamples[m].status));
    return '<div class="vs-sub">Hear a mood</div><div class="vs-samples">' + moods.map(m => { const j = S.moodSamples[m], ok = j && j.status === 'done';
      return '<button type="button" class="vs-sample" data-sample="' + esc(m) + '"' + (ok ? '' : ' disabled') + ' aria-label="Hear the ' + esc(MOOD_NAMES[m] || m) + ' sample">' + PLAY + esc(MOOD_NAMES[m] || m) + '</button>'; }).join('') + '</div>' +
      (missing.length ? '<button type="button" class="vs-link vs-reset" data-mksamples="' + esc(missing.join(',')) + '"' + (making ? ' disabled' : '') + '>' + (making ? 'Making the samples on your PC…' : 'Make ' + (missing.length === moods.length ? 'the' : missing.length) + ' sample' + (missing.length === 1 ? '' : 's') + ' (about a minute)') + '</button>' : making ? '<p class="vs-note">Making the samples on your PC…</p>' : '');
  }
  function wireSamples(main, S, reopen){
    main.querySelectorAll('[data-sample]').forEach(b => b.addEventListener('click', () => { const j = S.moodSamples[b.dataset.sample]; if (j) play(main, j.output_mp3 || j.output_wav, null, b.closest('.vs-card')); }));
    main.querySelectorAll('[data-mksamples]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      const rows = b.dataset.mksamples.split(',').map(m => { const ar = m === 'teaching_ar';
        return { title:SAMPLE + m, text:ar ? SAMPLE_TEXT.ar : '[' + m + '] ' + SAMPLE_TEXT.en, language:ar ? 'ar' : 'en', mood:ar ? 'teaching' : m }; });
      const r = await safe(db().from('voice_jobs').insert(rows));
      if (r.error) { b.textContent = errText(r, 'Couldn’t start them. Try again.'); b.disabled = false; return; }
      reopen();
    }));
  }

  // ───── Review: every line the word check flagged, lessons and your own scripts in one place ─────
  // Keys (when you're not typing): J / K next and previous line, Space play it, F sounds fine, R twice retake it
  let reviewKeys = null;
  async function viewReview(main, S, reopen){
    const R = S.review, lines = R.reduce((t, j) => t + (j.needs_review || []).length, 0);
    const retakes = S.all.filter(j => isRetake(j) && !isTake(j)).sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1)).slice(0, 8);
    const name = j => isLesson(j) || (j.target && j.target.lesson) ? 'Lesson ' + lessonTitle(j).replace(/ \((piece|line) \d+ (redone|take [ABC])\)$/, '') : j.title.replace(/ \((piece|line) \d+ (redone|take [ABC])\)$/, '');
    // takes waiting for a pick, three to a line
    const groups = {};
    S.all.filter(isTake).forEach(t => { (groups[t.settings.take_group] = groups[t.settings.take_group] || []).push(t); });
    const open = Object.values(groups).filter(g => g.every(t => t.settings.picked === undefined)).map(g => g.sort((a, b) => (a.settings.take < b.settings.take ? -1 : 1)))
      .sort((a, b) => (a[0].created_at < b[0].created_at ? 1 : -1));
    const TAKE_NOTE = { A:'a little steadier', B:'about as tuned', C:'a little livelier' };
    const takeCard = g => { const t0 = g[0], done = g.filter(t => t.status === 'done').length, live = g.some(t => /queued|running/.test(t.status));
      return '<div class="vs-takes" data-group="' + esc(t0.settings.take_group) + '"><div class="vs-takeshead"><span><b>' + esc(name(t0)) + '</b> ' + chip('Line ' + (+t0.redo_piece)) + ' ' +
        (live ? chip(done + ' of ' + g.length + ' made', 'run') : chip('Pick one', 'ok')) + '</span><button type="button" class="vs-link" data-drop>Keep the original</button></div>' +
        '<div class="vs-piece"><span><b>Original</b><small>the line as it is now</small></span><span class="vs-btns"><button class="vs-btn" type="button" data-orig>' + PLAY + 'Play</button></span></div>' +
        g.map(t => '<div class="vs-piece" data-take="' + t.id + '"><span><b>Take ' + esc(t.settings.take) + '</b><small>' + esc(TAKE_NOTE[t.settings.take] || '') +
          (t.status === 'done' ? (t.needs_review || []).includes(+t.redo_piece) ? ' · the word check flagged this one too' : ' · passed the word check' : ' · ' + esc((STATUS[t.status] || [t.status])[0]) + (t.status === 'running' ? ' ' + Math.round((t.progress || 0) * 100) + '%' : '')) + '</small></span>' +
          '<span class="vs-btns">' + (t.status === 'done' ? '<button class="vs-btn" type="button" data-tplay>' + PLAY + 'Play</button><button class="vs-btn" type="button" data-tuse>Use take ' + esc(t.settings.take) + '</button>' : '') + '</span></div>').join('') +
        '<p class="vs-note vs-msg" role="status" data-tmsg></p></div>'; };
    let ctx = ctxOn();
    main.innerHTML = head('Review', lines ? lines + ' line' + (lines === 1 ? '' : 's') + ' to listen to, in ' + R.length + ' narration' + (R.length === 1 ? '' : 's') + '. Play a line, then mark it fine or retake it.' : 'Nothing to check. Every finished line passed the word check, or you marked it fine.') +
      '<div class="vs-revbar"><label class="vs-switch"><input type="checkbox" id="vsCtx"' + (ctx ? ' checked' : '') + '> Play a second before and after each line</label>' +
      '<span class="vs-note vs-keys">Keys: <kbd>J</kbd> <kbd>K</kbd> next / previous line · <kbd>Space</kbd> play · <kbd>F</kbd> sounds fine · <kbd>R</kbd> twice retake</span></div>' +
      (open.length ? '<section class="vs-card"><div class="vs-cardhead"><h2>Takes to pick</h2><span class="vs-note">Learners keep hearing the original until you pick a take</span></div>' + open.map(takeCard).join('') +
        (workerAtLeast(S.wk, SLIDER_VERSION) ? '' : '<p class="vs-note">The PC needs worker 0.4 or newer for the takes to sound different. Restart it after the current lesson.</p>') + '</section>' : '') +
      (R.length ? '<section class="vs-card">' + R.map(j => '<div class="vs-job" data-id="' + j.id + '"><span><b>' + esc(name(j)) + '</b> ' + chip(j.needs_review.length + ' to check', 'warn') +
        '<small>' + (j.target && j.target.module ? 'Module ' + esc(String(j.target.module).replace(/^m/, '')) + ' · ' : '') + esc(ago(j.finished_at || j.created_at)) + (j.duration_s ? ' · ' + mmss(j.duration_s) : '') + '</small></span>' +
        '<span class="vs-btns"><button type="button" class="vs-btn" data-act="lines" aria-expanded="false">Listen to the lines</button></span><div class="vs-jobmore" hidden></div></div>').join('') + '</section>' : '') +
      (retakes.length ? '<section class="vs-card"><div class="vs-cardhead"><h2>Recent retakes</h2><span class="vs-note">Hear the line before and after</span></div>' + retakes.map(j =>
        '<div class="vs-job" data-id="' + j.id + '"><span><b>' + esc(name(j)) + '</b><small>Line ' + (+j.redo_piece) + ' · ' + esc(ago(j.finished_at || j.created_at)) + '</small></span><span class="vs-btns">' + compareBtns(j) + '</span><div class="vs-jobmore" hidden></div></div>').join('') + '</section>' : '');

    $('vsCtx').addEventListener('change', ev => { try { localStorage.setItem('vsCtx', ev.target.checked ? '1' : '0'); } catch(e) {} });
    main.querySelectorAll('.vs-job').forEach(row => row.addEventListener('click', ev => {
      // only the row's own buttons; Play and Retake inside the opened lines have their own handlers and must not close the list
      const b = ev.target.closest('button[data-act], button[data-cmp]'); if (!b || b.closest('.vs-jobmore')) return;
      const j = S.all.find(x => x.id === row.dataset.id) || R.find(x => x.id === row.dataset.id); if (!j) return;
      const more = row.querySelector('.vs-jobmore');
      if (b.dataset.cmp) { more.hidden = false; compare(main, S, j, b.dataset.cmp, more); return; }
      if (!more.hidden && more.querySelector('.vs-piece')) { more.hidden = true; b.setAttribute('aria-expanded', 'false'); return; }
      more.hidden = false; b.setAttribute('aria-expanded', 'true'); more.innerHTML = '<p class="p-loading">Loading…</p>'; pieces(j, more, reopen, true);
    }));
    // a line marked fine: update its narration's count, and the badge in the menu
    if (main._vsLines) main.removeEventListener('vs-lines', main._vsLines);   // the screen can be redrawn into the same box
    main.addEventListener('vs-lines', main._vsLines = ev => {
      const row = main.querySelector('.vs-job[data-id="' + ev.detail.id + '"]'); if (!row) return;
      const c = row.querySelector('.vs-chip.is-warn');
      if (ev.detail.left) { if (c) c.textContent = ev.detail.left + ' to check'; return; }
      row.innerHTML = '<span><b>' + row.querySelector('b').innerHTML + '</b> ' + chip('All lines checked', 'ok') + '</span>';
      const badge = document.getElementById('vsRevN'); if (badge) { const n = Math.max(0, (+badge.textContent || 1) - 1); badge.textContent = n; badge.hidden = !n; }
    });
    // the takes
    main.querySelectorAll('.vs-takes').forEach(box2 => {
      const g = groups[box2.dataset.group], t0 = g[0], msg = t => { box2.querySelector('[data-tmsg]').textContent = t; };
      const parentOf = async () => S.all.find(x => x.id === t0.parent_id) || (await safe(db().from('voice_jobs').select(JOB_COLS).eq('id', t0.parent_id).maybeSingle())).data;
      box2.addEventListener('click', async ev => {
        const b = ev.target.closest('button'); if (!b) return;
        const row = b.closest('.vs-piece'), t = row && row.dataset.take ? g.find(x => x.id === row.dataset.take) : null;
        if (b.hasAttribute('data-orig') || b.hasAttribute('data-tplay')) {
          const src = t || await parentOf(), m = src && await manifest(src);
          if (!m) { msg('Couldn’t load that one.'); return; }
          main.querySelectorAll('.vs-piece.is-cur').forEach(x => x.classList.remove('is-cur')); row.classList.add('is-cur');
          hearLine(src, m, t0.redo_piece, row, main); return;
        }
        if (b.hasAttribute('data-drop')) {
          if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Yes, keep the original'; msg('The three takes are put away. The line stays as it is now.'); return; }
          b.disabled = true;
          for (const x of g) await safe(db().from('voice_jobs').update({ settings:Object.assign({}, x.settings, { picked:false }) }).eq('id', x.id));
          reopen(); return;
        }
        if (b.hasAttribute('data-tuse')) {
          if (b.dataset.sure !== '1') { box2.querySelectorAll('[data-tuse]').forEach(x => { x.dataset.sure = ''; x.textContent = 'Use take ' + g.find(y => y.id === x.closest('.vs-piece').dataset.take).settings.take; });
            b.dataset.sure = '1'; b.textContent = 'Yes, use take ' + t.settings.take;
            msg(t.target && t.target.lesson ? 'Learners will hear take ' + t.settings.take + '. The narration live now is kept in Versions, so you can switch back.' : 'Take ' + t.settings.take + ' becomes this script’s narration in History.'); return; }
          box2.querySelectorAll('button').forEach(x => { x.disabled = true; }); msg('Switching…');
          const err = await useTake(g, t, await parentOf());
          if (err) { msg(err); box2.querySelectorAll('button').forEach(x => { x.disabled = false; }); return; }
          msg(t.target && t.target.lesson ? 'Done. Learners hear take ' + t.settings.take + ' now. The lesson video keeps its old voice until it’s rebuilt.' : 'Done.');
          setTimeout(reopen, 2000);
        }
      });
    });
    // keys
    if (reviewKeys) document.removeEventListener('keydown', reviewKeys);
    let armed = null;
    reviewKeys = ev => {
      if (!document.body.contains(main) || !/^#voice\/review/.test(location.hash)) { document.removeEventListener('keydown', reviewKeys); reviewKeys = null; return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const t = ev.target; if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
      const k = ev.key.toLowerCase(), rows = [...main.querySelectorAll('.vs-piece')], at = rows.findIndex(r => r.classList.contains('is-cur'));
      const pick = r => { rows.forEach(x => x.classList.remove('is-cur')); if (r) { r.classList.add('is-cur'); r.scrollIntoView({ block:'nearest' }); } return r; };
      const hit = (r, sel) => { const b = r && r.querySelector(sel); if (b && !b.disabled) b.click(); };
      if (k === 'j' || k === 'k') {
        ev.preventDefault();
        if (!rows.length) { const b = main.querySelector('.vs-job [data-act="lines"]'); if (b) b.click(); return; }
        hit(pick(rows[Math.max(0, Math.min(rows.length - 1, at < 0 ? 0 : at + (k === 'j' ? 1 : -1)))]), '[data-hear], [data-orig], [data-tplay]');
      } else if (k === ' ' && at >= 0) { ev.preventDefault();
        const live = rows[at].querySelector('audio.vs-live');
        if (live && !live.paused) live.pause(); else hit(rows[at], '[data-hear], [data-orig], [data-tplay]');
      } else if (k === 'f' && at >= 0) { ev.preventDefault(); hit(rows[at], '[data-fine]');
      } else if (k === 'r' && at >= 0 && rows[at].querySelector('[data-redo]')) { ev.preventDefault();
        if (armed === rows[at]) { armed = null; hit(rows[at], '[data-redo]'); return; }
        armed = rows[at]; const small = rows[at].querySelector('small'); const was = small.innerHTML; small.innerHTML = '<b>Press R again to retake this line</b>';
        setTimeout(() => { if (armed === rows[at]) armed = null; if (small.isConnected) small.innerHTML = was; }, 2500);
      }
    };
    document.addEventListener('keydown', reviewKeys);
    return { live:open.some(g => g.some(t => /queued|running/.test(t.status))) };
  }

  // Use one of the 3 takes. For a lesson it becomes what learners hear: the take's MP3 replaces the live one (kept in
  // Versions first), and the caption and chapter times move with the line that changed length.
  function timeMap(pm, tm){
    const P = pm.pieces, Q = tm.pieces, pd = pm.duration_s || 0, qd = tm.duration_s || 0, qs = {};
    Q.forEach((q, n) => { qs[+q.i] = [q.start || 0, Q[n + 1] ? Q[n + 1].start : qd]; });
    return ms => { const t = ms / 1000; let k = -1;
      for (let n = 0; n < P.length; n++) { if ((P[n].start || 0) <= t + 1e-6) k = n; else break; }
      if (k < 0) return ms;
      const a = P[k].start || 0, b = P[k + 1] ? P[k + 1].start : pd, q = qs[+P[k].i]; if (!q) return ms;
      const f = b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 0;
      return Math.round((q[0] + f * (q[1] - q[0])) * 1000); };
  }
  async function useTake(g, t, parent){
    if (!parent) return 'Couldn’t find the narration these takes came from.';
    const tidy = parent.title.replace(/ \((piece|line) \d+ (redone|take [ABC])\)$/, '') + ' (piece ' + (+t.redo_piece) + ' redone)';
    if (t.target && t.target.lesson) {
      const m = t.target.module, l = t.target.lesson, st = db().storage.from('course'), dir = 'content/' + m + '/narration/' + l;
      const cu = await signedUrl(dir + '.json', null, 'course'), cur = cu && await fetch(cu, { cache:'no-store' }).then(x => x.json()).catch(() => null);
      if (!cur || !cur.narration || cur.narration.job !== parent.id) return 'The narration learners hear changed after these takes were made, so nothing was switched. Make new takes from the lesson as it is now.';
      const pm = await manifest(parent), tm = await manifest(t);
      if (!pm || !tm || pm.pieces.length !== tm.pieces.length) return 'Couldn’t line up the take with the lesson, so nothing was switched.';
      const au = await signedUrl(t.output_mp3), blob = au && await fetch(au).then(x => x.ok ? x.blob() : null).catch(() => null);
      if (!blob) return 'Couldn’t load the take’s audio, so nothing was switched. Try again.';
      if (!(await saveVersion(m, l))) return 'Couldn’t keep the current narration, so nothing was switched. Try again.';
      const map = timeMap(pm, tm), next = Object.assign({}, cur, { end:Math.round((tm.duration_s || 0) * 1000) || map(cur.end || 0), narration:Object.assign({}, cur.narration, { job:t.id }) });
      next.captions = {}; Object.keys(cur.captions || {}).forEach(k => { next.captions[k] = (cur.captions[k] || []).map(c => [map(c[0])].concat(c.slice(1))); });
      if (Array.isArray(cur.chapters)) next.chapters = cur.chapters.map(c => [map(c[0])].concat(c.slice(1)));
      const a = await safe(st.upload(dir + '.mp3', new Blob([blob], { type:'audio/mpeg' }), { upsert:true, contentType:'audio/mpeg', cacheControl:'60' }));
      if (a.error) return 'Couldn’t put the take live: ' + errText(a, 'try again') + '. Nothing was changed.';
      const b = await safe(st.upload(dir + '.json', new Blob([JSON.stringify(next)], { type:'application/json' }), { upsert:true, contentType:'application/json', cacheControl:'60' }));
      if (b.error) return 'The audio switched but the captions didn’t. Use “Use this one” in Versions to put the earlier one back, then try again.';
      // from now on the take is the lesson's narration, in Projects and everywhere else
      const r = await safe(db().from('voice_jobs').update({ title:tidy, target:Object.assign({}, t.target, { mode:'lesson' }), settings:Object.assign({}, t.settings, { picked:true }) }).eq('id', t.id));
      if (r.error) return 'Learners hear the take now, but Projects couldn’t be updated. Reload the page.';
    } else {
      const r = await safe(db().from('voice_jobs').update({ title:tidy, settings:Object.assign({}, t.settings, { picked:true }) }).eq('id', t.id));
      if (r.error) return 'Couldn’t save the pick. Try again.';
      await safe(db().from('voice_jobs').update({ needs_review:(parent.needs_review || []).filter(x => +x !== +t.redo_piece) }).eq('id', parent.id));
    }
    for (const x of g) if (x.id !== t.id) await safe(db().from('voice_jobs').update({ settings:Object.assign({}, x.settings, { picked:false }) }).eq('id', x.id));
    return null;
  }

  // ───── Text to Speech ─────
  async function viewTts(main, S, reopen){
    const moods = ((S.wk && S.wk.moods) || ['teaching']).filter(m => !/_ar$/.test(m)).sort((a, b) => (a === 'teaching' ? -1 : b === 'teaching' ? 1 : 0));
    const hasAr = !!(S.wk && (S.wk.moods || []).includes('teaching_ar'));
    const plain = S.others.filter(j => !isAB(j));
    const last = plain[0];
    let mood = 'teaching';
    const word = (k, v) => k === 'pause' ? (v === 50 ? 'As tuned' : (v < 50 ? 'Shorter, ' : 'Longer, ') + Math.round(50 + v) + '%') : k === 'pace' ? (v < 35 ? 'Calmer' : v > 65 ? 'Brisker' : 'Natural') : (v < 35 ? 'Steady' : v > 65 ? 'Lively' : 'Natural');
    const slider = (k, label) => '<label class="vs-slide" for="vsS_' + k + '"><span>' + esc(label) + '</span><span class="vs-val" id="vsV_' + k + '">' + esc(word(k, tune[k])) + '</span></label>' +
      '<input type="range" class="vs-range" id="vsS_' + k + '" data-k="' + k + '" min="0" max="100" step="5" value="' + tune[k] + '" aria-valuetext="' + esc(word(k, tune[k])) + '">';

    main.innerHTML = '<div class="vs-split"><section class="vs-col" aria-labelledby="ttsH">' +
      head('Text to Speech', 'Type or paste a script. It’s read in your cloned voice, on your own PC.',
        (isAmr() ? '<a class="vs-btn" href="#voice/projects">Open a lesson</a>' : '') + '<label class="vs-btn vs-file">Upload .txt<input type="file" id="vsTxt" accept=".txt,text/plain"></label>').replace('<h1>', '<h1 id="ttsH">') +
      '<form class="vs-card vs-script" id="vsForm" novalidate><div class="vs-titlerow"><label for="vsTitle" class="vs-cap">Title</label><input type="text" id="vsTitle" class="vs-titlein" maxlength="120" placeholder="Optional, the first line is used if empty"></div><label for="vsText" class="vs-cap">Script</label>' +
      '<textarea id="vsText" rows="12" maxlength="200000" placeholder="Paste the script. A blank line starts a new paragraph. Start a paragraph with a mood tag like [warm] to change the mood. English and Arabic can be mixed."></textarea>' +
      '<div class="vs-bar"><span id="vsEst" class="vs-note" role="status">Free, no credits</span><span class="vs-btns">' +
      '<button type="button" class="vs-btn vs-sheetbtn" id="vsSheetBtn" aria-controls="vsSide" aria-expanded="false">' + icon('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', 16) + '<span id="vsSheetSum">' + esc(MOOD_NAMES[mood]) + '</span></button>' +
      '<label class="vs-sr" for="vsTag">Insert mood tag</label><select id="vsTag" class="vs-btn vs-select"><option value="">Insert mood tag</option>' + moods.map(m => opt(m, MOOD_NAMES[m] || m)).join('') + '</select>' +
      '<button type="button" class="vs-btn" id="vsCheck">Check words</button><button class="vs-go" type="submit">' + PLAY + 'Generate</button></span></div><p class="vs-note vs-msg" id="vsMsg" role="status"></p>' +
      '<div class="vs-checks" id="vsChecks" hidden></div></form>' +
      '<section class="vs-card" aria-labelledby="takeH"><div class="vs-cardhead"><h2 id="takeH">Latest take</h2><span class="vs-links" id="vsDl"></span></div><div id="vsTake"></div></section>' +
      '</section><aside class="vs-side" id="vsSide" aria-label="Voice settings"><div class="vs-sheethead"><b>Voice and settings</b><button type="button" class="vs-btn" id="vsSheetClose">Done</button></div>' +
      box('Voice', '<div class="vs-voice"><span class="vs-avatar" aria-hidden="true">AA</span><span><b>Amr · cloned voice</b><small>English' + (hasAr ? ' and Arabic (فصحى)' : '') + '</small></span><a href="#voice/voices">Change</a></div>' +
        '<div class="vs-sub" id="moodL">Mood</div><div class="vs-moods" role="group" aria-labelledby="moodL">' +
        moods.map(m => '<button type="button" class="vs-mood" data-mood="' + esc(m) + '" aria-pressed="' + (m === mood) + '">' + esc(MOOD_NAMES[m] || m) + '</button>').join('') + '</div>' +
        sampleRow(S, moods.concat(hasAr ? ['teaching_ar'] : [])) +
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
      dl.innerHTML = (last.output_mp3 ? '<button type="button" class="vs-link" data-dl="mp3">Download MP3</button>' : '') + (last.output_wav ? '<button type="button" class="vs-link" data-dl="wav">Download WAV</button>' : '') + '<button type="button" class="vs-link" id="vsShareLast">Share</button>';
      $('vsShareLast').addEventListener('click', ev => share(last, ev.currentTarget));
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
      say('vsSheetSum', MOOD_NAMES[mood] || mood);
    }));
    wireSamples(main, S, reopen);
    const side = $('vsSide'), sb = $('vsSheetBtn');
    const sheet = open => { side.classList.toggle('is-open', open); sb.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('vs-noscroll', open); if (open) $('vsSheetClose').focus(); else sb.focus(); };
    sb.addEventListener('click', () => sheet(true));
    $('vsSheetClose').addEventListener('click', () => sheet(false));
    side.addEventListener('keydown', ev => { if (ev.key === 'Escape' && side.classList.contains('is-open')) sheet(false); });
    main.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => {
      const j = plain.find(x => x.id === b.dataset.play); if (j) play(main, j.output_mp3 || j.output_wav, null, b.closest('.vs-card'));
    }));
    // Check words: on the button, and once before the first Generate of a script (Generate again goes ahead)
    let checkedText = null;
    const runCheck = async () => {
      const box2 = $('vsChecks'); box2.hidden = false; box2.innerHTML = '<p class="p-loading">Checking…</p>';
      checkedText = text.value.trim();
      return showChecks(box2, checkWords(text.value, await loadPron()), { replace:(w, fix) => {
        text.value = text.value.replace(new RegExp('(^|[\\s،.؟!])([وف]?)' + w + '(?=$|[\\s،.؟!])', 'g'), '$1$2' + fix); est();
      } });
    };
    $('vsCheck').addEventListener('click', () => { if (text.value.trim()) runCheck(); else say('vsMsg', 'Type or paste a script first.'); });
    $('vsForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const t = text.value.trim();
      if (!t) return say('vsMsg', 'Type or paste a script first.');
      if (checkedText !== t) { const found = await runCheck(); if (found) return say('vsMsg', 'Have a look at the words below first. Press Generate again to go ahead as it is.'); }
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
  let putting = false, liveArmed = '';   // a Put live is running / waiting for its second click (the page won't redraw meanwhile)
  async function putLive(m, lessons, staged, report){
    if (putting) return 0;
    putting = true; stagedCache.at = 0;
    try {
      const st = db().storage.from('course'), base = 'content/' + m + '/videos/';
      const live = await safe(st.list('content/' + m + '/videos', { limit:1000 }));
      if (live.error) { report('Couldn’t read the live videos. Nothing was changed.'); return 0; }
      const have = new Set((live.data || []).map(o => o.name)), stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      let ok = 0; const bad = [], skipped = [];
      for (const id of lessons) {
        const names = staged.files[m + '/' + id] || [];
        // a new video only goes live with its own captions; a missing .json means the PC is still saving it
        if (!names.includes(id + '.mp4') || !names.includes(id + '.json')) { skipped.push(id); continue; }
        const done = [];
        const mv = async (from, to) => { const r = await safe(st.move(from, to)); if (r.error) throw r.error; done.push([from, to]); };
        try {
          // the whole lesson moves as one: old video, captions and cover aside, then the new ones in
          for (const ext of ['mp4', 'json', 'jpg']) { const n = id + '.' + ext; if (have.has(n) && (ext !== 'jpg' || names.includes(n))) await mv(base + n, base + '_old/' + stamp + '/' + n); }
          for (const n of names) await mv(base + '_new/' + n, base + n);
          ok++;
        } catch(e) {
          for (const [from, to] of done.reverse()) await safe(st.move(to, from));   // put everything back as it was
          bad.push(id);
        }
        report('Putting ' + 'Module ' + m.replace(/^m/, '') + ' live · ' + (ok + bad.length + skipped.length) + ' of ' + lessons.length);
      }
      report(ok + ' video' + (ok === 1 ? '' : 's') + ' live in Module ' + m.replace(/^m/, '') +
        (bad.length ? ' · ' + bad.join(', ') + ' didn’t work and were left as they were, try again' : '') +
        (skipped.length ? ' · ' + skipped.join(', ') + ' skipped (captions not saved yet)' : '') +
        (ok ? '. The old ones are kept in videos/_old/' + stamp + '.' : '.'));
      return ok;
    } finally { putting = false; stagedCache.at = 0; }
  }

  const cancelJob = async (id, b) => {
    const r = await safe(db().from('voice_jobs').update({ status:'cancelled', message:'Cancelled' }).eq('id', id).in('status', ['queued', 'running']));
    if (r.error && b) { b.textContent = errText(r, 'Couldn’t cancel'); b.disabled = false; return false; }
    return true;
  };

  // ───── Projects: the real estate course batch ─────
  let projFind = '', projFilter = 'all'; const projOpen = {};   // kept while you move between screens and on refresh
  async function viewProjects(main, S, reopen){
    const L = S.lessons;
    const staged = await stagedVideos([...new Set(L.map(j => j.target.module))]);
    const vid = j => staged[j.target.module + '/' + j.target.lesson];
    const narrated = L.filter(j => j.status === 'done'), audio = narrated.reduce((s, j) => s + (j.duration_s || 0), 0);
    const ready = L.filter(vid).length;
    const stat = (label, value, sub) => '<div class="vs-stat"><span class="vs-cap">' + esc(label) + '</span><b>' + esc(value) + '</b><small>' + esc(sub) + '</small></div>';
    const state = j => j.status === 'running' ? chip('Narrating · ' + Math.round((j.progress || 0) * 100) + '%', 'run') : j.status === 'done' ? chip((j.needs_review || []).length ? 'Narrated · ' + j.needs_review.length + ' to check' : 'Narrated', (j.needs_review || []).length ? 'warn' : 'ok') :
      j.status === 'queued' ? (firstUp && (j.id === firstUp.id) ? chip('Next', 'run') : chip('In queue')) : chip((STATUS[j.status] || [j.status])[0], j.status === 'failed' ? 'bad' : '');
    const retake = r => r ? ' ' + chip(r.status === 'running' ? 'Retake running' : r.status === 'queued' ? 'Retake waiting' : r.status === 'failed' ? 'Retake failed' : 'Retake ' + r.status, r.status === 'failed' ? 'bad' : '') : '';
    const video = j => vid(j) ? chip('Ready for review', 'ok') : j.status === 'done' ? chip('Not built yet') : chip('Waits for voice');
    const live = j => j.status === 'queued' || j.status === 'running';
    const name = j => esc('lesson ' + lessonTitle(j));

    const modName = m => 'Module ' + String(m).replace(/^m/, '');
    const modNum = m => +String(m).replace(/\D/g, '') || 0;
    const queuedMods = [...new Set(S.waitingLessons.map(j => j.target.module))].sort((a, b) => modNum(a) - modNum(b));
    const firstUp = S.lessons.filter(j => j.retake && j.retake.status === 'queued').map(j => j.retake).concat(S.waitingLessons).sort((a, b) => (quick(b) - quick(a)) || ((b.priority || 0) - (a.priority || 0)) || (a.created_at < b.created_at ? -1 : 1))[0];
    const fullSet = j => { const f = staged.files[j.target.module + '/' + j.target.lesson] || []; return f.includes(j.target.lesson + '.mp4') && f.includes(j.target.lesson + '.json'); };
    const liveMods = {}; L.forEach(j => { if (vid(j) && fullSet(j)) (liveMods[j.target.module] = liveMods[j.target.module] || []).push(j.target.lesson); });
    const liveList = Object.keys(liveMods).sort((a, b) => modNum(a) - modNum(b));
    const tools = '<div class="vs-card vs-ops">' +
      '<div class="vs-op"><label class="vs-sub" for="vsFront">Narrate next</label><div class="vs-btns"><select id="vsFront" class="vs-input vs-narrow">' +
        (queuedMods.length ? queuedMods.map(m => opt(m, modName(m) + ' · ' + S.waitingLessons.filter(j => j.target.module === m).length + ' waiting', firstUp && firstUp.target.module === m)).join('') : '<option value="">Nothing waiting</option>') +
        '</select><button type="button" class="vs-btn" id="vsFrontGo"' + (queuedMods.length ? '' : ' disabled') + '>Move to the front</button></div>' +
        '<p class="vs-note" id="vsFrontMsg" role="status">' + (firstUp ? 'Next lesson: ' + esc(lessonTitle(firstUp)) + ' (' + esc(modName(firstUp.target.module)) + ')' : '') + '</p></div>' +
      '<div class="vs-op"><label class="vs-sub" for="vsLive">Put new videos live</label><div class="vs-btns"><select id="vsLive" class="vs-input vs-narrow">' +
        (liveList.length ? liveList.map(m => opt(m, modName(m) + ' · ' + liveMods[m].length + ' ready')).join('') : '<option value="">No new videos yet</option>') +
        '</select><button type="button" class="vs-go" id="vsLiveGo"' + (liveList.length ? '' : ' disabled') + '>Put live</button></div>' +
        '<p class="vs-note" id="vsLiveMsg" role="status">Learners see the new videos right away. The old ones are kept, so a module can be put back.</p></div>' +
      '<div class="vs-op vs-opwide"><span class="vs-sub">Check words before they’re narrated</span><div class="vs-btns"><button type="button" class="vs-btn" id="vsWordsGo"' + (S.waitingLessons.length ? '' : ' disabled') + '>Check the ' + S.waitingLessons.length + ' waiting lessons</button></div>' +
        '<div class="vs-checks" id="vsWords" hidden></div></div></div>';

    const rate = S.set && S.set.usd_per_1k_credits != null ? +S.set.usd_per_1k_credits : 0, sv = S.saved;
    const savedStat = () => '<div class="vs-stat"><span class="vs-cap">Credits saved</span><b>' + esc(sv ? short(sv.chars_all) : '·') + '</b><small>' +
      (sv && rate ? 'about ' + esc(usd(sv.chars_all, rate)) + ' at your ElevenLabs price · ' : 'ElevenLabs credits not spent · ') +
      '<button type="button" class="vs-link vs-inline" id="vsRateBtn">' + (rate ? 'Change price' : 'Add your price') + '</button></small>' +
      '<form id="vsRate" class="vs-rate" hidden novalidate><label class="vs-sub" for="vsRateIn">US dollars per 1,000 credits on your plan</label><div class="vs-btns"><input type="number" min="0" step="0.01" id="vsRateIn" class="vs-input vs-narrow" value="' + (rate || '') + '" placeholder="0.30"><button class="vs-btn" type="submit">Save</button></div><p class="vs-note vs-msg" id="vsRateMsg" role="status"></p></form></div>';
    const todayCard = S.today.lessons || S.today.scripts || S.today.failed ? '<section class="vs-card vs-today"><span class="vs-cap">Today</span><p><b>' + S.today.lessons + ' lesson' + (S.today.lessons === 1 ? '' : 's') + '</b> narrated' +
        (S.today.scripts ? ', ' + S.today.scripts + ' script' + (S.today.scripts === 1 ? '' : 's') : '') + (S.today.retakes ? ', ' + S.today.retakes + ' retake' + (S.today.retakes === 1 ? '' : 's') : '') +
        ' · ' + esc(hours(S.today.audio)) + ' of audio · PC busy ' + esc(hours(S.today.work)) + (S.today.failed ? ' · <span class="vs-badtext">' + S.today.failed + ' failed</span>' : '') + (S.eta ? ' · about ' + esc(hours(S.eta)) + ' left in the queue' : '') + (sv && sv.chars_today ? ' · ' + esc(short(sv.chars_today)) + ' credits saved' + (rate ? ' (' + esc(usd(sv.chars_today, rate)) + ')' : '') : '') + '</p></section>' : '';
    // the lesson groups: one fold per module, the one being narrated (or next) open
    const FILTERS = [['all', 'All'], ['check', 'To check'], ['waiting', 'Waiting'], ['failed', 'Failed'], ['video', 'Video ready']];
    const pass = (j, flt) => flt === 'check' ? j.status === 'done' && (j.needs_review || []).length : flt === 'waiting' ? live(j) : flt === 'failed' ? j.status === 'failed' || (j.retake && j.retake.status === 'failed') : flt === 'video' ? !!vid(j) : true;
    const count = flt => L.filter(j => pass(j, flt)).length;
    const mods = [...new Set(L.map(j => j.target.module))].sort((a, b) => modNum(a) - modNum(b));
    const openMod = (S.running && isLesson(S.running) && S.running.target.module) || (firstUp && firstUp.target.module) || mods[0];
    const row = j => '<tr data-id="' + j.id + '" data-q="' + esc((lessonTitle(j) + ' ' + modName(j.target.module)).toLowerCase()) + '"><td><b>' + esc(lessonTitle(j)) + '</b><small>' + (j.duration_s ? mmss(j.duration_s) : 'Not narrated yet') + '</small></td><td>' + state(j) + retake(j.retake) + '</td><td>' + video(j) + '</td>' +
      '<td class="vs-r">' + (j.status === 'done' ? '<button type="button" class="vs-link" data-act="play" aria-label="Play ' + name(j) + '">Play</button><button type="button" class="vs-link" data-act="pieces" aria-expanded="false" aria-label="Lines of ' + name(j) + '">Lines</button><button type="button" class="vs-link" data-act="share" aria-label="Copy a share link for ' + name(j) + '">Share</button><button type="button" class="vs-link" data-act="versions" aria-expanded="false" aria-label="Earlier narrations of ' + name(j) + '">Versions</button>' : '') +
      (isRetake(j) ? '<button type="button" class="vs-link" data-cmp="before" aria-label="Line ' + (+j.redo_piece) + ' before the retake">Before</button><button type="button" class="vs-link" data-cmp="after" aria-label="Line ' + (+j.redo_piece) + ' after the retake">After</button>' : '') +
      (vid(j) ? '<button type="button" class="vs-link" data-act="video" aria-label="Open the new video of ' + name(j) + '">Video</button>' : '') +
      (live(j) || (j.retake && live(j.retake)) ? '<button type="button" class="vs-link" data-act="cancel" aria-label="Cancel ' + (live(j) ? '' : 'the retake of ') + name(j) + '">Cancel' + (live(j) ? '' : ' retake') + '</button>' : '') + '</td></tr>' +
      '<tr class="vs-expand" hidden><td colspan="4"><div></div></td></tr>';
    const group = m => { const ls = L.filter(j => j.target.module === m), n = ls.filter(j => j.status === 'done').length, pc = Math.round(n / ls.length * 100), chk = ls.filter(j => pass(j, 'check')).length;
      return '<details class="vs-mod" data-mod="' + esc(m) + '"' + (m === projOpen[m] || (projOpen[m] === undefined && m === openMod) ? ' open' : '') + '><summary><span class="vs-modname">' + esc(modName(m)) + '</span>' +
        '<span class="vs-modbar" aria-hidden="true"><i style="width:' + pc + '%"></i></span><span class="vs-modn">' + n + ' / ' + ls.length + '</span>' + (chk ? chip(chk + ' to check', 'warn') : '') + '</summary>' +
        (n ? '<div class="vs-modtools"><button type="button" class="vs-link" data-zip="' + esc(m) + '">Download ' + n + ' MP3' + (n === 1 ? '' : 's') + ' as a zip</button></div>' : '') +
        '<div class="vs-tablewrap"><table class="vs-table"><caption class="vs-sr">' + esc(modName(m)) + ' lessons</caption><thead><tr><th scope="col">Lesson</th><th scope="col">Voice</th><th scope="col">Video</th><th scope="col" class="vs-r">Actions</th></tr></thead><tbody>' +
        ls.map(row).join('') + '</tbody></table></div></details>'; };

    main.innerHTML = head('Acquisitions Playbook', narrated.length + ' of ' + L.length + ' lessons narrated' + (S.eta ? ' · about ' + hours(S.eta) + ' to go' : '') + (sv ? ' · ' + short(sv.chars_all) + ' ElevenLabs credits saved' : ''), '<a class="vs-btn" href="/course/">Open the course</a>') + todayCard + tools +
      '<div class="vs-stats">' + stat('Narrated', narrated.length + ' / ' + L.length, S.eta ? 'about ' + hours(S.eta) + ' to go' : S.waitingLessons.length + ' waiting') +
      stat('Audio made', hours(audio), 'of finished narration') + stat('Videos ready', String(ready), 'waiting for your review') + savedStat() + '</div>' +
      '<div class="vs-findbar"><label class="vs-sr" for="vsFind">Find a lesson</label><input type="search" id="vsFind" class="vs-input vs-find" placeholder="Find a lesson, like 4.4 or discovery" value="' + esc(projFind) + '">' +
      '<div class="vs-filters" role="group" aria-label="Show">' + FILTERS.map(x => '<button type="button" class="vs-filter" data-f="' + x[0] + '" aria-pressed="' + (projFilter === x[0]) + '">' + x[1] + ' <span>' + count(x[0]) + '</span></button>').join('') + '</div></div>' +
      (L.length ? '<div class="vs-mods" id="vsMods">' + mods.map(group).join('') + '</div><p class="vs-note" id="vsNone" hidden>No lessons match.</p>' : '<section class="vs-card">' + empty('No lessons sent yet. Use “Narrate the lessons not done yet” on a module page in the course.') + '</section>');

    // search and filter hide rows (and modules with nothing left) without a redraw
    const applyFind = () => {
      const q = projFind.trim().toLowerCase(); let any = false;
      main.querySelectorAll('.vs-mod').forEach(d => {
        let shown = 0;
        d.querySelectorAll('tr[data-id]').forEach(tr => { const j = L.find(x => x.id === tr.dataset.id), ok = pass(j, projFilter) && (!q || tr.dataset.q.includes(q)); tr.hidden = !ok; if (!ok) tr.nextElementSibling.hidden = true; if (ok) shown++; });
        d.hidden = !shown; if (shown && (q || projFilter !== 'all')) d.open = true; any = any || !!shown;
      });
      const none = $('vsNone'); if (none) none.hidden = any;
    };
    if ($('vsFind')) {
      $('vsFind').addEventListener('input', ev => { projFind = ev.target.value; applyFind(); });
      main.querySelectorAll('.vs-filter').forEach(b => b.addEventListener('click', () => { projFilter = b.dataset.f; main.querySelectorAll('.vs-filter').forEach(x => x.setAttribute('aria-pressed', String(x === b))); applyFind(); }));
      main.querySelectorAll('[data-zip]').forEach(b => b.addEventListener('click', () => moduleZip(b.dataset.zip, L.filter(j => j.target.module === b.dataset.zip), b)));
      main.querySelectorAll('.vs-mod').forEach(d => d.addEventListener('toggle', () => { projOpen[d.dataset.mod] = d.open ? d.dataset.mod : null; }));
      applyFind();
    }

    $('vsWordsGo').addEventListener('click', async ev => {
      const b = ev.currentTarget, out = $('vsWords'); b.disabled = true; out.hidden = false; out.innerHTML = '<p class="p-loading">Reading the waiting lessons…</p>';
      const [r, pron] = await Promise.all([safe(db().from('voice_jobs').select('id,title,text,target').eq('status', 'queued').eq('target->>mode', 'lesson').is('parent_id', null).limit(1000)), loadPron()]);
      b.disabled = false;
      if (r.error) { out.innerHTML = empty('Couldn’t read the lessons. Try again.'); return; }
      // one list for all of them, with the first lessons each word is in
      const names = {}, ar = {};
      (r.data || []).sort(byLesson).forEach(j => { const c = checkWords(j.text, pron), at = j.target.lesson;
        c.names.forEach(x => { const y = names[x.w] = names[x.w] || Object.assign({}, x, { n:0, at:[] }); y.n += x.n; if (y.at.length < 3) y.at.push(at); });
        c.ar.forEach(x => { const y = ar[x.w] = ar[x.w] || Object.assign({}, x, { n:0, at:[] }); y.n += x.n; if (y.at.length < 3) y.at.push(at); }); });
      const fin = o => Object.values(o).map(x => Object.assign(x, { where:'in ' + x.at.join(', ') + (x.at.length === 3 ? '…' : '') })).sort((a, b) => b.n - a.n);
      const n = showChecks(out, { names:fin(names), ar:fin(ar) });
      if (Object.keys(ar).length) out.insertAdjacentHTML('beforeend', '<p class="vs-note">Fix colloquial Arabic in the lesson text in the course, then send those lessons again.</p>');
      if (!n) out.insertAdjacentHTML('afterbegin', '');
    });
    $('vsRateBtn').addEventListener('click', () => { const f2 = $('vsRate'); f2.hidden = !f2.hidden; if (!f2.hidden) $('vsRateIn').focus(); });
    $('vsRate').addEventListener('submit', async ev => {
      ev.preventDefault(); const v = $('vsRateIn').value.trim(), n = v === '' ? null : +v;
      if (n != null && !(n >= 0)) return say('vsRateMsg', 'Type a number, like 0.30.');
      const r = await safe(db().from('voice_settings').update({ usd_per_1k_credits:n, updated_at:new Date().toISOString() }).eq('id', 'main').select('id'));
      if (r.error || !(r.data || []).length) return say('vsRateMsg', r.error ? errText(r, 'Couldn’t save it.') : 'Not saved. Sign in again with your authenticator code.');
      reopen();
    });
    $('vsFrontGo').addEventListener('click', async ev => {
      const m = $('vsFront').value; if (!m) return;
      const top = Math.max(0, ...S.waitingLessons.map(j => j.priority || 0)) + 1;
      ev.target.disabled = true;
      const r = await safe(db().from('voice_jobs').update({ priority:top }).eq('status', 'queued').eq('target->>mode', 'lesson').eq('target->>module', m).select('id'));
      if (r.error || !(r.data || []).length) { ev.target.disabled = false; return say('vsFrontMsg', r.error ? errText(r, 'Couldn’t move it. Try again.') : 'Nothing was moved. Sign in again with your authenticator code and try again.'); }
      reopen();
    });
    liveArmed = '';
    $('vsLiveGo').addEventListener('click', async ev => {
      const m = $('vsLive').value, b = ev.target; if (!m || putting) return;
      if (liveArmed !== m) {   // two clicks: the first says exactly what will happen
        liveArmed = m; b.textContent = 'Yes, put ' + liveMods[m].length + ' live';
        say('vsLiveMsg', 'This replaces the videos learners see in ' + modName(m) + ' (' + liveMods[m].join(', ') + '). Click again to go ahead.');
        return;
      }
      b.disabled = true; b.textContent = 'Working…';
      await putLive(m, liveMods[m], staged, t => say('vsLiveMsg', t));
      liveArmed = ''; b.textContent = 'Put live'; b.disabled = false;
      setTimeout(() => { if (document.body.contains(main) && !putting) reopen(); }, 4000);
    });
    $('vsLive').addEventListener('change', () => { liveArmed = ''; $('vsLiveGo').textContent = 'Put live'; });

    main.querySelectorAll('tbody').forEach(tb => tb.addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-act], button[data-cmp]'); if (!b) return;
      const row = b.closest('tr'), j = L.find(x => x.id === row.dataset.id); if (!j) return;
      const more = row.nextElementSibling, cell = more.querySelector('div');
      if (b.dataset.cmp) { more.hidden = false; if (!cell.querySelector('.vs-piece')) cell.innerHTML = ''; compare(main, S, j, b.dataset.cmp, cell); return; }
      if (b.dataset.act === 'play') { more.hidden = false; if (!cell.querySelector('.vs-piece')) cell.innerHTML = ''; play(main, j.output_mp3 || j.output_wav, null, cell); }
      else if (b.dataset.act === 'pieces') {
        if (!more.hidden && cell.querySelector('.vs-piece')) { more.hidden = true; b.setAttribute('aria-expanded', 'false'); return; }
        more.hidden = false; b.setAttribute('aria-expanded', 'true'); cell.innerHTML = '<p class="p-loading">Loading…</p>'; pieces(j, cell, reopen);
      }
      else if (b.dataset.act === 'share') share(j, b);
      else if (b.dataset.act === 'versions') {
        if (!more.hidden && cell.querySelector('[data-vmsg]')) { more.hidden = true; b.setAttribute('aria-expanded', 'false'); return; }
        more.hidden = false; b.setAttribute('aria-expanded', 'true'); cell.innerHTML = '<p class="p-loading">Loading…</p>'; versions(j, cell, reopen);
      }
      else if (b.dataset.act === 'video') { const w = window.open('', '_blank'); const u = await signedUrl(vid(j), null, 'course'); if (u && w) w.location = u; else if (w) w.close(); }
      else if (b.dataset.act === 'cancel') { b.disabled = true; if (await cancelJob(live(j) ? j.id : j.retake.id, b)) reopen(); }
    }));
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
        sampleRow(S, moods) + '<p class="vs-note">Adding a new voice from a recording comes in a later round.</p>') +
      '<section class="vs-card" aria-labelledby="abH"><div class="vs-cardhead"><h2 id="abH">Blind test</h2><span class="vs-note">your voice vs ElevenLabs</span></div>' +
      (tests.length ? tests.map(j => { const [label, kind] = STATUS[j.status] || [j.status, '']; return '<div class="vs-job" data-id="' + j.id + '"><span><b>' + esc(j.title) + '</b> ' + chip(label, kind) + '<small>' + esc(ago(j.created_at)) + '</small></span>' +
        (j.status === 'done' ? '<button type="button" class="vs-btn" data-act="ab" aria-expanded="false">Take the blind test</button>' : '') +
        (j.status === 'queued' || j.status === 'running' ? '<button type="button" class="vs-btn" data-act="cancel" aria-label="Cancel ' + esc(j.title) + '">Cancel</button>' : '') + '<div class="vs-jobmore" hidden></div></div>'; }).join('') : '') +
      '<form class="vs-form" id="vsAb" novalidate><p class="vs-note">Upload a voice-only ElevenLabs narration (at least a minute). Your PC makes the same sentences in your voice, then you listen to the pairs without knowing which is which.</p>' +
      '<label class="vs-sub" for="vsAbFile">ElevenLabs file (MP3 or WAV)</label><input type="file" id="vsAbFile" accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav">' +
      '<button class="vs-go" type="submit">Make the blind test</button><p class="vs-note" id="vsAbMsg" role="status"></p></form></section>';

    wireSamples(main, S, reopen);
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
    const jobs = S.others.filter(j => !isAB(j) && !(isTake(j) && j.settings.picked === false));   // takes you didn't pick are put away
    main.innerHTML = head('History', 'Your narrations, newest first. Course lessons are in Projects.') +
      '<section class="vs-card">' + (jobs.length ? jobs.map(j => {
        const [label, kind] = STATUS[j.status] || [j.status, ''], live = j.status === 'queued' || j.status === 'running', checks = (j.needs_review || []).length;
        return '<div class="vs-job" data-id="' + j.id + '"><span><b>' + esc(j.title) + '</b> ' + chip(label, kind) + (checks ? ' ' + chip(checks + ' to check', 'warn') : '') +
          '<small>' + esc(ago(j.created_at)) + (j.duration_s ? ' · ' + mmss(j.duration_s) : '') + (j.mood ? ' · ' + esc(MOOD_NAMES[j.mood] || j.mood) : '') + (j.redo_piece != null ? ' · piece ' + j.redo_piece + ' redone' : '') + (j.settings ? ' · own settings' : '') +
          (lineSpot(S, j) ? ' · ' + esc(lineSpot(S, j)) : '') + (j.message && j.status !== 'done' && j.status !== 'queued' ? ' · ' + esc(j.message) : '') + '</small>' +
          (j.status === 'running' ? bar(Math.round((j.progress || 0) * 100), 100) : '') + '</span><span class="vs-btns">' +
          (j.status === 'done' ? '<button class="vs-btn" type="button" data-act="play" aria-label="Play ' + esc(j.title) + '">Play</button>' + (j.output_mp3 ? '<button class="vs-btn" type="button" data-act="mp3" aria-label="Download MP3 of ' + esc(j.title) + '">MP3</button>' : '') + (j.output_wav ? '<button class="vs-btn" type="button" data-act="wav" aria-label="Download WAV of ' + esc(j.title) + '">WAV</button>' : '') + '<button class="vs-btn" type="button" data-act="pieces" aria-expanded="false" aria-label="Lines of ' + esc(j.title) + '">Lines</button>' +
            '<button class="vs-btn" type="button" data-act="share" aria-label="Copy a share link for ' + esc(j.title) + '">Share</button>' : '') +
          compareBtns(j) + (live ? '<button class="vs-btn" type="button" data-act="cancel" aria-label="Cancel ' + esc(j.title) + '">Cancel</button>' : '') + '</span><div class="vs-jobmore" hidden></div></div>';
      }).join('') : empty('Nothing yet. Make one in Text to Speech.')) + '</section>';
    widths(main);
    main.querySelectorAll('.vs-job').forEach(row => row.addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-act], button[data-cmp]'); if (!b) return;
      const j = jobs.find(x => x.id === row.dataset.id); if (!j) return;
      const more = row.querySelector('.vs-jobmore');
      if (b.dataset.cmp) { more.hidden = false; if (!more.querySelector('.vs-piece')) more.innerHTML = ''; compare(main, S, j, b.dataset.cmp, more); return; }
      if (b.dataset.act === 'play') { more.hidden = false; if (!more.querySelector('.vs-piece')) more.innerHTML = ''; play(main, j.output_mp3 || j.output_wav, null, more); }
      else if (b.dataset.act === 'share') share(j, b);
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
      const r = await safe(db().from('voice_pronunciations').upsert({ written:w1, spoken:s1, language:$('vsPl').value }, { onConflict:'owner,written,language' }));
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
    [/rtx\s*20(50)/i, 4], [/mx\s*\d{3}/i, 2], [/gtx\s*16(60)/i, 6], [/gtx\s*16(50)/i, 4], [/gtx\s*10(80)/i, 8], [/gtx\s*10(70)/i, 8], [/gtx\s*10(60)/i, 6], [/gtx\s*1050\s*ti/i, 4], [/gtx\s*10(50)/i, 2],
    [/rtx\s*a?(2000)/i, 6], [/rtx\s*a?(4000)/i, 16], [/rtx\s*a?(5000)/i, 24], [/rtx\s*a?(6000)/i, 48]];
  const RATINGS = {
    rec:{ label:'Recommended', kind:'ok', speed:'About 2x real time: a 10-minute lesson takes about 20 to 25 minutes' },
    slow:{ label:'Works, but slow', kind:'warn', speed:'Roughly 4x to 8x real time: fine for short scripts' },
    no:{ label:'Not recommended', kind:'bad', speed:'Roughly 10x to 15x real time on the processor: short clips only' },
    unsure:{ label:'Can’t tell from the browser', kind:'warn', speed:'Fast with an NVIDIA card; roughly 10x to 15x real time without one' }};

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
    if (/or similar/i.test(d.gpu) && /nvidia|geforce/i.test(d.gpu)) { d.hidden = true; d.gpu = 'NVIDIA'; d.card = 'An NVIDIA card (the browser hides the model)'; }
    else if (/^WebKit WebGL$|or similar/i.test(d.gpu)) { d.hidden = true; d.gpu = ''; d.card = ''; }
    else if (/swiftshader|llvmpipe|software|basic render/i.test(d.gpu)) d.card = 'None shared (the browser is drawing in software)';
    else if (d.card === d.gpu) d.card = d.gpu.replace(/^ANGLE \(|\)$/g, '');
    return d;
  }

  function rate(d){
    const why = [];
    const nvidia = /nvidia|geforce|rtx|gtx|quadro/i.test(d.gpu), apple = /apple m\d/i.test(d.gpu) || (d.os === 'macOS' && /apple/i.test(d.gpu));
    const hit = nvidia && CARDS.find(c => c[0].test(d.gpu)), laptop = /laptop|mobile|max-q/i.test(d.gpu);
    let vram = hit ? hit[1] : 0;
    const LAPTOP = [[/rtx\s*30(50)/i, 4], [/rtx\s*30(60)/i, 6], [/rtx\s*30(70)/i, 8], [/rtx\s*30(80)/i, 8], [/rtx\s*40(70)/i, 8], [/rtx\s*40(80)/i, 12], [/rtx\s*40(90)/i, 16], [/rtx\s*50(70)/i, 8], [/rtx\s*50(80)/i, 16], [/rtx\s*50(90)/i, 24]];
    if (hit && laptop) { const l = LAPTOP.find(x => x[0].test(d.gpu)); if (l) vram = l[1]; }   // laptop versions have less
    if (d.mobile) return { r:'no', vram, why:['This is a phone or tablet. The voice app needs a Windows PC or a Mac.'] };
    if (!d.gpu) why.push('Your browser didn’t share the graphics card' + (d.hidden ? ' (it gave a stand-in name)' : '') + ', so this is a guess. The app checks it exactly after install.');
    if (d.bits === '32-bit') return { r:'no', vram, why:why.concat('32-bit system; the voice app needs 64-bit.') };
    if (d.ram && d.ram < 8) return { r:'no', vram, why:why.concat('Less than 8 GB of memory (16 GB recommended).') };
    if (nvidia && vram >= 6) return { r:d.os.indexOf('Windows') === 0 ? 'rec' : 'slow', vram, why:why.concat('NVIDIA card with about ' + vram + ' GB of graphics memory.', d.os.indexOf('Windows') === 0 ? 'Windows, like yukis-pc.' : 'The installer is Windows-first; other systems come later.') };
    if (nvidia && vram && vram < 4) return { r:'no', vram, why:why.concat('NVIDIA card with about ' + vram + ' GB of graphics memory; at least 4 GB is needed.') };
    if (nvidia && vram) return { r:'slow', vram, why:why.concat('NVIDIA card with about ' + vram + ' GB of graphics memory; 6 GB or more is recommended.') };
    if (nvidia) return { r:'slow', vram, why:why.concat('An NVIDIA card this check doesn’t know yet. The worker measures it after install.') };
    if (apple) return { r:'slow', vram, why:why.concat('Apple Silicon Mac: it works, slower than an NVIDIA card. 16 GB of memory recommended.') };
    if (d.os.indexOf('Windows') === 0 && /intel|amd|radeon/i.test(d.gpu)) return { r:'unsure', vram, why:why.concat('The browser is using ' + d.card + '. Many laptops also have a separate NVIDIA card that browsers don’t show. If yours does, it likely works; the app checks for sure.') };
    if (!d.gpu) return { r:'unsure', vram, why };
    return { r:'no', vram, why:why.concat(d.gpu ? 'No NVIDIA or Apple Silicon graphics (' + d.card + '), so the voice would run on the processor.' : 'No graphics card could be found.') };
  }

  async function viewComputer(main, S, reopen){
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
      box(wkName(S.wk) + ', measured', pc ? '<div class="vs-chips">' + chip(pcRate ? RATINGS[pcRate].label : 'Not measured', pcRate ? RATINGS[pcRate].kind : '') + '</div>' +
        row('Graphics card', String(pc.gpu || '').replace(/^NVIDIA GeForce /, '')) + row('Speed', ratio ? 'About ' + ratio.toFixed(1) + 'x real time (from the finished lessons)' : 'Not enough lessons yet') +
        '<p class="vs-note">When other apps fill the graphics memory (NVIDIA Broadcast, Discord, browsers), narration can get about 10x slower. Close them for full speed.</p>' : empty(isAmr() ? 'The PC hasn’t connected yet.' : 'Your computer hasn’t connected yet. The Windows app comes in the next update.')) +
      (S.pauseReady ? '<section class="vs-card" aria-labelledby="hrsH"><h2 class="vs-cap" id="hrsH">Working hours</h2><div id="vsHrs" class="vs-hrs"></div></section>' : '') +
      '</aside></div>' +
      '<section class="vs-card vs-flush"><div class="vs-tablewrap"><table class="vs-table"><caption class="vs-sr">What each rating means</caption><thead><tr><th scope="col">Rating</th><th scope="col">Graphics card</th><th scope="col">Memory and disk</th><th scope="col">Expected speed</th></tr></thead><tbody>' +
      '<tr><td>' + chip('Recommended', 'ok') + '</td><td>NVIDIA with 6 GB or more (RTX 3050 6 GB, 3060, 4060 and up)</td><td>16 GB memory, 15 GB free disk, Windows 10 or 11, 64-bit</td><td>About 2x real time</td></tr>' +
      '<tr><td>' + chip('Works, but slow', 'warn') + '</td><td>NVIDIA with 4 GB; Apple Silicon Mac (M1 or newer) with 16 GB</td><td>16 GB memory, 15 GB free disk</td><td>Roughly 4x to 8x real time</td></tr>' +
      '<tr><td>' + chip('Not recommended', 'bad') + '</td><td>Intel or AMD graphics only, under 8 GB memory, or 32-bit</td><td>Any</td><td>Roughly 10x to 15x real time</td></tr>' +
      '</tbody></table></div></section>';
    if ($('vsHrs')) viewHours($('vsHrs'), S, reopen);
    return { live:false };
  }

  const VIEWS = { tts:viewTts, projects:viewProjects, review:viewReview, voices:viewVoices, history:viewHistory, pron:viewPron, computer:viewComputer };

  // ElevenLabs credits not spent: about 1 credit per character narrated on the PC
  const short = n => n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : String(n || 0);
  const usd = (chars, rate) => rate ? '$' + (chars / 1000 * rate).toLocaleString('en-US', chars / 1000 * rate < 100 ? { minimumFractionDigits:2, maximumFractionDigits:2 } : { maximumFractionDigits:0 }) : '';

  // Working hours, in Cairo time: outside them the course lessons wait (your own scripts still run)
  const cairoHour = () => +new Intl.DateTimeFormat('en-US', { timeZone:'Africa/Cairo', hour:'numeric', hourCycle:'h23' }).format(new Date()) % 24;
  const hourName = h => (h % 12 || 12) + ' ' + (h < 12 ? 'AM' : 'PM');
  function offHours(st){
    if (!st || !st.hours_on || st.hour_start === st.hour_end) return false;
    const h = cairoHour(), a = st.hour_start, b = st.hour_end;
    return !(a < b ? h >= a && h < b : h >= a || h < b);
  }
  async function viewHours(el, S, reopen){
    const st = S.set, hrs = Array.from({ length:24 }, (_, h) => h);
    const sel = (id, v) => '<select class="vs-input vs-narrow" id="' + id + '">' + hrs.map(h => opt(h, hourName(h), h === v)).join('') + '</select>';
    el.innerHTML = '<label class="vs-switch"><input type="checkbox" id="vsHrsOn"' + (st.hours_on ? ' checked' : '') + '> Only narrate course lessons during set hours</label>' +
      '<div class="vs-btns">From ' + sel('vsHrsA', st.hour_start == null ? 0 : st.hour_start) + ' to ' + sel('vsHrsB', st.hour_end == null ? 9 : st.hour_end) + '</div>' +
      '<p class="vs-note">Cairo time. Outside these hours the lesson queue waits, so the PC stays free while you work. Your own scripts, mood samples and retakes still run any time. A lesson already being made finishes first.</p>' +
      '<button type="button" class="vs-go" id="vsHrsSave">Save</button><p class="vs-note vs-msg" id="vsHrsMsg" role="status"></p>';
    $('vsHrsSave').addEventListener('click', async ev => {
      ev.target.disabled = true;
      const r = await safe(db().from('voice_settings').update({ hours_on:$('vsHrsOn').checked, hour_start:+$('vsHrsA').value, hour_end:+$('vsHrsB').value, updated_at:new Date().toISOString() }).eq('id', 'main').select('id'));
      ev.target.disabled = false;
      if (r.error || !(r.data || []).length) return say('vsHrsMsg', r.error ? errText(r, 'Couldn’t save it. Try again.') : 'Not saved. Sign in again with your authenticator code.');
      say('vsHrsMsg', 'Saved.'); setTimeout(reopen, 800);
    });
  }

  // Pause or resume the queue: the PC finishes what it's making and then claims nothing new
  async function setPause(on, b){
    b.disabled = true;
    const r = await safe(db().from('voice_settings').update({ paused:on, paused_at:on ? new Date().toISOString() : null, updated_at:new Date().toISOString() }).eq('id', 'main').select('id'));
    if (r.error || !(r.data || []).length) { b.disabled = false; b.textContent = r.error ? errText(r, 'Couldn’t change it') : 'Sign in again with your code'; return false; }
    return true;
  }
  // Phone alerts: the portal's own "Allow alerts on this phone" (Settings › Phone alerts), plus Voice Studio's switch.
  // Alerts come from the database when a job finishes, so they arrive with the portal closed.
  async function alertsPanel(main, S, reopen){
    let p = main.querySelector('#vsPhone');
    if (p) { p.remove(); return false; }
    main.insertAdjacentHTML('afterbegin', '<section class="vs-card" id="vsPhone" aria-labelledby="vsPhoneH"><div class="vs-cardhead"><h2 id="vsPhoneH">Phone alerts</h2><button type="button" class="vs-link" id="vsPhoneX">Close</button></div>' +
      '<label class="vs-switch"><input type="checkbox" id="vsPhoneOn"' + (S.set.phone_alerts === false ? '' : ' checked') + '> Voice Studio alerts: a module narrated, all lessons done, your script ready, anything failed</label>' +
      '<div id="vsPush" class="vs-push"><p class="p-loading">Loading…</p></div></section>');
    p = main.querySelector('#vsPhone');
    p.querySelector('#vsPhoneX').addEventListener('click', () => { p.remove(); const b = document.getElementById('vsAlerts'); if (b) b.setAttribute('aria-expanded', 'false'); });
    p.querySelector('#vsPhoneOn').addEventListener('change', async ev => { await safe(db().from('voice_settings').update({ phone_alerts:ev.target.checked, updated_at:new Date().toISOString() }).eq('id', 'main')); });
    const box2 = p.querySelector('#vsPush');
    if (window.PortalPush && window.PortalPush.draw) window.PortalPush.draw(box2); else box2.innerHTML = '<p class="vs-note">Open Settings › Phone alerts in the portal menu to allow alerts on this phone.</p>';
    window.scrollTo(0, 0);
    return true;
  }


  let openId = 0;
  V.voice = { title:'Voice Studio', sec:'voice', async open(el, ok){
    if (timer) { clearInterval(timer); timer = null; }
    const me = ++openId, mine = () => me === openId && ok();
    if (!putting) liveArmed = '';   // a Put live waiting for its second click is forgotten on a new screen
    const sub = location.hash.split('/')[1] || 'tts', tab = VIEWS[sub] && (isAmr() || !AMR_ONLY.includes(sub)) ? sub : 'tts';
    document.body.classList.remove('vs-noscroll');
    el.innerHTML = shell(tab);
    const main = el.querySelector('#vsMain'), wkBox = el.querySelector('#vsWk');
    const reopen = () => V.voice.open(el, ok);
    let wkHtml = '';
    const showWk = S2 => {
      const h = railStatus(S2); if (h !== wkHtml) { wkHtml = h; wkBox.innerHTML = h; }
      const n = S2.review.length, badge = el.querySelector('#vsRevN'); if (badge) { badge.hidden = !n; badge.textContent = n; }
    };
    wkBox.addEventListener('click', async ev => { const b = ev.target.closest('[data-pause]'); if (b && await setPause(b.dataset.pause === '1', b)) reopen(); });
    el.querySelector('#vsAlerts').addEventListener('click', async ev => { const b = ev.currentTarget; b.setAttribute('aria-expanded', String(await alertsPanel(main, S, reopen))); });
    // what the screen shows depends on these; a redraw only happens when one of them changes
    const sig = S2 => S2.lessons.concat(S2.others).map(j => j.id + j.status + Math.round((j.progress || 0) * 20) + (j.retake ? j.retake.status : '')).join() +
      S2.paused + Object.values(S2.moodSamples).map(j => j.id + j.status).join();
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
      const busy = putting || !!liveArmed || (act && main.contains(act) && /INPUT|TEXTAREA|SELECT/.test(act.tagName)) || [...main.querySelectorAll('audio')].some(a => !a.paused) ||
        !!main.querySelector('.vs-jobmore:not([hidden]), .vs-expand:not([hidden]), .vs-checks:not([hidden]), #vsPhone') || !!($('vsText') && $('vsText').value.trim()) || !!($('vsTitle') && $('vsTitle').value.trim());
      if (busy || (!S.error && sig(fresh) === sig(S))) return;
      const y = window.scrollY; S = fresh; await draw(); if (!mine()) return; window.scrollTo(0, y); every();
    };
    // the pace follows what's on screen: faster while something is being made
    const every = () => { const want = res.live && !S.error ? 15000 : 60000; if (want === rate && mineTimer) return; stop(); rate = want; timer = mineTimer = setInterval(tick, want); };
    every();
  } };
})();
