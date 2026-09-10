---
name: deploy-smart-website
description: >
  Step-by-step runbook for publishing the SMART Computer & Education Institute
  website to Vercel (free Hobby plan) and connecting it to a free MongoDB Atlas
  M0 cluster (free forever). Also covers Vercel Blob for photo uploads and
  rotating the admin password. Trigger when the user says: deploy, go live,
  publish, set up MongoDB, connect database, or similar.
---

# Deploy SMART-Website to Vercel + MongoDB Atlas

## Stack Overview

| Layer | Service | Free tier |
|---|---|---|
| Hosting | Vercel Hobby | Free (personal/non-commercial) |
| Database | MongoDB Atlas M0 | 512 MB, free forever |
| File uploads | Vercel Blob | 1 GB storage / 10 GB transfer/month |
| Server | Express (via `api/index.js` → `server.js`) | — |

The app already contains all required files:
- `api/index.js` — Vercel serverless entry point
- `vercel.json` — rewrites all dynamic routes to the Express app
- `lib/db.js` — auto-switches between MongoDB (production) and local JSON files (dev)
- `lib/blobStorage.js` — auto-switches between Vercel Blob (production) and local `img/` (dev)

---

## Pre-flight Checklist

Before deploying, confirm:
- [ ] `node_modules/` is **not** committed (it is listed in `.gitignore`)
- [ ] `.env` is **not** committed (it is listed in `.gitignore`)
- [ ] Code is pushed to GitHub (the branch Vercel will watch)

To untrack `node_modules` if it was previously committed:
```bash
git rm -r --cached node_modules
git add .
git commit -m "Remove node_modules from tracking"
git push
```

---

## Step 1 — Push Code to GitHub

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

The target branch is whatever branch you connect to Vercel (e.g. `main` or `DynamicMain`).

---

## Step 2 — Create Free MongoDB Atlas Cluster

1. Sign up at **https://www.mongodb.com/cloud/atlas/register**
2. Create a new project, then click **Build a Database → M0 Free** (no credit card needed)
3. Choose any cloud region close to your users (e.g. AWS ap-south-1 for South Asia)
4. Under **Database Access** → **Add New Database User**:
   - Username: e.g. `smart-app`
   - Password: generate a strong one, **save it**
   - Role: `Read and Write to any database`
5. Under **Network Access** → **Add IP Address** → enter `0.0.0.0/0`
   - ⚠️ This allows connections from any IP — required because Vercel serverless functions have no fixed IP
6. Click **Connect** on your cluster → **Drivers** → copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Replace `<username>` and `<password>` with your values from step 4.
   Save this full string — it becomes `MONGODB_URI` in Vercel.

> **Tip**: The app will create the `smart_website` database and all collections automatically on first write. No schema setup needed.

---

## Step 3 — Import Project into Vercel

1. Go to **https://vercel.com** → sign up/log in with GitHub
2. Click **Add New → Project** → import your GitHub repo
3. Vercel auto-detects this as a Node.js project via `vercel.json`
4. **Do NOT deploy yet** — set environment variables first (Step 5), or deploy and redeploy after

---

## Step 4 — Connect Vercel Blob (Photo Uploads)

1. In your Vercel project dashboard, go to **Storage → Create Database → Blob**
2. Name the store (e.g. `smart-website-blob`) and connect it to this project
3. Vercel automatically injects `BLOB_READ_WRITE_TOKEN` into your environment — nothing to copy

---

## Step 5 — Set Environment Variables in Vercel

Go to **Vercel → Your Project → Settings → Environment Variables** and add:

| Variable | Value | How to generate |
|---|---|---|
| `ADMIN_EMAIL` | e.g. `admin@smartinstitute.com` | Just type it |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of your password | Run locally: `npm run hash-password -- "YourPassword123!"` |
| `JWT_SECRET` | Long random string | Run locally: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `MONGODB_URI` | Full Atlas connection string | From Step 2 |

`BLOB_READ_WRITE_TOKEN` is already set from Step 4.

> **Security**: Never put a plain-text password in environment variables. Always use the hashed value from `npm run hash-password`.

---

## Step 6 — Deploy

Click **Deploy** in Vercel, or push a new commit — Vercel redeploys automatically on every push.

**Verify the deployment:**
1. Visit `https://your-project.vercel.app/` — the home page should load
2. Visit `https://your-project.vercel.app/login.html` — log in with your admin email + password
3. Create a test notice and upload a gallery photo — confirm they persist after a page refresh

---

## Rotating the Admin Password

```bash
# Run locally
npm run hash-password -- "NewSecurePassword456!"
# Copy the printed hash → paste into Vercel Environment Variables → ADMIN_PASSWORD_HASH
# Redeploy (or Vercel will pick it up on the next deploy)
```

---

## Local Development (No Cloud Services Needed)

Copy `.env.example` → `.env`, fill in the three required variables, leave `MONGODB_URI` and `BLOB_READ_WRITE_TOKEN` blank:

```bash
cp .env.example .env
# Edit .env: set ADMIN_EMAIL, ADMIN_PASSWORD_HASH (hash first), JWT_SECRET
npm install
npm start
# Visit http://localhost:3000
```

The app automatically falls back to `data/*.json` files and the local `img/` folder.

---

## Free Tier Limits Summary

| Service | Limit | Notes |
|---|---|---|
| Vercel Hobby | Unlimited deploys, personal/non-commercial | No e-commerce |
| MongoDB Atlas M0 | 512 MB storage | More than enough for notices/courses/gallery |
| Vercel Blob | 1 GB storage, 10 GB/month transfer | Resets monthly |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login returns 401 immediately | `ADMIN_PASSWORD_HASH` not set or wrong format | Regenerate with `npm run hash-password` |
| Notices/courses not saving | `MONGODB_URI` missing or wrong password | Check Atlas connection string & Network Access |
| Photo upload fails | `BLOB_READ_WRITE_TOKEN` not injected | Reconnect Blob store in Vercel Storage tab |
| Admin pages redirect to login | Expected! Auth is working — log in at `/login.html` | — |
| 500 error on any API route | Missing env var | Check all 4 vars are set in Vercel Settings |
