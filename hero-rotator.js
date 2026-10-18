// Hero headline: "I Help US Businesses" + a phrase that changes every few seconds.
// All phrases sit in the same grid cell, so the box is always as tall as the longest
// one and the page never jumps. Words come in one after another (see .hl-word in
// style.css). With "reduce motion" on, words only fade and blur, without moving.
(function () {
  var box = document.querySelector("[data-rotator]");
  if (!box) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var phrases = Array.prototype.slice.call(box.querySelectorAll(".hl-phrase"));
  var current = 0;
  var SHOW_MS = reduced ? 3400 : 2800;

  // Wrap each word so it can animate on its own.
  phrases.forEach(function (phrase) {
    var words = phrase.textContent.trim().split(/\s+/);
    phrase.textContent = "";
    words.forEach(function (word, i) {
      var span = document.createElement("span");
      span.className = "hl-word";
      span.style.setProperty("--i", i);
      span.textContent = word;
      phrase.appendChild(span);
      if (i < words.length - 1) phrase.appendChild(document.createTextNode(" "));
    });
  });

  // Keep every phrase on one line: if the longest one is wider than the space,
  // shrink the phrase text just enough to fit (never larger than the headline).
  function fit() {
    box.style.fontSize = "";
    var room = box.getBoundingClientRect().width;
    var widest = 0;
    phrases.forEach(function (p) { widest = Math.max(widest, p.scrollWidth); });
    if (widest > room) {
      var size = parseFloat(getComputedStyle(box).fontSize);
      box.style.fontSize = Math.floor(size * room / widest) + "px";
    }
  }
  fit();
  window.addEventListener("resize", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  function next() {
    var out = phrases[current];
    current = (current + 1) % phrases.length;
    out.classList.remove("is-active");
    out.classList.add("is-leaving");
    setTimeout(function () { out.classList.remove("is-leaving"); }, 800);
    // Let the old words start leaving before the new ones arrive.
    setTimeout(function () { phrases[current].classList.add("is-active"); }, 220);
    setTimeout(next, SHOW_MS);
  }

  // Start once the headline's entrance animation has finished.
  setTimeout(next, SHOW_MS + 1200);
})();
