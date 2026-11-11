// Round 14 (handoff R14), part 2: safety and reach.
//   #status     Amr: is everything working? Site, sign-in, database, nightly backup, scheduled jobs, today's errors.
//               Also the backups themselves: open one, see what is in it, save any table as a CSV to put back.
//   #sendmail   Amr: write an email in the portal and send it to the whole team, one person, or applicants by status.
//   Settings › Phone alerts   everyone: "Allow alerts on this phone" (every bell also shows on the phone).
// Database and functions: portal-backups docs/sql/2026-11-12-round14-r6-*.sql and supabase/functions/
// (nightly-backup, push-send). Emails go through the same service as the Monday summary (Resend, free: 100 a day).
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, $, esc, safe, isOwner, isoDay, fmtDay, fmtTime, plural, card, empty, failed, pill, f, opt, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db, cfg = () => window.TRACKER_CONFIG || {};
  const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 1 ? 'just now' : m < 60 ? plural(m, 'minute') + ' ago' : m < 48 * 60 ? plural(Math.round(m / 60), 'hour') + ' ago' : plural(Math.round(m / 1440), 'day') + ' ago'; };
  const at = t => t ? fmtDay(t, { month:'short', day:'numeric', timeZone:'Africa/Cairo' }) + ', ' + fmtTime(t, 'Africa/Cairo') + ' Cairo' : '–';
  const mb = n => (n / 1048576).toFixed(1) + ' MB';
  const LIGHT = { ok:['All good', 'ok'], warn:['Check', ''], bad:['Problem', 'no'] };
  const JOBS = {
    'talents-nightly-backup':'Nightly backup', 'talents-shift-reminders':'Shift reminders', 'talents-forgotten-shifts':'Forgotten clock-outs', 'talents-late-starts':'Late-start alerts', 'talents-monday-summary':'Monday summary email',
    'deal-alerts':'Deal alerts', 'deal-daily-summary':'Deal daily summary', 'deal-followup-emails':'Deal follow-up emails', 'deal-weekly':'Deal weekly email', 'deal-access-ending':'Deal access ending emails'
  };

  // ======================================================================
  // Status
  // ======================================================================
  V.status = { title:'Status', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Site', 'Status', 'Is everything working? Green is fine, amber needs a look, red needs fixing.');
    const t0 = performance.now();
    const [s, site, auth] = await Promise.all([
      safe(db().rpc('portal_status')),
      fetch('/app/sw.js', { cache:'no-store' }).then(r => r.ok ? r.text() : null, () => null),
      fetch(cfg().supabaseUrl + '/auth/v1/health', { headers:{ apikey:cfg().supabaseKey } }).then(r => r.ok, () => false)
    ]);
    if (!ok()) return;
    const ms = Math.round(performance.now() - t0);
    if (s.error) { body.innerHTML = failed(s.error); return; }
    const d = s.data || {}, ver = site && (site.match(/VERSION = '([^']+)'/) || [])[1];
    const lastB = d.backup_auto, hrs = lastB ? (Date.now() - new Date(lastB)) / 36e5 : 1e9;
    const info = (() => { try { return JSON.parse(d.backup_info || '{}'); } catch (e) { return {}; } })();
    const jobs = (d.jobs || []).map(j => Object.assign({ light: !j.active ? 'warn' : j.last_status === 'failed' ? 'bad' : j.fails_24h ? 'warn' : 'ok' }, j));
    const checks = [
      ['Website', site ? 'ok' : 'bad', site ? 'Up. App version ' + esc(ver || '?') + '.' : 'The site didn’t answer. Check GitHub Pages.'],
      ['Sign-in', auth ? 'ok' : 'bad', auth ? 'Working.' : 'The sign-in service didn’t answer.'],
      ['Database', 'ok', 'Reachable (' + ms + ' ms). Size ' + esc(d.db_size_mb) + ' MB of the free 500 MB.'],
      ['Nightly backup', hrs < 26 ? 'ok' : hrs < 50 ? 'warn' : 'bad', 'Last one ' + ago(lastB) + (info.bytes ? ' · ' + mb(info.bytes) + ', ' + plural(info.tables || 0, 'table') + ', ' + plural(info.rows || 0, 'row') : '') +
        (d.backup_error && (!lastB || d.backup_error.slice(0, 24) > lastB) ? '<br><small>Last error: ' + esc(d.backup_error) + '</small>' : '')],
      ['Scheduled jobs', jobs.some(j => j.light === 'bad') ? 'bad' : jobs.some(j => j.light === 'warn') ? 'warn' : 'ok', plural(jobs.filter(j => j.light === 'ok').length, 'job') + ' of ' + jobs.length + ' ran fine last time.'],
      ['Errors today', !d.errors_today ? 'ok' : d.errors_today < 6 ? 'warn' : 'bad', d.errors_today ? plural(d.errors_today, 'error') + ' seen by people using the app today.' : 'No errors today.']
    ];
    const worst = checks.some(c => c[1] === 'bad') ? 'bad' : checks.some(c => c[1] === 'warn') ? 'warn' : 'ok';
    body.innerHTML =
      '<section class="p-card r6-top is-' + worst + '"><b>' + (worst === 'ok' ? 'Everything is working.' : worst === 'warn' ? 'Working, with something to check.' : 'Something needs fixing.') + '</b><span>Checked ' + esc(fmtTime(new Date(), 'Africa/Cairo')) + ' Cairo</span><button type="button" class="p-btn is-ghost" id="r6Again">Check again</button></section>' +
      card('Checks', '', checks.map(([n, l, txt]) => '<div class="p-row r6-check"><span class="r6-dot is-' + l + '" aria-hidden="true"></span><span><b>' + esc(n) + '</b><br><small>' + txt + '</small></span>' + pill(LIGHT[l][0], LIGHT[l][1]) + '</div>').join('')) +
      card('Scheduled jobs', 'Last run', '<div class="p-tablewrap"><table class="p-table px-table"><thead><tr><th>Job</th><th>Last run</th><th>Result</th><th>Fails (24h)</th></tr></thead><tbody>' +
        jobs.map(j => '<tr><td><b>' + esc(JOBS[j.name] || j.name) + '</b></td><td>' + esc(at(j.last_at)) + '</td><td>' + pill(j.last_status === 'succeeded' ? 'Fine' : j.last_status === 'failed' ? 'Failed' : j.last_status ? 'Running' : 'Not yet', j.last_status === 'succeeded' ? 'ok' : j.last_status === 'failed' ? 'no' : 'plain') + '</td><td>' + (j.fails_24h || 0) + '</td></tr>').join('') + '</tbody></table></div>') +
      card('Today’s errors', plural(d.errors_today || 0, 'error'), (d.errors || []).length ? (d.errors || []).map(e => '<div class="p-row"><span><b>' + esc(e.who) + '</b> · ' + esc(e.page || '') + '<br><small>' + esc(e.message || '') + '</small></span><small>' + esc(fmtTime(e.at, 'Africa/Cairo')) + '</small></div>').join('') : empty('Nothing went wrong for anyone today.')) +
      card('Backups', plural((d.backups || []).length, 'nightly backup'), '<p class="tp-note">Every night at about 3 AM Cairo time the database saves every table to a private folder. The last 30 nights are kept. Your manual download was last made ' + esc(ago(d.backup_manual)) + '. Files people uploaded (receipts, recordings, documents) stay in their own private folders and are not in these backups.</p>' +
        '<div class="wk-row"><button type="button" class="p-btn" id="r6Now">Back up now</button><span class="p-empty" id="r6NowMsg" role="status"></span></div>' +
        ((d.backups || []).length ? (d.backups || []).slice(0, 30).map(b => '<div class="p-row"><span><b>' + esc(fmtDay(b.name.slice(8, 18), { weekday:'short', month:'short', day:'numeric' })) + '</b><br><small>' + mb(b.size) + '</small></span><button type="button" class="p-btn is-ghost" data-bk="' + esc(b.name) + '">Open</button></div>').join('') : empty('No nightly backups yet.')) +
        '<div id="r6Bk"></div>') +
      card('How to put data back', '', '<ol class="r5-steps">' +
        '<li><b>Find the night before the mistake.</b><p>Open that backup above. You see every table and how many rows it had.</p></li>' +
        '<li><b>Save the table you need.</b><p>Press “Save as CSV” next to it. It downloads to this device.</p></li>' +
        '<li><b>Check it.</b><p>Open the CSV in Google Sheets. Delete the rows you don’t want back, so only the missing ones are left.</p></li>' +
        '<li><b>Put it back.</b><p>In Supabase, open Table Editor, pick the same table, then Insert › Import data from CSV and choose the file. Rows that already exist are skipped if they have the same id.</p></li>' +
        '<li><b>Or ask for help.</b><p>Tell Claude “put back the &lt;table&gt; rows from the &lt;date&gt; backup”. Nothing is deleted while restoring.</p></li></ol>');

    body.addEventListener('click', async e => {
      if (e.target.id === 'r6Again') return V.status.open(el, ok);
      if (e.target.id === 'r6Now') { e.target.disabled = true; const x = await safe(db().rpc('portal_backup_now'));
        say('r6NowMsg', x.error ? errText(x, 'Couldn’t start it.') : 'Started. It takes about a minute; press Check again after.'); return; }
      const b = e.target.closest('[data-bk]');
      if (b) { b.disabled = true; const box = $('r6Bk'); box.innerHTML = PX.loading;
        try {
          const g = await db().storage.from('backups').download(b.dataset.bk); if (g.error || !g.data) throw new Error('Couldn’t download it.');
          const text = await new Response(g.data.stream().pipeThrough(new DecompressionStream('gzip'))).text();
          const data = JSON.parse(text); window.__r6bk = data;
          const names = Object.keys(data.tables || {}).sort();
          box.innerHTML = '<h3 class="r5-h3">Inside ' + esc(b.dataset.bk.slice(8, 18)) + ' · made ' + esc(at(data.made)) + '</h3><input type="search" id="r6Find" placeholder="Find a table" aria-label="Find a table" class="wk-find">' +
            '<div id="r6Tables">' + names.map(n => '<div class="p-row" data-tn="' + esc(n) + '"><span><b>' + esc(n) + '</b><br><small>' + plural((data.tables[n] || []).length, 'row') + '</small></span>' + ((data.tables[n] || []).length ? '<button type="button" class="p-btn is-ghost" data-csv="' + esc(n) + '">Save as CSV</button>' : '') + '</div>').join('') + '</div>';
        } catch (er) { box.innerHTML = '<p class="p-empty">' + esc(er.message || 'Couldn’t open it.') + '</p>'; }
        b.disabled = false; return; }
      const c = e.target.closest('[data-csv]');
      if (c && window.__r6bk) { const rows = window.__r6bk.tables[c.dataset.csv] || [], cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
        const cell = v => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v), q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        const csv = [cols.join(',')].concat(rows.map(r => cols.map(k => q(cell(r[k]))).join(','))).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' })); a.download = c.dataset.csv + '-' + (window.__r6bk.made || '').slice(0, 10) + '.csv';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
    });
    body.addEventListener('input', e => { if (e.target.id !== 'r6Find') return; const q = e.target.value.toLowerCase(); body.querySelectorAll('[data-tn]').forEach(r => r.hidden = !!q && !r.dataset.tn.includes(q)); });
  }};

  // ======================================================================
  // Send an email (Amr)
  // ======================================================================
  const APPS = [['new', 'New'], ['shortlisted', 'Shortlisted'], ['interview', 'Interview'], ['hired', 'Hired'], ['declined', 'Declined'], ['all', 'Every applicant']];
  V.sendmail = { title:'Send an email', sec:'owner', async open(el, ok){
    const body = PX.page(el, 'Team', 'Send an email', 'Write an announcement or an applicant email here and send it from the portal. Each person gets their own email, starting “Hello &lt;first name&gt;”. Replies come to your inbox.');
    const [p, log] = await Promise.all([safe(db().from('members').select('user_id,name,email').eq('active', true).order('name')), safe(db().from('team_emails').select('*').order('created_at', { ascending:false }).limit(50))]);
    if (!ok()) return;
    if (log.error) { body.innerHTML = failed(log.error); return; }
    const ppl = p.data || [];
    body.innerHTML = card('New email', '', '<form class="px-form" id="r6Mail" novalidate>' +
        f('Send to', '<select id="r6To">' + opt('team', 'The whole team') + opt('person', 'One person') + APPS.map(([k, l]) => opt('applicants:' + k, 'Applicants: ' + l)).join('') + '</select>') +
        f('Person', '<select id="r6Who">' + ppl.map(x => opt(x.user_id, x.name)).join('') + '</select>', 'r6-who') +
        '<p class="p-empty px-wide" id="r6Count" role="status"></p>' +
        f('Subject', '<input type="text" id="r6Subj" maxlength="160" autocomplete="off">', 'px-wide') +
        f('Message', '<textarea id="r6Body" rows="9" maxlength="20000" placeholder="Write it like a normal email. Line breaks are kept. It ends with your name."></textarea>', 'px-wide') +
        '<div class="wk-row px-wide"><button class="p-btn" type="submit" id="r6Send">Send</button><span class="p-empty" id="r6Msg" role="status"></span></div></form>' +
        '<p class="tp-note">Free plan: up to 100 emails a day from the portal and the automatic emails together, so one send is capped at 90 people.</p>') +
      card('Sent', plural((log.data || []).length, 'email'), (log.data || []).length ? (log.data || []).map(m => '<details class="r5-list"><summary><b>' + esc(m.subject) + '</b> · ' + esc(m.audience_label || m.audience) + ' · ' + plural(m.recipients, 'person', 'people') + ' · ' + esc(at(m.created_at)) + '</summary><pre class="r5-pre">' + esc(m.body) + '</pre></details>').join('') : empty('Nothing sent from here yet.'));
    const who = () => { const to = $('r6To').value; body.querySelector('.r6-who').hidden = to !== 'person'; return to; };
    const count = async () => { const to = who(); say('r6Count', 'Counting…');
      const x = await safe(db().rpc('portal_team_email_count', { p_audience:to, p_user:to === 'person' ? $('r6Who').value : null }));
      say('r6Count', x.error ? '' : 'Goes to ' + plural(x.data.count, 'person', 'people') + '. Sent from the portal today: ' + x.data.sent_today + '.'); };
    $('r6To').addEventListener('change', count); $('r6Who').addEventListener('change', count); count();
    $('r6Mail').addEventListener('submit', async e => {
      e.preventDefault();
      const b = $('r6Send'), to = $('r6To').value, subj = $('r6Subj').value.trim(), msg = $('r6Body').value.trim();
      if (!subj) return say('r6Msg', 'Add a subject.'); if (!msg) return say('r6Msg', 'Write the message.');
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Send now'; return; }
      b.disabled = true; say('r6Msg', 'Sending…');
      const label = to === 'person' ? $('r6Who').selectedOptions[0].textContent : $('r6To').selectedOptions[0].textContent;
      const x = await safe(db().rpc('portal_team_email_send', { p_subject:subj, p_body:msg, p_audience:to, p_user:to === 'person' ? $('r6Who').value : null, p_label:label }));
      if (x.error) { b.disabled = false; b.dataset.sure = ''; b.textContent = 'Send'; return say('r6Msg', errText(x, 'Couldn’t send it. Try again.')); }
      V.sendmail.open(el, ok);
    });
  }};

  // ======================================================================
  // Phone alerts (Settings › Phone alerts)
  // ======================================================================
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  async function reg(){ return 'serviceWorker' in navigator ? navigator.serviceWorker.getRegistration('/app/') || navigator.serviceWorker.ready : null; }
  async function current(){ try { const r = await reg(); return r && r.pushManager ? await r.pushManager.getSubscription() : null; } catch (e) { return null; } }
  window.PortalPush = {
    async draw(B){
      const head = '<div class="set-head"><h3>Phone alerts</h3><p class="note">Get a notification on this phone for each new bell: messages, tasks, callbacks, schedule changes, swaps and late starts.</p></div>';
      const can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!can || (ios && !standalone)) {
        B.innerHTML = head + '<p class="note">' + (ios ? 'On iPhone, alerts work only from the app on your Home Screen (iOS 16.4 or later): open this site in Safari, tap Share › Add to Home Screen, open the portal from that icon, then come back here.' : 'This browser can’t show alerts. Use Chrome on Android, or the portal added to the Home Screen on iPhone.') + '</p>';
        return;
      }
      const sub = await current(), perm = Notification.permission;
      B.innerHTML = head + '<p class="note" id="pushState">' + (sub ? 'Alerts are on for this phone.' : perm === 'denied' ? 'Alerts are blocked for this site. Allow notifications for amrabdelgawad.site in the phone’s settings, then come back.' : 'Alerts are off for this phone.') + '</p>' +
        '<div class="acts">' + (sub ? '<button class="btn" type="button" id="pushTest">Send a test alert</button> <button class="btn ghost" type="button" id="pushOff">Turn off on this phone</button>' : perm === 'denied' ? '' : '<button class="btn" type="button" id="pushOn">Allow alerts on this phone</button>') + '</div><p class="note" id="pushMsg" role="status"></p>';
      const msg = t => { const m = document.getElementById('pushMsg'); if (m) m.textContent = t; };
      B.onclick = async e => {
        if (e.target.id === 'pushOn') { e.target.disabled = true; msg('Asking…');
          try {
            if (await Notification.requestPermission() !== 'granted') { msg('Not allowed. You can allow it later in the phone’s settings.'); e.target.disabled = false; return; }
            const k = await safe(db().rpc('portal_push_key')); if (k.error || !k.data) throw new Error('Couldn’t get the key.');
            const r = await reg(); const s = await r.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:b64(k.data) });
            const j = s.toJSON(), dev = (navigator.userAgentData && navigator.userAgentData.platform) || (ios ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computer');
            const x = await safe(db().from('push_subscriptions').upsert({ endpoint:j.endpoint, p256dh:j.keys.p256dh, auth:j.keys.auth, device:dev }, { onConflict:'endpoint' }));
            if (x.error) throw new Error(errText(x, 'Couldn’t save it.'));
            window.PortalPush.draw(B);
          } catch (er) { msg(er.message || 'Couldn’t turn alerts on.'); e.target.disabled = false; } }
        if (e.target.id === 'pushOff') { const s = await current(); if (s) { await safe(db().from('push_subscriptions').delete().eq('endpoint', s.endpoint)); await s.unsubscribe().catch(() => {}); } window.PortalPush.draw(B); }
        if (e.target.id === 'pushTest') { e.target.disabled = true; const x = await safe(db().rpc('portal_push_test')); msg(x.error ? errText(x, 'Couldn’t send it.') : 'Sent. It should show in a few seconds, even with the app closed.'); setTimeout(() => { e.target.disabled = false; }, 4000); }
      };
    }
  };
})();
