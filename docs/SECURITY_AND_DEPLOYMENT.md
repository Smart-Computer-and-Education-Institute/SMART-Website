# Security fixes + deploying to Vercel (free tier)

This document explains what was wrong, what changed, and exactly how to
get the site live on Vercel's free Hobby plan. Read it once before you
deploy — several steps (creating a database, generating secrets) have
to happen in a specific order.

## 1. What was wrong

### Critical

1. **The admin login didn't actually check anything on the server.**
   `admin/login.js` compared the typed email/password against a
   hardcoded value *in the browser* and, if they matched, just set a
   flag in `localStorage`. Nothing on the server ever verified this.
   Anyone could open the browser console and run
   `localStorage.setItem("smartAdminAuth", "{}")`, or just skip the
   login page entirely — see the next point.

2. **Every admin page and every content-changing API route was
   reachable by anyone, logged in or not.** `admin/dashboard.html`,
   `admin/notices.html`, etc. were served to anyone who typed the URL.
   Worse, `POST/PUT/DELETE /api/notices`, `/api/courses`,
   `/api/gallery`, and `/api/testimonials` had **no authentication at
   all** — anyone could add, edit, or delete site content with a
   single `curl` command, e.g.:
   ```bash
   curl -X DELETE https://your-site.vercel.app/api/notices/n123
   ```

3. **The JSON-file "database" does not work on Vercel.** The original
   code wrote to `data/*.json` and to `img/gallery/` with
   `fs.writeFileSync`. Vercel's serverless functions run on a
   filesystem that is **read-only**, except for a `/tmp` folder that
   is wiped on every cold start and is never shared between the
   multiple copies of your function Vercel may run at once. Deployed
   as-is, every "Save" in the admin panel would either throw an error
   or silently disappear.

### Also fixed

4. **Draft/inactive content was reachable by removing a query
   string.** `GET /api/notices?status=published` was meant for the
   public site, but `GET /api/notices` (no filter) returned *every*
   notice, including drafts, and nothing stopped a visitor from just
   leaving the query string off. Same for courses. This is now two
   separate routes — `/api/public/notices` (published only, no login)
   and `/api/notices` (everything, login required) — so there's no
   query string that unlocks more than it should.

5. **Uploaded file extensions were trusted from attacker input.** The
   old code took the file extension from the uploader's own filename
   (e.g. `evil.php` sent with a faked `Content-Type: image/jpeg` would
   be saved as `photo-....php`). The extension is now chosen by the
   server from a fixed list, based on the verified MIME type, so an
   uploaded file can only ever be saved as `.jpg`, `.png`, `.webp`, or
   `.gif`.

6. **No rate limiting on login.** An attacker could try passwords as
   fast as their network allowed. Login is now limited to 8 attempts
   per IP address per 15 minutes.

7. **No security headers.** Added via `helmet` — clickjacking
   protection (`X-Frame-Options`), MIME-sniffing protection, etc.

8. **`node_modules/` was committed to the git repo**, and there was no
   `.gitignore`. Fixed — see step 4 below for how to remove it from
   your repo's history going forward.

9. **Session cookie hardening.** The new login session is stored in an
   `httpOnly`, `Secure` (in production), `SameSite=Strict` cookie
   instead of `localStorage`. `httpOnly` means page JavaScript can
   never read it — even if the site had an unrelated XSS bug
   elsewhere, the attacker's script still couldn't steal the session.
   `SameSite=Strict` means the cookie is never sent on a request that
   originates from another site, which is the main defense against
   CSRF here (see the note in `lib/auth.js`).

### Left as-is, on purpose

- The public-facing pages already escaped user-supplied text before
  inserting it into the page (`escapeHtml`/`escapeNoticeHtml`/etc. in
  `script.js` and the admin `*.js` files use `textContent`, not raw
  HTML), so there wasn't a stored-XSS issue there — that part of the
  original code was already done correctly.
- The admin panel's buttons use inline `onclick="..."` attributes,
  which is why `helmet`'s Content-Security-Policy is turned off here
  (a strict CSP blocks inline handlers). This is safe as shipped, but
  moving those to `addEventListener()` and turning the CSP back on
  would be a good follow-up — see step 6.

## 2. What changed, file by file

| File | What changed |
|---|---|
| `server.js` | Rewritten: real login route, admin pages and admin API routes now require login, public/admin routes split, rate limiting, security headers, centralized error handling. |
| `lib/auth.js` | New. Password checking (bcrypt) + session cookies (JWT) + the middleware that protects pages/routes. |
| `lib/db.js` | New. Reads/writes notices, courses, gallery, and testimonials — via MongoDB in production, or the same `data/*.json` files as before during local development. |
| `lib/blobStorage.js` | New. Saves uploaded photos — via Vercel Blob in production, or the local `img/` folder as before during local development. |
| `scripts/hash-password.js` | New. `npm run hash-password -- "..."` turns a password into the hash you put in your environment variables. |
| `login.html` / `login-client.js` | The login form now calls the real `/api/login` endpoint. `admin/login.js` (the old fake check) is deleted. |
| `admin/admin.js` | Logout now calls `/api/logout` to clear the server-side session; any `401` response anywhere in the admin panel now redirects to the login page automatically. |
| `script.js` | Public pages now call `/api/public/notices` and `/api/public/courses` instead of the old query-string versions. |
| `api/index.js`, `vercel.json` | New. Deployment configuration — see step 3. |
| `.env.example` | New. Every environment variable the app needs, documented. |
| `.gitignore` | New. |

Nothing about how the site *looks* changed — no CSS was touched, and
every existing page, button, and form works the same way from the
visitor's or admin's point of view. The only visible difference is
that the login now actually works, and pages under `/admin/` will
send you to the login page if you're not signed in.

## 3. Deploying to Vercel (free Hobby plan)

Do these in order — the app needs the database and file storage
connected *before* the first deploy will fully work, though it will
still deploy successfully without them (it just won't be able to
save anything until they're connected).

### Step 1 — Push this code to GitHub

Commit everything in this project to your `DynamicMain` branch (or
open a pull request — whichever you prefer). Two things to do first:

```bash
# Remove node_modules from git tracking (it's now in .gitignore,
# but git won't untrack already-committed files on its own)
git rm -r --cached node_modules
git add .
git commit -m "Fix login, secure the admin panel, prepare for Vercel"
git push
```

### Step 2 — Create a free MongoDB Atlas database

This replaces the JSON files for notices/courses/gallery/testimonials
data (Vercel can't write to local files — see step 1 above).

1. Go to <https://www.mongodb.com/cloud/atlas/register> and sign up.
2. Create a **free M0 cluster** (512MB storage, free forever, no card
   required for the free tier).
3. Under **Database Access**, create a database user with a username
   and password (save the password somewhere safe).
4. Under **Network Access**, add `0.0.0.0/0` (allow access from
   anywhere) — Vercel's functions don't have a fixed IP address, so
   this is the standard setup for serverless.
5. Click **Connect** on your cluster → **Drivers** → copy the
   connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<username>` and `<password>` with the ones from step 3.
   You'll paste this into Vercel as `MONGODB_URI` in step 5.

### Step 3 — Import your project into Vercel

1. Go to <https://vercel.com>, sign up/log in, click **Add New →
   Project**, and import the GitHub repo.
2. Leave the framework preset as-is (Vercel will detect this as a
   plain Node/Express project via `vercel.json`). Don't click Deploy
   yet — set up the environment variables first (next step), or
   deploy now and redeploy after adding them.

### Step 4 — Connect Vercel Blob (for photo uploads)

1. In your Vercel project, go to **Storage → Create Database → Blob**.
2. Create a store and connect it to this project.
3. Vercel automatically adds a `BLOB_READ_WRITE_TOKEN` environment
   variable to your project — you don't need to copy anything
   yourself.

### Step 5 — Set the remaining environment variables

In your Vercel project, go to **Settings → Environment Variables** and
add:

| Name | Value |
|---|---|
| `ADMIN_EMAIL` | The email you'll log in with, e.g. `admin@smartinstitute.com` |
| `ADMIN_PASSWORD_HASH` | Run `npm run hash-password -- "YourNewPassword123!"` locally and paste the printed hash. **Never put a plain password here.** |
| `JWT_SECRET` | A long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `MONGODB_URI` | The connection string from Step 2 |

`BLOB_READ_WRITE_TOKEN` should already be there from Step 4.

### Step 6 — Deploy

Click **Deploy** (or push a new commit — Vercel redeploys
automatically on every push to the connected branch). Once it's live:

1. Visit `https://your-project.vercel.app/login.html` and log in with
   `ADMIN_EMAIL` and the password you hashed in Step 5.
2. Try creating a notice, uploading a gallery photo, etc. — these now
   go to MongoDB and Vercel Blob and will still be there after the
   next deploy (unlike the old file-based version).

### Local development still works with zero setup

Copy `.env.example` to `.env`, fill in `ADMIN_EMAIL`,
`ADMIN_PASSWORD_HASH` (via `npm run hash-password`), and `JWT_SECRET`.
Leave `MONGODB_URI` and `BLOB_READ_WRITE_TOKEN` blank — the app will
automatically use the local `data/*.json` files and the local `img/`
folder instead, exactly like the original version did. Then:

```bash
npm install
npm start
```

## 4. A note on the free tier limits

Vercel's Hobby plan is free but is for **personal, non-commercial
use** — Vercel's terms prohibit using it for a site that generates
revenue (e.g. paid course enrollment). For a school's informational
site with no e-commerce, Hobby is fine. If that changes, Vercel Pro is
$20/month per seat.

MongoDB Atlas's M0 tier (512MB storage) and Vercel Blob's free
allowance (1GB storage / 10GB transfer per month) are both far more
than a small institute site's notices/courses/gallery/testimonials
will need.

## 5. Rotating the admin password later

Run `npm run hash-password -- "NewPassword123!"` again, and update
`ADMIN_PASSWORD_HASH` in Vercel's Environment Variables (and your
local `.env` if you use one). No code changes needed. There's
currently one shared admin account, matching how the original site
was designed — if you'll have multiple admins with separate logins in
the future, that's a bigger change (a real users collection in
MongoDB instead of two environment variables) and worth a separate
conversation.

## 6. Good next steps (not required, but worth doing eventually)

- Move the admin panel's `onclick="..."` attributes to
  `addEventListener()` calls, then turn `helmet`'s Content-Security-
  Policy back on in `server.js` (`contentSecurityPolicy: false` →
  remove that line) for stronger protection against injected scripts.
- Add a "confirm password" + minimum-length check to
  `scripts/hash-password.js` if you want to enforce a stronger
  password policy.
- Consider real magic-byte file validation (e.g. the `file-type`
  npm package) on uploads, in addition to the MIME-type check already
  in place, for defense in depth.
