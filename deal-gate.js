// Deal tools gate: the land and house calculators and /app/deals.
// The calculators' code is NOT on this website. It lives in the private Supabase storage folder
// "deal-tools" and downloads only for Amr (signed in with two-step) or people with
// "Deal tools" switched on in /app > Invite and access. Sign-in itself happens in /app.
window.DealGateStart = async function (opt) {
  const $ = id => document.getElementById(id), cfg = window.TRACKER_CONFIG || {};
  const say = (msg, showApp) => { $('dgMsg').textContent = msg; $('dgActs').hidden = !showApp; };
  if (!window.supabase || !/^https:\/\//.test(cfg.supabaseUrl || '')) { say('This page couldn’t connect. Check your internet and refresh.'); return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const { data: { session } } = await db.auth.getSession();
  if (!session) { say('Sign in to your app first, then open Deal tools from the menu.', true); return; }
  const aal = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.data && aal.data.currentLevel === 'aal1' && aal.data.nextLevel === 'aal2') { say('Finish your two-step sign-in in the app first.', true); return; }
  const ok = await db.rpc('can_use_deal_tools');
  if (ok.error) { say(/can_use_deal_tools|not find|404/i.test(ok.error.message || '') ? 'Deal tools aren’t set up yet.' : 'Couldn’t check your access. Refresh to try again.', true); return; }
  if (ok.data !== true) { say('Your account doesn’t have Deal tools yet. Ask Amr to switch them on for you.', true); return; }
  let name = '';
  const own = await db.rpc('is_tracker_admin');
  if (own.data === true) name = 'Amr';
  else { const p = await db.rpc('my_profile'); const d = Array.isArray(p.data) ? p.data[0] : p.data; name = (d && d.name) || ''; }
  window.DealGate = { db, name: name || (session.user.email || '').split('@')[0], userId: session.user.id };
  if (!opt.file) { if (opt.onOpen) opt.onOpen(window.DealGate); return; }
  say('Opening…');
  const f = await db.storage.from('deal-tools').download(opt.file);
  if (f.error || !f.data) { say('Couldn’t load the calculator. Refresh to try again.', true); return; }
  const html = await f.data.text();
  document.open(); document.write(html); document.close();
};
