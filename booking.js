(() => {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Fill this in once the backend is deployed — see
   * amr-booking-api/README.md step 7. Everything else in this file is
   * already wired to the real API; this is the only placeholder left.
   * ------------------------------------------------------------------ */
  const API_BASE_URL = "https://REPLACE-ME.vercel.app";

  // Mirrors config.js on the backend, used only to gray out obviously
  // closed days (weekends, past dates) without an API round trip. The
  // backend is still the source of truth — a day that looks open here
  // but has no real slots just shows "No open times" once clicked.
  const FRONTEND_CONFIG = {
    workingDaysJs: [1, 2, 3, 4, 5], // JS Date.getDay(): 0=Sun...6=Sat
    timezoneDisplayLabel: "Eastern time",
  };

  const state = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    selectedDate: null,
    selectedTime: null,
  };

  const els = {
    monthLabel: document.querySelector("[data-cal-month]"),
    daysGrid: document.querySelector("[data-cal-days]"),
    timesLabel: document.querySelector("[data-times-label]"),
    timesList: document.querySelector("[data-times-list]"),
    steps: document.querySelectorAll(".booking-step"),
    recap: document.querySelector("[data-recap]"),
    form: document.querySelector("[data-booking-form]"),
    formError: document.querySelector("[data-form-error]"),
    loadingText: document.querySelector("[data-loading-text]"),
    confirmDatetime: document.querySelector("[data-confirm-datetime]"),
    confirmMeet: document.querySelector("[data-confirm-meet]"),
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isPast(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dateStr + "T00:00:00") < today;
  }

  function formatDateLong(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  async function fetchSlots(dateStr) {
    const res = await fetch(`${API_BASE_URL}/api/availability?date=${dateStr}`);
    if (!res.ok) throw new Error("availability_failed");
    return res.json(); // { date, timezone, slots }
  }

  async function submitBooking(payload) {
    const res = await fetch(`${API_BASE_URL}/api/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || "booking_failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function renderCalendar() {
    const { viewYear, viewMonth } = state;
    els.monthLabel.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const firstDay = new Date(viewYear, viewMonth, 1);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    els.daysGrid.innerHTML = "";

    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement("span");
      empty.className = "cal-day is-empty";
      els.daysGrid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
      const jsDate = new Date(viewYear, viewMonth, day);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day";
      btn.textContent = day;

      const closedDay = !FRONTEND_CONFIG.workingDaysJs.includes(jsDate.getDay());
      const unavailable = isPast(dateStr) || closedDay;

      if (unavailable) {
        btn.classList.add("is-disabled");
        btn.disabled = true;
      } else {
        btn.addEventListener("click", () => selectDate(dateStr));
      }
      if (dateStr === todayStr) btn.classList.add("is-today");
      if (dateStr === state.selectedDate) btn.classList.add("is-selected");

      els.daysGrid.appendChild(btn);
    }
  }

  async function selectDate(dateStr) {
    state.selectedDate = dateStr;
    state.selectedTime = null;
    renderCalendar();

    els.timesLabel.textContent = formatDateLong(dateStr);
    els.timesList.innerHTML = '<p class="times-empty">Checking availability…</p>';

    try {
      const { slots } = await fetchSlots(dateStr);
      renderTimes(slots);
    } catch {
      els.timesList.innerHTML =
        '<p class="times-empty">We\'re having trouble checking availability right now. Please try again in a moment.</p>';
    }
  }

  function renderTimes(slots) {
    els.timesList.innerHTML = "";

    if (!slots.length) {
      els.timesList.innerHTML = '<p class="times-empty">No open times on this date. Try another day.</p>';
      return;
    }

    slots.forEach((time) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "time-slot";
      btn.innerHTML = `<span>${time}</span><span class="arrow">&#8594;</span>`;
      btn.addEventListener("click", () => selectTime(time, btn));
      els.timesList.appendChild(btn);
    });
  }

  function selectTime(time, btnEl) {
    state.selectedTime = time;
    document.querySelectorAll(".time-slot").forEach((b) => b.classList.remove("is-selected"));
    btnEl.classList.add("is-selected");
    setTimeout(() => goToStep("form"), 250);
  }

  function goToStep(name) {
    els.steps.forEach((el) => {
      el.dataset.active = el.dataset.step === name ? "true" : "false";
    });
    if (name === "form") {
      els.recap.textContent = `${formatDateLong(state.selectedDate)} · ${state.selectedTime} (${FRONTEND_CONFIG.timezoneDisplayLabel})`;
    }
  }

  function showError(msg) {
    els.formError.textContent = msg;
    els.formError.hidden = false;
  }

  document.querySelector("[data-cal-prev]").addEventListener("click", () => {
    state.viewMonth -= 1;
    if (state.viewMonth < 0) {
      state.viewMonth = 11;
      state.viewYear -= 1;
    }
    renderCalendar();
  });

  document.querySelector("[data-cal-next]").addEventListener("click", () => {
    state.viewMonth += 1;
    if (state.viewMonth > 11) {
      state.viewMonth = 0;
      state.viewYear += 1;
    }
    renderCalendar();
  });

  document.querySelector("[data-back-to-pick]").addEventListener("click", () => goToStep("pick"));

  document.querySelector("[data-restart]").addEventListener("click", () => {
    state.selectedDate = null;
    state.selectedTime = null;
    els.timesLabel.textContent = "Select a date";
    els.timesList.innerHTML = '<p class="times-empty">Choose an available date to see open times.</p>';
    els.form.reset();
    renderCalendar();
    goToStep("pick");
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(els.form);
    const name = (data.get("name") || "").trim();
    const email = (data.get("email") || "").trim();
    const company = (data.get("company") || "").trim();
    const topic = (data.get("topic") || "").trim();
    els.formError.hidden = true;

    if (!name) return showError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("Please enter a valid email address.");

    goToStep("loading");
    const loadingSteps = ["Checking availability…", "Booking your meeting…", "Creating your Google Meet…"];
    let stepIndex = 0;
    els.loadingText.textContent = loadingSteps[0];
    const cycle = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, loadingSteps.length - 1);
      els.loadingText.textContent = loadingSteps[stepIndex];
    }, 900);

    try {
      const result = await submitBooking({ date: state.selectedDate, time: state.selectedTime, name, email, company, topic });
      clearInterval(cycle);
      els.confirmDatetime.textContent = `${result.date} · ${result.startTime} – ${result.endTime}`;
      const meetBtn = document.querySelector('[data-join-meet]');
      const calBtn = document.querySelector('[data-add-calendar]');
      if (meetBtn && result.meetLink) meetBtn.href = result.meetLink;
      if (calBtn && result.eventLink) calBtn.href = result.eventLink;
      goToStep("confirm");
    } catch (err) {
      clearInterval(cycle);
      goToStep("form");
      if (err.status === 409) {
        showError("That time was just booked. Please choose another available time.");
      } else {
        showError(err.message === "booking_failed"
          ? "We couldn't complete the booking. Your calendar was not changed. Please try again."
          : err.message || "Something went wrong. Please try again.");
      }
    }
  });

  renderCalendar();

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (window.gsap && !reduced) {
    gsap.fromTo(
      ".booking-section .eyebrow, .booking-section .section-heading, .booking-section .section-lede",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power2.out" }
    );
    gsap.fromTo(
      ".booking-card",
      { y: 24, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.7, delay: 0.2, ease: "power3.out" }
    );
  } else {
    document.querySelectorAll(".booking-section [data-animate], .booking-card").forEach((el) => {
      el.style.opacity = 1;
      el.style.transform = "none";
    });
  }
})();
