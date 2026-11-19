// Arabic for round 23 (Settings › Notifications and Language and time, access templates, Undo bar, booking traps).
// Same dictionary as i18n.js and ar-more.js; its own file so other rounds' Arabic never collides with it.
(function(){
  'use strict';
  const L = window.AppLang;
  if (!L || !L.AR) return;
  Object.assign(L.AR, {
    // Settings (I29)
    'Notifications':'الإشعارات', 'Language and time':'اللغة والوقت',
    'Everything that can reach you outside the portal, in one place. The bell inside the portal always shows every alert.':'كل ما يمكن أن يصلك خارج البوابة في مكان واحد. الجرس داخل البوابة يعرض دائمًا كل التنبيهات.',
    'Daily email of new alerts':'بريد يومي بالتنبيهات الجديدة', 'Email me once a day with the alerts I haven’t opened':'أرسل لي بريدًا مرة يوميًا بالتنبيهات التي لم أفتحها',
    'Send it at':'أرسله الساعة', 'Cairo time':'بتوقيت القاهرة', 'Daily email off.':'البريد اليومي متوقف.', 'Couldn’t save. Try again.':'تعذّر الحفظ. حاول مرة أخرى.',
    'Deal CRM morning reminder':'تذكير الصباح في إدارة الصفقات', 'Counts only: follow-ups due, callbacks and deals waiting. No deal details leave the CRM.':'أعداد فقط: المتابعات المستحقة ومعاودات الاتصال والصفقات المنتظرة. لا تخرج أي تفاصيل للصفقات من النظام.',
    'Remind me each morning':'ذكّرني كل صباح', 'At':'الساعة', 'in':'في', 'By email':'بالبريد', 'In the bell':'في الجرس',
    'Saved. The CRM’s own Settings shows the same choice.':'تم الحفظ. إعدادات نظام الصفقات تعرض الاختيار نفسه.', 'Morning reminder off.':'تذكير الصباح متوقف.',
    'Saved on this device.':'محفوظ على هذا الجهاز.', 'Language':'اللغة', 'The portal’s words':'كلمات البوابة', 'English':'English',
    'Arabic reads right to left. Courses keep their own language switch inside each lesson.':'العربية تُقرأ من اليمين إلى اليسار. الكورسات لها زر لغة خاص داخل كل درس.',
    'Time zone':'المنطقة الزمنية', 'Show times in':'اعرض الأوقات بتوقيت',
    'Times always show AM or PM with the zone next to them. Shifts and pay days still follow the team’s own rules (work days in New York time, Cash in Cairo).':'الأوقات تظهر دائمًا بصباحًا أو مساءً مع اسم المنطقة بجانبها. الورديات وأيام الدفع تتبع قواعد الفريق (أيام العمل بتوقيت نيويورك، والنقدية بتوقيت القاهرة).',
    'Look':'المظهر', 'The portal uses one light look so every page, course and calculator matches.':'البوابة تستخدم مظهرًا فاتحًا واحدًا لتتطابق كل الصفحات والكورسات والحاسبات.',
    'Cairo':'القاهرة', 'New York (Eastern)':'نيويورك (الشرقي)', 'Chicago (Central)':'شيكاغو (الأوسط)', 'Denver (Mountain)':'دنفر (الجبلي)', 'Los Angeles (Pacific)':'لوس أنجلوس (المحيط الهادئ)',
    'London':'لندن', 'Dubai':'دبي', 'Riyadh':'الرياض',
    // Invite and access templates (I30)
    'Quick setup':'إعداد سريع', 'Start as':'ابدأ كـ', 'Agent (everything the role comes with)':'موظف (كل ما يأتي مع الدور)',
    'Calling rep':'مندوب اتصال', 'Shifts, Acquisitions course, no Deal tools':'الورديات، كورس الاستحواذ، بدون أدوات الصفقات',
    'Acquisitions rep':'مندوب استحواذ', 'Shifts, course, Deal CRM with authenticator code, call counter':'الورديات، الكورس، إدارة الصفقات برمز المصادقة، عدّاد المكالمات',
    'Team manager':'مدير الفريق', 'Runs shifts and requests, course and Deal tools':'يدير الورديات والطلبات، الكورس وأدوات الصفقات',
    'Course student':'طالب كورس', 'Courses only (Acquisitions, Marketing, Psychology)':'الكورسات فقط (الاستحواذ، التسويق، علم النفس)',
    'Client':'عميل', 'Comes with the client portal (Round 36)':'يأتي مع بوابة العملاء (الجولة 36)',
    'One click fills the role and the boxes below. Nothing changes until you press Save changes.':'نقرة واحدة تملأ الدور والخانات بالأسفل. لا يتغير شيء حتى تضغط حفظ التغييرات.',
    'You can change anything after on their row.':'يمكنك تغيير أي شيء لاحقًا من صفّه.',
    // Undo bar (I5)
    'Undo':'تراجع', 'Habit deleted, with its ticks.':'تم حذف العادة مع علاماتها.', 'Goal deleted, with its steps.':'تم حذف الهدف مع خطواته.', 'Step deleted.':'تم حذف الخطوة.',
    'Entry deleted.':'تم حذف الإدخال.', 'Study block deleted.':'تم حذف فترة المذاكرة.', 'Target removed.':'تمت إزالة الهدف الأسبوعي.', 'Task deleted.':'تم حذف المهمة.',
    'Scheduled shift removed.':'تمت إزالة الوردية المجدولة.', 'Coaching post deleted.':'تم حذف منشور التوجيه.'
  });
  if (L.RULES) L.RULES.push(
    [/^Set up as (.+)\. Change anything below, then Save changes\.$/, (m, n) => 'تم الإعداد كـ ' + (L.AR[n] || n) + '. غيّر ما تريد بالأسفل ثم احفظ التغييرات.'],
    [/^Right now: (.+)$/, (m, t) => 'الآن: ' + t],
    [/^This device’s zone \((.+)\)$/, (m, z) => 'منطقة هذا الجهاز (' + z + ')'],
    [/^Saved\. One email a day at (.+) Cairo time, only if something is unopened\.$/, (m, t) => 'تم الحفظ. بريد واحد يوميًا الساعة ' + t + ' بتوقيت القاهرة، فقط إن وُجد ما لم يُفتح.']
  );
})();
