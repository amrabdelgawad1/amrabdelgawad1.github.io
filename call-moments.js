/* Call Samples: timestamp and transcript buttons jump the card's audio to that moment and play it;
   the transcript drop-down highlights the line being spoken */
(function () {
  const toSeconds = (t) => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };

  document.querySelectorAll(".call-card button[data-seek]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const audio = btn.closest(".call-card").querySelector("audio");
      audio.currentTime = toSeconds(btn.dataset.seek);
      audio.play();
    });
  });

  document.querySelectorAll(".call-transcript").forEach((box) => {
    const audio = box.closest(".call-card").querySelector("audio");
    const list = box.querySelector(".transcript-lines");
    const lines = [...list.children].map((li) => ({ li, at: toSeconds(li.querySelector("button").dataset.seek) }));
    let current = null;
    audio.addEventListener("timeupdate", () => {
      let now = null;
      for (const line of lines) { if (line.at <= audio.currentTime) now = line; else break; }
      if (now === current) return;
      if (current) current.li.classList.remove("is-now");
      current = now;
      if (!now) return;
      now.li.classList.add("is-now");
      // Scroll only the transcript box, never the page
      list.scrollTop = now.li.offsetTop - list.offsetTop - list.clientHeight / 3;
    });
  });
})();
