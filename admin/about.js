/* ============================================
   About Us admin page
   Backed by /api/about (singleton document) and
   /api/about/sections (custom sections).
   ============================================ */

const aboutForm = document.getElementById("aboutForm");
const aboutSaveBtn = document.getElementById("aboutSaveBtn");

const PHOTO_SLOTS = ["founderPhoto", "storyPhoto", "missionPhoto", "visionPhoto", "whyPhoto"];

let customSections = [];
const customSectionsList = document.getElementById("customSectionsList");
const customSectionsEmpty = document.getElementById("customSectionsEmpty");

const sectionForm = document.getElementById("sectionForm");
const sectionIdInput = document.getElementById("sectionId");
const secHeadingInput = document.getElementById("secHeading");
const secTextInput = document.getElementById("secText");
const fileSecPhoto = document.getElementById("file-secPhoto");
const previewSecPhoto = document.getElementById("preview-secPhoto");
const sectionSubmitBtn = document.getElementById("sectionSubmitBtn");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function showPhotoPreview(slot, url) {
  const img = document.getElementById("preview-" + slot);
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }
}

function showSecPhotoPreview(url) {
  if (!previewSecPhoto) return;
  if (url) {
    previewSecPhoto.src = url;
    previewSecPhoto.style.display = "block";
  } else {
    previewSecPhoto.src = "";
    previewSecPhoto.style.display = "none";
  }
}

if (fileSecPhoto) {
  fileSecPhoto.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      showSecPhotoPreview(url);
    }
  });
}

async function loadAbout() {
  try {
    const res = await fetch("/api/about");
    const data = await res.json();

    document.getElementById("aboutFounderName").value = data.founderName || "";
    document.getElementById("aboutFounderRole").value = data.founderRole || "";
    document.getElementById("aboutFounderOrg").value = data.founderOrg || "";
    document.getElementById("aboutFounderExp").value = data.founderExp || "";
    document.getElementById("aboutFounderMessage").value = data.founderMessage || "";
    document.getElementById("aboutFounderSignoff").value = data.founderSignoff || "";
    document.getElementById("aboutFounderSignature").value = data.founderSignature || "";
    document.getElementById("aboutOurStoryHeading").value = data.ourStoryHeading || "";
    document.getElementById("aboutOurStoryText").value = data.ourStoryText || "";
    document.getElementById("aboutOurMissionHeading").value = data.ourMissionHeading || "";
    document.getElementById("aboutOurMissionText").value = data.ourMissionText || "";
    document.getElementById("aboutOurVisionHeading").value = data.ourVisionHeading || "";
    document.getElementById("aboutOurVisionText").value = data.ourVisionText || "";
    document.getElementById("aboutWhyChooseUsHeading").value = data.whyChooseUsHeading || "";
    document.getElementById("aboutWhyChooseUsText").value = data.whyChooseUsText || "";

    // Populate photo previews for fixed slots
    PHOTO_SLOTS.forEach((slot) => showPhotoPreview(slot, data[slot] || ""));

    // Populate custom sections
    customSections = Array.isArray(data.customSections) ? data.customSections : [];
    renderCustomSections();
  } catch (err) {
    console.error("Could not load About data:", err);
  }
}

async function loadCustomSections() {
  try {
    const res = await fetch("/api/about/sections");
    if (!res.ok) return;
    customSections = await res.json();
    renderCustomSections();
  } catch (err) {
    console.error("Could not load custom sections:", err);
  }
}

function renderCustomSections() {
  if (!customSectionsList || !customSectionsEmpty) return;

  customSections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (!customSections.length) {
    customSectionsList.innerHTML = "";
    customSectionsEmpty.style.display = "block";
    return;
  }

  customSectionsEmpty.style.display = "none";
  customSectionsList.innerHTML = customSections
    .map((sec, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === customSections.length - 1;

      const thumbHtml = sec.photo
        ? `<img src="${escapeHtml(sec.photo)}" alt="" style="width:46px;height:46px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--color-border);">`
        : `<div style="width:46px;height:46px;border-radius:6px;background:var(--color-primary-soft);color:var(--color-primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;">📄</div>`;

      return `
        <div style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:12px 14px;display:flex;align-items:center;gap:14px;background:var(--color-surface);">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <button type="button" class="btn btn-secondary btn-sm btn-icon-only" style="width:24px;height:24px;padding:0;font-size:10px;" title="Move up" onclick="moveSection('${sec.id}', -1)" ${isFirst ? "disabled" : ""}>▲</button>
            <button type="button" class="btn btn-secondary btn-sm btn-icon-only" style="width:24px;height:24px;padding:0;font-size:10px;" title="Move down" onclick="moveSection('${sec.id}', 1)" ${isLast ? "disabled" : ""}>▼</button>
          </div>
          ${thumbHtml}
          <div style="flex:1;min-width:0;">
            <strong style="font-size:13.5px;color:var(--color-text);display:block;margin-bottom:2px;">${escapeHtml(sec.heading)}</strong>
            <p style="margin:0;font-size:12px;color:var(--color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(sec.text || "No description")}</p>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm btn-icon-only" title="Edit" onclick="openSectionModal('${sec.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button type="button" class="btn btn-danger-ghost btn-sm btn-icon-only" title="Delete" onclick="deleteSection('${sec.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
            </button>
          </div>
        </div>`;
    })
    .join("");
}

async function moveSection(id, direction) {
  const idx = customSections.findIndex((s) => s.id === id);
  if (idx === -1) return;

  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= customSections.length) return;

  const currentSec = customSections[idx];
  const targetSec = customSections[targetIdx];

  const tempOrder = currentSec.order || idx + 1;
  const newCurrentOrder = targetSec.order || targetIdx + 1;
  const newTargetOrder = tempOrder === newCurrentOrder ? (direction > 0 ? newCurrentOrder + 1 : newCurrentOrder - 1) : tempOrder;

  currentSec.order = newCurrentOrder;
  targetSec.order = newTargetOrder;

  renderCustomSections();

  try {
    await Promise.all([
      fetch(`/api/about/sections/${currentSec.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newCurrentOrder }),
      }),
      fetch(`/api/about/sections/${targetSec.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newTargetOrder }),
      }),
    ]);
    showToast("Section order updated");
    await loadCustomSections();
  } catch (err) {
    showToast("Could not update order.", "danger");
    await loadCustomSections();
  }
}

function openSectionModal(id) {
  sectionForm.reset();
  showSecPhotoPreview("");
  if (fileSecPhoto) fileSecPhoto.value = "";

  if (id) {
    const sec = customSections.find((s) => s.id === id);
    if (!sec) return;

    document.getElementById("sectionModalTitle").textContent = "Edit Section";
    sectionIdInput.value = sec.id;
    secHeadingInput.value = sec.heading || "";
    secTextInput.value = sec.text || "";
    showSecPhotoPreview(sec.photo || "");
  } else {
    document.getElementById("sectionModalTitle").textContent = "Add Section";
    sectionIdInput.value = "";
    secHeadingInput.value = "";
    secTextInput.value = "";
  }

  openModal("sectionModalOverlay");
}

sectionForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = sectionIdInput.value;
  const heading = secHeadingInput.value.trim();
  const text = secTextInput.value.trim();

  if (!heading) {
    showToast("Please enter a section heading.", "danger");
    return;
  }

  sectionSubmitBtn.disabled = true;
  sectionSubmitBtn.textContent = "Saving…";

  try {
    let savedSection = null;

    if (id) {
      const res = await fetch(`/api/about/sections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heading, text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      savedSection = await res.json();
    } else {
      const res = await fetch("/api/about/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heading, text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Creation failed");
      }
      savedSection = await res.json();
    }

    const savedId = savedSection.id || id;
    const file = fileSecPhoto.files && fileSecPhoto.files[0];
    if (file && savedId) {
      const fd = new FormData();
      fd.append("photo", file);
      const photoRes = await fetch(`/api/about/sections/${savedId}/photo`, {
        method: "POST",
        body: fd,
      });
      if (!photoRes.ok) {
        console.error("Photo upload failed");
      }
    }

    closeModal("sectionModalOverlay");
    showToast(id ? "Section updated successfully" : "Section added successfully");
    await loadCustomSections();
  } catch (err) {
    showToast(err.message || "Failed to save section.", "danger");
  } finally {
    sectionSubmitBtn.disabled = false;
    sectionSubmitBtn.textContent = "Save Section";
  }
});

async function deleteSection(id) {
  const sec = customSections.find((s) => s.id === id);
  const name = sec ? sec.heading : "this section";
  if (!confirmDelete(`Delete section "${name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`/api/about/sections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Delete failed");
    }
    showToast("Section deleted", "danger");
    await loadCustomSections();
  } catch (err) {
    showToast(err.message || "Could not delete section.", "danger");
  }
}

// Fixed section form submission
aboutForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    founderName: document.getElementById("aboutFounderName").value.trim(),
    founderRole: document.getElementById("aboutFounderRole").value.trim(),
    founderOrg: document.getElementById("aboutFounderOrg").value.trim(),
    founderExp: document.getElementById("aboutFounderExp").value.trim(),
    founderMessage: document.getElementById("aboutFounderMessage").value.trim(),
    founderSignoff: document.getElementById("aboutFounderSignoff").value.trim(),
    founderSignature: document.getElementById("aboutFounderSignature").value.trim(),
    ourStoryHeading: document.getElementById("aboutOurStoryHeading").value.trim(),
    ourStoryText: document.getElementById("aboutOurStoryText").value.trim(),
    ourMissionHeading: document.getElementById("aboutOurMissionHeading").value.trim(),
    ourMissionText: document.getElementById("aboutOurMissionText").value.trim(),
    ourVisionHeading: document.getElementById("aboutOurVisionHeading").value.trim(),
    ourVisionText: document.getElementById("aboutOurVisionText").value.trim(),
    whyChooseUsHeading: document.getElementById("aboutWhyChooseUsHeading").value.trim(),
    whyChooseUsText: document.getElementById("aboutWhyChooseUsText").value.trim(),
  };

  aboutSaveBtn.disabled = true;
  aboutSaveBtn.textContent = "Saving…";

  try {
    const res = await fetch("/api/about", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Save failed");
    }

    showToast("About Us updated");
    await loadAbout();
  } catch (err) {
    showToast(err.message || "Couldn't save About Us", "danger");
  } finally {
    aboutSaveBtn.disabled = false;
    aboutSaveBtn.textContent = "Save About Us text";
  }
});

// Upload a single photo for one fixed About Us section slot
async function uploadAboutPhoto(slot) {
  const fileInput = document.getElementById("file-" + slot);
  if (!fileInput || !fileInput.files.length) {
    showToast("Please choose a photo first.", "danger");
    return;
  }

  const fieldDiv = document.getElementById("field-" + slot);
  const btn = fieldDiv ? fieldDiv.querySelector("button") : null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Uploading…";
  }

  try {
    const fd = new FormData();
    fd.append("photo", fileInput.files[0]);

    const res = await fetch(`/api/about/photo/${slot}`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    showPhotoPreview(slot, data[slot]);
    fileInput.value = "";
    showToast("Photo updated successfully");
  } catch (err) {
    showToast(err.message || "Upload failed — please try again.", "danger");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Upload Photo";
    }
  }
}

// Global scope for onclick handlers
window.openSectionModal = openSectionModal;
window.deleteSection = deleteSection;
window.moveSection = moveSection;
window.uploadAboutPhoto = uploadAboutPhoto;

loadAbout();
