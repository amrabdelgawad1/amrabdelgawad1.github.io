// Arabic for the app (/app), switched on per device from the menu ("عربي"). Right to left when on.
// How it works: a dictionary of the app's English words and phrases, applied to the page's text, placeholders and
// labels, and again whenever the page changes (a MutationObserver). Anything not in the dictionary stays in English,
// so names, numbers and Amr's own messages are never changed. Switching back to English reloads the page.
// The courses have their own Arabic (their own switch); this file is only the app around them.
// To add a phrase: put the exact English text (as it shows on screen) and its Arabic in AR below.
(function(){
  'use strict';
  const KEY = 'appLang';
  let lang = 'en'; try { lang = localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en'; } catch(e) {}
  const AR = {
    // menu and top bar
    'Overview':'نظرة عامة', 'Portal':'البوابة', 'My hours':'ساعاتي', 'People':'الفريق', 'Team overview':'نظرة على الفريق', 'Live now':'المتصلون الآن',
    'Team and shifts':'الفريق والورديات', 'Missed-shift requests':'طلبات الورديات الفائتة', 'Invite and access':'الدعوات والصلاحيات', 'Onboarding':'تهيئة الموظفين الجدد',
    'Learning':'التعلّم', 'Learning Hub':'مركز التعلّم', 'Learner progress':'تقدّم المتعلّمين', 'Review center':'مركز المراجعة', 'Call scoring':'تقييم المكالمات',
    'Scripts and objections':'السكربتات والاعتراضات', 'Deals':'الصفقات', 'Deal CRM':'إدارة الصفقات', 'Land calculator':'حاسبة الأراضي', 'House calculator':'حاسبة المنازل',
    'Money':'المال', 'Cash':'النقدية', 'Income':'الدخل', 'Expenses':'المصروفات', 'My time':'وقتي', 'Site':'الموقع', 'Visits':'الزيارات', 'Emails':'الرسائل', 'Logs':'السجلات',
    'Download a backup':'تنزيل نسخة احتياطية', 'Install the app':'تثبيت التطبيق', 'Sign out':'تسجيل الخروج', 'Settings':'الإعدادات',
    'Schedule':'الجدول', 'My schedule':'جدولي', 'Coaching':'التوجيه', 'My month':'شهري', 'Callbacks':'معاودة الاتصال', 'Referrals':'الترشيحات', 'What’s new':'الجديد', 'Exit survey':'استبيان المغادرة',
    'Applications':'طلبات التوظيف', 'Offboarding':'إنهاء الخدمة', 'Numbers':'الأرقام', 'Calls to deals':'من المكالمات إلى الصفقات', 'Profit per client':'الربح لكل عميل',
    'Client report':'تقرير العميل', 'Cash forecast':'توقّع النقدية', 'Lead lists':'قوائم العملاء المحتملين', 'Call of the week':'مكالمة الأسبوع',
    // sign in
    'Sign in':'تسجيل الدخول', 'Welcome back':'أهلاً بعودتك', 'One portal for the whole':'بوابة واحدة لكل', 'team':'الفريق', 'Shifts, courses, calls and deals, built for a remote team working US hours.':'الورديات والكورسات والمكالمات والصفقات، مصممة لفريق يعمل عن بُعد بتوقيت أمريكا.', 'Cairo':'القاهرة', 'New York':'نيويورك', 'Username or email':'اسم المستخدم أو البريد', 'Password':'كلمة المرور', 'Forgot password?':'نسيت كلمة المرور؟', 'Show':'إظهار', 'Hide':'إخفاء',
    'Keep me signed in':'تذكّرني', 'Untick on a shared computer':'ألغِ التحديد على جهاز مشترك', 'Sign in to clock in and see your hours':'سجّل الدخول لبدء ورديتك ورؤية ساعاتك',
    // My hours
    'Run':'تشغيل', 'Pause':'إيقاف مؤقت', 'Break':'استراحة', 'Off':'إنهاء', 'Resume':'استئناف', 'Press Run to start your shift':'اضغط تشغيل لبدء ورديتك',
    'This week':'هذا الأسبوع', 'This month':'هذا الشهر', 'Not paid yet':'لم يُدفع بعد', 'My history':'سجلّي', 'Payslips':'قسائم الراتب', 'Your pay':'أجرك',
    'Add a missed shift':'إضافة وردية فائتة', 'Date':'التاريخ', 'Started':'البداية', 'Finished':'النهاية', 'Break (minutes)':'الاستراحة (بالدقائق)', 'Note for Amr (optional)':'ملاحظة لعمرو (اختياري)',
    'Cancel':'إلغاء', 'Send to Amr':'إرسال إلى عمرو', 'Calls this shift':'مكالمات هذه الوردية', 'Undo last':'تراجع عن الأخيرة', 'Dials':'اتصالات', 'Conversations':'محادثات',
    'Offers':'عروض', 'Appointments':'مواعيد', 'Tap +1':'اضغط +1', 'One tap per call. Your end-of-shift numbers fill in from these.':'ضغطة واحدة لكل مكالمة. أرقام نهاية الوردية تُملأ منها.',
    'Do-not-call list':'قائمة عدم الاتصال', 'Phone number':'رقم الهاتف', 'Check':'تحقّق', 'Add to the list':'أضف إلى القائمة', 'List you’re dialing':'القائمة التي تتصل بها', 'No list / not sure':'بدون قائمة / غير متأكد',
    'Still working?':'ما زلت تعمل؟', 'Yes, still working':'نعم، ما زلت أعمل', 'I forgot to clock out':'نسيت إنهاء الوردية', 'Working':'يعمل', 'On break':'في استراحة', 'Paused':'متوقف',
    'Loading…':'جارٍ التحميل…', 'Nothing yet.':'لا شيء بعد.', 'Saved':'تم الحفظ', 'Save':'حفظ', 'Close':'إغلاق', 'Open':'فتح', 'Done':'تم', 'Delete':'حذف', 'Back':'رجوع',
    // Team home
    'Your areas':'أقسامك', 'Next lesson':'الدرس التالي', 'Continue':'متابعة', 'Your onboarding':'تهيئتك', 'See the checklist':'عرض القائمة', 'Callbacks due':'مكالمات معاودة مستحقة',
    'This week on the team':'هذا الأسبوع في الفريق', 'Not open for you yet':'غير متاح لك بعد', 'Ask for access':'اطلب الصلاحية', 'Your commissions':'عمولاتك', 'Clock in':'ابدأ الوردية', 'Clock out':'أنهِ الوردية',
    // new pages
    'You':'أنت', 'Team':'الفريق', 'Calls':'المكالمات', 'Thank you':'شكرًا لك', 'Before you go':'قبل أن تغادر', 'A short exit survey for Amr':'استبيان قصير لعمرو',
    'earned so far':'المكتسب حتى الآن', 'heading for this month':'المتوقع لهذا الشهر', 'worked':'ساعات العمل', 'dials':'اتصالات', 'Your calls this month':'مكالماتك هذا الشهر', 'Extra this month':'إضافي هذا الشهر',
    'Commissions':'العمولات', 'Referral bonuses':'مكافآت الترشيح', 'Coming up':'القادم', 'Last two weeks':'آخر أسبوعين', 'Time off':'إجازة', 'From':'من', 'To':'إلى', 'Why (optional)':'السبب (اختياري)',
    'Ask for time off':'اطلب إجازة', 'Waiting for Amr':'بانتظار عمرو', 'Approved':'موافق عليها', 'Declined':'مرفوضة', 'Cancelled':'ملغاة', 'On time':'في الموعد', 'Late':'متأخر', 'Missed':'فائتة',
    'Not clocked in yet':'لم يبدأ بعد', 'Who do you know?':'من تعرف؟', 'Their name':'اسمه', 'Phone or WhatsApp':'الهاتف أو واتساب', 'Email (optional)':'البريد (اختياري)', 'Why they’d be good (optional)':'لماذا سيكون مناسبًا (اختياري)',
    'Your referrals':'ترشيحاتك', 'New':'جديد', 'Talking to them':'قيد التواصل', 'Hired, bonus coming':'تم التعيين، المكافأة قادمة', 'Bonus paid':'دُفعت المكافأة', 'Not hired':'لم يُعيَّن',
    'Refer a friend':'رشّح صديقًا', 'Tip':'نصيحة', 'Work on this':'اعمل على هذا', 'Well done':'أحسنت', 'Focus today':'تركيز اليوم', 'Whole team':'الفريق كله', 'Just for you':'لك أنت', 'Pinned':'مثبّت',
    'All tips':'كل النصائح', 'Latest':'الأحدث', 'Callback times':'مواعيد المعاودة', 'Open callbacks':'معاودات مفتوحة', 'Add a callback':'أضف معاودة اتصال', 'Save callback':'حفظ المعاودة',
    'State':'الولاية', 'Their time zone':'منطقتهم الزمنية', 'Day':'اليوم', 'Time, their time':'الوقت بتوقيتهم', 'Note (optional)':'ملاحظة (اختياري)', 'Due now':'مستحقة الآن',
    'New in the portal':'الجديد في البوابة', 'All updates':'كل التحديثات', 'Send my answers':'أرسل إجاباتي', 'Not at all':'إطلاقًا', 'Very':'جدًا', 'Yes':'نعم', 'Maybe':'ربما', 'No':'لا',
    'What is the main reason you are leaving?':'ما السبب الرئيسي لمغادرتك؟', 'What did you enjoy most about the work?':'ما أكثر ما استمتعت به في العمل؟',
    'What one thing should we change to make this a better place to work?':'ما الشيء الواحد الذي يجب أن نغيّره ليصبح العمل أفضل؟',
    'How well did the training prepare you for live calls?':'إلى أي مدى أعدّك التدريب للمكالمات الحقيقية؟', 'How supported did you feel by Amr?':'إلى أي مدى شعرت بدعم عمرو؟',
    'How fair did the pay feel for the work?':'إلى أي مدى كان الأجر عادلًا مقابل العمل؟', 'Which tool or part of the portal got in your way the most?':'أي أداة أو جزء من البوابة عطّلك أكثر؟',
    'Would you recommend working here to a friend?':'هل تنصح صديقًا بالعمل هنا؟', 'Would you come back one day?':'هل ستعود يومًا ما؟', 'Anything else you want Amr to know?':'هل هناك شيء آخر تريد أن يعرفه عمرو؟',
    'From Amr':'من عمرو', 'Announcement':'إعلان', 'Pay extra':'إضافة على الراتب', 'Announcements':'الإعلانات', 'Pay extras total':'إجمالي الإضافات', 'Report a problem or idea':'أبلغ عن مشكلة أو فكرة', 'Profile':'الملف الشخصي', 'Notifications':'الإشعارات'
  };
  // Phrases with numbers in them
  const RULES = [
    [/^(\d+) shifts?$/, (m, n) => n + ' ' + (n === '1' ? 'وردية' : 'ورديات')],
    [/^(\d+) of (\d+) done$/, (m, a, b) => 'تم ' + a + ' من ' + b],
    [/^(\d+) due soon$/, (m, n) => n + ' مستحقة قريبًا'],
    [/^(\d+) open$/, (m, n) => n + ' مفتوحة'],
    [/^(\d+) new tips?$/, (m, n) => n + ' نصائح جديدة'],
    [/^(\d+) new ones?$/, (m, n) => n + ' جديدة'],
    [/^In (\d+) min$/, (m, n) => 'بعد ' + n + ' دقيقة'],
    [/^Late (\d+) min$/, (m, n) => 'متأخر ' + n + ' دقيقة']
  ];
  const tr = s => {
    const t = s.trim(); if (!t) return null;
    if (AR[t]) return s.replace(t, AR[t]);
    for (const [re, fn] of RULES) { const m = t.match(re); if (m) return s.replace(t, fn.apply(null, m)); }
    return null;
  };
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  function walk(root){
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) { const v = tr(n.nodeValue); if (v != null && v !== n.nodeValue) n.nodeValue = v; }
    (root.querySelectorAll ? root.querySelectorAll('[placeholder],[aria-label],[title]') : []).forEach(el => ATTRS.forEach(a => { const o = el.getAttribute(a); if (o) { const v = tr(o); if (v != null && v !== o) el.setAttribute(a, v); } }));
  }
  function on(){
    document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl';
    walk(document.body);
    // Only what changed is walked again (the clock ticks every second; the whole page each time would be wasteful)
    let pending = new Set(), queued = false;
    new MutationObserver(list => {
      list.forEach(r => pending.add(r.type === 'characterData' ? r.target.parentNode : r.target));
      if (queued) return; queued = true;
      requestAnimationFrame(() => { queued = false; const s = pending; pending = new Set(); s.forEach(el => el && el.isConnected && walk(el)); });
    }).observe(document.body, { childList:true, subtree:true, characterData:true });
  }
  // The switch, at the bottom of the menu (and on the sign-in card)
  function addSwitch(){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mi'; b.id = 'langBtn'; b.lang = lang === 'ar' ? 'en' : 'ar';
    b.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.7 2.5 14.3 0 17M12 3.5c-2.5 2.7-2.5 14.3 0 17"/></svg>';
    b.appendChild(document.createTextNode(lang === 'ar' ? 'English' : 'عربي'));
    b.addEventListener('click', () => { try { localStorage.setItem(KEY, lang === 'ar' ? 'en' : 'ar'); } catch(e) {} location.reload(); });
    const bottom = document.querySelector('#drawer .bottom');
    if (bottom) bottom.insertBefore(b, bottom.firstChild);
    const login = document.querySelector('#loginForm .note');
    if (login) { const l = b.cloneNode(true); l.id = 'langBtn2'; l.className = 'linkish'; l.addEventListener('click', () => { try { localStorage.setItem(KEY, lang === 'ar' ? 'en' : 'ar'); } catch(e) {} location.reload(); }); login.after(l); }
  }
  const start = () => { addSwitch(); if (lang === 'ar') on(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.AppLang = { get lang(){ return lang; }, AR };
})();
