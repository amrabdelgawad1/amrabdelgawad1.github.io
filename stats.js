// Visitor counting (GoatCounter, no cookies). Counts call-sample plays here;
// link clicks use data-goatcounter-click attributes, bookings are counted in booking.js.
(function () {
  "use strict";
  function count(path, title) {
    var gc = window.goatcounter;
    if (gc && gc.count) gc.count({ path: path, title: title, event: true });
  }
  window.countEvent = count;

  var played = {};
  document.addEventListener("play", function (e) {
    var el = e.target;
    if (!el || (el.tagName !== "AUDIO" && el.tagName !== "VIDEO")) return;
    var name = (el.getAttribute("src") || "").split("/").pop().split("?")[0];
    if (!name || played[name]) return; // once per recording per visit
    played[name] = true;
    count("play-" + name.replace(/\.[^.]+$/, ""), "Played " + name);
  }, true);
})();
