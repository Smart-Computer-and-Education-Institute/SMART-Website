// server.js
// Main server for the Smart Computer & Education Institute website.
//
// Serves the static site (HTML/CSS/JS/images) and a JSON API under
// /api/* that the admin dashboard uses to read and save content.
//
// SECURITY OVERVIEW (see docs/SECURITY_AND_DEPLOYMENT.md for the full
// write-up):
//   - The admin panel and every content-changing API route now require
//     a real, server-verified login (lib/auth.js). Previously the
//     "login" was a client-side illusion — a hardcoded password check
//     in JavaScript that never actually protected anything, and every
//     /api/* route could be called by anyone, logged in or not.
//   - Content is stored via lib/db.js and lib/blobStorage.js, which use
//     MongoDB Atlas + Vercel Blob in production and fall back to local
//     files for zero-setup local development. Plain fs.writeFileSync
//     calls (the original approach) do not persist on Vercel.

require("dotenv").config(); // loads .env locally; harmless no-op in production

const express = require("express");
const path = require("path");
const multer = require("multer");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const db = require("./lib/db");
const blobStorage = require("./lib/blobStorage");
const {
  verifyCredentials,
  changePassword,
  createSessionCookie,
  clearSessionCookie,
  requireAuthPage,
  requireApiAuth,
} = require("./lib/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel terminates HTTPS in front of the function and forwards plain
// HTTP internally; this tells Express to trust that and treat the
// connection as secure so "secure" cookies still work correctly.
app.set("trust proxy", 1);

// ---------------------------------------------------------
// Small helper so async route handlers don't need a try/catch each.
// Any rejected promise is forwarded to Express's error handler at the
// bottom of this file instead of crashing the process or hanging.
// ---------------------------------------------------------
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------------------------------------------------------
// Security headers (helmet). We turn off helmet's default Content-
// Security-Policy because the admin panel currently uses inline
// onclick="..." attributes (e.g. onclick="openServiceModal()"), which a
// strict CSP blocks. The other headers helmet sets — X-Frame-Options
// (clickjacking protection), X-Content-Type-Options, a baseline
// Referrer-Policy, etc. — are all still on. Moving those onclick
// handlers to addEventListener() and turning the CSP back on is a good
// follow-up hardening step; see docs/SECURITY_AND_DEPLOYMENT.md.
// ---------------------------------------------------------
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------
// Block direct access to server-only files and folders.
// These are only ever needed BY the server itself, never by a
// visitor's browser. Without this, anything not matched by a more
// specific route falls through to express.static() below and would be
// served to anyone who asks — including this file, the database
// connection code, and the raw JSON "seed" data.
// ---------------------------------------------------------
const BLOCKED_PATH_PREFIXES = [
  "/data/",
  "/lib/",
  "/scripts/",
  "/server.js",
  "/package.json",
  "/package-lock.json",
  "/vercel.json",
];
app.use((req, res, next) => {
  if (BLOCKED_PATH_PREFIXES.some((p) => req.path === p || req.path.startsWith(p))) {
    return res.status(403).send("Forbidden");
  }
  next();
});

// ---------------------------------------------------------
// Gate the entire admin panel behind a login.
// This runs BEFORE express.static(), so a logged-out visitor is
// redirected to /login.html and never receives the admin HTML/JS at
// all — unlike the original version, where every admin/*.html page was
// served to anyone who typed the URL, and the "login" was purely
// cosmetic on the client.
// ---------------------------------------------------------
app.use("/admin", requireAuthPage);
app.get("/admin", (req, res) => res.redirect("/admin/dashboard.html"));

// Serve the rest of the site (HTML, CSS, JS, images) as static files.
app.use(express.static(__dirname));

// ---------------------------------------------------------
// Auth API — login / logout
// ---------------------------------------------------------

// Slows down password-guessing: at most 8 attempts per IP every 15
// minutes on the login route specifically (every other route is
// unaffected).
const loginLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few seconds." },
});

app.post(
  "/api/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, remember } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const ok = await verifyCredentials(email, password);
    if (!ok) {
      // Deliberately generic — never reveal whether the email or the
      // password was the wrong part, which would help an attacker
      // enumerate valid admin emails.
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    createSessionCookie(res, email.trim().toLowerCase(), !!remember);
    res.json({ ok: true });
  })
);

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Same idea as loginLimiter — makes brute-forcing the current password
// through this endpoint just as slow as brute-forcing the login form.
const changePasswordLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

app.post(
  "/api/change-password",
  requireApiAuth,
  changePasswordLimiter,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "Fill in all three password fields." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New password and confirmation don't match." });
    }

    const result = await changePassword(currentPassword, newPassword);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    // The session cookie isn't tied to the password itself, so clear it
    // here to force a fresh login with the new password — on this
    // device and (once the old cookie expires) anywhere else too.
    clearSessionCookie(res);
    res.json({ ok: true, message: "Password updated. Please log in again." });
  })
);

// ---------------------------------------------------------
// Settings API (site-wide contact info)
// A single document holds every contact detail shown across the
// public site (footer, Contact page, WhatsApp button, map). Admins
// edit it once from Settings; every page picks it up via
// GET /api/public/settings instead of each page hardcoding its own
// copy of the address/phone/email, which is what caused those to
// drift out of sync with each other in the first place.
// ---------------------------------------------------------

const DEFAULT_SETTINGS = {
  id: "contact",
  address: "Mechinagar-13, Charali Jhapa\nKoshi, Nepal",
  phones: ["+977-9700071948", "+977-9700071958", "+977-9700071968"],
  email: "smartinstitute@gmail.com",
  hours: "6:00 AM – 6:00 PM\nSunday – Friday",
  whatsapp: "",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d445.7349500066516!2d88.05294745192597!3d26.65233713027649!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39e5b10076063541%3A0x576f4e4164aade03!2sSmart%20Computer%20%26%20Education%20Institute!5e0!3m2!1sen!2snp!4v1782028540603!5m2!1sen!2snp",
  mapDirectionsUrl:
    "https://www.google.com/maps/place/Smart+Computer+%26+Education+Institute/@26.6523371,88.0529474,19z",
};

async function getContactSettings() {
  const existing = await db.findOne("settings", "contact");
  return existing || DEFAULT_SETTINGS;
}

app.get(
  "/api/public/settings",
  asyncHandler(async (req, res) => {
    res.json(await getContactSettings());
  })
);

app.get(
  "/api/settings",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    res.json(await getContactSettings());
  })
);

app.put(
  "/api/settings",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { address, phones, email, hours, whatsapp, mapEmbedUrl, mapDirectionsUrl } = req.body || {};
    const changes = {};

    if (address !== undefined) changes.address = String(address).slice(0, 300);
    if (email !== undefined) changes.email = String(email).slice(0, 150);
    if (hours !== undefined) changes.hours = String(hours).slice(0, 200);
    if (whatsapp !== undefined) changes.whatsapp = String(whatsapp).slice(0, 300);
    if (mapEmbedUrl !== undefined) changes.mapEmbedUrl = String(mapEmbedUrl).slice(0, 1500);
    if (mapDirectionsUrl !== undefined) changes.mapDirectionsUrl = String(mapDirectionsUrl).slice(0, 500);
    if (phones !== undefined) {
      const list = Array.isArray(phones) ? phones : String(phones).split("\n");
      changes.phones = list
        .map((p) => String(p).trim())
        .filter(Boolean)
        .slice(0, 10);
    }

    const existing = await db.findOne("settings", "contact");
    const updated = existing
      ? await db.updateOne("settings", "contact", changes)
      : await db.insertOne("settings", { ...DEFAULT_SETTINGS, ...changes, id: "contact" });

    res.json(updated);
  })
);

// ---------------------------------------------------------
// Categories API (the filter chips shown on the Services page and
// used as the "Category" dropdown when adding/editing a service)
// Public GET stays open (nothing sensitive about a list of category
// names) — every write requires login. Deleting a category doesn't
// touch services already using it (they simply won't match any chip
// until re-categorized); renaming one cascades to every service that
// used the old name, so nothing is silently orphaned.
// ---------------------------------------------------------

const DEFAULT_CATEGORIES = ["Office", "Design", "Marketing", "Accounting"];

// Lazily seeds the categories collection the first time it's read, so
// installs upgrading from the old hardcoded chip list keep the same
// categories without any manual setup.
async function ensureCategoriesSeeded() {
  const existing = await db.findAll("categories");
  if (existing.length) return existing;

  const seeded = [];
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const category = { id: `cat${Date.now()}${i}`, name: DEFAULT_CATEGORIES[i] };
    await db.insertOne("categories", category);
    seeded.push(category);
  }
  return seeded;
}

function sortByName(items) {
  return items.slice().sort((a, b) => a.name.localeCompare(b.name));
}

app.get(
  "/api/public/categories",
  asyncHandler(async (req, res) => {
    const categories = await ensureCategoriesSeeded();
    res.json(sortByName(categories).map((c) => c.name));
  })
);

app.get(
  "/api/categories",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    res.json(sortByName(await ensureCategoriesSeeded()));
  })
);

app.post(
  "/api/categories",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const name = String((req.body || {}).name || "").trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: "Enter a category name." });
    if (name.toLowerCase() === "all") {
      return res.status(400).json({ error: '"All" is reserved for the built-in "show everything" filter.' });
    }

    const existing = await db.findAll("categories");
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: "That category already exists." });
    }

    const category = { id: "cat" + Date.now(), name };
    await db.insertOne("categories", category);
    res.status(201).json(category);
  })
);

app.put(
  "/api/categories/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const name = String((req.body || {}).name || "").trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: "Enter a category name." });
    if (name.toLowerCase() === "all") {
      return res.status(400).json({ error: '"All" is reserved for the built-in "show everything" filter.' });
    }

    const existing = await db.findOne("categories", req.params.id);
    if (!existing) return res.status(404).json({ error: "Category not found" });

    const all = await db.findAll("categories");
    const clashes = all.some(
      (c) => c.id !== req.params.id && c.name.toLowerCase() === name.toLowerCase()
    );
    if (clashes) return res.status(409).json({ error: "That category already exists." });

    const oldName = existing.name;
    const updated = await db.updateOne("categories", req.params.id, { name });

    // Cascade the rename so services keep pointing at a category that
    // actually still exists, instead of silently going orphaned.
    if (oldName !== name) {
      const services = await db.findAll("services");
      await Promise.all(
        services
          .filter((s) => s.category === oldName)
          .map((s) => db.updateOne("services", s.id, { category: name }))
      );
    }

    res.json(updated);
  })
);

app.delete(
  "/api/categories/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("categories", req.params.id);
    if (!existing) return res.status(404).json({ error: "Category not found" });
    await db.deleteOne("categories", req.params.id);
    res.status(204).end();
  })
);

// ---------------------------------------------------------
// Notices API
// Public routes return only published notices. Admin routes (protected)
// return everything, including drafts, and can create/edit/delete.
//
// The original code used a single GET /api/notices?status=published
// route for both audiences — but that means "give me everything" was
// just a matter of leaving the query string off, with nothing checking
// who was asking. Splitting these into separate public/admin routes
// closes that gap.
// ---------------------------------------------------------

app.get(
  "/api/public/notices",
  asyncHandler(async (req, res) => {
    const notices = await db.findAll("notices");
    res.json(notices.filter((n) => n.status === "published"));
  })
);

app.get(
  "/api/notices",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    res.json(await db.findAll("notices"));
  })
);

app.post(
  "/api/notices",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { title, content, date, status } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required" });
    }

    const newNotice = {
      id: "n" + Date.now(),
      title: String(title).slice(0, 200),
      content: String(content).slice(0, 5000),
      date: date || new Date().toISOString().slice(0, 10),
      status: status === "published" ? "published" : "draft",
    };

    await db.insertOne("notices", newNotice);
    res.status(201).json(newNotice);
  })
);

app.put(
  "/api/notices/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { title, content, date, status } = req.body || {};
    const changes = {};
    if (title !== undefined) changes.title = String(title).slice(0, 200);
    if (content !== undefined) changes.content = String(content).slice(0, 5000);
    if (date !== undefined) changes.date = date;
    if (status !== undefined) changes.status = status === "published" ? "published" : "draft";

    const notice = await db.updateOne("notices", req.params.id, changes);
    if (!notice) return res.status(404).json({ error: "Notice not found" });
    res.json(notice);
  })
);

app.post(
  "/api/notices/:id/toggle",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const notice = await db.findOne("notices", req.params.id);
    if (!notice) return res.status(404).json({ error: "Notice not found" });

    const updated = await db.updateOne("notices", req.params.id, {
      status: notice.status === "published" ? "draft" : "published",
    });
    res.json(updated);
  })
);

app.delete(
  "/api/notices/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const deleted = await db.deleteOne("notices", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Notice not found" });
    res.status(204).end();
  })
);

// ---------------------------------------------------------
// Services API
// (Formerly "Courses" — renamed sitewide for consistency; see
// docs/SECURITY_AND_DEPLOYMENT.md for the collection-rename note if
// you're upgrading an existing MongoDB deployment.)
// Same public/admin split as notices: public sees only active
// services, the protected admin routes see and manage everything.
// ---------------------------------------------------------

app.get(
  "/api/public/services",
  asyncHandler(async (req, res) => {
    const services = await db.findAll("services");
    res.json(services.filter((s) => s.status === "active"));
  })
);

app.get(
  "/api/services",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    res.json(await db.findAll("services"));
  })
);

app.post(
  "/api/services",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { name, category, duration, desc, enrolled, status } = req.body || {};
    if (!name || !duration || !desc) {
      return res.status(400).json({ error: "name, duration, and desc are required" });
    }

    const newService = {
      id: "s" + Date.now(),
      name: String(name).slice(0, 150),
      category: category || "Office",
      duration: String(duration).slice(0, 60),
      desc: String(desc).slice(0, 2000),
      enrolled: Number.isFinite(Number(enrolled)) ? Number(enrolled) : 0,
      status: status === "inactive" ? "inactive" : "active",
    };

    await db.insertOne("services", newService);
    res.status(201).json(newService);
  })
);

app.put(
  "/api/services/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { name, category, duration, desc, enrolled, status } = req.body || {};
    const changes = {};
    if (name !== undefined) changes.name = String(name).slice(0, 150);
    if (category !== undefined) changes.category = category;
    if (duration !== undefined) changes.duration = String(duration).slice(0, 60);
    if (desc !== undefined) changes.desc = String(desc).slice(0, 2000);
    if (enrolled !== undefined) changes.enrolled = Number(enrolled) || 0;
    if (status !== undefined) changes.status = status === "inactive" ? "inactive" : "active";

    const service = await db.updateOne("services", req.params.id, changes);
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.json(service);
  })
);

app.delete(
  "/api/services/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const deleted = await db.deleteOne("services", req.params.id);
    if (!deleted) return res.status(404).json({ error: "Service not found" });
    res.status(204).end();
  })
);

// ---------------------------------------------------------
// Photo uploads (Vercel Blob in production, local disk in dev)
//
// Uploaded files are read into memory (not written straight to disk)
// so lib/blobStorage.js can send the same buffer to either
// destination. Never trust the uploaded filename — it's attacker-
// controlled text — so we generate our own name, and we pick the file
// extension ourselves from a fixed, checked list rather than trusting
// whatever extension the uploader's filename happened to have.
// ---------------------------------------------------------

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed."));
    }
    cb(null, true);
  },
}).single("photo"); // must match formData.append("photo", file) on the client

function handlePhotoUpload(req, res, next) {
  memoryUpload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Photo is too large. Max size is 5MB." });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    next();
  });
}

function safeUploadName(prefix, mimetype) {
  const ext = ALLOWED_IMAGE_TYPES[mimetype];
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

// ---------------------------------------------------------
// Gallery API
// Public GET stays open (no draft/published concept for photos, so
// there's nothing sensitive to hide). Every write requires login.
// ---------------------------------------------------------

app.get(
  "/api/gallery",
  asyncHandler(async (req, res) => {
    res.json(await db.findAll("gallery"));
  })
);

app.post(
  "/api/gallery",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const { title, desc } = req.body || {};
    if (!title || !desc) {
      return res.status(400).json({ error: "title and desc are required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a photo to upload." });
    }

    const filename = safeUploadName("photo", req.file.mimetype);
    const imageUrl = await blobStorage.saveUpload(req.file.buffer, "gallery", filename);

    const newPhoto = {
      id: "p" + Date.now(),
      title: String(title).slice(0, 150),
      desc: String(desc).slice(0, 1000),
      image: imageUrl,
    };

    await db.insertOne("gallery", newPhoto);
    res.status(201).json(newPhoto);
  })
);

app.put(
  "/api/gallery/:id",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("gallery", req.params.id);
    if (!existing) return res.status(404).json({ error: "Photo not found" });

    const { title, desc } = req.body || {};
    const changes = {};
    if (title !== undefined) changes.title = String(title).slice(0, 150);
    if (desc !== undefined) changes.desc = String(desc).slice(0, 1000);

    if (req.file) {
      const filename = safeUploadName("photo", req.file.mimetype);
      changes.image = await blobStorage.saveUpload(req.file.buffer, "gallery", filename);
      await blobStorage.deleteUpload(existing.image); // clean up the file it's replacing
    }

    const updated = await db.updateOne("gallery", req.params.id, changes);
    res.json(updated);
  })
);

app.delete(
  "/api/gallery/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("gallery", req.params.id);
    if (!existing) return res.status(404).json({ error: "Photo not found" });

    await blobStorage.deleteUpload(existing.image);
    await db.deleteOne("gallery", req.params.id);
    res.status(204).end();
  })
);

// ---------------------------------------------------------
// Testimonials API
// Same pattern as Gallery: public GET, protected writes.
// ---------------------------------------------------------

app.get(
  "/api/testimonials",
  asyncHandler(async (req, res) => {
    res.json(await db.findAll("testimonials"));
  })
);

app.post(
  "/api/testimonials",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const { name, text, service } = req.body || {};
    if (!name || !text) {
      return res.status(400).json({ error: "name and text are required" });
    }

    let photoUrl = "";
    if (req.file) {
      const filename = safeUploadName("testimonial", req.file.mimetype);
      photoUrl = await blobStorage.saveUpload(req.file.buffer, "testimonials", filename);
    }

    const newTestimonial = {
      id: "t" + Date.now(),
      name: String(name).slice(0, 100),
      text: String(text).slice(0, 1000),
      service: service || "",
      photo: photoUrl,
    };

    await db.insertOne("testimonials", newTestimonial);
    res.status(201).json(newTestimonial);
  })
);

app.put(
  "/api/testimonials/:id",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("testimonials", req.params.id);
    if (!existing) return res.status(404).json({ error: "Testimonial not found" });

    const { name, text, service } = req.body || {};
    const changes = {};
    if (name !== undefined) changes.name = String(name).slice(0, 100);
    if (text !== undefined) changes.text = String(text).slice(0, 1000);
    if (service !== undefined) changes.service = service;

    if (req.file) {
      const filename = safeUploadName("testimonial", req.file.mimetype);
      changes.photo = await blobStorage.saveUpload(req.file.buffer, "testimonials", filename);
      await blobStorage.deleteUpload(existing.photo);
    }

    const updated = await db.updateOne("testimonials", req.params.id, changes);
    res.json(updated);
  })
);

app.delete(
  "/api/testimonials/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("testimonials", req.params.id);
    if (!existing) return res.status(404).json({ error: "Testimonial not found" });

    await blobStorage.deleteUpload(existing.photo);
    await db.deleteOne("testimonials", req.params.id);
    res.status(204).end();
  })
);

// ---------------------------------------------------------
// Centralized error handler.
// Anything asyncHandler() catches (a bad DB connection, an unexpected
// bug, etc.) ends up here instead of leaking a raw stack trace to the
// visitor or crashing the server.
// ---------------------------------------------------------
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

// Vercel imports this file as a module and calls the exported app
// directly for each request — it must NOT also call app.listen(), or
// the deployment fails. Only start a local server when this file is
// run directly (`node server.js` / `npm start`).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
  });
}

module.exports = app;
