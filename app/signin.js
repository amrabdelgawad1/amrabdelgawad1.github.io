// Sign-in page: the live Cairo and New York times on the brand panel. Nothing else.
(function(){
  'use strict';
  var cai = document.getElementById('siCai'), nyc = document.getElementById('siNyc');
  if (!cai || !nyc || !window.Intl) return;
  var lang = document.documentElement.lang === 'ar' ? 'ar-EG' : 'en-US';
  function fmt(tz){ try { return new Intl.DateTimeFormat(lang, { hour:'numeric', minute:'2-digit', timeZone:tz }).format(new Date()); } catch(e) { return ''; } }
  function tick(){
    cai.textContent = fmt('Africa/Cairo');
    nyc.textContent = fmt('America/New_York');
  }
  tick();
  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) tick(); });
})();
