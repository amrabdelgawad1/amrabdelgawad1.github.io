(() => {
  "use strict";

  const API_BASE_URL = "https://amr-booking-api.vercel.app";

  // Mirrors config.js on the backend, used only to gray out obviously
  // closed days (weekends, past dates) without an API round trip. The
  // backend is still the source of truth — a day that looks open here
  // but has no real slots just shows "No open times" once clicked.
  // This checks the calendar's own date numbers, so it approximates the
  // host's business days regardless of which timezone is displayed.
  const FRONTEND_CONFIG = {
    workingDaysJs: [1, 2, 3, 4, 5], // JS Date.getDay(): 0=Sun...6=Sat
  };

  const TZ_STORAGE_KEY = "booking_tz";

  const POPULAR_TIMEZONES = [
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Africa/Cairo", "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Kolkata",
    "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "UTC",
  ];

  function getTimezoneList() {
    try {
      if (typeof Intl.supportedValuesOf === "function") {
        return Intl.supportedValuesOf("timeZone");
      }
    } catch {
      /* fall through to the static list below */
    }
    return [
      "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
      "Africa/Cairo", "Africa/Lagos", "Africa/Johannesburg", "Asia/Dubai", "Asia/Karachi",
      "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul",
      "Australia/Sydney", "Pacific/Auckland", "UTC",
    ];
  }

  // Some browsers' canonical zone list uses an older alias (e.g. "Asia/Calcutta"
  // instead of "Asia/Kolkata") even though the more common modern name still
  // works fine as an actual timeZone value — add a few so search finds them.
  const EXTRA_SEARCHABLE_ZONES = ["Asia/Kolkata", "UTC"];

  const ALL_TIMEZONES = [...new Set([...getTimezoneList(), ...EXTRA_SEARCHABLE_ZONES])];

  function friendlyZoneLabel(tz) {
    if (tz === "UTC") return "UTC";
    const city = tz.split("/").pop().replace(/_/g, " ");
    return `${city} time`;
  }

  function isValidTimezone(tz) {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  function detectTimezone() {
    try {
      const stored = localStorage.getItem(TZ_STORAGE_KEY);
      if (stored && isValidTimezone(stored)) return stored;
    } catch {
      /* localStorage unavailable — fall through */
    }
    try {
      const auto = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (auto) return auto;
    } catch {
      /* Intl unavailable — fall through */
    }
    return "America/New_York";
  }

  const state = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    selectedDate: null,
    selectedIso: null,
    lastSlots: null,
    tz: detectTimezone(),
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
    tzLabel: document.querySelector("[data-tz-label]"),
    tzToggle: document.querySelector("[data-tz-toggle]"),
    tzDropdown: document.querySelector("[data-tz-dropdown]"),
    tzSearch: document.querySelector("[data-tz-search]"),
    tzList: document.querySelector("[data-tz-list]"),
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

  function formatTimeInZone(iso, tz) {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
    });
  }

  async function fetchSlots(dateStr) {
    const res = await fetch(`${API_BASE_URL}/api/availability?date=${dateStr}`);
    if (!res.ok) throw new Error("availability_failed");
    return res.json(); // { date, timezone, slots: [{ iso, label }] }
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
    state.selectedIso = null;
    state.lastSlots = null;
    renderCalendar();

    els.timesLabel.textContent = formatDateLong(dateStr);
    els.timesList.innerHTML = '<p class="times-empty">Checking availability…</p>';

    try {
      const { slots } = await fetchSlots(dateStr);
      state.lastSlots = slots;
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

    slots.forEach((slot) => {
      const label = formatTimeInZone(slot.iso, state.tz);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "time-slot";
      if (slot.iso === state.selectedIso) btn.classList.add("is-selected");
      btn.innerHTML = `<span>${label}</span><span class="arrow">&#8594;</span>`;
      btn.addEventListener("click", () => selectTime(slot.iso, btn));
      els.timesList.appendChild(btn);
    });
  }

  function selectTime(iso, btnEl) {
    state.selectedIso = iso;
    document.querySelectorAll(".time-slot").forEach((b) => b.classList.remove("is-selected"));
    btnEl.classList.add("is-selected");
    setTimeout(() => goToStep("form"), 250);
  }

  function goToStep(name) {
    els.steps.forEach((el) => {
      el.dataset.active = el.dataset.step === name ? "true" : "false";
    });
    if (name === "form") {
      const timeLabel = formatTimeInZone(state.selectedIso, state.tz);
      els.recap.textContent = `${formatDateLong(state.selectedDate)} · ${timeLabel} (${friendlyZoneLabel(state.tz)})`;
    }
  }

  function showError(msg) {
    els.formError.textContent = msg;
    els.formError.hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * Timezone picker — auto-detects the visitor's timezone on load, but
   * lets them override it (e.g. booking on someone else's behalf, or the
   * auto-detected zone being wrong). The choice is remembered locally.
   * ------------------------------------------------------------------ */
  function setTimezone(tz) {
    state.tz = tz;
    try {
      localStorage.setItem(TZ_STORAGE_KEY, tz);
    } catch {
      /* localStorage unavailable — selection just won't persist */
    }
    if (els.tzLabel) els.tzLabel.textContent = friendlyZoneLabel(tz);
    if (state.lastSlots) renderTimes(state.lastSlots);
  }

  function renderTzList(filter) {
    const q = (filter || "").trim().toLowerCase();
    const source = q
      ? ALL_TIMEZONES.filter((tz) => tz.toLowerCase().replace(/_/g, " ").includes(q)).slice(0, 60)
      : POPULAR_TIMEZONES;

    els.tzList.innerHTML = "";

    if (!source.length) {
      const empty = document.createElement("p");
      empty.className = "tz-empty";
      empty.textContent = "No matching timezone.";
      els.tzList.appendChild(empty);
      return;
    }

    source.forEach((tz) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "tz-item";
      if (tz === state.tz) item.classList.add("is-selected");
      item.textContent = `${friendlyZoneLabel(tz)} — ${tz}`;
      item.addEventListener("click", () => {
        setTimezone(tz);
        closeTzDropdown();
      });
      els.tzList.appendChild(item);
    });
  }

  function openTzDropdown() {
    els.tzDropdown.hidden = false;
    els.tzToggle.setAttribute("aria-expanded", "true");
    els.tzSearch.value = "";
    renderTzList("");
    els.tzSearch.focus();
  }

  function closeTzDropdown() {
    els.tzDropdown.hidden = true;
    els.tzToggle.setAttribute("aria-expanded", "false");
  }

  if (els.tzToggle && els.tzDropdown) {
    if (els.tzLabel) els.tzLabel.textContent = friendlyZoneLabel(state.tz);

    els.tzToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (els.tzDropdown.hidden) openTzDropdown();
      else closeTzDropdown();
    });
    els.tzSearch.addEventListener("input", () => renderTzList(els.tzSearch.value));
    els.tzDropdown.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => closeTzDropdown());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeTzDropdown();
    });
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
    state.selectedIso = null;
    state.lastSlots = null;
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
      const result = await submitBooking({
        startIso: state.selectedIso,
        name,
        email,
        company,
        topic,
        displayTimezone: state.tz,
      });
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
})();
