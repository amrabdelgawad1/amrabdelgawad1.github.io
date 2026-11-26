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
    'Fill in your dials, conversations, offers and appointments for today. Type 0 if there were none.':'املأ اتصالاتك ومحادثاتك وعروضك ومواعيدك لليوم. اكتب 0 إن لم يكن هناك شيء.',
    // Round 17: daily alerts email
    'Email me a daily list of new alerts':'أرسل لي بريدًا يوميًا بالتنبيهات الجديدة', 'Cairo time':'بتوقيت القاهرة', 'at':'في',
    'Saved. Only alerts you haven’t opened are sent, once a day.':'تم الحفظ. تُرسل التنبيهات التي لم تفتحها فقط، مرة واحدة يوميًا.', 'Daily email off.':'البريد اليومي متوقف.',
    'Version history':'سجل النسخ', 'Put this version back':'أعد هذه النسخة', 'Sure? Click again':'متأكد؟ اضغط مرة أخرى', 'View':'عرض', 'Hide':'إخفاء',
    'Putting a version back keeps the current words as a version too.':'عند إعادة نسخة، يُحفظ النص الحالي كنسخة أيضًا.',
    'This week':'هذا الأسبوع', 'Streak':'أيام متتالية', 'Days worked':'أيام العمل', 'Weekly targets':'الأهداف الأسبوعية', 'Save weekly targets':'احفظ الأهداف الأسبوعية', 'Rep':'المندوب',
    'Dials':'الاتصالات', 'Conversations':'المحادثات', 'Offers':'العروض', 'Appointments':'المواعيد', 'Monday to today, Cairo time':'من الإثنين حتى اليوم، بتوقيت القاهرة',
    'Call library':'مكتبة المكالمات', 'Objection':'الاعتراض', 'Stage':'المرحلة', 'Any objection':'أي اعتراض', 'Any stage':'أي مرحلة', 'Not tagged yet':'غير مصنّفة بعد',
    'Play':'تشغيل', 'Tag':'صنّف', 'Edit tags':'عدّل التصنيف', 'Save tags':'احفظ التصنيف', 'Stage of the call':'مرحلة المكالمة', 'Objections in this call':'الاعتراضات في هذه المكالمة', 'Note (optional)':'ملاحظة (اختياري)',
    'Opening':'الافتتاح', 'Building rapport':'بناء العلاقة', 'Motivation':'الدافع', 'Timeline':'الجدول الزمني', 'Property condition':'حالة العقار', 'Price and numbers':'السعر والأرقام',
    'Making the offer':'تقديم العرض', 'Handling objections':'التعامل مع الاعتراضات', 'Closing and next step':'الإغلاق والخطوة التالية', 'Follow-up call':'مكالمة متابعة',
    'Lead lists':'قوائم العملاء', 'My lead lists':'قوائمي', 'Calling hours':'ساعات الاتصال', 'Add a list':'أضف قائمة', 'Save list':'احفظ القائمة', 'Your lists':'قوائمك', 'Manage':'إدارة', 'Close':'إغلاق',
    'Reps who call this list':'المندوبون الذين يتصلون بهذه القائمة', 'Skip trace':'البحث عن الأرقام', 'Not sent':'لم تُرسل', 'Sent to skip trace':'أُرسلت للبحث', 'Partly back':'عاد جزء منها', 'Back':'عادت',
    'Download clean CSV':'نزّل ملف CSV نظيف', 'Download rows with no phone':'نزّل الصفوف بلا رقم', 'Upload skip trace results':'ارفع نتائج البحث', 'Retire this list':'أوقف هذه القائمة', 'Put back in use':'أعدها للاستخدام', 'Delete list':'احذف القائمة',
    'Leave out duplicates':'استبعد المكرر', 'rows in the file':'صفوف في الملف', 'duplicates in the file':'مكرر داخل الملف', 'already in a saved list':'موجود في قائمة محفوظة', 'on your do-not-call list':'في قائمة عدم الاتصال', 'rows to save':'صفوف للحفظ',
    'Open':'افتح', 'All my lists':'كل قوائمي', 'Owner':'المالك', 'Phone':'الهاتف', 'Property':'العقار', 'Their time':'توقيتهم', 'Outcome':'النتيجة',
    'No answer':'لا رد', 'Left voicemail':'ترك رسالة صوتية', 'Callback':'معاودة الاتصال', 'Not interested':'غير مهتم', 'Interested':'مهتم', 'Appointment set':'تم تحديد موعد', 'Wrong number':'رقم خاطئ', 'Do not call':'عدم الاتصال',
    'All states':'كل الولايات', 'Only states open now':'الولايات المفتوحة الآن فقط', 'Every state':'كل الولايات', 'Open now':'مفتوح الآن', 'Closed':'مغلق', 'Rule':'القاعدة', 'Add rule':'أضف قاعدة', 'Edit':'تعديل',
    'Back to federal only':'عودة للقاعدة الفيدرالية فقط', 'Sundays allowed':'الأحد مسموح', 'Holidays allowed':'العطلات مسموحة', 'Note or law':'ملاحظة أو قانون',
    'Learner analytics':'تحليلات المتعلمين', 'Where people drop off':'أين يتوقف المتعلمون', 'Where each learner stopped':'أين توقف كل متعلم', 'Quizzes failed most':'أكثر الاختبارات رسوبًا',
    'Video watch time':'وقت مشاهدة الفيديو', 'per lesson':'لكل درس', 'per person':'لكل شخص', 'learners':'متعلمون', 'biggest drop':'أكبر انخفاض', 'quiz tries failed':'محاولات اختبار فاشلة', 'video watched':'فيديو تمت مشاهدته',
    'Learner':'المتعلم', 'Last step':'آخر خطوة', 'Module':'الوحدة', 'When':'متى', 'Quiz':'الاختبار', 'Tries':'المحاولات', 'Failed':'رسب', 'Fail rate':'نسبة الرسوب', 'People':'الأشخاص', 'Avg score':'متوسط الدرجة', 'Left midway':'تركوا في المنتصف',
    'Video':'الفيديو', 'Viewers':'المشاهدون', 'Watched on average':'متوسط المشاهدة', 'Got to on average':'متوسط أبعد نقطة', 'Finished':'أنهوا', 'Total watched':'إجمالي المشاهدة', 'Length':'المدة', 'Videos opened':'فيديوهات مفتوحة', 'Time watched':'وقت المشاهدة', 'Last watched':'آخر مشاهدة',
    'Most stop after this':'يتوقف معظمهم بعد هذه', 'Quiet a week+':'غائب أسبوعًا أو أكثر',
    'More checks':'فحوصات أخرى', 'RentCast and narration':'RentCast والتعليق الصوتي', 'RentCast lookups':'عمليات بحث RentCast', 'Put back missing rows':'أعد الصفوف المفقودة',
    'Type the table name to confirm':'اكتب اسم الجدول للتأكيد', 'Daily alerts email':'بريد التنبيهات اليومي',
    'Budgets and savings goals':'الميزانيات وأهداف الادخار', 'Monthly budgets':'الميزانيات الشهرية', 'Savings goals':'أهداف الادخار', 'Save budget':'احفظ الميزانية', 'Add goal':'أضف هدفًا',
    'Files':'الملفات', 'Upload':'رفع', 'Put it in':'ضعه في', 'Folder (optional)':'المجلد (اختياري)', 'My files':'ملفاتي', 'Team shared':'مشترك مع الفريق', 'Place':'المكان', 'Everywhere':'كل مكان',
    'Type':'النوع', 'Any type':'أي نوع', 'File':'الملف', 'Size':'الحجم', 'Added':'أُضيف', 'Files Amr shares with the team.':'ملفات يشاركها عمرو مع الفريق.', 'Nothing shared yet.':'لا شيء مشترك بعد.',
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
    'Sent. It should show in a few seconds, even with the app closed.':'تم الإرسال. سيظهر خلال ثوانٍ، حتى والتطبيق مغلق.', 'Contracts':'العقود',
    // Round 15: command center and search
    'Right now':'الآن', 'On shift':'في الوردية', 'Narration':'التعليق الصوتي', 'Cash this month':'المال هذا الشهر', 'Everything':'كل شيء',
    'Narration PC':'جهاز التعليق الصوتي', 'Online':'متصل', 'Narrating now':'يسجّل الآن', 'In the queue':'في الانتظار', 'Finished today':'انتهى اليوم',
    'Came in':'دخل', 'Spent':'صُرف', 'Profit so far':'الربح حتى الآن', 'Still expected':'ما زال متوقعًا', 'In pounds':'بالجنيه', 'Nothing':'لا شيء',
    'Nobody is clocked in':'لا أحد يعمل الآن', 'Open the bell':'افتح التنبيهات', 'Give access':'امنح الصلاحية', 'Decide':'قرّر', 'Approve':'وافق', 'Read':'اقرأ',
    'PC online':'الجهاز متصل', 'PC offline':'الجهاز غير متصل', 'Pages, people, tasks, handbook pages, scripts, deals, contracts, files, updates and lessons.':'الصفحات والأشخاص والمهام ودليل العمل والنصوص والصفقات والعقود والملفات والأخبار والدروس.'
  });
})();
(function(){ const L = window.AppLang; if (!L || !L.RULES) return;
  L.RULES.push([/^(\d+) of (\d+) lessons(?: · (\d+) quiz(?:zes)? passed)?$/, (m, a, b, q) => a + ' من ' + b + ' دروس' + (q ? ' · اجتاز ' + q + ' اختبار' : '')]); })();

// Round 20: agreements, data cleanup, status checks, earnings, bonus rules, templates, phone-alert card, callbacks
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  Object.assign(L.AR, {
    'Earnings':'الأرباح', 'Templates':'القوالب', 'Data cleanup':'تنظيف البيانات', 'Agreements':'الموافقات',
    'Please read and agree':'يرجى القراءة والموافقة', 'Agree and continue':'موافق ومتابعة', 'Sign out':'تسجيل الخروج',
    'Terms of use':'شروط الاستخدام', 'Privacy policy':'سياسة الخصوصية', 'Refund policy':'سياسة الاسترداد',
    'pay from hours':'الأجر من الساعات', 'paid so far':'المدفوع حتى الآن', 'commissions and bonuses':'العمولات والمكافآت', 'still coming (all time)':'المتبقي لك (كل الوقت)',
    'Bonuses you can earn':'مكافآت يمكنك كسبها', 'Commissions':'العمولات', 'Bonuses':'المكافآت', 'Referral bonuses':'مكافآت الترشيح', 'Print statement':'اطبع الكشف',
    'Person':'الشخص', 'Month':'الشهر', 'Paid':'مدفوع', 'Owed':'مستحق', 'Earned':'مكتسب', 'Mark paid':'علّم كمدفوع',
    'Pay days':'أيام الدفع', 'Bonus rules':'قواعد المكافآت', 'Add rule':'أضف قاعدة', 'Bonuses to pay':'مكافآت للدفع',
    'Texts and emails':'رسائل نصية وبريد', 'Texts':'رسائل نصية', 'Emails':'بريد إلكتروني', 'New template':'قالب جديد', 'Pick a template':'اختر قالباً',
    'Copy':'نسخ', 'Copied.':'تم النسخ.', 'Open in Messages':'افتح في الرسائل', 'Open in email':'افتح في البريد', 'Edit':'تعديل', 'Make my own copy':'أنشئ نسختي',
    'Sellers':'البائعون', 'Buyers':'المشترون', 'Agents':'الوكلاء', 'Other':'أخرى', 'Share with the team':'شاركه مع الفريق', 'Save':'حفظ', 'Cancel':'إلغاء',
    'Call back':'معاودة الاتصال', 'Save callback':'حفظ المعاودة', 'Turn on phone alerts':'فعّل تنبيهات الهاتف', 'Not now':'ليس الآن',
    'So callbacks, tasks, messages and bonuses reach you even when the portal is closed.':'حتى تصلك المعاودات والمهام والرسائل والمكافآت حتى والبوابة مغلقة.',
    'Rules':'القواعد', 'Run it now':'شغّله الآن', 'Run cleanup now':'شغّل التنظيف الآن', 'Recent runs':'آخر مرات التشغيل', 'Keep for':'الاحتفاظ لمدة', 'Keep forever':'احتفظ دائماً', 'Delete on its own':'احذف تلقائياً',
    'Email, spam and phone alerts':'البريد والرسائل المزعجة وتنبيهات الهاتف', 'Email delivery':'وصول البريد', 'Phone alerts':'تنبيهات الهاتف',
    'Pages and versions':'الصفحات والإصدارات', 'Records':'السجلات', 'Download CSV':'تنزيل CSV', 'Ask everyone again':'اطلب الموافقة من الجميع مجدداً',
    // Round 21
    'A streak counts the working days in a row that hit your daily targets. A weekend doesn’t break it; more than 3 days without a shift, or a worked day under target, starts it again. With no daily targets set, every worked day counts.':'تحسب الأيام المتتالية أيام العمل المتتالية التي حققت فيها أهدافك اليومية. عطلة نهاية الأسبوع لا تقطعها، لكن أكثر من 3 أيام بدون وردية أو يوم عمل تحت الهدف يبدأها من جديد. إذا لم تُحدَّد أهداف يومية، يُحسب كل يوم عمل.'
  });
})();

// Round 19 of the plan: payroll, bonuses and deductions, commission ledger, hours vs billing
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  Object.assign(L.AR, {
    'Payroll':'الرواتب', 'Commissions':'العمولات', 'Hours vs billing':'الساعات مقابل الفواتير',
    'Every other Friday: who is owed what for the pay cycle, approve it, mark each person paid, and make their payslip. This page prepares and tracks pay only; you send the money yourself.':'كل جمعتين: من له كم في دورة الدفع، اعتمدها، علّم كل شخص كمدفوع، واصنع قسيمة راتبه. هذه الصفحة تجهّز الأجور وتتابعها فقط؛ أنت من يرسل المال بنفسك.',
    'Pay cycle':'دورة الدفع', 'Not approved yet':'لم تُعتمد بعد', 'Approved':'معتمدة', 'All paid':'دُفعت كلها', 'To pay':'للدفع',
    'Payroll here only prepares and records pay. Send the money yourself (Remitly, bank, InstaPay), then press':'الرواتب هنا تجهّز الأجور وتسجّلها فقط. أرسل المال بنفسك (Remitly أو البنك أو InstaPay)، ثم اضغط',
    'for that person.':'لهذا الشخص.', 'Mark paid':'علّم كمدفوع', 'Undo paid':'تراجع عن الدفع', 'Sure? Back to owed':'متأكد؟ سيعود مستحقاً',
    'in this run':'في هذه الدفعة', 'owed for this cycle':'مستحق لهذه الدورة', 'hours to pay':'ساعات للدفع', 'Commission-based hours aren’t paid by the hour':'ساعات العمولة لا تُدفع بالساعة',
    'bonuses and commissions':'المكافآت والعمولات', 'deductions':'الخصومات', 'marked paid':'مُعلَّم كمدفوع',
    'This run':'هذه الدفعة', 'Who is owed what':'من له كم', 'Person':'الشخص', 'Hours':'الساعات', 'Pay':'الأجر', 'Bonuses':'المكافآت', 'Deductions':'الخصومات', 'Status':'الحالة',
    'Details':'التفاصيل', 'Hide':'إخفاء', 'Payslip':'قسيمة الراتب', 'from earlier cycles':'من دورات سابقة', 'commission based':'بالعمولة',
    'What':'البند', 'Date':'التاريخ', 'Detail':'التفصيل', 'Amount':'المبلغ', 'Bonus (rule)':'مكافأة (قاعدة)', 'Bonus':'مكافأة', 'Commission':'عمولة', 'Deduction':'خصم', 'earlier cycle':'دورة سابقة', 'Nothing owed.':'لا شيء مستحق.',
    'Nobody is owed anything for this cycle.':'لا أحد له مستحقات في هذه الدورة.',
    'Note on this run (optional)':'ملاحظة على هذه الدفعة (اختياري)', 'Approve this run':'اعتمد هذه الدفعة',
    'Approving saves exactly what each person is owed now. Nothing is paid or sent.':'الاعتماد يحفظ ما يستحقه كل شخص الآن بالضبط. لا يُدفع ولا يُرسل شيء.',
    'Reopen this run':'أعد فتح هذه الدفعة', 'Sure? You approve it again after':'متأكد؟ ستعتمدها مرة أخرى بعدها',
    'Paid on':'تاريخ الدفع', '$1 in pounds that day':'سعر الدولار بالجنيه ذلك اليوم', 'How':'الطريقة', 'Reference (optional)':'المرجع (اختياري)', 'Cancel':'إلغاء',
    'Bank transfer':'تحويل بنكي', 'Other':'أخرى',
    'Bonuses and deductions':'المكافآت والخصومات', 'this cycle':'هذه الدورة', 'None for this cycle yet.':'لا شيء لهذه الدورة بعد.', 'Type':'النوع', 'Reason':'السبب', 'Remove':'إزالة',
    'Amount (USD)':'المبلغ (دولار)', 'Reason (shown on the payslip)':'السبب (يظهر في قسيمة الراتب)', 'Add to this cycle':'أضف لهذه الدورة',
    'Open ones carry into the next run until they are paid.':'المفتوحة تنتقل للدفعة التالية حتى تُدفع.',
    'Past runs':'الدفعات السابقة', 'Cycle':'الدورة', 'Pay day':'يوم الدفع', 'People':'الأشخاص', 'Total':'الإجمالي', 'Paid':'مدفوع', 'No runs approved yet.':'لم تُعتمد أي دفعة بعد.',
    'Every commission in one place: from closed deals, per appointment from saved shifts, or added by hand. Owed or paid, per person. Owed ones are paid with the next payroll run.':'كل العمولات في مكان واحد: من الصفقات المغلقة، أو لكل موعد من الورديات المحفوظة، أو مضافة يدوياً. مستحقة أو مدفوعة، لكل شخص. المستحقة تُدفع مع دفعة الرواتب التالية.',
    'owed':'مستحق', 'paid this month':'مدفوع هذا الشهر', 'all time':'كل الوقت', 'By person':'حسب الشخص', 'Owed':'مستحق', 'No commissions yet.':'لا عمولات بعد.',
    'Ledger':'السجل', 'Everyone':'الجميع', 'Owed and paid':'المستحق والمدفوع', 'From':'من', 'To':'إلى', 'All':'الكل', 'For':'عن', 'Deal':'صفقة', 'Appointments':'مواعيد', 'Added by you':'أضفتها أنت',
    'Back to owed':'أرجعها مستحقة', 'Delete':'حذف', 'Sure?':'متأكد؟', 'Nothing matches.':'لا نتائج.',
    'Paying through Payroll marks these paid for you. Mark paid here only for one you paid on its own. Each commission is also a line in Cash › Expenses (category Commissions).':'الدفع من صفحة الرواتب يعلّمها مدفوعة تلقائياً. علّمها هنا فقط إن دفعتها وحدها. كل عمولة تظهر أيضاً في Cash › المصروفات (فئة العمولات).',
    'Per-appointment rates':'أسعار لكل موعد', 'On':'مفعّل', 'Off':'متوقف', 'Turn off':'أوقف', 'Turn on':'فعّل', 'Sure? Added ones stay':'متأكد؟ المضافة تبقى',
    'No rates yet. Add one to pay a person per appointment they set.':'لا أسعار بعد. أضف سعراً لتدفع للشخص عن كل موعد يحجزه.',
    'Per appointment (USD)':'لكل موعد (دولار)', 'Count from':'احسب من', 'Also count commission-based shifts (normally the client pays those)':'احسب أيضاً ورديات العمولة (عادةً يدفعها العميل)', 'Save rate':'احفظ السعر',
    'Appointments come from what reps type when they clock out. A shift’s commission is added when you open this page or Payroll.':'المواعيد تأتي مما يكتبه المندوبون عند تسجيل الخروج. عمولة الوردية تُضاف عند فتح هذه الصفحة أو صفحة الرواتب.',
    'Add a commission by hand':'أضف عمولة يدوياً', 'Add commission':'أضف العمولة', 'They get a bell in the portal when it is added.':'يصله تنبيه في البوابة عند إضافتها.',
    'For each client: the hours your team worked, what that should bill at the client’s rate, what is on invoices, what is not on any invoice yet, and what the client has paid.':'لكل عميل: ساعات عمل فريقك، وكم يجب أن تُفوتر بسعر العميل، وما في الفواتير، وما لم يدخل أي فاتورة بعد، وما دفعه العميل.',
    'Dates':'التواريخ', 'This month':'هذا الشهر', 'Last month':'الشهر الماضي', 'This pay cycle':'دورة الدفع الحالية', 'Last pay cycle':'دورة الدفع السابقة', 'Pick dates':'اختر التواريخ', 'Make an invoice':'أنشئ فاتورة',
    'team hours':'ساعات الفريق', 'should bill':'يجب فوترته', 'hours × each shift’s client rate':'الساعات × سعر العميل لكل وردية', 'on invoices':'في الفواتير', 'invoices inside these dates':'فواتير داخل هذه التواريخ',
    'not on any invoice':'خارج أي فاتورة', 'paid by clients':'دفعه العملاء', 'shifts marked paid by the client':'ورديات علّمها العميل كمدفوعة', 'By client':'حسب العميل',
    'Client':'العميل', 'Rate':'السعر', 'Should bill':'يجب فوترته', 'On invoices':'في الفواتير', 'Not invoiced':'غير مفوتر', 'Client paid':'دفع العميل', 'Team pay':'أجر الفريق', 'Margin':'الهامش', 'Check':'المراجعة',
    'Matches':'مطابق', 'An invoice crosses these dates':'فاتورة تتجاوز هذه التواريخ', 'Invoices':'الفواتير', 'No invoice touches these dates.':'لا فاتورة في هذه التواريخ.', 'Shifts with no rate':'ورديات بلا سعر', 'No hourly shifts.':'لا ورديات بالساعة.',
    'No team hours or invoices in these dates.':'لا ساعات فريق أو فواتير في هذه التواريخ.', 'No client set':'بدون عميل', 'Draft':'مسودة', 'Sent':'مرسلة', 'Next pay day':'يوم الدفع القادم',
    'Should bill uses the rate saved on each shift when it was logged. A shift counts as invoiced when an invoice for that client covers its date. Set a missing rate in Cash › Team hours › Clients.':'«يجب فوترته» يستخدم السعر المحفوظ مع كل وردية عند تسجيلها. تُحسب الوردية مفوترة إذا غطت تاريخها فاتورة لذلك العميل. أضف السعر الناقص من Cash › ساعات الفريق › العملاء.'
  });
  // Round 21: Me area (routine, goals, Upwork and LinkedIn, study planner, work log) and Settings › Devices
  Object.assign(L.AR, {
    'Me':'أنا', 'Routine':'الروتين', 'Goals':'الأهداف', 'Study planner':'مخطط المذاكرة', 'Work log':'سجل العمل', 'Upwork and LinkedIn':'أب وورك ولينكدإن',
    'Me today':'يومي', 'Only you see this':'تراه أنت فقط', 'Routine today':'روتين اليوم', 'Study':'المذاكرة', 'Goal steps':'خطوات الأهداف', 'Nothing planned':'لا شيء مخطط',
    'Nothing logged yet':'لم يُسجَّل شيء بعد', 'No follow-ups due':'لا متابعات مستحقة', 'None due':'لا شيء مستحق', 'This page is only for Amr.':'هذه الصفحة لعمرو فقط.',
    // Routine
    'Sleep, gym and study, ticked off each day. Days follow Cairo time. A habit is due on the days you pick, or a number of times a week.':'النوم والجيم والمذاكرة، تُعلَّم كل يوم. الأيام بتوقيت القاهرة. العادة مطلوبة في الأيام التي تختارها، أو عدد مرات في الأسبوع.',
    'done today':'تم اليوم', 'daily habits kept':'العادات اليومية المنجزة', 'last 7 days':'آخر 7 أيام', 'Week starts Monday':'الأسبوع يبدأ الاثنين',
    'Nothing due today. Add a habit below.':'لا شيء مطلوب اليوم. أضف عادة بالأسفل.', 'Last 14 days':'آخر 14 يوماً', 'tap a day to tick or untick it':'اضغط على اليوم لتعليمه أو إلغائه',
    'Habit':'العادة', 'Habits':'العادات', 'No habits yet.':'لا عادات بعد.', '✓ done · empty box = due and not done · dot = not due that day.':'✓ تم · مربع فارغ = مطلوب ولم يتم · نقطة = غير مطلوب ذلك اليوم.',
    'Edit':'تعديل', 'Pause':'إيقاف مؤقت', 'Turn on':'فعّل', 'Paused':'متوقف مؤقتاً', 'Every day':'كل يوم', '+ Add a habit':'+ أضف عادة', 'How often':'كم مرة',
    'On these days':'في هذه الأيام', 'Times a week':'مرات في الأسبوع', 'Days':'الأيام', 'Note (optional)':'ملاحظة (اختياري)', 'Save habit':'احفظ العادة',
    'Name the habit.':'اكتب اسم العادة.', 'Pick at least one day.':'اختر يوماً واحداً على الأقل.', 'Sure? Its ticks go too':'متأكد؟ ستُحذف علاماتها أيضاً',
    'Slept on plan':'نمت حسب الخطة', 'Gym':'الجيم', 'Study block':'فترة مذاكرة', 'Sun':'الأحد', 'Mon':'الاثنين', 'Tue':'الثلاثاء', 'Wed':'الأربعاء', 'Thu':'الخميس', 'Fri':'الجمعة', 'Sat':'السبت',
    // Goals
    'Big goals broken into small steps. Progress is the share of steps done.':'أهداف كبيرة مقسّمة إلى خطوات صغيرة. التقدّم هو نسبة الخطوات المنجزة.',
    'active goals':'أهداف نشطة', 'steps done this week':'خطوات أُنجزت هذا الأسبوع', 'next step due':'الخطوة التالية', 'No dates set':'لا مواعيد محددة', 'steps past their date':'خطوات تجاوزت موعدها',
    'Active':'نشطة', 'Done':'تم', 'Paused or dropped':'متوقفة أو متروكة', '+ New goal':'+ هدف جديد', 'New goal':'هدف جديد', 'Goal':'الهدف', 'Area':'المجال', 'By (optional)':'بحلول (اختياري)',
    'Why it matters (optional)':'لماذا يهم (اختياري)', 'Add goal':'أضف الهدف', 'Save goal':'احفظ الهدف', 'Write the goal first.':'اكتب الهدف أولاً.', 'Add a step':'أضف خطوة', 'Add':'أضف',
    'Mark goal done':'علّم الهدف كمنجز', 'Drop':'اترك', 'Make active again':'أعده نشطاً', 'Close edit':'أغلق التعديل', 'Sure? Its steps go too':'متأكد؟ ستُحذف خطواته أيضاً', 'Dropped':'متروك',
    'No active goals yet. Add one, then break it into steps you can finish in a day or two.':'لا أهداف نشطة بعد. أضف هدفاً، ثم قسّمه إلى خطوات تنهيها في يوم أو يومين.',
    'Career':'المهنة', 'Money':'المال', 'Learning':'التعلّم', 'Health':'الصحة', 'Family':'العائلة', 'Faith':'الدين', 'Business':'العمل الخاص', 'Other':'أخرى',
    // Upwork and LinkedIn
    'Every proposal, application and outreach message, the Connects it cost, and what came back. This is only a log: nothing here sends anything on Upwork or LinkedIn.':'كل عرض وطلب ورسالة تواصل، وكم كلّف من Connects، وما الرد. هذا سجل فقط: لا شيء هنا يرسل أي شيء على أب وورك أو لينكدإن.',
    '+ Log a proposal or message':'+ سجّل عرضاً أو رسالة', 'sent':'أُرسل', 'Connects spent':'Connects مستخدمة', 'replies':'ردود', 'interviews':'مقابلات', 'wins':'فوز',
    'Log one':'سجّل واحداً', 'Follow up today':'تابع اليوم', 'Follow up':'المتابعة', 'Platform':'المنصة', 'What':'ماذا', 'Update':'حدّث', 'By platform':'حسب المنصة',
    'Sent':'أُرسل', 'Connects':'Connects', 'Replies':'الردود', 'Reply rate':'نسبة الرد', 'Interviews':'المقابلات', 'Wins':'الفوز', 'Log':'السجل', 'Still open':'ما زال مفتوحاً',
    'Proposal':'عرض', 'Application':'طلب توظيف', 'Message':'رسالة', 'Connection request':'طلب تواصل', 'Invite from client':'دعوة من عميل', 'Viewed':'شوهد', 'Replied':'ردّ', 'Interview':'مقابلة',
    'Offer':'عرض عمل', 'Hired':'تم التعيين', 'Not chosen':'لم يُختر', 'No reply':'لا رد', 'Withdrawn':'مسحوب', 'Type':'النوع', 'Sent on':'أُرسل في', 'Job or person':'الوظيفة أو الشخص',
    'Client or company (optional)':'العميل أو الشركة (اختياري)', 'Link (optional)':'الرابط (اختياري)', 'Rate asked (optional)':'السعر المطلوب (اختياري)', 'Follow up on (optional)':'تابع في (اختياري)',
    'Notes (optional)':'ملاحظات (اختياري)', 'Log it':'سجّله', 'Save':'احفظ', 'Write the job or the person first.':'اكتب الوظيفة أو الشخص أولاً.', 'The link should start with https://':'يجب أن يبدأ الرابط بـ https://',
    'Nothing logged yet. Log each proposal when you send it, with the Connects it cost.':'لم يُسجَّل شيء بعد. سجّل كل عرض عند إرساله، مع عدد الـ Connects.',
    'Last 30 days':'آخر 30 يوماً', 'Last 90 days':'آخر 90 يوماً', 'All time':'كل الوقت', 'This week':'هذا الأسبوع',
    // Study planner
    'Plan your study blocks for the week, tick them when done, and see how close you are to each weekly target. Days and times follow Cairo time.':'خطّط فترات مذاكرتك للأسبوع، وعلّمها عند الانتهاء، وشاهد قربك من هدف كل أسبوع. الأيام والأوقات بتوقيت القاهرة.',
    '+ Add study blocks':'+ أضف فترات مذاكرة', 'Copy last week’s plan':'انسخ خطة الأسبوع الماضي', 'studied this week':'ذاكرت هذا الأسبوع', 'blocks today':'فترات اليوم',
    'Acquisitions items done':'عناصر الاستحواذ المنجزة', 'Psychology parts done':'أجزاء علم النفس المنجزة', 'Not started in the course app':'لم تبدأ في تطبيق الكورس',
    'Add study blocks':'أضف فترات مذاكرة', 'Weekly targets':'أهداف الأسبوع', 'Edit targets':'عدّل الأهداف', 'Done editing':'انتهيت من التعديل', 'No subjects yet.':'لا مواد بعد.', 'Free':'فارغ',
    'Change minutes':'غيّر الدقائق', 'Your courses':'كورساتك', 'Acquisitions Playbook':'دليل الاستحواذ', 'Psychology and coaching':'علم النفس والكوتشينج', 'Marketing A to Z':'التسويق من الألف إلى الياء',
    'Open the Learning Hub':'افتح مركز التعلّم', 'Learner analytics':'تحليلات المتعلّمين', 'Subject':'المادة', 'Starts (optional)':'يبدأ (اختياري)', 'Minutes':'الدقائق',
    'What to study (optional)':'ماذا تذاكر (اختياري)', 'Days this week':'أيام هذا الأسبوع', 'Add blocks':'أضف الفترات', 'Pick a subject.':'اختر مادة.', 'At least 5 minutes.':'5 دقائق على الأقل.',
    'New subject':'مادة جديدة', 'Minutes a week':'دقائق في الأسبوع', 'Add subject':'أضف المادة', 'Remove':'إزالة', 'Already copied.':'نُسخت بالفعل.', 'Last week has no blocks.':'الأسبوع الماضي بلا فترات.',
    'Acquisitions':'الاستحواذ', 'Psychology':'علم النفس', 'This week':'هذا الأسبوع',
    // Work log
    'Jot each task as you go. Get morning, midday and end-of-day drafts in your Slack format. Drafts only: copy one and post it yourself. Nothing is posted or sent from here.':'سجّل كل مهمة أثناء العمل. احصل على مسودات الصباح ومنتصف اليوم ونهاية اليوم بصيغة سلاك. مسودات فقط: انسخها وانشرها بنفسك. لا يُنشر أو يُرسل أي شيء من هنا.',
    'Work day (New York date)':'يوم العمل (تاريخ نيويورك)', 'done':'تم', 'in progress':'قيد التنفيذ', 'planned':'مخطط', 'pending':'معلّق', 'Add a task':'أضف مهمة', 'press Enter to add':'اضغط Enter للإضافة',
    'Vendor or property (optional)':'المورّد أو العقار (اختياري)', 'Vendor or property':'المورّد أو العقار', 'Status':'الحالة', 'Planned':'مخطط', 'In progress':'قيد التنفيذ', 'Pending':'معلّق',
    'Still open from earlier days':'ما زال مفتوحاً من أيام سابقة', 'Bring to today':'انقلها لليوم', 'It’s done':'تمّت', 'Bring all to today':'انقل الكل لليوم', 'Today’s log':'سجل اليوم',
    'Nothing logged for this day yet.':'لم يُسجَّل شيء لهذا اليوم بعد.', 'Report drafts':'مسودات التقارير', 'for Slack, nothing is sent':'لسلاك، لا يُرسل شيء', 'Morning plan':'خطة الصباح', 'Midday':'منتصف اليوم',
    'End of day':'نهاية اليوم', 'Opening line':'سطر البداية', 'Draft':'المسودة', 'Copy':'نسخ', 'Save this draft':'احفظ هذه المسودة', 'Rebuild from the log':'أعد البناء من السجل',
    'Built from the log. Edit it here, then copy it into Slack yourself.':'مبنية من السجل. عدّلها هنا، ثم انسخها إلى سلاك بنفسك.', 'Copied. Paste it into Slack and post it yourself.':'تم النسخ. الصقها في سلاك وانشرها بنفسك.',
    'Selected. Press Ctrl+C (or Copy) to copy it.':'تم التحديد. اضغط Ctrl+C للنسخ.', 'Sure? Your edits go':'متأكد؟ ستضيع تعديلاتك', 'Write the task first.':'اكتب المهمة أولاً.',
    'Same vendor or property is grouped into one bullet. Dashes are turned into commas. Starts with your opening line and ends with “Thank you!”.':'نفس المورّد أو العقار يُجمع في نقطة واحدة. الشرطات تتحول إلى فواصل. تبدأ بسطر البداية وتنتهي بـ «Thank you!».',
    // Settings › Devices
    'Devices':'الأجهزة', 'Devices and sessions':'الأجهزة والجلسات', 'This device':'هذا الجهاز', 'No other devices are signed in.':'لا أجهزة أخرى مسجّلة الدخول.', 'See every device':'اعرض كل الأجهزة',
    'Every phone, computer and browser signed in to your account. If one isn’t yours, sign it out and change your password.':'كل هاتف وكمبيوتر ومتصفح مسجّل الدخول إلى حسابك. إن لم يكن أحدها لك، سجّل خروجه وغيّر كلمة المرور.',
    'A device you sign out stops working within the hour, as soon as its sign-in needs renewing. Times are your device’s time.':'الجهاز الذي تسجّل خروجه يتوقف خلال ساعة، عند تجديد تسجيل دخوله. الأوقات بتوقيت جهازك.',
    'Refresh the app to see your devices.':'حدّث التطبيق لترى أجهزتك.', 'Couldn’t load your devices. Check your connection and try again.':'تعذّر تحميل أجهزتك. تحقق من الاتصال وحاول مجدداً.',
    // Round 33 part 1: help center (P2) and the phone bar (P16)
    'Help center':'مركز المساعدة', 'Help':'المساعدة', 'Help for this page':'مساعدة لهذه الصفحة', 'Close help':'إغلاق المساعدة', 'How each page works':'كيف تعمل كل صفحة',
    'Short how-tos for every part of the portal. Tap the ? at the top of any page to open the one for that page.':'شروحات قصيرة لكل جزء من البوابة. اضغط علامة ? أعلى أي صفحة لتفتح شرح تلك الصفحة.',
    'Search help':'ابحث في المساعدة', 'Take the Start here tour':'ابدأ جولة «ابدأ من هنا»', 'Edit articles':'تعديل المقالات', 'All help articles':'كل مقالات المساعدة',
    'Edit this article':'تعديل هذه المقالة', 'Edit':'تعديل', 'Hidden from the team':'مخفية عن الفريق', 'Only you':'لك وحدك', 'Hidden':'مخفية',
    'There’s no help article for this page yet.':'لا توجد مقالة مساعدة لهذه الصفحة بعد.', ' Ask Amr in Messages if something isn’t clear.':' اسأل عمرو في الرسائل إذا كان شيء غير واضح.',
    'Nothing found. Try another word, or ask Amr in Messages.':'لم نجد شيئاً. جرّب كلمة أخرى، أو اسأل عمرو في الرسائل.',
    'This article isn’t here, or it isn’t for your pages. ':'هذه المقالة غير موجودة، أو ليست لصفحاتك. ', 'See all help articles':'اعرض كل مقالات المساعدة',
    'Edit help articles':'تعديل مقالات المساعدة', 'New article':'مقالة جديدة', 'See the help center':'اعرض مركز المساعدة', 'All articles':'كل المقالات', 'See it as the team does':'اعرضها كما يراها الفريق',
    'Write short how-tos in plain words. Pick who sees each one and which pages’ ? button opens it. Every save keeps the old words in Version history.':'اكتب شروحات قصيرة بكلمات بسيطة. اختر من يراها وأي صفحات يفتحها زر ? فيها. كل حفظ يبقي الكلمات القديمة في سجل النسخ.',
    'Title':'العنوان', 'Area':'القسم', 'Order in its area (lower comes first)':'الترتيب داخل القسم (الأصغر أولاً)', 'One-line summary':'ملخص في سطر', 'Words':'النص',
    '## starts a heading, - a bullet, 1. a step. [Link text](#page) links to a portal page. Leave an empty line between paragraphs.':'## يبدأ عنواناً، و- نقطة، و1. خطوة. [نص الرابط](#page) يربط بصفحة في البوابة. اترك سطراً فارغاً بين الفقرات.',
    'Who sees it':'من يراها', 'Everyone on the team':'كل الفريق', 'Only team members with any of these switched on':'أعضاء الفريق المفعّل لهم أي من هذه فقط', 'Only me':'أنا فقط',
    'Opens from these pages’ ? button':'تُفتح من زر ? في هذه الصفحات', 'Published (untick to hide it from the team while you work on it)':'منشورة (أزل العلامة لإخفائها عن الفريق أثناء العمل عليها)',
    'Save article':'حفظ المقالة', 'Preview':'معاينة', 'Version history':'سجل النسخ', 'Put this version back':'أعد هذه النسخة', 'Article saved':'تم حفظ المقالة', 'Article deleted':'تم حذف المقالة',
    'Getting started':'البداية', 'Team and shifts':'الفريق والورديات', 'Payroll and Earnings':'الرواتب والأرباح', 'My lists and calling':'قوائمي والاتصال', 'Deal CRM':'نظام الصفقات',
    'Contracts':'العقود', 'Learning Hub':'مركز التعلّم', 'Files':'الملفات', 'Messages and the bell':'الرسائل والجرس', 'Me area':'مساحتي', 'Settings and Devices':'الإعدادات والأجهزة', 'Cash and clients':'المال والعملاء',
    'Home':'الرئيسية', 'Team':'الفريق', 'Deals':'الصفقات', 'Cash':'المال', 'My lists':'قوائمي', 'Learning':'التعلّم', 'My hours':'ساعاتي', 'More':'المزيد', 'More: the whole menu':'المزيد: القائمة كاملة',
    'Install the app':'ثبّت التطبيق',
  });
  if (L.RULES) L.RULES.push(
    [/^(\d+) days? in a row$/, (m, n) => n + ' يوم متتالي'],
    [/^(\d+) weeks? in a row$/, (m, n) => n + ' أسبوع متتالي'],
    [/^(\d+) of (\d+)$/, (m, a, b) => a + ' من ' + b],
    [/^(\d+) active habits?$/, (m, n) => n + ' عادة نشطة'],
    [/^(\d+) a week$/, (m, n) => n + ' في الأسبوع'],
    [/^(\d+) times a week, any day$/, (m, n) => n + ' مرات في الأسبوع، أي يوم'],
    [/^(.+) this week$/, (m, n) => n + ' هذا الأسبوع'],
    [/^Due (.+)$/, (m, d) => 'مستحق ' + d],
    [/^(\d+)% reply rate$/, (m, n) => 'نسبة الرد ' + n + '%'],
    [/^(\d+) Connects per win$/, (m, n) => n + ' Connects لكل فوز'],
    [/^(\d+) (?:entry|entries)$/, (m, n) => n + ' إدخال'],
    [/^(\d+) tasks?$/, (m, n) => n + ' مهمة'],
    [/^(\d+) follow-ups? due$/, (m, n) => n + ' متابعة مستحقة'],
    [/^(\d+) steps? due$/, (m, n) => n + ' خطوة مستحقة'],
    [/^(\d+) tasks? done$/, (m, n) => n + ' مهمة منجزة'],
    [/^Last active (.+)$/, (m, t) => 'آخر نشاط ' + t],
    [/^Sign out of all other devices \((\d+)\)$/, (m, n) => 'سجّل الخروج من كل الأجهزة الأخرى (' + n + ')']
  );
  if (L.RULES) L.RULES.push(
    [/^Pay day (.+)$/, (m, d) => 'يوم الدفع ' + d],
    [/^(\d+) (?:person|people)$/, (m, n) => n + ' ' + (n === '1' ? 'شخص' : 'أشخاص')],
    [/^(\d+) commissions?$/, (m, n) => n + ' عمولة'],
    [/^(\d+) runs?$/, (m, n) => n + ' دفعة'],
    [/^(\d+(?:\.\d+)?) h$/, (m, n) => n + ' س'],
    [/^Mark (.+) paid$/, (m, n) => 'علّم ' + n + ' كمدفوع'],
    [/^Paid (.+)$/, (m, d) => 'مدفوع ' + d]
  );
  // Round 22: tasks (list and board, comments), @mentions, notification settings, must-read announcements, subscriptions
  Object.assign(L.AR, {
    'List':'قائمة', 'Board':'لوحة', 'Show':'عرض', 'Everyone':'الجميع', 'Mine':'مهامي', 'Show done':'اعرض المنجز', '+ New task':'+ مهمة جديدة', 'Save task':'احفظ المهمة',
    'To do':'للتنفيذ', 'Doing':'قيد التنفيذ', 'late':'متأخرة', 'due today':'مطلوبة اليوم', 'done this week':'أُنجزت هذا الأسبوع', 'past their due date':'تجاوزت موعدها', 'nothing late':'لا شيء متأخر',
    'Weekdays':'أيام العمل', 'Priority':'الأولوية', 'High':'عالية', 'Normal':'عادية', 'Low':'منخفضة', 'High priority':'أولوية عالية', 'Low priority':'أولوية منخفضة',
    'Link (optional)':'الرابط (اختياري)', 'A deal, lesson or page address':'عنوان صفقة أو درس أو صفحة', 'Comments':'التعليقات', 'Comment':'علّق', 'Write a comment':'اكتب تعليقاً',
    'No comments yet.':'لا تعليقات بعد.', 'No notes.':'لا ملاحظات.', 'Open the deal':'افتح الصفقة', 'Open the lesson':'افتح الدرس', 'Open the file':'افتح الملف', 'Open the link':'افتح الرابط',
    'Done tasks from the last 14 days show here.':'المهام المنجزة في آخر 14 يوماً تظهر هنا.', 'Nothing here. Drag a card here.':'لا شيء هنا. اسحب بطاقة إلى هنا.', 'Write something first.':'اكتب شيئاً أولاً.',
    'A link starts with #, /app/ or https://':'الرابط يبدأ بـ # أو /app/ أو https://', 'Sure? Delete':'متأكد؟ احذف', 'Notes':'ملاحظات',
    'What you need to do, from Amr or from you. Move it to Doing, tick it when it’s done, and comment if you need something. Type @ to mention someone.':'ما عليك فعله، من عمرو أو منك. انقلها إلى «قيد التنفيذ»، وعلّم عليها عند الانتهاء، وعلّق إن احتجت شيئاً. اكتب @ لذكر شخص.',
    'Give anyone a task with a due date, see it as a list or a board, and talk about it in its comments. Repeating tasks come back on their own when done.':'أعطِ أي شخص مهمة بموعد، واعرضها كقائمة أو لوحة، وناقشها في التعليقات. المهام المتكررة تعود وحدها عند إنجازها.',
    'type @ to mention someone':'اكتب @ لذكر شخص', 'Details. Type @ to mention someone':'التفاصيل. اكتب @ لذكر شخص',
    // Notification settings
    'Notifications':'الإشعارات', 'Notification settings':'إعدادات الإشعارات', 'Kind of alert':'نوع التنبيه', 'Bell':'الجرس', 'Phone':'الهاتف', 'Daily email':'البريد اليومي',
    'Mentions':'الإشارات', 'Announcements':'الإعلانات', 'Pay':'الأجر', 'Shifts and schedule':'الورديات والجدول', 'Deals':'الصفقات', 'Learning and reviews':'التعلّم والمراجعات',
    'Team and site':'الفريق والموقع', 'Everything else':'كل ما عدا ذلك', 'Send me the daily email':'أرسل لي البريد اليومي', 'Saved.':'تم الحفظ.', 'Daily email off.':'البريد اليومي متوقف.',
    'Choose which alerts you get':'اختر التنبيهات التي تصلك', 'Pick how each kind of alert reaches you.':'اختر كيف يصلك كل نوع من التنبيهات.',
    'Pick how each kind of alert reaches you. Off means it isn’t saved at all.':'اختر كيف يصلك كل نوع من التنبيهات. الإيقاف يعني أنه لا يُحفظ أصلاً.',
    'Pick how each kind of alert reaches you: the bell, your phone, the daily email, or not at all.':'اختر كيف يصلك كل نوع من التنبيهات: الجرس أو الهاتف أو البريد اليومي أو لا شيء.',
    'Someone wrote @ your name':'شخص كتب @ اسمك', 'New messages to you or the whole team':'رسائل جديدة لك أو لكل الفريق', 'Anything not listed above':'أي شيء غير مذكور أعلاه',
    'New tasks for you, comments on your tasks, due today and late':'مهام جديدة لك، وتعليقات على مهامك، والمطلوب اليوم والمتأخر', 'News from Amr (must-read ones always come through)':'أخبار من عمرو (الإعلانات الإلزامية تصل دائماً)',
    'Pay extras, commissions, bonuses and referrals':'إضافات الأجر والعمولات والمكافآت والإحالات', 'Shift reminders, requests, swaps, time off and late starts':'تذكيرات الورديات والطلبات والتبديل والإجازات والتأخير',
    'Deal changes, comments, follow-ups, callbacks and proof of funds':'تغييرات الصفقات والتعليقات والمتابعات ومعاودات الاتصال وإثبات الأموال', 'Reviews of your work, course access and coaching tips':'مراجعات عملك وصلاحيات الكورسات ونصائح الكوتشينج',
    'Budget alerts and subscription renewals':'تنبيهات الميزانية وتجديد الاشتراكات', 'Job applications and feedback from the team':'طلبات التوظيف وملاحظات الفريق',
    // Must-read
    'I read and understand this':'قرأت هذا وفهمته', 'Must read':'قراءة إلزامية', 'Remind them (bell only)':'ذكّرهم (بالجرس فقط)', 'Everyone confirmed.':'الجميع أكّد.', 'Who confirmed, and when':'من أكّد ومتى',
    'Must read: each person confirms they read it, and you see who hasn’t':'قراءة إلزامية: كل شخص يؤكد أنه قرأه، وترى من لم يؤكد',
    // Subscriptions
    'Subscriptions':'الاشتراكات', 'Your subscriptions':'اشتراكاتك', 'Add a subscription':'أضف اشتراكاً', '+ Add a subscription':'+ أضف اشتراكاً', 'New subscription':'اشتراك جديد', 'Add subscription':'أضف الاشتراك',
    'a month':'في الشهر', 'a year':'في السنة', 'renew in the next 7 days':'تتجدد في الأيام السبعة القادمة', 'active':'نشطة', 'Log payment':'سجّل الدفع', 'Undo last':'تراجع عن الأخير', 'Manage':'إدارة',
    'Add to Cash':'أضف إلى الكاش', 'Paid on':'دُفع في', 'Name':'الاسم', 'Company (optional)':'الشركة (اختياري)', 'Amount':'المبلغ', 'Currency':'العملة', 'Renews':'يتجدد', 'Next renewal':'التجديد القادم',
    'Remind me':'ذكّرني', 'Cash category':'فئة الكاش', 'Where to manage or cancel it (optional)':'أين تديره أو تلغيه (اختياري)', 'Every 3 months':'كل 3 أشهر', 'Every year':'كل سنة', 'On the day':'في نفس اليوم',
    'Found in Cash':'وُجد في الكاش', 'Renews today':'يتجدد اليوم', 'all active subscriptions':'كل الاشتراكات النشطة', 'at today’s prices':'بأسعار اليوم',
    'These aren’t on your list yet. Add one and check its amount and next renewal date.':'هذه ليست في قائمتك بعد. أضف واحداً وتأكد من مبلغه وموعد تجديده.',
    'No subscriptions yet. Add the first one below, or pick one found in Cash.':'لا اشتراكات بعد. أضف أول اشتراك بالأسفل، أو اختر واحداً وُجد في الكاش.',
    'Every tool you pay for regularly, when it renews, and what it costs a month. The bell reminds you before each renewal. “Log payment” adds the expense to Cash and moves the date on; it doesn’t pay anything.':'كل أداة تدفع لها بانتظام، ومتى تتجدد، وكم تكلف في الشهر. الجرس يذكّرك قبل كل تجديد. «سجّل الدفع» يضيف المصروف إلى الكاش وينقل الموعد؛ لا يدفع أي شيء.',
    // Round 26: seller leads and follow-up cadences from the Deal CRM (bell and Tasks page)
    'New seller lead':'عميل بائع جديد',
    'Someone sent the seller form. Open the Deal CRM inbox to add it to the board.':'أرسل شخص نموذج البائع. افتح صندوق الوارد في نظام الصفقات لإضافته إلى اللوحة.',
    'From the Deal CRM follow-up cadence. Open the deal for the seller and the notes.':'من خطة المتابعة في نظام الصفقات. افتح الصفقة لترى البائع والملاحظات.',
'This page is only for Amr.':'هذه الصفحة لعمرو فقط.',
    // Round 29: learners (Lesson questions, practice-call scoring, Review center notes)
    'Lesson questions':'أسئلة الدروس', 'Questions learners ask under a lesson. Once you answer, the answer stays under that lesson for everyone with the course. Hidden questions stop showing to learners.':'أسئلة يطرحها المتعلمون تحت الدروس. بعد أن تجيب، تبقى الإجابة تحت ذلك الدرس لكل من لديه الكورس. الأسئلة المخفية لا تظهر للمتعلمين.',
    'Waiting':'بانتظار الرد', 'Answered':'تمت الإجابة', 'Hidden':'مخفي', 'Nothing waiting':'لا شيء بالانتظار', 'Nothing here':'لا شيء هنا',
    'No questions are waiting for an answer.':'لا توجد أسئلة تنتظر إجابة.', 'No questions in this list yet.':'لا توجد أسئلة في هذه القائمة بعد.', 'Open the lesson':'افتح الدرس', 'A learner':'متعلّم',
    'Your answer':'إجابتك', 'Write your answer. Learners see it under this lesson.':'اكتب إجابتك. سيراها المتعلمون تحت هذا الدرس.', 'Save answer':'احفظ الإجابة', 'Edit answer':'عدّل الإجابة',
    'Answer':'أجب', 'Show again':'أظهر مجدداً', 'Hide':'إخفاء', 'Write the answer first.':'اكتب الإجابة أولاً.', 'Couldn’t save the answer. Try again.':'تعذّر حفظ الإجابة. حاول مرة أخرى.',
    'Answered. The learner gets a bell, and the answer now shows under the lesson.':'تمت الإجابة. يصل المتعلم تنبيه، والإجابة تظهر الآن تحت الدرس.', 'Answer updated.':'تم تحديث الإجابة.',
    'Couldn’t change that. Try again.':'تعذّر التغيير. حاول مرة أخرى.', 'Hidden from learners.':'مخفي عن المتعلمين.', 'Showing again.':'يظهر مجدداً.', 'Question deleted.':'حُذف السؤال.',
    'Couldn’t delete it. It was put back.':'تعذّر الحذف، فأُعيد كما كان.', 'Question':'سؤال', 'Learning':'التعلّم',
    'Score yourself first':'قيّم نفسك أولاً', 'Score':'الدرجة', 'Listen again':'استمع مجدداً', 'Amr’s notes:':'ملاحظات عمرو:',
    'Listen back and score each part from 1 (weak) to 5 (strong). Where your score and Amr’s are 2 or more apart, you’ll see “Listen again”.':'استمع للمكالمة وقيّم كل جزء من 1 (ضعيف) إلى 5 (قوي). حيث يختلف تقييمك عن تقييم عمرو بدرجتين أو أكثر سترى «استمع مجدداً».',
    'Everyone on this recording agreed to be recorded and for Amr to review it':'كل من في هذا التسجيل وافق على التسجيل وعلى أن يراجعه عمرو',
    'Tick that everyone on the recording agreed to it first.':'أكّد أولاً أن كل من في التسجيل وافق عليه.', 'Score yourself on all 10 parts first.':'قيّم نفسك في الأجزاء العشرة كلها أولاً.',
    'Send a call or a practice roleplay; see your scores.':'أرسل مكالمة أو تمثيل تدريبي، وشاهد درجاتك.',
    'Send a real call or a practice roleplay, up to 50 MB. Score yourself first, then Amr scores it on the 50-point scorecard (Lesson 1.8). His scores and notes show here over time.':'أرسل مكالمة حقيقية أو تمثيلاً تدريبياً حتى 50 ميغابايت. قيّم نفسك أولاً، ثم يقيّمها عمرو على بطاقة الخمسين درجة (الدرس 1.8). تظهر درجاته وملاحظاته هنا مع الوقت.',
  });
  if (L.RULES) L.RULES.push(
    [/^(\d+) lesson questions? to answer$/, (m, n) => n + ' من أسئلة الدروس تنتظر إجابتك'],
    [/^(\d+) of 10 scored$/, (m, n) => 'قُيّم ' + n + ' من 10'],
    [/^Your total: (\d+) of 50$/, (m, n) => 'مجموعك: ' + n + ' من 50'],
    [/^(.+): you gave (\d), Amr gave (\d)$/, (m, c, a, b) => c + ': أعطيت ' + a + '، وأعطى عمرو ' + b],
    [/^Their score (\d)( · Listen again)?$/, (m, n, l) => 'درجته ' + n + (l ? ' · استمع مجدداً' : '')],
    [/^Their own score: (\d+) of 50\.$/, (m, n) => 'درجته الذاتية: ' + n + ' من 50.'],
    [/^Renews (.+) · in (\d+) days?$/, (m, d, n) => 'يتجدد ' + d + ' · خلال ' + n + ' يوم'],
    [/^Renewal date passed · (.+)$/, (m, d) => 'فات موعد التجديد · ' + d],
    [/^Confirmed by (\d+) of (\d+)$/, (m, a, b) => 'أكّد ' + a + ' من ' + b],
    [/^Not yet: (.+)$/, (m, n) => 'لم يؤكد بعد: ' + n],
    [/^Please read: (.+)$/, (m, t) => 'يرجى القراءة: ' + t],
    [/^(\d+) comments?$/, (m, n) => n + ' تعليق'],
    [/^Late · (.+)$/, (m, d) => 'متأخرة · ' + d],
    [/^Notes: (.+)$/, (m, t) => 'ملاحظات: ' + t],
    [/^Seller follow-up: day (\d+)$/, (m, n) => 'متابعة البائع: اليوم ' + n]
,
    [/^Follow up (.+)$/, (m, d) => 'المتابعة ' + d],
    [/^(\d+) clients?$/, (m, n) => n + ' عميل'],
    [/^(\d+) proposals?$/, (m, n) => n + ' عرض'],
    [/^(\d+) (touch|touches)$/, (m, n) => n + ' تواصل'],
    [/^Proposal P-(\d+)$/, (m, n) => 'العرض P-' + n],
    [/^About (\$[\d,.]+) a month \(rate × hours × 52 ÷ 12\)\.$/, (m, v) => 'حوالي ' + v + ' في الشهر (السعر × الساعات × 52 ÷ 12).']
  );
})();
// Arabic for round 28 of the plan: calling queue, script panel, recording consent, dial goals, creative finance and cost per deal
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  Object.assign(L.AR, {
    'Calling queue':'طابور الاتصال', 'Creative finance calculator':'حاسبة التمويل الإبداعي', 'Cost per deal':'تكلفة الصفقة',
    'One lead at a time from your lead lists: their local time, the script, and one tap for the outcome. Call only when the time shows green.':'عميل واحد في كل مرة من قوائمك: وقته المحلي والسكريبت ونقرة واحدة للنتيجة. اتصل فقط عندما يظهر الوقت باللون الأخضر.',
    'Pick a list':'اختر قائمة', 'Start calling':'ابدأ الاتصال', 'All my lists':'كل قوائمي', 'Only leads I can call now':'فقط العملاء الذين يمكنني الاتصال بهم الآن',
    'Call no-answers again':'أعد الاتصال بمن لم يرد', 'Show script':'أظهر السكريبت', 'I record my calls':'أنا أسجّل مكالماتي',
    'OK to call':'يمكنك الاتصال', 'Don’t call now':'لا تتصل الآن', 'No state on this lead':'لا توجد ولاية لهذا العميل',
    'Call':'اتصل', 'Call phone 2':'اتصل بالرقم 2', 'Log outcome':'سجّل النتيجة', 'Skip':'تخطَّ', 'How did the call go?':'كيف كانت المكالمة؟',
    'I made an offer on this call':'قدّمت عرضاً في هذه المكالمة', 'Do not call and Wrong number also add the number to the team’s do-not-call list.':'"لا تتصل" و"رقم خاطئ" يضيفان الرقم أيضاً إلى قائمة عدم الاتصال للفريق.',
    'No answer':'لم يرد', 'Left voicemail':'تركت رسالة صوتية', 'Callback':'معاودة اتصال', 'Not interested':'غير مهتم', 'Interested':'مهتم', 'Appointment set':'تم تحديد موعد', 'Wrong number':'رقم خاطئ', 'Do not call':'لا تتصل',
    'Callbacks due':'معاودات مستحقة', 'Open lead':'افتح العميل', 'Due now':'مستحقة الآن', 'Soon':'قريباً',
    'Nothing to call right now':'لا أحد للاتصال به الآن', 'Every lead left is outside legal calling hours right now.':'كل العملاء المتبقين خارج ساعات الاتصال القانونية الآن.', 'Check again':'تحقق مرة أخرى',
    'You’ve worked every lead on this list.':'أنهيت كل العملاء في هذه القائمة.',
    'Their time':'وقتهم', 'Your time':'وقتك', 'Their time zone':'منطقتهم الزمنية', 'Time, their time':'الوقت، بتوقيتهم', 'Day':'اليوم', 'Note (optional)':'ملاحظة (اختياري)', 'Save callback':'حفظ المعاودة', 'Cancel':'إلغاء',
    'Script':'السكريبت', 'Objection answers':'ردود الاعتراضات', 'What did the seller say?':'ماذا قال البائع؟',
    'Say this first, before anything else:':'قل هذا أولاً، قبل أي شيء:', 'Recording consent':'موافقة التسجيل', 'Save the line':'احفظ الجملة', 'Line to say':'الجملة التي تقولها', 'Add a state':'أضف ولاية', 'Note or law':'ملاحظة أو قانون', 'Add':'أضف', 'Remove':'إزالة',
    'If you record calls, these states need every person on the call to agree. Before a call to one of them, the portal shows this line to say first:':'إن كنت تسجّل المكالمات، فهذه الولايات تشترط موافقة كل من في المكالمة. قبل الاتصال بإحداها تعرض البوابة هذه الجملة لتقولها أولاً:',
    'All-party consent':'موافقة كل الأطراف', 'Tap the number again to call.':'اضغط الرقم مرة أخرى للاتصال.',
    'Your targets':'أهدافك', 'Dials today':'اتصالات اليوم', 'Conversations today':'محادثات اليوم', 'Offers today':'عروض اليوم', 'Appointments today':'مواعيد اليوم',
    'Count my dials and conversations from the queue':'احسب اتصالاتي ومحادثاتي من الطابور',
    'You still type your numbers in the end-of-day report when you clock out. The counter only fills boxes you left empty.':'ما زلت تكتب أرقامك في تقرير نهاية اليوم عند الخروج. العدّاد يملأ فقط الخانات التي تركتها فارغة.',
    'Seller finance':'تمويل البائع', 'Subject-to':'الاستحواذ على القرض (Subject-to)', 'Show the schedule by year':'اعرض الجدول بالسنة', 'Print the table':'اطبع الجدول', 'Start over':'ابدأ من جديد',
    'Purchase price ($)':'سعر الشراء ($)', 'Down payment ($)':'الدفعة المقدمة ($)', 'Interest rate (% a year)':'نسبة الفائدة (% سنوياً)', 'Amortized over (years)':'مدة السداد (سنوات)', 'Balloon after (years, blank = none)':'الدفعة الكبيرة بعد (سنوات، فارغ = لا يوجد)', 'First payment':'أول دفعة',
    'Loan balance you take over ($)':'رصيد القرض الذي تتولاه ($)', 'Loan rate (% a year)':'فائدة القرض (% سنوياً)', 'Months left on the loan':'الأشهر المتبقية على القرض', 'Taxes and insurance a month ($)':'الضرائب والتأمين شهرياً ($)',
    'Cash to seller at closing ($)':'نقد للبائع عند الإغلاق ($)', 'Missed payments to catch up ($)':'أقساط متأخرة للسداد ($)', 'Closing costs ($)':'تكاليف الإغلاق ($)', 'Seller carry on the rest: rate (%, 0 = none)':'تمويل البائع للباقي: الفائدة (%، 0 = لا يوجد)', 'Seller carry: years':'تمويل البائع: سنوات', 'Rent a month (optional, $)':'الإيجار الشهري (اختياري، $)',
    'Monthly payment':'القسط الشهري', 'Seller carries':'يموّله البائع', 'Balloon':'الدفعة الكبيرة', 'Interest to the seller':'الفائدة للبائع', 'Seller gets in all':'يحصل البائع إجمالاً على', 'Loan payment':'قسط القرض', 'With taxes and insurance':'مع الضرائب والتأمين',
    'Cash you need at closing':'النقد المطلوب عند الإغلاق', 'Seller’s equity':'حقوق البائع', 'Seller carry payment':'قسط تمويل البائع', 'All payments a month':'كل الأقساط شهرياً', 'Cash flow a month':'التدفق النقدي الشهري',
    'Year':'السنة', 'Ends':'تنتهي', 'Paid':'المدفوع', 'Interest':'الفائدة', 'Principal':'أصل القرض', 'Balance after':'الرصيد بعدها', 'Month':'الشهر', 'Payment':'الدفعة',
    'Marketing spend':'إنفاق التسويق', 'Deals closed':'صفقات مغلقة', 'Profit per deal':'الربح لكل صفقة', 'Profit for each $1 spent':'الربح لكل 1$ منفق', 'Where the spend comes from':'من أين يأتي الإنفاق',
    'From':'من', 'To':'إلى', 'Cash expense categories that count as marketing':'فئات مصروفات الكاش التي تُحسب تسويقاً',
    'Marketing spend ($, blank = from Cash and lists)':'إنفاق التسويق ($، فارغ = من الكاش والقوائم)', 'Deals closed (blank = from the Deal CRM)':'الصفقات المغلقة (فارغ = من نظام الصفقات)',
    // Round 25: selling deals (search results; the Deal CRM carries its own Arabic for the Sell this deal section)
    'Deal page':'صفحة الصفقة', 'Offer':'عرض', 'Picked':'تم الاختيار', 'Not picked':'لم يُختر', 'New':'جديد',
    'Sell a deal: buyers who fit, deal page, email buyers, offers':'بيع صفقة: المشترون المناسبون، صفحة الصفقة، مراسلة المشترين، العروض',
    'Open a deal under contract, then Sell this deal':'افتح صفقة تحت العقد، ثم «بيع هذه الصفقة»',
    'Deal page settings: business name and mailing address':'إعدادات صفحة الصفقة: اسم النشاط والعنوان البريدي',
    'Deal CRM, Sell this deal, Email buyers, Settings':'الـ Deal CRM، بيع هذه الصفقة، راسل المشترين، الإعدادات',
    'Sell this deal':'بيع هذه الصفقة', 'Buyers who fit':'المشترون المناسبون', 'Email buyers':'راسل المشترين', 'Publish a deal page':'انشر صفحة الصفقة',
    'Unpublish':'إلغاء النشر', 'POF checked':'تم فحص إثبات الأموال', 'Mark checked':'علّم كمفحوص', 'Went another way':'اخترنا عرضاً آخر', 'Pick this offer':'اختر هذا العرض',
    // Round 35: public site (Site messages, Sign-up requests)
    'Site messages':'رسائل الموقع', 'Sign-up requests':'طلبات التسجيل',
    'Messages from the contact form on your site. Only you see them, and nobody gets an automatic reply. Press Reply to answer from your own email.':'رسائل من نموذج التواصل في موقعك. لا يراها أحد غيرك، ولا يصل لأحد رد تلقائي. اضغط رد لتجيب من بريدك.',
    'People asking for course access on amrabdelgawad.site/signup/. Approve fills the invite form with the courses they asked for; nothing is sent until you press Send. Decline sends nothing.':'أشخاص يطلبون الوصول إلى الكورسات من amrabdelgawad.site/signup/. الموافقة تملأ نموذج الدعوة بالكورسات التي طلبوها، ولا يُرسل شيء حتى تضغط إرسال. الرفض لا يرسل شيئاً.',
    'Inbox':'الوارد', 'Archived':'مؤرشف', 'Replied':'تم الرد', 'Reply':'رد', 'Mark replied':'علّم كتم الرد',
    'Mark read':'علّم كمقروء', 'Mark new':'علّم كجديد', 'Archive':'أرشفة', 'Back to inbox':'إعادة إلى الوارد',
    'Waiting':'بانتظار القرار', 'Approved':'تمت الموافقة', 'Declined':'مرفوض', 'Decline':'رفض', 'Back to waiting':'إعادة إلى الانتظار',
    'Open their access':'افتح صلاحياته', 'Mark approved':'علّم كموافق عليه', 'Already has an account':'لديه حساب بالفعل', 'Has a turned-off account':'لديه حساب موقوف',
    'Nothing here':'لا شيء هنا', 'No archived messages.':'لا توجد رسائل مؤرشفة.',
    'No messages yet. They show here when someone uses the contact form.':'لا توجد رسائل بعد. تظهر هنا عندما يستخدم أحد نموذج التواصل.',
    'No requests waiting. The sign-up page is amrabdelgawad.site/signup/.':'لا توجد طلبات بالانتظار. صفحة التسجيل هي amrabdelgawad.site/signup/.',
    'No requests in this list.':'لا توجد طلبات في هذه القائمة.', 'Message deleted.':'تم حذف الرسالة.', 'Request deleted.':'تم حذف الطلب.',
    'Marked replied.':'تم التعليم كتم الرد.', 'Marked read.':'تم التعليم كمقروء.', 'Marked new.':'تم التعليم كجديد.', 'Archived.':'تمت الأرشفة.',
    'Marked approved.':'تم التعليم كموافق عليه.', 'Declined. Nothing was sent to them.':'تم الرفض. لم يُرسل لهم شيء.', 'Back to waiting.':'أُعيد إلى الانتظار.',
    'Hiring me':'توظيفي', 'Hiring a team':'توظيف فريق', 'Courses':'الكورسات', 'Something else':'شيء آخر',
  });
  // Round 27 (closing): contract drafts for attorney review, contacts in search, and the Deal CRM labels (the CRM keeps
  // the same words in its own dictionary, r27.js, because it runs in its own frame)
  Object.assign(L.AR, {
    'Contact':'جهة اتصال', 'Title company':'شركة الملكية', 'Attorney':'محامي', 'Inspector':'معاين', 'Contractor':'مقاول', 'Lender':'مقرض', 'Surveyor':'مسّاح', 'Agent':'وكيل عقاري',
    'Mutual release (cancel the purchase agreement)':'إلغاء متبادل (إلغاء عقد الشراء)', 'Extension addendum (more time to inspect or close)':'ملحق تمديد (وقت إضافي للمعاينة أو الإغلاق)',
    'Land option agreement':'اتفاقية خيار شراء أرض', 'Joint venture agreement (one deal)':'اتفاقية شراكة (صفقة واحدة)', 'Promissory note':'سند دين', 'Mortgage or deed of trust':'رهن عقاري أو سند ائتمان',
    'DRAFT FOR ATTORNEY REVIEW':'مسودة لمراجعة المحامي', 'Drafts for attorney review':'مسودات لمراجعة المحامي', 'Buyer name on the contract (ask your attorney how to write it)':'اسم المشتري في العقد (اسأل المحامي عن طريقة كتابته)',
    'Day counters':'عداد الأيام', 'Inspection period':'فترة المعاينة', 'Title work':'أوراق الملكية', 'Title work due':'موعد أوراق الملكية', 'Option expires':'انتهاء الخيار', 'days left':'يوم متبقي',
    'Contacts on this deal':'جهات الاتصال في هذه الصفقة', 'Link a contact':'اربط جهة اتصال', 'New contact':'جهة اتصال جديدة', 'Use as title company':'استخدمها كشركة الملكية', 'Search contacts':'ابحث في جهات الاتصال',
    'Make the assignment':'اعمل عقد التنازل', 'Picked from offers':'مختار من العروض', 'Pick a buyer from your list':'اختر مشترياً من قائمتك',
    'Deal fee':'عمولة الصفقة', 'Record the expected fee':'سجّل العمولة المتوقعة', 'Mark received':'علّم كمستلمة', 'Mark lost':'علّم كضائعة', 'Back to expected':'رجّعها متوقعة',
    'JV split':'تقسيم الشراكة', 'Add partner':'أضف شريكاً', 'Your share':'نصيبك', 'Paid out':'تم الدفع', 'Make the JV agreement':'اعمل اتفاقية الشراكة', 'Deal income':'دخل الصفقات',
    'Earnest money sent':'تم إرسال العربون', 'Inspection done':'تمت المعاينة', 'Buyer assigned':'تم التنازل للمشتري', 'Title opened':'تم فتح ملف الملكية', 'Closed and funded':'أُغلقت وتم التمويل'
  });
  if (L.RULES) L.RULES.push(
    [/^(\d+) leads? left$/, (m, n) => 'متبقٍ ' + n + ' عميل'],
    [/^Recording\? ([A-Z]{2}) needs everyone’s consent\.$/, (m, s) => 'تسجيل؟ ولاية ' + s + ' تشترط موافقة الجميع.'],
    [/^Call back (.+)$/, (m, w) => 'معاودة الاتصال بـ ' + w],
    [/^Offer \$([\d,]+) from (.+)$/, (m, a, w) => 'عرض $' + a + ' من ' + w],
    [/^(\d+) articles?$/, (m, n) => n + ' مقالة'],
    [/^More in (.+)$/, (m, a) => 'المزيد في ' + ((L.AR[a]) || a)],
    [/^Last updated (.+)$/, (m, d) => 'آخر تحديث ' + d],
    [/^(\d+) new site messages?, latest (.+)$/, (m, n, w) => n + ' رسالة جديدة من الموقع، آخرها من ' + w],
    [/^(\d+) sign-up requests? to decide$/, (m, n) => n + ' طلب تسجيل بانتظار قرارك']
  );
})();

// Round 34 (Nov 24 2026): hiring pages (Job posts, Applicant board, hire form, onboarding plans, handbook sign-off,
// offboarding finish). Only fills words not already in the dictionary, so earlier and later rounds keep their wording.
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  const W = {
    // menu and page titles
    'Applicant board':'لوحة المتقدمين', 'Job posts':'إعلانات الوظائف', 'Applicants':'المتقدمون',
    'The jobs on amrabdelgawad.site/join. Open jobs show there with the apply form and the voice test; closed ones stay here with their applicants.':'الوظائف المعروضة على amrabdelgawad.site/join. الوظائف المفتوحة تظهر هناك مع نموذج التقديم واختبار الصوت، والمغلقة تبقى هنا مع المتقدمين لها.',
    'Everyone who applied on the Join page, by stage. Drag a card left or right (or use the arrows); drag the board or swipe to scroll. Open a card to play the voice test, add notes or hire.':'كل من تقدّم من صفحة الانضمام، حسب المرحلة. اسحب البطاقة يميناً أو يساراً (أو استخدم الأسهم)، واسحب اللوحة أو مرّر للتنقل. افتح البطاقة لتسمع اختبار الصوت أو تضيف ملاحظات أو توظّف.',
    // stages
    'Applied':'تقدّم', 'Screened':'تمت المراجعة الأولية', 'Voice test':'اختبار الصوت', 'Roleplay':'تمثيل المكالمة', 'Offer':'عرض العمل', 'Hired':'تم التوظيف', 'Rejected':'مرفوض',
    // board
    'Job':'الوظيفة', 'All jobs':'كل الوظائف', 'No job picked':'بدون وظيفة محددة', 'Find':'بحث', 'List view':'عرض القائمة', 'Name, email or phone':'الاسم أو البريد أو الهاتف',
    'applied this week':'تقدّموا هذا الأسبوع', 'not looked at yet':'لم تُراجع بعد', 'in progress':'قيد المتابعة', 'hired in 90 days':'وُظّفوا خلال 90 يوماً',
    'Drop here to hire':'أفلت هنا للتوظيف', 'Drop a card here':'أفلت بطاقة هنا', 'Close':'إغلاق', 'About them':'عنهم', 'Phone / WhatsApp':'الهاتف / واتساب',
    'Country':'الدولة', 'English':'الإنجليزية', 'Hours a week':'الساعات أسبوعياً', 'Can start':'يمكنه البدء', 'Experience':'الخبرة', 'Why this job':'لماذا هذه الوظيفة', 'Referred by':'رشّحه',
    'Stage':'المرحلة', 'Your note (only you)':'ملاحظتك (لك فقط)', 'Why not (only you)':'سبب الرفض (لك فقط)', 'Save':'حفظ', 'Interview scorecard':'بطاقة تقييم المقابلة',
    'Copy email':'انسخ البريد', 'Open WhatsApp chat':'افتح محادثة واتساب', 'Delete applicant':'احذف المتقدم', 'No voice test.':'لا يوجد اختبار صوت.', 'The text they read':'النص الذي قرأه',
    'Hire':'توظيف', 'Make their onboarding plan':'أنشئ خطة التهيئة له', 'Onboarding':'التهيئة',
    'Nothing here messages the applicant. Copy and WhatsApp only open things for you.':'لا شيء هنا يرسل رسالة للمتقدم. النسخ وواتساب يفتحان الأشياء لك فقط.',
    // job posts
    '+ New job post':'+ إعلان وظيفة جديد', 'See the Join page':'افتح صفحة الانضمام', 'New job post':'إعلان وظيفة جديد', 'Job title':'المسمى الوظيفي', 'Link name':'اسم الرابط',
    'Kind of job':'نوع الوظيفة', 'Where':'المكان', 'Pay':'الأجر', 'Hours':'الساعات', 'Order on the page':'الترتيب في الصفحة', 'Short summary':'ملخص قصير',
    'What the job is (one point per line)':'ما هي الوظيفة (نقطة في كل سطر)', 'What they need (one point per line)':'ما يحتاجه المتقدم (نقطة في كل سطر)',
    'Voice test: the text they read out loud':'اختبار الصوت: النص الذي يقرؤونه بصوت عالٍ', 'The voice test is needed to apply':'اختبار الصوت مطلوب للتقديم',
    'Open: show it on the Join page':'مفتوحة: اعرضها في صفحة الانضمام', 'Save job post':'احفظ الإعلان', 'Open':'مفتوحة', 'Closed':'مغلقة', 'Edit':'تعديل',
    'Close it':'أغلقها', 'Open it again':'افتحها مجدداً', 'Copy link':'انسخ الرابط', 'Voice test needed to apply':'اختبار الصوت مطلوب للتقديم', 'Voice test optional':'اختبار الصوت اختياري',
    'No job posts yet':'لا توجد إعلانات وظائف بعد', 'Add the first job. It shows on amrabdelgawad.site/join as soon as it is open.':'أضف أول وظيفة. ستظهر على amrabdelgawad.site/join بمجرد فتحها.',
    // hire and plan form
    'Full name':'الاسم الكامل', 'Email':'البريد الإلكتروني', 'Works for':'يعمل لدى', 'Pick later':'اختر لاحقاً', 'Start as':'يبدأ بصفة',
    'Agent (everything the role comes with)':'وكيل (كل ما يأتي مع الدور)', 'Start date':'تاريخ البدء', 'Finish the modules by':'إنهاء الوحدات بحلول',
    'Acquisitions course modules to finish':'وحدات كورس الاستحواذ المطلوب إنهاؤها', 'First shift':'أول وردية', 'Day':'اليوم', 'Starts':'تبدأ', 'Ends':'تنتهي',
    'Leave the day empty to add the first shift later in Schedule and time off.':'اترك اليوم فارغاً لتضيف أول وردية لاحقاً من الجدول والإجازات.',
    'Note for them (they see it on their plan)':'ملاحظة له (يراها في خطته)', 'Send email invite and hire':'أرسل دعوة بالبريد ووظّف', 'Get WhatsApp link and hire':'احصل على رابط واتساب ووظّف',
    'Save the plan':'احفظ الخطة', 'Open WhatsApp with this message':'افتح واتساب بهذه الرسالة',
    'The invite goes out only when you press one of these buttons. The email button sends their sign-in link from your connected Gmail; the WhatsApp button only makes a link for you to send.':'لا تُرسل الدعوة إلا عند الضغط على أحد هذين الزرين. زر البريد يرسل رابط الدخول من Gmail المتصل، وزر واتساب ينشئ رابطاً فقط لترسله أنت.',
    // onboarding plans
    'Onboarding plans':'خطط التهيئة', 'Course modules, handbook sign-offs and first shift':'وحدات الكورس وتوقيعات الدليل وأول وردية', 'Person':'الشخص', 'Course modules':'وحدات الكورس',
    'Handbook signed':'توقيعات الدليل', 'First or next shift':'أول وردية أو التالية', 'Make a plan':'أنشئ خطة', 'Change plan':'غيّر الخطة', 'No plan':'لا توجد خطة',
    'Not scheduled':'غير مجدولة', 'No required pages':'لا توجد صفحات مطلوبة', 'None picked':'لم يُختر شيء',
    // home: your plan
    'Your plan':'خطتك', 'Handbook pages to sign':'صفحات الدليل المطلوب توقيعها', 'Your first shift':'أول وردية لك', 'Your next shift':'ورديتك التالية', 'Done':'تم', 'Sign':'وقّع',
    // handbook sign-off
    'Sign this page':'وقّع هذه الصفحة', 'Your full name':'اسمك الكامل', 'Signed':'تم التوقيع', 'Sign-off':'التوقيع', 'Not yet':'ليس بعد', 'Agreements':'الموافقات',
    'New hires and the team must sign this page':'يجب على الموظفين الجدد والفريق توقيع هذه الصفحة', 'Also ring their bell in the portal (nothing is emailed)':'نبّههم أيضاً بالجرس في البوابة (لا يُرسل بريد)',
    'Ask everyone to sign again':'اطلب من الجميع التوقيع مجدداً',
    'This page needs your signature. Type your full name as it shows in the portal to confirm you read and understood it.':'هذه الصفحة تحتاج توقيعك. اكتب اسمك الكامل كما يظهر في البوابة لتؤكد أنك قرأتها وفهمتها.',
    // offboarding finish
    'Finish':'الإنهاء', 'Final pay':'الأجر الأخير', 'Open Payroll':'افتح الرواتب', 'Their record':'سجلّه', 'Save a copy of their record':'احفظ نسخة من سجلّه', 'Save a new copy':'احفظ نسخة جديدة',
    'Open the saved copy':'افتح النسخة المحفوظة', 'Exit notes':'ملاحظات المغادرة', '(only you)':'(لك فقط)', 'Save notes':'احفظ الملاحظات', 'Sign-in and access':'الدخول والصلاحيات',
    'Access off':'الصلاحيات موقوفة', 'Undo: give their access back':'تراجع: أعد صلاحياته', 'Sign out on every device and turn off access':'سجّل خروجه من كل الأجهزة وأوقف صلاحياته',
    'Working it out…':'جارٍ الحساب…', 'Pay it from Payroll as usual; the money itself moves outside the portal.':'ادفعه من الرواتب كالعادة؛ المال نفسه يُحوّل خارج البوابة.',
    'The exit survey isn’t answered yet. Once access is off they can’t answer it.':'لم يُجب على استبيان المغادرة بعد. بعد إيقاف الصلاحيات لن يستطيع الإجابة.',
    'One step: signs them out on every phone and computer, switches off every tool (courses, Deal CRM, call counter, phone alerts) and blocks the sign-in. Their shifts, notes and history stay.':'خطوة واحدة: تسجّل خروجه من كل هاتف وكمبيوتر، وتوقف كل الأدوات (الكورسات، نظام الصفقات، عدّاد المكالمات، تنبيهات الهاتف) وتمنع الدخول. وردياته وملاحظاته وسجلّه تبقى.',
    'Shifts, pay, onboarding, sign-offs, agreements and the list of their documents, saved as one file in Files. Their documents stay in Person files.':'الورديات والأجر والتهيئة والتوقيعات والموافقات وقائمة مستنداته، محفوظة كملف واحد في الملفات. مستنداته تبقى في ملفات الفريق.'
  };
  Object.keys(W).forEach(k => { if (!(k in L.AR)) L.AR[k] = W[k]; });
  if (L.RULES) L.RULES.push(
    [/^(\d+) of (\d+) lessons$/, (m, a, b) => a + ' من ' + b + ' دروس'],
    [/^(\d+) of (\d+) signed$/, (m, a, b) => 'وقّع ' + a + ' من ' + b],
    [/^See applicants \((\d+)\)$/, (m, n) => 'عرض المتقدمين (' + n + ')'],
    [/^Play the voice test \((.+)\)$/, (m, t) => 'شغّل اختبار الصوت (' + t + ')'],
    [/^Voice test (\d+:\d\d)$/, (m, t) => 'اختبار صوت ' + t],
    [/^Plan for (.+)$/, (m, n) => 'خطة ' + n],
    [/^Onboarding plan for (.+)$/, (m, n) => 'خطة تهيئة ' + n],
    [/^(\d+) handbook pages? needs? your signature\.$/, (m, n) => n + ' من صفحات الدليل تحتاج توقيعك.']
  );
})();

// Round 30: the course builder (r30-builder.js)
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  const W = {
    'Build and change every course on screen. Changes save as a draft that only you see. Learners see them after you press Publish, and the version that was live is kept so you can roll back.':'ابنِ أي كورس وعدّله على الشاشة. التعديلات تُحفظ كمسودة لا يراها غيرك. يراها المتعلمون بعد أن تضغط نشر، وتُحفظ النسخة التي كانت منشورة لتتمكن من الرجوع إليها.',
    'Check course':'افحص الكورس', 'Acquisitions':'الاستحواذ', 'Marketing':'التسويق', 'Psychology':'علم النفس', 'Modules':'الوحدات', 'New module':'وحدة جديدة',
    '+ Add a module':'+ أضف وحدة', 'It stays a draft until you publish it.':'تبقى مسودة حتى تنشرها.', 'Draft':'مسودة', 'Draft · not live':'مسودة · غير منشورة', 'Same as live':'مطابق للمنشور',
    'Draft, never published':'مسودة لم تُنشر بعد', 'New Marketing modules are added to the course plan in the site code first, then filled in here.':'وحدات التسويق الجديدة تُضاف أولاً إلى خطة الكورس في كود الموقع، ثم تُملأ هنا.',
    'Edit':'تعديل', 'Hide':'إخفاء', 'Unhide':'إظهار', 'Move up':'تحريك لأعلى', 'Move down':'تحريك لأسفل', 'Hidden from learners':'مخفي عن المتعلمين',
    '+ Add a lesson':'+ أضف درساً', '+ Add a part':'+ أضف جزءاً', '+ Add a section':'+ أضف قسماً', '+ Add a term':'+ أضف مصطلحاً', '+ Add a diagram':'+ أضف رسماً توضيحياً', '+ Add a row':'+ أضف صفاً',
    'Marketing saves each learner’s progress by part position, so parts can be added at the end but not moved or hidden.':'التسويق يحفظ تقدّم كل متعلم حسب ترتيب الأجزاء، لذلك يمكن إضافة جزء في النهاية لكن لا يمكن تحريك الأجزاء أو إخفاؤها.',
    'Publish module':'انشر الوحدة', 'Throw away the draft':'احذف المسودة', 'Open in the course':'افتح في الكورس', 'Versions':'النسخ', 'Kept on every Publish':'تُحفظ مع كل نشر',
    'Roll back to this':'ارجع إلى هذه النسخة', 'Before a publish':'قبل النشر', 'Before a roll back':'قبل الرجوع', 'Before it was removed':'قبل الحذف',
    'No earlier versions yet. Each Publish keeps the version that was live.':'لا توجد نسخ سابقة بعد. كل نشر يحفظ النسخة التي كانت منشورة.',
    'No changes yet. Edits save as a draft.':'لا تعديلات بعد. التعديلات تُحفظ كمسودة.', 'Saving…':'جارٍ الحفظ…', 'Checking…':'جارٍ الفحص…', 'Publishing…':'جارٍ النشر…', 'Rolling back…':'جارٍ الرجوع…',
    'Sure? Publish to learners':'متأكد؟ انشر للمتعلمين', 'Sure? Throw it away':'متأكد؟ احذفها', 'Sure? Learners get this version':'متأكد؟ سيرى المتعلمون هذه النسخة',
    'Live preview':'معاينة مباشرة', 'Lesson text':'نص الدرس', 'Arabic text':'النص العربي', 'Right to left':'من اليمين لليسار', 'English':'الإنجليزية', 'Arabic':'العربية',
    'Title (starts with the lesson number)':'العنوان (يبدأ برقم الدرس)', 'Short title (menus and Voice Studio)':'العنوان المختصر (القوائم واستوديو الصوت)', 'Title':'العنوان', 'Arabic title':'العنوان بالعربية', 'Part title':'عنوان الجزء', 'Minutes':'الدقائق',
    'Heading':'عنوان', 'Paragraph':'فقرة', 'Box':'صندوق', 'Picture':'صورة', 'List or table':'قائمة أو جدول', 'Arabic summary (فصحى)':'الملخص العربي (فصحى)', 'Example':'مثال', 'Summary':'الخلاصة', 'List':'قائمة', 'Table':'جدول', 'Block':'جزء',
    'Why it matters':'لماذا يهم', 'Tip':'نصيحة', 'Watch out':'انتبه', 'Note':'ملاحظة', 'Arabic summary':'الملخص العربي', 'Add':'أضف', 'Section':'قسم',
    'Why it matters / key point':'لماذا يهم / نقطة أساسية', 'Remove this block':'احذف هذا الجزء', 'Remove this section':'احذف هذا القسم', 'Remove this term':'احذف هذا المصطلح', 'Remove this diagram':'احذف هذا الرسم', 'Remove this row':'احذف هذا الصف',
    'Describe the picture (for screen readers)':'صف الصورة (لقارئ الشاشة)', 'Caption (optional)':'تعليق تحت الصورة (اختياري)', 'Choose a picture':'اختر صورة', 'Replace the picture':'استبدل الصورة', 'No picture yet':'لا توجد صورة بعد',
    'Stored with the course videos (R2)':'محفوظة مع فيديوهات الكورس (R2)', 'Uploading the picture…':'جارٍ رفع الصورة…', 'Picture added. It is stored with the course videos.':'أُضيفت الصورة. حُفظت مع فيديوهات الكورس.',
    'Example box':'صندوق المثال', 'B2B box (optional)':'صندوق B2B (اختياري)', 'Terms':'المصطلحات', 'Term':'المصطلح', 'Meaning':'المعنى', 'Quiz':'الاختبار', 'Practice questions':'أسئلة التدريب',
    'Edit the questions':'عدّل الأسئلة', 'Questions are edited in the quiz builder (coming next).':'تُعدّل الأسئلة في محرّر الاختبارات (قريباً).',
    'Diagrams':'الرسوم التوضيحية', 'Kind':'النوع', 'Title (optional)':'العنوان (اختياري)', 'Goes after the paragraph that starts with':'يأتي بعد الفقرة التي تبدأ بـ',
    'Number chain':'سلسلة أرقام', 'Ladder':'سلّم', 'Flow':'مسار', 'Columns':'أعمدة', 'Timeline':'خط زمني', 'Numbered steps':'خطوات مرقّمة', 'Scale':'مقياس',
    'Label':'التسمية', 'Math':'الحساب', 'Value':'القيمة', 'Highlight':'تمييز', 'Step':'خطوة', 'Detail':'التفاصيل', 'Under the heading':'تحت العنوان', 'Points, one per line':'النقاط، نقطة في كل سطر',
    'When':'متى', 'What':'ماذا', 'Who':'من', 'Range':'النطاق', 'Arrow labels, one per line':'نصوص الأسهم، نص في كل سطر', 'Line under it':'سطر تحته',
    'State sheet':'ورقة الولاية', 'State sheets':'أوراق الولايات', 'Same sheet as the Contracts page and the Deal CRM':'نفس الورقة الموجودة في صفحة العقود ونظام الصفقات', 'State':'الولاية',
    'Wholesaling rule':'قاعدة البيع بالجملة', 'Disclosure state?':'ولاية إفصاح؟', 'Who closes':'من يُغلق الصفقة', 'Usual deed':'نوع سند الملكية المعتاد', 'Checked on':'تاريخ المراجعة',
    'Changes go live with Publish, here and on the Contracts page.':'التعديلات تُنشر مع زر النشر، هنا وفي صفحة العقود.', 'No sheet for this state on the Contracts page yet.':'لا توجد ورقة لهذه الولاية في صفحة العقود بعد.',
    'Video':'الفيديو', 'No video for this lesson yet.':'لا يوجد فيديو لهذا الدرس بعد.', 'Marketing lessons have no videos.':'دروس التسويق ليس لها فيديوهات.',
    'Make video':'أنشئ فيديو', 'Make video comes with the video tools next.':'زر إنشاء الفيديو يأتي مع أدوات الفيديو قريباً.', 'Needs re-voice':'يحتاج تسجيل صوت جديد',
    'Lesson group':'مجموعة دروس', 'Written drill':'تمرين كتابي', 'Checkpoint':'نقطة تقييم', 'Exam':'امتحان', 'Playbook':'دليل عملي', 'Notes':'ملاحظات', 'Not in a part':'خارج الأجزاء',
    'Must fix':'يجب إصلاحه', 'Check':'راجِع', 'No problems found.':'لا توجد مشكلات.', 'Close':'إغلاق', 'Open':'افتح', 'Showing the first 300.':'عرض أول 300.',
    'Hidden. Learners stop seeing it after you publish.':'أُخفي. يتوقف المتعلمون عن رؤيته بعد النشر.', 'Back in the module. Learners see it after you publish.':'عاد إلى الوحدة. يراه المتعلمون بعد النشر.',
    'It can’t move further that way.':'لا يمكن تحريكه أكثر في هذا الاتجاه.', 'Draft thrown away. The live version is unchanged.':'حُذفت المسودة. النسخة المنشورة كما هي.',
    'Nothing to publish: there is no draft. Learners already see this version.':'لا شيء للنشر: لا توجد مسودة. المتعلمون يرون هذه النسخة بالفعل.',
    'Use a PNG, JPG, WebP or GIF picture.':'استخدم صورة PNG أو JPG أو WebP أو GIF.', 'That picture is over 8 MB. Make it smaller first.':'الصورة أكبر من 8 ميجابايت. صغّرها أولاً.',
    'This module has no Arabic yet.':'هذه الوحدة ليس لها نسخة عربية بعد.', 'Add a part to this module first.':'أضف جزءاً لهذه الوحدة أولاً.'
  };
  Object.keys(W).forEach(k => { if (!(k in L.AR)) L.AR[k] = W[k]; });
  if (L.RULES) L.RULES.push(
    [/^Module (\d+) · (.+)$/, (m, n, t) => 'الوحدة ' + n + ' · ' + t],
    [/^Draft saved (.+)\. Learners still see the live version\.$/, (m, t) => 'حُفظت المسودة ' + t + '. المتعلمون ما زالوا يرون النسخة المنشورة.'],
    [/^Live since (.+)$/, (m, t) => 'منشورة منذ ' + t],
    [/^Draft saved (.+)$/, (m, t) => 'حُفظت المسودة ' + t],
    [/^Publish anyway \((.+)\)$/, (m, t) => 'انشر رغم ذلك (' + t + ')'],
    [/^Course check · (.+)$/, (m, t) => 'فحص الكورس · ' + t],
    [/^(\d+) (modules?|diagrams?|questions?)$/, (m, n, w) => n + ' ' + ({ module:'وحدة', modules:'وحدات', diagram:'رسم', diagrams:'رسوم', question:'سؤال', questions:'أسئلة' })[w]]
  );
})();
// Plan Round 36 (O5): client portal (/client/) and Clients › Portal access
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  const W = {
    // client page
    'Your client portal':'بوابة العميل', 'Your portal is closed':'بوابتك مغلقة', 'Go to sign in':'اذهب لتسجيل الدخول',
    'Access to this page is switched off right now. If that seems wrong, please reach out to Amr.':'الوصول إلى هذه الصفحة موقوف الآن. إن بدا ذلك خطأً فتواصل مع عمرو.',
    'Welcome':'أهلاً', 'Your team’s work':'عمل فريقك', 'Hours and numbers':'الساعات والأرقام', 'Calls':'المكالمات', 'Invoices':'الفواتير', 'Sections':'الأقسام',
    'Show':'عرض', 'This week':'هذا الأسبوع', 'Last week':'الأسبوع الماضي', 'This month':'هذا الشهر', 'Last month':'الشهر الماضي', 'Last 90 days':'آخر 90 يوماً', 'Pick dates':'اختر التواريخ',
    'From':'من', 'To':'إلى', 'By rep':'حسب المندوب', 'By day':'حسب اليوم', 'Every shift':'كل الورديات', 'Hours worked':'ساعات العمل', 'Dials':'اتصالات', 'Conversations':'محادثات',
    'Appointments':'مواعيد', 'Offers':'عروض', 'Shifts':'الورديات', 'Rep':'المندوب', 'Day':'اليوم', 'Time':'الوقت', 'Hours':'الساعات',
    'No shifts in these dates.':'لا ورديات في هذه التواريخ.', 'Pick a range up to 400 days.':'اختر مدة حتى 400 يوم.', 'Couldn’t load your numbers. Please refresh.':'تعذّر تحميل أرقامك. حدّث الصفحة من فضلك.',
    'Calls Amr picked to share with you.':'مكالمات اختارها عمرو لمشاركتها معك.', 'Play':'تشغيل', 'No calls shared with you yet.':'لم تُشارك معك مكالمات بعد.',
    'Couldn’t load the calls. Please refresh.':'تعذّر تحميل المكالمات. حدّث الصفحة من فضلك.', 'This call couldn’t load. Please try again later.':'تعذّر تحميل هذه المكالمة. حاول لاحقاً.',
    'No invoices yet.':'لا فواتير بعد.', 'Couldn’t load your invoices. Please refresh.':'تعذّر تحميل فواتيرك. حدّث الصفحة من فضلك.', 'Still to pay':'المتبقي للدفع', 'Invoice':'فاتورة',
    'Not paid yet':'لم تُدفع بعد', 'Part paid':'مدفوعة جزئياً', 'Paid':'مدفوعة', 'Period':'الفترة', 'Amount':'المبلغ', 'Left to pay':'المتبقي', 'Due':'تاريخ الاستحقاق', 'Paid on':'دُفعت في',
    'Download PDF':'تنزيل PDF', 'Couldn’t open it. Try again':'تعذّر فتحه. حاول مجدداً', 'The PDF for this invoice isn’t ready yet. Ask Amr if you need it now.':'ملف PDF لهذه الفاتورة غير جاهز بعد. اطلبه من عمرو إن احتجته الآن.',
    'Times are in your device’s time zone. Questions about anything here? Reply to Amr the usual way.':'الأوقات بتوقيت جهازك. عندك سؤال عن أي شيء هنا؟ راسل عمرو بالطريقة المعتادة.',
    'Your client portal is switched off right now. Ask Amr if that’s a mistake.':'بوابة العميل الخاصة بك موقوفة الآن. اسأل عمرو إن كان ذلك خطأً.',
    // owner: Portal access
    'Portal access':'وصول البوابة', 'Client portal access':'وصول العملاء للبوابة', 'Client':'العميل', 'Not set up':'غير مُعدّ', 'Portal on':'البوابة مفتوحة', 'Portal off':'البوابة مغلقة',
    'Reps they see':'المندوبون الذين يراهم', 'works for them':'يعمل لديهم', 'Logins':'تسجيلات الدخول', 'Add a login':'أضف تسجيل دخول', 'Their name':'اسمه', 'Their email':'بريده الإلكتروني',
    'Make a sign-in link':'أنشئ رابط تسجيل دخول', 'New sign-in link':'رابط تسجيل دخول جديد', 'Turn off':'أوقف', 'Sure? Turn off':'متأكد؟ أوقف', 'Turn back on':'أعد التشغيل', 'Copy link':'انسخ الرابط',
    'Open WhatsApp with this message':'افتح واتساب بهذه الرسالة', 'Recordings they can play':'تسجيلات يمكنه تشغيلها', 'Share':'مشاركة', 'Call':'المكالمة', 'Length':'المدة', 'Recorded':'تاريخ التسجيل',
    'Login on':'الدخول مفعّل', 'Login off':'الدخول موقوف', 'Not yet':'ليس بعد', 'Making the link…':'جارٍ إنشاء الرابط…', 'Link copied.':'نُسخ الرابط.', 'Login turned off.':'أُوقف تسجيل الدخول.', 'Login turned back on.':'أُعيد تشغيل تسجيل الدخول.',
    'Add a client in Clients first.':'أضف عميلاً من صفحة العملاء أولاً.',
    'Off shuts every one of their logins out right away. Their logins and your picks stay, so you can turn it back on.':'الإيقاف يمنع كل تسجيلات دخولهم فوراً. تبقى تسجيلاتهم واختياراتك لتعيد التشغيل متى شئت.',
    'Copy this and send it yourself. It works once; make a new one if it expires.':'انسخه وأرسله بنفسك. يعمل مرة واحدة؛ أنشئ رابطاً جديداً إن انتهت صلاحيته.',
    'They sign in at amrabdelgawad.site/app with their email and the password they choose, and land on their own page.':'يسجّلون الدخول من amrabdelgawad.site/app ببريدهم وكلمة المرور التي يختارونها، ويصلون إلى صفحتهم الخاصة.',
    'Ticking shares it right away; unticking hides it from them. They see the call’s title and the rep’s first name, never the score.':'التحديد يشاركها فوراً، وإلغاؤه يخفيها عنهم. يرون عنوان المكالمة والاسم الأول للمندوب، ولا يرون التقييم أبداً.',
    'No call recordings yet. Reps add them from the Learning Hub or Deal CRM.':'لا تسجيلات مكالمات بعد. يضيفها المندوبون من مركز التعلّم أو إدارة الصفقات.'
  };
  Object.keys(W).forEach(k => { if (!(k in L.AR)) L.AR[k] = W[k]; });
  if (L.RULES) L.RULES.push(
    [/^Welcome, (.+)$/, (m, n) => 'أهلاً، ' + n],
    [/^(.+): your team’s work$/, (m, c) => c + ': عمل فريقك'],
    [/^Invoice #(\d+)$/, (m, n) => 'فاتورة رقم ' + n],
    [/^What (.+) sees$/, (m, c) => 'ما يراه ' + c],
    [/^Portal access is on for (.+)$/, (m, c) => 'وصول البوابة مفعّل لـ ' + c],
    [/^No logins for (.+) yet\.$/, (m, c) => 'لا تسجيلات دخول لـ ' + c + ' بعد.'],
    [/^(\d+) shared$/, (m, n) => n + ' مُشاركة'],
    [/^Shared with (.+)\.$/, (m, c) => 'شُوركت مع ' + c + '.'],
    [/^Hidden from (.+)\.$/, (m, c) => 'أُخفيت عن ' + c + '.']
  );
})();

// Round 31 (Nov 26 2026): quiz builder and question bank, re-voice changed lines, Make the video, GPU time and cost
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  const W = {
    // quiz builder and question bank
    'Quiz':'الاختبار', 'Module checkpoint quiz':'اختبار نهاية الوحدة', 'Edit the questions':'عدّل الأسئلة', 'Add a quiz':'أضف اختباراً', 'Edit the module quiz':'عدّل اختبار الوحدة',
    'Questions are edited in the quiz builder.':'تُعدّل الأسئلة في منشئ الاختبارات.', 'Question bank':'بنك الأسئلة', 'Open the question bank':'افتح بنك الأسئلة',
    'Spread the right answers in every quiz':'وزّع الإجابات الصحيحة في كل الاختبارات', 'Edits go into the draft, like the lesson text.':'تذهب التعديلات إلى المسودة، مثل نص الدرس.',
    'Find a question':'ابحث عن سؤال', 'Words in the question or options':'كلمات من السؤال أو الخيارات', 'Only quizzes with problems':'الاختبارات التي فيها مشكلات فقط',
    'Go to':'انتقل إلى', 'Pick a quiz':'اختر اختباراً', 'Pass mark %':'درجة النجاح %', 'Spread the right answers':'وزّع الإجابات الصحيحة', '+ Add a question':'+ أضف سؤالاً',
    'Checks pass':'الفحوص سليمة', 'Must fix':'يجب إصلاحه', 'No questions yet.':'لا أسئلة بعد.', 'One right answer':'إجابة صحيحة واحدة', 'Pick all that apply':'اختر كل ما ينطبق',
    'Copy to…':'انسخ إلى…', 'Question':'السؤال', '+ Add an option':'+ أضف خياراً', 'Why (shown after they answer)':'السبب (يظهر بعد الإجابة)', 'Right answer':'الإجابة الصحيحة',
    'Drill banks have no pass mark; the checkpoint draws from them.':'بنوك التدريب بلا درجة نجاح؛ يسحب منها اختبار نهاية الوحدة.',
    'Marketing uses one pass mark for every module (80%), set in the course plan.':'يستخدم كورس التسويق درجة نجاح واحدة لكل الوحدات (80%)، محددة في خطة الكورس.',
    'Changes go into your draft. Learners see them after you publish the module. Quiz attempts already started keep the questions they began with.':'تذهب التغييرات إلى مسودتك. يراها المتعلمون بعد نشر الوحدة. محاولات الاختبار التي بدأت تحتفظ بأسئلتها الأولى.',
    'Arabic for this question is kept and moves with its options. Edit the Arabic words in the Marketing source files.':'تُحفظ الترجمة العربية لهذا السؤال وتتحرك مع خياراتها. عدّل الكلمات العربية في ملفات مصدر كورس التسويق.',
    'Psychology sections have no quizzes.':'أقسام كورس علم النفس بلا اختبارات.', 'This module has no quizzes yet.':'لا اختبارات في هذه الوحدة بعد.',
    'The right answers are already spread out.':'الإجابات الصحيحة موزعة بالفعل.',
    // re-voice
    'Needs re-voice':'يحتاج تسجيل صوت جديد', 'Re-voice changed lines':'أعد تسجيل الأسطر المتغيرة', 'Changed lines':'الأسطر المتغيرة', 'Queuing…':'جارٍ الإضافة إلى الطابور…',
    'These lessons were published with changed narrated lines. Re-voice keeps every unchanged line as it sounds now and voices only the changed ones.':'نُشرت هذه الدروس بأسطر مسموعة متغيرة. إعادة التسجيل تُبقي كل سطر لم يتغير كما هو، وتسجّل الأسطر المتغيرة فقط.',
    'Uses the published lesson. Publish your draft first if it changes these lines.':'يستخدم الدرس المنشور. انشر مسودتك أولاً إن كانت تغيّر هذه الأسطر.',
    'In the queue':'في الطابور',
    // Make the video
    'Make the video':'أنشئ الفيديو', 'Make it again':'أنشئه مرة أخرى', 'Making it…':'جارٍ الإنشاء…', 'Sure? Make it':'متأكد؟ أنشئه', 'Narration':'التعليق الصوتي',
    'Arabic narration (فصحى)':'التعليق الصوتي العربي (فصحى)', 'Your OK':'موافقتك', 'Not built yet':'لم يُبنَ بعد', 'Not narrated yet':'لم يُسجّل بعد', 'Cancelled':'أُلغي',
    'Put live':'انشره للمتعلمين', 'Sure? Learners get this video':'متأكد؟ سيرى المتعلمون هذا الفيديو', 'Putting it live…':'جارٍ النشر…', 'Throw away this version':'تخلّص من هذه النسخة',
    'Sure? Throw it away':'متأكد؟ تخلّص منها', 'Earlier versions':'نسخ سابقة', 'The new version (not live).':'النسخة الجديدة (غير منشورة).',
    'Watch it, then press Put live. Learners see the old video until then.':'شاهده ثم اضغط «انشره للمتعلمين». يرى المتعلمون الفيديو القديم حتى ذلك الحين.',
    'Learners see this version.':'يرى المتعلمون هذه النسخة.', 'Nothing changes for learners until you press Put live.':'لا يتغير شيء عند المتعلمين حتى تضغط «انشره للمتعلمين».',
    'Your draft isn’t published. Narration and video use the published lesson.':'مسودتك غير منشورة. يستخدم التعليق الصوتي والفيديو الدرس المنشور.',
    'Psychology lesson videos aren’t built by the video runner yet, so this makes the narration only.':'لا يبني مشغّل الفيديو دروس علم النفس بعد، لذا يُنشئ هذا التعليق الصوتي فقط.',
    'Waits for the narration, then yukis-pc builds it':'ينتظر التعليق الصوتي، ثم يبنيه جهاز yukis-pc', 'Waiting for the video runner on yukis-pc':'ينتظر مشغّل الفيديو على جهاز yukis-pc',
    'Waiting for yukis-pc (offline now)':'ينتظر جهاز yukis-pc (غير متصل الآن)', 'In the queue, the PC is online':'في الطابور، والجهاز متصل',
    'The staged file isn’t in R2 yet. The PC may still be uploading it.':'الملف الجديد ليس في R2 بعد. ربما ما زال الجهاز يرفعه.',
    'Older narrations can be put back from Voice Studio › Projects › Versions.':'يمكن إرجاع التسجيلات الأقدم من استوديو الصوت › المشاريع › النسخ.',
    'A video for this lesson is already being made.':'يجري إنشاء فيديو لهذا الدرس بالفعل.', 'Arabic narration queued.':'أُضيف التعليق الصوتي العربي إلى الطابور.',
    'Queued. You’ll get a bell when the new video is ready for your OK.':'أُضيف إلى الطابور. سيصلك تنبيه عندما يجهز الفيديو الجديد لموافقتك.',
    'That version was thrown away. The live video is unchanged.':'تم التخلّص من تلك النسخة. الفيديو المنشور لم يتغير.',
    'The new video or its captions aren’t saved yet. Try again in a minute.':'الفيديو الجديد أو ترجمته لم يُحفظا بعد. حاول بعد دقيقة.',
    'It didn’t go live, and everything was put back as it was. Try again.':'لم يُنشر، وأُعيد كل شيء كما كان. حاول مجدداً.',
    'Couldn’t read the video folders. Nothing was changed.':'تعذّرت قراءة مجلدات الفيديو. لم يتغير شيء.',
    'This lesson has no published text to narrate yet.':'هذا الدرس ليس فيه نص منشور للتسجيل بعد.', 'This section has no Arabic text to narrate yet.':'هذا القسم ليس فيه نص عربي للتسجيل بعد.',
    'Couldn’t keep a copy of the current narration in Versions, so nothing was sent. Try again.':'تعذّر حفظ نسخة من التسجيل الحالي في النسخ، لذا لم يُرسل شيء. حاول مجدداً.',
    // GPU time and cost
    'GPU cost':'تكلفة المعالج الرسومي', 'GPU time and cost':'وقت المعالج الرسومي وتكلفته', 'Narration and lesson videos':'التعليق الصوتي وفيديوهات الدروس', 'GPU time':'وقت المعالج الرسومي',
    'Modal cloud':'سحابة Modal', 'estimated':'تقديري', 'narration and video builds':'التعليق الصوتي وبناء الفيديو', 'By month':'حسب الشهر', 'By course':'حسب الكورس', 'By lesson':'حسب الدرس',
    'Month':'الشهر', 'Video builds':'بناء الفيديو', 'Jobs':'المهام', 'Cost':'التكلفة', 'Lessons':'الدروس', 'Lesson':'الدرس', 'Runs':'مرات التشغيل', 'Rates':'الأسعار',
    'Modal $ an hour':'Modal بالدولار في الساعة', 'yukis-pc $ an hour':'yukis-pc بالدولار في الساعة', 'Save rates':'احفظ الأسعار',
    'New rates apply to jobs that finish from now on.':'تُطبّق الأسعار الجديدة على المهام التي تنتهي من الآن.', 'Per lesson and course':'لكل درس وكورس',
    'No GPU work recorded yet.':'لم يُسجّل أي عمل للمعالج الرسومي بعد.', 'Adding up GPU time…':'جارٍ جمع وقت المعالج الرسومي…', 'Use numbers of 0 or more.':'استخدم أرقاماً من 0 فأكثر.',
    'GPU time and estimated cost of every narration and lesson video, per month, course and lesson.':'وقت المعالج الرسومي والتكلفة التقديرية لكل تعليق صوتي وفيديو درس، حسب الشهر والكورس والدرس.',
    'Acquisitions':'الاستحواذ', 'Psychology':'علم النفس', 'Marketing':'التسويق', 'Scripts and tests':'نصوص واختبارات',
    // Round 32: lesson boxes that fold (lesson-fold.js) and the course language switch in the builder preview
    'Hide this box':'إخفاء هذا الصندوق', 'Show this box':'إظهار هذا الصندوق', 'Language':'اللغة', 'Show the lesson in English':'اعرض الدرس بالإنجليزية', 'Show the lesson in Arabic':'اعرض الدرس بالعربية'
  };
  Object.keys(W).forEach(k => { if (!(k in L.AR)) L.AR[k] = W[k]; });
  if (L.RULES) L.RULES.push(
    [/^Question bank · Module (\d+)$/, (m, n) => 'بنك الأسئلة · الوحدة ' + n],
    [/^Quiz (\S+) · (.+)$/, (m, n, t) => 'اختبار ' + n + ' · ' + t],
    [/^Checkpoint · (.+)$/, (m, t) => 'اختبار نهاية الوحدة · ' + t],
    [/^Drill bank · (.+)$/, (m, t) => 'بنك التدريب · ' + t],
    [/^Module (\d+) checkpoint quiz$/, (m, n) => 'اختبار نهاية الوحدة ' + n],
    [/^(\d+) questions? in (\d+) quiz(zes)?$/, (m, a, b) => a + ' سؤال في ' + b + ' اختبار'],
    [/^(\d+) (things?|quiz(zes)?) to fix$/, (m, n) => n + ' للإصلاح'],
    [/^(\d+) (things?|quiz(zes)?) to check$/, (m, n) => n + ' للمراجعة'],
    [/^Usual: (\d+)$/, (m, n) => 'المعتاد: ' + n],
    [/^(\d+) changed lines? to voice$/, (m, n) => n + ' سطر متغير للتسجيل'],
    [/^Re-voice all (\d+)$/, (m, n) => 'أعد تسجيل الكل (' + n + ')'],
    [/^Narrated (.+)$/, (m, t) => 'سُجّل ' + t],
    [/^Live since (.+)$/, (m, t) => 'منشور منذ ' + t],
    [/^Failed: (.*)$/, (m, t) => 'فشل: ' + t]
  );
})();

// Round 38: Automations, Friday summary, quiet hours and phone alert steps
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  const W = {
    'Automations':'الأتمتة', 'Rules':'القواعد', 'Run log':'سجل التشغيل', 'Waiting for your OK':'بانتظار موافقتك', 'Friday summary':'ملخص الجمعة',
    'Simple rules: when something happens in the portal, the portal does the next step for you. Rules never email, text or message anyone outside the team, never touch money or pay, and never delete anything. Those wait here for your OK.':'قواعد بسيطة: عندما يحدث شيء في البوابة، تقوم البوابة بالخطوة التالية عنك. القواعد لا ترسل بريداً أو رسالة نصية أو رسالة لأي شخص خارج الفريق، ولا تلمس المال أو الأجور، ولا تحذف أي شيء. هذه تنتظر موافقتك هنا.',
    'New rule':'قاعدة جديدة', 'Edit rule':'تعديل القاعدة', 'Edit':'تعديل', 'Test on a past event':'جرّبها على حدث سابق', 'Runs':'مرات التشغيل', 'Remove':'إزالة', 'Sure? Remove it':'متأكد؟ أزلها',
    'When':'عندما', 'Only if':'فقط إذا', 'Then':'ثم', 'On':'تعمل', 'Off':'متوقفة', 'Hasn’t run yet.':'لم تعمل بعد.', 'Name':'الاسم', 'What it’s for (optional)':'الغرض منها (اختياري)',
    'Only if (optional)':'فقط إذا (اختياري)', 'No conditions: it runs on every event of this kind.':'بدون شروط: تعمل مع كل حدث من هذا النوع.', 'Add a condition':'أضف شرطاً', 'Add a step':'أضف خطوة',
    'Remove this step':'احذف هذه الخطوة', 'Save rule':'حفظ القاعدة', 'Field':'الحقل', 'Check':'الفحص', 'Value':'القيمة', 'Do':'افعل', 'To':'إلى', 'For':'لـ', 'Title':'العنوان', 'More (optional)':'تفاصيل (اختياري)',
    'Due in (days)':'الموعد بعد (أيام)', 'Priority':'الأولوية', 'Normal':'عادية', 'High':'عالية', 'Low':'منخفضة', 'Note':'ملاحظة', 'Tag':'وسم', 'Move to':'انقل إلى', 'Kind':'النوع', 'Message':'رسالة', 'Email':'بريد', 'Text':'رسالة نصية',
    'To (who you’ll send it to)':'إلى (من سترسلها له)', 'Subject (optional)':'الموضوع (اختياري)', 'Me':'أنا', 'The person in the event':'الشخص في الحدث',
    'Send a bell and phone alert':'أرسل تنبيه الجرس والهاتف', 'Make a task':'أنشئ مهمة', 'Add a note':'أضف ملاحظة', 'Add a tag':'أضف وسماً', 'Move the card':'انقل البطاقة', 'Draft a message for my OK':'اكتب مسودة رسالة لموافقتي',
    'A deal moves to another stage':'صفقة تنتقل إلى مرحلة أخرى', 'A deal closes (closed, won, sold or funded)':'صفقة تُغلق (مغلقة، رابحة، مباعة أو مموّلة)', 'A deal is added':'إضافة صفقة',
    'Someone clocks out':'شخص ينهي ورديته', 'A lead gets an outcome':'عميل محتمل يحصل على نتيجة', 'A callback is set':'تحديد معاودة اتصال', 'An invoice is sent':'إرسال فاتورة',
    'A client payment comes in':'وصول دفعة من عميل', 'Someone applies to join':'شخص يتقدّم للانضمام', 'Someone finishes a lesson':'شخص ينهي درساً', 'A task is finished':'إنجاز مهمة',
    'is':'يساوي', 'is not':'لا يساوي', 'has the words':'يحتوي على', 'doesn’t have':'لا يحتوي على', 'is at least':'على الأقل', 'is at most':'على الأكثر',
    'Pick a past event':'اختر حدثاً سابقاً', 'Test':'جرّب', 'Close':'إغلاق', 'No past events of this kind yet':'لا توجد أحداث سابقة من هذا النوع بعد',
    'Run it for real on this event':'شغّلها فعلياً على هذا الحدث', 'Sure? This does the steps for real':'متأكد؟ هذا ينفّذ الخطوات فعلياً',
    'Show every rule':'أظهر كل القواعد', 'No runs yet. Runs and tests show here.':'لا توجد مرات تشغيل بعد. التشغيل والتجارب تظهر هنا.', 'Done':'تم', 'Test only':'تجربة فقط', 'No match':'لا تطابق', 'Problem':'مشكلة', 'A removed rule':'قاعدة محذوفة',
    'Automations only draft these. Nothing goes to a client, seller or anyone outside the team until you send it yourself.':'الأتمتة تكتب هذه كمسودات فقط. لا يصل شيء لعميل أو بائع أو أي شخص خارج الفريق حتى ترسله بنفسك.',
    'Nothing waiting.':'لا شيء بالانتظار.', 'Handled lately':'تمت معالجتها مؤخراً', 'Copy the text':'انسخ النص', 'I sent it myself':'أرسلتها بنفسي', 'Not needed':'غير مطلوبة',
    'You sent this yourself.':'أرسلت هذه بنفسك.', 'Marked not needed.':'عُلّمت كغير مطلوبة.',
    'Send me the Friday summary':'أرسل لي ملخص الجمعة', 'At (Cairo time)':'في الساعة (بتوقيت القاهرة)', 'Send a test to me now':'أرسل تجربة لي الآن', 'Latest summary':'آخر ملخص',
    'None yet. The first one comes this Friday, or send a test.':'لا يوجد بعد. يصل الأول هذه الجمعة، أو أرسل تجربة.',
    'One page for you every Friday, in the bell and by email: shifts and hours, calls by rep, deals, fees, invoices, cash this week, lessons, applicants, and what’s waiting for you. Only you get it.':'صفحة واحدة لك كل جمعة، في الجرس وبالبريد: الورديات والساعات، المكالمات لكل مندوب، الصفقات، الأتعاب، الفواتير، النقد هذا الأسبوع، الدروس، المتقدمون، وما ينتظرك. أنت فقط تستلمها.',
    'Quiet hours':'ساعات الهدوء', 'Use quiet hours':'استخدم ساعات الهدوء', 'Quiet hours off.':'ساعات الهدوء متوقفة.',
    'No phone alerts in these hours. The bell still keeps them for when you open the portal. Sign-in warnings and must-read announcements still come through.':'لا تنبيهات على الهاتف في هذه الساعات. الجرس يحتفظ بها حتى تفتح البوابة. تحذيرات تسجيل الدخول والإعلانات المهمة تصل دائماً.',
    'How to get alerts on your phone':'كيف تصلك التنبيهات على هاتفك',
    'Then each kind of alert above follows your Phone ticks. If alerts stop, turn phone alerts off and on again on that phone.':'بعدها يتبع كل نوع من التنبيهات أعلاه اختيارك في عمود الهاتف. إذا توقفت التنبيهات، أوقفها ثم شغّلها مرة أخرى على ذلك الهاتف.',
    'Automations and Friday summary':'الأتمتة وملخص الجمعة', 'Alerts from automation rules, and the Friday summary for Amr':'تنبيهات قواعد الأتمتة، وملخص الجمعة لعمرو',
    'Give the rule a name.':'أعطِ القاعدة اسماً.', 'Every alert and task needs a title.':'كل تنبيه ومهمة يحتاج عنواناً.', 'Write the draft message.':'اكتب نص المسودة.',
    'Rule saved.':'حُفظت القاعدة.', 'Rule added, switched off. Test it, then switch it on.':'أُضيفت القاعدة وهي متوقفة. جرّبها ثم شغّلها.', 'Switched on.':'شُغّلت.', 'Switched off.':'أُوقفت.', 'Rule removed.':'أُزيلت القاعدة.',
    'Done. See the run log.':'تم. راجع سجل التشغيل.', 'Copied.':'نُسخ.', 'Sending…':'جارٍ الإرسال…', 'Sent to you only. Check the bell and your email.':'أُرسلت لك فقط. راجع الجرس وبريدك.', 'Friday summary off.':'ملخص الجمعة متوقف.',
    'This page is only for Amr.':'هذه الصفحة لعمرو فقط.'
  };
  Object.keys(W).forEach(k => { if (!(k in L.AR)) L.AR[k] = W[k]; });
  if (L.RULES) L.RULES.push(
    [/^(\d+) rules?, (\d+) switched on\. The starter rules begin switched off\.$/, (m, a, b) => a + ' قاعدة، ' + b + ' تعمل. القواعد الجاهزة تبدأ متوقفة.'],
    [/^Ran (\d+) times?, last (.+) Cairo time\.$/, (m, n, t) => 'عملت ' + n + ' مرة، آخرها ' + t + ' بتوقيت القاهرة.'],
    [/^Saved\. It comes every Friday at (.+) Cairo time\.$/, (m, t) => 'حُفظ. يصل كل جمعة الساعة ' + t + ' بتوقيت القاهرة.']
  );
})();
