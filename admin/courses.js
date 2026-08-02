/* ============================================
   Courses — data + rendering
   ============================================ */

let courses = [
  {
    id: "c1",
    name: "MS Office Fundamentals",
    category: "Office",
    duration: "4 weeks",
    desc: "Word, Excel, and PowerPoint skills for everyday office work.",
    enrolled: 210,
    status: "active",
  },
  {
    id: "c2",
    name: "Graphic Design Mastery",
    category: "Design",
    duration: "8 weeks",
    desc: "Photoshop, Illustrator, and layout fundamentals for real client work.",
    enrolled: 96,
    status: "active",
  },
  {
    id: "c3",
    name: "Digital Marketing Essentials",
    category: "Marketing",
    duration: "6 weeks",
    desc: "Social media, ad campaigns, and analytics for small businesses.",
    enrolled: 134,
    status: "active",
  },
  {
    id: "c4",
    name: "Tally Accounting",
    category: "Accounting",
    duration: "5 weeks",
    desc: "Bookkeeping, GST, and inventory management in Tally.",
    enrolled: 88,
    status: "active",
  },
  {
    id: "c5",
    name: "Advanced Excel",
    category: "Office",
    duration: "3 weeks",
    desc: "Formulas, pivot tables, and dashboards for data-heavy roles.",
    enrolled: 0,
    status: "draft",
  },
];

let activeFilter = "all";
let searchTerm = "";

const tableBody = document.getElementById("courseTableBody");
const emptyState = document.getElementById("emptyState");

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

document.getElementById("courseForm").addEventListener("submit", (e) => {
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
    const c = courses.find((x) => x.id === id);
    Object.assign(c, data);
    showToast("Course updated");
  } else {
    courses.unshift({ id: "c" + Date.now(), ...data });
    showToast("Course added");
  }

  closeModal("courseModalOverlay");
  renderCourses();
});

function deleteCourse(id) {
  const c = courses.find((x) => x.id === id);
  if (!confirmDelete(`Delete "${c.name}"? This can't be undone.`)) return;
  courses = courses.filter((x) => x.id !== id);
  showToast("Course deleted", "danger");
  renderCourses();
}

renderCourses();
