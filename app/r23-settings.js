// Round 23 (plan I29): one Settings page. Settings already had My profile, Sign-in and Devices; this adds
//   Notifications      the daily email of new alerts (was only in the bell), phone alerts (round 6, moved in here),
//                      and the Deal CRM morning reminder (was only inside the CRM) for people with Deal tools
//   Language and time  English or Arabic (was only at the bottom of the menu) and the time zone dates and times show in (I6)
// account.js lists the tabs and calls R23Settings.notify(B) / .lang(B). Nothing here sends a message.
(function(){
  'use strict';
  const T = () => window.TalentsApp || {};
  const db = () => T().db;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const head = (t, sub) => '<div class="set-head"><h3>' + t + '</h3>' + (sub ? '<p class="note">' + sub + '</p>' : '') + '</div>';
  const safe = p => Promise.resolve(p).then(x => x, e => ({ error:e }));
  const hourName = h => (h % 12 || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM');
  const hours = sel => Array.from({ length:24 }, (_, h) => '<option value="' + h + '"' + (+sel === h ? ' selected' : '') + '>' + hourName(h) + '</option>').join('');
  const ZONES = [['Africa/Cairo','Cairo'], ['America/New_York','New York (Eastern)'], ['America/Chicago','Chicago (Central)'], ['America/Denver','Denver (Mountain)'],
    ['America/Los_Angeles','Los Angeles (Pacific)'], ['Europe/London','London'], ['Asia/Dubai','Dubai'], ['Asia/Riyadh','Riyadh'], ['UTC','UTC']];
  let meKeys = null;
  async function keys(){
    if (meKeys) return meKeys;
    const r = await safe(db().rpc('portal_me')); const d = Array.isArray(r.data) ? r.data[0] : r.data;
    meKeys = { owner: !!(d && d.role === 'owner'), keys: (d && d.keys) || [] };
    return meKeys;
  }

  async function notify(B){
    B.innerHTML = head('Notifications', 'Everything that can reach you outside the portal, in one place. The bell inside the portal always shows every alert.') + '<p class="p-loading">Loading…</p>';
    const [m, k] = await Promise.all([safe(db().rpc('notify_email_pref')), keys()]);
    const mail = (m && m.data) || { daily:false, hour:8 };
    const deals = k.owner || k.keys.includes('deals');
    let rem = null;
    if (deals) { const r = await safe(db().from('deal_reminder_prefs').select('enabled,hour,tz,by_email,by_bell').maybeSingle()); rem = r.data || { enabled:true, hour:8, tz:'America/New_York', by_email:true, by_bell:true }; }
    B.innerHTML = head('Notifications', 'Everything that can reach you outside the portal, in one place. The bell inside the portal always shows every alert.') +
      '<section class="r23-set" aria-labelledby="r23n1"><h4 id="r23n1">Daily email of new alerts</h4>' +
        '<label class="r23-row"><input type="checkbox" data-r23mail' + (mail.daily ? ' checked' : '') + '> Email me once a day with the alerts I haven’t opened</label>' +
        '<label class="r23-row" data-r23mailhr' + (mail.daily ? '' : ' hidden') + '>Send it at <select data-r23mailhour aria-label="Email time, Cairo">' + hours(mail.hour) + '</select> Cairo time</label>' +
        '<p class="note" data-r23mailmsg role="status"></p></section>' +
      '<section class="r23-set" aria-label="Phone alerts"><div data-r23push></div></section>' +
      (deals ? '<section class="r23-set" aria-labelledby="r23n3"><h4 id="r23n3">Deal CRM morning reminder</h4><p class="note">Counts only: follow-ups due, callbacks and deals waiting. No deal details leave the CRM.</p>' +
        '<label class="r23-row"><input type="checkbox" data-r23rem' + (rem.enabled ? ' checked' : '') + '> Remind me each morning</label>' +
        '<div class="r23-sub" data-r23remmore' + (rem.enabled ? '' : ' hidden') + '>' +
          '<label class="r23-row">At <select data-r23remhour aria-label="Reminder time">' + hours(rem.hour) + '</select> in <select data-r23remtz aria-label="Reminder time zone">' +
            ZONES.map(([v, l]) => '<option value="' + v + '"' + (rem.tz === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>' +
          '<label class="r23-row"><input type="checkbox" data-r23remmail' + (rem.by_email ? ' checked' : '') + '> By email</label>' +
          '<label class="r23-row"><input type="checkbox" data-r23rembell' + (rem.by_bell ? ' checked' : '') + '> In the bell</label></div>' +
        '<p class="note" data-r23remmsg role="status"></p></section>' : '');
    const push = B.querySelector('[data-r23push]');
    if (window.PortalPush) window.PortalPush.draw(push); else push.innerHTML = '<p class="note">Refresh the app to set up phone alerts.</p>';
    B.onchange = async e => {
      const t = e.target;
      if (t.matches('[data-r23mail], [data-r23mailhour]')) {
        const on = B.querySelector('[data-r23mail]').checked, hr = +B.querySelector('[data-r23mailhour]').value;
        B.querySelector('[data-r23mailhr]').hidden = !on;
        const r = await safe(db().rpc('notify_email_set', { p_daily:on, p_hour:hr }));
        B.querySelector('[data-r23mailmsg]').textContent = r.error ? 'Couldn’t save. Try again.' : on ? 'Saved. One email a day at ' + hourName(hr) + ' Cairo time, only if something is unopened.' : 'Daily email off.';
        return;
      }
      if (t.matches('[data-r23rem], [data-r23remhour], [data-r23remtz], [data-r23remmail], [data-r23rembell]')) {
        const v = q => B.querySelector(q);
        const row = { enabled:v('[data-r23rem]').checked, hour:+v('[data-r23remhour]').value, tz:v('[data-r23remtz]').value, by_email:v('[data-r23remmail]').checked, by_bell:v('[data-r23rembell]').checked, updated_at:new Date().toISOString() };
        v('[data-r23remmore]').hidden = !row.enabled;
        const r = await safe(db().from('deal_reminder_prefs').upsert(row, { onConflict:'user_id' }));
        v('[data-r23remmsg]').textContent = r.error ? 'Couldn’t save. Try again.' : row.enabled ? 'Saved. The CRM’s own Settings shows the same choice.' : 'Morning reminder off.';
      }
    };
  }

  function lang(B){
    const ar = window.AppLang && window.AppLang.lang === 'ar';
    const UI = window.PortalUI, mine = (() => { try { return localStorage.getItem('portalZone') || ''; } catch (e) { return ''; } })();
    const dev = UI ? UI.deviceZone() : 'UTC';
    const opts = [['', 'This device’s zone (' + dev + ')']].concat(ZONES.filter(z => z[0] !== dev));
    B.innerHTML = head('Language and time', 'Saved on this device.') +
      '<section class="r23-set" aria-labelledby="r23l1"><h4 id="r23l1">Language</h4><fieldset class="choices"><legend class="label">The portal’s words</legend>' +
        '<label class="choice"><input type="radio" name="r23lang" value="en"' + (ar ? '' : ' checked') + '><b>English</b></label>' +
        '<label class="choice"><input type="radio" name="r23lang" value="ar"' + (ar ? ' checked' : '') + '><b lang="ar">عربي</b></label></fieldset>' +
        '<p class="note">Arabic reads right to left. Courses keep their own language switch inside each lesson.</p></section>' +
      '<section class="r23-set" aria-labelledby="r23l2"><h4 id="r23l2">Time zone</h4>' +
        '<label class="r23-row">Show times in <select data-r23zone>' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (mine === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>' +
        '<p class="note" data-r23zonenow role="status"></p>' +
        '<p class="note">Times always show AM or PM with the zone next to them. Shifts and pay days still follow the team’s own rules (work days in New York time, Cash in Cairo).</p></section>' +
      '<section class="r23-set" aria-labelledby="r23l3"><h4 id="r23l3">Look</h4><p class="note">The portal uses one light look so every page, course and calculator matches.</p></section>';
    const now = () => { const n = B.querySelector('[data-r23zonenow]'); if (n && UI) n.textContent = 'Right now: ' + UI.when(new Date()); };
    now();
    B.onchange = e => {
      const t = e.target;
      if (t.name === 'r23lang') { try { localStorage.setItem('appLang', t.value); } catch (er) {} location.reload(); return; }
      if (t.matches('[data-r23zone]')) { if (UI) UI.setZone(t.value); now(); }
    };
  }

  window.R23Settings = { notify, lang };
})();
