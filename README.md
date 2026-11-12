# Community Therapists Directory & Content Platform

A Hebrew (RTL) directory where therapists sign up and publish a profile, and visitors can search for a therapist.

**Stack:** MongoDB (Mongoose) · Express (TypeScript) · React + Vite + Tailwind (planned) · Node.js

The full roadmap is in [`CLAUDE_BUILD_PLAN.md`](./CLAUDE_BUILD_PLAN.md). The project is built step by step: **POC → MVP → V1**.

## Progress

| Step | Status |
|---|---|
| 1.1 Backend setup & auth | Done |
| 1.2 Therapist & public endpoints | Done |
| 1.3 Frontend (React) | Done |
| Phase 2 foundation (logging, security, admin seed) | Done |
| 2.1 File uploads (avatar, certificates) | Done |
| 2.2 Approval workflow, 2.3 Admin panel, 2.4 Advanced filters | Not started |
| Phase 3 (V1) | Not started |

## Quick start (run everything)

Run the server and the client in two terminals:

```bash
# Terminal 1 - API on http://localhost:5000
cd server && npm install && npm run dev

# Terminal 2 - website on http://localhost:5173
cd client && npm install && npm run dev
```

Open http://localhost:5173. The client dev server proxies `/api` to the Express server, so no CORS setup is needed.
Set up `server/.env` and seed the categories first (see below).

## Frontend (client)

React + Vite + TypeScript + Tailwind CSS v4, Hebrew **RTL** (`<html lang="he" dir="rtl">`, logical Tailwind classes such as `ms-`/`me-`/`text-start`).

| Route | Access | Page |
|---|---|---|
| `/` | Public | Search (text box + category chips + pagination) and therapist cards |
| `/therapist/:slug` | Public | Full profile with call / WhatsApp / email buttons |
| `/login`, `/register` | Public | Auth forms |
| `/dashboard` | Logged-in therapist | Edit own profile (text fields + categories) |

Mobile-first responsive design:
- Layouts stack on phones (directory grid 1 → 2 → 3 columns, profile header, dashboard forms) and use `sm:`/`md:` breakpoints for spacing and font sizes.
- Touch targets are at least 44px (buttons, inputs, nav links); category chips are a horizontally scrollable row on phones and wrap on larger screens.
- Contact buttons (call / WhatsApp / email) are full width on phones. Inputs use 16px text so iOS doesn't zoom on focus.
- Shared styles live in `client/src/components/ui.ts`.

Notes:
- The login token is kept in `localStorage` and sent by an Axios interceptor. If the server answers `401` (expired token) the user is logged out automatically.
- `ProtectedRoute` is only a UX guard. Real access control is enforced by the server (JWT + role middleware).

| Command (in `client/`) | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run typecheck` | Type-check only |

## Getting started (server)

Requirements: Node.js 20+ and a MongoDB database (local or MongoDB Atlas).

```bash
cd server
npm install
cp .env.example .env      # then edit the values (see below)
npm run seed              # seeds the initial categories (safe to re-run)
npm run dev               # http://localhost:5000
```

### Environment variables (`server/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `5000` |
| `MONGODB_URI` | MongoDB connection string | - (required) |
| `JWT_SECRET` | Secret for signing tokens, at least 16 characters | - (required) |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CLIENT_ORIGIN` | Allowed CORS origin (the React app) | `http://localhost:5173` |
| `UPLOADS_DIR` | Folder for uploaded files, relative to `server/` (see "Uploads & storage") | `uploads` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Only read by `npm run seed:admin` (see "Admin account") | - |
| `NODE_ENV` | `development`, `production` or `test` (production = JSON logs, strict rate limit) | `development` |
| `LOG_LEVEL` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` | `debug` in dev, `info` in production |

> **Windows + Atlas note:** if you see `querySrv ECONNREFUSED`, Node's DNS was pointed at `127.0.0.1`.
> `src/config/db.ts` already works around this by switching to public DNS for `mongodb+srv://` URIs.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the server with auto-reload |
| `npm run seed` | Seed categories |
| `npm run seed:admin` | Create or update the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (see "Admin account") |
| `npm run seed:therapists` | Import the sample therapists from the `.docx` directory file (see "Sample data") |
| `npm run typecheck` | Type-check without building |
| `npm run build` / `npm start` | Compile to `dist/` and run it |

## Logging & security

- **Logging** uses `pino` + `pino-http`: every request is logged once with a request ID (also returned in the `X-Request-Id` header), method, path, status and duration, plus the user id for authenticated requests. Levels: `info` for 2xx/3xx, `warn` for 4xx, `error` for 5xx (with stack trace). `/api/health` is not logged. Development output is colored; production output is one JSON object per line. Passwords, tokens and the `Authorization` header are never logged.
- **Auth checks the database on every protected request.** Role and status come from the user's record, not from the token, so suspending a user or changing a role takes effect immediately. A suspended user gets `403 Account suspended` and the client logs them out.
- **`helmet`** sets the standard security headers.
- **Rate limiting:** 600 requests per 15 minutes per IP for the whole API, and a stricter limit on login/register that counts only failed attempts (20 per 15 minutes in production, 200 in development). Over the limit the API answers `429`, and even correct logins are refused until the window resets.

## Admin account

There is no sign-up for admins. Create the first one from the command line:

```bash
# 1. In server/.env set (password: at least 12 characters):
#      ADMIN_EMAIL=you@yourdomain.com
#      ADMIN_PASSWORD=a-long-unique-passphrase
# 2. Then, from server/:
npm run seed:admin
```

- **Safe to re-run:** it creates the admin, or updates role/status/password only if they differ ("already up to date" otherwise).
- **Guards:** refuses weak or placeholder values, and refuses to silently turn an existing *therapist* account into the admin unless you add `-- --promote`.
- The password is only stored hashed (bcrypt) and never printed. **Delete `ADMIN_PASSWORD` from `.env` afterwards.**
- Sign in at `/login`. The server enforces the role on every request (from the database, not the token); the admin screens themselves arrive with Step 2.3.

## Uploads & storage

- **Avatar:** JPG/PNG/WEBP up to 5MB. The server checks the file's real bytes (not its name or Content-Type), rotates it per its EXIF orientation, crops it to a 512x512 square and saves it as WebP. All metadata (such as GPS location) is dropped. Each upload gets a new random file name, and the previous picture is deleted.
- **Certificates:** optional PDF/JPG/PNG/WEBP up to 5MB each (max 10 per therapist). They are stored in a **private** folder that is never served; the owner sees only title, name and verification status. Admin access arrives with Step 2.3.
- **Where files live:** `server/uploads/public` (avatars, served at `/uploads`) and `server/uploads/private` (certificates). The whole folder is git-ignored. Back it up like the database.
- **Storage is behind an interface** (`server/src/storage/`). Today it is local disk. Moving to a cloud provider such as Cloudinary or S3 means adding one `StorageProvider` class, with no change to routes or controllers. Note that many hosting platforms wipe local disk on every deploy, so use a cloud provider or a persistent volume in production.
- Uploads are rate limited (60 per hour per IP) and only reachable after authentication, so anonymous requests are rejected before any file is read.

## Sample data (seed therapists)

To see realistic data in the UI, import the therapists from the sample directory document (a `.docx` with one table per region, placed in the project root):

```bash
cd server
npm run seed:therapists -- --dry-run   # parse only: prints statistics, writes nothing
npm run seed:therapists                # import (creates categories too if missing)
npm run seed:therapists -- --reset     # remove previously seeded therapists, then import again
npm run seed:therapists -- --file "path/to/other.docx"
```

How it works:
- The script reads the `.docx` directly (the only `.docx` in the project root is used, or pass `--file` / set `SEED_DOCX_PATH`).
- **Mapping:** region comes from the table heading; city from the first place listed; "זום" marks online therapy; specialties and target audience are matched to categories and audiences by keywords; gender is inferred from the Hebrew job title when it is unambiguous (otherwise left empty). The bio holds the document's own text (specialties, target audience, places); the job title is not repeated there unless it was too long for the title field. Result cards show the first paragraph of the bio, cut at a word boundary.
- **Cleaning:** blank rows and clinic/centre rows (e.g. "מרכז אור הבית") are skipped, `last, first` names are flipped, and a therapist listed under several regions becomes one profile (first region wins, extra places are added to the bio).
- **Idempotent:** running it again updates the same profiles instead of duplicating them (stable slugs, one placeholder account per therapist).
- **Placeholder accounts** use `seed-<hash>@seed.invalid` with a random password nobody knows, so seeded therapists appear in the directory but cannot be logged into. `--reset` removes exactly these accounts.
- The `.docx` contains real contact details, so `*.docx` is git-ignored. Do not commit or publish it.

## API

Base URL: `http://localhost:5000`. Protected routes need `Authorization: Bearer <token>`.

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Create a therapist account + empty profile. Returns `{ token, user }` |
| POST | `/api/auth/login` | Public | Returns `{ token, user }` |
| GET | `/api/categories` | Public | Active categories (`id`, `name`, `slug`) |
| GET | `/api/therapists` | Public | Search visible therapists. Query: `q`, `category` (slug), `page`, `limit` (max 50) |
| GET | `/api/therapists/:slug` | Public | Full public profile |
| GET | `/api/therapists/me` | Therapist | Own profile (to prefill the dashboard form) |
| PUT | `/api/therapists/me` | Therapist | Partial update of own profile |
| POST | `/api/therapists/me/avatar` | Therapist | Upload or replace the profile picture (multipart, field `avatar`) |
| DELETE | `/api/therapists/me/avatar` | Therapist | Remove the profile picture |
| POST | `/api/therapists/me/certificates` | Therapist | Upload a certificate (multipart: `title` + file `certificate`), max 10, private |
| DELETE | `/api/therapists/me/certificates/:certId` | Therapist | Delete one of your certificates |
| GET | `/uploads/avatars/<file>` | Public | Serves avatars (static, cacheable) |

Details:

- **Search:** `q` matches name, professional title, bio and city (case-insensitive). Results only include profiles that are publicly visible and have a name. Response: `{ items, total, page, limit, totalPages }`.
- **`PUT /api/therapists/me` fields (all optional):** `fullName`, `professionalTitle`, `bio`, `city`, `phone`, `whatsapp`, `contactEmail`, `categories` (array of category **slugs**).
- **Privacy:** public responses never include the account `userId` or certificate files.
- **POC behaviour:** new accounts are `ACTIVE` and public right away. This changes to an admin approval flow in Phase 2 (Step 2.2).

## Testing the API without Postman

1. Install the **REST Client** extension in VS Code (`humao.rest-client`).
2. Open [`server/requests.http`](./server/requests.http).
3. Click **Send Request** above any request. Run **Register** and **Login** first; the login token is reused automatically by the protected requests.

## Project structure

```text
client/
  src/
    api/                # axios instance (JWT interceptor), API service functions, error messages
    components/         # Navbar, Layout, TherapistCard, ProtectedRoute, form + feedback helpers
    context/            # AuthContext (user, login, register, logout)
    pages/              # Home, TherapistProfilePage, Login, Register, Dashboard
    types/              # TypeScript interfaces mirroring the server DTOs
    utils/              # contact links (tel / WhatsApp), region labels
    App.tsx             # routes
    main.tsx
server/
  requests.http         # REST Client requests
  src/
    config/             # env validation, DB connection
    models/             # User, TherapistProfile, Category
    middlewares/        # requireAuth, requireRole, errorHandler
    controllers/        # auth, therapist, category
    routes/             # /api/auth, /api/therapists, /api/categories
    utils/              # response DTO mappers
    storage/            # StorageProvider interface + local-disk implementation
    services/           # image processing (sharp)
    scripts/            # seedCategories, seedAdmin, seedTherapists (+ lib/: docx reader, row mapper)
    server.ts           # entry point
```
