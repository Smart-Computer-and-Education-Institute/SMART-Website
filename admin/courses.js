/* ============================================
   Courses — data + rendering
   Now backed by the server's /api/courses routes
   instead of a local array that reset on refresh.
   ============================================ */

let courses = [];
let activeFilter = "all";
let searchTerm = "";

const tableBody = document.getElementById("courseTableBody");
const emptyState = document.getElementById("emptyState");

// Pulls the current list from the server and re-renders.
// Called on page load, and again after every add/edit/delete
// so the screen always matches what's actually saved.
async function loadCourses() {
  const res = await fetch("/api/courses");
  courses = await res.json();
  renderCourses();
}

function renderCourses() {
  const rows = courses.filter((c) => {
    const matchesFilter = activeFilter === "all" || c.category === activeFilter;
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  tableBody.innerHTML = "";
  emptyState.style.display = rows.length ? "none" : "block";

  rows.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="cell-title">${escapeHtml(c.name)}</div>
        <div class="cell-sub">${escapeHtml(c.desc)}</div>
      </td>
      <td><span class="badge badge-blue">${escapeHtml(c.category)}</span></td>
      <td>${escapeHtml(c.duration)}</td>
      <td>${c.enrolled}</td>
      <td>${
        c.status === "active"
          ? '<span class="badge badge-green">Active</span>'
          : '<span class="badge badge-amber">Draft</span>'
      }</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit" onclick="openCourseModal('${c.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn btn-danger-ghost btn-sm btn-icon-only" title="Delete" onclick="deleteCourse('${c.id}')">
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
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Filters + search ---------- */

document.getElementById("chipRow").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll("#chipRow .chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeFilter = chip.getAttribute("data-filter");
  renderCourses();
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderCourses();
});

/* ---------- Add / Edit modal ---------- */

function openCourseModal(id) {
  const form = document.getElementById("courseForm");
  form.reset();
  clearErrors();

  if (id) {
    const c = courses.find((x) => x.id === id);
    document.getElementById("courseModalTitle").textContent = "Edit course";
    document.getElementById("courseId").value = c.id;
    document.getElementById("courseName").value = c.name;
    document.getElementById("courseCategory").value = c.category;
    document.getElementById("courseDuration").value = c.duration;
    document.getElementById("courseDesc").value = c.desc;
    document.getElementById("courseEnrolled").value = c.enrolled;
    document.getElementById("courseStatus").value = c.status;
  } else {
    document.getElementById("courseModalTitle").textContent = "Add course";
    document.getElementById("courseId").value = "";
  }

  openModal("courseModalOverlay");
}

function clearErrors() {
  document.querySelectorAll("#courseForm .form-field").forEach((f) => f.classList.remove("has-error"));
}

document.getElementById("courseForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  const name = document.getElementById("courseName").value.trim();
  const duration = document.getElementById("courseDuration").value.trim();
  const desc = document.getElementById("courseDesc").value.trim();
  let valid = true;

  if (!name) { document.getElementById("field-name").classList.add("has-error"); valid = false; }
  if (!duration) { document.getElementById("field-duration").classList.add("has-error"); valid = false; }
  if (!desc) { document.getElementById("field-desc").classList.add("has-error"); valid = false; }
  if (!valid) return;

  const id = document.getElementById("courseId").value;
  const data = {
    name,
    category: document.getElementById("courseCategory").value,
    duration,
    desc,
    enrolled: parseInt(document.getElementById("courseEnrolled").value, 10) || 0,
    status: document.getElementById("courseStatus").value,
  };

  if (id) {
    // Editing an existing course
    await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    showToast("Course updated");
  } else {
    // Creating a new one
    await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    showToast("Course added");
  }

  closeModal("courseModalOverlay");
  await loadCourses();
});

async function deleteCourse(id) {
  const c = courses.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${c.name}"? This can't be undone.`)) return;
  await fetch(`/api/courses/${id}`, { method: "DELETE" });
  showToast("Course deleted", "danger");
  await loadCourses();
}

loadCourses();
