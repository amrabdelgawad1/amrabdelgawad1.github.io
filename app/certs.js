// Phase 3: Acquisitions course certificates (#certs for Amr; a "Your certificate" card on the Team home).
// Amr sees everyone with the course and where they stand against Lesson 20.1 (checkpoints 1 to 19, the final exam, the
// capstone, scored calls of 40+), then issues, renews or revokes. Each certificate has a public check link
// (/cert/?c=CODE) that shows only what's printed on it. See 20261102010000_certificates.sql.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const safe = p => p.then(r => r, () => ({}));
  const day = d => { if (!d) return ''; try { const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }); } catch (e) { return d; } };
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone:'Africa/Cairo' });
  const link = code => '/cert/?c=' + encodeURIComponent(code);
  const yes = (ok, label) => '<span class="p-pill ' + (ok ? 'is-ok' : 'is-plain') + '">' + esc(label) + '</span>';
  const errMsg = r => ((r && r.error && r.error.message) || '').replace(/^.*?:\s*/, '') || 'Couldn’t save. Try again.';

  // ---------- Team home card (anyone who has a certificate) ----------
  async function card(db, el, isCurrent){
    if (!el) return;
    const r = await safe(db.from('certificates').select('code,issued_on,valid_until').is('revoked_at', null).order('created_at', { ascending:false }).limit(1));
    if (!isCurrent() || !Array.isArray(r.data) || !r.data.length) return;
    const c = r.data[0], due = c.valid_until < today();
    el.innerHTML = '<section class="p-card" aria-labelledby="ctMineH"><div class="p-card-head"><h2 id="ctMineH">Your certificate</h2>' + yes(!due, due ? 'Renewal due' : 'Current') + '</div>' +
      '<p>Acquisitions Playbook, issued ' + esc(day(c.issued_on)) + '. ' + (due ? 'It was valid until ' + esc(day(c.valid_until)) + '. Send one new call scored 40 or more and take the law-changes quiz to renew it.' : 'Valid until ' + esc(day(c.valid_until)) + '.') + '</p>' +
      '<p><a class="p-btn" href="' + link(c.code) + '">Open your certificate</a></p></section>';
    el.hidden = false;
  }

  // ---------- Amr's page ----------
  function ready(p){
    const miss = [];
    if (p.checkpoints < 19) miss.push((19 - p.checkpoints) + ' checkpoint' + (19 - p.checkpoints === 1 ? '' : 's'));
    if (!p.final_exam) miss.push('the final exam');
    if (!p.capstone) miss.push('the capstone approval');
    if (p.calls_40 < 3) miss.push((3 - p.calls_40) + ' scored call' + (3 - p.calls_40 === 1 ? '' : 's') + ' of 40+');
    if (p.calls_40 >= 1 && !(p.best_call >= 45)) miss.push('one call of 45+');
    return miss;
  }

  function personRow(p){
    const miss = ready(p), has = !!p.cert_id, due = has && p.valid_until < today();
    return '<div class="p-card ct-person" data-user="' + esc(p.user_id) + '">' +
      '<div class="p-card-head"><h3>' + esc(p.name || 'Someone') + '</h3>' +
        (has ? yes(!due, due ? 'Renewal due' : 'Certified') : miss.length ? '<span class="p-pill is-plain">In progress</span>' : '<span class="p-pill is-ok">Ready</span>') + '</div>' +
      '<p class="ct-facts">' + yes(p.checkpoints >= 19, 'Checkpoints ' + p.checkpoints + ' of 19') + ' ' + yes(p.final_exam, p.final_exam ? 'Final exam passed' : 'Final exam not passed') + ' ' +
        yes(p.capstone, p.capstone ? 'Capstone approved' : 'Capstone not approved') + ' ' + yes(p.calls_40 >= 3 && p.best_call >= 45, 'Calls 40+: ' + p.calls_40 + (p.best_call ? ' (best ' + p.best_call + ')' : '')) + '</p>' +
      (has
        ? '<p>Certificate <b>' + esc(p.code) + '</b> as “' + esc(p.cert_name) + '”, issued ' + esc(day(p.issued_on)) + (p.renewed_on ? ', renewed ' + esc(day(p.renewed_on)) : '') + ', valid until ' + esc(day(p.valid_until)) + '.</p>' +
          '<div class="ct-btns"><a class="p-btn is-ghost" href="' + link(p.code) + '" target="_blank" rel="noopener">Open certificate</a><button type="button" class="p-btn" data-renew="' + p.cert_id + '">Renew for a year</button><button type="button" class="p-btn is-ghost" data-revoke-open="' + p.cert_id + '">Revoke…</button></div>' +
          '<div class="ct-revoke" hidden><label class="sc-f">Why (only you see this)<input type="text" maxlength="200" autocomplete="off" data-note></label><div class="ct-btns"><button type="button" class="p-btn is-danger" data-revoke="' + p.cert_id + '">Revoke this certificate</button><button type="button" class="p-btn is-ghost" data-revoke-cancel>Keep it</button></div><p class="p-empty">The check link will then say “revoked”. This can’t be undone, but you can issue a new one.</p></div>'
        : '<div class="ct-issue">' +
            (miss.length ? '<p class="p-empty">Not done yet: ' + esc(miss.join(', ')) + '. Lesson 20.1 asks for all of it.</p>' : '<p class="p-empty">Everything in Lesson 20.1 is done. Check the role-play scores in the Review center, then issue.</p>') +
            '<label class="sc-f">Name on the certificate<input type="text" maxlength="80" autocomplete="off" data-name value="' + esc(p.name || '') + '"></label>' +
            (miss.length ? '<label class="ct-anyway"><input type="checkbox" data-anyway> Issue anyway (for example, a real call scored outside the portal)</label>' : '') +
            '<div class="ct-btns"><button type="button" class="p-btn" data-issue="' + esc(p.user_id) + '"' + (miss.length ? ' disabled' : '') + '>Issue certificate</button></div></div>') +
      '<p class="p-empty" role="status" data-msg></p></div>';
  }

  async function open(el, isCurrent){
    const T = window.TalentsApp || {}, db = T.db;
    el.innerHTML = '<div class="p-wrap"><section class="p-hero"><div><span class="p-hero-bar"></span><span class="p-hero-kick">Learning</span><h1>Certificates</h1><p>The Acquisitions course certificate. The ticks are facts from the course; you decide when to issue. Each certificate has a public check link that shows only the name, course and dates.</p></div></section><div id="ctBody"><p class="p-loading">Loading…</p></div></div>';
    const [pp, all] = await Promise.all([safe(db.rpc('certificate_people')), safe(db.rpc('certificate_list'))]);
    if (!isCurrent()) return;
    if (pp.error || !Array.isArray(pp.data)) {
      $('ctBody').innerHTML = '<p class="p-card p-empty">' + (/Not allowed/.test((pp.error || {}).message || '') ? 'Certificates need your authenticator code. Sign in again with it to see this page.' : 'Couldn’t load certificates. Check your connection and try again.') + '</p>'; return;
    }
    const people = pp.data, list = Array.isArray(all.data) ? all.data : [];
    $('ctBody').innerHTML =
      (people.length ? people.map(personRow).join('') : '<p class="p-card p-empty">No one has the Acquisitions course yet. Turn it on in Invite and access.</p>') +
      (list.length ? '<details class="p-card"><summary>Every certificate issued (' + list.length + ')</summary><div class="p-tablewrap"><table class="p-table"><thead><tr><th scope="col">Name</th><th scope="col">Code</th><th scope="col">Issued</th><th scope="col">Status</th></tr></thead><tbody>' +
        list.map(c => '<tr><td>' + esc(c.name) + '</td><td><a href="' + link(c.code) + '" target="_blank" rel="noopener">' + esc(c.code) + '</a></td><td>' + esc(day(c.issued_on)) + '</td><td>' +
          (c.revoked_at ? '<span class="p-pill is-no">Revoked</span>' + (c.revoked_note ? '<br><small>' + esc(c.revoked_note) + '</small>' : '') : c.valid_until < today() ? '<span class="p-pill is-plain">Renewal due</span>' : '<span class="p-pill is-ok">Current to ' + esc(day(c.valid_until)) + '</span>') + '</td></tr>').join('') +
        '</tbody></table></div></details>' : '');

    const body = $('ctBody');
    body.addEventListener('change', e => {
      const a = e.target.closest('[data-anyway]'); if (!a) return;
      const b = a.closest('.ct-person').querySelector('[data-issue]'); if (b) b.disabled = !a.checked;
    });
    body.addEventListener('click', async e => {
      const row = e.target.closest('.ct-person'); if (!row) return;
      const msg = row.querySelector('[data-msg]');
      const iss = e.target.closest('[data-issue]');
      if (iss) {
        const name = row.querySelector('[data-name]').value.trim();
        if (name.length < 2) { msg.textContent = 'Type the name as it should appear.'; row.querySelector('[data-name]').focus(); return; }
        iss.disabled = true; msg.textContent = 'Issuing…';
        const r = await safe(db.rpc('certificate_issue', { p_user:iss.dataset.issue, p_name:name }));
        if (!isCurrent()) return;
        if (r.error || !r.data) { iss.disabled = false; msg.textContent = errMsg(r); return; }
        window.PortalHome.open('certs'); return;
      }
      const ren = e.target.closest('[data-renew]');
      if (ren) {
        ren.disabled = true; msg.textContent = 'Renewing…';
        const r = await safe(db.rpc('certificate_renew', { p_id:+ren.dataset.renew }));
        if (!isCurrent()) return;
        if (r.error) { ren.disabled = false; msg.textContent = errMsg(r); return; }
        window.PortalHome.open('certs'); return;
      }
      if (e.target.closest('[data-revoke-open]')) { const b = row.querySelector('.ct-revoke'); b.hidden = false; b.querySelector('[data-note]').focus(); return; }
      if (e.target.closest('[data-revoke-cancel]')) { row.querySelector('.ct-revoke').hidden = true; return; }
      const rev = e.target.closest('[data-revoke]');
      if (rev) {
        rev.disabled = true; msg.textContent = 'Revoking…';
        const r = await safe(db.rpc('certificate_revoke', { p_id:+rev.dataset.revoke, p_note:row.querySelector('[data-note]').value.trim() || null }));
        if (!isCurrent()) return;
        if (r.error) { rev.disabled = false; msg.textContent = errMsg(r); return; }
        window.PortalHome.open('certs');
      }
    });
  }

  window.Certificates = { open, card };
})();
