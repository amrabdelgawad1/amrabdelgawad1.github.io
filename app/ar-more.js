// Arabic for the pages added in rounds 11 and 12 (Tasks, Messages, Handbook, Daily review, Course builder, Search,
// Today, Start here, Person files, hiring scorecards). Added to the same dictionary as i18n.js, so the same switch works.
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  Object.assign(L.AR, {
    // menu
    'Work':'العمل', 'Tasks':'المهام', 'Messages':'الرسائل', 'Handbook':'دليل العمل', 'Daily review':'المراجعة اليومية', 'Course builder':'محرّر الكورسات',
    'Person files':'ملفات الفريق', 'Search the portal':'ابحث في البوابة', 'Search':'بحث', 'Find anything':'ابحث عن أي شيء',
    'Team updates':'أخبار الفريق', 'Reviews and scoring':'المراجعات والتقييم', 'People and access':'الفريق والصلاحيات', 'Site and logs':'الموقع والسجلات',
    // Tasks
    'Today and late':'اليوم والمتأخر', 'Later':'لاحقاً', 'No date':'بدون تاريخ', 'New task':'مهمة جديدة', 'Done lately':'أُنجز مؤخراً', 'Task':'المهمة', 'For':'لـ', 'Me':'أنا',
    'Due':'موعد التسليم', 'Repeats':'تتكرر', 'No':'لا', 'Every day':'كل يوم', 'Every week':'كل أسبوع', 'Every month':'كل شهر', 'Notes (optional)':'ملاحظات (اختياري)',
    'Add task':'أضف المهمة', 'Delete':'حذف', 'Sure?':'متأكد؟', 'Today':'اليوم', 'You':'أنت', 'Nothing due today.':'لا شيء مطلوب اليوم.', 'Nothing here.':'لا شيء هنا.',
    'Ticked tasks show here.':'المهام المنجزة تظهر هنا.', 'Write the task first.':'اكتب المهمة أولاً.',
    'What you need to do, from Amr or from you. Tick it when it’s done.':'ما عليك فعله، من عمرو أو منك. علّم عليها عند الانتهاء.',
    // Messages
    'Whole team':'كل الفريق', 'Send':'إرسال', 'Write a message':'اكتب رسالة', 'No messages yet':'لا توجد رسائل بعد', 'No messages yet. Say hello.':'لا توجد رسائل بعد. قل مرحباً.',
    'Everyone on the team sees this thread':'كل الفريق يرى هذه المحادثة', 'Only you and Amr':'أنت وعمرو فقط', 'Amr':'عمرو',
    'Talk to Amr here, or to the whole team.':'تحدّث مع عمرو هنا، أو مع كل الفريق.',
    // Handbook
    'Search the handbook':'ابحث في الدليل', 'I read and understood this page':'قرأت هذه الصفحة وفهمتها', 'You read this':'قرأت هذه الصفحة', 'Edit page':'تعديل الصفحة',
    '+ New page':'+ صفحة جديدة', 'Save page':'حفظ الصفحة', 'Cancel':'إلغاء', 'How we work. Read each page and tick it when you understand it.':'طريقة عملنا. اقرأ كل صفحة وعلّم عليها عندما تفهمها.',
    'How a shift works':'كيف تعمل الوردية', 'Logging calls':'تسجيل المكالمات', 'Pay and payslips':'الأجر وقسائم الراتب', 'Time off':'الإجازات', 'Tools and accounts':'الأدوات والحسابات', 'When something breaks':'عندما يتعطل شيء',
    // Daily review
    'streak':'أيام متتالية', 'cards today':'بطاقات اليوم', 'cards in total':'كل البطاقات', 'Check':'تحقّق', 'Next card':'البطاقة التالية', 'Finish':'إنهاء',
    'Right.':'صحيح.', 'Not this time.':'ليس هذه المرة.', 'This card comes back later.':'ستعود هذه البطاقة لاحقاً.', 'It comes back tomorrow.':'ستعود غداً.',
    'Pick an answer first.':'اختر إجابة أولاً.', 'Pick every answer that is right.':'اختر كل الإجابات الصحيحة.', 'All done':'انتهيت', 'Done for today':'انتهيت لليوم',
    'Back to the Learning Hub':'العودة إلى مركز التعلّم', 'Nice work. The ones you missed come back tomorrow.':'عمل رائع. الأسئلة التي أخطأت فيها ستعود غداً.',
    'Questions you missed in a quiz come back here. Get one right and it comes back later; miss it and it comes back tomorrow. A few minutes a day is enough.':'الأسئلة التي أخطأت فيها في الاختبارات تعود هنا. إن أجبت صحيحاً تعود لاحقاً، وإن أخطأت تعود غداً. بضع دقائق يومياً تكفي.',
    // Today and Start here
    'Start here':'ابدأ من هنا', 'All clear':'لا شيء متأخر', 'Hide this':'إخفاء', 'Say hello to Amr':'قل مرحباً لعمرو', 'Open your first lesson':'افتح أول درس',
    'Clock in for your first shift':'ابدأ أول وردية', 'Read “How a shift works”':'اقرأ «كيف تعمل الوردية»', 'Put the portal on your phone':'ضع البوابة على هاتفك',
    'Messages replaces WhatsApp for work':'الرسائل بديل واتساب في العمل', 'Your courses are in the Learning Hub':'كورساتك في مركز التعلّم',
    'From your home page, before your first dial':'من صفحتك الرئيسية، قبل أول اتصال', 'Two minutes in the Handbook':'دقيقتان في دليل العمل',
    'Nothing due right now. New tasks, callbacks and deal follow-ups show up here.':'لا شيء مطلوب الآن. المهام ومعاودات الاتصال ومتابعات الصفقات تظهر هنا.',
    'Callback':'معاودة اتصال', 'Deal':'صفقة', 'Now':'الآن', 'Follow-up due today':'متابعة مطلوبة اليوم', 'Due today':'مطلوب اليوم', 'No due date':'بدون موعد',
    // Search
    'Pages, people, tasks, handbook pages, scripts and deals.':'الصفحات والأشخاص والمهام وصفحات الدليل والسكربتات والصفقات.', 'Type to search':'اكتب للبحث',
    'Start typing. Try a name, “pay”, “callback” or a county.':'ابدأ الكتابة. جرّب اسماً أو «الأجر» أو «معاودة» أو مقاطعة.', 'Page':'صفحة', 'Person':'شخص', 'Script':'سكربت',
    // clock-out
    'Count as you go (optional)':'العدّ أثناء العمل (اختياري)',
    'You type your dials, conversations and appointments when you clock out. Counting as you go is optional.':'تكتب اتصالاتك ومحادثاتك ومواعيدك عند إنهاء الوردية. العدّ أثناء العمل اختياري.',
    'Fill in your dials, conversations, offers and appointments for today. Type 0 if there were none.':'املأ اتصالاتك ومحادثاتك وعروضك ومواعيدك لليوم. اكتب 0 إن لم يكن هناك شيء.'
  });
})();

// Round 13: Leaderboard, Today's targets, script picker, Weekly summary, Client invoices, Receipts, Script testing,
// course home and the Daily review across all courses. Pattern phrases (with numbers) go in RULES.
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  Object.assign(L.AR, {
    // menu and page titles
    'Numbers':'الأرقام', 'Leaderboard':'لوحة الترتيب', 'Weekly summary':'ملخص الأسبوع', 'Client invoices':'فواتير العملاء', 'Receipts':'الإيصالات',
    'Script testing':'اختبار السكربتات', 'Course home':'صفحة الكورس', 'Money':'المال', 'Learning':'التعلّم',
    // Leaderboard
    'Ranked by appointments, then conversations, then dials. Numbers update when each shift is clocked out.':'الترتيب حسب المواعيد، ثم المحادثات، ثم الاتصالات. تتحدّث الأرقام عند إنهاء كل وردية.',
    'Ranked by appointments, then conversations, then dials. Today’s taps count while people are on the clock.':'الترتيب حسب المواعيد، ثم المحادثات، ثم الاتصالات. ضغطات اليوم تُحسب أثناء الوردية.',
    'Last week':'الأسبوع الماضي', 'This week so far':'هذا الأسبوع حتى الآن', 'Ranking':'الترتيب', 'Name':'الاسم', 'Shifts':'الورديات', 'Hours':'الساعات',
    'Conv.':'محادثات', 'Appts':'مواعيد', 'Conv. rate':'نسبة المحادثات', 'Period':'الفترة', 'On the clock now':'في الوردية الآن',
    'No shifts in this period yet.':'لا توجد ورديات في هذه الفترة بعد.', 'Daily targets':'الأهداف اليومية', 'Shown on each rep’s home':'تظهر في صفحة كل مندوب',
    'Leave a box empty for no target. Reps see their progress during the day.':'اترك الخانة فارغة إن لم يكن هناك هدف. يرى المندوبون تقدّمهم خلال اليوم.',
    'Rep':'المندوب', 'Dials a day':'اتصالات في اليوم', 'Conversations a day':'محادثات في اليوم', 'Offers a day':'عروض في اليوم', 'Appointments a day':'مواعيد في اليوم',
    'Save':'حفظ', 'Saved.':'تم الحفظ.', 'Couldn’t save.':'تعذّر الحفظ.', 'Couldn’t save. Try again.':'تعذّر الحفظ. حاول مرة أخرى.',
    // Today's targets and script picker (rep home)
    'Today’s targets':'أهداف اليوم', 'Counts from your taps today, or from your clock-out numbers.':'الأرقام من ضغطاتك اليوم، أو من أرقام نهاية ورديتك.',
    'Script I’m using today':'السكربت الذي أستخدمه اليوم', 'Pick one (helps Amr see what works)':'اختر واحداً (يساعد عمرو على معرفة ما ينجح)',
    // Weekly summary
    'Everything that needs you this week on one page. Last week by default; switch to this week so far.':'كل ما يحتاجك هذا الأسبوع في صفحة واحدة. الأسبوع الماضي افتراضياً؛ يمكنك التبديل إلى هذا الأسبوع حتى الآن.',
    'hours worked':'ساعات العمل', 'pay earned':'الأجر المستحق', 'pay owed (all time)':'الأجر غير المدفوع (الكل)', 'deals closed · profit':'صفقات مغلقة · الربح',
    'New deals':'صفقات جديدة', 'Under contract':'تحت التعاقد', 'Closed':'مغلقة', 'By person':'حسب الشخص', 'Pay':'الأجر', 'Not paid':'غير مدفوع',
    'Needs you':'يحتاجك', 'Waiting for you':'بانتظارك', 'Not looked at yet':'لم تُراجع بعد', 'Overdue tasks':'مهام متأخرة', 'No overdue tasks.':'لا توجد مهام متأخرة.',
    'Late starts':'بدايات متأخرة', 'Behind on lessons':'متأخرون في الدروس', 'Everyone studied this week.':'الجميع درس هذا الأسبوع.',
    'Commissions to add':'عمولات للإضافة', 'None':'لا شيء', 'Every closed deal has its commission.':'كل صفقة مغلقة لها عمولتها.', 'Add commission':'أضف العمولة',
    // Client invoices
    'Build an invoice from a client’s hours and rate, print it or save it as a PDF, mark it sent, then paid. A paid invoice is added to Cash as income, and its team shifts are marked paid by the client.':'أنشئ فاتورة من ساعات العميل وسعره، اطبعها أو احفظها PDF، علّمها مُرسلة ثم مدفوعة. الفاتورة المدفوعة تُضاف إلى النقدية كدخل، وتُعلَّم ورديات الفريق فيها مدفوعة من العميل.',
    'New invoice':'فاتورة جديدة', 'Client':'العميل', 'Note on the invoice (optional)':'ملاحظة على الفاتورة (اختياري)', 'Preview':'معاينة', 'Create invoice':'أنشئ الفاتورة',
    'Invoices':'الفواتير', 'Amount':'المبلغ', 'Status':'الحالة', 'Draft':'مسودة', 'Sent':'مُرسلة', 'Paid':'مدفوعة', 'View':'عرض', 'Mark sent':'علّمها مُرسلة', 'Mark paid':'علّمها مدفوعة',
    'From':'من', 'To':'إلى', 'Print or save as PDF':'اطبع أو احفظ PDF',
    // Receipts
    'Attach a photo or PDF to each expense, so every cost has its proof. Files are private to you.':'أرفق صورة أو PDF لكل مصروف، ليكون لكل تكلفة إثبات. الملفات خاصة بك.',
    'recent expenses':'مصروفات حديثة', 'with a receipt':'مع إيصال', 'missing a receipt':'بدون إيصال', 'Attach':'إرفاق', 'Open':'فتح', 'Replace':'استبدال',
    // Script testing
    'Reps pick the script they use each day on their home page. This compares the results of each script over the last 60 days.':'يختار المندوبون السكربت الذي يستخدمونه كل يوم من صفحتهم. هنا نقارن نتائج كل سكربت خلال آخر 60 يوماً.',
    'Results by script':'النتائج حسب السكربت', 'Last 60 days':'آخر 60 يوماً',
    'No data yet. Once reps pick “Script I’m using today” on their home page, results show here.':'لا توجد بيانات بعد. عندما يختار المندوبون «السكربت الذي أستخدمه اليوم» من صفحتهم، تظهر النتائج هنا.',
    'A script needs at least 100 dials before it can be called the best. Results only count shifts where the rep picked a script.':'يحتاج السكربت إلى 100 اتصال على الأقل قبل أن يُعتبر الأفضل. تُحسب فقط الورديات التي اختار فيها المندوب سكربتاً.',
    // Course home and Daily review
    'Acquisitions Playbook':'دليل الاستحواذ', 'Acquisitions':'الاستحواذ', 'Marketing':'التسويق', 'Psychology':'علم النفس', 'Psychology and Therapy':'علم النفس والعلاج',
    'Course':'الكورس', 'Outline':'المحتوى', 'Not started':'لم يبدأ', 'Locked':'مقفل', 'In progress':'قيد التقدّم', 'Done':'تم', 'Continue':'متابعة', 'Start':'ابدأ',
    'From the first call to a signed contract.':'من أول مكالمة إلى عقد موقّع.', 'From the first idea to running a full growth system.':'من أول فكرة إلى تشغيل نظام نمو كامل.',
    'Foundations, therapy models, crisis skills, ethics and coaching practice.':'الأساسيات، ونماذج العلاج، ومهارات الأزمات، والأخلاقيات، وممارسة الكوتشينج.',
    'Lessons open in the course’s own reader. The portal menu stays, so you can always come back here.':'تُفتح الدروس في قارئ الكورس. تبقى قائمة البوابة، فيمكنك دائماً العودة إلى هنا.',
    'This course isn’t open for you yet. Ask Amr to switch it on.':'هذا الكورس غير متاح لك بعد. اطلب من عمرو تفعيله.',
    'Questions you missed in any course come back here. Get one right and it comes back later; miss it and it comes back tomorrow. A few minutes a day is enough.':'الأسئلة التي أخطأت فيها في أي كورس تعود هنا. إن أجبت صحيحاً تعود لاحقاً، وإن أخطأت تعود غداً. دقائق قليلة يومياً تكفي.',
    'Questions you miss in any course quiz are added here on their own.':'الأسئلة التي تخطئ فيها في أي اختبار تُضاف هنا تلقائياً.',
    'Couldn’t check it. Try again.':'تعذّر التحقّق. حاول مرة أخرى.', 'Loading…':'جارٍ التحميل…'
  });
  if (!L.RULES) return;
  L.RULES.push(
    [/^(\d+) of (\d+) hit$/, (m, a, b) => 'تحقّق ' + a + ' من ' + b],
    [/^(\d+) days?$/, (m, n) => n + (n === '1' ? ' يوم' : ' أيام')],
    [/^Card (\d+) of (\d+) · (.+)$/, (m, a, b, c) => 'بطاقة ' + a + ' من ' + b + ' · ' + (L.AR[c] || c)],
    [/^(\d+) of (\d+) modules · (\d+)%$/, (m, a, b, c) => a + ' من ' + b + ' وحدات · ' + c + '%'],
    [/^(\d+) modules?$/, (m, n) => n + (n === '1' ? ' وحدة' : ' وحدات')],
    [/^(\d+) lessons?$/, (m, n) => n + (n === '1' ? ' درس' : ' دروس')],
    [/^Quiz passed · (.+)$/, (m, a) => 'اجتاز الاختبار · ' + a],
    [/^(.+) leads (this week|last week|this month) with (\d+) (appointments?|conversations?|dials?)\.$/, (m, who, per, n, what) =>
      who + ' في الصدارة ' + ({ 'this week':'هذا الأسبوع', 'last week':'الأسبوع الماضي', 'this month':'هذا الشهر' })[per] + ' بـ ' + n + ' ' + ({ appointment:'موعد', appointments:'مواعيد', conversation:'محادثة', conversations:'محادثات', dial:'اتصال', dials:'اتصالات' })[what] + '.'],
    [/^(\w+) target for (.+)$/, (m, k, who) => 'هدف ' + ({ dials:'الاتصالات', conversations:'المحادثات', offers:'العروض', appointments:'المواعيد' }[k] || k) + ' لـ ' + who]
  );
})();

// Round 14: shift swaps, saved replies, checklists and phone alerts (the parts the team sees)
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  Object.assign(L.AR, {
    'Swap or give away a shift':'تبديل وردية أو التنازل عنها', 'Give away':'تنازل عنها', 'Swap':'تبديل', 'Take it':'خذها', 'Up for grabs':'متاحة للأخذ', 'Your requests':'طلباتك',
    'Can’t make a shift? Offer it here. Another rep takes it, Amr approves, and both schedules change. Everyone gets a bell at each step.':'لا تستطيع حضور وردية؟ اعرضها هنا. يأخذها زميل، ويوافق عمرو، ويتغير الجدولان. يصل تنبيه للجميع في كل خطوة.',
    'No coming shifts to offer.':'لا توجد ورديات قادمة لعرضها.', 'Nothing offered right now.':'لا شيء معروض الآن.', 'Offered':'معروضة', 'Giving away':'تنازل',
    'Waiting for Amr':'بانتظار عمرو', 'Approved':'تمت الموافقة', 'Declined':'مرفوض', 'Cancelled':'أُلغي', 'Back out':'تراجع', 'Offer it to the team':'اعرضها على الفريق', 'Ask for a swap':'اطلب تبديلاً',
    'Why (optional)':'السبب (اختياري)', 'You need a coming shift to swap':'تحتاج وردية قادمة للتبديل',
    'Saved replies':'ردود محفوظة', 'Save what I typed':'احفظ ما كتبت', 'Manage':'إدارة', 'Pick one to add it':'اختر رداً لإضافته', 'None yet':'لا يوجد بعد', 'Team':'الفريق',
    'Type the message first, then save it.':'اكتب الرسالة أولاً ثم احفظها.', 'Short name, e.g. Shift reminder':'اسم قصير، مثل تذكير الوردية',
    'Phone alerts':'تنبيهات الهاتف', 'Allow alerts on this phone':'السماح بالتنبيهات على هذا الهاتف', 'Send a test alert':'أرسل تنبيهاً تجريبياً', 'Turn off on this phone':'إيقاف على هذا الهاتف',
    'Alerts are on for this phone.':'التنبيهات مفعّلة على هذا الهاتف.', 'Alerts are off for this phone.':'التنبيهات متوقفة على هذا الهاتف.',
    'Get a notification on this phone for each new bell: messages, tasks, callbacks, schedule changes, swaps and late starts.':'يصلك إشعار على هذا الهاتف مع كل تنبيه جديد: الرسائل والمهام ومعاودات الاتصال وتغييرات الجدول والتبديلات والتأخير.',
    'On iPhone, alerts work only from the app on your Home Screen (iOS 16.4 or later): open this site in Safari, tap Share › Add to Home Screen, open the portal from that icon, then come back here.':'على الآيفون، تعمل التنبيهات فقط من التطبيق على الشاشة الرئيسية (iOS 16.4 أو أحدث): افتح الموقع في Safari، ثم مشاركة › إضافة إلى الشاشة الرئيسية، وافتح البوابة من الأيقونة، ثم عد إلى هنا.',
    'Sent. It should show in a few seconds, even with the app closed.':'تم الإرسال. سيظهر خلال ثوانٍ، حتى والتطبيق مغلق.', 'Contracts':'العقود'
  });
})();
(function(){ const L = window.AppLang; if (!L || !L.RULES) return;
  L.RULES.push([/^(\d+) of (\d+) lessons(?: · (\d+) quiz(?:zes)? passed)?$/, (m, a, b, q) => a + ' من ' + b + ' دروس' + (q ? ' · اجتاز ' + q + ' اختبار' : '')]); })();
