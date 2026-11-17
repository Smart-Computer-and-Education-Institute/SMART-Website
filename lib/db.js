// lib/db.js
// Local JSON storage. Each collection is one file: data/<name>.json
// (an array of objects). Same exports as before, so server.js and
// lib/auth.js work unchanged.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function localFile(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

// Missing or empty file -> []. A file that exists but has broken JSON
// throws, so a typo can never be silently overwritten by the next save.
function readLocal(name) {
  const file = localFile(name);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
  if (!raw.trim()) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `data/${name}.json contains invalid JSON (${err.message}). ` +
      "Fix the file by hand. Nothing was overwritten."
    );
  }
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return [data];
  return [];
}

// Write to a temp file first, then swap it in, so a crash mid-write
// can't leave a half-written JSON file.
function writeLocal(name, items) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = localFile(name);
  const tmp = `${file}.${process.pid}.tmp`;
  const json = JSON.stringify(items, null, 2);
  fs.writeFileSync(tmp, json, "utf-8");
  try {
    fs.renameSync(tmp, file);
  } catch {
    // Windows can refuse to replace a file that antivirus/editor has open.
    fs.writeFileSync(file, json, "utf-8");
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

// Runs read-modify-write jobs for the same collection one at a time,
// so two quick requests can't overwrite each other's changes.
const queues = new Map();
function withLock(name, job) {
  const prev = queues.get(name) || Promise.resolve();
  const run = prev.then(job);
  queues.set(name, run.catch(() => { }));
  return run;
}

const sameId = (a, b) => String(a) === String(b);

// Newest first (ids are built from Date.now()).
async function findAll(collectionName) {
  return readLocal(collectionName)
    .slice()
    .sort((a, b) => (String(a.id) < String(b.id) ? 1 : -1));
}

async function findOne(collectionName, id) {
  return readLocal(collectionName).find((x) => sameId(x.id, id)) || null;
}

async function insertOne(collectionName, item) {
  return withLock(collectionName, () => {
    const items = readLocal(collectionName);
    items.unshift(item);
    writeLocal(collectionName, items);
    return item;
  });
}

// Applies `changes` on top of the item; returns it, or null if not found.
async function updateOne(collectionName, id, changes) {
  return withLock(collectionName, () => {
    const items = readLocal(collectionName);
    const item = items.find((x) => sameId(x.id, id));
    if (!item) return null;
    Object.assign(item, changes);
    writeLocal(collectionName, items);
    return item;
  });
}

async function deleteOne(collectionName, id) {
  return withLock(collectionName, () => {
    const items = readLocal(collectionName);
    if (!items.some((x) => sameId(x.id, id))) return false;
    writeLocal(
      collectionName,
      items.filter((x) => !sameId(x.id, id))
    );
    return true;
  });
}

module.exports = { findAll, findOne, insertOne, updateOne, deleteOne };