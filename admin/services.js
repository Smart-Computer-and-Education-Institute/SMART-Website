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
  services = await res.json();
  renderServices();
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
    tr.innerHTML = `
      <td>
        <div class="cell-title">${escapeHtml(s.name)}</div>
        <div class="cell-sub">${nl2br(escapeHtml(s.desc))}</div>
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
  div.textContent = str;
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

  if (id) {
    const s = services.find((x) => x.id === id);
    document.getElementById("serviceModalTitle").textContent = "Edit service";
    document.getElementById("serviceId").value = s.id;
    document.getElementById("serviceName").value = s.name;
    document.getElementById("serviceCategory").value = s.category;
    document.getElementById("serviceDuration").value = s.duration;
    document.getElementById("serviceDesc").value = s.desc;
    document.getElementById("serviceEnrolled").value = s.enrolled;
    document.getElementById("serviceStatus").value = s.status;
  } else {
    document.getElementById("serviceModalTitle").textContent = "Add service";
    document.getElementById("serviceId").value = "";
  }

  openModal("serviceModalOverlay");
}

function clearErrors() {
  document.querySelectorAll("#serviceForm .form-field").forEach((f) => f.classList.remove("has-error"));
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

  if (id) {
    // Editing an existing service
    await fetch(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    showToast("Service updated");
  } else {
    // Creating a new one
    await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    showToast("Service added");
  }

  closeModal("serviceModalOverlay");
  await loadServices();
});

async function deleteService(id) {
  const s = services.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${s.name}"? This can't be undone.`)) return;
  await fetch(`/api/services/${id}`, { method: "DELETE" });
  showToast("Service deleted", "danger");
  await loadServices();
}

loadCategories().then(loadServices);
