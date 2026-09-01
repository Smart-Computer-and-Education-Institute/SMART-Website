/* ============================================
   Site Popups Management — admin panel
   Backed by /api/popups and /api/public/site-popups routes.
   ============================================ */

let popups = [];
let allOffers = [];
let allNotices = [];
let activeFilter = "all";
let searchTerm = "";
let currentUploadedImageUrl = "";
let currentSource = "custom";

const tableBody = document.getElementById("popupTableBody");
const emptyState = document.getElementById("popupEmptyState");
const popupCountEl = document.getElementById("popupCount");
const chipRow = document.getElementById("popupChipRow");
const searchInput = document.getElementById("popupSearchInput");

const popupForm = document.getElementById("popupForm");
const popupIdInput = document.getElementById("popupId");
const popupNameInput = document.getElementById("popupName");
const popupEnabledInput = document.getElementById("popupEnabled");

const srcOptCustom = document.getElementById("srcOptCustom");
const srcOptOffer = document.getElementById("srcOptOffer");
const srcOptNotice = document.getElementById("srcOptNotice");

const customSourceBlock = document.getElementById("customSourceBlock");
const offerSourceBlock = document.getElementById("offerSourceBlock");
const noticeSourceBlock = document.getElementById("noticeSourceBlock");

const popupOfferSelect = document.getElementById("popupOfferSelect");
const offerPreviewCard = document.getElementById("offerPreviewCard");
const offerPreviewImg = document.getElementById("offerPreviewImg");
const offerPreviewTitle = document.getElementById("offerPreviewTitle");
const offerPreviewDesc = document.getElementById("offerPreviewDesc");

const popupNoticeSelect = document.getElementById("popupNoticeSelect");
const noticePreviewCard = document.getElementById("noticePreviewCard");
const noticePreviewTitle = document.getElementById("noticePreviewTitle");
const noticePreviewDesc = document.getElementById("noticePreviewDesc");

const popupTitleInput = document.getElementById("popupTitle");
const popupMessageInput = document.getElementById("popupMessage");
const previewPopupPhoto = document.getElementById("preview-popupPhoto");
const filePopupPhoto = document.getElementById("file-popupPhoto");
const popupPhotoUploadBtn = document.getElementById("popupPhotoUploadBtn");

const popupCtaLabelInput = document.getElementById("popupCtaLabel");
const popupCtaLinkInput = document.getElementById("popupCtaLink");
const popupFrequencySelect = document.getElementById("popupFrequency");

const toggleAdvancedBtn = document.getElementById("toggleAdvancedBtn");
const advancedToggleIcon = document.getElementById("advancedToggleIcon");
const advancedSectionBox = document.getElementById("advancedSectionBox");

const popupStartDateInput = document.getElementById("popupStartDate");
const popupEndDateInput = document.getElementById("popupEndDate");
const popupStartTimeInput = document.getElementById("popupStartTime");
const popupEndTimeInput = document.getElementById("popupEndTime");
const weekdayGroup = document.getElementById("weekdayGroup");

const modalPreviewBtn = document.getElementById("modalPreviewBtn");
const popupSubmitBtn = document.getElementById("popupSubmitBtn");

// Preview modal elements
const previewModalImageWrap = document.getElementById("previewModalImageWrap");
const previewModalImage = document.getElementById("previewModalImage");
const previewModalTag = document.getElementById("previewModalTag");
const previewModalTitle = document.getElementById("previewModalTitle");
const previewModalMessage = document.getElementById("previewModalMessage");
const previewModalBtn = document.getElementById("previewModalBtn");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function nl2br(escapedStr) {
  return escapedStr.replace(/\n/g, "<br>");
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getPopupStatus(p, now = new Date()) {
  if (!p.enabled) {
    return { label: "Disabled", badgeClass: "badge-gray", filterKey: "disabled" };
  }

  const sched = p.schedule || {};
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (sched.startDate && todayStr < sched.startDate) {
    return { label: "Scheduled", badgeClass: "badge-blue", filterKey: "scheduled" };
  }
  if (sched.endDate && todayStr > sched.endDate) {
    return { label: "Expired", badgeClass: "badge-amber", filterKey: "expired" };
  }

  if (Array.isArray(sched.daysOfWeek) && sched.daysOfWeek.length > 0) {
    if (!sched.daysOfWeek.includes(now.getDay())) {
      return { label: "Scheduled", badgeClass: "badge-blue", filterKey: "scheduled" };
    }
  }

  if (sched.startTime || sched.endTime) {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${hours}:${minutes}`;

    if (sched.startTime && currentTimeStr < sched.startTime) {
      return { label: "Scheduled", badgeClass: "badge-blue", filterKey: "scheduled" };
    }
    if (sched.endTime && currentTimeStr > sched.endTime) {
      return { label: "Scheduled", badgeClass: "badge-blue", filterKey: "scheduled" };
    }
  }

  return { label: "Active now", badgeClass: "badge-green", filterKey: "active" };
}

function formatScheduleSummary(p) {
  const sched = p.schedule || {};
  const parts = [];

  if (sched.startDate && sched.endDate) {
    parts.push(`${sched.startDate} to ${sched.endDate}`);
  } else if (sched.startDate) {
    parts.push(`From ${sched.startDate}`);
  } else if (sched.endDate) {
    parts.push(`Until ${sched.endDate}`);
  }

  if (Array.isArray(sched.daysOfWeek) && sched.daysOfWeek.length > 0 && sched.daysOfWeek.length < 7) {
    parts.push(sched.daysOfWeek.map((d) => DAY_NAMES[d]).join(", "));
  }

  if (sched.startTime && sched.endTime) {
    parts.push(`${sched.startTime}–${sched.endTime}`);
  } else if (sched.startTime) {
    parts.push(`From ${sched.startTime}`);
  } else if (sched.endTime) {
    parts.push(`Until ${sched.endTime}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Always active";
}

async function loadPopups() {
  try {
    const [popupsRes, offersRes, noticesRes] = await Promise.all([
      fetch("/api/popups"),
      fetch("/api/offers"),
      fetch("/api/notices"),
    ]);

    popups = popupsRes.ok ? await popupsRes.json() : [];
    allOffers = offersRes.ok ? await offersRes.json() : [];
    allNotices = noticesRes.ok ? await noticesRes.json() : [];

    populateSourceDropdowns();
    renderPopups();
  } catch (err) {
    console.error("Error loading popups:", err);
    popups = [];
    renderPopups();
  }
}

function populateSourceDropdowns() {
  popupOfferSelect.innerHTML = '<option value="">-- Choose an offer --</option>';
  allOffers.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = `${o.title || "Untitled"} (${o.status === "active" ? "Active" : "Draft"})`;
    popupOfferSelect.appendChild(opt);
  });

  popupNoticeSelect.innerHTML = '<option value="">-- Choose a notice --</option>';
  allNotices.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n.id;
    opt.textContent = `${n.title || "Untitled"} (${n.status === "published" ? "Published" : "Draft"})`;
    popupNoticeSelect.appendChild(opt);
  });
}

function renderPopups() {
  const now = new Date();

  // Keep sorted by priority ascending
  popups.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const rows = popups.filter((p) => {
    const status = getPopupStatus(p, now);
    const matchesFilter = activeFilter === "all" || status.filterKey === activeFilter;
    const matchesSearch =
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.message && p.message.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  tableBody.innerHTML = "";
  emptyState.style.display = rows.length ? "none" : "block";

  if (popupCountEl) {
    const total = popups.length;
    const activeCount = popups.filter((p) => getPopupStatus(p, now).filterKey === "active").length;
    popupCountEl.textContent = `${total} popup${total === 1 ? "" : "s"} · ${activeCount} active now`;
  }

  rows.forEach((p, idx) => {
    const tr = document.createElement("tr");
    const status = getPopupStatus(p, now);

    const isFirst = idx === 0;
    const isLast = idx === rows.length - 1;

    let sourceBadge = '<span class="badge badge-gray">Custom</span>';
    let contentSnippet = p.title || p.message || "Custom message";
    let thumbHtml = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--color-border);">`
      : `<div style="width:36px;height:36px;border-radius:6px;background:var(--color-primary-soft);color:var(--color-primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">💬</div>`;

    if (p.source === "offer") {
      sourceBadge = '<span class="badge badge-blue">Offer</span>';
      const offer = allOffers.find((o) => o.id === p.refId);
      if (offer) {
        contentSnippet = `Offer: ${offer.title}`;
        if (offer.image) {
          thumbHtml = `<img src="${escapeHtml(offer.image)}" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--color-border);">`;
        }
      } else {
        contentSnippet = `<span style="color:var(--color-danger);">(Missing offer ref: ${escapeHtml(p.refId)})</span>`;
      }
    } else if (p.source === "notice") {
      sourceBadge = '<span class="badge badge-amber">Notice</span>';
      const notice = allNotices.find((n) => n.id === p.refId);
      contentSnippet = notice ? `Notice: ${notice.title}` : `<span style="color:var(--color-danger);">(Missing notice ref: ${escapeHtml(p.refId)})</span>`;
    }

    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:12px;">
          ${thumbHtml}
          <div>
            <div class="cell-title">${escapeHtml(p.name || "Untitled popup")}</div>
            <div class="cell-sub">${contentSnippet}</div>
          </div>
        </div>
      </td>
      <td>${sourceBadge}</td>
      <td style="font-size:12.5px;color:var(--color-text-secondary);">${escapeHtml(formatScheduleSummary(p))}</td>
      <td><span class="badge ${status.badgeClass}">${status.label}</span></td>
      <td>
        <div class="row-actions" style="justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm btn-icon-only" style="width:28px;height:28px;padding:0;font-size:11px;" title="Move earlier in queue" onclick="reorderPopup('${p.id}', 'up')" ${isFirst ? "disabled" : ""}>▲</button>
          <button class="btn btn-secondary btn-sm btn-icon-only" style="width:28px;height:28px;padding:0;font-size:11px;" title="Move later in queue" onclick="reorderPopup('${p.id}', 'down')" ${isLast ? "disabled" : ""}>▼</button>
          <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit" onclick="openPopupModal('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn btn-danger-ghost btn-sm btn-icon-only" title="Delete" onclick="deletePopup('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/* ---------- Reordering ---------- */

async function reorderPopup(id, direction) {
  try {
    const res = await fetch(`/api/popups/${id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Could not reorder popup.", "danger");
      return;
    }

    popups = await res.json();
    renderPopups();
    showToast("Popup order updated");
  } catch (err) {
    showToast("Network error reordering popup.", "danger");
  }
}

/* ---------- Filters & Search ---------- */

if (chipRow) {
  chipRow.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.getAttribute("data-filter");
    renderPopups();
  });
}

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderPopups();
  });
}

/* ---------- Source Selection UI ---------- */

function setSource(source) {
  currentSource = source;
  [srcOptCustom, srcOptOffer, srcOptNotice].forEach((el) => el.classList.remove("selected"));
  customSourceBlock.style.display = "none";
  offerSourceBlock.style.display = "none";
  noticeSourceBlock.style.display = "none";

  if (source === "offer") {
    srcOptOffer.classList.add("selected");
    offerSourceBlock.style.display = "block";
    updateOfferPreview();
  } else if (source === "notice") {
    srcOptNotice.classList.add("selected");
    noticeSourceBlock.style.display = "block";
    updateNoticePreview();
  } else {
    srcOptCustom.classList.add("selected");
    customSourceBlock.style.display = "block";
  }
}

srcOptCustom.addEventListener("click", () => setSource("custom"));
srcOptOffer.addEventListener("click", () => setSource("offer"));
srcOptNotice.addEventListener("click", () => setSource("notice"));

function updateOfferPreview() {
  const selectedId = popupOfferSelect.value;
  const offer = allOffers.find((o) => o.id === selectedId);
  if (!offer) {
    offerPreviewCard.style.display = "none";
    return;
  }
  offerPreviewCard.style.display = "flex";
  offerPreviewTitle.textContent = offer.title || "Untitled Offer";
  offerPreviewDesc.textContent = offer.description ? offer.description.slice(0, 100) + "..." : "";
  if (offer.image) {
    offerPreviewImg.src = offer.image;
    offerPreviewImg.style.display = "block";
  } else {
    offerPreviewImg.style.display = "none";
  }
}

function updateNoticePreview() {
  const selectedId = popupNoticeSelect.value;
  const notice = allNotices.find((n) => n.id === selectedId);
  if (!notice) {
    noticePreviewCard.style.display = "none";
    return;
  }
  noticePreviewCard.style.display = "flex";
  noticePreviewTitle.textContent = notice.title || "Untitled Notice";
  noticePreviewDesc.textContent = notice.content ? notice.content.slice(0, 100) + "..." : "";
}

popupOfferSelect.addEventListener("change", updateOfferPreview);
popupNoticeSelect.addEventListener("change", updateNoticePreview);

function showPopupPhotoPreview(url) {
  currentUploadedImageUrl = url || "";
  if (url) {
    previewPopupPhoto.src = url;
    previewPopupPhoto.style.display = "block";
  } else {
    previewPopupPhoto.src = "";
    previewPopupPhoto.style.display = "none";
  }
}

if (filePopupPhoto) {
  filePopupPhoto.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      showPopupPhotoPreview(url);
    }
  });
}

// Upload button in edit mode or direct upload
popupPhotoUploadBtn.addEventListener("click", async () => {
  const file = filePopupPhoto.files && filePopupPhoto.files[0];
  if (!file) {
    showToast("Please choose an image file first.", "danger");
    return;
  }

  const editId = popupIdInput.value;
  if (!editId) {
    // Adding new popup: preview is already set, will upload upon submit
    showToast("Image selected for upload on save");
    return;
  }

  const formData = new FormData();
  formData.append("photo", file);

  popupPhotoUploadBtn.disabled = true;
  popupPhotoUploadBtn.textContent = "Uploading...";

  try {
    const res = await fetch(`/api/popups/${editId}/photo`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(data.error || "Failed to upload image.", "danger");
      return;
    }

    currentUploadedImageUrl = data.image;
    showPopupPhotoPreview(data.image);
    filePopupPhoto.value = "";
    showToast("Photo uploaded successfully");
  } catch (err) {
    showToast("Network error uploading photo.", "danger");
  } finally {
    popupPhotoUploadBtn.disabled = false;
    popupPhotoUploadBtn.textContent = "Upload";
  }
});

/* ---------- Advanced Section Toggle & Weekdays ---------- */

function setAdvancedExpanded(expanded) {
  advancedSectionBox.style.display = expanded ? "block" : "none";
  advancedToggleIcon.textContent = expanded ? "▴" : "▾";
}

toggleAdvancedBtn.addEventListener("click", () => {
  const isCurrentlyOpen = advancedSectionBox.style.display === "block";
  setAdvancedExpanded(!isCurrentlyOpen);
});

weekdayGroup.addEventListener("click", (e) => {
  const chip = e.target.closest(".weekday-chip");
  if (!chip) return;
  chip.classList.toggle("active");
});

function getSelectedWeekdays() {
  const activeChips = Array.from(weekdayGroup.querySelectorAll(".weekday-chip.active"));
  if (activeChips.length === 0 || activeChips.length === 7) {
    return [];
  }
  return activeChips.map((c) => parseInt(c.getAttribute("data-day"), 10)).sort((a, b) => a - b);
}

function setSelectedWeekdays(days = []) {
  weekdayGroup.querySelectorAll(".weekday-chip").forEach((c) => {
    const day = parseInt(c.getAttribute("data-day"), 10);
    c.classList.toggle("active", Array.isArray(days) && days.includes(day));
  });
}

/* ---------- Add / Edit Modal ---------- */

function clearPopupErrors() {
  document.querySelectorAll("#popupForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

function openPopupModal(id) {
  popupForm.reset();
  clearPopupErrors();
  showPopupPhotoPreview("");
  if (filePopupPhoto) filePopupPhoto.value = "";
  setSelectedWeekdays([]);

  if (id) {
    const p = popups.find((x) => x.id === id);
    if (!p) return;

    document.getElementById("popupModalTitle").textContent = "Edit popup";
    popupIdInput.value = p.id;
    popupNameInput.value = p.name || "";
    popupEnabledInput.checked = !!p.enabled;

    setSource(p.source || "custom");

    if (p.source === "offer" && p.refId) {
      popupOfferSelect.value = p.refId;
      updateOfferPreview();
    } else if (p.source === "notice" && p.refId) {
      popupNoticeSelect.value = p.refId;
      updateNoticePreview();
    }

    popupTitleInput.value = p.title || "";
    popupMessageInput.value = p.message || "";
    showPopupPhotoPreview(p.image || "");

    popupCtaLabelInput.value = p.ctaLabel || "Learn more";
    popupCtaLinkInput.value = p.ctaLink || "";
    popupFrequencySelect.value = p.frequency || "everyLoad";

    // Advanced fields
    const sched = p.schedule || {};
    popupStartDateInput.value = sched.startDate || "";
    popupEndDateInput.value = sched.endDate || "";
    popupStartTimeInput.value = sched.startTime || "";
    popupEndTimeInput.value = sched.endTime || "";
    setSelectedWeekdays(sched.daysOfWeek || []);

    const hasAdvanced =
      !!sched.startDate ||
      !!sched.endDate ||
      (Array.isArray(sched.daysOfWeek) && sched.daysOfWeek.length > 0) ||
      !!sched.startTime ||
      !!sched.endTime;

    setAdvancedExpanded(hasAdvanced);
  } else {
    document.getElementById("popupModalTitle").textContent = "Add popup";
    popupIdInput.value = "";
    popupNameInput.value = "";
    popupEnabledInput.checked = true;
    setSource("custom");
    setAdvancedExpanded(false);
  }

  openModal("popupModalOverlay");
}

/* ---------- Preview Modal ---------- */

function previewCurrentModalPopup() {
  let title = "";
  let message = "";
  let image = "";
  let tag = "";

  if (currentSource === "offer") {
    const selectedOffer = allOffers.find((o) => o.id === popupOfferSelect.value);
    if (selectedOffer) {
      title = selectedOffer.title || "Special Offer";
      message = selectedOffer.description || "";
      image = selectedOffer.image || "";
      tag = selectedOffer.tag || "Offer";
    } else {
      title = "No offer selected";
      message = "Please pick an offer from the dropdown.";
    }
  } else if (currentSource === "notice") {
    const selectedNotice = allNotices.find((n) => n.id === popupNoticeSelect.value);
    if (selectedNotice) {
      title = selectedNotice.title || "Important Notice";
      message = selectedNotice.content || "";
      tag = "Notice";
    } else {
      title = "No notice selected";
      message = "Please pick a notice from the dropdown.";
    }
  } else {
    title = popupTitleInput.value.trim() || "Announcement Title";
    message = popupMessageInput.value.trim() || "Your custom announcement message will appear here.";
    image = currentUploadedImageUrl || "";
    tag = "";
  }

  const ctaLabel = popupCtaLabelInput.value.trim() || "Learn more";

  previewModalTitle.textContent = title;
  previewModalMessage.innerHTML = nl2br(escapeHtml(message));
  previewModalBtn.textContent = ctaLabel;

  if (tag) {
    previewModalTag.textContent = tag;
    previewModalTag.style.display = "inline-block";
  } else {
    previewModalTag.style.display = "none";
  }

  if (image) {
    previewModalImage.src = image;
    previewModalImageWrap.style.display = "block";
  } else {
    previewModalImage.src = "";
    previewModalImageWrap.style.display = "none";
  }

  openModal("mockPopupPreviewModal");
}

modalPreviewBtn.addEventListener("click", previewCurrentModalPopup);

/* ---------- Form Submit (Create / Edit) ---------- */

popupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearPopupErrors();

  const id = popupIdInput.value;
  const name = popupNameInput.value.trim();
  if (!name) {
    document.getElementById("field-popupName").classList.add("has-error");
    showToast("Please enter a name for this popup.", "danger");
    return;
  }

  let refId = null;
  if (currentSource === "offer") {
    refId = popupOfferSelect.value;
    if (!refId) {
      showToast("Please choose an offer to feature.", "danger");
      return;
    }
  } else if (currentSource === "notice") {
    refId = popupNoticeSelect.value;
    if (!refId) {
      showToast("Please choose a notice to feature.", "danger");
      return;
    }
  }

  const schedule = {
    startDate: popupStartDateInput.value || null,
    endDate: popupEndDateInput.value || null,
    daysOfWeek: getSelectedWeekdays(),
    startTime: popupStartTimeInput.value || null,
    endTime: popupEndTimeInput.value || null,
  };

  const payload = {
    name,
    enabled: popupEnabledInput.checked,
    source: currentSource,
    refId,
    title: popupTitleInput.value.trim(),
    message: popupMessageInput.value.trim(),
    image: currentUploadedImageUrl || "",
    ctaLabel: popupCtaLabelInput.value.trim() || "Learn more",
    ctaLink: popupCtaLinkInput.value.trim(),
    frequency: popupFrequencySelect.value,
    schedule,
  };

  popupSubmitBtn.disabled = true;
  popupSubmitBtn.textContent = "Saving...";

  try {
    const url = id ? `/api/popups/${id}` : "/api/popups";
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(data.error || "Failed to save popup.", "danger");
      popupSubmitBtn.disabled = false;
      popupSubmitBtn.textContent = "Save popup";
      return;
    }

    const savedId = data.id || id;
    const file = filePopupPhoto.files && filePopupPhoto.files[0];
    if (file && savedId) {
      const fd = new FormData();
      fd.append("photo", file);
      const photoRes = await fetch(`/api/popups/${savedId}/photo`, {
        method: "POST",
        body: fd,
      });
      if (!photoRes.ok) {
        console.error("Could not upload popup photo");
      }
    }

    closeModal("popupModalOverlay");
    showToast(id ? "Popup updated successfully" : "Popup created successfully");
    await loadPopups();
  } catch (err) {
    showToast("Network error saving popup.", "danger");
  } finally {
    popupSubmitBtn.disabled = false;
    popupSubmitBtn.textContent = "Save popup";
  }
});

/* ---------- Delete Popup ---------- */

async function deletePopup(id) {
  const p = popups.find((x) => x.id === id);
  const name = p ? p.name : "this popup";
  if (!confirmDelete(`Delete popup "${name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`/api/popups/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Could not delete popup.", "danger");
      return;
    }
    showToast("Popup deleted", "danger");
    await loadPopups();
  } catch (err) {
    showToast("Network error deleting popup.", "danger");
  }
}

// Global scope for onclick handlers in table
window.openPopupModal = openPopupModal;
window.deletePopup = deletePopup;
window.reorderPopup = reorderPopup;

// Load popups on page start
loadPopups();
