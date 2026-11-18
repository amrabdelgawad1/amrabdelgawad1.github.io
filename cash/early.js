// Inside the app: hide this page's own header and tabs. On the live site, /cash now opens the app.
// Loaded first in <head> so the redirect happens before any styles or scripts download.
(function(){
  // Inside a frame counts as embedded too, so a reload that lost ?embed=1 never loads the whole app inside itself
  var framed = false; try { framed = window.self !== window.top; } catch(e) { framed = true; }
  var embed = framed || /(^|[?&])embed=1/.test(location.search);
  if (embed) document.documentElement.classList.add('embed');
  else if (location.hostname === 'amrabdelgawad.site') location.replace('../app/' + (location.hash || '#overview'));
})();
