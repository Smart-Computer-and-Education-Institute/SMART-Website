/* ============================================
   Careers — data + rendering
   Backed by the server's /api/careers and
   /api/career-categories routes.
   ============================================ */

let careers = [];
let careerCategories = []; // [{id, name}, ...] from /api/career-categories
let careerFilter = "all";
let careerSearch = "";

const careerTableBody  = document.getElementById("careerTableBody");
const careerEmptyState = document.getElementById("careerEmptyState");
const careerCountEl    = document.getElementById("careerCount");
const careerChipRow    = document.getElementById("careerChipRow");
const categorySelect   = document.getElementById("careerCategory");
const divisionList     = document.getElementById("divisionList");
const addDivisionForm  = document.getElementById("addDivisionForm");
const newDivisionNameInput = document.getElementById("newDivisionName");

// Pulls division list from the server and updates filter chips,
// the form select dropdown, and the Manage Divisions modal list.
async function loadCareerCategories() {
  const res = await fetch("/api/career-categories");
  if (!res.ok) {
    careerCategories = [];
    return;
  }
  const data = await res.json();
  careerCategories = Array.isArray(data) ? data : [];

  // Rebuild the chip row, keeping the "All" chip and whichever filter
  // was already active (if it still exists).
  careerChipRow.querySelectorAll(".chip:not([data-filter='all'])").forEach((c) => c.remove());
  careerCategories.forEach((cat) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (careerFilter === cat.name ? " active" : "");
    chip.setAttribute("data-filter", cat.name);
    chip.textContent = cat.name;
    careerChipRow.appendChild(chip);
  });

  // Rebuild the <select> options, preserving whatever was chosen if it
  // still exists (falls back to the first category otherwise).
  const previousValue = categorySelect ? categorySelect.value : "";
  if (categorySelect) {
    categorySelect.innerHTML = "";
    careerCategories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.name;
      opt.textContent = cat.name;
      categorySelect.appendChild(opt);
    });
    if (careerCategories.some((c) => c.name === previousValue)) {
      categorySelect.value = previousValue;
    }
  }

  // Render modal division list
  if (divisionList) {
    divisionList.innerHTML = "";
    if (!careerCategories.length) {
      divisionList.innerHTML = `<p class="hint" style="margin:0;">No divisions yet — add one below.</p>`;
    } else {
      careerCategories.forEach((cat) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:8px;";
        row.innerHTML = `
          <input type="text" value="${escapeHtml(cat.name)}" data-id="${cat.id}" data-original="${escapeHtml(cat.name)}"
            style="flex:1;padding:8px 10px;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-size:13.5px;">
          <button type="button" class="btn btn-secondary btn-sm" data-rename="${cat.id}">Rename</button>
          <button type="button" class="btn btn-danger-ghost btn-sm" data-delete="${cat.id}" data-name="${escapeHtml(cat.name)}">Remove</button>
        `;
        divisionList.appendChild(row);
      });
    }
  }
}

// Pulls the current list from the server and re-renders.
// Called on page load, and again after every add/edit/delete
// so the screen always matches what's actually saved.
async function loadCareers() {
  const res = await fetch("/api/careers");
  if (!res.ok) {
    careers = [];
    renderCareers();
    return;
  }
  const data = await res.json();
  careers = Array.isArray(data) ? data : [];
  renderCareers();
}

function showCareerPhotoPreview(url) {
  const img = document.getElementById("preview-careerPhoto");
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = "block";
  } else {
    img.src = "";
    img.style.display = "none";
  }
}

const careerFileInput = document.getElementById("file-careerPhoto");
if (careerFileInput) {
  careerFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      showCareerPhotoPreview(url);
    }
  });
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
    const thumbHtml = c.image
      ? `<img src="${escapeHtml(c.image)}" alt="" style="width:38px;height:38px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--color-border);">`
      : `<div style="width:38px;height:38px;border-radius:6px;background:var(--color-primary-soft,#eff6ff);color:var(--color-primary,#2563eb);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">💼</div>`;

    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:12px;">
          ${thumbHtml}
          <div>
            <div class="cell-title">${escapeHtml(c.title)}</div>
            <div class="cell-sub">${escapeHtml(c.location || "")}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-blue">${escapeHtml(c.category || "")}</span></td>
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
  div.textContent = str == null ? "" : String(str);
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

/* ---------- Add / Edit career modal ---------- */

function openCareerModal(id) {
  const form = document.getElementById("careerForm");
  form.reset();
  clearCareerErrors();
  showCareerPhotoPreview("");
  const fileInput = document.getElementById("file-careerPhoto");
  if (fileInput) fileInput.value = "";

  if (id) {
    const c = careers.find((x) => x.id === id);
    document.getElementById("careerModalTitle").textContent  = "Edit position";
    document.getElementById("careerId").value                = c.id;
    document.getElementById("careerTitle").value             = c.title;
    if (categorySelect) categorySelect.value                 = c.category;
    document.getElementById("careerStatus").value            = c.status;
    document.getElementById("careerLocation").value          = c.location || "";
    document.getElementById("careerEmploymentType").value    = c.employmentType || "";
    document.getElementById("careerExperience").value        = c.experience || "";
    document.getElementById("careerDescription").value       = c.description;
    showCareerPhotoPreview(c.image || "");
  } else {
    document.getElementById("careerModalTitle").textContent  = "Add position";
    document.getElementById("careerId").value                = "";
    document.getElementById("careerLocation").value          = "Jhapa, Nepal";
    document.getElementById("careerEmploymentType").value    = "Full-time";
    showCareerPhotoPreview("");
  }

  openModal("careerModalOverlay");
}

function clearCareerErrors() {
  document.querySelectorAll("#careerForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

async function uploadCareerPhoto() {
  const fileInput = document.getElementById("file-careerPhoto");
  if (!fileInput || !fileInput.files.length) {
    showToast("Please choose a photo first.", "danger");
    return;
  }

  const id = document.getElementById("careerId").value;
  if (!id) {
    showToast("Photo will be uploaded automatically when you save the position.", "neutral");
    return;
  }

  const btn = document.getElementById("careerPhotoUploadBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

  try {
    const fd = new FormData();
    fd.append("photo", fileInput.files[0]);

    const res = await fetch(`/api/careers/${id}/photo`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    showCareerPhotoPreview(data.image);
    fileInput.value = "";
    showToast("Photo updated successfully");
    await loadCareers();
  } catch (err) {
    showToast(err.message || "Upload failed — please try again.", "danger");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
  }
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
    category:       categorySelect ? categorySelect.value : "",
    status:         document.getElementById("careerStatus").value,
    location:       document.getElementById("careerLocation").value.trim(),
    employmentType: document.getElementById("careerEmploymentType").value.trim(),
    experience:     document.getElementById("careerExperience").value.trim(),
    description,
  };

  let savedCareer = null;

  if (id) {
    const res = await fetch(`/api/careers/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (res.ok) {
      savedCareer = await res.json();
      showToast("Position updated");
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Update failed — please try again.", "danger");
      return;
    }
  } else {
    const res = await fetch("/api/careers", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (res.ok) {
      savedCareer = await res.json();
      showToast("Position added");
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Could not add position — please try again.", "danger");
      return;
    }
  }

  // Upload photo file if one was selected
  const fileInput = document.getElementById("file-careerPhoto");
  if (savedCareer && fileInput && fileInput.files.length > 0) {
    try {
      const fd = new FormData();
      fd.append("photo", fileInput.files[0]);
      const photoRes = await fetch(`/api/careers/${savedCareer.id}/photo`, {
        method: "POST",
        body: fd,
      });
      if (photoRes.ok) {
        showToast("Position and photo saved");
      }
    } catch (err) {
      console.error("Could not upload career photo", err);
    }
  }

  closeModal("careerModalOverlay");
  await loadCareers();
});

async function deleteCareer(id) {
  const c = careers.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${c.title}"? This can't be undone.`)) return;
  const res = await fetch(`/api/careers/${id}`, { method: "DELETE" });
  if (res.ok || res.status === 204) {
    showToast("Position deleted", "danger");
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || "Delete failed — please try again.", "danger");
  }
  await loadCareers();
}

/* ---------- Manage Divisions modal ---------- */

function openDivisionsModal() {
  openModal("divisionsModalOverlay");
}

if (divisionList) {
  divisionList.addEventListener("click", async (e) => {
    const renameId = e.target.getAttribute && e.target.getAttribute("data-rename");
    const deleteId = e.target.getAttribute && e.target.getAttribute("data-delete");

    if (renameId) {
      const input = divisionList.querySelector(`input[data-id="${renameId}"]`);
      const newName = input.value.trim();
      const original = input.getAttribute("data-original");
      if (!newName || newName === original) return;

      const res = await fetch(`/api/career-categories/${renameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || "Couldn't rename division", "danger");
        return;
      }
      showToast("Division renamed");
      await loadCareerCategories();
      await loadCareers();
    }

    if (deleteId) {
      const name = e.target.getAttribute("data-name");
      if (!confirmDelete(`Remove division "${name}"? Positions already using it will keep their division name, but the filter chip will disappear.`)) return;

      const res = await fetch(`/api/career-categories/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Couldn't remove division", "danger");
        return;
      }
      showToast("Division removed", "danger");
      await loadCareerCategories();
      await loadCareers();
    }
  });
}

if (addDivisionForm) {
  addDivisionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = newDivisionNameInput.value.trim();
    if (!name) return;

    const res = await fetch("/api/career-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(data.error || "Couldn't add division", "danger");
      return;
    }

    newDivisionNameInput.value = "";
    showToast("Division added");
    await loadCareerCategories();
  });
}

loadCareerCategories().then(loadCareers);

