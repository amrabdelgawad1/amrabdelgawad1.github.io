(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) {
    document.documentElement.classList.add("reduced-motion");
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ------------------------------------------------------------------ *
   * Lenis smooth scroll — wired into the GSAP ticker so ScrollTrigger
   * and Lenis agree on scroll position. Off entirely in reduced motion.
   * ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ------------------------------------------------------------------ *
   * Header state + scroll progress + in-page nav
   * ------------------------------------------------------------------ */
  const header = document.querySelector("[data-header]");
  ScrollTrigger.create({
    start: "top -80",
    onUpdate: (self) => header.classList.toggle("is-scrolled", self.scroll() > 80),
  });

  gsap.to("#scrollProgress", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -80 });
      else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    });
  });

  /* ------------------------------------------------------------------ *
   * CV preview modal — set up unconditionally (before the reduced-motion
   * early return) because the brief requires it stay fully functional
   * with reduced motion; only its open/close animation branches on that.
   * ------------------------------------------------------------------ */
  (function docModal() {
    const triggers = document.querySelectorAll("[data-doc-open]");
    const modal = document.querySelector("[data-doc-modal]");
    if (!triggers.length || !modal) return;

    const dialog = modal.querySelector(".cv-modal-dialog");
    const backdrop = modal.querySelector(".cv-modal-backdrop");
    const titleEl = modal.querySelector("[data-doc-title-text]");
    const downloadEl = modal.querySelector("[data-doc-download]");
    const frameEl = modal.querySelector("[data-doc-frame]");
    const imageEl = modal.querySelector("[data-doc-image]");
    let lastFocused = null;

    function openModal(trigger) {
      const { docType, docSrc, docTitle, docDownload } = trigger.dataset;

      titleEl.textContent = docTitle || "Document";
      downloadEl.href = docDownload || docSrc;

      if (docType === "image") {
        frameEl.hidden = true;
        frameEl.removeAttribute("src");
        imageEl.src = docSrc;
        imageEl.alt = docTitle || "";
        imageEl.hidden = false;
      } else {
        imageEl.hidden = true;
        imageEl.removeAttribute("src");
        frameEl.src = docSrc + (docSrc.includes("#") ? "" : "#toolbar=1");
        frameEl.hidden = false;
      }

      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.classList.add("modal-open");
      modal.querySelector(".cv-modal-close").focus();

      if (reduced) {
        gsap.set([backdrop, dialog], { opacity: 1, clearProps: "transform" });
      } else {
        gsap.set(backdrop, { opacity: 0 });
        gsap.set(dialog, { opacity: 0, y: 16, scale: 0.96 });
        gsap.to(backdrop, { opacity: 1, duration: 0.35, ease: "power2.out" });
        gsap.to(dialog, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" });
      }
    }

    function closeModal() {
      document.body.classList.remove("modal-open");
      const finish = () => {
        modal.hidden = true;
        frameEl.removeAttribute("src");
        imageEl.removeAttribute("src");
        lastFocused?.focus();
      };
      if (reduced) {
        finish();
      } else {
        gsap.to(dialog, { opacity: 0, y: 12, scale: 0.97, duration: 0.3, ease: "power2.in" });
        gsap.to(backdrop, { opacity: 0, duration: 0.3, ease: "power2.in", onComplete: finish });
      }
    }

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => openModal(trigger));
      trigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(trigger);
        }
      });
    });
    modal.querySelectorAll("[data-doc-close]").forEach((el) => el.addEventListener("click", closeModal));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  })();

  /* ------------------------------------------------------------------ *
   * Tool chip tooltips — hover works on its own via CSS; this just adds
   * tap-to-toggle so touch devices (no :hover) can reach the description.
   * ------------------------------------------------------------------ */
  (function toolChips() {
    const chips = document.querySelectorAll(".chip[data-tool-desc]");
    if (!chips.length) return;

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const wasActive = chip.classList.contains("is-active");
        chips.forEach((c) => c.classList.remove("is-active"));
        if (!wasActive) chip.classList.add("is-active");
      });
    });
    document.addEventListener("click", (e) => {
      if (![...chips].some((c) => c.contains(e.target))) {
        chips.forEach((c) => c.classList.remove("is-active"));
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") chips.forEach((c) => c.classList.remove("is-active"));
    });
  })();

  /* ------------------------------------------------------------------ *
   * Experience timeline: accordion. Only the highlighted role starts
   * expanded — the rest show role/company/duration and open on click,
   * so the section doesn't dump every bullet on screen at once.
   * ------------------------------------------------------------------ */
  (function timelineAccordion() {
    const cards = document.querySelectorAll("[data-timeline-card]");
    if (!cards.length) return;

    function setOpen(card, open, animate) {
      const btn = card.querySelector("[data-timeline-toggle]");
      const panel = card.querySelector("[data-timeline-panel]");
      btn.setAttribute("aria-expanded", String(open));

      if (!animate) {
        panel.classList.toggle("is-open", open);
        panel.style.height = open ? "auto" : "0px";
        return;
      }

      gsap.killTweensOf(panel);
      if (open) {
        panel.classList.add("is-open");
        const target = panel.scrollHeight;
        gsap.fromTo(
          panel,
          { height: 0 },
          {
            height: target,
            duration: 0.45,
            ease: "power2.out",
            onComplete: () => {
              panel.style.height = "auto";
            },
          }
        );
      } else {
        gsap.fromTo(
          panel,
          { height: panel.scrollHeight },
          {
            height: 0,
            duration: 0.35,
            ease: "power2.in",
            onComplete: () => panel.classList.remove("is-open"),
          }
        );
      }
    }

    cards.forEach((card) => {
      const defaultOpen = card.classList.contains("timeline-card--highlight");
      setOpen(card, defaultOpen, false);

      card.querySelector("[data-timeline-toggle]").addEventListener("click", () => {
        const isOpen = card.querySelector("[data-timeline-toggle]").getAttribute("aria-expanded") === "true";
        if (isOpen) {
          setOpen(card, false, !reduced);
        } else {
          cards.forEach((c) => {
            if (c !== card) setOpen(c, false, !reduced);
          });
          setOpen(card, true, !reduced);
        }
      });
    });
  })();

  /* ------------------------------------------------------------------ *
   * Reduced motion: land everything in its final, readable state.
   * ------------------------------------------------------------------ */
  if (reduced) {
    document.querySelectorAll("[data-counter]").forEach((el) => {
      const to = parseFloat(el.dataset.countTo);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      el.textContent = to.toFixed(decimals) + (el.dataset.suffix || "");
    });
    ScrollTrigger.refresh();
    return; // no scroll-tied animation below
  }

  /* ------------------------------------------------------------------ *
   * Hero: staged cinematic load-in.
   * Order: background -> eyebrow/pill -> headline -> subhead -> CTAs ->
   * hero card -> ambient background life (idle drift or cursor parallax).
   * ------------------------------------------------------------------ */
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  (function hero() {
    const heroBg = document.querySelector(".hero-bg");
    const headline = document.querySelector(".hero-headline");

    gsap.set(heroBg, { opacity: 0 });
    gsap.to(heroBg, { opacity: 1, duration: 0.9, ease: "power2.out" });

    gsap.from([".hero-copy > .eyebrow", ".availability-pill"], {
      y: 14,
      opacity: 0,
      duration: 0.55,
      stagger: 0.08,
      ease: "power2.out",
      delay: 0.2,
    });

    SplitText.create(headline, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 110,
          opacity: 0,
          duration: 0.85,
          stagger: 0.08,
          ease: "power3.out",
          delay: 0.4,
        });
      },
    });

    const tl = gsap.timeline({ delay: 0.95 });
    tl.from(".hero-sub", { y: 18, opacity: 0, duration: 0.6, ease: "power2.out" })
      .from(".hero-actions", { y: 18, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.4")
      .from(
        ".hero-card",
        { y: 26, opacity: 0, scale: 0.97, duration: 0.8, ease: "power3.out" },
        "-=0.35"
      )
      .from(
        ".hero-portrait",
        { y: 14, opacity: 0, scale: 0.92, duration: 0.7, ease: "power3.out" },
        "-=0.45"
      );

    gsap.from(".scroll-cue", { opacity: 0, duration: 1, delay: 1.8 });

    /* Scroll-tied parallax on the ambient glows — lighter amplitude on
       narrow viewports per the mobile "reduce decorative motion" rule. */
    const mm = gsap.matchMedia();
    mm.add(
      { desktop: "(min-width: 768px)", mobile: "(max-width: 767px)" },
      (ctx) => {
        const amp = ctx.conditions.desktop ? 1 : 0.4;
        gsap.to(".hero-glow-a", {
          yPercent: 30 * amp,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
        });
        gsap.to(".hero-glow-b", {
          yPercent: -20 * amp,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
        });
      }
    );

    if (canHover) {
      /* Desktop only: the background responds to the cursor instead of
         idling on its own — that response IS the "alive" feeling. */
      const glowAX = gsap.quickTo(".hero-glow-a", "x", { duration: 0.9, ease: "power3.out" });
      const glowAY = gsap.quickTo(".hero-glow-a", "y", { duration: 0.9, ease: "power3.out" });
      const glowBX = gsap.quickTo(".hero-glow-b", "x", { duration: 1.1, ease: "power3.out" });
      const glowBY = gsap.quickTo(".hero-glow-b", "y", { duration: 1.1, ease: "power3.out" });
      const cardX = gsap.quickTo(".hero-card", "x", { duration: 0.7, ease: "power3.out" });
      const cardY = gsap.quickTo(".hero-card", "y", { duration: 0.7, ease: "power3.out" });
      const portraitX = gsap.quickTo(".hero-portrait", "x", { duration: 0.6, ease: "power3.out" });
      const portraitY = gsap.quickTo(".hero-portrait", "y", { duration: 0.6, ease: "power3.out" });

      document.querySelector(".hero").addEventListener("mousemove", (e) => {
        const relX = e.clientX / window.innerWidth - 0.5;
        const relY = e.clientY / window.innerHeight - 0.5;
        glowAX(relX * 40);
        glowAY(relY * 28);
        glowBX(relX * -26);
        glowBY(relY * -18);
        cardX(relX * -10);
        cardY(relY * -8);
        /* Closest layer to the viewer moves the most — the depth cue. */
        portraitX(relX * -16);
        portraitY(relY * -13);
      });
    } else {
      /* No fine pointer (touch/mobile): a slow, subtle idle drift keeps
         the background from feeling static, at a barely-there amplitude. */
      gsap.to(".hero-glow-a", { x: 10, y: -8, duration: 7, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2 });
      gsap.to(".hero-glow-b", { x: -8, y: 6, duration: 8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.3 });
    }
  })();

  /* ------------------------------------------------------------------ *
   * Magnetic pull on primary/ghost buttons — desktop only, subtle.
   * ------------------------------------------------------------------ */
  if (canHover) {
    document.querySelectorAll(".btn-primary, .btn-ghost").forEach((btn) => {
      const qx = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3.out" });
      const qy = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3.out" });
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.25);
        qy((e.clientY - (r.top + r.height / 2)) * 0.25);
      });
      btn.addEventListener("mouseleave", () => {
        qx(0);
        qy(0);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Scroll cue fades out as soon as the visitor starts scrolling, and
   * stays gone — it did its job.
   * ------------------------------------------------------------------ */
  const scrollCue = document.querySelector("[data-scroll-cue]");
  if (scrollCue) {
    ScrollTrigger.create({
      trigger: ".hero",
      start: "top top+=40",
      onEnter: () => gsap.to(scrollCue, { opacity: 0, duration: 0.4, overwrite: true }),
      onLeaveBack: () => gsap.to(scrollCue, { opacity: 1, duration: 0.4, overwrite: true }),
    });
  }

  /* ------------------------------------------------------------------ *
   * Nav active-section indicator (scroll-spy)
   * ------------------------------------------------------------------ */
  document.querySelectorAll('.main-nav a[href^="#"]').forEach((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top 40%",
      end: "bottom 40%",
      onToggle: ({ isActive }) => link.classList.toggle("is-active", isActive),
    });
  });

  /* ------------------------------------------------------------------ *
   * Count-up numbers, once, on entry
   * ------------------------------------------------------------------ */
  document.querySelectorAll("[data-counter]").forEach((el) => {
    const to = parseFloat(el.dataset.countTo);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    const proxy = { v: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () =>
        gsap.to(proxy, {
          v: to,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => (el.textContent = proxy.v.toFixed(decimals) + suffix),
        }),
    });
  });

  /* ------------------------------------------------------------------ *
   * Generic fade-up / fade-in-scale entrances
   * ------------------------------------------------------------------ */
  document.querySelectorAll('[data-animate="fade-up"]').forEach((el) => {
    gsap.to(el, {
      y: 0,
      opacity: 1,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" },
    });
  });

  document.querySelectorAll('[data-animate="fade-in-scale"]').forEach((el) => {
    gsap.to(el, {
      scale: 1,
      opacity: 1,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" },
    });
  });

  /* ------------------------------------------------------------------ *
   * Batched grid reveals (badges, samples, skills, why-cards)
   * ------------------------------------------------------------------ */
  ["badge", "sample", "skillgroup", "why"].forEach((key) => {
    const items = gsap.utils.toArray(`[data-batch="${key}"] > *`);
    if (!items.length) return;
    ScrollTrigger.batch(items, {
      start: "top 88%",
      onEnter: (batch) =>
        gsap.to(batch, {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          overwrite: true,
        }),
      onLeaveBack: (batch) => gsap.to(batch, { y: 24, opacity: 0, duration: 0.4, overwrite: true }),
    });
  });

  /* ------------------------------------------------------------------ *
   * Verified Results: the leaderboard screenshot wipes into view left-to-
   * right (clip-path) with a slight Ken-Burns settle, instead of just
   * fading up like every other image on the page — this is the section's
   * one authored moment, not a technique reused everywhere.
   * ------------------------------------------------------------------ */
  (function proofReveal() {
    const shot = document.querySelector(".proof-shot--reveal");
    if (!shot) return;
    const img = shot.querySelector("img");

    gsap
      .timeline({
        scrollTrigger: { trigger: shot, start: "top 82%", toggleActions: "play none none reverse" },
      })
      .fromTo(shot, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.1, ease: "power3.inOut" })
      .fromTo(img, { scale: 1.12 }, { scale: 1, duration: 1.3, ease: "power2.out" }, "<");
  })();

  /* ------------------------------------------------------------------ *
   * Experience timeline: spine draws as you scroll, each card lifts in
   * ------------------------------------------------------------------ */
  (function timeline() {
    const wrap = document.querySelector("[data-timeline]");
    if (!wrap) return;

    const spine = wrap.querySelector("[data-timeline-spine]");

    // Pseudo-element custom properties aren't animatable, so the fill is a real
    // child div layered over the spine track instead.
    const fill = document.createElement("div");
    fill.style.cssText =
      "position:absolute;inset:0;background:linear-gradient(var(--accent),var(--accent2));transform:scaleY(0);transform-origin:top center;";
    spine.appendChild(fill);
    gsap.to(fill, {
      scaleY: 1,
      ease: "none",
      scrollTrigger: { trigger: wrap, start: "top 70%", end: "bottom 60%", scrub: 0.6 },
    });

    gsap.utils.toArray("[data-timeline-item]").forEach((item, i) => {
      gsap.to(item, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: item, start: "top 85%", toggleActions: "play none none reverse" },
      });
    });
  })();

  /* ------------------------------------------------------------------ *
   * Process: connecting line fills, steps lift in
   * ------------------------------------------------------------------ */
  (function process() {
    const track = document.querySelector("[data-process-track]");
    if (!track) return;
    const line = track.querySelector("[data-process-line]");

    gsap.utils.toArray("[data-process-step]").forEach((step) => {
      gsap.to(step, {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: step, start: "top 88%", toggleActions: "play none none reverse" },
      });
    });

    if (line) {
      const fill = document.createElement("div");
      fill.style.cssText =
        "position:absolute;inset:0;background:linear-gradient(90deg,var(--accent),var(--accent2));transform:scaleX(0);transform-origin:left center;";
      line.appendChild(fill);
      gsap.to(fill, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { trigger: track, start: "top 75%", end: "bottom 60%", scrub: 0.6 },
      });
    }
  })();

  /* ------------------------------------------------------------------ *
   * CV window: card lifts in, then the preview, then the footer/CTA —
   * a short staged reveal in the 600-900ms range.
   * ------------------------------------------------------------------ */
  (function cvWindowEntrance() {
    const win = document.querySelector(".cv-window");
    if (!win) return;
    const preview = win.querySelector(".cv-window-preview");
    const footer = win.querySelector(".cv-window-footer");

    gsap
      .timeline({
        scrollTrigger: { trigger: win, start: "top 85%", toggleActions: "play none none reverse" },
      })
      .to(win, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" })
      .from(preview, { opacity: 0, y: 10, duration: 0.35, ease: "power2.out" }, "-=0.2")
      .from(footer, { opacity: 0, y: 8, duration: 0.3, ease: "power2.out" }, "-=0.15");
  })();

  /* ------------------------------------------------------------------ *
   * Chips: tiny stagger on their parent group entering
   * ------------------------------------------------------------------ */
  gsap.utils.toArray(".skill-group").forEach((group) => {
    const chips = group.querySelectorAll(".chip");
    gsap.from(chips, {
      opacity: 0,
      y: 8,
      duration: 0.4,
      stagger: 0.02,
      ease: "power1.out",
      scrollTrigger: { trigger: group, start: "top 82%" },
    });
  });

  /* ------------------------------------------------------------------ *
   * Nav toggle (mobile) — kept simple, no motion budget spent here
   * ------------------------------------------------------------------ */
  const navToggle = document.querySelector("[data-nav-toggle]");
  if (navToggle) {
    const closeNav = () => {
      document.body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    };
    navToggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", closeNav));
  }

  /* ------------------------------------------------------------------ *
   * Refresh after fonts + full load so offsets are measured correctly
   * ------------------------------------------------------------------ */
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
