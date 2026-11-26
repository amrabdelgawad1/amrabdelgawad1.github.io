// Plan Round 39 of the Portal Master Feature Plan (Nov 26 2026): home basics. Used by portal-home.js.
//   H2  Today timeline: today's shifts, follow-ups, closings, calls, study blocks and tasks in one list, in time order,
//       each time shown in Cairo and New York. Amr sees the whole team's planned shifts and every deal date; others see their own.
//   H8  This week: deals moved, hours worked, cash in and out (Amr only) and Acquisitions lessons finished, Monday to today (Cairo).
//   H10 Home per role: R39Home.isStudent() picks the learning home for course students (no clock, no hours); portal-home.js draws it.
//       Amr keeps the Admin overview, calling reps the short home, managers the full home, clients /client/ (Round 36).
// Everything reads through the page's Supabase client under the database's own rules; nothing here writes or sends.
// Deals are encrypted in the browser: only the readable columns (kind, county, state, stage, dates) are used, never names.
(function(){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const safe = p => Promise.resolve(p).then(r => r || {}, e => ({ error:e }));
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const CAIRO = 'Africa/Cairo', NY = 'America/New_York';

  // Arabic for every new label, the same way Round 33 part 2 adds them (AppLang.AR for labels, AppLang.TPL for phrases with a name or number)
  const L = window.AppLang;
  if (L && L.AR) {
    Object.assign(L.AR, {
      'Today timeline':'جدول اليوم', 'Any time today':'في أي وقت اليوم', 'Late':'متأخر', 'Shift':'وردية', 'Task':'مهمة', 'Callback':'معاودة اتصال', 'Follow-up':'متابعة',
      'Closing':'إغلاق', 'Inspection ends':'انتهاء الفحص', 'Study':'دراسة', 'Client follow-up':'متابعة عميل', 'Nothing on today. Shifts, tasks, callbacks, follow-ups, closings and study blocks show here.':'لا شيء اليوم. تظهر هنا الورديات والمهام ومعاودات الاتصال والمتابعات والإغلاقات وجلسات الدراسة.',
      'Couldn’t load today. Refresh to try again.':'تعذّر تحميل اليوم. حدّث الصفحة للمحاولة مرة أخرى.', 'This week':'هذا الأسبوع', 'Monday to today, Cairo time':'من الإثنين حتى اليوم، بتوقيت القاهرة',
      'deals moved':'صفقات تحركت', 'deal moved':'صفقة تحركت', 'hours worked':'ساعات العمل', 'came in':'دخل', 'went out':'خرج', 'lessons finished':'دروس منتهية', 'lesson finished':'درس منتهٍ',
      'Acquisitions lessons':'دروس الاستحواذ', 'Team, not you':'الفريق، بدونك', 'Your shifts':'وردياتك', 'In pounds':'بالجنيه', 'Unlock the Deal CRM once to see deals.':'افتح نظام الصفقات مرة لترى الصفقات.',
      'Your learning':'تعلّمك', 'Your courses':'كورساتك', 'Open the course':'افتح الكورس', 'Daily review':'المراجعة اليومية', 'Questions you missed come back here.':'الأسئلة التي أخطأت فيها تعود هنا.',
      'Lesson questions':'أسئلة الدروس', 'Ask Amr about any lesson; answers stay for everyone.':'اسأل عمرو عن أي درس، وتبقى الإجابات للجميع.', 'Practice calls':'مكالمات تدريبية',
      'Send a practice call and get it scored.':'أرسل مكالمة تدريبية واحصل على تقييمها.', 'Learning Hub':'مركز التعلّم', 'All your courses and progress.':'كل كورساتك وتقدّمك.',
      'Pick up where you left off.':'تابع من حيث توقفت.', 'Not open for you yet':'غير متاح لك بعد', 'Ask for access':'اطلب الصلاحية', 'Sent to Amr':'أُرسل إلى عمرو', 'Already asked today':'طلبت اليوم بالفعل',
      'Couldn’t send. Try again':'تعذّر الإرسال. حاول مرة أخرى', 'Sending…':'جارٍ الإرسال…', 'Next lesson':'الدرس التالي', 'Continue':'تابع', 'Help center':'مركز المساعدة', 'How each page works.':'كيف تعمل كل صفحة.'
    });
    Object.assign(L.TPL || {}, {
      '{} Cairo · {} New York':'{} القاهرة · {} نيويورك', '{} days late':'متأخر {} أيام', '{} is on shift':'{} في الوردية', 'Shift: {}':'وردية: {}',
      'Hi, {}':'مرحبًا، {}', '{} of {} today':'{} من {} اليوم'
    });
  }

  // ---------- days and times ----------
  const dayIn = (tz, d) => (d || new Date()).toLocaleDateString('en-CA', { timeZone:tz });   // YYYY-MM-DD in that zone
  const timeIn = (tz, d) => d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true, timeZone:tz });
  const both = d => timeIn(CAIRO, d) + ' Cairo · ' + timeIn(NY, d) + ' New York';
  // A Cairo wall-clock time (study blocks are saved as a time on a Cairo day) as a real moment
  function fromCairo(day, hhmm){
    const [y, m, dd] = day.split('-').map(Number), [h, mi] = String(hhmm || '00:00').split(':').map(Number);
    let t = Date.UTC(y, m - 1, dd, h, mi);
    for (let i = 0; i < 2; i++) {   // two passes settle the zone offset, clock changes included
      const p = new Intl.DateTimeFormat('en-US', { timeZone:CAIRO, hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).formatToParts(new Date(t));
      const g = k => +p.find(x => x.type === k).value, seen = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
      t += Date.UTC(y, m - 1, dd, h, mi) - seen;
    }
    return new Date(t);
  }
  // Monday of this week, Cairo day
  function mondayCairo(){
    const t = dayIn(CAIRO), d = new Date(t + 'T12:00:00Z'), dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10);
  }
  // Start of a Cairo day as a moment (for timestamp filters)
  const cairoStart = day => fromCairo(day, '00:00').toISOString();
  const nextDay = day => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  const daysLate = (due, today) => Math.round((new Date(today + 'T12:00:00Z') - new Date(due + 'T12:00:00Z')) / 864e5);
  const where = d => [d.county, d.state].filter(Boolean).join(', ') || (d.kind === 'land' ? 'Land deal' : d.kind === 'house' ? 'House deal' : 'Deal');

  // ---------- H2: Today timeline ----------
  async function timeline(db, o){
    const today = dayIn(CAIRO), start = cairoStart(today), end = cairoStart(nextDay(today)), uid = o.uid, owner = !!o.owner;
    const q = [];
    q.push(safe(owner ? db.from('schedule_shifts').select('user_id,starts_at,ends_at,note').gte('starts_at', start).lt('starts_at', end).order('starts_at')
      : db.from('schedule_shifts').select('user_id,starts_at,ends_at,note').eq('user_id', uid).gte('starts_at', start).lt('starts_at', end).order('starts_at')));
    q.push(safe(db.from('portal_tasks').select('id,title,due_on,link').eq('assigned_to', uid).is('done_at', null).lte('due_on', today).order('due_on')));
    q.push(safe(db.from('callbacks').select('id,label,state,tz,due_at,note').eq('user_id', uid).is('done_at', null).lt('due_at', end).order('due_at')));
    q.push(o.deals || owner ? safe((owner ? db.from('deals').select('id,owner,kind,county,state,stage,follow_up,inspection_ends,closing_on')
      : db.from('deals').select('id,owner,kind,county,state,stage,follow_up,inspection_ends,closing_on').eq('owner', uid)).not('stage', 'in', '(closed,passed)')) : Promise.resolve({ data:[] }));
    q.push(owner ? safe(db.from('me_study_blocks').select('id,subject,starts,minutes,topic,done').eq('day', today).order('starts')) : Promise.resolve({ data:[] }));
    q.push(owner ? safe(db.from('client_touches').select('lead_id,company_id,follow_up_on,at,note').order('at', { ascending:false }).limit(400)) : Promise.resolve({ data:[] }));
    q.push(owner ? safe(db.from('members').select('user_id,name')) : Promise.resolve({ data:[] }));
    q.push(owner ? safe(db.from('client_leads').select('id,name')) : Promise.resolve({ data:[] }));
    q.push(owner ? safe(db.from('companies').select('id,name')) : Promise.resolve({ data:[] }));
    const [sh, tk, cb, dl, st, tc, mem, leads, cos] = await Promise.all(q);
    if (sh.error && tk.error) return null;
    const names = {}; (mem.data || []).forEach(m => names[m.user_id] = m.name);
    const items = [];   // { at: Date|null, kind, text, href, late }
    (sh.data || []).forEach(s => {
      const st0 = new Date(s.starts_at), en = s.ends_at ? new Date(s.ends_at) : null, who = owner ? (s.user_id === uid ? 'You' : (names[s.user_id] || 'Someone')) : 'You';
      items.push({ at:st0, kind:'Shift', text:(owner ? who + ' · ' : '') + timeIn(CAIRO, st0) + (en ? ' to ' + timeIn(CAIRO, en) : '') + ' Cairo' + (s.note ? ' · ' + s.note : ''), href:owner ? '#schedule' : '#schedule' });
    });
    (tk.data || []).forEach(t => items.push({ at:null, kind:'Task', text:t.title, href:'#tasks', late:t.due_on && t.due_on < today ? daysLate(t.due_on, today) : 0 }));
    (cb.data || []).forEach(c => { const at = new Date(c.due_at), late = dayIn(CAIRO, at) < today;
      items.push({ at:late ? null : at, kind:'Callback', text:(c.label || 'Callback') + (c.state ? ' · ' + c.state : ''), href:'#callbacks', late:late ? daysLate(dayIn(CAIRO, at), today) : 0 }); });
    (dl.data || []).forEach(d => {
      if (d.closing_on === today) items.push({ at:null, kind:'Closing', text:where(d), href:'/app/deals/' });
      if (d.inspection_ends === today) items.push({ at:null, kind:'Inspection ends', text:where(d), href:'/app/deals/' });
      if ((d.owner === uid) && d.follow_up && d.follow_up <= today) items.push({ at:null, kind:'Follow-up', text:where(d), href:'/app/deals/', late:d.follow_up < today ? daysLate(d.follow_up, today) : 0 });
    });
    (st.data || []).filter(b => !b.done).forEach(b => items.push({ at:b.starts ? fromCairo(today, b.starts) : null, kind:'Study', text:(b.subject || 'Study') + (b.topic ? ': ' + b.topic : '') + (b.minutes ? ' · ' + b.minutes + ' min' : ''), href:'#study' }));
    // Client follow-ups: the latest touch per lead or client, when its next date is today or earlier
    const seen = new Set(), leadName = {}, coName = {};
    (leads.data || []).forEach(x => leadName[x.id] = x.name); (cos.data || []).forEach(x => coName[x.id] = x.name);
    (tc.data || []).forEach(t => { const k = t.lead_id ? 'l' + t.lead_id : t.company_id ? 'c' + t.company_id : null; if (!k || seen.has(k)) return; seen.add(k);
      if (t.follow_up_on && t.follow_up_on <= today) items.push({ at:null, kind:'Client follow-up', text:(t.lead_id ? leadName[t.lead_id] : coName[t.company_id]) || 'Client', href:'#outreach', late:t.follow_up_on < today ? daysLate(t.follow_up_on, today) : 0 }); });
    // Timed first (by time), then the rest: late ones first
    const timed = items.filter(x => x.at).sort((a, b) => a.at - b.at), rest = items.filter(x => !x.at).sort((a, b) => (b.late || 0) - (a.late || 0));
    const li = x => '<li class="r39-tl-i' + (x.late ? ' is-late' : '') + '"><span class="r39-tl-when">' + (x.at ? esc(both(x.at)) : x.late ? '<span class="p-pill is-no">' + esc(x.late === 1 ? '1 day late' : x.late + ' days late') + '</span>' : esc('Any time today')) + '</span>' +
      '<a class="r39-tl-what" href="' + esc(x.href) + '"><span class="p-pill is-plain">' + esc(x.kind) + '</span> <span>' + esc(x.text) + '</span></a></li>';
    const body = timed.length || rest.length
      ? '<ol class="r39-tl">' + timed.map(li).join('') + (rest.length ? '<li class="r39-tl-sep" aria-hidden="true"></li>' + rest.map(li).join('') : '') + '</ol>'
      : '<p class="p-empty">Nothing on today. Shifts, tasks, callbacks, follow-ups, closings and study blocks show here.</p>';
    return '<section class="p-card r39-today" aria-labelledby="r39TlH"><div class="p-card-head"><h2 id="r39TlH">Today timeline</h2><span>' +
      esc(new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric', timeZone:CAIRO })) + ' · ' + esc(plural(items.length, 'item')) + '</span></div>' + body + '</section>';
  }

  // ---------- H8: This week ----------
  const AUTO_TEAM_FROM = '2026-11-17';   // same date as cash.js and portal-home.js: team profit from hours counts from here on
  async function snapshot(db, o){
    const mon = mondayCairo(), today = dayIn(CAIRO), from = cairoStart(mon), uid = o.uid, owner = !!o.owner;
    const q = [
      o.deals || owner ? safe(owner ? db.from('deal_events').select('id', { count:'exact', head:true }).eq('kind', 'stage').gte('at', from)
        : db.from('deal_events').select('id', { count:'exact', head:true }).eq('kind', 'stage').eq('owner', uid).gte('at', from)) : Promise.resolve({ skip:true }),
      owner ? safe(db.from('shifts').select('work_seconds,owner,bill_rate,pay_rate,client_fx,shift_date,pay_type').gte('shift_date', mon).lte('shift_date', today)) : safe(db.rpc('my_shifts')),
      owner ? safe(db.from('cash_entries').select('kind,category,amount,currency,fx_rate').gte('entry_date', mon).lte('entry_date', today)) : Promise.resolve({ skip:true }),
      owner ? safe(db.from('fx_rates').select('rate').order('from_date', { ascending:false }).limit(1)) : Promise.resolve({ data:[] }),
      safe(owner ? db.from('course_item_done').select('item_id').gte('done_at', from) : db.from('course_item_done').select('item_id').eq('user_id', uid).gte('done_at', from))
    ];
    const [dm, sh, ce, fx, ld] = await Promise.all(q);
    const tile = (v, label, href, sub) => '<a class="p-tile" href="' + esc(href) + '"><b>' + esc(v) + '</b><span>' + esc(label) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</a>';
    const hm = s => Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0');
    const tiles = [];
    if (!dm.skip) tiles.push(tile(dm.error ? '–' : dm.count || 0, (dm.count || 0) === 1 ? 'deal moved' : 'deals moved', '/app/deals/'));
    const shifts = (sh.data || []).filter(s => s.shift_date >= mon && s.shift_date <= today);
    const secs = shifts.filter(s => !owner || !s.owner).reduce((a, s) => a + (Number(s.work_seconds) || 0), 0);
    tiles.push(tile(sh.error ? '–' : hm(secs), 'hours worked', owner ? '#team' : '#track', owner ? 'Team, not you' : 'Your shifts'));
    if (owner) {
      const rate = fx.data && fx.data[0] ? Number(fx.data[0].rate) : 0, egp = e => e.currency === 'EGP' ? Number(e.amount) : Number(e.amount) * (Number(e.fx_rate) || rate);
      let came = 0, out = 0;
      (ce.data || []).forEach(e => { if (e.kind === 'income') came += egp(e); else if (String(e.category || '').trim().toLowerCase() !== 'savings') out += egp(e); });
      shifts.forEach(s => {   // the same hours money the command center counts: your own billed hours, and the team's margin from Nov 17
        if (s.bill_rate == null) return; const h = s.work_seconds / 3600, f = Number(s.client_fx) || rate;
        if (s.owner) { came += h * Number(s.bill_rate) * f; return; }
        if (s.pay_type === 'commission' || s.shift_date < AUTO_TEAM_FROM) return;
        came += h * (Number(s.bill_rate) - Number(s.pay_rate || 0)) * f;
      });
      const egpT = n => 'EGP ' + Math.round(n).toLocaleString('en-US');
      tiles.push(tile(ce.error ? '–' : egpT(came), 'came in', '#overview', 'In pounds'), tile(ce.error ? '–' : egpT(out), 'went out', '#expense', 'In pounds'));
    }
    const lessons = (ld.data || []).filter(x => /^\d+\.\d+$/.test(String(x.item_id || ''))).length;   // whole lessons, not the small steps inside them
    tiles.push(tile(ld.error ? '–' : lessons, lessons === 1 ? 'lesson finished' : 'lessons finished', owner ? '#progress' : '/course/', 'Acquisitions lessons'));
    return '<section class="r39-week" aria-labelledby="r39WkH"><h2 class="p-h2" id="r39WkH">This week <small>Monday to today, Cairo time</small></h2><div class="p-today r39-week-tiles">' + tiles.join('') + '</div></section>';
  }

  // ---------- H10: who gets the learning home ----------
  const WORK = ['deals', 'live', 'requests', 'team', 'money', 'people'];
  function isStudent(T){
    if (!T || T.role !== 'member') return false;
    const me = T.me || {}, keys = me.keys || T.access || [];
    if (me.role === 'manager') return false;
    if ((T.profile || {}).company_id) return false;   // works for a client: keeps the team home with the clock
    return !keys.some(k => WORK.includes(k));
  }

  window.R39Home = { timeline, snapshot, isStudent, both, dayIn };
})();
