/* ============================================================
   login-client.js
   ============================================================
   Talks to the real POST /api/login endpoint. The server checks the
   email + password there (see server.js / lib/auth.js) and, on
   success, sets a secure httpOnly session cookie.

   This script never stores a password or a session token itself —
   that's the whole point of an httpOnly cookie: page JavaScript can't
   read it, so even a bug elsewhere on the page can't be used to steal
   the admin's login session.
   ============================================================ */

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

// After a successful password change (see admin.js), the admin panel
// sends the admin here with ?passwordChanged=1 since the session cookie
// gets cleared as part of that change. Show a neutral confirmation
// instead of just dropping them on a blank login form with no context.
(function showPasswordChangedNotice() {
  if (!location.search.includes("passwordChanged=1")) return;
  const notice = document.createElement("p");
  notice.textContent = "Password updated. Please log in with your new password.";
  notice.style.cssText =
    "text-align:center;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;" +
    "border-radius:6px;padding:8px 12px;font-size:0.85rem;margin:0 0 16px;";
  loginForm.insertBefore(notice, loginForm.firstChild.nextSibling);
  // Drop the query param so refreshing the page doesn't repeat the notice.
  history.replaceState(null, "", location.pathname);
})();

loginForm.addEventListener("submit", async function (e) {
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

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        remember: document.getElementById("rememberMe").checked,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      window.location.href = "/admin/dashboard.html";
      return;
    }

    setError("error-general", data.error || "Incorrect email or password.");
  } catch (err) {
    setError("error-general", "Could not reach the server. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Login";
  }
});
