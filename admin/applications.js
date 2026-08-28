/* ============================================
   Job Applications — Admin Panel
   Backed by /api/applications routes.
   ============================================ */

let applications = [];
let activeFilter = "all";
let searchTerm = "";
let currentDetailId = null;

const tableBody = document.getElementById("appTableBody");
const emptyState = document.getElementById("appEmptyState");
const appCountEl = document.getElementById("appCount");
const chipRow = document.getElementById("appChipRow");

async function loadApplications() {
  const res = await fetch("/api/applications");
  if (!res.ok) {
    applications = [];
    renderApplications();
    return;
  }
  applications = await res.json();
  renderApplications();
}

function getStatusBadge(status) {
  switch (status) {
    case "reviewed":
      return '<span class="badge badge-blue">Reviewed</span>';
    case "shortlisted":
      return '<span class="badge badge-green">Shortlisted</span>';
    case "rejected":
      return '<span class="badge badge-red">Rejected</span>';
    case "pending":
    default:
      return '<span class="badge badge-amber">Pending</span>';
  }
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch (e) {
    return isoStr;
  }
}

function renderApplications() {
  const rows = applications.filter((a) => {
    const matchesFilter = activeFilter === "all" || a.status === activeFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (a.fullName && a.fullName.toLowerCase().includes(term)) ||
      (a.jobTitle && a.jobTitle.toLowerCase().includes(term)) ||
      (a.email && a.email.toLowerCase().includes(term)) ||
      (a.phone && a.phone.toLowerCase().includes(term)) ||
      (a.field && a.field.toLowerCase().includes(term));
    return matchesFilter && matchesSearch;
  });

  tableBody.innerHTML = "";
  emptyState.style.display = rows.length ? "none" : "block";

  if (appCountEl) {
    const total = applications.length;
    const pending = applications.filter((a) => a.status === "pending").length;
    appCountEl.textContent = `${total} application${total === 1 ? "" : "s"} · ${pending} pending`;
  }

  rows.forEach((a) => {
    const tr = document.createElement("tr");

    const cvButton = a.cvUrl
      ? `<a href="../${escapeHtml(a.cvUrl)}" target="_blank" class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;">
           <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
           CV
         </a>`
      : '<span style="color:var(--color-text-secondary);font-size:12px;">No file</span>';

    tr.innerHTML = `
      <td>
        <div class="cell-title" style="cursor:pointer;color:var(--color-primary);" onclick="openDetailModal('${a.id}')">${escapeHtml(a.fullName)}</div>
        <div class="cell-sub">${escapeHtml(a.currentPosition || "Applicant")}</div>
      </td>
      <td>
        <div class="cell-title">${escapeHtml(a.jobTitle)}</div>
      </td>
      <td>
        <div style="font-size:13px;color:var(--color-text-primary);">${escapeHtml(a.email)}</div>
        <div class="cell-sub">${escapeHtml(a.phone)} • ${escapeHtml(a.experience ? a.experience + " yrs exp" : "")}</div>
      </td>
      <td>${cvButton}</td>
      <td>${getStatusBadge(a.status)}</td>
      <td style="font-size:12.5px;color:var(--color-text-secondary);white-space:nowrap;">${formatDate(a.createdAt)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm btn-icon-only" title="View details" onclick="openDetailModal('${a.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-danger-ghost btn-sm btn-icon-only" title="Delete" onclick="deleteApplication('${a.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function nl2br(str) {
  return (str || "").replace(/\n/g, "<br>");
}

/* ---------- Filters & search ---------- */

if (chipRow) {
  chipRow.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.getAttribute("data-filter");
    renderApplications();
  });
}

const searchInput = document.getElementById("appSearchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderApplications();
  });
}

/* ---------- Detail Modal ---------- */

function openDetailModal(id) {
  const app = applications.find((x) => x.id === id);
  if (!app) return;

  currentDetailId = id;
  const body = document.getElementById("appDetailBody");

  const cvLink = app.cvUrl
    ? `<a href="../${escapeHtml(app.cvUrl)}" target="_blank" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px;">
         <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
         Download ${escapeHtml(app.cvOriginalName || "CV / Resume")}
       </a>`
    : '<span style="color:var(--color-text-secondary);">No file uploaded</span>';

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; background:var(--color-bg-secondary,#f8fafc); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--color-border);">
      <div>
        <span style="font-size:11px; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600;">Applicant Name</span>
        <div style="font-size:14px; font-weight:600; color:var(--color-text-primary); margin-top:2px;">${escapeHtml(app.fullName)}</div>
      </div>
      <div>
        <span style="font-size:11px; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600;">Target Position</span>
        <div style="font-size:14px; font-weight:600; color:var(--color-primary); margin-top:2px;">${escapeHtml(app.jobTitle)}</div>
      </div>
      <div>
        <span style="font-size:11px; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600;">Email Address</span>
        <div style="font-size:13px; color:var(--color-text-primary); margin-top:2px;"><a href="mailto:${escapeHtml(app.email)}" style="color:inherit;">${escapeHtml(app.email)}</a></div>
      </div>
      <div>
        <span style="font-size:11px; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600;">Phone Number</span>
        <div style="font-size:13px; color:var(--color-text-primary); margin-top:2px;"><a href="tel:${escapeHtml(app.phone)}" style="color:inherit;">${escapeHtml(app.phone)}</a></div>
      </div>
      <div>
        <span style="font-size:11px; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600;">Experience</span>
        <div style="font-size:13px; color:var(--color-text-primary); margin-top:2px;">${escapeHtml(app.experience || "0")} years</div>
      </div>
      <div>
        <span style="font-size:11px; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600;">Current Role</span>
        <div style="font-size:13px; color:var(--color-text-primary); margin-top:2px;">${escapeHtml(app.currentPosition || "Not specified")}</div>
      </div>
      <div>
        <span style="font-size:11px; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600;">Qualification</span>
        <div style="font-size:13px; color:var(--color-text-primary); margin-top:2px;">${escapeHtml(app.education || "Not specified")}</div>
      </div>
      <div>
        <span style="font-size:11px; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600;">Field of Study</span>
        <div style="font-size:13px; color:var(--color-text-primary); margin-top:2px;">${escapeHtml(app.field || "Not specified")}</div>
      </div>
    </div>

    ${
      app.skills
        ? `<div>
             <span style="font-size:12px; font-weight:600; color:var(--color-text-secondary); display:block; margin-bottom:4px;">Key Skills</span>
             <div style="font-size:13px; background:var(--color-bg-secondary,#f8fafc); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--color-border);">${escapeHtml(app.skills)}</div>
           </div>`
        : ""
    }

    ${
      app.coverLetter
        ? `<div>
             <span style="font-size:12px; font-weight:600; color:var(--color-text-secondary); display:block; margin-bottom:4px;">Cover Letter / Note</span>
             <div style="font-size:13px; line-height:1.6; max-height:180px; overflow-y:auto; background:var(--color-bg-secondary,#f8fafc); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--color-border);">${nl2br(escapeHtml(app.coverLetter))}</div>
           </div>`
        : ""
    }

    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:4px;">
      <div>
        <span style="font-size:12px; color:var(--color-text-secondary);">Applied on: <strong>${formatDate(app.createdAt)}</strong></span>
      </div>
      <div>${cvLink}</div>
    </div>
  `;

  document.getElementById("detailStatusSelect").value = app.status || "pending";
  openModal("appDetailModalOverlay");
}

document.getElementById("updateDetailStatusBtn")?.addEventListener("click", async () => {
  if (!currentDetailId) return;
  const newStatus = document.getElementById("detailStatusSelect").value;

  const res = await fetch(`/api/applications/${currentDetailId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || "Failed to update status", "danger");
    return;
  }

  showToast("Application status updated");
  closeModal("appDetailModalOverlay");
  await loadApplications();
});

async function deleteApplication(id) {
  const app = applications.find((x) => x.id === id);
  if (!confirmDelete(`Delete application from "${app ? app.fullName : "applicant"}"? This will also remove the uploaded CV.`)) return;

  const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
  if (res.ok || res.status === 204) {
    showToast("Application deleted", "danger");
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || "Delete failed", "danger");
  }
  await loadApplications();
}

/* ---------- Bulk Cleanup ---------- */

function openCleanupModal() {
  openModal("cleanupModalOverlay");
}

document.getElementById("confirmCleanupBtn")?.addEventListener("click", async () => {
  const days = parseInt(document.getElementById("cleanupDays").value, 10);
  const btn = document.getElementById("confirmCleanupBtn");
  btn.disabled = true;
  btn.textContent = "Cleaning up…";

  try {
    const res = await fetch("/api/applications/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || "Cleanup failed", "danger");
      return;
    }

    showToast(`Cleaned up ${data.deletedCount || 0} rejected application(s) and CV files`);
    closeModal("cleanupModalOverlay");
    await loadApplications();
  } catch (err) {
    showToast("Cleanup request failed", "danger");
  } finally {
    btn.disabled = false;
    btn.textContent = "Clean up now";
  }
});

loadApplications();
