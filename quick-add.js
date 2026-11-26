// Round 39 (H3) of the Portal Master Feature Plan: Quick add (+) in the top bar of every signed-in page.
// portal-shell.js loads this file on the first tap of + and calls QuickAdd.open(button).
// What each person can add (the database checks every save again with its own rules):
//   Amr:              Task (for anyone), Expense (into Cash), Note (into Me › Work log), Lead (Clients › Client pipeline),
//                     Deal (opens the Deal CRM, where deals are encrypted), File (Files › mine/quick)
//   Team with Deal tools: Task for themselves, Deal and Lead (both open the Deal CRM, where seller leads live)
//   Everyone else:    Task for themselves
// Nothing here sends a message or touches money outside Cash: an expense is only a record in Cash.
// Styles: /quick-add.css (loaded with this file). No inline styles: /course/ forbids them.
(function(){
  'use strict';
  if (window.QuickAdd) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/quick-add.css?v=1'; document.head.append(css);

  // Arabic for every label here, the same way Round 33 part 2 adds them (AppLang.AR for labels, AppLang.TPL for phrases)
  const L = window.AppLang;
  if (L && L.AR) {
    Object.assign(L.AR, {
      'Quick add':'إضافة سريعة', 'What do you want to add?':'ماذا تريد أن تضيف؟', 'Task':'مهمة', 'Expense':'مصروف', 'Note':'ملاحظة', 'Lead':'عميل محتمل', 'Deal':'صفقة', 'File':'ملف',
      'Add a task':'أضف مهمة', 'Add an expense':'أضف مصروفًا', 'Add a note':'أضف ملاحظة', 'Add a lead':'أضف عميلًا محتملًا', 'Add a file':'أضف ملفًا',
      'What needs doing':'ما الذي يجب فعله', 'Due':'موعد التسليم', 'For':'لـ', 'Me':'أنا', 'Save task':'احفظ المهمة', 'What you paid for':'ما الذي دفعت مقابله',
      'Amount':'المبلغ', 'Currency':'العملة', 'Category':'الفئة', 'Date':'التاريخ', 'Save expense':'احفظ المصروف', 'Your note':'ملاحظتك', 'Save note':'احفظ الملاحظة',
      'Company or person':'الشركة أو الشخص', 'Where they came from (optional)':'من أين جاؤوا (اختياري)', 'Save lead':'احفظ العميل المحتمل',
      'Pick a file (up to 50 MB)':'اختر ملفًا (حتى 50 ميجابايت)', 'Upload file':'ارفع الملف', 'Back':'رجوع', 'Close':'إغلاق', 'Saving…':'جارٍ الحفظ…',
      'Write the task first.':'اكتب المهمة أولًا.', 'Say what you paid for.':'اكتب ما الذي دفعت مقابله.', 'Enter the amount, like 20.':'أدخل المبلغ، مثل 20.',
      'Write the note first.':'اكتب الملاحظة أولًا.', 'Write the company or person first.':'اكتب الشركة أو الشخص أولًا.', 'Pick a file first.':'اختر ملفًا أولًا.',
      'That file is over 50 MB.':'هذا الملف أكبر من 50 ميجابايت.', 'Couldn’t save it. Check your connection and try again.':'تعذّر الحفظ. تحقّق من اتصالك وحاول مرة أخرى.',
      'Task saved.':'تم حفظ المهمة.', 'Expense saved in Cash.':'تم حفظ المصروف في الكاش.', 'Note saved in your work log.':'تم حفظ الملاحظة في سجل عملك.',
      'Lead saved in the client pipeline.':'تم حفظ العميل المحتمل في مسار العملاء.', 'File uploaded.':'تم رفع الملف.', 'Open':'افتح',
      'Opens the Deal CRM, where deals stay encrypted.':'يفتح نظام الصفقات، حيث تبقى الصفقات مشفّرة.', 'Opens the Deal CRM to add a seller lead.':'يفتح نظام الصفقات لإضافة عميل بائع.',
      'Goes to Tasks.':'يذهب إلى المهام.', 'Goes to Cash.':'يذهب إلى الكاش.', 'Goes to Me › Work log, today.':'يذهب إلى سجل العمل اليوم.', 'Goes to the client pipeline as New.':'يذهب إلى مسار العملاء كجديد.',
      'Goes to Files › mine/quick.':'يذهب إلى الملفات › mine/quick.', 'Paid now, at this week’s dollar rate.':'مدفوع الآن، بسعر الدولار لهذا الأسبوع.', 'Other':'أخرى', 'Today':'اليوم'
    });
    Object.assign(L.TPL || {}, { 'Saved for {}.':'حُفظت لـ {}.' });
  }

  let panel = null, anchor = null, members = null, cats = null;
  const shell = () => window.PortalShell || {};
  const me = () => shell().me || null;
  const db = () => shell().db;
  const owner = () => (me() || {}).role === 'owner';
  const has = k => ((me() || {}).keys || []).includes(k);
  const cairoDay = () => new Date().toLocaleDateString('en-CA', { timeZone:'Africa/Cairo' });
  const nyDay = () => new Date().toLocaleDateString('en-CA', { timeZone:'America/New_York' });
  const safe = p => Promise.resolve(p).then(x => x, e => ({ error:e }));
  async function uid(){ const r = await safe(db().auth.getUser()); return r && r.data && r.data.user ? r.data.user.id : null; }

  function kinds(){
    const k = [['task', 'Task', 'Goes to Tasks.']];
    if (owner()) k.push(['expense', 'Expense', 'Goes to Cash.'], ['note', 'Note', 'Goes to Me › Work log, today.'], ['lead', 'Lead', 'Goes to the client pipeline as New.'],
      ['deal', 'Deal', 'Opens the Deal CRM, where deals stay encrypted.'], ['file', 'File', 'Goes to Files › mine/quick.']);
    else if (has('deals')) k.push(['deal', 'Deal', 'Opens the Deal CRM, where deals stay encrypted.'], ['lead', 'Lead', 'Opens the Deal CRM to add a seller lead.']);
    return k;
  }

  function build(){
    panel = document.createElement('div'); panel.className = 'qa-panel'; panel.id = 'qaPanel'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'qaH');
    document.body.append(panel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel && !panel.hidden) close(true); });
    document.addEventListener('click', e => { if (panel && !panel.hidden && !e.target.closest('.qa-panel, .p-qadd')) close(false); });
    panel.addEventListener('click', onClick);
    panel.addEventListener('submit', onSubmit);
  }
  function place(){
    if (!anchor || !panel) return;
    const r = anchor.getBoundingClientRect(), w = Math.min(380, window.innerWidth - 16);
    let left = r.right - w; if (left < 8) left = 8;
    panel.style.setProperty('--qa-top', Math.round(r.bottom + 8) + 'px');   // custom properties set by script (allowed); never a style="" attribute
    panel.style.setProperty('--qa-left', Math.round(left) + 'px');
    panel.style.setProperty('--qa-w', Math.round(w) + 'px');
  }
  function head(title, back){
    return '<div class="qa-head">' + (back ? '<button type="button" class="qa-x" data-qa-back aria-label="Back">‹</button>' : '') +
      '<h2 id="qaH">' + esc(title) + '</h2><button type="button" class="qa-x" data-qa-close aria-label="Close">×</button></div>';
  }
  function menu(){
    panel.innerHTML = head('Quick add') + '<p class="qa-sub">What do you want to add?</p><div class="qa-kinds">' +
      kinds().map(([k, t, sub]) => '<button type="button" class="qa-kind" data-qa-kind="' + k + '"><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></button>').join('') + '</div>';
    const f = panel.querySelector('.qa-kind'); if (f) f.focus();
  }
  const field = (lab, inner) => '<label class="qa-f"><span>' + esc(lab) + '</span>' + inner + '</label>';
  const msg = '<p class="qa-msg" id="qaMsg" role="status" aria-live="polite"></p>';
  const say = (t, ok) => { const m = panel.querySelector('#qaMsg'); if (m) { m.textContent = t; m.classList.toggle('is-ok', !!ok); } };

  async function form(kind){
    if (kind === 'deal' || (kind === 'lead' && !owner())) { close(false); location.href = '/app/deals/'; return; }
    if (kind === 'task') {
      let who = '';
      if (owner()) {
        if (!members) { const r = await safe(db().from('members').select('user_id,name,active').eq('active', true).order('name')); members = (r && r.data) || []; }
        who = field('For', '<select name="who"><option value="">Me</option>' + members.map(m => '<option value="' + esc(m.user_id) + '">' + esc(m.name || m.user_id) + '</option>').join('') + '</select>');
      }
      panel.innerHTML = head('Add a task', true) + '<form class="qa-form" data-qa-form="task">' + field('What needs doing', '<input name="title" maxlength="300" required autocomplete="off">') +
        field('Due', '<input type="date" name="due" value="' + cairoDay() + '">') + who + msg + '<button class="p-btn" type="submit">Save task</button></form>';
    } else if (kind === 'expense') {
      if (!cats) { const r = await safe(db().from('cash_entries').select('category').eq('kind', 'expense').order('entry_date', { ascending:false }).limit(300)); cats = [...new Set(((r && r.data) || []).map(x => x.category).filter(Boolean))].slice(0, 30); }
      panel.innerHTML = head('Add an expense', true) + '<form class="qa-form" data-qa-form="expense">' + field('What you paid for', '<input name="title" maxlength="120" required autocomplete="off">') +
        '<div class="qa-row">' + field('Amount', '<input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required>') +
        field('Currency', '<select name="cur"><option>EGP</option><option>USD</option></select>') + '</div>' +
        field('Category', '<input name="cat" list="qaCats" maxlength="40" value="Other"><datalist id="qaCats">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>') +
        field('Date', '<input type="date" name="date" value="' + cairoDay() + '">') + '<p class="qa-sub">Paid now, at this week’s dollar rate.</p>' + msg + '<button class="p-btn" type="submit">Save expense</button></form>';
    } else if (kind === 'note') {
      panel.innerHTML = head('Add a note', true) + '<form class="qa-form" data-qa-form="note">' + field('Your note', '<textarea name="text" rows="3" maxlength="1000" required></textarea>') + msg + '<button class="p-btn" type="submit">Save note</button></form>';
    } else if (kind === 'lead') {
      panel.innerHTML = head('Add a lead', true) + '<form class="qa-form" data-qa-form="lead">' + field('Company or person', '<input name="name" maxlength="120" required autocomplete="off">') +
        field('Where they came from (optional)', '<input name="source" maxlength="40" autocomplete="off">') + msg + '<button class="p-btn" type="submit">Save lead</button></form>';
    } else if (kind === 'file') {
      panel.innerHTML = head('Add a file', true) + '<form class="qa-form" data-qa-form="file">' + field('Pick a file (up to 50 MB)', '<input type="file" name="file" required>') + msg + '<button class="p-btn" type="submit">Upload file</button></form>';
    }
    const f = panel.querySelector('input:not([type=hidden]), textarea'); if (f) f.focus();
  }

  function onClick(e){
    if (e.target.closest('[data-qa-close]')) return close(true);
    if (e.target.closest('[data-qa-back]')) return menu();
    const k = e.target.closest('[data-qa-kind]'); if (k) form(k.dataset.qaKind);
  }
  async function rateNow(){
    const r = await safe(db().from('fx_rates').select('from_date,rate').lte('from_date', cairoDay()).order('from_date', { ascending:false }).limit(1));
    const x = r && r.data && r.data[0]; return x ? Number(x.rate) : null;
  }
  async function onSubmit(e){
    e.preventDefault();
    const f = e.target, kind = f.dataset.qaForm, v = n => (f.elements[n] ? String(f.elements[n].value || '').trim() : '');
    const btn = f.querySelector('button[type=submit]'), label = btn.textContent;
    const busy = on => { btn.disabled = on; btn.textContent = on ? 'Saving…' : label; };
    let done = '', link = '', r = null;
    if (kind === 'task') {
      const title = v('title').replace(/\s+/g, ' '); if (!title) return say('Write the task first.');
      busy(true); const id = await uid(); const to = v('who') || id;
      r = await safe(db().from('portal_tasks').insert({ title, assigned_to:to, created_by:id, due_on:v('due') || null }));
      done = to === id ? 'Task saved.' : 'Saved for ' + ((members || []).find(m => m.user_id === to) || {}).name + '.'; link = '/app/#tasks';
    } else if (kind === 'expense') {
      const title = v('title').replace(/\s+/g, ' '), amount = parseFloat(v('amount'));
      if (!title) return say('Say what you paid for.'); if (!(amount > 0)) return say('Enter the amount, like 20.');
      busy(true); const rate = await rateNow();
      const row = { kind:'expense', entry_date:v('date') || cairoDay(), title, category:v('cat').replace(/\s+/g, ' ') || 'Other', amount:Math.round(amount * 100) / 100,
        currency:v('cur') || 'EGP', fx_rate:rate, fx_source:'week', settled:true, settled_at:new Date().toISOString(), recurring:false, personal:false };
      r = await safe(db().from('cash_entries').insert(row)); done = 'Expense saved in Cash.'; link = '/app/#expense'; cats = null;
    } else if (kind === 'note') {
      const text = v('text'); if (!text) return say('Write the note first.');
      busy(true); r = await safe(db().from('me_work_log').insert({ day:nyDay(), text, status:'done', sort:999 })); done = 'Note saved in your work log.'; link = '/app/#worklog';
    } else if (kind === 'lead') {
      const name = v('name').replace(/\s+/g, ' '); if (!name) return say('Write the company or person first.');
      busy(true); r = await safe(db().from('client_leads').insert({ name, source:v('source') || null, stage:'new' })); done = 'Lead saved in the client pipeline.'; link = '/app/#pipeline';
    } else if (kind === 'file') {
      const file = f.elements.file && f.elements.file.files[0]; if (!file) return say('Pick a file first.'); if (file.size > 50 * 1024 * 1024) return say('That file is over 50 MB.');
      busy(true); const name = file.name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-80) || 'file';
      r = await safe(db().storage.from('files').upload('mine/quick/' + Date.now().toString(36) + '-' + name, file, { contentType:file.type || 'application/octet-stream', upsert:false }));
      done = 'File uploaded.'; link = '/app/#files';
    }
    busy(false);
    if (!r || r.error) return say('Couldn’t save it. Check your connection and try again.');
    f.reset(); say(done, true);
    const m = panel.querySelector('#qaMsg'); if (m && link) m.insertAdjacentHTML('beforeend', ' <a href="' + esc(link) + '">Open</a>');
  }
  function close(focusBack){ if (!panel) return; panel.hidden = true; if (anchor) { anchor.setAttribute('aria-expanded', 'false'); if (focusBack) anchor.focus(); } }

  window.QuickAdd = {
    open(btn){
      if (!panel) build();
      if (!panel.hidden && anchor === btn) return close(true);
      anchor = btn; anchor.setAttribute('aria-expanded', 'true'); anchor.setAttribute('aria-controls', 'qaPanel');
      place(); panel.hidden = false; menu();
    }
  };
  window.addEventListener('resize', place);
})();
