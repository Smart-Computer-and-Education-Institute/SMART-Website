/* ============================================
   Offers & Flyers — admin panel
   Backed by /api/offers routes.
   ============================================ */

let offers = [];
let activeFilter = "all";
let searchTerm = "";

const tableBody = document.getElementById("offerTableBody");
const emptyState = document.getElementById("offerEmptyState");
const offerCountEl = document.getElementById("offerCount");
const chipRow = document.getElementById("offerChipRow");

async function loadOffers() {
  const res = await fetch("/api/offers");
  if (!res.ok) {
    offers = [];
    renderOffers();
    return;
  }
  offers = await res.json();
  renderOffers();
}

function showOfferPhotoPreview(url) {
  const img = document.getElementById("preview-offerPhoto");
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = "block";
  } else {
    img.src = "";
    img.style.display = "none";
  }
}

const offerFileInput = document.getElementById("file-offerPhoto");
if (offerFileInput) {
  offerFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      showOfferPhotoPreview(url);
    }
  });
}

function renderOffers() {
  const rows = offers.filter((o) => {
    const matchesFilter = activeFilter === "all" || o.status === activeFilter;
    const matchesSearch =
      o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.tag && o.tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.description && o.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  tableBody.innerHTML = "";
  emptyState.style.display = rows.length ? "none" : "block";

  if (offerCountEl) {
    const total = offers.length;
    const active = offers.filter((o) => o.status === "active").length;
    offerCountEl.textContent = `${total} offer${total === 1 ? "" : "s"} · ${active} active`;
  }

  rows.forEach((o) => {
    const tr = document.createElement("tr");
    const thumbHtml = o.image
      ? `<img src="${escapeHtml(o.image)}" alt="" style="width:38px;height:38px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--color-border);">`
      : `<div style="width:38px;height:38px;border-radius:6px;background:var(--color-primary-soft,#eff6ff);color:var(--color-primary,#2563eb);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">🏷️</div>`;

    const ctaText = o.ctaLink ? `<a href="${escapeHtml(o.ctaLink)}" target="_blank" style="color:var(--color-primary);font-size:12.5px;">${escapeHtml(o.ctaLabel || "Learn more")} ↗</a>` : `<span style="color:var(--color-text-secondary);font-size:12.5px;">${escapeHtml(o.ctaLabel || "Learn more")}</span>`;

    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:12px;">
          ${thumbHtml}
          <div>
            <div class="cell-title">${escapeHtml(o.title)}</div>
            <div class="cell-sub">${nl2br(escapeHtml(o.description || ""))}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-blue">${escapeHtml(o.tag || "Special Offer")}</span></td>
      <td>${ctaText}</td>
      <td>${
        o.status === "active"
          ? '<span class="badge badge-green">Active</span>'
          : '<span class="badge badge-amber">Draft</span>'
      }</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit" onclick="openOfferModal('${o.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn btn-danger-ghost btn-sm btn-icon-only" title="Delete" onclick="deleteOffer('${o.id}')">
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

if (chipRow) {
  chipRow.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.getAttribute("data-filter");
    renderOffers();
  });
}

const searchInput = document.getElementById("offerSearchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderOffers();
  });
}

/* ---------- Add / Edit modal ---------- */

function openOfferModal(id) {
  const form = document.getElementById("offerForm");
  form.reset();
  clearOfferErrors();
  showOfferPhotoPreview("");
  const fileInput = document.getElementById("file-offerPhoto");
  if (fileInput) fileInput.value = "";

  if (id) {
    const o = offers.find((x) => x.id === id);
    document.getElementById("offerModalTitle").textContent = "Edit offer";
    document.getElementById("offerId").value               = o.id;
    document.getElementById("offerTitle").value            = o.title;
    document.getElementById("offerTag").value              = o.tag || "";
    document.getElementById("offerStatus").value           = o.status || "active";
    document.getElementById("offerDescription").value      = o.description || "";
    document.getElementById("offerCtaLabel").value         = o.ctaLabel || "";
    document.getElementById("offerCtaLink").value          = o.ctaLink || "";
    showOfferPhotoPreview(o.image || "");
  } else {
    document.getElementById("offerModalTitle").textContent = "Add offer";
    document.getElementById("offerId").value               = "";
    document.getElementById("offerTag").value              = "LIMITED TIME";
    document.getElementById("offerCtaLabel").value         = "Learn more";
    document.getElementById("offerCtaLink").value          = "Contact.html";
    showOfferPhotoPreview("");
  }

  openModal("offerModalOverlay");
}

function clearOfferErrors() {
  document.querySelectorAll("#offerForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

async function uploadOfferPhoto() {
  const fileInput = document.getElementById("file-offerPhoto");
  if (!fileInput || !fileInput.files.length) {
    showToast("Please choose a photo first.", "danger");
    return;
  }

  const id = document.getElementById("offerId").value;
  if (!id) {
    showToast("Photo will be uploaded automatically when you save the offer.", "neutral");
    return;
  }

  const btn = document.getElementById("offerPhotoUploadBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

  try {
    const fd = new FormData();
    fd.append("photo", fileInput.files[0]);

    const res = await fetch(`/api/offers/${id}/photo`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    showOfferPhotoPreview(data.image);
    fileInput.value = "";
    showToast("Photo updated successfully");
    await loadOffers();
  } catch (err) {
    showToast(err.message || "Upload failed — please try again.", "danger");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
  }
}

document.getElementById("offerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearOfferErrors();

  const title = document.getElementById("offerTitle").value.trim();
  const description = document.getElementById("offerDescription").value.trim();
  let valid = true;

  if (!title) {
    document.getElementById("field-offer-title").classList.add("has-error");
    valid = false;
  }
  if (!description) {
    document.getElementById("field-offer-description").classList.add("has-error");
    valid = false;
  }
  if (!valid) return;

  const id = document.getElementById("offerId").value;
  const data = {
    title,
    tag: document.getElementById("offerTag").value.trim() || "Special Offer",
    description,
    ctaLabel: document.getElementById("offerCtaLabel").value.trim() || "Learn more",
    ctaLink: document.getElementById("offerCtaLink").value.trim(),
    status: document.getElementById("offerStatus").value,
  };

  let savedOffer = null;

  if (id) {
    const res = await fetch(`/api/offers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      savedOffer = await res.json();
      showToast("Offer updated");
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Update failed — please try again.", "danger");
      return;
    }
  } else {
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      savedOffer = await res.json();
      showToast("Offer added");
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Could not add offer — please try again.", "danger");
      return;
    }
  }

  // Upload photo file if one was selected
  const fileInput = document.getElementById("file-offerPhoto");
  if (savedOffer && fileInput && fileInput.files.length > 0) {
    try {
      const fd = new FormData();
      fd.append("photo", fileInput.files[0]);
      const photoRes = await fetch(`/api/offers/${savedOffer.id}/photo`, {
        method: "POST",
        body: fd,
      });
      if (photoRes.ok) {
        showToast("Offer and photo saved");
      }
    } catch (err) {
      console.error("Could not upload offer photo", err);
    }
  }

  closeModal("offerModalOverlay");
  await loadOffers();
});

async function deleteOffer(id) {
  const o = offers.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${o.title}"? This can't be undone.`)) return;
  const res = await fetch(`/api/offers/${id}`, { method: "DELETE" });
  if (res.ok || res.status === 204) {
    showToast("Offer deleted", "danger");
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || "Delete failed — please try again.", "danger");
  }
  await loadOffers();
}

loadOffers();
