// Calculators inside the portal (Nov 2026): /land-calculator/ and /house-calculator/ get the portal's top bar
// (logo, Back, Apps, notifications, account) while the calculator itself stays exactly as it is.
// How: the page draws the bar, then shows itself again in a same-site frame below it. Inside that frame the page runs
// deal-gate.js as before, which downloads the private calculator file and writes it in, unchanged. The calculator's
// own guard still passes there (this site, its own path, window.DealGate), and the bar's styles can't reach into it.
//   CalcFrame({ file:'land-calculator-v2.html', page:'calc', name:'Land calculator' })
// No session, or no connection: it skips the bar and opens the calculator page on its own, as before.
window.CalcFrame = async function (o) {
  'use strict';
  // Round 23 (I1): the Deal CRM opens this way too (/app/deals/). Once the tool is written into the frame:
  // links to other pages leave the frame (so the portal never opens inside it), and errors go to Logs › Errors.
  function inside(){
    const here = location.pathname;
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target || a.hasAttribute('download')) return;
      let u; try { u = new URL(a.getAttribute('href'), location.href); } catch (er) { return; }
      if (u.origin === location.origin && u.pathname === here) return;   // same tool: stays in the frame
      if (/^(blob|data|javascript|mailto|tel|sms):/i.test(u.protocol)) return;
      a.target = '_top';
    }, true);
    const g = window.DealGate; if (!g || !g.db || !g.db.rpc) return;
    const seen = new Set();
    const send = (m, src, line, stack) => {
      m = String(m || '').slice(0, 500);
      if (!m || m === 'Script error.' || /ResizeObserver loop/.test(m) || seen.has(m) || seen.size >= 5) return;
      seen.add(m);
      g.db.rpc('log_app_error', { p_page: here, p_message: m, p_source: String(src || '').replace(location.origin, ''), p_line: Number(line) || null,
        p_stack: String(stack || '').slice(0, 2000), p_ua: navigator.userAgent.slice(0, 300) }).then(() => {}, () => {});
    };
    window.addEventListener('error', e => { if (e && e.message) send(e.message, e.filename, e.lineno, e.error && e.error.stack); });
    window.addEventListener('unhandledrejection', e => { const r = e && e.reason; send(r && r.message ? r.message : String(r), '', null, r && r.stack); });
  }
  const inFrame = (() => { try { return window.self !== window.top && window.top.location.origin === location.origin; } catch (e) { return false; } })();
  if (inFrame) {
    // The portal's frame: "Open my app" and other way-out links leave the frame instead of nesting the portal inside it
    document.querySelectorAll('#dgActs a').forEach(a => { a.target = '_top'; });
    await window.DealGateStart({ file: o.file });
    inside();
    return;
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
