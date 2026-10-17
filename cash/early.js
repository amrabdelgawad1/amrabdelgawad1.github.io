// Inside the app: hide this page's own header and tabs. On the live site, /cash now opens the app.
// Loaded first in <head> so the redirect happens before any styles or scripts download.
(function(){
  var embed = /(^|[?&])embed=1/.test(location.search);
  if (embed) document.documentElement.classList.add('embed');
  else if (location.hostname === 'amrabdelgawad.site') location.replace('../app/' + (location.hash || '#overview'));
})();
