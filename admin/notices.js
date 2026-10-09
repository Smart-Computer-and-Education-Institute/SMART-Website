/* ============================================
   Notices — data + rendering
   Now backed by the server's /api/notices routes
   instead of a local array that reset on refresh.
   ============================================ */

let notices = [];
let noticeFilter = "all";

const noticeList = document.getElementById("noticeList");
const noticeEmpty = document.getElementById("noticeEmpty");
const noticeCount = document.getElementById("noticeCount");

// Pulls the current list from the server and re-renders.
// Called on page load, and again after every add/edit/delete/toggle
// so the screen always matches what's actually saved.
async function loadNotices() {
  const res = await fetch("/api/notices");
  notices = await res.json();
  renderNotices();
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderNotices() {
  const rows = notices.filter((n) => noticeFilter === "all" || n.status === noticeFilter);
  noticeList.innerHTML = "";
  noticeEmpty.style.display = rows.length ? "none" : "block";
  const publishedCount = notices.filter((n) => n.status === "published").length;
  noticeCount.textContent = `${notices.length} notices · ${publishedCount} published`;

  rows
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach((n) => {
      const item = document.createElement("div");
      item.className = "notice-item";
      item.innerHTML = `
        <div class="notice-item-main">
          <div class="notice-item-top">
            <h3>${escapeHtml(n.title)}</h3>
            ${
              n.status === "published"
                ? '<span class="badge badge-green">Published</span>'
                : '<span class="badge badge-amber">Draft</span>'
            }
            <span class="notice-item-date">${formatDate(n.date)}</span>
          </div>
          <p>${nl2br(escapeHtml(n.content))}</p>
        </div>
        <div class="notice-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="toggleNoticeStatus('${n.id}')">
            ${n.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit" onclick="openNoticeModal('${n.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn btn-danger-ghost btn-sm btn-icon-only" title="Delete" onclick="deleteNotice('${n.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      `;
      noticeList.appendChild(item);
    });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Filters ---------- */

document.getElementById("noticeChipRow").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll("#noticeChipRow .chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  noticeFilter = chip.getAttribute("data-filter");
  renderNotices();
});

/* ---------- Add / Edit modal ---------- */

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function openNoticeModal(id) {
  const form = document.getElementById("noticeForm");
  form.reset();
  clearNoticeErrors();

  if (id) {
    const n = notices.find((x) => x.id === id);
    document.getElementById("noticeModalTitle").textContent = "Edit notice";
    document.getElementById("noticeId").value = n.id;
    document.getElementById("noticeTitle").value = n.title;
    document.getElementById("noticeContent").value = n.content;
    document.getElementById("noticeDate").value = n.date;
    document.getElementById("noticeStatus").value = n.status;
  } else {
    document.getElementById("noticeModalTitle").textContent = "New notice";
    document.getElementById("noticeId").value = "";
    document.getElementById("noticeDate").value = todayIso();
  }

  openModal("noticeModalOverlay");
}

function clearNoticeErrors() {
  document.querySelectorAll("#noticeForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

document.getElementById("noticeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearNoticeErrors();

  const title = document.getElementById("noticeTitle").value.trim();
  const content = document.getElementById("noticeContent").value.trim();
  let valid = true;

  if (!title) { document.getElementById("field-notice-title").classList.add("has-error"); valid = false; }
  if (!content) { document.getElementById("field-notice-content").classList.add("has-error"); valid = false; }
  if (!valid) return;

  const id = document.getElementById("noticeId").value;
  const data = {
    title,
    content,
    date: document.getElementById("noticeDate").value || todayIso(),
    status: document.getElementById("noticeStatus").value,
  };

  if (id) {
    // Editing an existing notice
    await fetch(`/api/notices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    showToast("Notice updated");
  } else {
    // Creating a new one
    await fetch("/api/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    showToast("Notice posted");
  }

  closeModal("noticeModalOverlay");
  await loadNotices();
});

async function toggleNoticeStatus(id) {
  const res = await fetch(`/api/notices/${id}/toggle`, { method: "POST" });
  const updated = await res.json();
  showToast(updated.status === "published" ? "Notice published" : "Notice moved to draft");
  await loadNotices();
}

async function deleteNotice(id) {
  const n = notices.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${n.title}"? This can't be undone.`)) return;
  await fetch(`/api/notices/${id}`, { method: "DELETE" });
  showToast("Notice deleted", "danger");
  await loadNotices();
}

loadNotices();
