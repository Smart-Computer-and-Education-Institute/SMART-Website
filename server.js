// server.js
// Main server for the Smart Computer & Education Institute website.
//
// This replaces the old index.js. It does everything index.js did
// (serve the HTML/CSS/JS/images as static files) PLUS a small JSON
// API under /api/* that the admin dashboard uses to actually save
// changes, instead of just changing a JavaScript array in memory.

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// Lets us read JSON bodies sent by fetch() from the admin panel,
// e.g. fetch("/api/notices", { method: "POST", body: JSON.stringify(...) })
app.use(express.json());

// The /data folder is our "database" (plain JSON files). It should
// never be reachable directly by URL — only through the /api routes
// below, which control exactly what gets returned. Without this,
// anyone could open yoursite.com/data/notices.json directly and see
// draft notices that aren't meant to be public yet.
app.use((req, res, next) => {
  if (req.path.startsWith("/data/")) {
    return res.status(403).send("Forbidden");
  }
  next();
});

// Serve every other file in the project as-is: index.html, About.html,
// style.css, script.js, the whole admin/ folder, images, everything —
// exactly like the old index.js did, just with proper handling for
// every file type (the old version only knew about .html/.css/.js).
app.use(express.static(__dirname));

// ---------------------------------------------------------
// Notices "database" helpers
// These just read/write data/notices.json as a whole file.
// Fine for a small site; a real database would do this more
// efficiently, but for a few dozen notices this is simple and works.
// ---------------------------------------------------------

const NOTICES_FILE = path.join(__dirname, "data", "notices.json");
const COURSES_FILE = path.join(__dirname, "data", "courses.json");
const GALLERY_FILE = path.join(__dirname, "data", "gallery.json");

function readNotices() {
  const raw = fs.readFileSync(NOTICES_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeNotices(notices) {
  fs.writeFileSync(NOTICES_FILE, JSON.stringify(notices, null, 2));
}

function readCourses() {
  const raw = fs.readFileSync(COURSES_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeCourses(courses) {
  fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2));
}

function readGallery() {
  const raw = fs.readFileSync(GALLERY_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeGallery(photos) {
  fs.writeFileSync(GALLERY_FILE, JSON.stringify(photos, null, 2));
}

// ---------------------------------------------------------
// Notices API
// ---------------------------------------------------------

// GET /api/notices                    -> everything (admin panel uses this)
// GET /api/notices?status=published   -> only published ones (public Notice.html uses this)
app.get("/api/notices", (req, res) => {
  const notices = readNotices();
  const { status } = req.query;
  const result = status ? notices.filter((n) => n.status === status) : notices;
  res.json(result);
});

// POST /api/notices -> create a new notice
app.post("/api/notices", (req, res) => {
  const { title, content, date, status } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "title and content are required" });
  }

  const notices = readNotices();
  const newNotice = {
    id: "n" + Date.now(),
    title,
    content,
    date: date || new Date().toISOString().slice(0, 10),
    status: status || "draft",
  };

  notices.unshift(newNotice);
  writeNotices(notices);
  res.status(201).json(newNotice);
});

// PUT /api/notices/:id -> edit an existing notice
app.put("/api/notices/:id", (req, res) => {
  const notices = readNotices();
  const notice = notices.find((n) => n.id === req.params.id);

  if (!notice) {
    return res.status(404).json({ error: "Notice not found" });
  }

  const { title, content, date, status } = req.body;
  if (title !== undefined) notice.title = title;
  if (content !== undefined) notice.content = content;
  if (date !== undefined) notice.date = date;
  if (status !== undefined) notice.status = status;

  writeNotices(notices);
  res.json(notice);
});

// POST /api/notices/:id/toggle -> flip published <-> draft
app.post("/api/notices/:id/toggle", (req, res) => {
  const notices = readNotices();
  const notice = notices.find((n) => n.id === req.params.id);

  if (!notice) {
    return res.status(404).json({ error: "Notice not found" });
  }

  notice.status = notice.status === "published" ? "draft" : "published";
  writeNotices(notices);
  res.json(notice);
});

// DELETE /api/notices/:id -> remove a notice
app.delete("/api/notices/:id", (req, res) => {
  const notices = readNotices();
  const exists = notices.some((n) => n.id === req.params.id);

  if (!exists) {
    return res.status(404).json({ error: "Notice not found" });
  }

  writeNotices(notices.filter((n) => n.id !== req.params.id));
  res.status(204).end();
});

// ---------------------------------------------------------
// Courses API
// Same shape as notices: GET (with optional ?status= filter),
// POST to create, PUT to edit, DELETE to remove.
// ---------------------------------------------------------

// GET /api/courses                 -> everything (admin panel uses this)
// GET /api/courses?status=active   -> only active ones (public Course.html uses this)
app.get("/api/courses", (req, res) => {
  const courses = readCourses();
  const { status } = req.query;
  const result = status ? courses.filter((c) => c.status === status) : courses;
  res.json(result);
});

// POST /api/courses -> create a new course
app.post("/api/courses", (req, res) => {
  const { name, category, duration, desc, enrolled, status } = req.body;

  if (!name || !duration || !desc) {
    return res.status(400).json({ error: "name, duration, and desc are required" });
  }

  const courses = readCourses();
  const newCourse = {
    id: "c" + Date.now(),
    name,
    category: category || "Office",
    duration,
    desc,
    enrolled: enrolled || 0,
    status: status || "active",
  };

  courses.unshift(newCourse);
  writeCourses(courses);
  res.status(201).json(newCourse);
});

// PUT /api/courses/:id -> edit an existing course
app.put("/api/courses/:id", (req, res) => {
  const courses = readCourses();
  const course = courses.find((c) => c.id === req.params.id);

  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }

  const { name, category, duration, desc, enrolled, status } = req.body;
  if (name !== undefined) course.name = name;
  if (category !== undefined) course.category = category;
  if (duration !== undefined) course.duration = duration;
  if (desc !== undefined) course.desc = desc;
  if (enrolled !== undefined) course.enrolled = enrolled;
  if (status !== undefined) course.status = status;

  writeCourses(courses);
  res.json(course);
});

// DELETE /api/courses/:id -> remove a course
app.delete("/api/courses/:id", (req, res) => {
  const courses = readCourses();
  const exists = courses.some((c) => c.id === req.params.id);

  if (!exists) {
    return res.status(404).json({ error: "Course not found" });
  }

  writeCourses(courses.filter((c) => c.id !== req.params.id));
  res.status(204).end();
});

// ---------------------------------------------------------
// Gallery photo uploads (Multer)
//
// Photos are no longer added by typing a path — the admin panel
// sends the actual file, and this saves it to disk automatically.
//
// Uploaded files go in img/gallery/ (a SUBfolder of img/), not
// directly in img/. That's deliberate: img/ also holds fixed site
// assets like the logo and About-page photos. Keeping uploads in
// their own folder means the delete route below can safely remove
// a file without any risk of it being one of those shared assets.
// ---------------------------------------------------------

const GALLERY_UPLOADS_DIR = path.join(__dirname, "img", "gallery");
fs.mkdirSync(GALLERY_UPLOADS_DIR, { recursive: true }); // creates it on first run if missing

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, GALLERY_UPLOADS_DIR),
    filename: (req, file, cb) => {
      // Never trust the uploaded filename as-is (it's attacker-controlled
      // text). Generate our own safe, unique name instead: timestamp +
      // random number + the real extension.
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `photo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed."));
    }
    cb(null, true);
  },
}).single("photo"); // must match formData.append("photo", file) on the client

// Wraps multer so upload errors (wrong file type, too large) come back
// as a normal JSON error response instead of crashing the request.
function handlePhotoUpload(req, res, next) {
  photoUpload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Photo is too large. Max size is 5MB." });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    next();
  });
}

// Deletes a gallery photo's file from disk, but ONLY if it lives inside
// img/gallery/ (i.e. it was uploaded through this system). Older entries
// may still point at shared images elsewhere in img/ - those are never
// touched, since deleting them could break other pages that use them.
function deletePhotoFileIfOwned(imagePath) {
  if (!imagePath || !imagePath.startsWith("img/gallery/")) return;
  const filename = path.basename(imagePath); // strips any directory part
  fs.unlink(path.join(GALLERY_UPLOADS_DIR, filename), (err) => {
    if (err && err.code !== "ENOENT") console.error("Could not delete photo file:", err);
  });
}

// ---------------------------------------------------------
// Gallery API
// Same read/write-whole-file pattern. No draft/published
// status here (matches the old in-memory admin behavior) —
// every photo saved is shown on the public gallery.
// ---------------------------------------------------------

// GET /api/gallery -> every photo (both admin panel and public Gallery.html use this)
app.get("/api/gallery", (req, res) => {
  res.json(readGallery());
});

// POST /api/gallery -> add a new photo
// handlePhotoUpload runs first: it parses the multipart form, saves the
// file to img/gallery/, and populates req.file + req.body for us.
app.post("/api/gallery", handlePhotoUpload, (req, res) => {
  const { title, desc } = req.body;

  if (!title || !desc) {
    return res.status(400).json({ error: "title and desc are required" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Please choose a photo to upload." });
  }

  const photos = readGallery();
  const newPhoto = {
    id: "p" + Date.now(),
    title,
    desc,
    image: "img/gallery/" + req.file.filename,
  };

  photos.unshift(newPhoto);
  writeGallery(photos);
  res.status(201).json(newPhoto);
});

// PUT /api/gallery/:id -> edit an existing photo
// A new file is optional here - if the admin didn't choose one, req.file
// is just undefined and the existing image is left alone.
app.put("/api/gallery/:id", handlePhotoUpload, (req, res) => {
  const photos = readGallery();
  const photo = photos.find((p) => p.id === req.params.id);

  if (!photo) {
    return res.status(404).json({ error: "Photo not found" });
  }

  const { title, desc } = req.body;
  if (title !== undefined) photo.title = title;
  if (desc !== undefined) photo.desc = desc;

  if (req.file) {
    const oldImage = photo.image;
    photo.image = "img/gallery/" + req.file.filename;
    deletePhotoFileIfOwned(oldImage); // clean up the file it's replacing
  }

  writeGallery(photos);
  res.json(photo);
});

// DELETE /api/gallery/:id -> remove a photo (and its file, if we own it)
app.delete("/api/gallery/:id", (req, res) => {
  const photos = readGallery();
  const photo = photos.find((p) => p.id === req.params.id);

  if (!photo) {
    return res.status(404).json({ error: "Photo not found" });
  }

  deletePhotoFileIfOwned(photo.image);
  writeGallery(photos.filter((p) => p.id !== req.params.id));
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
