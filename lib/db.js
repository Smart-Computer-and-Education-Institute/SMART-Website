/* ============================================================
   lib/db.js — the site's "database", with two interchangeable modes
   ============================================================
   WHY THIS FILE EXISTS:
   The original code read and wrote data/*.json files directly with
   fs.readFileSync / fs.writeFileSync. That works fine on a normal
   server, but Vercel's serverless functions run on a filesystem that
   is READ-ONLY (except a temporary /tmp folder that is wiped and is
   NOT shared between requests or between the multiple copies of your
   function Vercel may run at once). In practice that means: on
   Vercel, every "Save" in the admin panel would either throw an error
   or silently vanish the moment the request finished. The admin panel
   would look like it works and then lose data constantly.

   The fix is to store data somewhere that persists: a real database.
   This file uses MongoDB Atlas (a free-forever hosted database) when
   a MONGODB_URI environment variable is set. If it ISN'T set — e.g.
   while you're developing on your own laptop and haven't set up Atlas
   yet — it transparently falls back to reading/writing the same
   data/*.json files as before, so `npm start` still works with zero
   cloud setup.

   Every route in server.js calls the five functions at the bottom
   (findAll, findOne, insertOne, updateOne, deleteOne) and never needs
   to know or care which mode is active.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const MONGODB_URI = process.env.MONGODB_URI;
const DATA_DIR = path.join(__dirname, "..", "data");

// ---------- MongoDB mode ----------

let clientPromise = null;
if (MONGODB_URI) {
  const { MongoClient } = require("mongodb");
  // Serverless functions can be reused ("kept warm") between requests.
  // Caching the connection on `global` means a warm function reuses its
  // existing MongoDB connection instead of opening a new one on every
  // request, which is important — databases have a limit on how many
  // connections they'll accept at once.
  if (!global._smartMongoClientPromise) {
    global._smartMongoClientPromise = new MongoClient(MONGODB_URI).connect();
  }
  clientPromise = global._smartMongoClientPromise;
}

async function getCollection(name) {
  const client = await clientPromise;
  return client.db().collection(name);
}

// ---------- Local JSON file mode (development fallback) ----------

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
  fs.writeFileSync(localFile(name), JSON.stringify(items, null, 2));
}

// ---------- Shared public API used by server.js ----------

// Returns every item in a collection, newest first (our ids are built
// from Date.now(), so a descending sort on `id` is newest-first).
async function findAll(collectionName) {
  if (!MONGODB_URI) {
    return readLocal(collectionName)
      .slice()
      .sort((a, b) => (a.id < b.id ? 1 : -1));
  }
  const col = await getCollection(collectionName);
  return col
    .find({}, { projection: { _id: 0 } })
    .sort({ id: -1 })
    .toArray();
}

async function findOne(collectionName, id) {
  if (!MONGODB_URI) {
    return readLocal(collectionName).find((x) => x.id === id) || null;
  }
  const col = await getCollection(collectionName);
  return col.findOne({ id }, { projection: { _id: 0 } });
}

async function insertOne(collectionName, item) {
  if (!MONGODB_URI) {
    const items = readLocal(collectionName);
    items.unshift(item);
    writeLocal(collectionName, items);
    return item;
  }
  const col = await getCollection(collectionName);
  await col.insertOne({ ...item });
  return item;
}

// Applies `changes` on top of the existing item and returns the updated
// item, or null if no item with that id exists.
async function updateOne(collectionName, id, changes) {
  if (!MONGODB_URI) {
    const items = readLocal(collectionName);
    const item = items.find((x) => x.id === id);
    if (!item) return null;
    Object.assign(item, changes);
    writeLocal(collectionName, items);
    return item;
  }
  const col = await getCollection(collectionName);
  const existing = await col.findOne({ id });
  if (!existing) return null;
  await col.updateOne({ id }, { $set: changes });
  return { ...existing, ...changes, _id: undefined };
}

async function deleteOne(collectionName, id) {
  if (!MONGODB_URI) {
    const items = readLocal(collectionName);
    const exists = items.some((x) => x.id === id);
    if (!exists) return false;
    writeLocal(
      collectionName,
      items.filter((x) => x.id !== id)
    );
    return true;
  }
  const col = await getCollection(collectionName);
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

module.exports = { findAll, findOne, insertOne, updateOne, deleteOne };
