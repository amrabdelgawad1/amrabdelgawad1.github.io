// Course tools, shared by the Marketing course (/app/course/) and the Psychology course (/app/psychology/).
//   Marketing:  #/tools/cpd       Cost per deal calculator (results by channel, and a plan worked backward)
//   Psychology: #/tools/thought   Thought record (CBT practice sheet)
//               #/tools/grow      Goal planner (GROW model)
// The players only route here after their access check has passed, so nobody without the course sees the tools.
// What a learner types is saved on their device at once and to the learn_notes table a moment later.
// learn_notes is private: each row can only be read by the person who wrote it (see
// supabase/migrations/20261029010000_learn_notes_private.sql). The players pass the signed-in client in window.LH_DB.
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (window.LH_DB && window.LH_DB.uid) || 'me';
  const db = () => (window.LH_DB && window.LH_DB.db) || null;
  let lang = 'en';

  // ---------- words ----------
  const S = {
    en: {
      tools: 'Tools', back: 'All tools', open: 'Open', saved: 'Saved to your account', savedHere: 'Saved on this device', saving: 'Saving…',
      privacy: 'Only you can see what you write here.', del: 'Delete', delSure: 'Delete this for good?', edit: 'Edit', add: 'New entry', done: 'Done',
      empty: 'Nothing saved yet.', loading: 'Loading…', cancel: 'Cancel', save: 'Save',
      // marketing
      cpdT: 'Cost per deal calculator', cpdD: 'Put in what each channel cost and produced. See cost per lead, per appointment and per deal, your return, and the budget you need for the deals you want.',
      channel: 'Channel', chName: 'Channel name', spend: 'Spent', leads: 'Leads', appts: 'Appointments', deals: 'Deals closed', profit: 'Profit per deal',
      addCh: 'Add a channel', rmCh: 'Remove channel', example: 'Load an example', clear: 'Start fresh', clearSure: 'Clear every channel and start fresh?',
      currency: 'Currency', period: 'These numbers cover', perMonth: 'one month', perQuarter: 'three months', perCustom: 'another period',
      cpl: 'Cost per lead', cpa: 'Cost per appointment', cpdeal: 'Cost per deal', l2a: 'Leads to appointments', a2d: 'Appointments to deals',
      net: 'Profit after marketing', roi: 'Return', per1: v => `Every 1 spent brought back ${v}`,
      total: 'All channels together', planT: 'Plan backward', target: 'Deals I want', need: (l, a, b) => `You need about <b>${l}</b> leads and <b>${a}</b> appointments, and a budget of about <b>${b}</b>.`,
      planNo: 'Fill in spend, leads, appointments and deals first. The plan uses this channel’s own rates.',
      how: 'How it is worked out', howList: ['Cost per lead = spent ÷ leads', 'Cost per appointment = spent ÷ appointments', 'Cost per deal = spent ÷ deals closed',
        'Profit after marketing = (deals × profit per deal) − spent', 'Return = profit after marketing ÷ spent', 'The plan works backward: deals wanted ÷ appointment-to-deal rate = appointments, ÷ lead-to-appointment rate = leads, × cost per lead = budget'],
      v_healthy: 'Healthy', v_thin: 'Thin margin', v_losing: 'Losing money', vNote: 'Compares cost per deal with profit per deal.',
      exNames: ['Cold calling', 'Texting', 'Direct mail', 'Paid ads'], newCh: 'New channel',
      // psychology
      safe: 'These are practice tools for learning, not therapy. If you feel unsafe or in crisis, contact local emergency services or someone you trust right away.',
      trT: 'Thought record', trD: 'Slow down a difficult moment: what happened, what went through your mind, and a more balanced way to see it.',
      situation: 'What happened?', situationH: 'Where were you, who was there, what was going on? Just the facts.',
      feeling: 'What did you feel?', feelingH: 'For example: anxious, sad, angry, ashamed.', before: 'How strong (0 to 100)', after: 'How strong now (0 to 100)',
      thought: 'What went through your mind?', thoughtH: 'The thought that hit hardest, in your own words.',
      traps: 'Thinking traps you notice', trapList: [['all', 'All or nothing'], ['cat', 'Expecting the worst'], ['mind', 'Mind reading'], ['fort', 'Predicting the future'],
        ['should', '“Should” rules'], ['label', 'Labeling'], ['emo', 'Feelings as facts'], ['over', 'Overgeneralizing'], ['disc', 'Discounting the good'], ['pers', 'Taking it personally']],
      evFor: 'What supports the thought?', evAgainst: 'What does not fit the thought?', evAgainstH: 'What would you tell a friend who had this thought?',
      balanced: 'A more balanced thought', balancedH: 'Not forced positive. Something that fits all the facts.',
      shift: (a, b) => `${a} → ${b}`,
      grT: 'Goal planner', grD: 'Set a goal with the GROW model: Goal, Reality, Options, Way forward. Then check in on it.',
      gGoal: 'Goal: what do you want?', gGoalH: 'Specific enough that you would know when it is done.', gWhy: 'Why does it matter to you?',
      gReal: 'Reality: where are you now?', gRealH: 'What is already true, what have you tried, what is in the way?', gScale: 'How close are you (0 to 10)',
      gOpts: 'Options: what could you do?', gOptsH: 'One idea per line. Include the ones that feel unlikely.',
      gStep: 'Way forward: your first step', gBy: 'By when', gBlock: 'What might get in the way?', gHelp: 'Who or what can help?',
      gCheck: 'Check in', gCheckNote: 'What happened since last time?', gCheckAdd: 'Add check-in', gChecks: 'Check-ins',
      gActive: 'Active', gDone: 'Reached', markDone: 'Mark as reached', markActive: 'Mark as active', untitled: 'Untitled'
    },
    ar: {
      tools: 'الأدوات', back: 'كل الأدوات', open: 'افتح', saved: 'محفوظ في حسابك', savedHere: 'محفوظ على هذا الجهاز', saving: 'جارٍ الحفظ…',
      privacy: 'ما تكتبه هنا لا يراه أحد غيرك.', del: 'حذف', delSure: 'حذف هذا نهائيًا؟', edit: 'تعديل', add: 'إدخال جديد', done: 'تم',
      empty: 'لا يوجد شيء محفوظ بعد.', loading: 'جارٍ التحميل…', cancel: 'إلغاء', save: 'حفظ',
      cpdT: 'حاسبة تكلفة الصفقة', cpdD: 'أدخل ما أنفقته كل قناة وما حققته. ستعرف تكلفة العميل المحتمل والموعد والصفقة، والعائد، والميزانية التي تحتاجها لعدد الصفقات الذي تريده.',
      channel: 'القناة', chName: 'اسم القناة', spend: 'المصروف', leads: 'العملاء المحتملون', appts: 'المواعيد', deals: 'الصفقات المغلقة', profit: 'الربح لكل صفقة',
      addCh: 'أضف قناة', rmCh: 'احذف القناة', example: 'حمّل مثالًا', clear: 'ابدأ من جديد', clearSure: 'مسح كل القنوات والبدء من جديد؟',
      currency: 'العملة', period: 'هذه الأرقام عن', perMonth: 'شهر واحد', perQuarter: 'ثلاثة أشهر', perCustom: 'فترة أخرى',
      cpl: 'تكلفة العميل المحتمل', cpa: 'تكلفة الموعد', cpdeal: 'تكلفة الصفقة', l2a: 'من عميل محتمل إلى موعد', a2d: 'من موعد إلى صفقة',
      net: 'الربح بعد التسويق', roi: 'العائد', per1: v => `كل 1 أنفقته رجع ${v}`,
      total: 'كل القنوات معًا', planT: 'خطّط بالعكس', target: 'عدد الصفقات المطلوب', need: (l, a, b) => `تحتاج تقريبًا <b>${l}</b> عميلًا محتملًا و<b>${a}</b> موعدًا، وميزانية تقارب <b>${b}</b>.`,
      planNo: 'أدخل المصروف والعملاء المحتملين والمواعيد والصفقات أولًا. الخطة تعتمد على نسب هذه القناة.',
      how: 'طريقة الحساب', howList: ['تكلفة العميل المحتمل = المصروف ÷ العملاء المحتملين', 'تكلفة الموعد = المصروف ÷ المواعيد', 'تكلفة الصفقة = المصروف ÷ الصفقات المغلقة',
        'الربح بعد التسويق = (الصفقات × الربح لكل صفقة) − المصروف', 'العائد = الربح بعد التسويق ÷ المصروف', 'الخطة بالعكس: الصفقات المطلوبة ÷ نسبة المواعيد إلى صفقات = المواعيد، ÷ نسبة العملاء إلى مواعيد = العملاء المحتملون، × تكلفة العميل المحتمل = الميزانية'],
      v_healthy: 'جيد', v_thin: 'هامش ضعيف', v_losing: 'خسارة', vNote: 'يقارن تكلفة الصفقة بالربح لكل صفقة.',
      exNames: ['الاتصال المباشر', 'الرسائل النصية', 'البريد المباشر', 'الإعلانات المدفوعة'], newCh: 'قناة جديدة',
      safe: 'هذه أدوات تدريب للتعلّم وليست علاجًا. إذا شعرت أنك في خطر أو في أزمة، اتصل بخدمات الطوارئ المحلية أو بشخص تثق به فورًا.',
      trT: 'سجل الأفكار', trD: 'تمهّل مع لحظة صعبة: ماذا حدث، وما الذي دار في ذهنك، وطريقة أكثر توازنًا لرؤيتها.',
      situation: 'ماذا حدث؟', situationH: 'أين كنت، ومن كان معك، وماذا كان يحدث؟ الوقائع فقط.',
      feeling: 'بماذا شعرت؟', feelingH: 'مثلًا: قلق، حزن، غضب، خجل.', before: 'شدّة الشعور (من 0 إلى 100)', after: 'شدّة الشعور الآن (من 0 إلى 100)',
      thought: 'ما الذي دار في ذهنك؟', thoughtH: 'الفكرة الأقوى أثرًا، بكلماتك أنت.',
      traps: 'أخطاء التفكير التي تلاحظها', trapList: [['all', 'كل شيء أو لا شيء'], ['cat', 'توقّع الأسوأ'], ['mind', 'قراءة الأفكار'], ['fort', 'التنبؤ بالمستقبل'],
        ['should', 'قواعد «يجب»'], ['label', 'إطلاق الأحكام'], ['emo', 'المشاعر كأنها حقائق'], ['over', 'التعميم'], ['disc', 'التقليل من الإيجابيات'], ['pers', 'أخذ الأمور على محمل شخصي']],
      evFor: 'ما الذي يدعم هذه الفكرة؟', evAgainst: 'ما الذي لا يتفق مع هذه الفكرة؟', evAgainstH: 'ماذا كنت ستقول لصديق تراوده هذه الفكرة؟',
      balanced: 'فكرة أكثر توازنًا', balancedH: 'ليست إيجابية بالقوة، بل تناسب كل الوقائع.',
      shift: (a, b) => `${a} → ${b}`,   // the numbers sit in a left-to-right span, so the arrow points right here too
      grT: 'مخطط الأهداف', grD: 'ضع هدفًا بنموذج GROW: الهدف، الواقع، الخيارات، الطريق إلى الأمام. ثم تابع تقدّمك.',
      gGoal: 'الهدف: ماذا تريد؟', gGoalH: 'محدد بما يكفي لتعرف متى تحقق.', gWhy: 'لماذا يهمّك؟',
      gReal: 'الواقع: أين أنت الآن؟', gRealH: 'ما الصحيح الآن، وماذا جرّبت، وما الذي يعيقك؟', gScale: 'كم أنت قريب (من 0 إلى 10)',
      gOpts: 'الخيارات: ماذا يمكنك أن تفعل؟', gOptsH: 'فكرة في كل سطر، حتى الأفكار التي تبدو مستبعدة.',
      gStep: 'الطريق إلى الأمام: خطوتك الأولى', gBy: 'متى', gBlock: 'ما الذي قد يعيقك؟', gHelp: 'من أو ما الذي يمكن أن يساعدك؟',
      gCheck: 'متابعة', gCheckNote: 'ماذا حدث منذ آخر مرة؟', gCheckAdd: 'أضف متابعة', gChecks: 'المتابعات',
      gActive: 'قيد العمل', gDone: 'تحقق', markDone: 'علّمه كمتحقق', markActive: 'علّمه كقيد العمل', untitled: 'بدون عنوان'
    }
  };
  // The Marketing course speaks Egyptian Arabic (see app/course/strings.js); the Psychology course uses formal Arabic.
  // These replace the formal wording on Marketing pages only.
  const AR_EG = {
    tools: 'الأدوات', back: 'كل الأدوات', saved: 'اتحفظ في حسابك', savedHere: 'اتحفظ على الجهاز ده', saving: 'بيتحفظ…',
    privacy: 'اللي بتكتبه هنا محدش بيشوفه غيرك.', loading: 'بيحمّل…',
    cpdT: 'حاسبة تكلفة الصفقة', cpdD: 'حط كل قناة صرفت عليها كام وجابت إيه. هتعرف العميل المحتمل والموعد والصفقة كلفوك كام، ورجعلك كام، ومحتاج ميزانية قد إيه عشان توصل لعدد الصفقات اللي عايزه.',
    chName: 'اسم القناة', spend: 'المصروف', leads: 'عملاء محتملين', appts: 'مواعيد', deals: 'صفقات اتقفلت', profit: 'الربح في الصفقة',
    addCh: 'ضيف قناة', rmCh: 'امسح القناة', example: 'حمّل مثال', clear: 'ابدأ من الأول', clearSure: 'تمسح كل القنوات وتبدأ من الأول؟',
    currency: 'العملة', period: 'الأرقام دي عن', perMonth: 'شهر واحد', perQuarter: '3 شهور', perCustom: 'فترة تانية',
    cpl: 'تكلفة العميل المحتمل', cpa: 'تكلفة الموعد', cpdeal: 'تكلفة الصفقة', l2a: 'من عميل محتمل لموعد', a2d: 'من موعد لصفقة',
    net: 'الربح بعد الماركتينج', roi: 'العائد', per1: v => `كل 1 صرفته رجّعلك ${v}`,
    total: 'كل القنوات مع بعض', planT: 'خطّط بالعكس', target: 'عدد الصفقات اللي عايزه', need: (l, a, b) => `محتاج حوالي <b>${l}</b> عميل محتمل و<b>${a}</b> موعد، وميزانية حوالي <b>${b}</b>.`,
    planNo: 'دخّل المصروف والعملاء المحتملين والمواعيد والصفقات الأول. الخطة بتمشي على نسب القناة دي.',
    how: 'الحساب بيتعمل إزاي', howList: ['تكلفة العميل المحتمل = المصروف ÷ العملاء المحتملين', 'تكلفة الموعد = المصروف ÷ المواعيد', 'تكلفة الصفقة = المصروف ÷ الصفقات اللي اتقفلت',
      'الربح بعد الماركتينج = (الصفقات × الربح في الصفقة) − المصروف', 'العائد = الربح بعد الماركتينج ÷ المصروف', 'الخطة بالعكس: الصفقات اللي عايزها ÷ نسبة المواعيد اللي بتبقى صفقات = المواعيد، ÷ نسبة العملاء اللي بيبقوا مواعيد = العملاء المحتملين، × تكلفة العميل المحتمل = الميزانية'],
    v_healthy: 'كويسة', v_thin: 'الهامش ضعيف', v_losing: 'بتخسر', vNote: 'بيقارن تكلفة الصفقة بالربح في الصفقة.',
    exNames: ['كولد كولينج', 'رسايل SMS', 'دايركت ميل', 'إعلانات مدفوعة'], newCh: 'قناة جديدة'
  };
  let course = '';
  const t = (k, ...a) => { const v = lang === 'ar' && course === 'mkt' && AR_EG[k] != null ? AR_EG[k] : S[lang][k] != null ? S[lang][k] : S.en[k]; return typeof v === 'function' ? v(...a) : v; };

  const TOOLS = {
    mkt: [{ id: 'cpd', t: 'cpdT', d: 'cpdD', icon: 'calc' }],
    psy: [{ id: 'thought', t: 'trT', d: 'trD', icon: 'mind' }, { id: 'grow', t: 'grT', d: 'grD', icon: 'flag' }]
  };
  const ICONS = {
    calc: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h2M16 15v3"/></svg>',
    mind: '<svg viewBox="0 0 24 24"><path d="M12 21c-4 0-7-3-7-7 0-2 1-3 1-5a6 6 0 0 1 12 0c0 2 1 3 1 5 0 4-3 7-7 7z"/><path d="M9 12h6M12 9v6"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>'
  };

  // ---------- saving: this device at once, the account a moment later ----------
  const Notes = (function () {
    const mem = {}, timers = {};
    let state = 'idle', noTable = false, onState = null;
    const k = (c, tool) => 'lh-tools:' + uid() + ':' + c + ':' + tool;
    const setState = s => { state = s; if (onState) onState(s); };
    const missing = e => e && (e.code === '42P01' || /relation .*learn_notes.* does not exist/i.test(e.message || ''));   // migration not run yet
    function local(c, tool) { try { const d = JSON.parse(localStorage.getItem(k(c, tool)) || 'null'); return d && 'v' in d ? d : null; } catch (e) { return null; } }
    function keep(c, tool, d) { try { localStorage.setItem(k(c, tool), JSON.stringify(d)); } catch (e) {} }
    async function push(c, tool) {
      delete timers[c + ':' + tool];
      const d = mem[c + ':' + tool];
      if (!db() || noTable || !d) { setState('here'); return; }
      const { error } = await db().from('learn_notes').upsert({ user_id: uid(), course: c, tool, data: d, updated_at: new Date().toISOString() });
      if (error) { if (missing(error)) noTable = true; setState('here'); return; }
      setState('saved');
    }
    return {
      watch(fn) { onState = fn; if (fn) fn(state); },
      async get(c, tool, blank) {
        const id = c + ':' + tool;
        if (mem[id]) return mem[id].v;
        let d = local(c, tool);
        let readOk = false;
        if (db() && !noTable) {
          const { data: row, error } = await db().from('learn_notes').select('data').eq('user_id', uid()).eq('course', c).eq('tool', tool).maybeSingle();
          if (error) { if (missing(error)) noTable = true; }     // offline or refused: keep this device's copy, say so
          else readOk = true;
          if (error) { /* nothing to compare */ }
          else if (row && row.data && 'v' in row.data && (row.data.at || 0) > ((d && d.at) || 0)) { d = row.data; keep(c, tool, d); }
          else if (d && (!row || ((row.data && row.data.at) || 0) < (d.at || 0))) { mem[id] = d; push(c, tool); }   // this device has newer work
        }
        mem[id] = d || { v: blank(), at: 0 };
        setState(readOk ? 'saved' : 'here');
        return mem[id].v;
      },
      put(c, tool, v) {
        const d = mem[c + ':' + tool] = { v, at: Date.now() };
        keep(c, tool, d); setState('saving');
        const id = c + ':' + tool;
        clearTimeout(timers[id]); timers[id] = setTimeout(() => push(c, tool), 1200);
      },
      flush() { Object.keys(timers).forEach(id => { clearTimeout(timers[id]); const [c, tool] = id.split(':'); push(c, tool); }); }
    };
  })();
  window.addEventListener('pagehide', () => Notes.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Notes.flush(); });

  // ---------- small helpers ----------
  const uidGen = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
  const nloc = () => lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  const fmtN = (n, d = 0) => isFinite(n) ? n.toLocaleString(nloc(), { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '–';
  const pct = n => isFinite(n) ? fmtN(n * 100, 1) + '%' : '–';
  const dateF = ms => new Date(ms).toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const crumb = list => `<nav class="cp-crumb">${list.map((x, i) => (i ? '<span>/</span>' : '') + (x[1] ? `<a href="${x[1]}">${esc(x[0])}</a>` : `<span>${esc(x[0])}</span>`)).join('')}</nav>`;
  const status = () => `<p class="lt-status" id="ltStatus" aria-live="polite"></p>`;
  function bindStatus() {
    Notes.watch(s => { const el = document.getElementById('ltStatus'); if (el) el.textContent = s === 'saving' ? t('saving') : s === 'saved' ? t('saved') + ' · ' + t('privacy') : s === 'here' ? t('savedHere') + ' · ' + t('privacy') : ''; });
  }

  // ======================================================================
  // Marketing: cost per deal calculator
  // ======================================================================
  const CUR = ['USD', 'EGP', 'EUR', 'GBP', 'SAR', 'AED', 'CAD'];
  const blankCpd = () => ({ cur: 'USD', period: 'month', ch: [{ id: uidGen(), name: '', spend: '', leads: '', appts: '', deals: '', profit: '', target: '' }] });
  const money = (n, cur, d = 0) => { if (!isFinite(n)) return '–'; try { return n.toLocaleString(nloc(), { style: 'currency', currency: cur, maximumFractionDigits: d, minimumFractionDigits: 0 }); } catch (e) { return fmtN(n, d) + ' ' + cur; } };

  // All the math for one channel (or the blended total). Blank fields count as zero; a rate is only shown when both sides exist.
  function calc(c) {
    const spend = num(c.spend), leads = num(c.leads), appts = num(c.appts), deals = num(c.deals), profit = num(c.profit);
    const div = (a, b) => b > 0 ? a / b : NaN;
    const r = {
      spend, leads, appts, deals, profit,
      cpl: div(spend, leads), cpa: div(spend, appts), cpd: div(spend, deals),
      l2a: div(appts, leads), a2d: div(deals, appts),
      gross: deals * profit, net: deals * profit - spend, roi: div(deals * profit - spend, spend)
    };
    r.verdict = verdict(r.cpd, profit);
    const target = num(c.target);
    if (target > 0 && r.l2a > 0 && r.a2d > 0 && r.cpl >= 0) {
      const needA = target / r.a2d, needL = needA / r.l2a;
      r.plan = { target, appts: Math.ceil(needA), leads: Math.ceil(needL), budget: needL * r.cpl };
    }
    return r;
  }

  // How healthy a channel is: compares what one deal cost to win with what one deal earns.
  // Wholesaling rule of thumb: marketing should take about a third of a deal's profit or less, which leaves room
  // for caller pay, dialer and data costs, dispositions and closing. Above that the margin gets thin;
  // at 100% or more the channel costs more than the deal makes.
  function verdict(costPerDeal, profitPerDeal) {
    if (!isFinite(costPerDeal) || !(profitPerDeal > 0)) return null;
    const share = costPerDeal / profitPerDeal;   // the part of each deal's profit that marketing used up
    if (share >= 1) return 'losing';
    if (share > 0.35) return 'thin';
    return 'healthy';
  }

  function cpdResults(r, cur, withPlan) {
    const row = (label, val, cls) => `<div class="lt-stat${cls ? ' ' + cls : ''}"><span>${esc(label)}</span><b dir="ltr">${val}</b></div>`;
    let h = '<div class="lt-stats">' +
      row(t('cpl'), money(r.cpl, cur, 2)) + row(t('cpa'), money(r.cpa, cur, 2)) + row(t('cpdeal'), money(r.cpd, cur), 'key') +
      row(t('l2a'), pct(r.l2a)) + row(t('a2d'), pct(r.a2d)) +
      row(t('net'), money(r.net, cur), r.spend || r.gross ? (r.net >= 0 ? 'ok' : 'no') : '') +
      row(t('roi'), pct(r.roi), isFinite(r.roi) ? (r.roi >= 0 ? 'ok' : 'no') : '') + '</div>';
    if (isFinite(r.roi)) h += `<p class="lt-note">${esc(t('per1', fmtN(1 + r.roi, 2)))}</p>`;
    if (r.verdict) h += `<p class="lt-verdict ${r.verdict}"><b>${esc(t('v_' + r.verdict))}</b> <span>${esc(t('vNote'))}</span></p>`;
    if (withPlan) h += r.plan ? `<p class="lt-plan">${t('need', fmtN(r.plan.leads), fmtN(r.plan.appts), esc(money(r.plan.budget, cur)))}</p>` : '';
    return h;
  }

  function cpdChannel(c, i, cur) {
    const f = (k, label, mode) => `<label class="lt-field"><span>${esc(label)}</span><input data-k="${k}" inputmode="${mode || 'decimal'}" value="${esc(c[k])}" autocomplete="off" dir="ltr"></label>`;
    const r = calc(c);
    return `<section class="cp-card lt-ch" data-ch="${esc(c.id)}">
      <div class="lt-chhead"><span class="lt-n">${i + 1}</span><input class="lt-name" data-k="name" value="${esc(c.name)}" placeholder="${esc(t('chName'))}" aria-label="${esc(t('chName'))}" dir="auto">
        <button class="lt-x" type="button" data-rm="${esc(c.id)}" aria-label="${esc(t('rmCh'))}" title="${esc(t('rmCh'))}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="lt-grid">${f('spend', t('spend'))}${f('leads', t('leads'), 'numeric')}${f('appts', t('appts'), 'numeric')}${f('deals', t('deals'), 'numeric')}${f('profit', t('profit'))}</div>
      <div class="lt-res" data-res>${cpdResults(r, cur, false)}</div>
      <details class="lt-plan-box"${c.target ? ' open' : ''}><summary>${esc(t('planT'))}</summary>
        <label class="lt-field lt-inline"><span>${esc(t('target'))}</span><input data-k="target" inputmode="numeric" value="${esc(c.target)}" dir="ltr"></label>
        <div data-plan>${r.plan ? `<p class="lt-plan">${t('need', fmtN(r.plan.leads), fmtN(r.plan.appts), esc(money(r.plan.budget, cur)))}</p>` : (num(c.target) > 0 ? `<p class="lt-note">${esc(t('planNo'))}</p>` : '')}</div>
      </details></section>`;
  }

  function totalOf(st) {
    const sum = k => st.ch.reduce((a, c) => a + num(c[k]), 0);
    const deals = sum('deals'), gross = st.ch.reduce((a, c) => a + num(c.deals) * num(c.profit), 0);
    return calc({ spend: sum('spend'), leads: sum('leads'), appts: sum('appts'), deals, profit: deals > 0 ? gross / deals : 0 });
  }

  async function cpd(el) {
    const st = await Notes.get('mkt', 'cpd', blankCpd);
    if (!el.isConnected) return;          // the learner moved on while this was loading
    const draw = () => {
      const tot = totalOf(st);
      el.innerHTML = `<div class="cp-wrap lt">
        ${crumb([[t('tools'), '#/tools'], [t('cpdT')]])}
        <header><span class="cp-kick">${esc(t('tools'))}</span><h1 class="cp-h1">${esc(t('cpdT'))}</h1><p class="cp-sub">${esc(t('cpdD'))}</p>${status()}</header>
        <div class="lt-bar">
          <label class="lt-field lt-inline"><span>${esc(t('currency'))}</span><select data-g="cur">${CUR.map(c => `<option${c === st.cur ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="lt-field lt-inline"><span>${esc(t('period'))}</span><select data-g="period">${['month', 'quarter', 'custom'].map(p => `<option value="${p}"${p === st.period ? ' selected' : ''}>${esc(t('per' + p[0].toUpperCase() + p.slice(1)))}</option>`).join('')}</select></label>
          <span class="lt-grow"></span>
          <button class="btn ghost" type="button" data-act="example">${esc(t('example'))}</button>
          <button class="btn ghost" type="button" data-act="clear">${esc(t('clear'))}</button>
        </div>
        <div data-chs>${st.ch.map((c, i) => cpdChannel(c, i, st.cur)).join('')}</div>
        <p><button class="btn" type="button" data-act="add">${esc(t('addCh'))}</button></p>
        <section class="cp-card lt-total"><h2>${esc(t('total'))}</h2><div data-tot>${cpdResults(tot, st.cur, false)}</div></section>
        <details class="cp-card lt-how"><summary>${esc(t('how'))}</summary><ul>${t('howList').map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
      </div>`;
      bindStatus();
    };
    const refresh = id => {          // redraw only the numbers so the field being typed in keeps its focus
      const c = st.ch.find(x => x.id === id), box = el.querySelector(`[data-ch="${id}"]`);
      if (c && box) { const r = calc(c); box.querySelector('[data-res]').innerHTML = cpdResults(r, st.cur, false);
        box.querySelector('[data-plan]').innerHTML = r.plan ? `<p class="lt-plan">${t('need', fmtN(r.plan.leads), fmtN(r.plan.appts), esc(money(r.plan.budget, st.cur)))}</p>` : (num(c.target) > 0 ? `<p class="lt-note">${esc(t('planNo'))}</p>` : ''); }
      el.querySelector('[data-tot]').innerHTML = cpdResults(totalOf(st), st.cur, false);
    };
    draw();
    el.oninput = e => {
      const inp = e.target.closest('[data-k]'); if (!inp) return;
      const box = inp.closest('[data-ch]'), c = st.ch.find(x => x.id === box.dataset.ch); if (!c) return;
      c[inp.dataset.k] = inp.value; Notes.put('mkt', 'cpd', st); if (inp.dataset.k !== 'name') refresh(c.id);
    };
    el.onchange = e => { const g = e.target.closest('[data-g]'); if (!g) return; st[g.dataset.g] = g.value; Notes.put('mkt', 'cpd', st); draw(); };
    el.onclick = e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { st.ch = st.ch.filter(x => x.id !== rm.dataset.rm); if (!st.ch.length) st.ch = blankCpd().ch; Notes.put('mkt', 'cpd', st); draw(); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'add') { st.ch.push({ id: uidGen(), name: '', spend: '', leads: '', appts: '', deals: '', profit: '', target: '' }); Notes.put('mkt', 'cpd', st); draw();
        const last = el.querySelectorAll('.lt-name'); if (last.length) last[last.length - 1].focus(); }
      if (a.dataset.act === 'clear' && confirm(t('clearSure'))) { Object.assign(st, blankCpd(), { cur: st.cur }); Notes.put('mkt', 'cpd', st); draw(); }
      if (a.dataset.act === 'example') {
        const n = t('exNames');
        st.ch = [
          { id: uidGen(), name: n[0], spend: '4500', leads: '180', appts: '36', deals: '3', profit: '12000', target: '4' },
          { id: uidGen(), name: n[1], spend: '1800', leads: '140', appts: '21', deals: '1', profit: '9000', target: '' },
          { id: uidGen(), name: n[2], spend: '6000', leads: '90', appts: '27', deals: '2', profit: '15000', target: '' },
          { id: uidGen(), name: n[3], spend: '3000', leads: '120', appts: '12', deals: '0', profit: '10000', target: '' }
        ];
        st.period = 'month'; Notes.put('mkt', 'cpd', st); draw();
      }
    };
  }

  // ======================================================================
  // Psychology: thought record and goal planner (entries are lists of records)
  // ======================================================================
  const blankList = () => ({ items: [] });
  const safety = () => `<p class="lt-safe" role="note">${esc(t('safe'))}</p>`;
  const area = (k, label, hint, val, rows) => `<label class="lt-field lt-wide"><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}<textarea data-k="${k}" rows="${rows || 3}" dir="auto">${esc(val || '')}</textarea></label>`;
  const line = (k, label, hint, val, type) => `<label class="lt-field lt-wide"><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}<input data-k="${k}" type="${type || 'text'}" value="${esc(val || '')}" dir="auto"></label>`;
  const slider = (k, label, val, max) => `<label class="lt-field lt-wide lt-range"><span>${esc(label)} <b data-out="${k}" dir="ltr">${val === '' || val == null ? '–' : esc(val)}</b></span><input data-k="${k}" type="range" min="0" max="${max}" step="${max > 10 ? 5 : 1}" value="${val === '' || val == null ? Math.round(max / 2) : esc(val)}" data-unset="${val === '' || val == null ? 1 : 0}"></label>`;

  function listPage(el, course, tool, st, cfg) {
    const items = st.items.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    el.innerHTML = `<div class="cp-wrap lt">
      ${crumb([[t('tools'), '#/tools'], [t(cfg.title)]])}
      <header><span class="cp-kick">${esc(t('tools'))}</span><h1 class="cp-h1">${esc(t(cfg.title))}</h1><p class="cp-sub">${esc(t(cfg.desc))}</p>${status()}</header>
      ${safety()}
      <p><a class="btn" href="#/tools/${tool}/new">${esc(t('add'))}</a></p>
      ${items.length ? `<div class="lt-list">${items.map(x => `<a class="cp-card lt-entry" href="#/tools/${tool}/${esc(x.id)}"><span class="lt-date">${esc(dateF(x.at))}</span><b dir="auto">${esc(cfg.head(x) || t('untitled'))}</b>${cfg.meta(x) ? `<span class="lt-meta" dir="auto">${cfg.meta(x)}</span>` : ''}</a>`).join('')}</div>` : `<p class="cp-sub">${esc(t('empty'))}</p>`}
    </div>`;
    bindStatus();
  }

  function formPage(el, course, tool, st, id, cfg) {
    const isNew = id === 'new';
    let x = isNew ? null : st.items.find(r => r.id === id);
    if (!isNew && !x) { location.hash = '#/tools/' + tool; return; }
    const draft = x ? JSON.parse(JSON.stringify(x)) : cfg.blank();
    el.innerHTML = `<div class="cp-wrap lt">
      ${crumb([[t('tools'), '#/tools'], [t(cfg.title), '#/tools/' + tool], [isNew ? t('add') : dateF(draft.at)]])}
      <header><h1 class="cp-h1">${esc(t(cfg.title))}</h1>${status()}</header>
      <form class="cp-card lt-form" autocomplete="off">${cfg.form(draft)}
        <div class="lt-actions"><button class="btn" type="submit">${esc(isNew ? t('save') : t('done'))}</button><a class="btn ghost" href="#/tools/${tool}">${esc(t('cancel'))}</a>${isNew ? '' : `<span class="lt-grow"></span><button class="btn ghost lt-del" type="button" data-del>${esc(t('del'))}</button>`}</div>
      </form>
      ${cfg.after ? cfg.after(draft) : ''}
    </div>`;
    bindStatus();
    const form = el.querySelector('form');
    const read = () => {
      form.querySelectorAll('[data-k]').forEach(inp => { if (inp.type === 'range' && inp.dataset.unset === '1') return; draft[inp.dataset.k] = inp.value; });
      if (cfg.readExtra) cfg.readExtra(form, draft);
    };
    const commit = () => {   // existing entries save as you type; new ones save on the first Save
      read();
      if (!x) { draft.id = uidGen(); draft.at = Date.now(); st.items.push(draft); x = draft; history.replaceState(null, '', '#/tools/' + tool + '/' + draft.id); }
      else Object.assign(x, draft);
      Notes.put(course, tool, st);
    };
    form.oninput = e => {
      const inp = e.target;
      if (inp.type === 'range') { inp.dataset.unset = '0'; const o = form.querySelector(`[data-out="${inp.dataset.k}"]`); if (o) o.textContent = inp.value; }
      if (x) { read(); Object.assign(x, draft); Notes.put(course, tool, st); }
    };
    form.onchange = form.oninput;
    form.onsubmit = e => { e.preventDefault(); commit(); location.hash = '#/tools/' + tool; };
    el.onclick = e => {
      if (e.target.closest('[data-del]')) { if (confirm(t('delSure'))) { st.items = st.items.filter(r => r.id !== x.id); Notes.put(course, tool, st); location.hash = '#/tools/' + tool; } return; }
      if (cfg.click) cfg.click(e, x, () => { Notes.put(course, tool, st); formPage(el, course, tool, st, x.id, cfg); });
    };
  }

  const THOUGHT = {
    title: 'trT', desc: 'trD',
    blank: () => ({ situation: '', feeling: '', before: '', thought: '', traps: [], evFor: '', evAgainst: '', balanced: '', after: '' }),
    head: x => x.situation && x.situation.split('\n')[0].slice(0, 90),
    meta: x => [x.feeling ? esc(x.feeling) : '', x.before !== '' && x.after !== '' && x.before != null && x.after != null ? `<span dir="ltr">${esc(t('shift', x.before, x.after))}</span>` : ''].filter(Boolean).join(' · '),
    form: d => area('situation', t('situation'), t('situationH'), d.situation) +
      line('feeling', t('feeling'), t('feelingH'), d.feeling) + slider('before', t('before'), d.before, 100) +
      area('thought', t('thought'), t('thoughtH'), d.thought) +
      `<fieldset class="lt-field lt-wide lt-chips"><legend>${esc(t('traps'))}</legend>${t('trapList').map(([k, l]) => `<label><input type="checkbox" data-trap="${k}"${(d.traps || []).indexOf(k) >= 0 ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</fieldset>` +
      area('evFor', t('evFor'), '', d.evFor) + area('evAgainst', t('evAgainst'), t('evAgainstH'), d.evAgainst) +
      area('balanced', t('balanced'), t('balancedH'), d.balanced) + slider('after', t('after'), d.after, 100),
    readExtra: (form, d) => { d.traps = [...form.querySelectorAll('[data-trap]:checked')].map(i => i.dataset.trap); }
  };

  const GROW = {
    title: 'grT', desc: 'grD',
    blank: () => ({ goal: '', why: '', reality: '', scale: '', options: '', step: '', by: '', block: '', help: '', state: 'active', checks: [] }),
    head: x => x.goal && x.goal.split('\n')[0].slice(0, 90),
    meta: x => {
      const last = (x.checks || []).slice(-1)[0], sc = last && last.scale !== '' ? last.scale : x.scale;
      return [`<span class="chip ${x.state === 'done' ? 'ok' : ''}">${esc(t(x.state === 'done' ? 'gDone' : 'gActive'))}</span>`, sc !== '' && sc != null ? `<span dir="ltr">${esc(sc)}/10</span>` : '', x.by ? esc(t('gBy')) + ' ' + esc(x.by) : ''].filter(Boolean).join(' · ');
    },
    form: d => area('goal', t('gGoal'), t('gGoalH'), d.goal, 2) + area('why', t('gWhy'), '', d.why, 2) +
      area('reality', t('gReal'), t('gRealH'), d.reality) + slider('scale', t('gScale'), d.scale, 10) +
      area('options', t('gOpts'), t('gOptsH'), d.options, 4) +
      area('step', t('gStep'), '', d.step, 2) + line('by', t('gBy'), '', d.by, 'date') +
      area('block', t('gBlock'), '', d.block, 2) + area('help', t('gHelp'), '', d.help, 2),
    after: d => d.id ? `<section class="cp-card lt-checks"><h2>${esc(t('gChecks'))}</h2>
        ${(d.checks || []).slice().reverse().map(c => `<div class="lt-check"><span class="lt-date">${esc(dateF(c.at))}</span>${c.scale !== '' ? `<b dir="ltr">${esc(c.scale)}/10</b>` : ''}<p dir="auto">${esc(c.note)}</p></div>`).join('')}
        <div class="lt-checkform" data-checkform>${area('ckNote', t('gCheckNote'), '', '', 2).replace('data-k=', 'data-ck=')}${slider('ckScale', t('gScale'), '', 10).replace('data-k=', 'data-ck=')}
          <div class="lt-actions"><button class="btn" type="button" data-addcheck>${esc(t('gCheckAdd'))}</button><span class="lt-grow"></span><button class="btn ghost" type="button" data-state>${esc(t(d.state === 'done' ? 'markActive' : 'markDone'))}</button></div></div>
      </section>` : '',
    click: (e, x, save) => {
      if (!x) return;
      if (e.target.closest('[data-state]')) { x.state = x.state === 'done' ? 'active' : 'done'; save(); return; }
      if (e.target.closest('[data-addcheck]')) {
        const box = e.target.closest('[data-checkform]'), note = box.querySelector('[data-ck="ckNote"]').value.trim(), sc = box.querySelector('[data-ck="ckScale"]');
        if (!note && sc.dataset.unset === '1') return;
        (x.checks = x.checks || []).push({ at: Date.now(), note, scale: sc.dataset.unset === '1' ? '' : sc.value });
        save();
      }
    }
  };
  // the check-in slider is outside the main form, so show its number as it moves
  document.addEventListener('input', e => { const s = e.target.closest && e.target.closest('[data-ck="ckScale"]'); if (s) { s.dataset.unset = '0'; const o = document.querySelector('[data-out="ckScale"]'); if (o) o.textContent = s.value; } });

  async function listTool(el, course, tool, cfg, id) {
    const st = await Notes.get(course, tool, blankList);
    if (!el.isConnected) return;          // the learner moved on while this was loading
    if (!Array.isArray(st.items)) st.items = [];
    if (id) formPage(el, course, tool, st, id, cfg); else listPage(el, course, tool, st, cfg);
  }

  // ---------- the Tools page ----------
  function home(el, course) {
    el.innerHTML = `<div class="cp-wrap lt">
      ${crumb([[t('tools')]])}
      <header><h1 class="cp-h1">${esc(t('tools'))}</h1></header>
      ${course === 'psy' ? safety() : ''}
      <div class="lt-tools">${TOOLS[course].map(x => `<a class="cp-card lt-tool" href="#/tools/${x.id}"><span class="lt-ico">${ICONS[x.icon]}</span><span><b>${esc(t(x.t))}</b><span class="cp-sub">${esc(t(x.d))}</span></span></a>`).join('')}</div>
    </div>`;
  }

  window.LH_TOOLS = {
    label: lg => S[lg === 'ar' ? 'ar' : 'en'].tools,
    list: (course, lg) => (TOOLS[course] || []).map(x => ({ id: x.id, title: S[lg === 'ar' ? 'ar' : 'en'][x.t], href: '#/tools/' + x.id })),
    // path: what follows #/tools/ in the address, for example ['cpd'] or ['thought', 'new']
    render: async function (el, opt) {
      lang = opt.lang === 'ar' ? 'ar' : 'en';
      // Draw inside a wrapper, never on the player's own main area: when a lesson replaces it, the wrapper's
      // handlers and language settings go with it, and a slow load can tell it is no longer on the page.
      const host = el; el = document.createElement('div'); el.className = 'lt-root';
      el.lang = lang; el.dir = lang === 'ar' ? 'rtl' : 'ltr';
      host.replaceChildren(el);
      const [tool, id] = (opt.path || []).filter(Boolean);
      course = opt.course;
      if (!TOOLS[course]) { el.innerHTML = ''; return; }
      if (!tool) return home(el, course);
      el.innerHTML = `<p class="cp-msg">${esc(t('loading'))}</p>`;
      try {
        if (course === 'mkt' && tool === 'cpd') return await cpd(el);
        if (course === 'psy' && tool === 'thought') return await listTool(el, course, tool, THOUGHT, id);
        if (course === 'psy' && tool === 'grow') return await listTool(el, course, tool, GROW, id);
      } catch (e) { console.error(e); }
      home(el, course);
    },
    _test: { calc, verdict, totalOf }   // for tools/course-tools/check.mjs
  };
})();
