// Psychology course gate (/app/psychology/): sign-in, access check, locked content and saved progress.
// 1. Needs a signed-in session from /app (same Supabase sign-in as the rest of the app).
// 2. Opens only for Amr, or an active team member with "Learning Hub" (learn) AND "Psychology course" (psy)
//    switched on in /app > Invite and access (learn_can_open('psy') in the database).
// 3. Downloads psy/content.json from the private bucket "course-content". The bucket itself refuses anyone
//    without access, so the lessons never reach a browser that isn't allowed to see them.
// 4. Gives the player window.LH_STORE, so progress saves on the device at once and to the learn_progress table
//    (course "psy"), and follows the person to other devices. Then loads player.js.
(function(){
  const C = window.PSY_COURSE, cfg = window.TRACKER_CONFIG || {};
  const $ = id => document.getElementById(id);
  let lang = 'en';   // the language last chosen in the player on this device, for these few messages
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || '';
    if (k.indexOf('lh-psy-sync:') === 0 || k === 'lh-psy:lang') { const v = k === 'lh-psy:lang' ? localStorage.getItem(k) : ((JSON.parse(localStorage.getItem(k) || '{}').kv || {}).lang);
      if (v === 'ar') lang = 'ar'; } } } catch(e){}
  const W = {
    en:{ checking:'Checking your access…', loading:'Loading the course…', signIn:'Please sign in to the app first, then open the course again.',
         noAccess:'This course is not switched on for your account yet. Ask Amr for access.', notSetUp:'The course content is not uploaded yet. Please try again later.',
         loadFail:'The course could not load. Check your connection and try again.', connect:'The app is not connected right now. Please try again later.', openApp:'Open the app' },
    ar:{ checking:'جارٍ التحقق من صلاحيتك…', loading:'جارٍ تحميل البرنامج…', signIn:'سجّل الدخول إلى التطبيق أولًا، ثم افتح البرنامج مرة أخرى.',
         noAccess:'هذا البرنامج غير مفعّل لحسابك بعد. اطلب الصلاحية من عمرو.', notSetUp:'محتوى البرنامج لم يُرفع بعد. حاول لاحقًا.',
         loadFail:'تعذّر تحميل البرنامج. تأكد من اتصالك وحاول مرة أخرى.', connect:'التطبيق غير متصل الآن. حاول لاحقًا.', openApp:'افتح التطبيق' }
  };
  const w = k => W[lang][k];
  function show(k, link){
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $('app').innerHTML = `<div class="gate"><p>${w(k)}</p>${link ? `<a href="/app/">${w('openApp')}</a>` : ''}</div>`;
  }
  const stop = k => show(k, true);

  // ---------- progress: this device at once, the account a moment later ----------
  let db = null, uid = 'me', noTable = false;
  const LKEY = () => 'lh-psy-sync:' + uid;
  let kv = {}, at = 0, timer = null;
  function local(){ try { const d = JSON.parse(localStorage.getItem(LKEY()) || 'null'); return d && d.kv ? d : null; } catch(e){ return null; } }
  function keepLocal(){ try { localStorage.setItem(LKEY(), JSON.stringify({ kv, at })); } catch(e){} }
  async function push(){
    timer = null;
    if (!db || noTable) return;
    const { error } = await db.from('learn_progress').upsert({ user_id:uid, course:C.id, data:{ kv, at }, updated_at:new Date().toISOString() });
    if (error && /learn_progress/.test(error.message || '')) noTable = true;
  }
  async function pull(){
    const l = local(); if (l) { kv = l.kv; at = l.at || 0; }
    if (!db) return;
    const { data:row, error } = await db.from('learn_progress').select('data').eq('user_id', uid).eq('course', C.id).maybeSingle();
    if (error) { if (/learn_progress/.test(error.message || '')) noTable = true; return; }
    const d = row && row.data;
    if (d && d.kv && (d.at || 0) > at) { kv = d.kv; at = d.at || 0; keepLocal(); }
    else if (l && (!d || (d.at || 0) < at)) push();          // this device has newer work: send it up
  }
  // Phones often skip pagehide when an app is closed from the background, so also send on hide
  const flushNow = () => { if (timer) { clearTimeout(timer); push(); } };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
  function store(){
    return {
      load: () => Promise.resolve(Object.assign({}, kv)),
      saveMany: q => {
        Object.keys(q).forEach(k => { if (q[k] === '' || q[k] == null) delete kv[k]; else kv[k] = q[k]; });
        at = Date.now(); keepLocal();
        if (timer) clearTimeout(timer); timer = setTimeout(push, 1500);
      }
    };
  }

  function startPlayer(course){
    window.COURSE = course;
    window.LH_STORE = store();
    $('app').innerHTML = '';
    const s = document.createElement('script'); s.src = 'player.js?v=1';
    s.onerror = () => stop('loadFail');
    document.body.appendChild(s);
  }

  async function start(){
    show('checking');
    // Test mode (tools/psychology-course): content comes from a local file, nothing is sent anywhere
    if (window.PSY_TEST) {
      uid = 'test';
      try { const body = await (await fetch(window.PSY_TEST.content || '_test-content.json', { cache:'no-store' })).json(); await pull(); return startPlayer(body); }
      catch(e) { return stop('loadFail'); }
    }
    if (!window.supabase || !/^https:\/\//.test(cfg.supabaseUrl || '')) return stop('connect');
    db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const { data:{ session } } = await db.auth.getSession();
    if (!session) return stop('signIn');
    uid = session.user.id;
    let ok, f;
    try {
      // Ask everything at once. The bucket refuses the file on its own to anyone without access,
      // so starting the download early gives nothing away.
      [ok, f] = await Promise.all([
        db.rpc('learn_can_open', { p_course:C.access }),
        db.storage.from('course-content').download(C.access + '/content.json').catch(e => ({ error:e })),
        pull()
      ]);
    } catch(e) { return stop('loadFail'); }
    if (ok.error) return stop(/not find|404|does not exist/i.test(ok.error.message || '') ? 'notSetUp' : 'loadFail');
    if (ok.data !== true) return stop('noAccess');
    if (f.error || !f.data) return stop(f.error && /not found|404|object not found/i.test(f.error.message || '') ? 'notSetUp' : 'loadFail');
    show('loading');
    let body;
    try { body = JSON.parse(await f.data.text()); } catch(e) { return stop('loadFail'); }
    if (!body || !Array.isArray(body.modules)) return stop('loadFail');   // the lessons are data, never run as code
    startPlayer(body);
  }
  start();
})();
