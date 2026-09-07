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
  gitlab: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="m23.6 9.58-1.07-3.29a.95.95 0 0 0-.36-.45.97.97 0 0 0-.58-.13.98.98 0 0 0-.55.24.97.97 0 0 0-.29.5L18.8 12.4H5.2L3.25 6.45a.97.97 0 0 0-.29-.5.98.98 0 0 0-.55-.24.97.97 0 0 0-.58.13.95.95 0 0 0-.36.45L.4 9.58a1.29 1.29 0 0 0 .47 1.44L12 19.88l11.13-8.86a1.29 1.29 0 0 0 .47-1.44z"/></svg>',
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
  chess: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 22H5v-2h14v2zm-2-3H7l1.1-5.5h7.8L17 19zm-2.2-7H9.2l-.7-3.5h7l-.7 3.5zM12 2a3.5 3.5 0 0 1 3.5 3.5c0 1.05-.46 1.99-1.19 2.63l.69 2.37H9l.69-2.37A3.49 3.49 0 0 1 8.5 5.5 3.5 3.5 0 0 1 12 2z"/></svg>',
  steam: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.008l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12-5.373 12-12s-5.373-12-12-12z"/></svg>',
  patreon: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M14.82 2.41a7.28 7.28 0 0 0-7.28 7.28 7.28 7.28 0 0 0 7.28 7.28 7.28 7.28 0 0 0 7.28-7.28 7.28 7.28 0 0 0-7.28-7.28zM1.9 21.59h3.76V2.41H1.9v19.18z"/></svg>',
  dribbble: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm8.38 10.98a8.3 8.3 0 0 1-3.7-.85c.08-.2.15-.4.22-.61.7-2.02 1.05-3.83 1.05-3.83a8.03 8.03 0 0 1 2.43 5.29zM12 3.96c2.04 0 3.9.77 5.33 2.05-.08.18-.38 1.76-1.04 3.65-3.23-1.08-6.19-1.09-6.52-1.09-.17 0-.34 0-.52.01A8.04 8.04 0 0 1 12 3.96zM7.28 9.53c.18 0 .34 0 .5-.01.35 0 3.3.01 6.55 1.13-.26.73-.56 1.48-.9 2.22-3.83-1.18-7.56.03-7.73.08a8.07 8.07 0 0 1 1.58-3.42zm-3.32 3.82c.13-.04 2.87-.9 6.83.17-.4 1.08-.85 2.15-1.35 3.19-3.28-.97-5.06-2.99-5.48-3.36zm4.84 5.94c.48-.99.9-2.01 1.28-3.03 2.92.83 4.2 2.39 4.34 2.56a8.02 8.02 0 0 1-5.62.47zm7.04-1.28c-.2-.23-1.46-1.68-4.22-2.54.3-.67.58-1.34.82-2 .14.04.28.08.43.12 3.32.96 4.67.75 4.88.71-.24 1.43-.99 2.71-1.91 3.71z"/></svg>',
  behance: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M22 7h-7v2h7V7zm1.726 10c-.442 1.297-2.029 3-4.726 3-3.271 0-5.656-2.124-5.656-5.836 0-3.607 2.348-5.897 5.484-5.897 3.393 0 5.094 2.392 4.973 5.707h-7.669c.084 1.954 1.463 3.024 3.016 3.024 1.424 0 2.219-.77 2.578-1.503l2.004 1.505zm-4.887-5.116c-.053-1.288-.934-2.028-2.229-2.028-1.348 0-2.246.772-2.383 2.028h4.612zM7.29 11.283c.961-.531 1.516-1.42 1.516-2.585 0-2.23-1.748-3.698-4.488-3.698H0v14h4.664c2.81 0 4.793-1.637 4.793-4.103 0-1.579-.844-2.884-2.167-3.614zM2.844 7.644h1.619c1.17 0 1.895.586 1.895 1.621 0 1.057-.746 1.643-1.895 1.643H2.844V7.644zm1.879 8.712H2.844v-3.791h1.947c1.371 0 2.123.633 2.123 1.883 0 1.293-.822 1.908-2.091 1.908z"/></svg>',
  slack: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>',
  leetcode: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.102 17.93l-2.697 2.607c-.466.467-1.111.662-1.823.662s-1.357-.195-1.824-.662l-4.332-4.363c-.467-.467-.702-1.15-.702-1.863s.235-1.357.702-1.824l4.319-4.38c.467-.467 1.125-.645 1.837-.645s1.357.195 1.823.662l2.697 2.606c.514.515 1.365.497 1.9-.038.535-.536.553-1.387.039-1.901l-2.609-2.636a5.074 5.074 0 0 0-3.79-1.46c-1.571 0-3.033.619-4.143 1.733L3.13 12.39c-1.11 1.11-1.728 2.572-1.728 4.143s.618 3.033 1.728 4.143l4.332 4.364c1.11 1.11 2.572 1.728 4.143 1.728s3.033-.618 4.143-1.728l2.697-2.607c.514-.514.496-1.365-.039-1.901-.535-.535-1.386-.553-1.9-.039zM10.74 13.064h10.42c.747 0 1.352-.605 1.352-1.352s-.605-1.352-1.352-1.352H10.74c-.747 0-1.352.605-1.352 1.352s.605 1.352 1.352 1.352z"/></svg>',
  website: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
};

function getDomainFromUrl(url) {
  if (!url || typeof url !== "string") return "";
  let trimmed = url.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) trimmed = "https://" + trimmed;
  try {
    const u = new URL(trimmed);
    return u.hostname.replace(/^www\./i, "");
  } catch (e) {
    return "";
  }
}

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
  if (/gitlab/.test(combined)) return "gitlab";
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
  if (/chess(\.com)?/.test(combined)) return "chess";
  if (/steam(community|powered)?/.test(combined)) return "steam";
  if (/patreon/.test(combined)) return "patreon";
  if (/dribbble/.test(combined)) return "dribbble";
  if (/behance/.test(combined)) return "behance";
  if (/slack/.test(combined)) return "slack";
  if (/leetcode/.test(combined)) return "leetcode";
  return "website";
}

function renderSocialIconHtml(item = {}) {
  const customIcon = (item.icon || "").trim();
  const label = item.label || "Link";
  const url = (item.url || "").trim();

  if (customIcon) {
    const abs = typeof toAbsUrl === "function" ? toAbsUrl(customIcon) : customIcon;
    return `<img src="${escapeHtml(abs)}" alt="${escapeHtml(label)}" class="social-preview-img" style="width:18px;height:18px;object-fit:contain;display:block;" onerror="this.onerror=null;this.replaceWith(document.createRange().createContextualFragment('${SOCIAL_ICONS.website}'));">`;
  }

  const platform = detectSocialPlatform(label, url);
  if (platform !== "website" && SOCIAL_ICONS[platform]) {
    return SOCIAL_ICONS[platform];
  }

  const domain = getDomainFromUrl(url);
  if (domain && domain.includes(".")) {
    const gUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    const ddgUrl = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`;
    return `<img src="${gUrl}" alt="${escapeHtml(label)}" class="social-preview-img" style="width:18px;height:18px;object-fit:contain;display:block;border-radius:3px;" onerror="if(!this.dataset.triedDdg){this.dataset.triedDdg='1';this.src='${ddgUrl}';}else{this.onerror=null;this.replaceWith(document.createRange().createContextualFragment('${SOCIAL_ICONS.website}'));}">`;
  }

  return SOCIAL_ICONS.website;
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

function createSocialLinkRow(item = { label: "", url: "", icon: "" }) {
  const row = document.createElement("div");
  row.className = "social-link-row";
  row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-sm);flex-wrap:wrap;";

  const preview = document.createElement("div");
  preview.className = "social-preview-icon";
  preview.title = "Logo preview (auto-detected or custom)";
  preview.style.cssText = "width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-text);flex-shrink:0;overflow:hidden;";

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "social-label-input";
  labelInput.placeholder = "Platform (e.g. Chess)";
  labelInput.value = item.label || "";
  labelInput.style.cssText = "flex:0 0 140px;min-width:110px;";

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.className = "social-url-input";
  urlInput.placeholder = "https://...";
  urlInput.value = item.url || "";
  urlInput.style.cssText = "flex:1;min-width:160px;";

  let customIconPath = item.icon || "";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;align-items:center;gap:6px;flex-shrink:0;";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon";
  fileInput.style.display = "none";

  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.className = "btn btn-secondary btn-icon-only";
  uploadBtn.title = customIconPath ? "Change custom logo" : "Upload custom logo image";
  uploadBtn.style.cssText = "cursor:pointer;";
  uploadBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

  const customIconBadge = document.createElement("button");
  customIconBadge.type = "button";
  customIconBadge.className = "btn btn-danger-ghost btn-sm";
  customIconBadge.title = "Reset to auto-detected logo";
  customIconBadge.style.cssText = `cursor:pointer;font-size:11px;padding:2px 6px;display:${customIconPath ? "inline-flex" : "none"};align-items:center;gap:3px;`;
  customIconBadge.innerHTML = '<span>Custom</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-danger-ghost btn-icon-only remove-social-btn";
  removeBtn.title = "Remove link";
  removeBtn.style.cssText = "cursor:pointer;";
  removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function updateIcon() {
    preview.innerHTML = renderSocialIconHtml({
      label: labelInput.value,
      url: urlInput.value,
      icon: customIconPath,
    });
    if (customIconPath) {
      customIconBadge.style.display = "inline-flex";
      uploadBtn.title = "Change custom logo";
    } else {
      customIconBadge.style.display = "none";
      uploadBtn.title = "Upload custom logo image";
    }
  }

  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    if (!fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("photo", file);

    uploadBtn.disabled = true;
    try {
      const res = await fetch("/api/settings/social-icon", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Icon upload failed", "danger");
        return;
      }
      customIconPath = data.icon;
      showToast("Custom logo uploaded");
      updateIcon();
    } catch (e) {
      showToast("Failed to upload icon", "danger");
    } finally {
      uploadBtn.disabled = false;
      fileInput.value = "";
    }
  });

  customIconBadge.addEventListener("click", () => {
    customIconPath = "";
    updateIcon();
    showToast("Reset to auto-detected logo");
  });

  labelInput.addEventListener("input", updateIcon);
  urlInput.addEventListener("input", updateIcon);

  removeBtn.addEventListener("click", () => {
    row.remove();
    const rows = socialLinksList ? socialLinksList.querySelectorAll(".social-link-row") : [];
    updateSocialLinksCount(rows.length);
  });

  updateIcon();

  actions.appendChild(customIconBadge);
  actions.appendChild(uploadBtn);
  actions.appendChild(fileInput);
  actions.appendChild(removeBtn);

  row.appendChild(preview);
  row.appendChild(labelInput);
  row.appendChild(urlInput);
  row.appendChild(actions);

  row.getData = () => {
    const label = labelInput.value.trim();
    const url = urlInput.value.trim();
    if (!url) return null;
    const res = { label: label || "Link", url };
    if (customIconPath) res.icon = customIconPath;
    return res;
  };

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
    if (typeof row.getData === "function") {
      const data = row.getData();
      if (data) result.push(data);
    } else {
      const label = row.querySelector(".social-label-input")?.value.trim() || "";
      const url = row.querySelector(".social-url-input")?.value.trim() || "";
      if (url) {
        result.push({
          label: label || "Link",
          url,
        });
      }
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
    const newRow = createSocialLinkRow({ label: "", url: "", icon: "" });
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
