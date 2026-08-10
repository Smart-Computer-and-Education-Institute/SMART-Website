/* ============================================
   Shared admin panel behaviour
   Sidebar toggle, toasts, modal helpers,
   logout popup, course count
   ============================================ */

/* ---------- Session handling ----------
   If the server ever responds 401 (not logged in — e.g. the session
   cookie expired while this page was open), every admin page bounces
   back to the login screen instead of silently failing. This wraps
   window.fetch once, here, so none of the individual admin/*.js files
   (notices.js, courses.js, etc.) need to handle it themselves. */
(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    if (response.status === 401) {
      window.location.href = "/login.html";
    }
    return response;
  };
})();

/* ---------- Logout ----------
   The session cookie is httpOnly, so page JavaScript can't clear it
   directly — that request has to go to the server. */
(function () {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      window.location.href = "/login.html";
    }
  });
})();

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

  /* ---------- Logout popup ---------- */
  const topbarAvatar = document.getElementById("topbarAvatar");
  const logoutPopup = document.getElementById("logoutPopup");

  if (topbarAvatar && logoutPopup) {
    topbarAvatar.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = logoutPopup.classList.toggle("open");
      topbarAvatar.classList.toggle("popup-active", isOpen);
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (!logoutPopup.contains(e.target) && e.target !== topbarAvatar) {
        logoutPopup.classList.remove("open");
        topbarAvatar.classList.remove("popup-active");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        logoutPopup.classList.remove("open");
        topbarAvatar.classList.remove("popup-active");
      }
    });
  }
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


