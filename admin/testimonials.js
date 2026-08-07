/* ============================================
   Testimonials — data + rendering
   Backed by the server's /api/testimonials routes
   ============================================ */

let testimonials = [];

const grid = document.getElementById("testimonialGrid");
const testimonialEmpty = document.getElementById("testimonialEmpty");
const testimonialCount = document.getElementById("testimonialCount");

async function loadTestimonials() {
  const res = await fetch("/api/testimonials");
  testimonials = await res.json();
  renderTestimonials();
}

function renderTestimonials() {
  grid.innerHTML = "";
  testimonialEmpty.style.display = testimonials.length ? "none" : "block";
  if (testimonialCount) {
    testimonialCount.textContent = `${testimonials.length} testimonial${testimonials.length === 1 ? "" : "s"}`;
  }

  testimonials.forEach((t) => {
    const card = document.createElement("div");
    card.className = "testimonial-admin-card";
    const photoHtml = t.photo
      ? `<img src="${escapeHtml(t.photo)}" alt="${escapeHtml(t.name)}" class="testimonial-admin-avatar">`
      : `<div class="testimonial-admin-avatar testimonial-admin-avatar-placeholder">${escapeHtml(t.name.charAt(0).toUpperCase())}</div>`;
    card.innerHTML = `
      <div class="testimonial-admin-header">
        ${photoHtml}
        <div class="testimonial-admin-meta">
          <strong>${escapeHtml(t.name)}</strong>
          ${t.course ? `<span class="badge badge-blue">${escapeHtml(t.course)}</span>` : ""}
        </div>
      </div>
      <p class="testimonial-admin-text">"${escapeHtml(t.text)}"</p>
      <div class="testimonial-admin-actions">
        <button class="btn btn-secondary btn-sm" onclick="openTestimonialModal('${t.id}')">Edit</button>
        <button class="btn btn-danger-ghost btn-sm" onclick="deleteTestimonial('${t.id}')">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ---------- Add / Edit modal ---------- */

function openTestimonialModal(id) {
  const form = document.getElementById("testimonialForm");
  form.reset();
  clearTestimonialErrors();

  const preview = document.getElementById("testimonialCurrentPreview");
  const previewImg = document.getElementById("testimonialCurrentImg");

  if (id) {
    const t = testimonials.find((x) => x.id === id);
    document.getElementById("testimonialModalTitle").textContent = "Edit testimonial";
    document.getElementById("testimonialId").value = t.id;
    document.getElementById("testimonialName").value = t.name;
    document.getElementById("testimonialCourse").value = t.course || "";
    document.getElementById("testimonialText").value = t.text;
    if (t.photo) {
      previewImg.src = t.photo;
      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  } else {
    document.getElementById("testimonialModalTitle").textContent = "Add testimonial";
    document.getElementById("testimonialId").value = "";
    preview.style.display = "none";
  }

  openModal("testimonialModalOverlay");
}

function clearTestimonialErrors() {
  document.querySelectorAll("#testimonialForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

document.getElementById("testimonialForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearTestimonialErrors();

  const name = document.getElementById("testimonialName").value.trim();
  const text = document.getElementById("testimonialText").value.trim();
  const course = document.getElementById("testimonialCourse").value.trim();
  const id = document.getElementById("testimonialId").value;
  const fileInput = document.getElementById("testimonialPhoto");
  const file = fileInput.files[0];

  let valid = true;
  if (!name) { document.getElementById("field-t-name").classList.add("has-error"); valid = false; }
  if (!text) { document.getElementById("field-t-text").classList.add("has-error"); valid = false; }
  if (!valid) return;

  const formData = new FormData();
  formData.append("name", name);
  formData.append("text", text);
  formData.append("course", course);
  if (file) formData.append("photo", file);

  let res;
  if (id) {
    res = await fetch(`/api/testimonials/${id}`, { method: "PUT", body: formData });
  } else {
    res = await fetch("/api/testimonials", { method: "POST", body: formData });
  }

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Something went wrong." }));
    showToast(error, "danger");
    return;
  }

  showToast(id ? "Testimonial updated" : "Testimonial added");
  closeModal("testimonialModalOverlay");
  await loadTestimonials();
});

async function deleteTestimonial(id) {
  const t = testimonials.find((x) => x.id === id);
  if (!confirmDelete(`Delete testimonial by "${t.name}"? This can't be undone.`)) return;
  await fetch(`/api/testimonials/${id}`, { method: "DELETE" });
  showToast("Testimonial deleted", "danger");
  await loadTestimonials();
}

loadTestimonials();
