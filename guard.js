// Stops another website from showing these pages inside a hidden frame to trick clicks.
// The app's own frame (/app showing /cash) is the same site, so it still works.
(function(){
  if (window.top === window.self) return;
  try { if (window.top.location.origin === location.origin) return; } catch (e) {}
  document.documentElement.style.display = 'none';
})();
