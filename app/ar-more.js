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
