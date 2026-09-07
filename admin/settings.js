/* ============================================
   Settings — contact info, footer content, service categories, career divisions.
   Backed by /api/settings (contact/footer) and /api/categories.
   All changes take effect on the public site immediately — there's no
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

async function loadHolidayNotices(selectedId) {
  const select = document.getElementById("settingsNextHoliday");
  if (!select) return;
  try {
    const res = await fetch("/api/notices");
    if (!res.ok) return;
    const notices = await res.json();

    select.innerHTML = '<option value="">None selected</option>';
    if (Array.isArray(notices)) {
      notices
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .forEach((n) => {
          const opt = document.createElement("option");
          opt.value = n.id;
          const statusSuffix = n.status === "draft" ? " [Draft]" : "";
          opt.textContent = `${n.title} (${n.date || "No date"})${statusSuffix}`;
          select.appendChild(opt);
        });
    }

    if (selectedId) {
      select.value = selectedId;
    }
  } catch (err) {
    console.error("Failed to load notices for holiday selector", err);
  }
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
  const mapDirectionsEl = document.getElementById("settingsMapDirections");
  if (mapDirectionsEl) mapDirectionsEl.value = settings.mapDirectionsUrl || "";

  await loadHolidayNotices(settings.nextHolidayNoticeId || "");

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

  // Footer content fields
  if (document.getElementById("footerTagline")) {
    document.getElementById("footerTagline").value = settings.footerTagline || "";
  }
  if (document.getElementById("footerCopyright")) {
    document.getElementById("footerCopyright").value = settings.footerCopyright || "";
  }
  if (document.getElementById("footerNote")) {
    document.getElementById("footerNote").value = settings.footerNote || "";
  }
  if (document.getElementById("settingsFooterCtaText")) {
    document.getElementById("settingsFooterCtaText").value = settings.footerCtaText || "";
  }
  if (document.getElementById("settingsFooterCtaLabel")) {
    document.getElementById("settingsFooterCtaLabel").value = settings.footerCtaLabel || "";
  }
  if (document.getElementById("settingsFooterCtaLink")) {
    document.getElementById("settingsFooterCtaLink").value = settings.footerCtaLink || "";
  }

  // Social links — dynamic list
  // Backward-compat: migrate legacy {facebook, instagram, youtube, tiktok} object
  // into the new customSocialLinks array format on first load.
  let customSocialLinks = Array.isArray(settings.customSocialLinks)
    ? settings.customSocialLinks
    : [];
  if (!customSocialLinks.length) {
    const sl = settings.socialLinks || {};
    const LEGACY = [
      { key: "facebook",  label: "Facebook" },
      { key: "instagram", label: "Instagram" },
      { key: "youtube",   label: "YouTube" },
      { key: "tiktok",    label: "TikTok" },
    ];
    customSocialLinks = LEGACY
      .filter((p) => sl[p.key])
      .map((p) => ({ label: p.label, url: sl[p.key] }));
  }
  renderSocialLinksList(customSocialLinks);
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

  const nextHolidaySelect = document.getElementById("settingsNextHoliday");
  const nextHolidayNoticeId = nextHolidaySelect ? (nextHolidaySelect.value || null) : null;
  const mapDirectionsEl = document.getElementById("settingsMapDirections");

  const data = {
    address: document.getElementById("settingsAddress").value.trim(),
    phones: document.getElementById("settingsPhones").value,
    email: document.getElementById("settingsEmail").value.trim(),
    hours: document.getElementById("settingsHours").value.trim(),
    weeklyHours,
    nextHolidayNoticeId,
    whatsapp: document.getElementById("settingsWhatsapp").value.trim(),
    mapEmbedUrl: document.getElementById("settingsMap").value.trim(),
    mapDirectionsUrl: mapDirectionsEl ? mapDirectionsEl.value.trim() : "",
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

/* ---------- Career Divisions ---------- */

const divisionList = document.getElementById("divisionList");
const addDivisionForm = document.getElementById("addDivisionForm");
const newDivisionNameInput = document.getElementById("newDivisionName");

async function loadCareerDivisions() {
  if (!divisionList) return;
  const res = await fetch("/api/career-categories");
  const divisions = await res.json();

  divisionList.innerHTML = "";
  if (!divisions.length) {
    divisionList.innerHTML = `<p class="hint" style="margin:0;">No divisions yet — add one below.</p>`;
    return;
  }

  divisions.forEach((divItem) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;";
    row.innerHTML = `
      <input type="text" value="${escapeHtml(divItem.name)}" data-id="${divItem.id}" data-original="${escapeHtml(divItem.name)}"
        style="flex:1;padding:8px 10px;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-size:13.5px;">
      <button type="button" class="btn btn-secondary btn-sm" data-rename-division="${divItem.id}">Rename</button>
      <button type="button" class="btn btn-danger-ghost btn-sm" data-delete-division="${divItem.id}" data-name="${escapeHtml(divItem.name)}">Remove</button>
    `;
    divisionList.appendChild(row);
  });
}

if (divisionList) {
  divisionList.addEventListener("click", async (e) => {
    const renameId = e.target.getAttribute && e.target.getAttribute("data-rename-division");
    const deleteId = e.target.getAttribute && e.target.getAttribute("data-delete-division");

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
      await loadCareerDivisions();
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
      await loadCareerDivisions();
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
    await loadCareerDivisions();
  });
}

/* ---------- Custom Social Links Manager (Max 10) ---------- */

const SOCIAL_ICONS = {
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M13.5 22v-8.5h2.85l.43-3.32h-3.28V8.05c0-.96.27-1.62 1.65-1.62h1.76V3.46A23.6 23.6 0 0 0 14.2 3.3c-2.51 0-4.23 1.53-4.23 4.34v2.42H7.1v3.32h2.87V22h3.53Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8ZM10 15V9l5.2 3-5.2 3Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.5 2h-3v13.2a2.8 2.8 0 1 1-2-2.68V9.4a5.9 5.9 0 1 0 5 5.83V8.9a7.3 7.3 0 0 0 4 1.2V7a4.3 4.3 0 0 1-4-5Z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12.04 2c-5.5 0-9.98 4.47-9.98 9.97 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.96 9.96 0 0 0 4.84 1.24h.01c5.5 0 9.98-4.47 9.98-9.97A9.97 9.97 0 0 0 12.04 2zm5.83 14.12c-.24.68-1.39 1.33-1.93 1.37-.5.05-1.12.06-3.62-.97-3.2-1.32-5.26-4.57-5.42-4.78-.16-.21-1.3-1.74-1.3-3.32 0-1.58.83-2.35 1.12-2.67.3-.32.65-.4.87-.4.22 0 .43 0 .62.01.2.01.47-.08.73.55.27.65.92 2.25 1 2.42.08.16.14.36.03.57-.11.22-.16.35-.33.54-.16.2-.34.44-.49.59-.16.16-.33.34-.14.67.19.32.84 1.38 1.8 2.24 1.24 1.11 2.29 1.45 2.61 1.61.33.16.52.14.71-.08.2-.22.84-.98 1.06-1.32.22-.34.44-.29.74-.18.3.11 1.93.91 2.26 1.07.33.16.55.25.63.38.08.14.08.8-.16 1.48z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8-1.7 8.03c-.13.58-.47.72-.96.45l-2.61-1.92-1.26 1.21c-.14.14-.26.26-.53.26l.19-2.66 4.84-4.37c.21-.19-.05-.29-.32-.1l-5.99 3.77-2.58-.81c-.56-.18-.57-.56.12-.83l10.07-3.88c.47-.17.88.11.73.85z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
  threads: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c2.5 0 4.79-.92 6.54-2.45l-1.36-1.42A7.95 7.95 0 0 1 12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8c0 1.5-.4 2.89-1.13 4.07-.63 1.02-1.57 1.63-2.62 1.63-1.06 0-1.75-.68-1.75-1.95V10.2c0-1.89-1.2-3.2-3.12-3.2-2.17 0-3.88 1.74-3.88 4.05 0 2.37 1.63 4.14 3.88 4.14 1.28 0 2.34-.58 2.87-1.55.45 1.61 1.7 2.65 3.5 2.65 1.73 0 3.23-.97 4.13-2.44A9.92 9.92 0 0 0 22 12c0-5.52-4.48-10-10-10zm.12 13.25c-1.25 0-2.15-.94-2.15-2.25 0-1.34.9-2.25 2.15-2.25s2.15.91 2.15 2.25c0 1.31-.9 2.25-2.15 2.25z"/></svg>',
  reddit: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm5.748-12.87a1.44 1.44 0 0 0-1.433 1.26 7.42 7.42 0 0 0-3.905-1.146l.794-3.738 2.597.553a1.14 1.14 0 1 0 .232-.705l-2.993-.637a.382.382 0 0 0-.45.293l-.914 4.3a7.48 7.48 0 0 0-3.957 1.173 1.44 1.44 0 1 0-1.706 2.327c-.017.158-.026.319-.026.482 0 2.455 2.865 4.453 6.4 4.453s6.4-1.998 6.4-4.453c0-.16-.009-.32-.025-.477a1.438 1.438 0 0 0-.414-2.686zM9.354 13.5c0-.623.504-1.127 1.127-1.127.622 0 1.127.504 1.127 1.127 0 .622-.505 1.127-1.127 1.127-.623 0-1.127-.505-1.127-1.127zm5.292 2.604c-.65.65-1.89.7-2.646.7-.755 0-1.996-.05-2.646-.7-.146-.146-.146-.383 0-.529.146-.146.383-.146.53 0 .471.472 1.467.529 2.116.529.649 0 1.645-.057 2.116-.53.147-.146.384-.146.53 0 .146.147.146.384 0 .53zm-.12-1.477a1.127 1.127 0 1 1 0-2.254 1.127 1.127 0 0 1 0 2.254z"/></svg>',
  pinterest: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2a10 10 0 0 0-3.66 19.31c-.05-.83-.09-2.1.02-3 .1-.83.67-4.32.67-4.32s-.17-.34-.17-.84c0-.79.46-1.38 1.03-1.38.48 0 .72.36.72.8 0 .49-.31 1.22-.47 1.9-.13.57.29 1.03.85 1.03 1.02 0 1.8-1.08 1.8-2.63 0-1.38-.99-2.34-2.4-2.34-1.64 0-2.6 1.23-2.6 2.5 0 .5.19 1.03.43 1.32.05.06.05.11.04.17-.04.16-.13.54-.15.62-.02.1-.09.12-.19.07-.72-.34-1.17-1.39-1.17-2.24 0-1.82 1.32-3.5 3.82-3.5 2.01 0 3.57 1.43 3.57 3.35 0 2-1.26 3.61-3 3.61-.59 0-1.14-.31-1.33-.67l-.36 1.38c-.13.5-.48 1.13-.72 1.51A10 10 0 1 0 12 2z"/></svg>',
  snapchat: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12.03 2c-3.1 0-5.46 2.05-5.46 4.93 0 .7.15 1.43.34 1.88.08.18.06.27-.05.37-.3.26-.96.53-1.63.8-.45.18-.54.43-.52.64.03.28.4.52.88.58.55.07.96.22 1.17.48.24.3.17.84.05 1.43-.05.23-.23.95-.61 1.63-.44.78-.99 1.24-.99 1.76 0 .37.28.67.92.83.67.17 1.63.14 2.88-.36.43-.17.78-.11 1.02.05.77.5 1.39.73 2.02.73s1.25-.23 2.02-.73c.24-.16.59-.22 1.02-.05 1.25.5 2.21.53 2.88.36.64-.16.92-.46.92-.83 0-.52-.55-.98-.99-1.76-.38-.68-.56-1.4-.61-1.63-.12-.59-.19-1.13.05-1.43.21-.26.62-.41 1.17-.48.48-.06.85-.3.88-.58.02-.21-.07-.46-.52-.64-.67-.27-1.33-.54-1.63-.8-.11-.1-.13-.19-.05-.37.19-.45.34-1.18.34-1.88C17.49 4.05 15.13 2 12.03 2z"/></svg>',
  twitch: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M2.149 0l-1.612 4.119v16.036h5.031v3.845h3.845l3.665-3.845h4.942l5.98-5.979V0H2.149zm17.605 13.084l-3.396 3.396h-4.943l-3.037 3.037v-3.037H5.21V2.149h14.544v10.935zm-3.665-6.155h-2.149v6.242h2.149V6.929zm-5.733 0H8.207v6.242h2.149V6.929z"/></svg>',
  spotify: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.75.75 0 0 1-1.03.248c-2.822-1.725-6.375-2.115-10.56-1.16a.75.75 0 1 1-.334-1.462c4.58-.95 8.528-.507 11.676 1.417.36.22.47.69.248 1.03v-.073zm1.226-2.723a.938.938 0 0 1-1.29.31c-3.23-1.986-8.156-2.56-11.977-1.4a.938.938 0 1 1-.546-1.794c4.375-1.328 9.809-.686 13.503 1.587.42.26.55.82.31 1.24v.057zm.105-2.835C14.05 8.784 7.674 8.57 3.987 9.69a1.125 1.125 0 1 1-.652-2.154c4.244-1.288 11.295-1.04 15.74 1.6a1.125 1.125 0 1 1-1.158 1.93z"/></svg>',
  medium: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/></svg>',
  viber: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M22.84 16.42c-.22-.38-2.61-3.13-3.8-3.23-.39-.03-.78.14-1.07.45-.39.42-.77.85-1.16 1.28-.15.16-.33.22-.54.14-.52-.19-1.17-.46-1.92-.88-1.56-.87-2.97-2.14-4.14-3.69-.53-.7-.94-1.39-1.22-2.02-.09-.2-.04-.37.11-.53.4-.41.8-.81 1.2-1.22.34-.35.5-.77.42-1.26-.09-1.05-2.07-3.95-2.45-4.22-.36-.26-.78-.37-1.22-.27-.64.14-1.35.6-1.89 1.19-.8 1-.98 2.15-.55 3.35.8 2.27 2.22 4.49 4.14 6.47 2.18 2.25 4.69 3.86 7.23 4.67 1.34.42 2.61.16 3.65-.74.6-.53 1.07-1.24 1.2-1.91.09-.43-.02-.84-.28-1.2z"/></svg>',
  messenger: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.43 3.12 7.15.16.14.26.35.26.57l-.07 1.78c-.03.73.74 1.22 1.38.87l1.98-1.08c.18-.1.38-.13.58-.08.88.24 1.8.37 2.75.37 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.06 13.06-2.58-2.75-5.04 2.75 5.54-5.88 2.65 2.75 4.97-2.75-5.54 5.88z"/></svg>',
  website: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
};

function detectSocialPlatform(label, url) {
  const combined = `${label || ""} ${url || ""}`.toLowerCase();
  if (/facebook|fb\.com|fb\.me/.test(combined)) return "facebook";
  if (/instagram|instagr\.am/.test(combined)) return "instagram";
  if (/youtube|youtu\.be/.test(combined)) return "youtube";
  if (/tiktok/.test(combined)) return "tiktok";
  if (/whatsapp|wa\.me/.test(combined)) return "whatsapp";
  if (/twitter|x\.com/.test(combined)) return "twitter";
  if (/linkedin/.test(combined)) return "linkedin";
  if (/github/.test(combined)) return "github";
  if (/telegram|t\.me/.test(combined)) return "telegram";
  if (/discord|discord\.gg/.test(combined)) return "discord";
  if (/threads/.test(combined)) return "threads";
  if (/reddit/.test(combined)) return "reddit";
  if (/pinterest/.test(combined)) return "pinterest";
  if (/snapchat/.test(combined)) return "snapchat";
  if (/twitch/.test(combined)) return "twitch";
  if (/spotify/.test(combined)) return "spotify";
  if (/medium/.test(combined)) return "medium";
  if (/viber/.test(combined)) return "viber";
  if (/messenger|m\.me/.test(combined)) return "messenger";
  return "website";
}

function getSocialSvg(platform) {
  return SOCIAL_ICONS[platform] || SOCIAL_ICONS.website;
}

const socialLinksList = document.getElementById("socialLinksList");
const addSocialLinkBtn = document.getElementById("addSocialLinkBtn");
const socialLinkCount = document.getElementById("socialLinkCount");

function updateSocialLinksCount(count) {
  if (socialLinkCount) {
    socialLinkCount.textContent = `(${count} / 10)`;
  }
  if (addSocialLinkBtn) {
    addSocialLinkBtn.disabled = count >= 10;
    addSocialLinkBtn.style.opacity = count >= 10 ? "0.6" : "1";
    addSocialLinkBtn.title = count >= 10 ? "Maximum 10 social links reached" : "";
  }
}

function createSocialLinkRow(item = { label: "", url: "" }) {
  const row = document.createElement("div");
  row.className = "social-link-row";
  row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-sm);";

  const preview = document.createElement("div");
  preview.className = "social-preview-icon";
  preview.style.cssText = "width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);flex-shrink:0;";
  preview.innerHTML = getSocialSvg(detectSocialPlatform(item.label, item.url));

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "social-label-input";
  labelInput.placeholder = "Platform (e.g. LinkedIn)";
  labelInput.value = item.label || "";
  labelInput.style.cssText = "flex:0 0 150px;min-width:110px;";

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "social-url-input";
  urlInput.placeholder = "https://...";
  urlInput.value = item.url || "";
  urlInput.style.cssText = "flex:1;min-width:160px;";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-danger-ghost btn-icon-only remove-social-btn";
  removeBtn.title = "Remove link";
  removeBtn.style.cssText = "flex-shrink:0;cursor:pointer;";
  removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function updateIcon() {
    const p = detectSocialPlatform(labelInput.value, urlInput.value);
    preview.innerHTML = getSocialSvg(p);
  }

  labelInput.addEventListener("input", updateIcon);
  urlInput.addEventListener("input", updateIcon);

  removeBtn.addEventListener("click", () => {
    row.remove();
    const rows = socialLinksList ? socialLinksList.querySelectorAll(".social-link-row") : [];
    updateSocialLinksCount(rows.length);
  });

  row.appendChild(preview);
  row.appendChild(labelInput);
  row.appendChild(urlInput);
  row.appendChild(removeBtn);

  return row;
}

function renderSocialLinksList(links = []) {
  if (!socialLinksList) return;
  socialLinksList.innerHTML = "";
  const list = (Array.isArray(links) ? links : []).slice(0, 10);
  list.forEach((item) => {
    socialLinksList.appendChild(createSocialLinkRow(item));
  });
  updateSocialLinksCount(list.length);
}

function getSocialLinks() {
  if (!socialLinksList) return [];
  const rows = socialLinksList.querySelectorAll(".social-link-row");
  const result = [];
  rows.forEach((row) => {
    const label = row.querySelector(".social-label-input")?.value.trim() || "";
    const url = row.querySelector(".social-url-input")?.value.trim() || "";
    if (url) {
      result.push({
        label: label || "Link",
        url,
      });
    }
  });
  return result.slice(0, 10);
}

if (addSocialLinkBtn) {
  addSocialLinkBtn.addEventListener("click", () => {
    if (!socialLinksList) return;
    const currentRows = socialLinksList.querySelectorAll(".social-link-row");
    if (currentRows.length >= 10) {
      showToast("Maximum 10 social links allowed", "warning");
      return;
    }
    const newRow = createSocialLinkRow({ label: "", url: "" });
    socialLinksList.appendChild(newRow);
    updateSocialLinksCount(currentRows.length + 1);
    newRow.querySelector(".social-label-input")?.focus();
  });
}

/* ---------- Footer Content ---------- */

const footerContentForm = document.getElementById("footerContentForm");
const footerContentSaveBtn = document.getElementById("footerContentSaveBtn");

if (footerContentForm) {
  footerContentForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      footerTagline: document.getElementById("footerTagline")?.value.trim() || "",
      footerCopyright: document.getElementById("footerCopyright")?.value.trim() || "",
      footerNote: document.getElementById("footerNote")?.value.trim() || "",
      footerCtaText: document.getElementById("settingsFooterCtaText")?.value.trim() || "",
      footerCtaLabel: document.getElementById("settingsFooterCtaLabel")?.value.trim() || "",
      footerCtaLink: document.getElementById("settingsFooterCtaLink")?.value.trim() || "",
      customSocialLinks: getSocialLinks(),
    };

    if (footerContentSaveBtn) {
      footerContentSaveBtn.disabled = true;
      footerContentSaveBtn.textContent = "Saving...";
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(result.error || "Couldn't save footer content", "danger");
        return;
      }
      showToast("Footer content updated");
      await loadSettings();
    } catch (err) {
      showToast("Couldn't save footer content", "danger");
    } finally {
      if (footerContentSaveBtn) {
        footerContentSaveBtn.disabled = false;
        footerContentSaveBtn.textContent = "Save footer content";
      }
    }
  });
}

loadSettings();
loadCategories();
loadCareerDivisions();
