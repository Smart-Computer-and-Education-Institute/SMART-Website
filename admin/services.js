/* ============================================
   Services — data + rendering
   (Formerly "Courses" — renamed for consistency with the rest of
   the site.) Backed by the server's /api/services routes instead of
   a local array that reset on refresh.
   ============================================ */

let services = [];
let categories = []; // [{id, name}, ...] from /api/categories
let activeFilter = "all";
let searchTerm = "";

const tableBody = document.getElementById("serviceTableBody");
const emptyState = document.getElementById("emptyState");
const serviceCountEl = document.getElementById("serviceCount");
const chipRow = document.getElementById("chipRow");
const categorySelect = document.getElementById("serviceCategory");

// Pulls the category list from the server and uses it to build both
// the filter chips above the table and the "Category" dropdown in the
// add/edit form — so adding or removing a category from Settings shows
// up here automatically with nothing else to update.
async function loadCategories() {
  const res = await fetch("/api/categories");
  categories = await res.json();

  // Rebuild the chip row, keeping the "All" chip and whichever filter
  // was already active (if it still exists).
  chipRow.querySelectorAll(".chip:not([data-filter='all'])").forEach((c) => c.remove());
  categories.forEach((cat) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (activeFilter === cat.name ? " active" : "");
    chip.setAttribute("data-filter", cat.name);
    chip.textContent = cat.name;
    chipRow.appendChild(chip);
  });

  // Rebuild the <select> options, preserving whatever was chosen if it
  // still exists (falls back to the first category otherwise).
  const previousValue = categorySelect.value;
  categorySelect.innerHTML = "";
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });
  if (categories.some((c) => c.name === previousValue)) {
    categorySelect.value = previousValue;
  }
}

// Pulls the current list from the server and re-renders.
// Called on page load, and again after every add/edit/delete
// so the screen always matches what's actually saved.
async function loadServices() {
  const res = await fetch("/api/services");
  if (!res.ok) {
    services = [];
    renderServices();
    return;
  }
  services = await res.json();
  renderServices();
}

function showServicePhotoPreview(url) {
  const img = document.getElementById("preview-servicePhoto");
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = "block";
  } else {
    img.src = "";
    img.style.display = "none";
  }
}

const serviceFileInput = document.getElementById("file-servicePhoto");
if (serviceFileInput) {
  serviceFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      showServicePhotoPreview(url);
    }
  });
}

function renderServices() {
  const rows = services.filter((s) => {
    const matchesFilter = activeFilter === "all" || s.category === activeFilter;
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  tableBody.innerHTML = "";
  emptyState.style.display = rows.length ? "none" : "block";

  // Update service count
  if (serviceCountEl) {
    const total = services.length;
    serviceCountEl.textContent = `${total} service${total === 1 ? "" : "s"} total`;
  }

  rows.forEach((s) => {
    const tr = document.createElement("tr");
    const thumbHtml = s.image
      ? `<img src="${escapeHtml(s.image)}" alt="" style="width:38px;height:38px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--color-border);">`
      : `<div style="width:38px;height:38px;border-radius:6px;background:var(--color-primary-soft,#eff6ff);color:var(--color-primary,#2563eb);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">📚</div>`;

    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:12px;">
          ${thumbHtml}
          <div>
            <div class="cell-title">${escapeHtml(s.name)}</div>
            <div class="cell-sub">${nl2br(escapeHtml(s.desc))}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-blue">${escapeHtml(s.category)}</span></td>
      <td>${escapeHtml(s.duration)}</td>
      <td>${s.enrolled}</td>
      <td>${
        s.status === "active"
          ? '<span class="badge badge-green">Active</span>'
          : '<span class="badge badge-amber">Draft</span>'
      }</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit" onclick="openServiceModal('${s.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn btn-danger-ghost btn-sm btn-icon-only" title="Delete" onclick="deleteService('${s.id}')">
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

/* ---------- Filters + search ---------- */

chipRow.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeFilter = chip.getAttribute("data-filter");
  renderServices();
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderServices();
});

/* ---------- Add / Edit modal ---------- */

function openServiceModal(id) {
  const form = document.getElementById("serviceForm");
  form.reset();
  clearErrors();
  showServicePhotoPreview("");
  const fileInput = document.getElementById("file-servicePhoto");
  if (fileInput) fileInput.value = "";

  if (id) {
    const s = services.find((x) => x.id === id);
    document.getElementById("serviceModalTitle").textContent = "Edit service";
    document.getElementById("serviceId").value               = s.id;
    document.getElementById("serviceName").value             = s.name;
    document.getElementById("serviceCategory").value         = s.category;
    document.getElementById("serviceDuration").value         = s.duration;
    document.getElementById("serviceDesc").value             = s.desc;
    document.getElementById("serviceEnrolled").value         = s.enrolled;
    document.getElementById("serviceStatus").value           = s.status;
    showServicePhotoPreview(s.image || "");
  } else {
    document.getElementById("serviceModalTitle").textContent = "Add service";
    document.getElementById("serviceId").value               = "";
    showServicePhotoPreview("");
  }

  openModal("serviceModalOverlay");
}

function clearErrors() {
  document.querySelectorAll("#serviceForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

async function uploadServicePhoto() {
  const fileInput = document.getElementById("file-servicePhoto");
  if (!fileInput || !fileInput.files.length) {
    showToast("Please choose a photo first.", "danger");
    return;
  }

  const id = document.getElementById("serviceId").value;
  if (!id) {
    showToast("Photo will be uploaded automatically when you save the service.", "neutral");
    return;
  }

  const btn = document.getElementById("servicePhotoUploadBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

  try {
    const fd = new FormData();
    fd.append("photo", fileInput.files[0]);

    const res = await fetch(`/api/services/${id}/photo`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    showServicePhotoPreview(data.image);
    fileInput.value = "";
    showToast("Photo updated successfully");
    await loadServices();
  } catch (err) {
    showToast(err.message || "Upload failed — please try again.", "danger");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
  }
}

document.getElementById("serviceForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  const name = document.getElementById("serviceName").value.trim();
  const duration = document.getElementById("serviceDuration").value.trim();
  const desc = document.getElementById("serviceDesc").value.trim();
  let valid = true;

  if (!name) { document.getElementById("field-name").classList.add("has-error"); valid = false; }
  if (!duration) { document.getElementById("field-duration").classList.add("has-error"); valid = false; }
  if (!desc) { document.getElementById("field-desc").classList.add("has-error"); valid = false; }
  if (!valid) return;

  const id = document.getElementById("serviceId").value;
  const data = {
    name,
    category: document.getElementById("serviceCategory").value,
    duration,
    desc,
    enrolled: parseInt(document.getElementById("serviceEnrolled").value, 10) || 0,
    status: document.getElementById("serviceStatus").value,
  };

  let savedService = null;

  if (id) {
    // Editing an existing service
    const res = await fetch(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      savedService = await res.json();
      showToast("Service updated");
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Update failed — please try again.", "danger");
      return;
    }
  } else {
    // Creating a new one
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      savedService = await res.json();
      showToast("Service added");
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Could not add service — please try again.", "danger");
      return;
    }
  }

  // Upload photo file if one was selected
  const fileInput = document.getElementById("file-servicePhoto");
  if (savedService && fileInput && fileInput.files.length > 0) {
    try {
      const fd = new FormData();
      fd.append("photo", fileInput.files[0]);
      const photoRes = await fetch(`/api/services/${savedService.id}/photo`, {
        method: "POST",
        body: fd,
      });
      if (photoRes.ok) {
        showToast("Service and photo saved");
      }
    } catch (err) {
      console.error("Could not upload service photo", err);
    }
  }

  closeModal("serviceModalOverlay");
  await loadServices();
});

async function deleteService(id) {
  const s = services.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${s.name}"? This can't be undone.`)) return;
  const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
  if (res.ok || res.status === 204) {
    showToast("Service deleted", "danger");
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || "Delete failed — please try again.", "danger");
  }
  await loadServices();
}

loadCategories().then(loadServices);
