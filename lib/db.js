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
    const data = JSON.parse(fs.readFileSync(localFile(name), "utf-8"));
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") return [data];
    return [];
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
    return readLocal(collectionName).find((x) => String(x.id) === String(id)) || null;
  }
  const col = await getCollection(collectionName);
  const numId = Number(id);
  const query = !isNaN(numId) && String(numId) === String(id)
    ? { $or: [{ id: id }, { id: numId }] }
    : { id };
  return col.findOne(query, { projection: { _id: 0 } });
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
    const item = items.find((x) => String(x.id) === String(id));
    if (!item) return null;
    Object.assign(item, changes);
    writeLocal(collectionName, items);
    return item;
  }
  const col = await getCollection(collectionName);
  const numId = Number(id);
  const query = !isNaN(numId) && String(numId) === String(id)
    ? { $or: [{ id: id }, { id: numId }] }
    : { id };
  const existing = await col.findOne(query);
  if (!existing) return null;
  await col.updateOne({ _id: existing._id }, { $set: changes });
  return { ...existing, ...changes, _id: undefined };
}

async function deleteOne(collectionName, id) {
  if (!MONGODB_URI) {
    const items = readLocal(collectionName);
    const exists = items.some((x) => String(x.id) === String(id));
    if (!exists) return false;
    writeLocal(
      collectionName,
      items.filter((x) => String(x.id) !== String(id))
    );
    return true;
  }
  const col = await getCollection(collectionName);
  const numId = Number(id);
  const query = !isNaN(numId) && String(numId) === String(id)
    ? { $or: [{ id: id }, { id: numId }] }
    : { id };
  const result = await col.deleteOne(query);
  return result.deletedCount > 0;
}

module.exports = { findAll, findOne, insertOne, updateOne, deleteOne };
