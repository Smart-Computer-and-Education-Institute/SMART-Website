/* ============================================
   Careers — data + rendering
   Backed by the server's /api/careers routes.
   Modeled on admin/services.js.
   ============================================ */

let careers = [];
let careerFilter = "all";
let careerSearch = "";

const careerTableBody  = document.getElementById("careerTableBody");
const careerEmptyState = document.getElementById("careerEmptyState");
const careerCountEl    = document.getElementById("careerCount");
const careerChipRow    = document.getElementById("careerChipRow");

// Maps the stored category value to a human-readable label for display
// in the table — mirrors the public Career page's filter button labels.
const CATEGORY_LABELS = {
  teaching:  "Teaching",
  it:        "IT & Support",
  admin:     "Administration",
  marketing: "Marketing",
};

// Pulls the current list from the server and re-renders.
// Called on page load, and again after every add/edit/delete
// so the screen always matches what's actually saved.
async function loadCareers() {
  const res = await fetch("/api/careers");
  careers = await res.json();
  renderCareers();
}

function renderCareers() {
  const rows = careers.filter((c) => {
    const matchesFilter = careerFilter === "all" || c.category === careerFilter;
    const matchesSearch = c.title.toLowerCase().includes(careerSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  careerTableBody.innerHTML = "";
  careerEmptyState.style.display = rows.length ? "none" : "block";

  if (careerCountEl) {
    const total = careers.length;
    const open  = careers.filter((c) => c.status === "open").length;
    careerCountEl.textContent = `${total} position${total === 1 ? "" : "s"} · ${open} open`;
  }

  rows.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="cell-title">${escapeHtml(c.title)}</div>
        <div class="cell-sub">${escapeHtml(c.location || "")}</div>
      </td>
      <td><span class="badge badge-blue">${escapeHtml(CATEGORY_LABELS[c.category] || c.category)}</span></td>
      <td>${escapeHtml(c.employmentType || "")}</td>
      <td>${escapeHtml(c.experience || "")}</td>
      <td>${
        c.status === "open"
          ? '<span class="badge badge-green">Open</span>'
          : '<span class="badge badge-amber">Closed</span>'
      }</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit" onclick="openCareerModal('${c.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn btn-danger-ghost btn-sm btn-icon-only" title="Delete" onclick="deleteCareer('${c.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      </td>
    `;
    careerTableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Filters + search ---------- */

careerChipRow.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  careerChipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  careerFilter = chip.getAttribute("data-filter");
  renderCareers();
});

document.getElementById("careerSearchInput").addEventListener("input", (e) => {
  careerSearch = e.target.value;
  renderCareers();
});

/* ---------- Add / Edit modal ---------- */

function openCareerModal(id) {
  const form = document.getElementById("careerForm");
  form.reset();
  clearCareerErrors();

  if (id) {
    const c = careers.find((x) => x.id === id);
    document.getElementById("careerModalTitle").textContent  = "Edit position";
    document.getElementById("careerId").value                = c.id;
    document.getElementById("careerTitle").value             = c.title;
    document.getElementById("careerCategory").value          = c.category;
    document.getElementById("careerStatus").value            = c.status;
    document.getElementById("careerLocation").value          = c.location || "";
    document.getElementById("careerEmploymentType").value    = c.employmentType || "";
    document.getElementById("careerExperience").value        = c.experience || "";
    document.getElementById("careerDescription").value       = c.description;
  } else {
    document.getElementById("careerModalTitle").textContent  = "Add position";
    document.getElementById("careerId").value                = "";
    // Sensible defaults so the admin doesn't have to fill in boilerplate every time
    document.getElementById("careerLocation").value          = "Jhapa, Nepal";
    document.getElementById("careerEmploymentType").value    = "Full-time";
  }

  openModal("careerModalOverlay");
}

function clearCareerErrors() {
  document.querySelectorAll("#careerForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

document.getElementById("careerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearCareerErrors();

  const title       = document.getElementById("careerTitle").value.trim();
  const description = document.getElementById("careerDescription").value.trim();
  let valid = true;

  if (!title)       { document.getElementById("field-career-title").classList.add("has-error");       valid = false; }
  if (!description) { document.getElementById("field-career-description").classList.add("has-error"); valid = false; }
  if (!valid) return;

  const id   = document.getElementById("careerId").value;
  const data = {
    title,
    category:       document.getElementById("careerCategory").value,
    status:         document.getElementById("careerStatus").value,
    location:       document.getElementById("careerLocation").value.trim(),
    employmentType: document.getElementById("careerEmploymentType").value.trim(),
    experience:     document.getElementById("careerExperience").value.trim(),
    description,
  };

  if (id) {
    await fetch(`/api/careers/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    showToast("Position updated");
  } else {
    await fetch("/api/careers", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    showToast("Position added");
  }

  closeModal("careerModalOverlay");
  await loadCareers();
});

async function deleteCareer(id) {
  const c = careers.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${c.title}"? This can't be undone.`)) return;
  await fetch(`/api/careers/${id}`, { method: "DELETE" });
  showToast("Position deleted", "danger");
  await loadCareers();
}

loadCareers();
