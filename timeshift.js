/* ============================================================
   Smart Computer & Education Institute — Timeshift Script
   Fetches /api/public/settings and computes real-time open status
   and populates the 7-day schedule chips (Sun–Sat).
   ============================================================ */

(function () {
  const DAYS_ORDER = [
    { key: "sunday", name: "Sunday" },
    { key: "monday", name: "Monday" },
    { key: "tuesday", name: "Tuesday" },
    { key: "wednesday", name: "Wednesday" },
    { key: "thursday", name: "Thursday" },
    { key: "friday", name: "Friday" },
    { key: "saturday", name: "Saturday" },
  ];

  const DEFAULT_HOURS = {
    sunday: { open: "06:00", close: "18:00", closed: false },
    monday: { open: "06:00", close: "18:00", closed: false },
    tuesday: { open: "06:00", close: "18:00", closed: false },
    wednesday: { open: "06:00", close: "18:00", closed: false },
    thursday: { open: "06:00", close: "18:00", closed: false },
    friday: { open: "06:00", close: "18:00", closed: false },
    saturday: { open: "06:00", close: "18:00", closed: true },
  };

  function formatTime12h(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return "";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;

    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    if (isNaN(hour)) return timeStr;

    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;

    return minute === "00" ? `${hour}:00 ${ampm}` : `${hour}:${minute} ${ampm}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderTimeshift(weeklyHours) {
    const hoursData = weeklyHours || DEFAULT_HOURS;
    const now = new Date();
    const currentDayIdx = now.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const todayKey = DAYS_ORDER[currentDayIdx].key;
    const todayName = DAYS_ORDER[currentDayIdx].name;
    const todayConfig = hoursData[todayKey] || DEFAULT_HOURS[todayKey] || { open: "06:00", close: "18:00", closed: false };

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentHHMM = String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");

    const isClosedToday = Boolean(todayConfig.closed);
    const isOpenNow = !isClosedToday && currentHHMM >= todayConfig.open && currentHHMM < todayConfig.close;

    // 1. Update Live Status Pill & Heading
    const statusPill = document.getElementById("liveStatusPill");
    const statusHeading = document.getElementById("statusHeading");
    const statusDetail = document.getElementById("statusDetail");
    const currentTimeText = document.getElementById("currentTimeText");

    if (statusPill) {
      statusPill.className = "live-status-pill " + (isOpenNow ? "is-open" : "is-closed");
      statusPill.innerHTML = `
        <span class="status-dot"></span>
        <span>${isOpenNow ? "Open Now" : "Closed Now"}</span>
      `;
    }

    if (currentTimeText) {
      const timeFormatted = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const dateFormatted = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      currentTimeText.textContent = `${dateFormatted} · ${timeFormatted}`;
    }

    if (statusHeading) {
      statusHeading.textContent = isOpenNow ? "We are currently open for classes & visits" : "We are currently closed";
    }

    if (statusDetail) {
      if (isClosedToday) {
        statusDetail.textContent = `Institute is closed today (${todayName}). Regular classes resume on the next operating day.`;
      } else if (isOpenNow) {
        statusDetail.textContent = `Today's hours (${todayName}): ${formatTime12h(todayConfig.open)} – ${formatTime12h(todayConfig.close)}.`;
      } else {
        statusDetail.textContent = `Today's schedule was ${formatTime12h(todayConfig.open)} – ${formatTime12h(todayConfig.close)}. Classes run Sunday through Friday.`;
      }
    }

    // 2. Populate #dayContainer with 7 day chips (Sun–Sat)
    const dayContainer = document.getElementById("dayContainer");
    if (dayContainer) {
      dayContainer.innerHTML = "";

      DAYS_ORDER.forEach(({ key, name }) => {
        const dayConfig = hoursData[key] || DEFAULT_HOURS[key] || { open: "06:00", close: "18:00", closed: false };
        const isToday = key === todayKey;
        const isClosed = Boolean(dayConfig.closed);

        const chip = document.createElement("div");
        chip.className = "day-chip" + (isToday ? " is-today" : "") + (isClosed ? " is-closed" : "");

        const hoursText = isClosed
          ? "Closed"
          : `${formatTime12h(dayConfig.open)} – ${formatTime12h(dayConfig.close)}`;

        chip.innerHTML = `
          <div class="day-header-wrap">
            <span class="day-name">${escapeHtml(name)}</span>
            ${isToday ? `<span class="today-tag">Today</span>` : ""}
          </div>
          <span class="day-hours">${escapeHtml(hoursText)}</span>
        `;

        dayContainer.appendChild(chip);
      });
    }
  }

  function initTimeshift() {
    fetch("/api/public/settings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load settings");
        return res.json();
      })
      .then((settings) => {
        renderTimeshift(settings.weeklyHours);
      })
      .catch(() => {
        // Fallback gracefully to default hours so page is never empty
        renderTimeshift(DEFAULT_HOURS);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTimeshift);
  } else {
    initTimeshift();
  }
})();
