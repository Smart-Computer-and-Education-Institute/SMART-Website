/* ============================================================
   lib/auth.js — everything about the admin login session
   ============================================================
   This is the ONLY place that knows how a session is created,
   checked, and destroyed. Every other file just calls the
   functions exported here.

   How it works:
   1. The admin's email lives in an environment variable
      (ADMIN_EMAIL), never in code and never in the git repo. See
      .env.example.
   2. The password hash starts out as the ADMIN_PASSWORD_HASH
      environment variable, but once the admin changes their
      password from the panel (Change password, in the logout
      popup), the new hash is written to the database instead and
      takes over from then on — see getActivePasswordHash() /
      changePassword() below. This means a password change is
      immediate and doesn't require touching Vercel's environment
      variables or redeploying, but it also means it only PERSISTS
      where the database persists: with MONGODB_URI configured in
      production, or in data/adminAuth.json for local development
      (same fallback pattern as lib/db.js uses for site content).
   3. On a successful login we sign a JWT (a small, tamper-proof
      token) and send it to the browser as an httpOnly cookie.
      "httpOnly" means client-side JavaScript can never read this
      cookie — only the browser (which attaches it automatically
      to same-site requests) and this server can see it. That's
      what makes it safe against theft via a stray XSS bug, unlike
      the old code's localStorage flag, which any script on the
      page could read.
   4. Every request to a protected page or API route is checked
      by requireAuthPage / requireApiAuth below, which verify the
      cookie's signature, expiry, and that it wasn't issued before
      the password was last changed (see getSession()). Nothing is
      trusted from the client except that signed token.
   ============================================================ */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("./db");

const COOKIE_NAME = "smart_admin_session";
const CREDENTIALS_COLLECTION = "adminAuth";
const CREDENTIALS_ID = "credentials";
const MIN_PASSWORD_LENGTH = 10;
const BCRYPT_COST = 12; // matches scripts/hash-password.js

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

const SHORT_SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours — default
const LONG_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — "remember me"

// Fail loudly (in the server logs) rather than silently letting anyone
// log in, which is what would happen if we skipped the checks below and
// JWT_SECRET happened to be undefined.
const misconfigured = !JWT_SECRET || !ADMIN_EMAIL;
if (misconfigured) {
  console.warn(
    "[auth] ADMIN_EMAIL and/or JWT_SECRET are not set. Admin login is " +
      "disabled until these environment variables are configured — see " +
      ".env.example and README for how to generate them."
  );
} else if (!ADMIN_PASSWORD_HASH) {
  console.warn(
    "[auth] ADMIN_PASSWORD_HASH is not set. Login only works once a " +
      "password has been saved another way (there isn't one yet on a " +
      "fresh install) — set ADMIN_PASSWORD_HASH via `npm run hash-password` " +
      "to create the initial admin password."
  );
}

// The password hash actually used to check logins: whatever was last
// saved via the "Change password" panel (stored in the database), or
// the ADMIN_PASSWORD_HASH environment variable if the password has
// never been changed from the panel yet.
async function getActivePasswordHash() {
  try {
    const stored = await db.findOne(CREDENTIALS_COLLECTION, CREDENTIALS_ID);
    if (stored && stored.passwordHash) return stored.passwordHash;
  } catch (err) {
    console.error(
      "[auth] Could not read the stored password hash, falling back to " +
        "ADMIN_PASSWORD_HASH:",
      err
    );
  }
  return ADMIN_PASSWORD_HASH || null;
}

// Checks a submitted email + password against the configured admin
// account. Always compares the password with bcrypt (which is designed
// to be slow, on purpose, to resist brute-forcing) — we never store or
// compare a plain-text password.
async function verifyCredentials(email, password) {
  if (misconfigured) return false;
  if (typeof email !== "string" || typeof password !== "string") return false;
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) return false;

  const hash = await getActivePasswordHash();
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

// Changes the admin password: verifies currentPassword against whatever
// is active right now, then saves a fresh bcrypt hash of newPassword to
// the database so it takes effect on every future login immediately.
// Returns { ok: true } on success, or { ok: false, error } on failure —
// never throws for an ordinary "wrong password" / "too short" case, so
// callers don't need to guess which errors are user-facing.
async function changePassword(currentPassword, newPassword) {
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return { ok: false, error: "Current and new password are required." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: "New password must be different from your current password." };
  }

  const currentHash = await getActivePasswordHash();
  if (!currentHash) {
    return { ok: false, error: "Admin login isn't fully configured yet — set ADMIN_PASSWORD_HASH first." };
  }

  const matches = await bcrypt.compare(currentPassword, currentHash);
  if (!matches) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const newHash = bcrypt.hashSync(newPassword, BCRYPT_COST);
  const record = {
    id: CREDENTIALS_ID,
    passwordHash: newHash,
    updatedAt: new Date().toISOString(),
  };

  const existing = await db.findOne(CREDENTIALS_COLLECTION, CREDENTIALS_ID);
  if (existing) {
    await db.updateOne(CREDENTIALS_COLLECTION, CREDENTIALS_ID, {
      passwordHash: newHash,
      updatedAt: record.updatedAt,
    });
  } else {
    await db.insertOne(CREDENTIALS_COLLECTION, record);
  }

  return { ok: true };
}

// Signs a session token and attaches it to the response as a cookie.
function createSessionCookie(res, email, remember) {
  const maxAgeMs = remember ? LONG_SESSION_MS : SHORT_SESSION_MS;
  const token = jwt.sign(
    // iatMs is a custom claim (millisecond precision) used alongside the
    // standard "iat" (whole seconds only) so getSession() can compare
    // against the password's last-changed time without the two ever
    // landing in the same second and becoming ambiguous — see getSession().
    { sub: email, iatMs: Date.now() },
    JWT_SECRET,
    { expiresIn: Math.floor(maxAgeMs / 1000) }
  );

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

// Reads + verifies the session cookie on an incoming request. Returns the
// decoded token payload if valid, otherwise null.
// Async because it also checks whether the password was changed *after*
// this token was issued — a JWT signature alone can't tell you that; a
// stolen or still-open old cookie stays validly *signed* right up until
// its normal expiry, even after the password it was issued under has been
// changed. We check that against the database (rather than an in-memory
// flag set inside changePassword()) because this app can run as multiple
// serverless instances with separate memory — an in-memory-only cutoff
// wouldn't reliably catch a session being verified by a different
// instance than the one that handled the password change.
async function getSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token || !JWT_SECRET) return null;

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null; // missing, expired, or tampered with
  }

  try {
    const credentials = await db.findOne(CREDENTIALS_COLLECTION, CREDENTIALS_ID);
    if (credentials && credentials.updatedAt && payload.iatMs) {
      const changedAtMs = new Date(credentials.updatedAt).getTime();
      // A token issued before the password was last changed is stale,
      // even though its signature still checks out. Comparing in
      // milliseconds (rather than JWT's standard whole-second "iat")
      // avoids a same-second collision incorrectly rejecting a brand
      // new token issued right after the change (e.g. logging back in
      // immediately after changing the password).
      if (payload.iatMs < changedAtMs) return null;
    }
  } catch (err) {
    console.error("[auth] Could not check password-change cutoff, allowing session:", err);
  }

  return payload;
}

// Protects admin HTML pages. Used on the whole /admin/* path.
// A logged-out visitor is redirected to the login page instead of ever
// receiving the page HTML — unlike the old version, where the dashboard
// was sent to anyone who asked and only pretended to check login state.
async function requireAuthPage(req, res, next) {
  if (await getSession(req)) return next();
  return res.redirect("/login.html");
}

// Protects admin API routes (the ones that read or change site content).
// Returns a 401 JSON response instead of a redirect, since these are
// called by fetch() from the admin panel's JavaScript, not by the
// browser navigating directly.
async function requireApiAuth(req, res, next) {
  if (await getSession(req)) return next();
  return res.status(401).json({ error: "Not logged in." });
}

module.exports = {
  COOKIE_NAME,
  verifyCredentials,
  changePassword,
  createSessionCookie,
  clearSessionCookie,
  getSession,
  requireAuthPage,
  requireApiAuth,
};
