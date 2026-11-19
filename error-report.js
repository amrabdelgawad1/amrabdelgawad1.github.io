// Error reports for the public pages (plan Round 23, P6 part 2): the main page booking form, buyers, the seller page,
// seller uploads, the job form and the certificate lookup. Signed-in pages already report through portal-shell.js.
// Sends only the error text, file, line, stack and browser to log_public_error() (Amr reads them in /app › Logs ›
// Errors, shown as "Visitor"). Never form contents. At most 3 per page load, each once; the database also limits
// the total. Browser extensions' errors and cross-origin "Script error." are skipped.
(function(){
  'use strict';
  if (window.__publicErrors) return; window.__publicErrors = true;
  const seen = new Set();
  function send(message, source, line, stack){
    const cfg = window.TRACKER_CONFIG || {};
    message = String(message || '').slice(0, 500);
    if (!cfg.supabaseUrl || !cfg.supabaseKey || !message || message === 'Script error.' || /ResizeObserver loop/.test(message)) return;
    if (/^(chrome|moz|safari)-extension:/.test(source || '') || seen.has(message) || seen.size >= 3) return;
    seen.add(message);
    try {
      fetch(cfg.supabaseUrl + '/rest/v1/rpc/log_public_error', { method:'POST', keepalive:true,
        headers:{ 'Content-Type':'application/json', apikey:cfg.supabaseKey, Authorization:'Bearer ' + cfg.supabaseKey },
        body:JSON.stringify({ p_page:location.pathname, p_message:message, p_source:String(source || '').replace(location.origin, '').slice(0, 300),
          p_line:Number(line) || null, p_stack:String(stack || '').slice(0, 2000), p_ua:navigator.userAgent.slice(0, 300) }) }).catch(() => {});
    } catch (e) {}
  }
  window.addEventListener('error', e => { if (e && e.message) send(e.message, e.filename, e.lineno, e.error && e.error.stack); });
  window.addEventListener('unhandledrejection', e => { const r = e && e.reason; send(r && r.message ? r.message : String(r), '', null, r && r.stack); });
})();
