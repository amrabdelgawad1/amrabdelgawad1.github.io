// Visitor counting, saved in our own database (no cookies).
// Counts the page view, call-sample plays, links with data-count, and bookings (booking.js calls countEvent).
// Devices where Amr signed in to /app are skipped (localStorage "nocount"), as is localhost.
(function () {
  "use strict";
  var cfg = window.TRACKER_CONFIG || {};
  var off = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  try { if (localStorage.getItem("nocount") === "1") off = true; } catch (e) {}
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // A random id for this device that changes every day, so one person counts once a day
  var today = new Date().toISOString().slice(0, 10);
  var visitor = (store("cnt-id") || "").split("|");
  if (visitor[0] !== today || !/^[a-z0-9]{8,32}$/.test(visitor[1] || "")) {
    visitor = [today, Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)];
    store("cnt-id", visitor.join("|"));
  }
  var id = visitor[1];

  var ref = "";
  try { var h = new URL(document.referrer).hostname.replace(/^www\./, ""); if (h && h !== location.hostname) ref = h; } catch (e) {}
  var device = window.matchMedia && matchMedia("(pointer: coarse)").matches ? "phone" : "desktop";
  var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}

  // Country: asked once a day per device, remembered on the device; unknown if the lookup fails
  var country = null;
  var ready = new Promise(function (done) {
    var saved = (store("cnt-country") || "").split("|");
    if (saved[0] === today) { country = saved[1] || null; return done(); }
    if (off) return done();
    var timer = setTimeout(done, 2500);
    fetch("https://api.country.is/").then(function (r) { return r.json(); }).then(function (d) {
      country = /^[A-Z]{2}$/.test(d && d.country) ? d.country : null;
      store("cnt-country", today + "|" + (country || ""));
    }).catch(function () {}).then(function () { clearTimeout(timer); done(); });
  });

  function send(kind, path, title) {
    if (off || !cfg.supabaseUrl) return;
    ready.then(function () {
      fetch(cfg.supabaseUrl + "/rest/v1/rpc/log_visit", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", apikey: cfg.supabaseKey },
        body: JSON.stringify({ p_visitor: id, p_kind: kind, p_path: path, p_title: title || "", p_source: ref, p_country: country, p_tz: tz, p_device: device })
      }).catch(function () {});
    });
  }
  window.countEvent = function (path, title) { send("event", path, title); };

  var me = document.currentScript; // the not-found page names itself with data-page="404"
  var page = (me && me.getAttribute("data-page")) || location.pathname.replace(/index\.html$/, "");
  if (!/[?&]embed=1/.test(location.search)) send("view", page, document.title);

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-count]");
    if (a) send("event", a.getAttribute("data-count"), a.getAttribute("data-count-title"));
  }, true);

  var played = {};
  document.addEventListener("play", function (e) {
    var el = e.target;
    if (!el || (el.tagName !== "AUDIO" && el.tagName !== "VIDEO")) return;
    var name = (el.getAttribute("src") || "").split("/").pop().split("?")[0];
    if (!name || played[name]) return; // once per recording per visit
    played[name] = true;
    send("event", "play-" + name.replace(/\.[^.]+$/, ""), "Played " + name);
  }, true);
})();
