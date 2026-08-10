// api/index.js
// Vercel serverless entry point.
//
// On Vercel, any file under /api is deployed as its own serverless
// function. This one file simply re-exports the whole Express app from
// server.js — vercel.json (see the "rewrites" section) sends every
// request for /admin/*, /api/*, and a short list of server-only files
// to this function, so Express handles routing exactly the same way
// it does when you run `npm start` locally. Everything else (plain
// HTML/CSS/JS/image files) is served directly by Vercel's static
// hosting, without going through this function at all.
module.exports = require("../server.js");
