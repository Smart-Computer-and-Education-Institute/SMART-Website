/* ============================================
   About Us admin page
   Backed by /api/about (singleton document).
   On load: GET /api/about → populate form + photo previews.
   On submit: PUT /api/about → toast success/error.
   Photo uploads: POST /api/about/photo/:slot → toast + preview update.
   ============================================ */

const aboutForm    = document.getElementById("aboutForm");
const aboutSaveBtn = document.getElementById("aboutSaveBtn");

const PHOTO_SLOTS = ["founderPhoto", "storyPhoto", "missionPhoto", "visionPhoto", "whyPhoto"];

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

async function loadAbout() {
  const res  = await fetch("/api/about");
  const data = await res.json();

  document.getElementById("aboutFounderName").value      = data.founderName      || "";
  document.getElementById("aboutFounderRole").value      = data.founderRole      || "";
  document.getElementById("aboutFounderOrg").value       = data.founderOrg       || "";
  document.getElementById("aboutFounderExp").value       = data.founderExp       || "";
  document.getElementById("aboutFounderMessage").value   = data.founderMessage   || "";
  document.getElementById("aboutFounderSignoff").value   = data.founderSignoff   || "";
  document.getElementById("aboutFounderSignature").value = data.founderSignature || "";
  document.getElementById("aboutOurStoryHeading").value  = data.ourStoryHeading  || "";
  document.getElementById("aboutOurStoryText").value     = data.ourStoryText     || "";
  document.getElementById("aboutOurMissionHeading").value= data.ourMissionHeading|| "";
  document.getElementById("aboutOurMissionText").value   = data.ourMissionText   || "";
  document.getElementById("aboutOurVisionHeading").value = data.ourVisionHeading || "";
  document.getElementById("aboutOurVisionText").value    = data.ourVisionText    || "";
  document.getElementById("aboutWhyChooseUsHeading").value = data.whyChooseUsHeading || "";
  document.getElementById("aboutWhyChooseUsText").value  = data.whyChooseUsText  || "";

  // Populate photo previews for any slot that already has an uploaded image
  PHOTO_SLOTS.forEach(slot => showPhotoPreview(slot, data[slot] || ""));
}

aboutForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    founderName:       document.getElementById("aboutFounderName").value.trim(),
    founderRole:       document.getElementById("aboutFounderRole").value.trim(),
    founderOrg:        document.getElementById("aboutFounderOrg").value.trim(),
    founderExp:        document.getElementById("aboutFounderExp").value.trim(),
    founderMessage:    document.getElementById("aboutFounderMessage").value.trim(),
    founderSignoff:    document.getElementById("aboutFounderSignoff").value.trim(),
    founderSignature:  document.getElementById("aboutFounderSignature").value.trim(),
    ourStoryHeading:   document.getElementById("aboutOurStoryHeading").value.trim(),
    ourStoryText:      document.getElementById("aboutOurStoryText").value.trim(),
    ourMissionHeading: document.getElementById("aboutOurMissionHeading").value.trim(),
    ourMissionText:    document.getElementById("aboutOurMissionText").value.trim(),
    ourVisionHeading:  document.getElementById("aboutOurVisionHeading").value.trim(),
    ourVisionText:     document.getElementById("aboutOurVisionText").value.trim(),
    whyChooseUsHeading:document.getElementById("aboutWhyChooseUsHeading").value.trim(),
    whyChooseUsText:   document.getElementById("aboutWhyChooseUsText").value.trim(),
  };

  aboutSaveBtn.disabled    = true;
  aboutSaveBtn.textContent = "Saving…";

  try {
    const res = await fetch("/api/about", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Save failed");
    }

    showToast("About Us updated");
    await loadAbout(); // re-pull to reflect exactly what was saved
  } catch (err) {
    showToast(err.message || "Couldn't save About Us", "danger");
  } finally {
    aboutSaveBtn.disabled    = false;
    aboutSaveBtn.textContent = "Save About Us";
  }
});

// Upload a single photo for one About Us section slot.
// Sends multipart/form-data to POST /api/about/photo/:slot.
async function uploadAboutPhoto(slot) {
  const fileInput = document.getElementById("file-" + slot);
  if (!fileInput || !fileInput.files.length) {
    showToast("Please choose a photo first.", "danger");
    return;
  }

  const fieldDiv = document.getElementById("field-" + slot);
  const btn = fieldDiv ? fieldDiv.querySelector("button") : null;
  if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

  try {
    const fd = new FormData();
    fd.append("photo", fileInput.files[0]);

    const res = await fetch(`/api/about/photo/${slot}`, {
      method: "POST",
      body:   fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    showPhotoPreview(slot, data[slot]);
    fileInput.value = ""; // clear picker so the same file can be re-selected if needed
    showToast("Photo updated successfully");
  } catch (err) {
    showToast(err.message || "Upload failed — please try again.", "danger");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
  }
}

loadAbout();
