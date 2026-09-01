/* ============================================
   Settings — contact info + service categories
   Backed by /api/settings (contact) and /api/categories.
   Both take effect on the public site immediately — there's no
   separate "publish" step.
   ============================================ */

/* ---------- Contact info ---------- */

const settingsForm = document.getElementById("settingsForm");
const settingsSaveBtn = document.getElementById("settingsSaveBtn");
const weeklyHoursGrid = document.getElementById("weeklyHoursGrid");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function updateWeeklyHourRowState(row) {
  const checkbox = row.querySelector(".hour-closed");
  const openInput = row.querySelector(".hour-open");
  const closeInput = row.querySelector(".hour-close");
  const isClosed = checkbox.checked;

  openInput.disabled = isClosed;
  closeInput.disabled = isClosed;
  row.classList.toggle("is-closed", isClosed);
}

if (weeklyHoursGrid) {
  weeklyHoursGrid.addEventListener("change", (e) => {
    if (e.target.classList.contains("hour-closed")) {
      const row = e.target.closest(".weekly-hours-row");
      if (row) updateWeeklyHourRowState(row);
    }
  });
}

async function loadSettings() {
  const res = await fetch("/api/settings");
  const settings = await res.json();

  document.getElementById("settingsAddress").value = settings.address || "";
  document.getElementById("settingsPhones").value = (settings.phones || []).join("\n");
  document.getElementById("settingsEmail").value = settings.email || "";
  document.getElementById("settingsHours").value = settings.hours || "";
  document.getElementById("settingsWhatsapp").value = settings.whatsapp || "";
  document.getElementById("settingsMap").value = settings.mapEmbedUrl || "";
  document.getElementById("settingsMapDirections").value = settings.mapDirectionsUrl || "";

  if (settings.weeklyHours && weeklyHoursGrid) {
    document.querySelectorAll(".weekly-hours-row").forEach((row) => {
      const day = row.getAttribute("data-day");
      const config = settings.weeklyHours[day];
      if (config) {
        const openInput = row.querySelector(".hour-open");
        const closeInput = row.querySelector(".hour-close");
        const closedCheckbox = row.querySelector(".hour-closed");

        if (openInput && config.open) openInput.value = config.open;
        if (closeInput && config.close) closeInput.value = config.close;
        if (closedCheckbox) closedCheckbox.checked = Boolean(config.closed);

        updateWeeklyHourRowState(row);
      }
    });
  }
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const weeklyHours = {};
  if (weeklyHoursGrid) {
    document.querySelectorAll(".weekly-hours-row").forEach((row) => {
      const day = row.getAttribute("data-day");
      const open = row.querySelector(".hour-open")?.value || "06:00";
      const close = row.querySelector(".hour-close")?.value || "18:00";
      const closed = Boolean(row.querySelector(".hour-closed")?.checked);
      weeklyHours[day] = { open, close, closed };
    });
  }

  const data = {
    address: document.getElementById("settingsAddress").value.trim(),
    phones: document.getElementById("settingsPhones").value,
    email: document.getElementById("settingsEmail").value.trim(),
    hours: document.getElementById("settingsHours").value.trim(),
    weeklyHours,
    whatsapp: document.getElementById("settingsWhatsapp").value.trim(),
    mapEmbedUrl: document.getElementById("settingsMap").value.trim(),
    mapDirectionsUrl: document.getElementById("settingsMapDirections").value.trim(),
  };

  settingsSaveBtn.disabled = true;
  settingsSaveBtn.textContent = "Saving...";

  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.error || "Couldn't save settings", "danger");
      return;
    }
    showToast("Settings & business hours updated");
    await loadSettings(); // re-pull so everything reflects exactly what was saved
  } catch (err) {
    showToast("Couldn't save contact info", "danger");
  } finally {
    settingsSaveBtn.disabled = false;
    settingsSaveBtn.textContent = "Save contact info & hours";
  }
});

/* ---------- Categories ---------- */

const categoryList = document.getElementById("categoryList");
const addCategoryForm = document.getElementById("addCategoryForm");
const newCategoryNameInput = document.getElementById("newCategoryName");

async function loadCategories() {
  const res = await fetch("/api/categories");
  const categories = await res.json();

  categoryList.innerHTML = "";
  if (!categories.length) {
    categoryList.innerHTML = `<p class="hint" style="margin:0;">No categories yet — add one below.</p>`;
    return;
  }

  categories.forEach((cat) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;";
    row.innerHTML = `
      <input type="text" value="${escapeHtml(cat.name)}" data-id="${cat.id}" data-original="${escapeHtml(cat.name)}"
        style="flex:1;padding:8px 10px;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-size:13.5px;">
      <button type="button" class="btn btn-secondary btn-sm" data-rename="${cat.id}">Rename</button>
      <button type="button" class="btn btn-danger-ghost btn-sm" data-delete="${cat.id}" data-name="${escapeHtml(cat.name)}">Remove</button>
    `;
    categoryList.appendChild(row);
  });
}

categoryList.addEventListener("click", async (e) => {
  const renameId = e.target.getAttribute && e.target.getAttribute("data-rename");
  const deleteId = e.target.getAttribute && e.target.getAttribute("data-delete");

  if (renameId) {
    const input = categoryList.querySelector(`input[data-id="${renameId}"]`);
    const newName = input.value.trim();
    const original = input.getAttribute("data-original");
    if (!newName || newName === original) return;

    const res = await fetch(`/api/categories/${renameId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(data.error || "Couldn't rename category", "danger");
      return;
    }
    showToast("Category renamed");
    await loadCategories();
  }

  if (deleteId) {
    const name = e.target.getAttribute("data-name");
    if (!confirmDelete(`Remove "${name}"? Services already using it will keep the category text, but the filter chip will disappear.`)) return;

    const res = await fetch(`/api/categories/${deleteId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Couldn't remove category", "danger");
      return;
    }
    showToast("Category removed", "danger");
    await loadCategories();
  }
});

addCategoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newCategoryNameInput.value.trim();
  if (!name) return;

  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    showToast(data.error || "Couldn't add category", "danger");
    return;
  }

  newCategoryNameInput.value = "";
  showToast("Category added");
  await loadCategories();
});

loadSettings();
loadCategories();
