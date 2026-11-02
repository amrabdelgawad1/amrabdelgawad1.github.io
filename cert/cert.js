// Public certificate check: /cert/?c=ACQ-XXXXX-XXXXX
// Asks the database for exactly one code (certificate_check, see 20261102010000_certificates.sql) and shows only what's
// printed on the certificate: name, course, dates, status. No sign-in. Without a code it shows a box to type one.
(function(){
  'use strict';
  const CFG = window.TRACKER_CONFIG || {};
  const main = document.getElementById('ctMain');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const day = d => { try { const [y, m, dd] = String(d).split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric', timeZone:'UTC' }); } catch (e) { return d; } };
  const CODE_RE = /^ACQ-[0-9A-F]{5}-[0-9A-F]{5}$/;
  const tidy = s => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^ACQ/, '').replace(/^(.{5})(.{5}).*$/, 'ACQ-$1-$2');

  function form(msg, value){
    main.innerHTML = '<section class="ct-card ct-ask"><span class="ct-bar" aria-hidden="true"></span><h1>Check a certificate</h1>' +
      '<p>Type the code printed on the certificate. It looks like <b>ACQ-1A2B3-C4D5E</b>.</p>' +
      (msg ? '<p class="ct-msg" role="alert">' + esc(msg) + '</p>' : '') +
      '<form id="ctForm" class="ct-form" novalidate><label for="ctCode">Certificate code</label><div class="ct-row"><input id="ctCode" name="c" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" value="' + esc(value || '') + '" placeholder="ACQ-XXXXX-XXXXX"><button type="submit" class="ct-btn">Check</button></div></form></section>';
    document.getElementById('ctForm').addEventListener('submit', e => {
      e.preventDefault();
      const c = tidy(document.getElementById('ctCode').value);
      if (!CODE_RE.test(c)) { form('That doesn’t look like a certificate code. Check it and try again.', document.getElementById('ctCode').value); return; }
      history.replaceState(null, '', '?c=' + encodeURIComponent(c)); check(c);
    });
  }

  function notFound(code){
    main.innerHTML = '<section class="ct-card ct-ask"><span class="ct-bar is-bad" aria-hidden="true"></span><h1>No certificate with this code</h1>' +
      '<p>We couldn’t find <b>' + esc(code) + '</b>. Check the code for typos. If it still doesn’t show, the certificate isn’t one Amr Abdelgawad issued.</p>' +
      '<p><a class="ct-btn is-ghost" href="./">Check another code</a></p></section>';
  }

  function revoked(r){
    main.innerHTML = '<section class="ct-card ct-ask"><span class="ct-bar is-bad" aria-hidden="true"></span><h1>This certificate was revoked</h1>' +
      '<p>Certificate <b>' + esc(r.code) + '</b> for the ' + esc(r.course) + ' course is no longer valid.</p>' +
      '<p><a class="ct-btn is-ghost" href="./">Check another code</a></p></section>';
  }

  function show(r){
    const due = r.status === 'renewal_due';
    const link = location.origin + '/cert/?c=' + encodeURIComponent(r.code);
    document.title = r.name + ' · ' + r.course + ' certificate';
    main.innerHTML =
      '<div class="ct-status ' + (due ? 'is-due' : 'is-ok') + '" role="status"><span class="ct-dot" aria-hidden="true"></span>' +
        (due ? '<span><b>Renewal due.</b> This certificate was valid until ' + esc(day(r.valid_until)) + ' and hasn’t been renewed yet.</span>'
             : '<span><b>Valid.</b> Issued by Amr Abdelgawad, current until ' + esc(day(r.valid_until)) + '.</span>') + '</div>' +
      '<article class="ct-cert" aria-label="Certificate">' +
        '<div class="ct-frame">' +
          '<p class="ct-kick">Course certificate</p>' +
          '<h1 class="ct-course">' + esc(r.course) + '</h1>' +
          '<p class="ct-lead">This certifies that</p>' +
          '<p class="ct-name">' + esc(r.name) + '</p>' +
          '<p class="ct-what">completed the Acquisitions Playbook course and passed its certification: every module checkpoint, the final exam, three recorded calls scored on the 50-point scorecard, and a capstone deal file.</p>' +
          '<dl class="ct-facts">' +
            '<div><dt>Issued</dt><dd>' + esc(day(r.issued_on)) + '</dd></div>' +
            (r.renewed_on ? '<div><dt>Renewed</dt><dd>' + esc(day(r.renewed_on)) + '</dd></div>' : '') +
            '<div><dt>Valid until</dt><dd>' + esc(day(r.valid_until)) + '</dd></div>' +
            '<div><dt>Certificate code</dt><dd class="ct-mono">' + esc(r.code) + '</dd></div>' +
          '</dl>' +
          '<div class="ct-sign"><span class="ct-sig">Amr Abdelgawad</span><span class="ct-sig-role">Instructor and reviewer</span></div>' +
          '<p class="ct-fine">A course certificate from Amr Abdelgawad. It isn’t a state license or an accredited credential, and it doesn’t replace a real estate license where a state requires one. Check it at ' + esc(link.replace(/^https?:\/\//, '')) + '</p>' +
        '</div>' +
      '</article>' +
      '<div class="ct-actions"><button type="button" class="ct-btn" id="ctPrint">Print or save as PDF</button><button type="button" class="ct-btn is-ghost" id="ctCopy">Copy the check link</button><span class="ct-copied" id="ctCopied" role="status"></span></div>' +
      '<p class="ct-note">Anyone with this link sees only what’s on the certificate. <a href="./">Check another code</a></p>';
    document.getElementById('ctPrint').addEventListener('click', () => window.print());
    document.getElementById('ctCopy').addEventListener('click', async () => {
      const out = document.getElementById('ctCopied');
      try { await navigator.clipboard.writeText(link); out.textContent = 'Link copied'; }
      catch (e) { out.textContent = link; }
    });
  }

  async function check(code){
    main.innerHTML = '<p class="ct-loading">Checking…</p>';
    let rows;
    try {
      const res = await fetch(CFG.supabaseUrl + '/rest/v1/rpc/certificate_check', {
        method:'POST', headers:{ 'Content-Type':'application/json', apikey:CFG.supabaseKey, Authorization:'Bearer ' + CFG.supabaseKey },
        body:JSON.stringify({ p_code:code }), cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer' });
      if (!res.ok) throw new Error('http ' + res.status);
      rows = await res.json();
    } catch (e) {
      main.innerHTML = '<section class="ct-card ct-ask"><span class="ct-bar is-bad" aria-hidden="true"></span><h1>Couldn’t check right now</h1><p>Check your connection and try again.</p><p><button type="button" class="ct-btn" id="ctRetry">Try again</button></p></section>';
      document.getElementById('ctRetry').addEventListener('click', () => check(code));
      return;
    }
    const r = Array.isArray(rows) && rows[0];
    if (!r) return notFound(code);
    if (r.status === 'revoked') return revoked(r);
    show(r);
  }

  const raw = new URLSearchParams(location.search).get('c');
  if (!raw) return form();
  const code = tidy(raw);
  if (!CODE_RE.test(code)) return form('That doesn’t look like a certificate code. Check it and try again.', raw);
  check(code);
})();
