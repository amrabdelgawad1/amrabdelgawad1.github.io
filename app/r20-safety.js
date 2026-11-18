// Round 20 (Nov 18 2026), part A: legal, spam, email and data cleanup.
//   Sign-in       everyone but Amr: when the Terms or the Privacy policy has a version they haven't agreed to, a short
//                 box asks them to read and agree before the portal opens (consent_needed / consent_accept). Each "I agree"
//                 is saved with the version, date, time and device (consent_records).
//   #consents     Amr: every agreement record (portal, job form, buyers form, seller upload links), the current version of
//                 each page, "Ask everyone again" after editing a page, and a CSV download.
//   #cleanup      Amr: Data cleanup. Rules that delete old items on their own each night (job applications, seller
//                 photos, recordings, read alerts, logs). Each rule: how many days to keep, on or off, what it would remove
//                 today. "Run cleanup now". Nothing runs for a rule that is off. Edge function data-cleanup, cron 1:30 UTC.
//   #status       Amr: "Email, spam and phone alerts": the sending domain's email records checked live (DKIM, SPF,
//                 return path, DMARC, inbox), spam stopped on public forms in the last 7 days, and who has phone alerts on.
// Database: legal_docs, consent_records, spam_blocks + private.form_guard, retention_rules, retention_runs,
// retention_preview(), retention_set(), retention_run_now(), spam_summary(), push_coverage().
(function(){
  'use strict';
  const PX = window.PX; if (!PX) return;
  const { T, esc, safe, isOwner, fmtDay, fmtTime, num, plural, card, empty, failed, pill, f, opt, table, tr, say, errText } = PX;
  const V = window.PortalViews = window.PortalViews || {};
  const db = () => T().db;
  const when = t => t ? fmtDay(t, { month:'short', day:'numeric', year:'numeric' }) + ', ' + fmtTime(t) : '–';
  const SRC = { portal:'Portal sign-in', apply:'Job form', buyers:'Buyers form', checkout:'Course checkout', seller_upload:'Seller upload link' };
  const DOC = { terms:'Terms of use', privacy:'Privacy policy', refunds:'Refund policy' };

  // ======================================================================
  // Agree to the Terms and the Privacy policy (everyone but Amr)
  // ======================================================================
  let asking = false;
  async function consentCheck(){
    if (asking || !T().db || !T().user || isOwner()) return;
    asking = true;
    const r = await safe(db().rpc('consent_needed'));
    const need = (!r.error && r.data) || [];
    if (!need.length) { asking = false; return; }
    const box = document.createElement('div');
    box.className = 'r20-gate'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'r20gT');
    const first = need.length === 2 ? 'the Terms of use and the Privacy policy' : DOC[need[0].doc];
    box.innerHTML = '<div class="r20-gbox"><h2 id="r20gT">Please read and agree</h2>' +
      '<p>' + (need.some(x => x.doc === 'terms') ? 'Before you go on, please read ' : 'We updated ') + esc(first) + '. They explain how the portal works, what is expected of you, and how your information is kept.</p>' +
      '<ul class="r20-glinks">' + need.map(x => '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a> <small>version ' + esc(x.version) + '</small></li>').join('') + '</ul>' +
      '<label class="r20-gchk"><input type="checkbox" id="r20gOk"> <span>I have read and agree to ' + esc(first) + '.</span></label>' +
      '<div class="r20-gacts"><button type="button" class="p-btn" id="r20gGo" disabled>Agree and continue</button><button type="button" class="p-btn is-ghost" id="r20gOut">Sign out</button></div>' +
      '<p class="p-hint" id="r20gMsg" role="status"></p></div>';
    document.body.appendChild(box);
    const ok = box.querySelector('#r20gOk'), go = box.querySelector('#r20gGo');
    ok.addEventListener('change', () => { go.disabled = !ok.checked; });
    setTimeout(() => ok.focus(), 50);
    box.querySelector('#r20gOut').onclick = () => { box.remove(); asking = false; if (T().signOut) T().signOut(); };
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Saving…';
      const x = await safe(db().rpc('consent_accept', { p_docs:need.map(n => n.doc), p_ua:navigator.userAgent.slice(0, 300) }));
      if (x.error) { go.disabled = false; go.textContent = 'Agree and continue'; box.querySelector('#r20gMsg').textContent = errText(x, 'Couldn’t save. Check your connection and try again.'); return; }
      box.remove(); asking = false;
    };
  }
  document.addEventListener('talents-signed-in', () => setTimeout(consentCheck, 600));
  document.addEventListener('talents-signed-out', () => { const g = document.querySelector('.r20-gate'); if (g) g.remove(); asking = false; });
  // signed in before this file loaded
  let tries = 0; const wait = setInterval(() => { tries++; if (T().user && T().role) { clearInterval(wait); consentCheck(); } else if (tries > 40) clearInterval(wait); }, 500);

  // ======================================================================
  // #consents: agreement records (Amr)
  // ======================================================================
  V.consents = { title:'Agreements', sec:'owner', app:'people', async open(el, ok){
    const body = PX.page(el, 'Site', 'Agreements', 'Who agreed to the Terms and the Privacy policy, which version and when. The team agrees at sign-in; applicants and buyers when they send the form.');
    const [d, r] = await Promise.all([safe(db().from('legal_docs').select('*').order('doc')), safe(db().from('consent_records').select('*').order('accepted_at', { ascending:false }).limit(2000))]);
    if (!ok()) return;
    if (d.error || r.error) { body.innerHTML = failed(d.error || r.error); return; }
    const docs = d.data || [], rows = r.data || [];
    const S = { doc:'', src:'', q:'' };
    function draw(){
      const list = rows.filter(x => (!S.doc || x.doc === S.doc) && (!S.src || x.source === S.src) && (!S.q || [x.name, x.email].join(' ').toLowerCase().includes(S.q)));
      body.innerHTML =
        card('Pages and versions', 'the portal asks again when a version changes',
          table(['Page', 'Version', 'Updated', 'Agreed to this version', ''], docs.map(x => tr(['<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a>', esc(x.version), esc(fmtDay(x.updated_on, { month:'short', day:'numeric', year:'numeric' })),
            num(rows.filter(c => c.doc === x.doc && c.version === x.version).length),
            x.doc === 'refunds' ? '<small class="p-hint">Shown at checkout</small>' : '<button type="button" class="p-btn is-ghost" data-r20bump="' + esc(x.doc) + '">Ask everyone again</button>']))) +
          '<p class="p-hint">After you change the words on a page, press “Ask everyone again”. The version becomes today’s date and the team agrees again at their next sign-in.</p><p class="p-hint" id="r20cMsg" role="status"></p>') +
        card('Records', plural(list.length, 'record'),
          '<div class="px-form r20-row">' + f('Page', '<select id="r20cDoc">' + opt('', 'All') + Object.keys(DOC).map(k => opt(k, DOC[k], S.doc === k)).join('') + '</select>') +
          f('Where', '<select id="r20cSrc">' + opt('', 'All') + Object.keys(SRC).map(k => opt(k, SRC[k], S.src === k)).join('') + '</select>') +
          f('Search', '<input type="search" id="r20cQ" placeholder="Name or email" value="' + esc(S.q) + '">') +
          '<div class="px-tools"><button type="button" class="p-btn is-ghost" id="r20cCsv">Download CSV</button></div></div>' +
          (list.length ? table(['When', 'Who', 'Page', 'Version', 'Where'], list.slice(0, 500).map(x => tr([esc(when(x.accepted_at)), '<b>' + esc(x.name || '–') + '</b><br><small>' + esc(x.email || '') + '</small>', esc(DOC[x.doc] || x.doc), esc(x.version), esc(SRC[x.source] || x.source)])))
            + (list.length > 500 ? '<p class="p-hint">Showing the newest 500. The CSV has all ' + list.length + '.</p>' : '') : empty('No agreements yet. They appear when the team signs in and when people send the job or buyers form.')));
    }
    draw();
    body.addEventListener('change', e => { if (e.target.id === 'r20cDoc') { S.doc = e.target.value; draw(); } if (e.target.id === 'r20cSrc') { S.src = e.target.value; draw(); } });
    body.addEventListener('input', e => { if (e.target.id === 'r20cQ') { S.q = e.target.value.trim().toLowerCase(); const p = e.target.selectionStart; draw(); const q = document.getElementById('r20cQ'); if (q) { q.focus(); q.setSelectionRange(p, p); } } });
    body.addEventListener('click', async e => {
      if (e.target.id === 'r20cCsv') {
        const list = rows.filter(x => (!S.doc || x.doc === S.doc) && (!S.src || x.source === S.src) && (!S.q || [x.name, x.email].join(' ').toLowerCase().includes(S.q)));
        const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const csv = [['When (UTC)', 'Name', 'Email', 'Page', 'Version', 'Where', 'Device']].concat(list.map(x => [x.accepted_at, x.name, x.email, DOC[x.doc] || x.doc, x.version, SRC[x.source] || x.source, x.ua])).map(r2 => r2.map(q).join(',')).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' })); a.download = 'agreements-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        return;
      }
      const b = e.target.closest('[data-r20bump]'); if (!b) return;
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Everyone agrees again'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = 'Ask everyone again'; } }, 4000); return; }
      b.disabled = true;
      const today = new Date().toISOString().slice(0, 10), doc = docs.find(x => x.doc === b.dataset.r20bump);
      let v = today; if (doc && doc.version.startsWith(today)) v = today + '.' + ((+(doc.version.split('.')[1] || 1)) + 1);
      const x = await safe(db().from('legal_docs').update({ version:v, updated_on:today }).eq('doc', b.dataset.r20bump));
      if (x.error) { b.disabled = false; say('r20cMsg', errText(x, 'Couldn’t change it. Try again.')); return; }
      if (doc) { doc.version = v; doc.updated_on = today; }
      draw(); say('r20cMsg', 'Done. The team will be asked to agree to the new version at their next sign-in.');
    });
  } };

  // ======================================================================
  // #cleanup: data cleanup rules (Amr)
  // ======================================================================
  const DAYS = [7, 14, 30, 60, 90, 180, 365, 730, 1095];
  const dayName = n => n == null ? 'Keep forever' : n % 365 === 0 ? plural(n / 365, 'year') : n % 30 === 0 && n >= 60 ? plural(n / 30, 'month') : plural(n, 'day');
  V.cleanup = { title:'Data cleanup', sec:'owner', app:'people', async open(el, ok){
    const body = PX.page(el, 'Site', 'Data cleanup', 'Old items deleted on their own each night, so storage stays small and you keep less personal data. A rule that is off never deletes anything.');
    async function load(){
      const [p, runs] = await Promise.all([safe(db().rpc('retention_preview')), safe(db().from('retention_runs').select('*').order('at', { ascending:false }).limit(30))]);
      if (!ok()) return;
      if (p.error) { body.innerHTML = failed(p.error); return; }
      const rules = p.data || [];
      body.innerHTML =
        '<div class="p-card r20-warn"><b>Deleted means gone.</b> Files are removed from storage and rows from the database. Nightly backups keep rows for a while, but not files. Switch a rule on only for things you are sure you won’t need.</div>' +
        card('Rules', 'runs every night at 3:30 AM Cairo',
          rules.map(r => '<div class="r20-rule" data-place="' + esc(r.place) + '">' +
            '<div class="r20-rl"><b>' + esc(r.label) + '</b> ' + (r.enabled ? pill('On', 'ok') : pill('Off', 'plain')) + '<br><small>' + esc(r.what) + '</small>' +
            '<small class="r20-rs">' + (r.days == null ? 'Set how long to keep it to see what it would remove.' : 'Older than ' + esc(dayName(r.days)) + ': <b>' + num(r.would_remove) + '</b> would go now' + (+r.files ? ' (' + plural(+r.files, 'file') + ')' : '') + '.') +
            (r.last_run ? ' Last run ' + esc(when(r.last_run)) + ', removed ' + num(r.last_deleted || 0) + '.' : '') + '</small></div>' +
            '<div class="r20-rc">' + f('Keep for', '<select data-r20days>' + opt('', 'Keep forever', r.days == null) + DAYS.map(n => opt(n, dayName(n), +r.days === n)).join('') + (r.days != null && !DAYS.includes(+r.days) ? opt(r.days, dayName(+r.days), true) : '') + '</select>') +
            '<label class="r20-sw"><input type="checkbox" data-r20on' + (r.enabled ? ' checked' : '') + '> <span>Delete on its own</span></label>' +
            '<button type="button" class="p-btn is-ghost" data-r20save>Save</button></div></div>').join('') +
          '<p class="p-hint" id="r20rMsg" role="status"></p>') +
        card('Run it now', '', '<p class="p-hint">Runs every rule that is on, right away, instead of waiting for tonight.</p><div class="acts"><button type="button" class="p-btn" id="r20Run">Run cleanup now</button></div><p class="p-hint" id="r20RunMsg" role="status"></p>') +
        card('Recent runs', '', (runs.data || []).length ? table(['When', 'Rule', 'Removed', 'Files'], runs.data.map(x => tr([esc(when(x.at)), esc((rules.find(r => r.place === x.place) || {}).label || x.place), num(x.deleted), num(x.files)]))) : empty('No runs yet. The first one is tonight, for the rules that are on.'));
    }
    await load();
    body.addEventListener('click', async e => {
      const s = e.target.closest('[data-r20save]');
      if (s) {
        const row = s.closest('.r20-rule'), dv = row.querySelector('[data-r20days]').value, on = row.querySelector('[data-r20on]').checked;
        s.disabled = true;
        const x = await safe(db().rpc('retention_set', { p_place:row.dataset.place, p_days:dv === '' ? null : +dv, p_enabled:on }));
        s.disabled = false;
        if (x.error) { say('r20rMsg', errText(x, 'Couldn’t save. Try again.')); return; }
        await load(); say('r20rMsg', 'Saved.'); return;
      }
      if (e.target.id === 'r20Run') {
        const b = e.target;
        if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? This deletes what is listed above'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = 'Run cleanup now'; } }, 5000); return; }
        b.disabled = true; say('r20RunMsg', 'Running…');
        const x = await safe(db().rpc('retention_run_now'));
        if (x.error) { b.disabled = false; say('r20RunMsg', errText(x, 'Couldn’t start it. Try again.')); return; }
        setTimeout(async () => { if (!ok()) return; await load(); say('r20RunMsg', 'Done. See Recent runs.'); }, 6000);
      }
    });
  } };

  // ======================================================================
  // #status: email records, spam stopped, phone alerts (Amr)
  // ======================================================================
  const DOMAIN = 'amrabdelgawad.site', SEND = 'mail.' + DOMAIN;
  async function dns(name, type){
    try {
      const r = await fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(name) + '&type=' + type, { headers:{ accept:'application/dns-json' } });
      const j = await r.json(); return (j.Answer || []).map(a => String(a.data || '').replace(/^"|"$/g, '').replace(/" "/g, ''));
    } catch (e) { return null; }
  }
  async function emailChecks(){
    const [dkim, spf, mx, dmarc, inbox] = await Promise.all([dns('resend._domainkey.' + SEND, 'TXT'), dns('send.' + SEND, 'TXT'), dns('send.' + SEND, 'MX'), dns('_dmarc.' + DOMAIN, 'TXT'), dns(DOMAIN, 'MX')]);
    const has = (l, re) => l == null ? null : l.some(x => re.test(x));
    return [
      ['Signature (DKIM)', has(dkim, /p=[A-Za-z0-9+/]{40,}/), 'Proves the portal’s emails really come from you. Record: resend._domainkey.' + SEND],
      ['Allowed sender (SPF)', has(spf, /v=spf1.*amazonses\.com/), 'Lets the email service send for ' + SEND + '. Record: send.' + SEND],
      ['Return path (MX)', has(mx, /amazonses\.com/), 'Where bounces go, so bad addresses are caught. Record: send.' + SEND],
      ['Policy (DMARC)', has(dmarc, /v=DMARC1/i), 'Tells inboxes what to do with fake emails using your name. Record: _dmarc.' + DOMAIN + (dmarc && dmarc[0] ? ' (' + (dmarc[0].match(/p=\w+/) || [''])[0] + ')' : '')],
      ['Your inbox (MX)', has(inbox, /\./), 'Where replies to amr@' + DOMAIN + ' arrive.' + (inbox && inbox.length ? ' (' + inbox.map(x => x.split(' ').pop().replace(/\.$/, '')).join(', ') + ')' : '')]
    ];
  }
  const st = V.status;
  if (st && !st.r20) {
    const open0 = st.open;
    V.status = Object.assign({}, st, { r20:true, async open(el, ok){
      await open0.call(this, el, ok);
      if (!ok() || !isOwner()) return;
      const body = el.querySelector('.px-body'); if (!body) return;
      const box = document.createElement('div'); box.id = 'r20Status';
      const after = body.querySelector('#r17More') || body.firstChild; body.insertBefore(box, after ? after.nextSibling : null);
      box.innerHTML = card('Email, spam and phone alerts', '', '<p class="p-loading">Checking…</p>');
      const [mail, spam, push] = await Promise.all([emailChecks(), safe(db().rpc('spam_summary')), safe(db().rpc('push_coverage'))]);
      if (!ok()) return;
      const allOk = mail.every(m => m[1] === true), unknown = mail.some(m => m[1] == null);
      const sp = spam.data || [], tot = sp.reduce((a, x) => a + +x.n, 0);
      const pc = push.data || [], on = pc.filter(x => +x.phones > 0);
      box.innerHTML = card('Email, spam and phone alerts', allOk ? pill('All good', 'ok') : unknown ? pill('Check', '') : pill('Problem', 'no'),
        '<h3 class="r20-h">Email delivery <small>sending from team@' + SEND + '</small></h3>' +
        mail.map(m => '<div class="p-row"><span><b>' + esc(m[0]) + '</b><br><small>' + esc(m[2]) + '</small></span>' + (m[1] === true ? pill('Found', 'ok') : m[1] === false ? pill('Missing', 'no') : pill('Couldn’t check', '')) + '</div>').join('') +
        (allOk ? '<p class="p-hint">All records are in place, so emails from the portal should land in inboxes, not spam.</p>' : '<p class="p-hint">A missing record is added where your domain is managed (GoDaddy), with the value the email service (Resend) shows for it.</p>') +
        '<h3 class="r20-h">Spam stopped on public forms <small>last 7 days</small></h3>' +
        (sp.length ? sp.map(x => '<div class="p-row"><span><b>' + esc({ apply:'Job form', buyers:'Buyers form', seller_upload:'Seller upload link' }[x.form] || x.form) + '</b> · ' + esc(x.reason) + '<br><small>Last ' + esc(when(x.last_at)) + '</small></span><b>' + num(x.n) + '</b></div>').join('') + '<p class="p-hint">' + plural(tot, 'send') + ' stopped. These never reached your lists.</p>'
          : '<p class="p-hint">Nothing stopped this week. The forms check a hidden field, how fast they were filled in, and repeats.</p>') +
        '<h3 class="r20-h">Phone alerts <small>' + on.length + ' of ' + pc.length + ' people</small></h3>' +
        (pc.length ? pc.map(x => '<div class="p-row"><span><b>' + esc(x.name || 'Someone') + '</b>' + (x.last_ok ? '<br><small>Last alert reached them ' + esc(when(x.last_ok)) + '</small>' : '') + '</span>' + (+x.phones ? pill(plural(+x.phones, 'phone'), 'ok') : pill('Off', 'plain')) + '</div>').join('') + '<p class="p-hint">People with alerts off see a reminder on their home page with the steps for their phone.</p>' : empty('No team members yet.')));
    } });
  }
})();
