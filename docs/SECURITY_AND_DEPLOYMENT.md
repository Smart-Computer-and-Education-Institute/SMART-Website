# Local Security Guide

This application is configured as a fully local Node/Express application. This document outlines the security architecture and protections in place.

## Security Features

1. **Server-Side Authentication**
   - Admin credentials (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`) are configured in `.env`.
   - Passwords are verified server-side using `bcrypt`.
   - Admin password updates made via the settings interface are persisted to `data/adminAuth.json`.

2. **Session Security**
   - Sessions use JSON Web Tokens (JWT) stored in `httpOnly`, `SameSite=Strict` cookies.
   - JavaScript running in the browser cannot read the session cookie, mitigating credential theft via client-side scripting.

3. **Route Protection**
   - All admin pages under `/admin` require authentication (`requireAuthPage`).
   - All management/mutation API routes under `/api` require authentication (`requireApiAuth`).
   - Public-facing read routes (e.g. `/api/public/notices`) are explicitly separated from admin management routes.

4. **File Upload Security**
   - Public image uploads are checked for valid MIME types and saved with fixed, safe extensions (`.jpg`, `.png`, `.webp`, `.gif`) under `public/img/<folder>/`.
   - Job application CVs are stored privately in `data/uploads/applications/` and are never exposed publicly through static asset folders.
   - CVs are retrieved only by authenticated administrators via `/api/applications/cv/:filename` with strict regex filename validation and path traversal protections.

5. **Rate Limiting & Headers**
   - Rate limiting via `express-rate-limit` prevents brute-force login attempts.
   - `helmet` supplies security response headers (e.g., MIME sniffing protection, X-Frame-Options).
