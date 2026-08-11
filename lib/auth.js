/* ============================================================
   lib/auth.js — everything about the admin login session
   ============================================================
   This is the ONLY place that knows how a session is created,
   checked, and destroyed. Every other file just calls the
   functions exported here.

   How it works:
   1. The admin's email + password hash live in environment
      variables (ADMIN_EMAIL, ADMIN_PASSWORD_HASH), never in code
      and never in the git repo. See .env.example.
   2. On a successful login we sign a JWT (a small, tamper-proof
      token) and send it to the browser as an httpOnly cookie.
      "httpOnly" means client-side JavaScript can never read this
      cookie — only the browser (which attaches it automatically
      to same-site requests) and this server can see it. That's
      what makes it safe against theft via a stray XSS bug, unlike
      the old code's localStorage flag, which any script on the
      page could read.
   3. Every request to a protected page or API route is checked
      by requireAuthPage / requireApiAuth below, which verify the
      cookie's signature and expiry. Nothing is trusted from the
      client except that signed token.
   ============================================================ */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const COOKIE_NAME = "smart_admin_session";

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

const SHORT_SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours — default
const LONG_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — "remember me"

// Fail loudly (in the server logs) rather than silently letting anyone
// log in, which is what would happen if we skipped the checks below and
// JWT_SECRET happened to be undefined.
const misconfigured = !JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD_HASH;
if (misconfigured) {
  console.warn(
    "[auth] ADMIN_EMAIL, ADMIN_PASSWORD_HASH, and/or JWT_SECRET are not " +
      "set. Admin login is disabled until these environment variables " +
      "are configured — see .env.example and README for how to generate " +
      "them (npm run hash-password)."
  );
}

// Checks a submitted email + password against the configured admin
// account. Always compares the password with bcrypt (which is designed
// to be slow, on purpose, to resist brute-forcing) — we never store or
// compare a plain-text password.
async function verifyCredentials(email, password) {
  if (misconfigured) return false;
  if (typeof email !== "string" || typeof password !== "string") return false;
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) return false;
  return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
}

// Signs a session token and attaches it to the response as a cookie.
function createSessionCookie(res, email, remember) {
  const maxAgeMs = remember ? LONG_SESSION_MS : SHORT_SESSION_MS;
  const token = jwt.sign({ sub: email }, JWT_SECRET, {
    expiresIn: Math.floor(maxAgeMs / 1000),
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // client-side JS can never read this cookie
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // never sent on cross-site requests — this is our main CSRF defense
    maxAge: maxAgeMs,
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// Reads + verifies the session cookie on an incoming request.
// Returns the decoded token payload if valid, otherwise null.
function getSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null; // missing, expired, or tampered with
  }
}

// Protects admin HTML pages. Used on the whole /admin/* path.
// A logged-out visitor is redirected to the login page instead of ever
// receiving the page HTML — unlike the old version, where the dashboard
// was sent to anyone who asked and only pretended to check login state.
function requireAuthPage(req, res, next) {
  if (getSession(req)) return next();
  return res.redirect("/login.html");
}

// Protects admin API routes (the ones that read or change site content).
// Returns a 401 JSON response instead of a redirect, since these are
// called by fetch() from the admin panel's JavaScript, not by the
// browser navigating directly.
function requireApiAuth(req, res, next) {
  if (getSession(req)) return next();
  return res.status(401).json({ error: "Not logged in." });
}

module.exports = {
  COOKIE_NAME,
  verifyCredentials,
  createSessionCookie,
  clearSessionCookie,
  getSession,
  requireAuthPage,
  requireApiAuth,
};
