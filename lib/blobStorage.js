/* ============================================================
   lib/blobStorage.js — where uploaded photos actually get saved
   ============================================================
   Same problem as lib/db.js: the original code used multer's disk
   storage to write uploaded gallery/testimonial photos straight onto
   the server's local disk. That disk doesn't persist on Vercel.

   When a BLOB_READ_WRITE_TOKEN environment variable is present (Vercel
   sets this automatically once you connect a Blob store to your
   project), uploads go to Vercel Blob and we store the public URL it
   gives back. Locally, with no token set, files are written to
   /img/gallery or /img/testimonials on disk exactly like before.

   server.js always calls saveUpload()/deleteUpload() and never needs
   an if/else for which mode is active.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// folder: "gallery" or "testimonials". filename: a SAFE, server-generated
// name (never the attacker-controlled original filename — see server.js).
async function saveUpload(buffer, folder, filename) {
  if (useBlob) {
    const { put } = require("@vercel/blob");
    const blob = await put(`${folder}/${filename}`, buffer, {
      access: "public", // these images are meant to be shown on the public site
      addRandomSuffix: false, // we already generated a unique name ourselves
    });
    return blob.url; // a full https:// URL — drops straight into <img src="...">
  }

  const dir = path.join(__dirname, "..", "img", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `img/${folder}/${filename}`;
}

// storedPath is whatever saveUpload() previously returned (a Blob URL or
// a local "img/..." path). Only ever deletes files this app created —
// never a shared site image like Smart-Logo.png.
async function deleteUpload(storedPath) {
  if (!storedPath) return;

  if (useBlob) {
    if (!storedPath.includes(".public.blob.vercel-storage.com")) return;
    try {
      const { del } = require("@vercel/blob");
      await del(storedPath);
    } catch (err) {
      console.error("Could not delete blob:", err);
    }
    return;
  }

  const ALLOWED_FOLDERS = [
    "gallery",
    "testimonials",
    "about",
    "careers",
    "services",
    "offers",
    "applications",
  ];
  const match = ALLOWED_FOLDERS.find((f) => storedPath.startsWith(`img/${f}/`));
  if (!match) return;

  const filename = path.basename(storedPath); // strips any directory part
  fs.unlink(path.join(__dirname, "..", "img", match, filename), (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Could not delete photo file:", err);
    }
  });
}

module.exports = { saveUpload, deleteUpload, useBlob };
