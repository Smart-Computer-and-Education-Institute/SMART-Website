/* ============================================================
   lib/db.js — local JSON file data store (no external database)
   ============================================================
   Reads and writes data/*.json files on the local filesystem.
   The public API (findAll, findOne, insertOne, updateOne, deleteOne)
   is identical to the previous version so server.js needs no changes.
   ============================================================ */

const fs   = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function localFile(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readLocal(name) {
  try {
    return JSON.parse(fs.readFileSync(localFile(name), "utf-8"));
  } catch {
    return [];
  }
}

function writeLocal(name, items) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(localFile(name), JSON.stringify(items, null, 2));
}

/** Return every item in a collection, newest first (id is Date.now()-based). */
async function findAll(collectionName) {
  return readLocal(collectionName)
    .slice()
    .sort((a, b) => (String(a.id) < String(b.id) ? 1 : -1));
}

/** Return a single item by id, or null if not found. */
async function findOne(collectionName, id) {
  return readLocal(collectionName).find((x) => String(x.id) === String(id)) || null;
}

/** Insert a new item at the front of the collection. */
async function insertOne(collectionName, item) {
  const items = readLocal(collectionName);
  items.unshift(item);
  writeLocal(collectionName, items);
  return item;
}

/** Apply `changes` on top of an existing item and return the updated object. */
async function updateOne(collectionName, id, changes) {
  const items = readLocal(collectionName);
  const item  = items.find((x) => String(x.id) === String(id));
  if (!item) return null;
  Object.assign(item, changes);
  writeLocal(collectionName, items);
  return item;
}

/** Remove an item by id, returning true if something was deleted. */
async function deleteOne(collectionName, id) {
  const items    = readLocal(collectionName);
  const filtered = items.filter((x) => String(x.id) !== String(id));
  if (filtered.length === items.length) return false;
  writeLocal(collectionName, filtered);
  return true;
}

module.exports = { findAll, findOne, insertOne, updateOne, deleteOne };
