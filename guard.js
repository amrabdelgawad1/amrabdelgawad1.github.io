// Stops another website from showing these pages inside a hidden frame to trick clicks.
// The app's own frame (/app showing /cash) is the same site, so it still works.
(function(){
  if (window.top === window.self) return;
  try {
    if (window.top.location.origin === location.origin) {
      // Round 23: inside a tool's frame (Deal CRM, calculators) a link to another page breaks out to the full window,
      // so the portal never shows inside the frame
      var t = window.top.document.documentElement;
      if (t && t.classList.contains('cf-on') && window.top.location.pathname !== location.pathname) window.top.location.replace(location.href);
      return;
    }
  } catch (e) {}
  document.documentElement.style.display = 'none';
})();
