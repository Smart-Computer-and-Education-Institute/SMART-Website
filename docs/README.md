# SMART Computer & Education Institute - Local Setup

A local Node/Express application using JSON-file storage and local disk media storage.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```
   Generate a password hash using:
   ```bash
   npm run hash-password -- "YourStrongPassword"
   ```
   Set `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `JWT_SECRET` in `.env`.

3. **Start the local server**
   ```bash
   npm run dev
   ```
   The site will be available at [http://localhost:3000](http://localhost:3000).

## Data and Uploads

- All site content (notices, courses/services, offers, careers, testimonials, inquiries, settings, etc.) is stored in JSON files under `/data`.
- Public image uploads are stored in `/public/img/`.
- Private applicant CVs are stored in `/data/uploads/applications/`.

## Backup

To back up the site completely:
- Copy the `/data` folder (contains all content, settings, and CV uploads).
- Copy the `/public/img` folder (contains all uploaded images).
