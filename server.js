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

function readNotices() {
  const raw = fs.readFileSync(NOTICES_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeNotices(notices) {
  fs.writeFileSync(NOTICES_FILE, JSON.stringify(notices, null, 2));
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
