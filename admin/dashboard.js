/* ============================================
   Dashboard — pulls real numbers from the same
   /api/services, /api/gallery, /api/notices routes
   the Services/Gallery/Notices admin pages already use.
   ============================================ */

const statServices = document.getElementById("statServices");
const statGallery = document.getElementById("statGallery");
const statNotices = document.getElementById("statNotices");
const recentNoticesBody = document.getElementById("recentNoticesBody");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Turns "2026-07-29" into something like "5 days ago" / "Today" / "Tomorrow".
function timeAgo(iso) {
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  const then = new Date(iso + "T00:00:00");
  const days = Math.round((today - then) / 86400000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1) return `${days} days ago`;
  if (days === -1) return "Tomorrow";
  return `In ${Math.abs(days)} days`;
}

function noticeIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
}

function renderRecentNotices(notices) {
  if (!notices.length) {
    recentNoticesBody.innerHTML = `
      <div class="list-row">
        <div class="list-row-text"><span>No notices posted yet.</span></div>
      </div>`;
    return;
  }

  const recent = notices
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3);

  recentNoticesBody.innerHTML = recent
    .map(
      (n) => `
      <div class="list-row">
        <div class="list-row-icon">${noticeIcon()}</div>
        <div class="list-row-text">
          <strong>${escapeHtml(n.title)}</strong>
          <span>${n.status === "draft" ? "Draft · not visible to students" : "Posted " + timeAgo(n.date).toLowerCase()}</span>
        </div>
        <span class="badge ${n.status === "published" ? "badge-green" : "badge-amber"}">
          ${n.status === "published" ? "Published" : "Draft"}
        </span>
      </div>`
    )
    .join("");
}

async function loadDashboard() {
  try {
    const [services, gallery, notices] = await Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/gallery").then((r) => r.json()),
      fetch("/api/notices").then((r) => r.json()),
    ]);

    const activeServices = services.filter((s) => s.status === "active").length;
    const publishedNotices = notices.filter((n) => n.status === "published").length;

    statServices.textContent = activeServices;
    statGallery.textContent = gallery.length;
    statNotices.textContent = publishedNotices;

    renderRecentNotices(notices);
  } catch (err) {
    console.error("Could not load dashboard data:", err);
    statServices.textContent = "—";
    statGallery.textContent = "—";
    statNotices.textContent = "—";
    recentNoticesBody.innerHTML = `
      <div class="list-row">
        <div class="list-row-text"><span>Couldn't load recent notices.</span></div>
      </div>`;
  }
}

loadDashboard();
