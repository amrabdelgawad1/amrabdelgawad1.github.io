// Round 20 (Nov 18 2026), part B: tools for reps.
//   Callbacks     a bell (and phone alert) 10 minutes before each callback, once (cron talents-callback-reminders, every
//                 5 minutes). #mylists: a "Call back" button on every row saves a callback in the seller's time, checked
//                 against the same calling hours (federal + state rules) as the list.
//   #earnings     reps: pay this month (hourly shifts only; commission-based shifts show "Commission"), paid and still
//                 owed, the next pay day, commissions, bonuses and referral bonuses, progress to each bonus, and a printable
//                 statement for the month. Amr: pick anyone to see theirs, set the pay days, set bonus rules, mark bonuses paid.
//   Bonus rules   Amr sets "5 appointments in a week = $20" (dials, conversations, offers, appointments or hours; per day,
//                 week or month; everyone or picked reps). Each night finished periods are checked against saved shifts and
//                 the bonus is added with a bell (cron talents-bonus-awards, 00:20 Cairo).
//   #templates    everyone: SMS and email templates with the blanks filled in ({first_name}, {property}...). Opt-out
//                 wording is added to every text and email and can't be removed. Amr's shared templates plus your own.
//   Home          people with phone alerts off on this device see a card with the steps for their phone (iPhone needs the
//                 Home Screen app). "Not now" hides it for 14 days.
// Database: callbacks.reminded_at/lead_record_id, private.callback_reminders(), bonus_rules, bonus_awards,
// private.bonus_award_tick(), portal_earnings(), bonus_awards_all(), bonus_award_set(), outreach_templates, template_used().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, fmtDay, fmtTime, usd, num, plural, card, empty, failed, pill, f, opt, table, tr, say, errText, STATE_TZ, ZONES, zonedToUtc, isoDay } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const day = d => fmtDay(d, { month:'short', day:'numeric', year:'numeric' });
  const METRIC = { dials:'dials', conversations:'conversations', offers:'offers', appointments:'appointments', hours:'hours worked' };
  const PERIOD = { day:'a day', week:'a week', month:'a month' };
  const PERIOD_NOW = { day:'today', week:'this week', month:'this month' };

  // ======================================================================
  // Next pay day from the "pay_days" setting: "1,16" (days of the month) or "fri" (every week) or "fri/2026-11-21" (every 2 weeks)
  // ======================================================================
  const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  function nextPay(s, from){
    s = String(s || '').trim().toLowerCase(); if (!s) return null;
    const t = new Date(from || Date.now()); t.setHours(12, 0, 0, 0);
    const m2 = s.match(/^([a-z]{3})\/(\d{4}-\d{2}-\d{2})$/);
    if (m2 && WD.includes(m2[1])) { const a = new Date(m2[2] + 'T12:00'); while (a < t) a.setDate(a.getDate() + 14); return a; }
    if (WD.includes(s)) { const a = new Date(t); while (a.getDay() !== WD.indexOf(s)) a.setDate(a.getDate() + 1); return a; }
    const days = s.split(/[,\s]+/).map(Number).filter(n => n >= 1 && n <= 31).sort((a, b) => a - b); if (!days.length) return null;
    for (let k = 0; k < 3; k++) {
      const y = t.getFullYear(), mo = t.getMonth() + k;
      for (const dd of days) { const last = new Date(y, mo + 1, 0).getDate(); const a = new Date(y, mo, Math.min(dd, last), 12); if (a >= t) return a; }
    }
    return null;
  }
  const payText = s => { s = String(s || '').trim().toLowerCase(); const m2 = s.match(/^([a-z]{3})\//); if (m2) return 'Every other ' + m2[1].toUpperCase().slice(0, 1) + m2[1].slice(1); if (WD.includes(s)) return 'Every ' + s.slice(0, 1).toUpperCase() + s.slice(1); return s ? 'On day ' + s.split(/[,\s]+/).filter(Boolean).join(' and ') + ' of each month' : ''; };

  // ======================================================================
  // #earnings
  // ======================================================================
  V.earnings = { title:'Earnings', sec:'everyone', async open(el, ok){
    const owner = isOwner();
    const body = PX.page(el, 'You', 'Earnings', owner ? 'What each person earned: pay, commissions and bonuses. Set pay days and bonus rules here.' : 'Your pay, commissions and bonuses, what is paid and what is still coming.');
    const S = { month:isoDay(new Date()).slice(0, 7) + '-01', who:null, people:[] };
    if (owner) {
      const p = await safe(db().from('members').select('user_id,name,role,active').eq('active', true).neq('role', 'owner').order('name'));
      S.people = p.data || []; S.who = S.people.length ? S.people[0].user_id : null;
    }
    async function load(){
      body.innerHTML = PX.loading;
      const calls = [safe(db().rpc('portal_earnings', { p_month:S.month, p_user:owner ? S.who : null }))];
      if (owner) calls.push(safe(db().from('bonus_rules').select('*').order('created_at', { ascending:false })), safe(db().rpc('bonus_awards_all')));
      else calls.push(safe(db().rpc('my_pay_adjustments')));
      const [e, rules, awards] = await Promise.all(calls);
      if (!ok()) return;
      if (e.error) { body.innerHTML = failed(e.error); return; }
      S.adj = owner ? [] : ((rules && rules.data) || []);   // round 19: the rep's own bonuses and deductions from Payroll
      draw(e.data || {}, owner && rules && rules.data, owner && awards && awards.data);
    }
    function draw(d, rules, awards){
      const comm = d.commissions || [], bon = d.bonuses || [], refs = d.referrals || [], prog = d.progress || [];
      const mStart = d.month, mEnd = new Date(new Date(mStart + 'T12:00').getFullYear(), new Date(mStart + 'T12:00').getMonth() + 1, 0);
      const inMonth = x => x && x >= mStart && x <= isoDay(mEnd);
      const commM = comm.filter(c => inMonth(c.closed_on)), bonM = bon.filter(b => inMonth(b.period_start));
      const extraM = commM.reduce((a, c) => a + +c.amount, 0) + bonM.reduce((a, b) => a + +b.amount, 0);
      const owedExtra = comm.filter(c => c.status !== 'paid').reduce((a, c) => a + +c.amount, 0) + bon.filter(b => b.status === 'earned').reduce((a, b) => a + +b.amount, 0);
      const np = nextPay(d.pay_days);
      const months = []; for (let i = 0; i < 12; i++) { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - i); months.push(isoDay(x).slice(0, 7) + '-01'); }
      body.innerHTML =
        '<div class="px-form r20-row r20-noprint">' + (owner ? f('Person', '<select id="r20eWho">' + (S.people.length ? S.people.map(p => opt(p.user_id, p.name, p.user_id === S.who)).join('') : opt('', 'No team members yet')) + '</select>') : '') +
          f('Month', '<select id="r20eMon">' + months.map(m => opt(m, fmtDay(m, { month:'long', year:'numeric' }), m === S.month)).join('') + '</select>') +
          '<div class="px-tools"><button type="button" class="p-btn is-ghost" id="r20ePrint">Print statement</button></div></div>' +
        '<section class="r20-stmt"><h2 class="r20-only-print">Statement · ' + esc(d.name || '') + ' · ' + esc(fmtDay(mStart, { month:'long', year:'numeric' })) + '</h2>' +
        '<div class="p-tiles r20-tiles">' +
          tile(usd(d.pay), 'pay from hours', plural(+d.hourly_hours || 0, 'hour') + (+d.commission_hours ? ' · ' + (+d.commission_hours) + ' h commission based' : '')) +
          tile(usd(d.pay_paid), 'paid so far', d.last_paid ? 'last paid ' + day(d.last_paid) : '') +
          tile(usd(extraM), 'commissions and bonuses', plural(commM.length, 'commission') + ' · ' + plural(bonM.length, 'bonus', 'bonuses')) +
          tile(usd(+d.owed_all + owedExtra), 'still coming (all time)', np ? 'next pay day ' + fmtDay(np, { weekday:'short', month:'short', day:'numeric' }) : 'pay day not set yet') +
        '</div>' +
        (prog.length ? card('Bonuses you can earn', '', prog.map(p => { const pc = Math.min(100, Math.round(+p.value / +p.target * 100)); return '<div class="r20-prog"><div><b>' + esc(p.rule) + '</b> · ' + usd(p.amount) + '<br><small>' + num(Math.round(+p.value * 10) / 10) + ' of ' + num(+p.target) + ' ' + esc(METRIC[p.metric]) + ' ' + esc(PERIOD_NOW[p.period]) + (pc >= 100 ? ' · earned, added tonight' : '') + '</small></div>' + PX.bar(Math.min(+p.value, +p.target), +p.target) + '</div>'; }).join('')) : '') +
        card('Commissions', plural(comm.length, 'deal'), comm.length ? table(['Deal', 'Closed', 'Profit', 'Your share', 'Status'], comm.map(c => tr([esc(c.deal || '–'), esc(c.closed_on ? day(c.closed_on) : '–'), c.profit != null ? usd(c.profit) : '–', '<b>' + usd(c.amount) + '</b>' + (c.percent ? ' <small>(' + (+c.percent) + '%)</small>' : ''), c.status === 'paid' ? pill('Paid ' + (c.paid_on ? day(c.paid_on) : ''), 'ok') : pill('Owed', '')]))) : empty('No commissions yet. When a deal you worked closes, Amr adds your share here.')) +
        card('Bonuses', plural(bon.length, 'bonus', 'bonuses'), bon.length ? table(['Bonus', 'For', 'Result', 'Amount', 'Status'].concat(owner ? [''] : []), bon.map(b => tr([esc(b.rule), esc((b.period === 'day' ? '' : b.period === 'week' ? 'Week of ' : '') + (b.period === 'month' ? fmtDay(b.period_start, { month:'long', year:'numeric' }) : day(b.period_start))), num(Math.round(+b.value * 10) / 10) + ' ' + esc(METRIC[b.metric]), '<b>' + usd(b.amount) + '</b>', b.status === 'paid' ? pill('Paid ' + (b.paid_on ? day(b.paid_on) : ''), 'ok') : pill('Earned', '')].concat(owner ? [b.status === 'paid' ? '' : '<button type="button" class="p-btn is-ghost" data-r20paid="' + b.id + '">Mark paid</button>'] : [])))) : empty(prog.length ? 'No bonuses yet. Hit a target above and it shows up here the next morning.' : 'No bonuses yet.')) +
        ((S.adj || []).length ? card('Bonuses and deductions', plural(S.adj.length, 'line'), table(['Type', 'Reason', 'Pay cycle', 'Amount', 'Status'], S.adj.map(a => tr([a.kind === 'bonus' ? pill('Bonus', 'ok') : pill('Deduction', ''), esc(a.reason), esc(day(a.cycle_from)), (a.kind === 'deduction' ? '−' : '+') + usd(a.amount), a.status === 'paid' ? pill('Paid ' + (a.paid_on ? day(a.paid_on) : ''), 'ok') : pill('Next pay day', 'plain')])))) : '') +
        (refs.length ? card('Referral bonuses', '', table(['Who', 'Hired', 'Bonus', 'Status'], refs.map(x => tr([esc(x.name), esc(x.hired_on ? day(x.hired_on) : '–'), usd(x.bonus), x.status === 'paid' ? pill('Paid', 'ok') : pill('Owed', '')])))) : '') +
        '</section>' +
        '<p class="p-hint r20-noprint">' + (d.pay_days ? 'Pay day: ' + esc(payText(d.pay_days)) + '. ' : '') + (+d.payslips ? 'Signed payslips are in your account menu › Payslips.' : '') + ' Pay counts hours from saved shifts at your rate (' + usd(d.rate) + ' an hour). Commission-based shifts aren’t paid by the hour.</p>' +
        (owner ? ownerPart(d, rules || [], awards || []) : '');
      PX.widths(body);
    }
    const tile = (v, k, s) => '<div class="p-tile"><b>' + esc(v) + '</b><span>' + esc(k) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div>';
    function ownerPart(d, rules, awards){
      const waiting = awards.filter(a => a.status === 'earned');
      return '<div class="r20-noprint">' +
        card('Pay days', d.pay_days ? esc(payText(d.pay_days)) : 'not set',
          '<form class="px-form r20-row" id="r20pdForm" novalidate>' + f('When you pay the team', '<input type="text" id="r20pd" maxlength="40" value="' + esc(d.pay_days || '') + '" placeholder="1,16  or  fri  or  fri/2026-11-21">') +
          '<div class="px-tools"><button type="submit" class="p-btn">Save</button></div></form><p class="p-hint">Days of the month (1,16), a weekday for every week (fri), or a weekday and one pay date for every two weeks (fri/2026-11-21). Reps see the next pay day.</p><p class="p-hint" id="r20pdMsg" role="status"></p>') +
        card('Bonus rules', plural(rules.filter(r => r.active).length, 'active rule'),
          (rules.length ? rules.map(r => '<div class="p-row"><span><b>' + esc(r.name) + '</b> ' + (r.active ? pill('On', 'ok') : pill('Off', 'plain')) + '<br><small>' + num(+r.target) + ' ' + esc(METRIC[r.metric]) + ' in ' + esc(PERIOD[r.period]) + ' = ' + usd(r.amount) + ' · ' + (r.who && r.who.length ? esc(r.who.map(u => (S.people.find(p => p.user_id === u) || {}).name || 'someone').join(', ')) : 'every rep') + ' · from ' + esc(day(r.starts_on)) + '</small></span>' +
            '<span class="r17-acts"><button type="button" class="p-btn is-ghost" data-r20rtog="' + r.id + '">' + (r.active ? 'Turn off' : 'Turn on') + '</button><button type="button" class="p-btn is-ghost" data-r20rdel="' + r.id + '">Delete</button></span></div>').join('') : empty('No rules yet. Add one below.')) +
          '<form class="px-form r20-row" id="r20brForm" novalidate>' +
            f('Name', '<input type="text" id="r20brN" maxlength="80" placeholder="e.g. 5 appointments a week">', 'px-wide') +
            f('Count', '<select id="r20brM">' + Object.keys(METRIC).map(k => opt(k, METRIC[k][0].toUpperCase() + METRIC[k].slice(1), k === 'appointments')).join('') + '</select>') +
            f('Target', '<input type="number" id="r20brT" min="1" step="1" value="5">') +
            f('In', '<select id="r20brP">' + Object.keys(PERIOD).map(k => opt(k, PERIOD[k][0].toUpperCase() + PERIOD[k].slice(1), k === 'week')).join('') + '</select>') +
            f('Bonus (USD)', '<input type="number" id="r20brA" min="1" step="0.5" value="20">') +
            f('For', '<select id="r20brW" multiple size="3">' + S.people.map(p => opt(p.user_id, p.name)).join('') + '</select>', 'px-wide') +
            '<p class="p-hint px-wide">Pick nobody for every rep. Counts come from saved shifts (what reps type when they clock out). Checked each night for finished days, weeks and months.</p>' +
            '<div class="px-tools px-wide"><button type="submit" class="p-btn">Add rule</button><span class="p-hint" id="r20brMsg" role="status"></span></div></form>') +
        card('Bonuses to pay', waiting.length + ' waiting', awards.length ? table(['Who', 'Bonus', 'For', 'Amount', ''], awards.slice(0, 60).map(a => tr([esc(a.name || '–'), esc(a.rule), esc(day(a.period_start)), usd(a.amount), a.status === 'earned' ? '<button type="button" class="p-btn is-ghost" data-r20paid="' + a.id + '">Mark paid</button> <button type="button" class="p-btn is-ghost" data-r20cancel="' + a.id + '">Cancel</button>' : pill(a.status === 'paid' ? 'Paid' : 'Cancelled', a.status === 'paid' ? 'ok' : 'plain')]))) + '<p class="p-hint">Add paid bonuses to the person’s payslip. Marking paid sends them a bell.</p>' : empty('Nothing earned yet.')) +
        '</div>';
    }
    await load();
    body.addEventListener('change', e => {
      if (e.target.id === 'r20eWho') { S.who = e.target.value; load(); }
      if (e.target.id === 'r20eMon') { S.month = e.target.value; load(); }
    });
    body.addEventListener('submit', async e => {
      e.preventDefault();
      if (e.target.id === 'r20pdForm') {
        const v = $('r20pd').value.trim().toLowerCase();
        if (v && !nextPay(v)) return say('r20pdMsg', 'That doesn’t look right. Try 1,16 or fri.');
        const x = await safe(db().from('tracker_settings').upsert({ key:'pay_days', value:v }, { onConflict:'key' }));
        if (x.error) return say('r20pdMsg', errText(x, 'Couldn’t save. Try again.'));
        load(); return;
      }
      if (e.target.id === 'r20brForm') {
        const who = [...$('r20brW').selectedOptions].map(o => o.value);
        const row = { name:$('r20brN').value.trim(), metric:$('r20brM').value, target:+$('r20brT').value, period:$('r20brP').value, amount:+$('r20brA').value, who:who.length ? who : null };
        if (row.name.length < 2) row.name = num(row.target) + ' ' + METRIC[row.metric] + ' in ' + PERIOD[row.period];
        if (!(row.target > 0) || !(row.amount > 0)) return say('r20brMsg', 'Add a target and an amount.');
        const x = await safe(db().from('bonus_rules').insert(row));
        if (x.error) return say('r20brMsg', errText(x, 'Couldn’t add it. Try again.'));
        load();
      }
    });
    body.addEventListener('click', async e => {
      if (e.target.id === 'r20ePrint') { document.body.classList.add('r20-printing'); setTimeout(() => { window.print(); document.body.classList.remove('r20-printing'); }, 50); return; }
      const pd = e.target.closest('[data-r20paid]'), cn = e.target.closest('[data-r20cancel]');
      if (pd || cn) { const b = pd || cn; b.disabled = true; const x = await safe(db().rpc('bonus_award_set', { p_id:+(b.dataset.r20paid || b.dataset.r20cancel), p_status:pd ? 'paid' : 'cancelled' })); if (x.error) { b.disabled = false; return; } load(); return; }
      const tg = e.target.closest('[data-r20rtog]');
      if (tg) { tg.disabled = true; const on = tg.textContent === 'Turn on'; const x = await safe(db().from('bonus_rules').update({ active:on }).eq('id', +tg.dataset.r20rtog)); if (x.error) { tg.disabled = false; return; } load(); return; }
      const dl = e.target.closest('[data-r20rdel]');
      if (dl) {
        if (dl.dataset.sure !== '1') { dl.dataset.sure = '1'; dl.textContent = 'Sure? Earned bonuses go too'; setTimeout(() => { if (dl.isConnected) { dl.dataset.sure = ''; dl.textContent = 'Delete'; } }, 4000); return; }
        if (window.PortalUI && PortalUI.del) { PortalUI.del(dl, { text:'Bonus rule deleted, with its earned bonuses.', label:'Delete', sel:'.p-row', run:() => safe(db().from('bonus_rules').delete().eq('id', +dl.dataset.r20rdel)), after:() => load() }); return; }
        dl.disabled = true; const x = await safe(db().from('bonus_rules').delete().eq('id', +dl.dataset.r20rdel)); if (x.error) { dl.disabled = false; return; } load();
      }
    });
  } };

  // ======================================================================
  // #templates: SMS and email templates
  // ======================================================================
  const STOP_SMS = 'Reply STOP to opt out';
  const AUD = { seller:'Sellers', buyer:'Buyers', agent:'Agents', other:'Other' };
  // plan Round 20: client outreach templates (Amr only; the database keeps his own templates private)
  const audFor = () => isOwner() ? Object.assign({}, AUD, { client:'Clients' }) : AUD;
  const blanks = s => [...new Set((String(s || '').match(/\{([a-z_]+)\}/g) || []).map(x => x.slice(1, -1)))];
  const LABEL = { first_name:'Their first name', property:'Property (address or parcel)', my_name:'Your name', my_phone:'Your phone', offer:'Price or offer', day:'Day', company:'Company' };
  function finalText(t, vals){
    let b = t.body.replace(/\{([a-z_]+)\}/g, (m, k) => vals[k] ? vals[k] : m), s = (t.subject || '').replace(/\{([a-z_]+)\}/g, (m, k) => vals[k] ? vals[k] : m);
    if (t.channel === 'sms') { if (!/reply stop/i.test(b)) b = b.replace(/\s+$/, '') + ' ' + STOP_SMS; }
    else if (!/reply stop|unsubscribe/i.test(b)) b = b.replace(/\s+$/, '') + '\n\n--\nIf you’d rather not get these emails, reply STOP and I won’t email you again.';
    return { body:b, subject:s };
  }
  V.templates = { title:'Templates', sec:'everyone', async open(el, ok){
    const owner = isOwner(), me = (T().user || {}).id;
    const body = PX.page(el, 'Calls', 'Templates', 'Texts and emails for sellers, buyers and agents. Fill in the blanks, copy, send. Opt-out wording is added for you.');
    const S = { ch:'', aud:'', q:'', open:null, vals:{}, edit:null };
    try { const p = T().profile || {}; S.vals.my_name = (p.display_name || (T().me || {}).name || '').split(' ')[0]; S.vals.my_phone = p.phone || ''; } catch (e) {}
    let list = [];
    async function load(){
      const r = await safe(db().from('outreach_templates').select('*').order('shared', { ascending:false }).order('uses', { ascending:false }).order('title'));
      if (!ok()) return;
      if (r.error) { body.innerHTML = failed(r.error); return; }
      list = r.data || []; draw();
    }
    function draw(){
      const rows = list.filter(t => (!S.ch || t.channel === S.ch) && (!S.aud || t.audience === S.aud) && (!S.q || (t.title + ' ' + t.body).toLowerCase().includes(S.q)));
      const t = list.find(x => x.id === S.open);
      body.innerHTML = '<div class="px-form r20-row">' + f('Type', '<select id="r20tCh">' + opt('', 'Texts and emails') + opt('sms', 'Texts', S.ch === 'sms') + opt('email', 'Emails', S.ch === 'email') + '</select>') +
          f('For', '<select id="r20tAud">' + opt('', 'Everyone') + Object.keys(audFor()).map(k => opt(k, audFor()[k], S.aud === k)).join('') + '</select>') +
          f('Search', '<input type="search" id="r20tQ" value="' + esc(S.q) + '" placeholder="Search templates">') +
          '<div class="px-tools"><button type="button" class="p-btn is-ghost" id="r20tNew">New template</button></div></div>' +
        (S.edit ? editor(S.edit) : '') +
        '<div class="r20-tgrid"><div>' + card('Templates', plural(rows.length, 'template'), rows.length ? rows.map(x => '<button type="button" class="r20-titem' + (x.id === S.open ? ' on' : '') + '" data-r20t="' + x.id + '"><b>' + esc(x.title) + '</b><small>' + (x.channel === 'sms' ? 'Text' : 'Email') + ' · ' + esc(audFor()[x.audience] || '') + (x.shared ? ' · Team' : ' · Mine') + (x.uses ? ' · used ' + x.uses + '×' : '') + '</small></button>').join('') : empty('No templates match.')) + '</div>' +
        '<div>' + (t ? filler(t) : card('Pick a template', '', empty('Pick one on the left to fill it in.'))) + '</div></div>';
    }
    function filler(t){
      const keys = blanks(t.subject + ' ' + t.body), out = finalText(t, S.vals), len = out.body.length, segs = Math.ceil(len / 153);
      const can = t.owner === me;
      return card(t.title, (t.channel === 'sms' ? 'Text' : 'Email') + ' · ' + esc(audFor()[t.audience] || ''),
        (keys.length ? '<div class="px-form r20-row">' + keys.map(k => f(LABEL[k] || k.replace(/_/g, ' '), '<input type="text" data-r20v="' + esc(k) + '" value="' + esc(S.vals[k] || '') + '" maxlength="120">')).join('') + '</div>' : '') +
        (t.channel === 'email' ? '<p class="r20-subj"><b>Subject:</b> <span id="r20tSubj">' + esc(out.subject) + '</span></p>' : '') +
        '<pre class="r20-pre" id="r20tOut">' + esc(out.body) + '</pre>' +
        '<p class="p-hint">' + (t.channel === 'sms' ? len + ' characters' + (segs > 1 ? ' · sends as ' + segs + ' texts' : '') + '. “' + STOP_SMS + '” is always added.' : 'A line telling them how to stop emails is always added.') + (/\{[a-z_]+\}/.test(out.body + out.subject) ? ' <b>Fill in every blank before sending.</b>' : '') + '</p>' +
        '<div class="acts"><button type="button" class="p-btn" id="r20tCopy">Copy</button>' +
          (t.channel === 'sms' ? '<a class="p-btn is-ghost" id="r20tSms" href="sms:?&body=' + encodeURIComponent(out.body) + '">Open in Messages</a>' : '<a class="p-btn is-ghost" id="r20tMail" href="mailto:?subject=' + encodeURIComponent(out.subject) + '&body=' + encodeURIComponent(out.body) + '">Open in email</a>') +
          (can ? '<button type="button" class="p-btn is-ghost" data-r20tedit="' + t.id + '">Edit</button><button type="button" class="p-btn is-ghost" data-r20tdel="' + t.id + '">Delete</button>' : '<button type="button" class="p-btn is-ghost" data-r20tcopy="' + t.id + '">Make my own copy</button>') + '</div>' +
        '<p class="p-hint" id="r20tMsg" role="status"></p>' +
        '<p class="p-hint">Only text people who gave you their number for this, at a legal hour where they are (see Calling hours), and stop the moment they ask.</p>');
    }
    function editor(t){
      return card(t.id ? 'Edit template' : 'New template', '', '<form class="px-form r20-row" id="r20tForm" novalidate>' +
        f('Name', '<input type="text" id="r20eT" maxlength="80" value="' + esc(t.title || '') + '">', 'px-wide') +
        f('Type', '<select id="r20eC">' + opt('sms', 'Text', t.channel !== 'email') + opt('email', 'Email', t.channel === 'email') + '</select>') +
        f('For', '<select id="r20eA">' + Object.keys(audFor()).map(k => opt(k, audFor()[k], (t.audience || 'seller') === k)).join('') + '</select>') +
        f('Subject (emails)', '<input type="text" id="r20eS" maxlength="150" value="' + esc(t.subject || '') + '">', 'px-wide') +
        f('Words', '<textarea id="r20eB" rows="6" maxlength="3000">' + esc(t.body || '') + '</textarea>', 'px-wide') +
        '<p class="p-hint px-wide">Blanks: {first_name} {property} {offer} {day} {my_name} {my_phone} {company}. Opt-out wording is added when you copy, so you don’t need to type it.</p>' +
        (owner ? '<label class="r20-sw px-wide"><input type="checkbox" id="r20eSh"' + (t.shared ? ' checked' : '') + '> <span>Share with the team</span></label>' : '') +
        '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save</button><button type="button" class="p-btn is-ghost" id="r20eX">Cancel</button><span class="p-hint" id="r20eMsg" role="status"></span></div></form>');
    }
    await load();
    const refreshOut = () => { const t = list.find(x => x.id === S.open); if (!t) return; const o = finalText(t, S.vals); const p = $('r20tOut'); if (p) p.textContent = o.body; const s = $('r20tSubj'); if (s) s.textContent = o.subject;
      const a = $('r20tSms'); if (a) a.href = 'sms:?&body=' + encodeURIComponent(o.body); const m = $('r20tMail'); if (m) m.href = 'mailto:?subject=' + encodeURIComponent(o.subject) + '&body=' + encodeURIComponent(o.body); };
    body.addEventListener('input', e => {
      if (e.target.dataset.r20v) { S.vals[e.target.dataset.r20v] = e.target.value; refreshOut(); return; }
      if (e.target.id === 'r20tQ') { S.q = e.target.value.trim().toLowerCase(); const p = e.target.selectionStart; draw(); const q = $('r20tQ'); q.focus(); q.setSelectionRange(p, p); }
    });
    body.addEventListener('change', e => { if (e.target.id === 'r20tCh') { S.ch = e.target.value; draw(); } if (e.target.id === 'r20tAud') { S.aud = e.target.value; draw(); } });
    body.addEventListener('click', async e => {
      const it = e.target.closest('[data-r20t]'); if (it) { S.open = +it.dataset.r20t; draw(); return; }
      if (e.target.id === 'r20tNew') { S.edit = { channel:S.ch || 'sms', audience:S.aud || 'seller' }; draw(); return; }
      if (e.target.id === 'r20eX') { S.edit = null; draw(); return; }
      const ed = e.target.closest('[data-r20tedit]'); if (ed) { S.edit = Object.assign({}, list.find(x => x.id === +ed.dataset.r20tedit)); draw(); window.scrollTo({ top:0, behavior:'smooth' }); return; }
      const cp = e.target.closest('[data-r20tcopy]'); if (cp) { const o = list.find(x => x.id === +cp.dataset.r20tcopy); S.edit = { channel:o.channel, audience:o.audience, title:o.title + ' (mine)', subject:o.subject, body:o.body }; draw(); window.scrollTo({ top:0, behavior:'smooth' }); return; }
      const dl = e.target.closest('[data-r20tdel]');
      if (dl && window.PortalUI && PortalUI.del) { PortalUI.del(dl, { text:'Template deleted.', label:'Delete', rows:[dl.closest('.p-card')], run:() => safe(db().from('outreach_templates').delete().eq('id', +dl.dataset.r20tdel)), after:() => { S.open = null; load(); } }); return; }
      if (dl) { if (dl.dataset.sure !== '1') { dl.dataset.sure = '1'; dl.textContent = 'Sure?'; return; } const x = await safe(db().from('outreach_templates').delete().eq('id', +dl.dataset.r20tdel)); if (!x.error) { S.open = null; load(); } return; }
      if (e.target.id === 'r20tCopy' || e.target.id === 'r20tSms' || e.target.id === 'r20tMail') {
        const t = list.find(x => x.id === S.open); if (!t) return;
        const o = finalText(t, S.vals);
        if (/\{[a-z_]+\}/.test(o.body + o.subject) && e.target.id === 'r20tCopy') say('r20tMsg', 'Some blanks are still empty. Fill them in first, or edit after pasting.');
        if (e.target.id === 'r20tCopy') { try { await navigator.clipboard.writeText((t.channel === 'email' ? 'Subject: ' + o.subject + '\n\n' : '') + o.body); if (!/blanks/.test(($('r20tMsg') || {}).textContent || '')) say('r20tMsg', 'Copied.'); } catch (er) { say('r20tMsg', 'Couldn’t copy. Select the text and copy it.'); } }
        safe(db().rpc('template_used', { p_id:t.id }));
      }
    });
    body.addEventListener('submit', async e => {
      if (e.target.id !== 'r20tForm') return; e.preventDefault();
      const row = { title:$('r20eT').value.trim(), channel:$('r20eC').value, audience:$('r20eA').value, subject:$('r20eS').value.trim() || null, body:$('r20eB').value.trim(), updated_at:new Date().toISOString() };
      if (owner && $('r20eSh')) row.shared = $('r20eSh').checked;
      if (row.title.length < 2 || row.body.length < 5) return say('r20eMsg', 'Add a name and the words.');
      if (row.channel === 'email' && !row.subject) return say('r20eMsg', 'Emails need a subject.');
      const x = S.edit.id ? await safe(db().from('outreach_templates').update(row).eq('id', S.edit.id).select('id').single()) : await safe(db().from('outreach_templates').insert(row).select('id').single());
      if (x.error) return say('r20eMsg', errText(x, 'Couldn’t save. Try again.'));
      S.open = x.data.id; S.edit = null; load();
    });
  } };

  // ======================================================================
  // #mylists: "Call back" on each row
  // ======================================================================
  const ml = V.mylists;
  if (ml && !ml.r20) {
    const open0 = ml.open;
    V.mylists = Object.assign({}, ml, { r20:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok()) return;
      const body = el.querySelector('.px-body'); if (!body) return;
      const add = () => body.querySelectorAll('select[data-out]').forEach(s => { if (s.parentNode.querySelector('[data-r20cb]')) return; s.insertAdjacentHTML('afterend', ' <button type="button" class="p-btn is-ghost r20-cbb" data-r20cb="' + s.dataset.out + '">Call back</button>'); });
      add();
      const mo = new MutationObserver(() => { if (!document.body.contains(el)) { mo.disconnect(); return; } add(); }); mo.observe(body, { childList:true, subtree:true });
      body.addEventListener('click', async e => {
        const b = e.target.closest('[data-r20cb]'); if (!b) return;
        const trEl = b.closest('tr'); const nx = trEl.nextElementSibling;
        if (nx && nx.classList.contains('r20-cbrow')) { nx.remove(); return; }
        const cells = trEl.querySelectorAll('td'), who = (cells[0] || {}).textContent || '', prop = (cells[2] || {}).textContent || '';
        const st = ((prop.match(/,\s*([A-Z]{2})(?:,|\s|$)/) || [])[1]) || '', tz = STATE_TZ[st] || 'America/New_York';
        const r = document.createElement('tr'); r.className = 'r20-cbrow';
        r.innerHTML = '<td colspan="5"><form class="px-form r20-row" novalidate>' + f('Day', '<input type="date" name="d" value="' + isoDay(new Date()) + '" min="' + isoDay(new Date()) + '">') + f('Time, their time', '<input type="time" name="t" value="15:00" step="300">') +
          f('Their time zone', '<select name="z">' + ZONES.map(([z, n]) => opt(z, n, z === tz)).join('') + '</select>') + f('Note (optional)', '<input type="text" name="n" maxlength="200">') +
          '<div class="px-tools"><button type="submit" class="p-btn">Save callback</button><span class="p-hint" data-r20cbmsg role="status"></span></div></form></td>';
        trEl.after(r);
        const form = r.querySelector('form'), msg = t => { r.querySelector('[data-r20cbmsg]').textContent = t; };
        const check = () => { const at = zonedToUtc(form.d.value, form.t.value, form.z.value); const ch = window.CallHours && st ? window.CallHours.check(st, at) : null;
          msg('= ' + fmtTime(at, 'Africa/Cairo') + ' Cairo' + (ch && !ch.ok ? ' · Careful: ' + ch.why : !st && !PX.callable(form.z.value, at) ? ' · Careful: outside 8 AM to 9 PM their time' : '')); return at; };
        check(); form.addEventListener('input', check);
        form.addEventListener('submit', async ev => {
          ev.preventDefault();
          const at = check(), label = (who.trim() + (prop.trim() && prop.trim() !== '–' ? ', ' + prop.trim() : '')).replace(/\d{3}\D?\d{3}\D?\d{4}/g, '').slice(0, 120) || 'Lead';
          const x = await safe(db().from('callbacks').insert({ label, state:st || null, tz:form.z.value, due_at:at.toISOString(), note:form.n.value.trim() || null, lead_record_id:+b.dataset.r20cb }));
          if (x.error) return msg(errText(x, 'Couldn’t save it. Try again.'));
          r.innerHTML = '<td colspan="5"><p class="p-hint">Callback saved for ' + esc(fmtTime(at, form.z.value)) + ' their time. You get a bell 10 minutes before.</p></td>';
          setTimeout(() => r.remove(), 4000);
        });
      });
    } });
  }

  // ======================================================================
  // Home: turn on phone alerts
  // ======================================================================
  const NUDGE = 'r20-push-later';
  async function pushOn(){
    try { if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false; const r = await navigator.serviceWorker.getRegistration('/app/'); const s = r && r.pushManager ? await r.pushManager.getSubscription() : null; return !!s; } catch (e) { return false; }
  }
  async function nudge(){
    const h = (location.hash || '#').split('/')[0];
    if (!['#', '', '#home', '#admin', '#portal'].includes(h) || !T().user || !window.PortalPush) return;
    try { const until = +localStorage.getItem(NUDGE) || 0; if (until > Date.now()) return; } catch (e) {}
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;
    if (await pushOn()) return;
    const wrap = document.querySelector('#pView .p-wrap'); if (!wrap || wrap.querySelector('#r20Push')) return;
    const box = document.createElement('section'); box.className = 'p-card r20-push'; box.id = 'r20Push';
    box.innerHTML = '<div class="p-card-head"><h2>Turn on phone alerts</h2><span><button type="button" class="p-btn is-ghost" id="r20PushLater">Not now</button></span></div><p class="p-hint">So callbacks, tasks, messages and bonuses reach you even when the portal is closed.</p><div id="r20PushBox"></div>';
    const hero = wrap.querySelector('.p-hero'); if (hero) hero.after(box); else wrap.prepend(box);
    window.PortalPush.draw(box.querySelector('#r20PushBox'));
    box.querySelector('#r20PushLater').onclick = () => { try { localStorage.setItem(NUDGE, String(Date.now() + 14 * 864e5)); } catch (e) {} box.remove(); };
  }
  const later = () => setTimeout(nudge, 1500);
  document.addEventListener('talents-signed-in', later);
  addEventListener('hashchange', later);
  later();
})();
