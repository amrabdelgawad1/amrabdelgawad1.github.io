/* Light / dark switch, shared by every page. Runs in <head> so a saved choice applies before the page paints.
   Light is the default; dark only when the visitor clicks the switch. */
(function(){
  var root = document.documentElement;
  function apply(){
    var dark = false;
    try { dark = localStorage.getItem("theme") === "dark"; } catch(e){}
    if (dark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    // phone status bar / installed-app title bar follows too
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta){
      if (!meta.dataset.light) meta.dataset.light = meta.content;
      meta.content = dark ? "#111315" : meta.dataset.light;
    }
  }
  apply();

  function sync(){
    var dark = root.getAttribute("data-theme") === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(function(b){
      b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      b.setAttribute("aria-pressed", dark ? "true" : "false");
    });
  }
  // another tab, or the /cash frame inside /app, follows the change
  window.addEventListener("storage", function(e){ if (e.key === "theme"){ apply(); sync(); } });

  document.addEventListener("DOMContentLoaded", function(){
    sync();
    document.addEventListener("click", function(e){
      var b = e.target.closest && e.target.closest("[data-theme-toggle]");
      if (!b) return;
      var dark = root.getAttribute("data-theme") !== "dark";
      try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch(err){}
      apply(); sync();
    });
  });
})();
