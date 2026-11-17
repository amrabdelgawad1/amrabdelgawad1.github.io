// Round 17 (Nov 17 2026), part 7b: calling hours checker.
//   #callhours  everyone: is it a legal hour to call each state right now? The federal rule (8 AM to 9 PM at the
//               person's location) plus the stricter state rules saved in calling_rules (some states start later,
//               end at 8 PM, or ban Sundays and holidays). Amr can add, change or remove any state rule.
//   window.CallHours.check(state, date) is shared with #mylists (lead lists), so every list shows the same answer.
// Split states (e.g. FL panhandle, TX El Paso, parts of IN, KY, TN, ND, SD, NE, KS, OR, ID) use their main time zone;
// check the area code when a seller is near a zone line. Not legal advice: confirm the rules with your attorney.
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, isOwner, card, empty, failed, pill, f, opt, say, errText, STATE_TZ, STATES } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const NAMES = { AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut', DE:'Delaware', DC:'Washington DC', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming' };
  const SPLIT = new Set(['FL', 'TX', 'IN', 'KY', 'TN', 'ND', 'SD', 'NE', 'KS', 'OR', 'ID', 'MI', 'AK']);
  let RULES = {};
  const mins = t => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const clock = m => { const h = Math.floor(m / 60) % 24, mi = m % 60; return (h % 12 || 12) + (mi ? ':' + String(mi).padStart(2, '0') : '') + ' ' + (h < 12 ? 'AM' : 'PM'); };
  function parts(tz, at){
    const p = new Intl.DateTimeFormat('en-US', { timeZone:tz, hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', weekday:'short' }).formatToParts(at);
    const g = k => (p.find(x => x.type === k) || {}).value;
    return { y:+g('year'), mo:+g('month'), d:+g('day'), h:+g('hour') % 24, mi:+g('minute'), wd:g('weekday') };
  }
  // US federal holidays (observed dates are not shifted here; state holidays differ, check them for AL, LA, PA, RI, UT)
  function holiday(y, mo, d){
    const nth = (n, wd, m) => { const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return 1 + ((wd - first + 7) % 7) + (n - 1) * 7; };
    const last = (wd, m) => { const days = new Date(Date.UTC(y, m, 0)).getUTCDate(), lw = new Date(Date.UTC(y, m - 1, days)).getUTCDay(); return days - ((lw - wd + 7) % 7); };
    const list = [[1, 1, 'New Year’s Day'], [1, nth(3, 1, 1), 'Martin Luther King Jr. Day'], [2, nth(3, 1, 2), 'Presidents Day'], [5, last(1, 5), 'Memorial Day'], [6, 19, 'Juneteenth'],
      [7, 4, 'Independence Day'], [9, nth(1, 1, 9), 'Labor Day'], [10, nth(2, 1, 10), 'Columbus Day'], [11, 11, 'Veterans Day'], [11, nth(4, 4, 11), 'Thanksgiving'], [12, 25, 'Christmas Day']];
    const h = list.find(x => x[0] === mo && x[1] === d); return h ? h[2] : '';
  }
  // Today's legal window in minutes after midnight, local time: { from, to, closed, note }
  function windowFor(st, p){
    const r = RULES[st], fed = { from:480, to:1260 };
    if (!r) return Object.assign(fed, { closed:false, note:'Federal 8 AM to 9 PM' });
    const hol = holiday(p.y, p.mo, p.d);
    if (hol && !r.holidays_ok) return { from:0, to:0, closed:true, note:'No calls on holidays (' + hol + ')' };
    if (p.wd === 'Sun' && !r.sun_ok) return { from:0, to:0, closed:true, note:'No calls on Sundays' };
    let from = mins(r.wk_from), to = mins(r.wk_to);
    if (p.wd === 'Sat' && r.sat_from) { from = mins(r.sat_from); to = mins(r.sat_to); }
    if (p.wd === 'Sun' && r.sun_from) { from = mins(r.sun_from); to = mins(r.sun_to); }
    return { from:Math.max(from, fed.from), to:Math.min(to, fed.to), closed:false, note:r.note || '' };
  }
  function check(st, at){
    st = String(st || '').toUpperCase().slice(0, 2); const tz = STATE_TZ[st]; if (!tz) return null;
    const p = parts(tz, at || new Date()), now = p.h * 60 + p.mi, w = windowFor(st, p);
    const time = clock(now) + ' ' + p.wd;
    if (w.closed) return { ok:false, time, why:w.note, w };
    const ok = now >= w.from && now < w.to;
    return { ok, time, w, why:ok ? 'Until ' + clock(w.to) : now < w.from ? 'Opens at ' + clock(w.from) : 'Closed at ' + clock(w.to) };
  }
  window.CallHours = { setRules(rows){ RULES = {}; (rows || []).forEach(r => RULES[r.state] = r); }, check, clock };

  V.callhours = { title:'Calling hours', sec:'everyone', async open(el, ok){
    const owner = isOwner();
    const body = PX.page(el, 'Calls', 'Calling hours', 'Can you call this state right now? Federal law allows 8 AM to 9 PM at the person’s location; some states are stricter. Times are the seller’s local time.');
    const r = await safe(db().from('calling_rules').select('*').order('state'));
    if (!ok()) return;
    if (r.error) { body.innerHTML = failed(r.error); return; }
    window.CallHours.setRules(r.data);
    let only = false, pick = '', edit = null, timer = null;
    const ruleText = x => { if (!x) return 'Federal only: 8 AM to 9 PM'; const t = [clock(mins(x.wk_from)) + ' to ' + clock(mins(x.wk_to))];
      if (x.sat_from) t.push('Sat ' + clock(mins(x.sat_from)) + ' to ' + clock(mins(x.sat_to))); if (!x.sun_ok) t.push('no Sundays'); else if (x.sun_from) t.push('Sun ' + clock(mins(x.sun_from)) + ' to ' + clock(mins(x.sun_to)));
      if (!x.holidays_ok) t.push('no holidays'); return t.join(' · '); };
    function draw(){
      const now = new Date(), rows = STATES.map(s => ({ s, c:check(s, now) })).filter(x => (!only || x.c.ok) && (!pick || x.s === pick));
      const one = pick ? check(pick, now) : null;
      body.innerHTML = '<div class="px-tools r17-filters">' + f('State', '<select id="chPick">' + opt('', 'All states') + STATES.map(s => opt(s, s + ' · ' + (NAMES[s] || s), s === pick)).join('') + '</select>') +
        '<label class="r17-check"><input type="checkbox" id="chOnly"' + (only ? ' checked' : '') + '> Only states open now</label></div>' +
        (one ? '<div class="r17-big ' + (one.ok ? 'is-ok' : 'is-no') + '"><b>' + (one.ok ? 'Yes, you can call ' : 'Don’t call ') + esc(NAMES[pick]) + ' now</b><span>It’s ' + esc(one.time) + ' there · ' + esc(one.why) + '</span>' +
          (SPLIT.has(pick) ? '<small>Part of ' + esc(NAMES[pick]) + ' is in another time zone. Near a zone line, check the area code.</small>' : '') + '</div>' : '') +
        card(only ? 'Open now' : 'Every state', rows.filter(x => x.c.ok).length + ' open now', PX.table(['State', 'Their time', 'Now', 'Rule'].concat(owner ? [''] : []), rows.map(x => {
          const rule = RULES[x.s];
          return '<tr><td><b>' + x.s + '</b> ' + esc(NAMES[x.s] || '') + '</td><td>' + esc(x.c.time) + '</td><td>' + pill(x.c.ok ? 'Open' : 'Closed', x.c.ok ? 'ok' : 'no') + '<br><small>' + esc(x.c.why) + '</small></td>' +
            '<td>' + esc(ruleText(rule)) + (rule && rule.note ? '<br><small>' + esc(rule.note) + '</small>' : '') + '</td>' +
            (owner ? '<td><button type="button" class="p-btn is-ghost" data-edit="' + x.s + '">' + (rule ? 'Edit' : 'Add rule') + '</button></td>' : '') + '</tr>' +
            (edit === x.s ? '<tr><td colspan="5">' + form(x.s, rule) + '</td></tr>' : '');
        }))) +
        '<p class="p-hint">Federal holidays are checked for states that ban holiday calls; state-only holidays are not. Rules here are a starting point, not legal advice: confirm them with your attorney.</p>';
    }
    const tIn = (id, v) => '<input type="time" name="' + id + '" value="' + esc(v ? String(v).slice(0, 5) : '') + '">';
    const form = (s, x) => '<form class="px-form r17-row" data-rule="' + s + '" novalidate>' + f('Weekdays from', tIn('wk_from', x ? x.wk_from : '08:00')) + f('to', tIn('wk_to', x ? x.wk_to : '21:00')) +
      f('Saturday from (blank = weekdays)', tIn('sat_from', x && x.sat_from)) + f('to', tIn('sat_to', x && x.sat_to)) + f('Sunday from (blank = weekdays)', tIn('sun_from', x && x.sun_from)) + f('to', tIn('sun_to', x && x.sun_to)) +
      '<label class="r17-check"><input type="checkbox" name="sun_ok"' + (!x || x.sun_ok ? ' checked' : '') + '> Sundays allowed</label><label class="r17-check"><input type="checkbox" name="holidays_ok"' + (!x || x.holidays_ok ? ' checked' : '') + '> Holidays allowed</label>' +
      f('Note or law', '<input type="text" name="note" maxlength="120" value="' + esc((x && x.note) || '') + '">', 'px-wide') +
      '<div class="px-tools px-wide"><button type="submit" class="p-btn">Save ' + s + '</button>' + (x ? '<button type="button" class="p-btn is-ghost" data-rmrule="' + s + '">Back to federal only</button>' : '') + '<span class="p-hint" id="chMsg" role="status"></span></div></form>';
    draw();
    timer = setInterval(() => { if (!document.body.contains(el) || !ok()) { clearInterval(timer); return; } if (!edit) draw(); }, 60000);
    body.addEventListener('change', e => { if (e.target.id === 'chPick') { pick = e.target.value; draw(); } else if (e.target.id === 'chOnly') { only = e.target.checked; draw(); } });
    body.addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]'); if (ed) { edit = edit === ed.dataset.edit ? null : ed.dataset.edit; draw(); return; }
      const rm = e.target.closest('[data-rmrule]'); if (!rm) return;
      const x = await safe(db().from('calling_rules').delete().eq('state', rm.dataset.rmrule));
      if (x.error) return say('chMsg', errText(x, 'Couldn’t save.')); delete RULES[rm.dataset.rmrule]; edit = null; draw();
    });
    body.addEventListener('submit', async e => {
      const fm = e.target.closest('[data-rule]'); if (!fm) return; e.preventDefault();
      const v = n => fm[n].value || null, s = fm.dataset.rule;
      if (!v('wk_from') || !v('wk_to')) return say('chMsg', 'Set the weekday hours.');
      if ((v('sat_from') && !v('sat_to')) || (v('sun_from') && !v('sun_to'))) return say('chMsg', 'Give both a from and a to time.');
      const row = { state:s, wk_from:v('wk_from'), wk_to:v('wk_to'), sat_from:v('sat_from'), sat_to:v('sat_to'), sun_from:v('sun_from'), sun_to:v('sun_to'), sun_ok:fm.sun_ok.checked, holidays_ok:fm.holidays_ok.checked, note:fm.note.value.trim() || null, updated_at:new Date().toISOString() };
      const x = await safe(db().from('calling_rules').upsert(row, { onConflict:'state' }));
      if (x.error) return say('chMsg', errText(x, 'Couldn’t save.')); RULES[s] = row; edit = null; draw();
    });
  }};
})();
