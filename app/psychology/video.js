// Lesson videos for the Psychology course (Learning Hub).
// A section has a video when psy/videos/<module id>/<section id>.mp4 is in the private "course-content" bucket.
// That bucket only lets in people who can open the course (Amr, or members with Learning Hub + Psychology access),
// so the video, its captions (<id>.json) and its cover (<id>.jpg) are locked the same way as the lessons.
// Learners get 15-minute links and our own player (no download or picture-in-picture, speed, captions in English or
// Arabic, chapters, resume). Seconds watched are saved with learn_video_save. Amr can upload or replace a video.
// The player is a copy of the Acquisitions course player (/course/app.js), kept separate so the two courses stay independent.
(function () {
  'use strict';
  const BUCKET = 'course-content';
  const listCache = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const AR = {"Play": "تشغيل", "Pause": "إيقاف مؤقت", "Back 10 seconds": "رجوع 10 ثوانٍ", "Forward 10 seconds": "تقديم 10 ثوانٍ", "Mute": "كتم الصوت", "Unmute": "تشغيل الصوت", "Volume": "مستوى الصوت", "Seek": "الانتقال في الفيديو", "Chapters": "الفصول", "Captions": "الترجمة", "Captions on": "الترجمة مفعّلة", "Captions off": "الترجمة متوقفة", "Off": "إيقاف", "Playback speed": "سرعة التشغيل", "Full screen": "ملء الشاشة", "Exit full screen": "الخروج من ملء الشاشة", "Lesson video": "فيديو الدرس", "Picking up at ": "نكمل من ", "Start over": "من البداية"};

  // One listing per module tells us which sections have a video, so sections without one cost a single request.
  function listModule(db, folder){
    // A failed listing is not remembered, so one network blip doesn't hide a module's videos until reload.
    if (!listCache[folder]) listCache[folder] = db.storage.from(BUCKET).list(folder, { limit:1000 })
      .then(r => { if (r.error) throw r.error; return new Set((r.data || []).map(f => f.name)); })
      .catch(() => { delete listCache[folder]; return new Set(); });
    return listCache[folder];
  }

  async function mount(box, O){
    // O: { db, uid, course, moduleId, itemId, isAdmin, lang, toast }
    const db = O.db; if (!box || !db) return;
    const W = k => (O.lang === 'ar' && AR[k]) || k; // player labels follow the course language
    const mod = { id:O.moduleId }, it = { id:O.itemId };
    const folder = O.course + '/videos/' + mod.id, path = folder + '/' + it.id + '.mp4', base = folder + '/' + it.id;
    const rpc = async (n, a) => { const { data, error } = await db.rpc(n, a); if (error) throw error; return data; };
    const toast = O.toast || (() => {});
    const videoUrl = async p => {
      try { const { data, error } = await db.storage.from(BUCKET).createSignedUrl(p, 15 * 60); return error ? null : data.signedUrl; }
      catch(e){ return null; }
    };
    const have = await listModule(db, folder);
    const url = have.has(it.id + '.mp4') ? await videoUrl(path) : null;
    let X = null, prog = null, posterUrl = null;
    if (url) {
      let extraUrl;
      [extraUrl, posterUrl] = await Promise.all([have.has(it.id + '.json') ? videoUrl(base + '.json') : null, have.has(it.id + '.jpg') ? videoUrl(base + '.jpg') : null]);
      [X, prog] = await Promise.all([
        extraUrl ? fetch(extraUrl).then(r => r.ok ? r.json() : null).catch(() => null) : null,
        db.from('learn_video_progress').select('position,duration,completed_at').eq('user_id', O.uid).eq('course', O.course).eq('module_id', mod.id).eq('item_id', it.id).maybeSingle().then(r => r.data).catch(() => null)
      ]);
    }
    if (!document.contains(box)) return; // the learner moved to another page while the link was loading
    const up = O.isAdmin ? '<label class="link-btn vup"><input type="file" class="vh" id="vidFile" accept="video/mp4">' + (url ? 'Replace video' : 'Upload a video for this section (MP4)') + '</label><span class="note" id="vidState" role="status"></span>' : '';
    function bindUpload(){
      const inp = $('vidFile'); if (!inp) return;
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        const st = $('vidState');
        inp.value = '';
        if (!/\.mp4$/i.test(f.name) || (f.type && f.type !== 'video/mp4')) { st.textContent = 'Use an MP4 video.'; return; }
        if (f.size > 50 * 1024 * 1024) { st.textContent = 'That video is over 50 MB.'; return; }
        inp.disabled = true; st.textContent = 'Uploading…';
        const { error } = await db.storage.from(BUCKET).upload(path, f, { upsert:true, contentType:'video/mp4' });
        inp.disabled = false;
        if (error) { if (document.contains(st)) st.textContent = 'The upload didn’t work. Check your connection and try again.'; return; }
        delete listCache[folder]; toast('Video uploaded');
        if (document.contains(box)) mount(box, O);
      });
    }
    if (!url) { box.innerHTML = up ? '<div class="vbox">' + up + '</div>' : ''; return bindUpload(); }
    const svg = d => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="' + d + '"/></svg>';
    const P = {
      play:'M8 5v14l11-7z', pause:'M6 5h4v14H6zM14 5h4v14h-4z',
      back:'M11.5 7V3L6 8.5l5.5 5.5V10a5 5 0 1 1-5 5H4.5a7 7 0 1 0 7-8z', fwd:'M12.5 7V3L18 8.5 12.5 14V10a5 5 0 1 0 5 5h2a7 7 0 1 1-7-8z',
      vol:'M4 9v6h4l5 4V5L8 9zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z', mute:'M4 9v6h4l5 4V5L8 9zm16.6 0L19.2 7.6 17 9.8l-2.2-2.2L13.4 9l2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4-2.2-2.2z',
      fs:'M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z', fsx:'M8 4h2v6H4V8h4zM14 4h2v4h4v2h-6zM4 14h6v6H8v-4H4zM14 14h6v2h-4v4h-2z',
      cc:'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7zm2 3h5v1.5H7.5v1H11V14H6zm7 0h5v1.5h-3.5v1H18V14h-5z',
      list:'M4 6h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zM4 16h2v2H4zm4 0h12v2H8z'
    };
    // Sidecar data is uploaded by the admin; keep only well-formed rows so one bad line can't break the player.
    const okRow = r => Array.isArray(r) && Number.isFinite(+r[0]) && r[1] != null;
    const CAP = {};
    if (X && X.captions) ['en', 'ar'].forEach(k => { if (Array.isArray(X.captions[k])) CAP[k] = X.captions[k].filter(okRow).map(r => [+r[0], String(r[1])]); });
    const CH = X && Array.isArray(X.chapters) ? X.chapters.filter(okRow).map(r => [Math.max(0, Math.round(+r[0])), String(r[1]), String(r[2] || r[1])]) : [];
    const capLangs = [['en', 'English'], ['ar', 'العربية']].filter(([k]) => Array.isArray(CAP[k]) && CAP[k].length);
    const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
    const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    box.innerHTML = '<section class="vbox" aria-label="' + W('Lesson video') + '"><div class="vwrap" id="vwrap" tabindex="-1">' +
      '<video id="lv" playsinline webkit-playsinline disablepictureinpicture disableremoteplayback preload="metadata"' + (posterUrl ? ' poster="' + esc(posterUrl) + '"' : '') + '></video>' +
      '<div class="vcap" id="vcap" aria-hidden="true"><span></span></div>' +
      '<div class="vresume" id="vresume" hidden><span id="vresumeT"></span><button type="button" id="vrestart">' + W('Start over') + '</button></div>' +
      '<div class="wm" aria-hidden="true"><span class="wm-logo">A</span><span class="wm-txt"><b>Amr Abdelgawad</b><small>amr@amrabdelgawad.site</small></span></div>' +
      '<button class="vbig" type="button" id="vbig" aria-label="' + W('Play') + '">' + svg(P.play) + '</button>' +
      '<div class="vbar" id="vbar">' +
        '<div class="vseekw"><div class="vticks" aria-hidden="true">' + CH.filter(c => c[0] > 0).map(c => '<i data-t="' + c[0] + '"></i>').join('') + '</div>' +
        '<input class="vseek" id="vseek" type="range" min="0" max="1000" value="0" step="1" aria-label="' + W('Seek') + '"></div>' +
        '<div class="vrow">' +
          '<button class="vb" type="button" id="vplay" aria-label="' + W('Play') + '">' + svg(P.play) + '</button>' +
          '<button class="vb" type="button" id="vback" aria-label="' + W('Back 10 seconds') + '">' + svg(P.back) + '</button>' +
          '<button class="vb" type="button" id="vfwd" aria-label="' + W('Forward 10 seconds') + '">' + svg(P.fwd) + '</button>' +
          '<div class="vvol" id="vvol"><button class="vb" type="button" id="vmute" aria-label="' + W('Mute') + '">' + svg(P.vol) + '</button>' +
            '<input class="vvolr" id="vvolr" type="range" min="0" max="100" step="1" value="100" aria-label="' + W('Volume') + '"></div>' +
          '<span class="vtime" id="vtime">0:00 / 0:00</span>' +
          '<span class="vchap" id="vchap"></span><span class="vsp"></span>' +
          (CH.length > 1 ? '<div class="vspeedw"><button class="vb" type="button" id="vchapB" aria-label="' + W('Chapters') + '" aria-haspopup="true" aria-expanded="false">' + svg(P.list) + '</button>' +
            '<div class="vmenu vchapm" id="vchapM" role="menu" hidden>' + CH.map(c => '<button type="button" role="menuitem" data-t="' + c[0] + '"><span class="ct">' + fmt(c[0] / 1000) + '</span>' + esc(c[1]) + '</button>').join('') + '</div></div>' : '') +
          (capLangs.length ? '<div class="vspeedw"><button class="vb" type="button" id="vccB" aria-label="' + W('Captions') + '" aria-haspopup="true" aria-expanded="false">' + svg(P.cc) + '</button>' +
            '<div class="vmenu" id="vccM" role="menu" hidden><button type="button" role="menuitemradio" data-l="off">' + W('Off') + '</button>' + capLangs.map(([k, n]) => '<button type="button" role="menuitemradio" data-l="' + k + '"' + (k === 'ar' ? ' lang="ar"' : '') + '>' + n + '</button>').join('') + '</div></div>' : '') +
          '<div class="vspeedw"><button class="vb vspeed" type="button" id="vspeed" aria-label="' + W('Playback speed') + '" aria-haspopup="true" aria-expanded="false">1x</button>' +
            '<div class="vmenu" id="vmenu" role="menu" hidden>' + SPEEDS.map(s => '<button type="button" role="menuitemradio" data-s="' + s + '" aria-checked="' + (s === 1) + '">' + s + 'x</button>').join('') + '</div></div>' +
          '<button class="vb" type="button" id="vfs" aria-label="' + W('Full screen') + '">' + svg(P.fs) + '</button>' +
        '</div>' +
      '</div>' +
      '</div>' + up + '</section>';
    const wrap = $('vwrap'), v = $('lv'), bar = $('vbar'), seek = $('vseek'), big = $('vbig'),
          playB = $('vplay'), muteB = $('vmute'), timeEl = $('vtime'), spB = $('vspeed'), menu = $('vmenu'), fsBtn = $('vfs');
    v.src = url;
    wrap.addEventListener('contextmenu', ev => ev.preventDefault());
    const alive = () => document.contains(wrap);
    // Controls fade out while playing and come back on any touch, click or mouse move.
    // In full screen they also hide while paused, so the video shows on its own.
    let hideT = 0;
    let dragging = false;
    const anyMenu = () => !!wrap.querySelector('.vmenu:not([hidden])');
    const canHide = () => !anyMenu() && !dragging && (!v.paused || wrap.classList.contains('isfs'));
    const hideBar = () => { if (canHide()) { wrap.classList.add('idle'); volW.classList.remove('open'); } };
    const showBar = () => { wrap.classList.remove('idle'); clearTimeout(hideT); hideT = setTimeout(hideBar, 2600); };
    const toggle = () => { if (v.paused || v.ended) v.play().catch(() => {}); else v.pause(); };
    const syncPlay = () => {
      const p = v.paused || v.ended;
      playB.innerHTML = svg(p ? P.play : P.pause); playB.setAttribute('aria-label', p ? W('Play') : W('Pause'));
      big.hidden = !p; wrap.classList.toggle('paused', p); showBar();
    };
    const syncTime = () => {
      timeEl.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration);
      if (!seeking && v.duration) seek.value = Math.round(v.currentTime / v.duration * 1000);
      seek.style.setProperty('--p', (seek.value / 10) + '%');
    };
    let seeking = false;
    seek.addEventListener('input', () => { seeking = true; if (v.duration) { v.currentTime = seek.value / 1000 * v.duration; } seek.style.setProperty('--p', (seek.value / 10) + '%'); timeEl.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration); showBar(); });
    seek.addEventListener('change', () => { seeking = false; });
    ['play', 'pause', 'ended'].forEach(e => v.addEventListener(e, syncPlay));
    ['timeupdate', 'loadedmetadata', 'durationchange'].forEach(e => v.addEventListener(e, syncTime));
    big.addEventListener('click', toggle);
    playB.addEventListener('click', toggle);
    // Mouse: clicking the picture plays or pauses. Touch: a tap shows the controls, a second tap hides them.
    let ptr = 'mouse', wasIdle = false;
    wrap.addEventListener('pointerdown', ev => { ptr = ev.pointerType || 'mouse'; wasIdle = wrap.classList.contains('idle'); }, true);
    v.addEventListener('click', () => {
      if (ptr !== 'mouse') { if (wasIdle) return showBar(); clearTimeout(hideT); return void wrap.classList.add('idle'); }
      if (wasIdle) return showBar();
      toggle();
    });
    v.addEventListener('dblclick', ev => { ev.preventDefault(); if (ptr === 'mouse') goFs(); });
    $('vback').addEventListener('click', () => { v.currentTime = Math.max(0, v.currentTime - 10); showBar(); });
    $('vfwd').addEventListener('click', () => { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); showBar(); });
    // Volume: a slider slides out from the speaker (hover or tap). iPhones only allow the phone's own buttons,
    // so there the speaker just mutes and the slider stays hidden.
    const volW = $('vvol'), volR = $('vvolr');
    const canVol = (() => { try { const o = v.volume; v.volume = 0.5; const ok = Math.abs(v.volume - 0.5) < 0.01; v.volume = o; return ok; } catch(e){ return false; } })();
    if (!canVol) volW.classList.add('novol');
    const syncVol = () => {
      const lv = v.muted ? 0 : Math.round(v.volume * 100);
      muteB.innerHTML = svg(lv === 0 ? P.mute : P.vol); muteB.setAttribute('aria-label', lv === 0 ? W('Unmute') : W('Mute'));
      volR.value = lv; volR.style.setProperty('--p', lv + '%');
    };
    let lastVol = 1; try { lastVol = Math.min(1, Math.max(0.05, +(localStorage.getItem('lessonVolume') || 1))); } catch(e){}
    if (canVol) v.volume = lastVol;
    volR.addEventListener('input', () => {
      const x = volR.value / 100; v.volume = x; v.muted = x === 0;
      if (x > 0) { lastVol = x; try { localStorage.setItem('lessonVolume', String(x)); } catch(e){} }
      showBar();
    });
    v.addEventListener('volumechange', syncVol);
    muteB.addEventListener('click', () => {
      if (canVol && ptr !== 'mouse' && !volW.classList.contains('open')) { volW.classList.add('open'); return showBar(); }
      if (v.muted || v.volume === 0) { v.muted = false; if (canVol && v.volume === 0) v.volume = lastVol; } else v.muted = true;
      showBar();
    });
    syncVol();
    // Speed: remembered for the learner on this device.
    const setSpeed = s => {
      v.playbackRate = s; spB.textContent = s + 'x';
      menu.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.s === s)));
      try { localStorage.setItem('lessonSpeed', String(s)); } catch(e){}
    };
    let saved = 1; try { saved = +localStorage.getItem('lessonSpeed') || 1; } catch(e){}
    if (SPEEDS.includes(saved)) { setSpeed(saved); v.addEventListener('loadedmetadata', () => { v.playbackRate = saved; }, { once:true }); }
    // One menu open at a time (speed, chapters, captions).
    const closeMenu = () => {
      const opener = wrap.querySelector('[aria-haspopup][aria-expanded="true"]');
      const had = opener && wrap.querySelector('.vmenu:not([hidden])') && wrap.querySelector('.vmenu:not([hidden])').contains(document.activeElement);
      wrap.querySelectorAll('.vmenu').forEach(m => { m.hidden = true; }); wrap.querySelectorAll('[aria-haspopup]').forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (had) opener.focus();
      showBar();
    };
    const openMenu = (btn, m) => { const was = !m.hidden; closeMenu(); if (!was) { m.hidden = false; btn.setAttribute('aria-expanded', 'true'); const f = m.querySelector('[aria-checked="true"]') || m.querySelector('button'); if (f && ptr !== 'touch') f.focus(); } showBar(); };
    spB.addEventListener('click', ev => { ev.stopPropagation(); openMenu(spB, menu); });
    menu.addEventListener('click', ev => { const b = ev.target.closest('button[data-s]'); if (!b) return; ev.stopPropagation(); setSpeed(+b.dataset.s); closeMenu(); });
    document.addEventListener('click', function outside(ev){ if (!alive()) return document.removeEventListener('click', outside); if (anyMenu() && !ev.target.closest('.vspeedw')) closeMenu(); });
    // Full screen on the whole player (so the badge and our controls stay). Phones without element
    // full screen (iPhone) get a full-window view instead, turned sideways where the phone allows it.
    const isFs = () => document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap || wrap.classList.contains('vfill');
    const syncFs = () => {
      const on = isFs();
      fsBtn.innerHTML = svg(on ? P.fsx : P.fs); fsBtn.setAttribute('aria-label', on ? W('Exit full screen') : W('Full screen'));
      wrap.classList.toggle('isfs', on); document.documentElement.classList.toggle('vfill-lock', wrap.classList.contains('vfill'));
      showBar();
    };
    const goFs = async () => {
      if (isFs()) {
        if (wrap.classList.contains('vfill')) { wrap.classList.remove('vfill'); try { screen.orientation.unlock(); } catch(e){} return syncFs(); }
        try { await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen()); } catch(e){}
        return;
      }
      try {
        if (wrap.requestFullscreen) await wrap.requestFullscreen({ navigationUI:'hide' });
        else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
        else throw 0;
      } catch(e) { wrap.classList.add('vfill'); syncFs(); }
      try { await screen.orientation.lock('landscape'); } catch(e){}
      showBar();
    };
    fsBtn.addEventListener('click', goFs);
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(e => document.addEventListener(e, function f(){
      if (!alive()) return document.removeEventListener(e, f);
      if (!document.fullscreenElement && !document.webkitFullscreenElement) { try { screen.orientation.unlock(); } catch(x){} }
      syncFs();
    }));
    wrap.querySelectorAll('input[type=range]').forEach(r => {
      r.addEventListener('pointerdown', () => { dragging = true; });
      ['pointerup', 'pointercancel', 'change'].forEach(e => r.addEventListener(e, () => { dragging = false; showBar(); }));
    });
    wrap.addEventListener('mousemove', showBar, { passive:true });
    wrap.addEventListener('focusin', showBar);
    bar.addEventListener('pointerdown', showBar);
    wrap.addEventListener('keydown', ev => {
      const k = ev.key;
      if (ev.target === seek && (k === 'ArrowLeft' || k === 'ArrowRight')) return;
      if (k === ' ' || k === 'k') { if (ev.target.tagName === 'BUTTON') return; ev.preventDefault(); toggle(); }
      else if (k === 'ArrowLeft') { v.currentTime = Math.max(0, v.currentTime - 5); }
      else if (k === 'ArrowRight') { v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); }
      else if (k === 'f') goFs();
      else if (k === 'm') muteB.click();
      else if (k === 'Escape' && anyMenu()) closeMenu();
      else if (k === 'Escape' && wrap.classList.contains('vfill')) goFs();
      else return;
      showBar();
    });
    // Captions: drawn by the player (not burned into the video), English or Arabic, remembered per device.
    const capEl = $('vcap'), capSpan = capEl.firstChild, ccB = $('vccB'), ccM = $('vccM');
    let capLang = O.lang === 'ar' ? 'ar' : 'en'; try { capLang = localStorage.getItem('lessonCaptions') || capLang; } catch(e){}
    if (capLang !== 'off' && !capLangs.some(([k]) => k === capLang)) capLang = capLangs.length ? capLangs[0][0] : 'off';
    let capShown = null;
    const syncCap = () => {
      const list = capLang === 'off' ? null : CAP[capLang], ms = v.currentTime * 1000;
      let txt = '';
      if (list && !(X && X.end && ms > X.end)) for (const c of list) { if (c[0] <= ms) txt = c[1]; else break; }
      if (txt === capShown) return;
      capShown = txt; capSpan.textContent = txt; capEl.hidden = !txt;
      capEl.dir = capLang === 'ar' ? 'rtl' : 'ltr'; capEl.lang = capLang === 'ar' ? 'ar' : 'en';
    };
    const setCap = l => {
      capLang = l; capShown = null; syncCap();
      if (ccB) { ccB.classList.toggle('on', l !== 'off'); ccB.setAttribute('aria-label', l === 'off' ? W('Captions off') : W('Captions on')); }
      if (ccM) ccM.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.l === l)));
      try { localStorage.setItem('lessonCaptions', l); } catch(e){}
    };
    if (ccB) {
      ccB.addEventListener('click', ev => { ev.stopPropagation(); openMenu(ccB, ccM); });
      ccM.addEventListener('click', ev => { const b = ev.target.closest('button[data-l]'); if (!b) return; ev.stopPropagation(); setCap(b.dataset.l); closeMenu(); });
    }
    setCap(capLang);
    ['timeupdate', 'seeked'].forEach(e => v.addEventListener(e, syncCap));
    // Chapters: ticks on the seek bar, the current chapter's name next to the time, and a list to jump to.
    const chapEl = $('vchap'), chB = $('vchapB'), chM = $('vchapM');
    const placeTicks = () => { if (!v.duration) return; wrap.querySelectorAll('.vticks i').forEach(i => { i.style.left = Math.min(100, i.dataset.t / 10 / v.duration) + '%'; }); };
    let chapShown = null;
    const syncChap = () => {
      if (!CH.length) return;
      const ms = v.currentTime * 1000; let c = CH[0];
      for (const x of CH) if (x[0] <= ms + 250) c = x;
      if (c === chapShown) return; chapShown = c;
      chapEl.textContent = c[1];
      if (chM) chM.querySelectorAll('button').forEach(b => b.classList.toggle('cur', +b.dataset.t === c[0]));
    };
    v.addEventListener('loadedmetadata', placeTicks);
    ['timeupdate', 'seeked'].forEach(e => v.addEventListener(e, syncChap));
    if (chB) {
      chB.addEventListener('click', ev => { ev.stopPropagation(); openMenu(chB, chM); });
      chM.addEventListener('click', ev => {
        const b = ev.target.closest('button[data-t]'); if (!b) return; ev.stopPropagation();
        v.currentTime = b.dataset.t / 1000; closeMenu(); if (v.paused) v.play().catch(() => {});
      });
    }
    // Resume where they stopped (saved on the account, so it follows them to another device).
    const rKey = 'lessonPos:' + mod.id + ':' + it.id;
    // The account copy follows the learner to other devices; this device's copy can be a few seconds newer.
    let startAt = prog && prog.position || 0;
    try { startAt = Math.max(startAt, +localStorage.getItem(rKey) || 0); } catch(e){}
    const resumeEl = $('vresume');
    v.addEventListener('loadedmetadata', () => {
      if (startAt > 10 && v.duration && startAt < v.duration - 15) {
        v.currentTime = startAt;
        $('vresumeT').textContent = W('Picking up at ') + fmt(startAt);
        resumeEl.hidden = false;
        setTimeout(() => { resumeEl.hidden = true; }, 9000);
      }
    }, { once:true });
    $('vrestart').addEventListener('click', ev => { ev.stopPropagation(); v.currentTime = 0; resumeEl.hidden = true; v.play().catch(() => {}); });
    // Watch tracking: only seconds actually played count (jumps are ignored), saved every 15 seconds,
    // on pause and when the page is left. The admin page shows it per learner.
    let lastT = null, acc = 0, lastSave = Date.now(), saving = false;
    const save = async force => {
      if (saving || !v.duration) return;
      if (!force && acc < 15 && Date.now() - lastSave < 15000) return;
      const add = Math.round(acc * 10) / 10; acc = 0; lastSave = Date.now(); saving = true;
      try { localStorage.setItem(rKey, String(v.ended ? 0 : Math.floor(v.currentTime))); } catch(e){}
      try { await rpc('learn_video_save', { p_course:O.course, p_module:mod.id, p_item:it.id, p_position:v.ended ? 0 : v.currentTime, p_duration:v.duration, p_add:add }); }
      catch(e){ acc += add; }
      finally { saving = false; }
    };
    v.addEventListener('timeupdate', () => {
      const t = v.currentTime;
      if (!v.paused && lastT !== null) { const d = t - lastT; if (d > 0 && d < 3) acc += d; }
      lastT = t;
      save(false);
    });
    v.addEventListener('seeking', () => { lastT = null; });
    ['pause', 'ended'].forEach(e => v.addEventListener(e, () => save(true)));
    const onHide = ev => { if (!alive()) { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); return; } if (document.visibilityState === 'hidden' || ev.type === 'pagehide') save(true); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('hashchange', function leave(){ window.removeEventListener('hashchange', leave); if (acc > 0.5) save(true); });
    syncPlay(); syncTime();
    // The link lasts 15 minutes; if it runs out mid-lesson, get a fresh one and carry on from the same spot.
    let lastFix = 0;
    v.addEventListener('error', async () => {
      if (Date.now() - lastFix < 30e3) return; lastFix = Date.now();
      const t = v.currentTime, playing = !v.paused, u = await videoUrl(path);
      if (!u || !document.contains(v)) return;
      v.src = u; v.addEventListener('loadedmetadata', () => { v.currentTime = t; if (playing) v.play().catch(() => {}); }, { once:true });
    });
    bindUpload();
  }
  window.PsyVideo = { mount };
})();
