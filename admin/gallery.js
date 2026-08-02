/* ============================================
   Gallery — data + rendering
   ============================================ */

const thumbPalette = [
  "linear-gradient(135deg,#1E5FBF,#4C8CE0)",
  "linear-gradient(135deg,#D97706,#F2B347)",
  "linear-gradient(135deg,#16A34A,#5CD489)",
  "linear-gradient(135deg,#DC2626,#F27878)",
  "linear-gradient(135deg,#7C3AED,#B794F6)",
];

let photos = [
  {
    id: "p1",
    title: "Computer Lab Training",
    desc: "Students practicing MS Office skills in our fully equipped lab.",
  },
  {
    id: "p2",
    title: "Graduation Day 2025",
    desc: "Celebrating our students who completed their career-focused courses.",
  },
  {
    id: "p3",
    title: "Digital Marketing Workshop",
    desc: "Hands-on session on social media and ad campaign strategy.",
  },
];

const grid = document.getElementById("galleryGrid");
const galleryEmpty = document.getElementById("galleryEmpty");
const galleryCount = document.getElementById("galleryCount");

function renderGallery() {
  grid.innerHTML = "";
  galleryEmpty.style.display = photos.length ? "none" : "block";
  galleryCount.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"}`;

  photos.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "gallery-admin-card";
    card.innerHTML = `
      <div class="gallery-admin-thumb" style="background:${thumbPalette[i % thumbPalette.length]}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
      </div>
      <div class="gallery-admin-body">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.desc)}</p>
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

  if (id) {
    const p = photos.find((x) => x.id === id);
    document.getElementById("photoModalTitle").textContent = "Edit photo";
    document.getElementById("photoId").value = p.id;
    document.getElementById("photoTitle").value = p.title;
    document.getElementById("photoDesc").value = p.desc;
  } else {
    document.getElementById("photoModalTitle").textContent = "Upload photo";
    document.getElementById("photoId").value = "";
  }

  openModal("photoModalOverlay");
}

function clearPhotoErrors() {
  document.querySelectorAll("#photoForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

document.getElementById("photoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  clearPhotoErrors();

  const title = document.getElementById("photoTitle").value.trim();
  const desc = document.getElementById("photoDesc").value.trim();
  let valid = true;

  if (!title) { document.getElementById("field-photo-title").classList.add("has-error"); valid = false; }
  if (!desc) { document.getElementById("field-photo-desc").classList.add("has-error"); valid = false; }
  if (!valid) return;

  const id = document.getElementById("photoId").value;

  if (id) {
    const p = photos.find((x) => x.id === id);
    p.title = title;
    p.desc = desc;
    showToast("Photo updated");
  } else {
    photos.unshift({ id: "p" + Date.now(), title, desc });
    showToast("Photo uploaded");
  }

  closeModal("photoModalOverlay");
  renderGallery();
});

function deletePhoto(id) {
  const p = photos.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${p.title}"? This can't be undone.`)) return;
  photos = photos.filter((x) => x.id !== id);
  showToast("Photo deleted", "danger");
  renderGallery();
}

renderGallery();
