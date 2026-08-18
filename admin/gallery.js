/* ============================================
   Gallery — data + rendering
   Now backed by the server's /api/gallery routes
   instead of a local array that reset on refresh.
   ============================================ */

const thumbPalette = [
  "linear-gradient(135deg,#1E5FBF,#4C8CE0)",
  "linear-gradient(135deg,#D97706,#F2B347)",
  "linear-gradient(135deg,#16A34A,#5CD489)",
  "linear-gradient(135deg,#DC2626,#F27878)",
  "linear-gradient(135deg,#7C3AED,#B794F6)",
];

let photos = [];

const grid = document.getElementById("galleryGrid");
const galleryEmpty = document.getElementById("galleryEmpty");
const galleryCount = document.getElementById("galleryCount");

// Pulls the current list from the server and re-renders.
// Called on page load, and again after every add/edit/delete
// so the screen always matches what's actually saved.
async function loadPhotos() {
  const res = await fetch("/api/gallery");
  photos = await res.json();
  renderGallery();
}

function renderGallery() {
  grid.innerHTML = "";
  galleryEmpty.style.display = photos.length ? "none" : "block";
  galleryCount.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"}`;

  photos.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "gallery-admin-card";
    const thumbInner = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" style="width:100%;height:100%;object-fit:cover;">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>`;
    card.innerHTML = `
      <div class="gallery-admin-thumb" style="background:${thumbPalette[i % thumbPalette.length]}">
        ${thumbInner}
      </div>
      <div class="gallery-admin-body">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${nl2br(escapeHtml(p.desc))}</p>
        <div class="gallery-admin-actions">
          <button class="btn btn-secondary btn-sm" onclick="openPhotoModal('${p.id}')">Edit</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="deletePhoto('${p.id}')">Delete</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Add / Edit modal ---------- */

function openPhotoModal(id) {
  const form = document.getElementById("photoForm");
  form.reset();
  clearPhotoErrors();

  const preview = document.getElementById("photoCurrentPreview");
  const previewImg = document.getElementById("photoCurrentImg");

  if (id) {
    const p = photos.find((x) => x.id === id);
    document.getElementById("photoModalTitle").textContent = "Edit photo";
    document.getElementById("photoId").value = p.id;
    document.getElementById("photoTitle").value = p.title;
    document.getElementById("photoDesc").value = p.desc;

    // File inputs can't be pre-filled for security reasons, so instead
    // we show the existing photo and let the file field stay empty
    // (empty = "keep the current photo" when the form is submitted).
    if (p.image) {
      previewImg.src = p.image;
      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  } else {
    document.getElementById("photoModalTitle").textContent = "Upload photo";
    document.getElementById("photoId").value = "";
    preview.style.display = "none";
  }

  openModal("photoModalOverlay");
}

function clearPhotoErrors() {
  document.querySelectorAll("#photoForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

document.getElementById("photoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearPhotoErrors();

  const title = document.getElementById("photoTitle").value.trim();
  const desc = document.getElementById("photoDesc").value.trim();
  const id = document.getElementById("photoId").value;
  const fileInput = document.getElementById("photoImage");
  const file = fileInput.files[0]; // undefined if nothing was chosen

  let valid = true;
  if (!title) { document.getElementById("field-photo-title").classList.add("has-error"); valid = false; }
  if (!desc) { document.getElementById("field-photo-desc").classList.add("has-error"); valid = false; }
  // A file is required when adding a new photo, optional when editing
  // (no file chosen while editing just means "keep the current one").
  if (!id && !file) { document.getElementById("field-photo-image").classList.add("has-error"); valid = false; }
  if (!valid) return;

  // FormData instead of JSON.stringify - this is what lets us send an
  // actual file alongside the text fields in one request. Don't set a
  // Content-Type header here; the browser sets it automatically with
  // the correct boundary for multipart data.
  const formData = new FormData();
  formData.append("title", title);
  formData.append("desc", desc);
  if (file) formData.append("photo", file);

  let res;
  if (id) {
    res = await fetch(`/api/gallery/${id}`, { method: "PUT", body: formData });
  } else {
    res = await fetch("/api/gallery", { method: "POST", body: formData });
  }

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Something went wrong." }));
    showToast(error, "danger");
    return;
  }

  showToast(id ? "Photo updated" : "Photo uploaded");
  closeModal("photoModalOverlay");
  await loadPhotos();
});

async function deletePhoto(id) {
  const p = photos.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${p.title}"? This can't be undone.`)) return;
  await fetch(`/api/gallery/${id}`, { method: "DELETE" });
  showToast("Photo deleted", "danger");
  await loadPhotos();
}

loadPhotos();
