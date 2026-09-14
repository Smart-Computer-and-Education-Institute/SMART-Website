/* ============================================
   Dashboard — pulls real numbers from /api/services,
   /api/gallery, /api/notices, /api/careers,
   /api/applications, /api/offers, and /api/popups.
   ============================================ */

const statServices = document.getElementById("statServices");
const statGallery = document.getElementById("statGallery");
const statNotices = document.getElementById("statNotices");
const statCareers = document.getElementById("statCareers");
const statApplications = document.getElementById("statApplications");
const statApplicationsBadge = document.getElementById("statApplicationsBadge");
const statInquiries = document.getElementById("statInquiries");
const statInquiriesBadge = document.getElementById("statInquiriesBadge");
const sidebarInquiryBadge = document.getElementById("sidebarInquiryBadge");
const statOffers = document.getElementById("statOffers");
const statPopups = document.getElementById("statPopups");

const recentInquiriesBody = document.getElementById("recentInquiriesBody");
const recentNoticesBody = document.getElementById("recentNoticesBody");
const recentApplicationsBody = document.getElementById("recentApplicationsBody");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// Turns "2026-07-29" into something like "5 days ago" / "Today" / "Tomorrow".
function timeAgo(iso) {
  if (!iso) return "recently";
  const dateOnly = iso.slice(0, 10);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  const then = new Date(dateOnly + "T00:00:00");
  if (isNaN(then.getTime())) return "recently";

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

function appIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
}

function inquiryIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
}

function isPopupActiveNow(p, now = new Date()) {
  if (!p || !p.enabled) return false;
  const sched = p.schedule || {};
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (sched.startDate && todayStr < sched.startDate) return false;
  if (sched.endDate && todayStr > sched.endDate) return false;

  if (Array.isArray(sched.daysOfWeek) && sched.daysOfWeek.length > 0) {
    if (!sched.daysOfWeek.includes(now.getDay())) return false;
  }

  if (sched.startTime || sched.endTime) {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${hours}:${minutes}`;

    if (sched.startTime && currentTimeStr < sched.startTime) return false;
    if (sched.endTime && currentTimeStr > sched.endTime) return false;
  }

  return true;
}

function renderRecentInquiries(inquiries) {
  if (!recentInquiriesBody) return;
  if (!inquiries || !inquiries.length) {
    recentInquiriesBody.innerHTML = `
      <div class="list-row">
        <div class="list-row-text"><span>No inquiries received yet.</span></div>
      </div>`;
    return;
  }

  const recent = inquiries
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

  recentInquiriesBody.innerHTML = recent
    .map((item) => {
      const isUnread = item.status === "unread";
      let badgeClass = "badge-amber";
      let statusLabel = "Unread";
      if (item.status === "read") {
        badgeClass = "badge";
        statusLabel = "Read";
      } else if (item.status === "replied") {
        badgeClass = "badge-green";
        statusLabel = "Replied";
      }

      return `
        <a href="inquiries.html" class="list-row" style="text-decoration:none; color:inherit;">
          <div class="list-row-icon">${inquiryIcon()}</div>
          <div class="list-row-text">
            <strong style="${isUnread ? 'font-weight:700;' : ''}">${escapeHtml(item.name || "Sender")}</strong>
            <span>${escapeHtml(item.subject || "No subject")} · ${timeAgo(item.createdAt).toLowerCase()}</span>
          </div>
          <span class="badge ${badgeClass}">${statusLabel}</span>
        </a>`;
    })
    .join("");
}

function renderRecentNotices(notices) {
  if (!recentNoticesBody) return;
  if (!notices || !notices.length) {
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

function renderRecentApplications(applications) {
  if (!recentApplicationsBody) return;
  if (!applications || !applications.length) {
    recentApplicationsBody.innerHTML = `
      <div class="list-row">
        <div class="list-row-text"><span>No job applications received yet.</span></div>
      </div>`;
    return;
  }

  const recent = applications
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

  recentApplicationsBody.innerHTML = recent
    .map((a) => {
      let badgeClass = "badge-amber";
      let statusLabel = "Pending";
      if (a.status === "reviewed") {
        badgeClass = "badge-blue";
        statusLabel = "Reviewed";
      } else if (a.status === "shortlisted") {
        badgeClass = "badge-green";
        statusLabel = "Shortlisted";
      } else if (a.status === "rejected") {
        badgeClass = "badge-red";
        statusLabel = "Rejected";
      }

      return `
        <div class="list-row">
          <div class="list-row-icon">${appIcon()}</div>
          <div class="list-row-text">
            <strong>${escapeHtml(a.fullName || "Applicant")}</strong>
            <span>${escapeHtml(a.jobTitle || "Position")} · ${timeAgo(a.createdAt).toLowerCase()}</span>
          </div>
          <span class="badge ${badgeClass}">${statusLabel}</span>
        </div>`;
    })
    .join("");
}

async function loadDashboard() {
  try {
    const [services, gallery, notices, careers, applications, inquiries, offers, popups] = await Promise.all([
      fetch("/api/services").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/gallery").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/notices").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/careers").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/applications").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/inquiries").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/offers").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/popups").then((r) => (r.ok ? r.json() : [])),
    ]);

    const now = new Date();

    const activeServices = Array.isArray(services) ? services.filter((s) => s.status === "active").length : 0;
    const publishedNotices = Array.isArray(notices) ? notices.filter((n) => n.status === "published").length : 0;
    const openCareers = Array.isArray(careers) ? careers.filter((c) => c.status === "open").length : 0;
    const pendingApps = Array.isArray(applications) ? applications.filter((a) => !a.status || a.status === "pending").length : 0;
    const unreadInquiries = Array.isArray(inquiries) ? inquiries.filter((i) => i.status === "unread").length : 0;
    const activeOffers = Array.isArray(offers) ? offers.filter((o) => o.status === "active").length : 0;
    const activePopups = Array.isArray(popups) ? popups.filter((p) => isPopupActiveNow(p, now)).length : 0;

    statServices.textContent = activeServices;
    statGallery.textContent = Array.isArray(gallery) ? gallery.length : 0;
    statNotices.textContent = publishedNotices;
    statCareers.textContent = openCareers;
    statApplications.textContent = pendingApps;
    if (statInquiries) statInquiries.textContent = Array.isArray(inquiries) ? inquiries.length : 0;
    statOffers.textContent = activeOffers;
    statPopups.textContent = activePopups;

    if (statApplicationsBadge) {
      if (pendingApps > 0) {
        statApplicationsBadge.textContent = `${pendingApps} pending`;
        statApplicationsBadge.style.display = "inline-flex";
      } else {
        statApplicationsBadge.style.display = "none";
      }
    }

    if (statInquiriesBadge) {
      if (unreadInquiries > 0) {
        statInquiriesBadge.textContent = `${unreadInquiries} new`;
        statInquiriesBadge.style.display = "inline-flex";
      } else {
        statInquiriesBadge.style.display = "none";
      }
    }

    if (sidebarInquiryBadge) {
      if (unreadInquiries > 0) {
        sidebarInquiryBadge.textContent = unreadInquiries;
        sidebarInquiryBadge.style.display = "inline-flex";
      } else {
        sidebarInquiryBadge.style.display = "none";
      }
    }

    renderRecentInquiries(Array.isArray(inquiries) ? inquiries : []);
    renderRecentNotices(Array.isArray(notices) ? notices : []);
    renderRecentApplications(Array.isArray(applications) ? applications : []);
  } catch (err) {
    console.error("Could not load dashboard data:", err);
    statServices.textContent = "—";
    statGallery.textContent = "—";
    statNotices.textContent = "—";
    statCareers.textContent = "—";
    statApplications.textContent = "—";
    if (statInquiries) statInquiries.textContent = "—";
    statOffers.textContent = "—";
    statPopups.textContent = "—";

    if (recentInquiriesBody) {
      recentInquiriesBody.innerHTML = `
        <div class="list-row">
          <div class="list-row-text"><span>Couldn't load recent inquiries.</span></div>
        </div>`;
    }
    if (recentNoticesBody) {
      recentNoticesBody.innerHTML = `
        <div class="list-row">
          <div class="list-row-text"><span>Couldn't load recent notices.</span></div>
        </div>`;
    }
    if (recentApplicationsBody) {
      recentApplicationsBody.innerHTML = `
        <div class="list-row">
          <div class="list-row-text"><span>Couldn't load recent applications.</span></div>
        </div>`;
    }
  }
}

loadDashboard();
