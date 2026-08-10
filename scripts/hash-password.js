#!/usr/bin/env node
/* ============================================================
   scripts/hash-password.js
   ============================================================
   A tiny helper for turning a plain-text admin password into the
   bcrypt hash that goes in the ADMIN_PASSWORD_HASH environment
   variable. We never store the real password anywhere — only this
   hash, which can be used to CHECK a password but can't be turned
   back into it.

   Usage:
     npm run hash-password -- "YourNewPassword123!"

   Then copy the printed hash into your .env file (locally) or your
   Vercel project's Environment Variables (in production).
   ============================================================ */

const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run hash-password -- \"YourPassword123!\"");
  process.exit(1);
}

if (password.length < 12) {
  console.warn(
    "Warning: that password is under 12 characters. A longer, random " +
      "passphrase is much harder to guess or brute-force."
  );
}

const hash = bcrypt.hashSync(password, 12);
console.log("\nADMIN_PASSWORD_HASH=" + hash + "\n");
console.log("Copy the line above into your .env file (or your Vercel");
console.log("project's Environment Variables) — never the plain password.");
