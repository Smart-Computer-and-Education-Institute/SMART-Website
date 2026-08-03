/* ============================================
   Login form — demo credential check
   No backend here: this checks against a
   hardcoded account and stores a session flag
   in localStorage. Replace with a real API call
   before this goes live.
   ============================================ */

// Demo account. Change these, or wire this file up to your real login API.
const ADMIN_EMAIL = "admin@smartinstitute.com";
const ADMIN_PASSWORD = "Admin@123";

const loginForm = document.getElementById("loginForm");

function setError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || "";
}

function clearErrors() {
  setError("error-username", "");
  setError("error-password", "");
  setError("error-general", "");
}

loginForm.addEventListener("submit", function (e) {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById("Username").value.trim();
  const password = document.getElementById("Password").value;
  let valid = true;

  if (!email) {
    setError("error-username", "Enter your email.");
    valid = false;
  }
  if (!password) {
    setError("error-password", "Enter your password.");
    valid = false;
  }
  if (!valid) return;

  const submitBtn = loginForm.querySelector(".login-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  // Simulated auth check — swap this block for a real fetch() to your login API.
  setTimeout(function () {
    if (email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const remember = document.getElementById("rememberMe").checked;
      const session = { email: email, loggedInAt: Date.now() };
      localStorage.setItem("smartAdminAuth", JSON.stringify(session));
      if (!remember) {
        // Still stored in localStorage for this demo; a real build would
        // use a shorter-lived cookie/session when "remember me" is off.
      }
      window.location.href = "admin/dashboard.html";
    } else {
      setError("error-general", "Incorrect email or password.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  }, 400);
});