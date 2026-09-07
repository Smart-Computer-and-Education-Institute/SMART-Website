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
  "/.env",
  "/.git",
  "/test_careers.js",
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
  weeklyHours: {
    sunday: { open: "06:00", close: "18:00", closed: false },
    monday: { open: "06:00", close: "18:00", closed: false },
    tuesday: { open: "06:00", close: "18:00", closed: false },
    wednesday: { open: "06:00", close: "18:00", closed: false },
    thursday: { open: "06:00", close: "18:00", closed: false },
    friday: { open: "06:00", close: "18:00", closed: false },
    saturday: { open: "06:00", close: "18:00", closed: true },
  },
  nextHolidayNoticeId: null,
  whatsapp: "",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d445.7349500066516!2d88.05294745192597!3d26.65233713027649!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39e5b10076063541%3A0x576f4e4164aade03!2sSmart%20Computer%20%26%20Education%20Institute!5e0!3m2!1sen!2snp!4v1782028540603!5m2!1sen!2snp",
  mapDirectionsUrl:
    "https://www.google.com/maps/place/Smart+Computer+%26+Education+Institute/@26.6523371,88.0529474,19z",
  footerTagline: "Practical computer and digital skills training in Charali, Jhapa.",
  footerNote: "Jhapa, Nepal",
  footerCopyright: "Smart Computer and Education Institute. All rights reserved.",
  footerCtaText: "Ready to start your tech career? Enroll in a course today.",
  footerCtaLabel: "Get Started",
  footerCtaLink: "Contact.html",
  socialLinks: {
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: "",
  },
};

async function getContactSettings() {
  const existing = await db.findOne("settings", "contact");
  if (!existing) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...existing,
    nextHolidayNoticeId: existing.nextHolidayNoticeId || null,
    weeklyHours: {
      ...DEFAULT_SETTINGS.weeklyHours,
      ...(existing.weeklyHours || {}),
    },
    socialLinks: {
      ...DEFAULT_SETTINGS.socialLinks,
      ...(existing.socialLinks || {}),
    },
  };
}

app.get(
  "/api/public/settings",
  asyncHandler(async (req, res) => {
    const settings = await getContactSettings();
    let nextHoliday = null;

    if (settings.nextHolidayNoticeId) {
      const notice = await db.findOne("notices", settings.nextHolidayNoticeId);
      if (notice) {
        nextHoliday = {
          id: notice.id,
          title: notice.title,
          date: notice.date,
          content: notice.content,
        };
      }
    }

    res.json({
      ...settings,
      nextHoliday,
    });
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
    const {
      address,
      phones,
      email,
      hours,
      weeklyHours,
      nextHolidayNoticeId,
      whatsapp,
      mapEmbedUrl,
      mapDirectionsUrl,
      footerTagline,
      footerNote,
      footerCopyright,
      footerCtaText,
      footerCtaLabel,
      footerCtaLink,
      socialLinks,
    } = req.body || {};
    const changes = {};

    if (address !== undefined) changes.address = String(address).slice(0, 300);
    if (email !== undefined) changes.email = String(email).slice(0, 150);
    if (hours !== undefined) changes.hours = String(hours).slice(0, 200);
    if (whatsapp !== undefined) changes.whatsapp = String(whatsapp).slice(0, 300);
    if (mapEmbedUrl !== undefined) changes.mapEmbedUrl = String(mapEmbedUrl).slice(0, 1500);
    if (mapDirectionsUrl !== undefined) changes.mapDirectionsUrl = String(mapDirectionsUrl).slice(0, 500);
    if (footerTagline !== undefined) changes.footerTagline = String(footerTagline).slice(0, 200);
    if (footerNote !== undefined) changes.footerNote = String(footerNote).slice(0, 80);
    if (footerCopyright !== undefined) changes.footerCopyright = String(footerCopyright).slice(0, 200);
    if (footerCtaText !== undefined) changes.footerCtaText = String(footerCtaText).slice(0, 160);
    if (footerCtaLabel !== undefined) changes.footerCtaLabel = String(footerCtaLabel).slice(0, 40);
    if (footerCtaLink !== undefined) changes.footerCtaLink = String(footerCtaLink).trim().slice(0, 300);
    if (socialLinks !== undefined && typeof socialLinks === "object" && socialLinks !== null) {
      const allowedKeys = ["facebook", "instagram", "youtube", "tiktok"];
      const cleanSocial = {};
      for (const key of allowedKeys) {
        const val = socialLinks[key];
        cleanSocial[key] = val ? String(val).trim().slice(0, 300) : "";
      }
      changes.socialLinks = cleanSocial;
    }
    if (phones !== undefined) {
      const list = Array.isArray(phones) ? phones : String(phones).split("\n");
      changes.phones = list
        .map((p) => String(p).trim())
        .filter(Boolean)
        .slice(0, 10);
    }

    if (nextHolidayNoticeId !== undefined) {
      if (nextHolidayNoticeId === null || nextHolidayNoticeId === "") {
        changes.nextHolidayNoticeId = null;
      } else {
        const noticeIdStr = String(nextHolidayNoticeId).trim();
        const notice = await db.findOne("notices", noticeIdStr);
        if (!notice) {
          return res.status(400).json({ error: "Referenced holiday notice does not exist." });
        }
        changes.nextHolidayNoticeId = notice.id;
      }
    }

    if (weeklyHours !== undefined) {
      if (typeof weeklyHours !== "object" || weeklyHours === null) {
        return res.status(400).json({ error: "weeklyHours must be an object." });
      }
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      const cleanHours = {};
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      for (const day of days) {
        const item = weeklyHours[day] || {};
        const closed = Boolean(item.closed);
        const open = String(item.open || "06:00").trim();
        const close = String(item.close || "18:00").trim();

        if (!closed) {
          if (!timeRegex.test(open) || !timeRegex.test(close)) {
            return res.status(400).json({ error: `Invalid time format (HH:MM) for ${day}.` });
          }
          if (open >= close) {
            return res.status(400).json({ error: `Open time (${open}) must be before close time (${close}) for ${day}.` });
          }
        }
        cleanHours[day] = {
          open: timeRegex.test(open) ? open : "06:00",
          close: timeRegex.test(close) ? close : "18:00",
          closed,
        };
      }
      changes.weeklyHours = cleanHours;
    }

    const existing = await db.findOne("settings", "contact");
    const updated = existing
      ? await db.updateOne("settings", "contact", changes)
      : await db.insertOne("settings", { ...DEFAULT_SETTINGS, ...changes, id: "contact" });

    res.json(updated);
  })
);

// ---------------------------------------------------------
// Popups API (multi-record collection with scheduling & priority)
// Unlike the singleton Contact Settings, Popups supports multiple
// independent, schedulable announcement & promo dialogs.
// Public GET /api/public/site-popups returns an array of currently
// active, scheduled, and resolved popups sorted by priority ascending.
// Admin routes allow full CRUD management with date, time, and weekday scheduling.
// ---------------------------------------------------------

function isPopupActiveNow(popup, now = new Date()) {
  if (!popup.enabled) return false;

  const schedule = popup.schedule || {};

  // 1. Date range check (YYYY-MM-DD)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (schedule.startDate && todayStr < schedule.startDate) return false;
  if (schedule.endDate && todayStr > schedule.endDate) return false;

  // 2. Day of week check (0=Sun, 1=Mon, ..., 6=Sat)
  if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
    const currentDay = now.getDay();
    if (!schedule.daysOfWeek.includes(currentDay)) return false;
  }

  // 3. Time of day check (HH:MM 24h)
  if (schedule.startTime || schedule.endTime) {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${hours}:${minutes}`;

    if (schedule.startTime && currentTimeStr < schedule.startTime) return false;
    if (schedule.endTime && currentTimeStr > schedule.endTime) return false;
  }

  return true;
}

async function parseAndValidatePopup(body = {}, isUpdate = false, existing = null) {
  const {
    name,
    enabled,
    priority,
    source = "custom",
    refId,
    title,
    message,
    image,
    ctaLabel,
    ctaLink,
    frequency,
    schedule,
  } = body;

  const rawName = name !== undefined ? String(name).trim() : (existing ? existing.name : "");
  if (!rawName) {
    return { ok: false, error: "Popup name is required." };
  }

  const ALLOWED_SOURCES = ["custom", "offer", "notice"];
  const popupSource = source !== undefined ? source : (existing ? existing.source : "custom");
  if (!ALLOWED_SOURCES.includes(popupSource)) {
    return { ok: false, error: "Invalid source. Allowed values: custom, offer, notice." };
  }

  const ALLOWED_FREQUENCIES = ["everyLoad", "oncePerSession", "oncePerDay"];
  const popupFrequency = frequency !== undefined ? frequency : (existing ? existing.frequency : "everyLoad");
  if (!ALLOWED_FREQUENCIES.includes(popupFrequency)) {
    return { ok: false, error: "Invalid frequency. Allowed values: everyLoad, oncePerSession, oncePerDay." };
  }

  let resolvedRefId = null;
  if (popupSource === "offer" || popupSource === "notice") {
    const targetRefId = refId !== undefined ? refId : (existing ? existing.refId : null);
    if (!targetRefId) {
      return { ok: false, error: `refId is required when source is "${popupSource}".` };
    }
    const collection = popupSource === "offer" ? "offers" : "notices";
    const target = await db.findOne(collection, String(targetRefId));
    if (!target) {
      return { ok: false, error: `Referenced ${popupSource} not found.` };
    }
    resolvedRefId = String(targetRefId);
  }

  let parsedPriority = 10;
  if (priority !== undefined) {
    const num = parseInt(priority, 10);
    parsedPriority = isNaN(num) ? 10 : num;
  } else if (existing && typeof existing.priority === "number") {
    parsedPriority = existing.priority;
  }

  const rawSchedule = schedule || (existing ? existing.schedule : {}) || {};
  const parsedSchedule = {
    startDate: null,
    endDate: null,
    daysOfWeek: [],
    startTime: null,
    endTime: null,
  };

  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  if (rawSchedule.startDate) {
    const sDate = String(rawSchedule.startDate).trim();
    if (!DATE_REGEX.test(sDate) || isNaN(Date.parse(sDate))) {
      return { ok: false, error: "schedule.startDate must be in YYYY-MM-DD format." };
    }
    parsedSchedule.startDate = sDate;
  }

  if (rawSchedule.endDate) {
    const eDate = String(rawSchedule.endDate).trim();
    if (!DATE_REGEX.test(eDate) || isNaN(Date.parse(eDate))) {
      return { ok: false, error: "schedule.endDate must be in YYYY-MM-DD format." };
    }
    parsedSchedule.endDate = eDate;
  }

  if (parsedSchedule.startDate && parsedSchedule.endDate) {
    if (parsedSchedule.startDate > parsedSchedule.endDate) {
      return { ok: false, error: "schedule.startDate must be less than or equal to endDate." };
    }
  }

  if (rawSchedule.daysOfWeek !== undefined && rawSchedule.daysOfWeek !== null) {
    if (!Array.isArray(rawSchedule.daysOfWeek)) {
      return { ok: false, error: "schedule.daysOfWeek must be an array." };
    }
    for (const d of rawSchedule.daysOfWeek) {
      const num = Number(d);
      if (!Number.isInteger(num) || num < 0 || num > 6) {
        return { ok: false, error: "schedule.daysOfWeek entries must be numbers between 0 and 6." };
      }
    }
    parsedSchedule.daysOfWeek = Array.from(new Set(rawSchedule.daysOfWeek.map(Number))).sort((a, b) => a - b);
  }

  const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (rawSchedule.startTime) {
    const sTime = String(rawSchedule.startTime).trim();
    if (!TIME_REGEX.test(sTime)) {
      return { ok: false, error: "schedule.startTime must be a valid HH:MM time." };
    }
    parsedSchedule.startTime = sTime;
  }

  if (rawSchedule.endTime) {
    const eTime = String(rawSchedule.endTime).trim();
    if (!TIME_REGEX.test(eTime)) {
      return { ok: false, error: "schedule.endTime must be a valid HH:MM time." };
    }
    parsedSchedule.endTime = eTime;
  }

  if (parsedSchedule.startTime && parsedSchedule.endTime) {
    if (parsedSchedule.startTime >= parsedSchedule.endTime) {
      return { ok: false, error: "schedule.startTime must be before endTime when both are set." };
    }
  }

  const data = {
    name: rawName.slice(0, 100),
    enabled: enabled !== undefined ? Boolean(enabled) : (existing ? Boolean(existing.enabled) : false),
    priority: parsedPriority,
    source: popupSource,
    refId: resolvedRefId,
    title: title !== undefined ? String(title).slice(0, 100) : (existing ? (existing.title || "") : ""),
    message: message !== undefined ? String(message).slice(0, 500) : (existing ? (existing.message || "") : ""),
    image: image !== undefined ? String(image) : (existing ? (existing.image || "") : ""),
    ctaLabel: ctaLabel !== undefined ? String(ctaLabel).slice(0, 40) : (existing ? (existing.ctaLabel || "Learn more") : "Learn more"),
    ctaLink: ctaLink !== undefined ? String(ctaLink).slice(0, 500) : (existing ? (existing.ctaLink || "") : ""),
    frequency: popupFrequency,
    schedule: parsedSchedule,
  };

  return { ok: true, data };
}

app.get(
  "/api/public/site-popups",
  asyncHandler(async (req, res) => {
    const allPopups = await db.findAll("popups");
    const now = new Date();
    const qualifying = [];

    for (const p of allPopups) {
      if (!isPopupActiveNow(p, now)) continue;

      if (p.source === "offer") {
        if (!p.refId) continue;
        const offer = await db.findOne("offers", p.refId);
        if (!offer) continue; // Referenced offer was deleted -> exclude popup
        qualifying.push({
          id: p.id,
          name: p.name || "",
          priority: typeof p.priority === "number" ? p.priority : 10,
          source: "offer",
          refId: p.refId,
          title: offer.title || "",
          message: offer.description || "",
          image: offer.image || "",
          tag: offer.tag || "",
          ctaLabel: p.ctaLabel || "Learn more",
          ctaLink: p.ctaLink || "",
          frequency: p.frequency || "everyLoad",
        });
      } else if (p.source === "notice") {
        if (!p.refId) continue;
        const notice = await db.findOne("notices", p.refId);
        if (!notice) continue; // Referenced notice was deleted -> exclude popup
        qualifying.push({
          id: p.id,
          name: p.name || "",
          priority: typeof p.priority === "number" ? p.priority : 10,
          source: "notice",
          refId: p.refId,
          title: notice.title || "",
          message: notice.content || "",
          image: "",
          tag: "Notice",
          ctaLabel: p.ctaLabel || "Learn more",
          ctaLink: p.ctaLink || "",
          frequency: p.frequency || "everyLoad",
        });
      } else {
        // "custom"
        qualifying.push({
          id: p.id,
          name: p.name || "",
          priority: typeof p.priority === "number" ? p.priority : 10,
          source: "custom",
          title: p.title || "",
          message: p.message || "",
          image: p.image || "",
          tag: "",
          ctaLabel: p.ctaLabel || "Learn more",
          ctaLink: p.ctaLink || "",
          frequency: p.frequency || "everyLoad",
        });
      }
    }

    qualifying.sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
    res.json(qualifying);
  })
);

app.get(
  "/api/popups",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const popups = await db.findAll("popups");
    popups.sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
    res.json(popups);
  })
);

app.post(
  "/api/popups",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const parsed = await parseAndValidatePopup(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const allPopups = await db.findAll("popups");
    const maxPriority = allPopups.reduce(
      (max, p) => Math.max(max, typeof p.priority === "number" ? p.priority : 0),
      0
    );

    const newPopup = {
      id: "pop" + Date.now(),
      ...parsed.data,
      priority: maxPriority + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insertOne("popups", newPopup);
    res.status(201).json(newPopup);
  })
);

app.post(
  "/api/popups/:id/reorder",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { direction } = req.body || {};
    if (direction !== "up" && direction !== "down") {
      return res.status(400).json({ error: 'Direction must be "up" or "down".' });
    }

    const popups = await db.findAll("popups");
    popups.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    const idx = popups.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Popup not found." });
    }

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= popups.length) {
      return res.json(popups);
    }

    // Normalize and swap priority values
    popups.forEach((p, i) => {
      p.priority = (i + 1) * 10;
    });

    const temp = popups[idx].priority;
    popups[idx].priority = popups[targetIdx].priority;
    popups[targetIdx].priority = temp;

    await Promise.all([
      db.updateOne("popups", popups[idx].id, {
        priority: popups[idx].priority,
        updatedAt: new Date().toISOString(),
      }),
      db.updateOne("popups", popups[targetIdx].id, {
        priority: popups[targetIdx].priority,
        updatedAt: new Date().toISOString(),
      }),
    ]);

    popups.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    res.json(popups);
  })
);

app.put(
  "/api/popups/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("popups", req.params.id);
    if (!existing) return res.status(404).json({ error: "Popup not found" });

    const parsed = await parseAndValidatePopup(req.body, true, existing);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const changes = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    const updated = await db.updateOne("popups", req.params.id, changes);
    res.json(updated);
  })
);

app.delete(
  "/api/popups/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("popups", req.params.id);
    if (!existing) return res.status(404).json({ error: "Popup not found" });

    if (existing.image) {
      await blobStorage.deleteUpload(existing.image);
    }

    await db.deleteOne("popups", req.params.id);
    res.status(204).end();
  })
);

app.post(
  "/api/popups/:id/photo",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("popups", req.params.id);
    if (!existing) return res.status(404).json({ error: "Popup not found" });
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a photo to upload." });
    }

    const filename = safeUploadName("popup", req.file.mimetype);
    const imageUrl = await blobStorage.saveUpload(req.file.buffer, "popups", filename);

    if (existing.image) {
      await blobStorage.deleteUpload(existing.image);
    }

    const updated = await db.updateOne("popups", req.params.id, {
      image: imageUrl,
      updatedAt: new Date().toISOString(),
    });
    res.json({ image: imageUrl, ...updated });
  })
);

// ---------------------------------------------------------
// About Page API (singleton document — one editable copy of every
// text block on the public About Us page). Mirrors the Settings API
// pattern exactly: one fixed document id ("about"), a DEFAULT_ABOUT
// fallback, a public GET, a protected GET and PUT.
// Use "\n" in multi-line fields to separate paragraphs; the public
// page renders them with the same escape+nl2br helper used elsewhere.
// ---------------------------------------------------------

const DEFAULT_ABOUT = {
  id: "about",
  founderName: "Bikash Pokharel",
  founderRole: "Founder & CEO,",
  founderOrg: "Smart Computer and Education Institute.",
  founderExp: "7+ years in Smart Computer and Education Institute.",
  founderMessage:
    "Dear Partners,\n\nWrite your opening paragraph here — introduce yourself, your role, and the story of how your organization began.\n\nWrite a second paragraph describing your mission, the services you offer, and what sets your organization apart.\n\nWrite a third paragraph about your vision for partnerships, growth, and the impact you aim to create for the people you serve.",
  founderSignoff: "Warm regards,",
  founderSignature: "Bikash Pokharel",
  // Photos — store as URL strings; empty string means "use the hardcoded fallback in About.html"
  founderPhoto: "",
  storyPhoto: "",
  missionPhoto: "",
  visionPhoto: "",
  whyPhoto: "",
  ourStoryHeading: "Our Story",
  ourStoryText:
    "At Smart Computer & Education Institute, we believe education should be practical, affordable, and career-focused. For over 12 years, we have been helping students build confidence through quality computer training, language classes, and skill-based services.",
  ourMissionHeading: "Our Mission",
  ourMissionText:
    "We believe education changes lives. Our mission is to make quality computer and language education accessible to everyone by providing practical training, experienced instructors, and real-world learning that prepares students for academic and career success.",
  ourVisionHeading: "Our Vision",
  ourVisionText:
    "To be the leading skill-development hub in Jhapa, empowering individuals with cutting-edge digital literacy, vocational proficiency, and global career opportunities.",
  whyChooseUsHeading: "Why Choose Us",
  whyChooseUsText:
    "With 12+ years of teaching experience, flexible shift timings, hands-on lab access, and dedicated job placement assistance, we ensure every student transforms learning into success.",
  customSections: [],
};

async function getAboutContent() {
  const existing = await db.findOne("about", "about");
  const content = existing ? { ...DEFAULT_ABOUT, ...existing } : { ...DEFAULT_ABOUT };
  if (!Array.isArray(content.customSections)) {
    content.customSections = [];
  }
  content.customSections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return content;
}

app.get(
  "/api/public/about",
  asyncHandler(async (req, res) => {
    res.json(await getAboutContent());
  })
);

app.get(
  "/api/about",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    res.json(await getAboutContent());
  })
);

app.put(
  "/api/about",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const {
      founderName, founderRole, founderOrg, founderExp,
      founderMessage, founderSignoff, founderSignature,
      ourStoryHeading, ourStoryText,
      ourMissionHeading, ourMissionText,
      ourVisionHeading, ourVisionText,
      whyChooseUsHeading, whyChooseUsText,
    } = req.body || {};
    const changes = {};

    if (founderName      !== undefined) changes.founderName      = String(founderName).slice(0, 150);
    if (founderRole      !== undefined) changes.founderRole      = String(founderRole).slice(0, 150);
    if (founderOrg       !== undefined) changes.founderOrg       = String(founderOrg).slice(0, 200);
    if (founderExp       !== undefined) changes.founderExp       = String(founderExp).slice(0, 200);
    if (founderMessage   !== undefined) changes.founderMessage   = String(founderMessage).slice(0, 5000);
    if (founderSignoff   !== undefined) changes.founderSignoff   = String(founderSignoff).slice(0, 200);
    if (founderSignature !== undefined) changes.founderSignature = String(founderSignature).slice(0, 150);
    if (ourStoryHeading  !== undefined) changes.ourStoryHeading  = String(ourStoryHeading).slice(0, 200);
    if (ourStoryText     !== undefined) changes.ourStoryText     = String(ourStoryText).slice(0, 3000);
    if (ourMissionHeading!== undefined) changes.ourMissionHeading= String(ourMissionHeading).slice(0, 200);
    if (ourMissionText   !== undefined) changes.ourMissionText   = String(ourMissionText).slice(0, 3000);
    if (ourVisionHeading !== undefined) changes.ourVisionHeading = String(ourVisionHeading).slice(0, 200);
    if (ourVisionText    !== undefined) changes.ourVisionText    = String(ourVisionText).slice(0, 3000);
    if (whyChooseUsHeading!==undefined) changes.whyChooseUsHeading=String(whyChooseUsHeading).slice(0, 200);
    if (whyChooseUsText  !== undefined) changes.whyChooseUsText  = String(whyChooseUsText).slice(0, 3000);

    const existing = await db.findOne("about", "about");
    const updated = existing
      ? await db.updateOne("about", "about", changes)
      : await db.insertOne("about", { ...DEFAULT_ABOUT, ...changes, id: "about" });

    res.json(updated);
  })
);

// Photo-upload slots for About Us. Each POST replaces exactly one image field.
// Accepted slot names match the field names stored in the about document.
const ABOUT_PHOTO_SLOTS = ["founderPhoto", "storyPhoto", "missionPhoto", "visionPhoto", "whyPhoto"];

app.post(
  "/api/about/photo/:slot",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const { slot } = req.params;
    if (!ABOUT_PHOTO_SLOTS.includes(slot)) {
      return res.status(400).json({ error: `Unknown photo slot: ${slot}` });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a photo to upload." });
    }

    const filename = safeUploadName("about-" + slot, req.file.mimetype);
    const imageUrl = await blobStorage.saveUpload(req.file.buffer, "about", filename);

    const existing = await db.findOne("about", "about");
    const updated = existing
      ? await db.updateOne("about", "about", { [slot]: imageUrl })
      : await db.insertOne("about", { ...DEFAULT_ABOUT, [slot]: imageUrl, id: "about" });

    res.json({ [slot]: imageUrl, ...updated });
  })
);

// ---------------------------------------------------------
// Custom Sections for About Page
// Allows admins to dynamically add, edit, reorder, and remove
// arbitrary sections beyond the fixed 5 sections.
// ---------------------------------------------------------

app.get(
  "/api/about/sections",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const about = await getAboutContent();
    res.json(about.customSections || []);
  })
);

app.post(
  "/api/about/sections",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { heading, text } = req.body || {};
    if (!heading || !String(heading).trim()) {
      return res.status(400).json({ error: "Section heading is required." });
    }

    const about = await getAboutContent();
    const sections = Array.isArray(about.customSections) ? about.customSections.slice() : [];
    const maxOrder = sections.reduce(
      (max, s) => Math.max(max, typeof s.order === "number" ? s.order : 0),
      0
    );

    const newSection = {
      id: "sec" + Date.now(),
      heading: String(heading).trim().slice(0, 200),
      text: text ? String(text).slice(0, 5000) : "",
      photo: "",
      order: maxOrder + 1,
    };

    sections.push(newSection);

    const existing = await db.findOne("about", "about");
    if (existing) {
      await db.updateOne("about", "about", { customSections: sections });
    } else {
      await db.insertOne("about", { ...DEFAULT_ABOUT, customSections: sections, id: "about" });
    }

    res.status(201).json(newSection);
  })
);

app.put(
  "/api/about/sections/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { heading, text, order } = req.body || {};
    const about = await getAboutContent();
    const sections = Array.isArray(about.customSections) ? about.customSections.slice() : [];
    const idx = sections.findIndex((s) => s.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ error: "Section not found." });
    }

    if (heading !== undefined) {
      if (!String(heading).trim()) {
        return res.status(400).json({ error: "Heading cannot be empty." });
      }
      sections[idx].heading = String(heading).trim().slice(0, 200);
    }
    if (text !== undefined) {
      sections[idx].text = String(text).slice(0, 5000);
    }
    if (order !== undefined) {
      const num = parseInt(order, 10);
      if (!isNaN(num)) {
        sections[idx].order = num;
      }
    }

    await db.updateOne("about", "about", { customSections: sections });
    res.json(sections[idx]);
  })
);

app.delete(
  "/api/about/sections/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const about = await getAboutContent();
    const sections = Array.isArray(about.customSections) ? about.customSections.slice() : [];
    const idx = sections.findIndex((s) => s.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ error: "Section not found." });
    }

    const [removed] = sections.splice(idx, 1);
    if (removed.photo) {
      await blobStorage.deleteUpload(removed.photo);
    }

    await db.updateOne("about", "about", { customSections: sections });
    res.status(204).end();
  })
);

app.post(
  "/api/about/sections/:id/photo",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const about = await getAboutContent();
    const sections = Array.isArray(about.customSections) ? about.customSections.slice() : [];
    const idx = sections.findIndex((s) => s.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ error: "Section not found." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Please choose a photo to upload." });
    }

    const filename = safeUploadName("about-sec", req.file.mimetype);
    const photoUrl = await blobStorage.saveUpload(req.file.buffer, "about-sections", filename);

    if (sections[idx].photo) {
      await blobStorage.deleteUpload(sections[idx].photo);
    }

    sections[idx].photo = photoUrl;
    await db.updateOne("about", "about", { customSections: sections });

    res.json({ photo: photoUrl, ...sections[idx] });
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
    const { name, category, duration, desc, enrolled, status, image } = req.body || {};
    if (!name || !duration || !desc) {
      return res.status(400).json({ error: "name, duration, and desc are required" });
    }

    const newService = {
      id: "s" + Date.now(),
      name: String(name).slice(0, 150),
      category: category || "Office",
      image: image || "",
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
    const { name, category, duration, desc, enrolled, status, image } = req.body || {};
    const changes = {};
    if (name !== undefined) changes.name = String(name).slice(0, 150);
    if (category !== undefined) changes.category = category;
    if (image !== undefined) changes.image = image;
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
    const existing = await db.findOne("services", req.params.id);
    if (!existing) return res.status(404).json({ error: "Service not found" });
    if (existing.image) {
      await blobStorage.deleteUpload(existing.image);
    }
    await db.deleteOne("services", req.params.id);
    res.status(204).end();
  })
);

app.post(
  "/api/services/:id/photo",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("services", req.params.id);
    if (!existing) return res.status(404).json({ error: "Service not found" });
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a photo to upload." });
    }

    const filename = safeUploadName("service", req.file.mimetype);
    const imageUrl = await blobStorage.saveUpload(req.file.buffer, "services", filename);

    if (existing.image) {
      await blobStorage.deleteUpload(existing.image);
    }

    const updated = await db.updateOne("services", req.params.id, { image: imageUrl });
    res.json({ image: imageUrl, ...updated });
  })
);

// ---------------------------------------------------------
// Offers API
// Public GET sees only active offers, sorted newest first.
// Admin routes see and manage all offers.
// ---------------------------------------------------------

app.get(
  "/api/public/offers",
  asyncHandler(async (req, res) => {
    const offers = await db.findAll("offers");
    const active = offers.filter((o) => o.status === "active");
    active.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(active);
  })
);

app.get(
  "/api/offers",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const offers = await db.findAll("offers");
    offers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(offers);
  })
);

app.post(
  "/api/offers",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { title, description, tag, image, ctaLabel, ctaLink, status } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ error: "title and description are required" });
    }

    const newOffer = {
      id: "offer" + Date.now(),
      title: String(title).slice(0, 150),
      description: String(description).slice(0, 3000),
      tag: String(tag || "Special Offer").slice(0, 50),
      image: image || "",
      ctaLabel: String(ctaLabel || "Learn more").slice(0, 60),
      ctaLink: String(ctaLink || "").slice(0, 300),
      status: status === "draft" ? "draft" : "active",
      createdAt: new Date().toISOString(),
    };

    await db.insertOne("offers", newOffer);
    res.status(201).json(newOffer);
  })
);

app.put(
  "/api/offers/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { title, description, tag, image, ctaLabel, ctaLink, status } = req.body || {};
    const changes = {};
    if (title !== undefined) changes.title = String(title).slice(0, 150);
    if (description !== undefined) changes.description = String(description).slice(0, 3000);
    if (tag !== undefined) changes.tag = String(tag || "Special Offer").slice(0, 50);
    if (image !== undefined) changes.image = image;
    if (ctaLabel !== undefined) changes.ctaLabel = String(ctaLabel || "Learn more").slice(0, 60);
    if (ctaLink !== undefined) changes.ctaLink = String(ctaLink || "").slice(0, 300);
    if (status !== undefined) changes.status = status === "draft" ? "draft" : "active";

    const offer = await db.updateOne("offers", req.params.id, changes);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    res.json(offer);
  })
);

app.delete(
  "/api/offers/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("offers", req.params.id);
    if (!existing) return res.status(404).json({ error: "Offer not found" });
    if (existing.image) {
      await blobStorage.deleteUpload(existing.image);
    }
    await db.deleteOne("offers", req.params.id);
    res.status(204).end();
  })
);

app.post(
  "/api/offers/:id/photo",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("offers", req.params.id);
    if (!existing) return res.status(404).json({ error: "Offer not found" });
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a photo to upload." });
    }

    const filename = safeUploadName("offer", req.file.mimetype);
    const imageUrl = await blobStorage.saveUpload(req.file.buffer, "offers", filename);

    if (existing.image) {
      await blobStorage.deleteUpload(existing.image);
    }

    const updated = await db.updateOne("offers", req.params.id, { image: imageUrl });
    res.json({ image: imageUrl, ...updated });
  })
);

// ---------------------------------------------------------
// Career Categories ("Divisions") API
// Public GET returns the array of division names for Career.html.
// Admin routes allow creating, renaming, and deleting divisions.
// Renaming cascades to all career records using that division.
// ---------------------------------------------------------

const DEFAULT_CAREER_CATEGORIES = ["Teaching", "IT & Support", "Administration", "Marketing"];

async function ensureCareerCategoriesSeeded() {
  const existing = await db.findAll("careerCategories");
  if (existing.length) return existing;

  const seeded = [];
  for (let i = 0; i < DEFAULT_CAREER_CATEGORIES.length; i++) {
    const category = { id: `ccat${Date.now()}${i}`, name: DEFAULT_CAREER_CATEGORIES[i] };
    await db.insertOne("careerCategories", category);
    seeded.push(category);
  }
  return seeded;
}

app.get(
  "/api/public/career-categories",
  asyncHandler(async (req, res) => {
    const categories = await ensureCareerCategoriesSeeded();
    res.json(sortByName(categories).map((c) => c.name));
  })
);

app.get(
  "/api/career-categories",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    res.json(sortByName(await ensureCareerCategoriesSeeded()));
  })
);

app.post(
  "/api/career-categories",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const name = String((req.body || {}).name || "").trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: "Enter a division name." });
    if (name.toLowerCase() === "all") {
      return res.status(400).json({ error: '"All" is reserved for the built-in "show everything" filter.' });
    }

    const existing = await ensureCareerCategoriesSeeded();
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: "That division already exists." });
    }

    const category = { id: "ccat" + Date.now(), name };
    await db.insertOne("careerCategories", category);
    res.status(201).json(category);
  })
);

app.put(
  "/api/career-categories/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const name = String((req.body || {}).name || "").trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: "Enter a division name." });
    if (name.toLowerCase() === "all") {
      return res.status(400).json({ error: '"All" is reserved for the built-in "show everything" filter.' });
    }

    await ensureCareerCategoriesSeeded();
    const existing = await db.findOne("careerCategories", req.params.id);
    if (!existing) return res.status(404).json({ error: "Division not found" });

    const all = await db.findAll("careerCategories");
    const clashes = all.some(
      (c) => c.id !== req.params.id && c.name.toLowerCase() === name.toLowerCase()
    );
    if (clashes) return res.status(409).json({ error: "That division already exists." });

    const oldName = existing.name;
    const updated = await db.updateOne("careerCategories", req.params.id, { name });

    // Cascade the rename so careers keep pointing at a division that exists
    if (oldName !== name) {
      const careers = await db.findAll("careers");
      await Promise.all(
        careers
          .filter((c) => c.category === oldName)
          .map((c) => db.updateOne("careers", c.id, { category: name }))
      );
    }

    res.json(updated);
  })
);

app.delete(
  "/api/career-categories/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    await ensureCareerCategoriesSeeded();
    const existing = await db.findOne("careerCategories", req.params.id);
    if (!existing) return res.status(404).json({ error: "Division not found" });
    await db.deleteOne("careerCategories", req.params.id);
    res.status(204).end();
  })
);

// ---------------------------------------------------------
// Careers API
// Same public/admin split as notices and services: public sees only
// open (active) jobs; the protected admin routes see and manage
// everything.
// ---------------------------------------------------------

app.get(
  "/api/public/careers",
  asyncHandler(async (req, res) => {
    const careers = await db.findAll("careers");
    res.json(careers.filter((c) => c.status === "open"));
  })
);

app.get(
  "/api/careers",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    res.json(await db.findAll("careers"));
  })
);

app.post(
  "/api/careers",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { title, category, location, employmentType, experience, description, status, image } =
      req.body || {};

    if (!title || !category || !description) {
      return res.status(400).json({ error: "title, category, and description are required" });
    }

    const divisions = await ensureCareerCategoriesSeeded();
    const matched = divisions.find(
      (c) => c.name.toLowerCase() === String(category).trim().toLowerCase()
    );
    if (!matched) {
      return res
        .status(400)
        .json({ error: `category must be one of: ${divisions.map((c) => c.name).join(", ")}` });
    }

    const newCareer = {
      id: "job" + Date.now(),
      title: String(title).slice(0, 150),
      category: matched.name,
      image: image || "",
      location: String(location || "Jhapa, Nepal").slice(0, 100),
      employmentType: String(employmentType || "Full-time").slice(0, 60),
      experience: String(experience || "").slice(0, 60),
      description: String(description).slice(0, 3000),
      status: status === "closed" ? "closed" : "open",
    };

    await db.insertOne("careers", newCareer);
    res.status(201).json(newCareer);
  })
);

app.put(
  "/api/careers/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { title, category, location, employmentType, experience, description, status, image } =
      req.body || {};
    const changes = {};

    if (title !== undefined) changes.title = String(title).slice(0, 150);
    if (category !== undefined) {
      const divisions = await ensureCareerCategoriesSeeded();
      const matched = divisions.find(
        (c) => c.name.toLowerCase() === String(category).trim().toLowerCase()
      );
      if (!matched) {
        return res
          .status(400)
          .json({ error: `category must be one of: ${divisions.map((c) => c.name).join(", ")}` });
      }
      changes.category = matched.name;
    }
    if (image !== undefined) changes.image = image;
    if (location !== undefined) changes.location = String(location).slice(0, 100);
    if (employmentType !== undefined) changes.employmentType = String(employmentType).slice(0, 60);
    if (experience !== undefined) changes.experience = String(experience).slice(0, 60);
    if (description !== undefined) changes.description = String(description).slice(0, 3000);
    if (status !== undefined) changes.status = status === "closed" ? "closed" : "open";

    const career = await db.updateOne("careers", req.params.id, changes);
    if (!career) return res.status(404).json({ error: "Career not found" });
    res.json(career);
  })
);

app.delete(
  "/api/careers/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("careers", req.params.id);
    if (!existing) return res.status(404).json({ error: "Career not found" });
    if (existing.image) {
      await blobStorage.deleteUpload(existing.image);
    }
    await db.deleteOne("careers", req.params.id);
    res.status(204).end();
  })
);

app.post(
  "/api/careers/:id/photo",
  requireApiAuth,
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("careers", req.params.id);
    if (!existing) return res.status(404).json({ error: "Career not found" });
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a photo to upload." });
    }

    const filename = safeUploadName("career", req.file.mimetype);
    const imageUrl = await blobStorage.saveUpload(req.file.buffer, "careers", filename);

    if (existing.image) {
      await blobStorage.deleteUpload(existing.image);
    }

    const updated = await db.updateOne("careers", req.params.id, { image: imageUrl });
    res.json({ image: imageUrl, ...updated });
  })
);

// ---------------------------------------------------------
// Job Applications API & Hardening
// ---------------------------------------------------------

const ALLOWED_CV_TYPES = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

const cvMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_CV_TYPES[file.mimetype]) {
      return cb(new Error("Only PDF, DOC, or DOCX documents are allowed."));
    }
    cb(null, true);
  },
}).single("cvFile"); // matches formData.append("cvFile", file)

function handleCvUpload(req, res, next) {
  cvMemoryUpload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "CV file is too large. Max size is 5MB." });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "CV upload failed." });
    }
    next();
  });
}

const applicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 submissions per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many applications submitted, please try again later." },
});

async function verifyTurnstileToken(token, remoteIp) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    // Optional fallback when running locally or without Turnstile keys configured
    console.warn("TURNSTILE_SECRET_KEY is not configured; skipping CAPTCHA verification.");
    return true;
  }
  if (!token) {
    return false;
  }
  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) formData.append("remoteip", remoteIp);

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const outcome = await verifyRes.json();
    return !!outcome.success;
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return false;
  }
}

app.post(
  "/api/public/applications",
  applicationLimiter,
  handleCvUpload,
  asyncHandler(async (req, res) => {
    const {
      fullName,
      email,
      phone,
      experience,
      currentPosition,
      education,
      field,
      skills,
      coverLetter,
      jobTitle,
      careerId,
      website, // Honeypot field
      cfTurnstileToken,
    } = req.body || {};

    // 1. Honeypot check: If bot filled the hidden 'website' field, silently succeed without storing
    if (website && String(website).trim() !== "") {
      return res.status(200).json({ success: true, message: "Application submitted successfully" });
    }

    // 2. Turnstile CAPTCHA verification
    const remoteIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const isCaptchaValid = await verifyTurnstileToken(
      cfTurnstileToken || req.body["cf-turnstile-response"],
      remoteIp
    );
    if (!isCaptchaValid) {
      return res.status(400).json({ error: "CAPTCHA verification failed. Please try again." });
    }

    // 3. Required field validation
    if (!fullName || !email || !phone || (!jobTitle && !careerId)) {
      return res.status(400).json({ error: "Full name, email, phone number, and job title are required." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Please upload your CV/Resume (PDF, DOC, or DOCX)." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanJobTitle = String(jobTitle || "").trim();
    const cleanCareerId = String(careerId || "").trim();

    // 4. Duplicate guard: check for same email + position within the last 24 hours
    const existingApps = await db.findAll("applications");
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const isDuplicate = existingApps.some((app) => {
      const matchEmail = String(app.email || "").toLowerCase() === cleanEmail;
      const matchJob =
        (cleanCareerId && app.careerId === cleanCareerId) ||
        (cleanJobTitle && app.jobTitle === cleanJobTitle);
      const appTime = new Date(app.createdAt || 0).getTime();
      return matchEmail && matchJob && appTime > oneDayAgo;
    });

    if (isDuplicate) {
      return res.status(409).json({
        error: "You've already applied for this position recently. We have received your application!",
      });
    }

    // 5. Save CV upload to dedicated applications storage folder
    const ext = ALLOWED_CV_TYPES[req.file.mimetype] || ".pdf";
    const filename = `cv-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const cvUrl = await blobStorage.saveUpload(req.file.buffer, "applications", filename);

    // 6. Insert new application record
    const newApplication = {
      id: "app" + Date.now(),
      fullName: String(fullName).slice(0, 150),
      email: cleanEmail.slice(0, 150),
      phone: String(phone).slice(0, 50),
      experience: String(experience || "").slice(0, 50),
      currentPosition: String(currentPosition || "").slice(0, 150),
      education: String(education || "").slice(0, 100),
      field: String(field || "").slice(0, 150),
      skills: String(skills || "").slice(0, 500),
      coverLetter: String(coverLetter || "").slice(0, 4000),
      jobTitle: cleanJobTitle.slice(0, 150),
      careerId: cleanCareerId.slice(0, 100),
      cvUrl,
      cvOriginalName: String(req.file.originalname || "").slice(0, 200),
      status: "pending", // "pending" | "reviewed" | "shortlisted" | "rejected"
      createdAt: new Date().toISOString(),
    };

    await db.insertOne("applications", newApplication);
    res.status(201).json({
      success: true,
      id: newApplication.id,
      message: "Application submitted successfully",
    });
  })
);

app.get(
  "/api/applications",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const apps = await db.findAll("applications");
    apps.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(apps);
  })
);

app.get(
  "/api/applications/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const appItem = await db.findOne("applications", req.params.id);
    if (!appItem) return res.status(404).json({ error: "Application not found" });
    res.json(appItem);
  })
);

app.put(
  "/api/applications/:id/status",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    const validStatuses = ["pending", "reviewed", "shortlisted", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const updated = await db.updateOne("applications", req.params.id, { status });
    if (!updated) return res.status(404).json({ error: "Application not found" });
    res.json(updated);
  })
);

app.delete(
  "/api/applications/:id",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.findOne("applications", req.params.id);
    if (!existing) return res.status(404).json({ error: "Application not found" });
    if (existing.cvUrl) {
      await blobStorage.deleteUpload(existing.cvUrl);
    }
    await db.deleteOne("applications", req.params.id);
    res.status(204).end();
  })
);

app.post(
  "/api/applications/cleanup",
  requireApiAuth,
  asyncHandler(async (req, res) => {
    const rawDays = req.body && req.body.days !== undefined ? parseInt(req.body.days, 10) : 30;
    const days = isNaN(rawDays) || rawDays < 0 ? 30 : rawDays;
    const cutoff = days === 0 ? Date.now() + 1000 : Date.now() - days * 24 * 60 * 60 * 1000;

    const allApps = await db.findAll("applications");
    const toDelete = allApps.filter(
      (a) => a.status === "rejected" && new Date(a.createdAt || 0).getTime() < cutoff
    );

    let deletedCount = 0;
    for (const item of toDelete) {
      if (item.cvUrl) {
        await blobStorage.deleteUpload(item.cvUrl);
      }
      await db.deleteOne("applications", item.id);
      deletedCount++;
    }

    res.json({ success: true, deletedCount, days });
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max for high-res photos
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
      return res.status(400).json({ error: "Photo is too large. Max size is 10MB." });
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
