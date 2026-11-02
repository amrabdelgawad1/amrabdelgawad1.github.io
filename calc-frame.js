// Calculators inside the portal (Nov 2026): /land-calculator/ and /house-calculator/ get the portal's top bar
// (logo, Back, Apps, notifications, account) while the calculator itself stays exactly as it is.
// How: the page draws the bar, then shows itself again in a same-site frame below it. Inside that frame the page runs
// deal-gate.js as before, which downloads the private calculator file and writes it in, unchanged. The calculator's
// own guard still passes there (this site, its own path, window.DealGate), and the bar's styles can't reach into it.
//   CalcFrame({ file:'land-calculator-v2.html', page:'calc', name:'Land calculator' })
// No session, or no connection: it skips the bar and opens the calculator page on its own, as before.
window.CalcFrame = async function (o) {
  'use strict';
  const inFrame = (() => { try { return window.self !== window.top && window.top.location.origin === location.origin; } catch (e) { return false; } })();
  if (inFrame) {
    // The portal's frame: "Open my app" and other way-out links leave the frame instead of nesting the portal inside it
    document.querySelectorAll('#dgActs a').forEach(a => { a.target = '_top'; });
    return window.DealGateStart({ file: o.file });
  }
  const cfg = window.TRACKER_CONFIG || {};
  const alone = () => window.DealGateStart({ file: o.file });
  if (!window.supabase || !window.PortalShell || !/^https:\/\//.test(cfg.supabaseUrl || '')) return alone();
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  let session = null;
  try { session = (await db.auth.getSession()).data.session; } catch (e) {}
  if (!session) return alone();   // the gate says to sign in first

  document.documentElement.classList.add('cf-on');
  const header = document.createElement('header'); header.className = 'p-top cf-top';
  const frame = document.createElement('iframe');
  frame.className = 'cf-frame'; frame.title = o.name; frame.src = location.pathname + location.search + location.hash;
  document.body.replaceChildren(header, frame);
  window.PortalShell.start({ db, header, page: o.page, name: o.name });
  // A tap inside the calculator never reaches this page, so close an open Apps menu or panel when the frame takes focus
  window.addEventListener('blur', () => { setTimeout(() => { if (document.activeElement === frame) document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, 0); });
  // The page title follows the calculator once it has loaded
  frame.addEventListener('load', () => { try { if (frame.contentDocument && frame.contentDocument.title) document.title = frame.contentDocument.title; } catch (e) {} });
};
