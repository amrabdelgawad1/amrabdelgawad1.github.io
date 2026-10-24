// Deal tools gate: the land and house calculators and the Deal CRM (/app/deals).
// The tools' code is NOT on this website. It lives in the private Supabase storage folder
// "deal-tools" and downloads only for Amr (signed in with two-step) or people with
// "Deal tools" switched on in /app > Invite and access (with an optional end date and two-step).
window.DealGateStart = async function (opt) {
  const $ = id => document.getElementById(id), cfg = window.TRACKER_CONFIG || {};
  const say = (msg, showApp) => { $('dgMsg').textContent = msg; $('dgActs').hidden = !showApp; };
  if (!window.supabase || !/^https:\/\//.test(cfg.supabaseUrl || '')) { say('This page couldn’t connect. Check your internet and refresh.'); return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const { data: { session } } = await db.auth.getSession();
  if (!session) { say('Sign in to your app first, then open Deal tools from the menu.', true); return; }

  const st = await db.rpc('deal_access_status');
  if (st.error) {
    // Older database without the status check: fall back to the yes/no check
    const ok = await db.rpc('can_use_deal_tools');
    if (ok.error) { say(/not find|404|does not exist/i.test(ok.error.message || '') ? 'Deal tools aren’t set up yet.' : 'Couldn’t check your access. Refresh to try again.', true); return; }
    if (ok.data !== true) { say('Your account doesn’t have Deal tools yet. Ask Amr to switch them on for you.', true); return; }
  } else if (st.data === 'none') { say('Your account doesn’t have Deal tools yet. Ask Amr to switch them on for you.', true); return; }
  else if (st.data === 'expired') { say('Your Deal tools access has ended. Ask Amr if you need more time.', true); return; }
  else if (st.data === 'mfa') { return twoStep(db, () => window.DealGateStart(opt)); }

  let name = '';
  const own = await db.rpc('is_tracker_admin');
  if (own.data === true) name = 'Amr';
  else { const p = await db.rpc('my_profile'); const d = Array.isArray(p.data) ? p.data[0] : p.data; name = (d && d.name) || ''; }
  window.DealGate = { db, name: name || (session.user.email || '').split('@')[0], userId: session.user.id };
  if (!opt.file) { if (opt.onOpen) opt.onOpen(window.DealGate); return; }
  say('Opening…');
  const f = await db.storage.from('deal-tools').download(opt.file);
  if (f.error || !f.data) { say('Couldn’t load it. Refresh to try again.', true); return; }
  const html = await f.data.text();
  document.open(); document.write(html); document.close();

  // Two-step: ask for the code, or set up an authenticator app the first time
  async function twoStep(db, done) {
    const box = document.createElement('form'); box.className = 'dg2'; box.autocomplete = 'off';
    $('dgMsg').after(box); $('dgActs').hidden = true;
    const css = 'display:grid;gap:8px;margin:0 0 14px';
    const { data: f } = await db.auth.mfa.listFactors();
    let factor = ((f && f.totp) || []).find(x => x.status === 'verified');
    if (factor) {
      $('dgMsg').textContent = 'Enter the 6-digit code from your authenticator app.';
      box.innerHTML = `<div style="${css}"><input id="dgCode" inputmode="numeric" maxlength="6" placeholder="123456" style="font:600 20px monospace;letter-spacing:.3em;padding:10px;background:#0B0B0B;color:#F1EBE0;border:1px solid #3A332A"><button class="btn" type="submit">Continue</button><span id="dgErr" style="color:#E46BB0;font-size:13px"></span></div>`;
    } else {
      const en = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Deal tools ' + Date.now().toString(36) });
      if (en.error) { say('Two-step sign-in is required, but it couldn’t be set up here. Ask Amr for help.', true); box.remove(); return; }
      factor = { id: en.data.id };
      $('dgMsg').textContent = 'Deal tools need two-step sign-in. Scan this code with Google Authenticator, Authy or 1Password, then type the 6-digit code.';
      box.innerHTML = `<div style="${css}"><img src="${en.data.totp.qr_code}" alt="Authenticator QR code" style="width:180px;height:180px;background:#fff;padding:8px"><small style="color:#A39B8E;word-break:break-all">Can’t scan? Enter this key: ${en.data.totp.secret}</small><input id="dgCode" inputmode="numeric" maxlength="6" placeholder="123456" style="font:600 20px monospace;letter-spacing:.3em;padding:10px;background:#0B0B0B;color:#F1EBE0;border:1px solid #3A332A"><button class="btn" type="submit">Turn on two-step</button><span id="dgErr" style="color:#E46BB0;font-size:13px"></span></div>`;
    }
    $('dgCode').focus();
    box.addEventListener('submit', async e => {
      e.preventDefault();
      const code = $('dgCode').value.replace(/\D/g, '');
      if (code.length !== 6) { $('dgErr').textContent = 'Enter the 6 digits.'; return; }
      const r = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (r.error) { $('dgErr').textContent = 'That code didn’t work. Codes change every 30 seconds, so try the one showing now.'; return; }
      box.remove(); $('dgMsg').textContent = 'Checking your access…'; done();
    });
  }
};
