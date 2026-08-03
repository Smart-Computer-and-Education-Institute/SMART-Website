/* ============================================
   Shared admin panel behaviour
   Sidebar toggle, toasts, modal helpers
   ============================================ */

(function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuToggle = document.getElementById("menuToggle");

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    });
  }
  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  // Close mobile sidebar after choosing a page
  document.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", closeSidebar);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
})();

/* ---------- Toast notifications ---------- */

function showToast(message, type = "success") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const icons = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    danger:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.success}<span>${message}</span>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.2s ease";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

/* ---------- Modal helpers ---------- */

function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add("open");
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove("open");
}

// Close modal on overlay click or [data-close-modal]
document.addEventListener("click", (e) => {
  if (e.target.classList && e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
  }
  const closeBtn = e.target.closest("[data-close-modal]");
  if (closeBtn) {
    const overlay = closeBtn.closest(".modal-overlay");
    if (overlay) overlay.classList.remove("open");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.open").forEach((m) => m.classList.remove("open"));
  }
});

/* ---------- Delete confirmation ---------- */

function confirmDelete(message) {
  return window.confirm(message);
}

/* ---------- Footer year (unused here but kept for parity) ---------- */
