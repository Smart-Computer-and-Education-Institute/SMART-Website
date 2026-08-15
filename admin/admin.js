/* ============================================
   Shared admin panel behaviour
   Sidebar toggle, toasts, modal helpers,
   logout popup + change password, service count
   ============================================ */

/* ---------- Session handling ----------
   If the server ever responds 401 (not logged in — e.g. the session
   cookie expired while this page was open), every admin page bounces
   back to the login screen instead of silently failing. This wraps
   window.fetch once, here, so none of the individual admin/*.js files
   (services.js, notices.js, etc.) need to handle it themselves. */
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

    /* ---------- Change password ----------
       Injected here (rather than copy-pasted into every admin page's
       HTML) so it shows up in the logout popup everywhere automatically.
       Uses the same .modal-overlay/.form-field markup and openModal()/
       closeModal() helpers as every other modal in the panel. */
    const changePasswordBtn = document.createElement("button");
    changePasswordBtn.type = "button";
    changePasswordBtn.className = "logout-popup-btn logout-popup-btn-neutral";
    changePasswordBtn.id = "changePasswordBtn";
    changePasswordBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Change password';
    const divider = logoutPopup.querySelector(".logout-popup-divider");
    if (divider) divider.insertAdjacentElement("afterend", changePasswordBtn);
    else logoutPopup.appendChild(changePasswordBtn);

    if (!document.getElementById("changePasswordModalOverlay")) {
      const modal = document.createElement("div");
      modal.className = "modal-overlay";
      modal.id = "changePasswordModalOverlay";
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2>Change password</h2>
            <button class="modal-close" data-close-modal aria-label="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <form id="changePasswordForm">
            <div class="modal-body">
              <p id="changePasswordError" style="display:none;color:var(--color-danger);font-size:13px;margin:0 0 14px;"></p>

              <div class="form-field" id="field-current-password">
                <label for="currentPassword">Current password</label>
                <input type="password" id="currentPassword" autocomplete="current-password">
                <span class="form-error-text">Enter your current password.</span>
              </div>

              <div class="form-field" id="field-new-password">
                <label for="newPassword">New password</label>
                <input type="password" id="newPassword" autocomplete="new-password">
                <span class="form-error-text">Must be at least 10 characters.</span>
              </div>

              <div class="form-field" id="field-confirm-password">
                <label for="confirmPassword">Confirm new password</label>
                <input type="password" id="confirmPassword" autocomplete="new-password">
                <span class="form-error-text">Passwords don't match.</span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
              <button type="submit" class="btn btn-primary">Update password</button>
            </div>
          </form>
        </div>`;
      document.body.appendChild(modal);
    }

    const changePasswordForm = document.getElementById("changePasswordForm");
    const changePasswordError = document.getElementById("changePasswordError");

    function clearChangePasswordErrors() {
      document.querySelectorAll("#changePasswordForm .form-field").forEach((f) => f.classList.remove("has-error"));
      changePasswordError.style.display = "none";
    }

    changePasswordBtn.addEventListener("click", () => {
      logoutPopup.classList.remove("open");
      topbarAvatar.classList.remove("popup-active");
      changePasswordForm.reset();
      clearChangePasswordErrors();
      openModal("changePasswordModalOverlay");
    });

    changePasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearChangePasswordErrors();

      const currentPassword = document.getElementById("currentPassword").value;
      const newPassword = document.getElementById("newPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      let valid = true;
      if (!currentPassword) {
        document.getElementById("field-current-password").classList.add("has-error");
        valid = false;
      }
      if (!newPassword || newPassword.length < 10) {
        document.getElementById("field-new-password").classList.add("has-error");
        valid = false;
      }
      if (newPassword !== confirmPassword) {
        document.getElementById("field-confirm-password").classList.add("has-error");
        valid = false;
      }
      if (!valid) return;

      const submitBtn = changePasswordForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        const res = await fetch("/api/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          changePasswordError.textContent = data.error || "Couldn't update the password.";
          changePasswordError.style.display = "block";
          submitBtn.disabled = false;
          return;
        }

        // The server clears the session cookie as part of this (a password
        // change should require logging back in with the new one), so send
        // the admin to the login page rather than leaving them on a page
        // that will just 401 on the next request.
        window.location.href = "/login.html?passwordChanged=1";
      } catch (err) {
        changePasswordError.textContent = "Network error — please try again.";
        changePasswordError.style.display = "block";
        submitBtn.disabled = false;
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


