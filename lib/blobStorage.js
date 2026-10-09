/* ============================================================
   lib/blobStorage.js — local disk upload storage (no Vercel Blob)
   ============================================================
   Saves uploaded files directly to /img/<folder>/ on the local
   filesystem. All Vercel Blob code has been removed so the app runs
   fully offline without any cloud credentials.
   ============================================================ */

const fs   = require("fs");
const path = require("path");

const ALLOWED_FOLDERS = [
  "gallery",
  "testimonials",
  "about",
  "careers",
  "services",
  "offers",
  "applications",
  "popup",
  "popups",
  "about-sections",
  "social-icons",
];

/**
 * Save an uploaded file buffer to /img/<folder>/<filename> and return
 * the public URL path that can be used in an <img src="..."> tag.
 *
 * @param {Buffer} buffer   - File contents.
 * @param {string} folder   - Sub-folder name, e.g. "gallery".
 * @param {string} filename - Safe, server-generated filename.
 * @returns {Promise<string>} Absolute URL path, e.g. "/img/gallery/foo.jpg".
 */
async function saveUpload(buffer, folder, filename) {
  const dir = path.join(__dirname, "..", "img", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  // Return an absolute path (leading /) so the URL resolves correctly
  // from any page depth, including /admin/* pages.
  return `/img/${folder}/${filename}`;
}

/**
 * Delete a previously saved upload from the local filesystem.
 * Only ever removes files inside the allowed img sub-folders.
 *
 * @param {string} storedPath - The path returned by saveUpload().
 */
async function deleteUpload(storedPath) {
  if (!storedPath) return;

  // Accept both "/img/<folder>/..." (new) and "img/<folder>/..." (legacy).
  const normalized = storedPath.startsWith("/") ? storedPath.slice(1) : storedPath;
  const match = ALLOWED_FOLDERS.find((f) => normalized.startsWith(`img/${f}/`));
  if (!match) return;

  const filename = path.basename(storedPath);
  fs.unlink(path.join(__dirname, "..", "img", match, filename), (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Could not delete photo file:", err);
    }
  });
}

// Always false — Vercel Blob is never active in local mode.
const useBlob = false;

module.exports = { saveUpload, deleteUpload, useBlob };
