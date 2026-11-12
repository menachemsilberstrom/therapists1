# Community Therapists Directory & Content Platform

![CI](https://github.com/menachemsilberstrom/therapists1/actions/workflows/ci.yml/badge.svg)

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
| 2.2 Approval workflow (new therapists start as pending and hidden) | Done |
| 2.3 Admin panel (approve / suspend, certificates, categories, all therapists, guarded delete) | Done |
| 2.4 Advanced public filters (sidebar + URL-shareable search) | Done |
| **Phase 2 (MVP)** | **Complete** |
| Automated test suites (server + client) | Done |
| Production setup (Docker image, CI pipeline, deployment guide) | Done |
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
| `/` | Public | Search: keyword box + advanced filter sidebar (see "Search filters") + therapist cards + pagination |
| `/therapist/:slug` | Public | Full profile with call / WhatsApp / email buttons |
| `/login`, `/register` | Public | Auth forms |
| `/dashboard` | Logged-in therapist | Edit own profile (text fields + categories) |

Mobile-first responsive design:
- Layouts stack on phones (directory grid 1 → 2 → 3 columns, profile header, dashboard forms) and use `sm:`/`md:` breakpoints for spacing and font sizes.
- Touch targets are at least 44px (buttons, inputs, nav links); category chips are a horizontally scrollable row on phones and wrap on larger screens.
- Contact buttons (call / WhatsApp / email) are full width on phones. Inputs use 16px text so iOS doesn't zoom on focus.
- Shared styles live in `client/src/components/ui.ts`.

Notes:
- **API address:** in development the Vite dev server proxies `/api` and `/uploads` to the local server. In production set `VITE_API_URL` (see "Deployment") so the site calls the API on its own address; profile pictures use the same address.
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
| `MONGODB_URI` | MongoDB connection string. **Put a database name in it** (e.g. `.../therapists_directory?...`) so this app does not share a database with anything else | - (required) |
| `JWT_SECRET` | Secret for signing tokens, at least 16 characters | - (required) |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CLIENT_ORIGIN` | Website address(es) allowed to call the API (CORS), comma separated | `http://localhost:5173` |
| `TRUST_PROXY` | Number of reverse proxies in front of the server (0 locally, 1 on Render) | `0` |
| `BCRYPT_ROUNDS` | Password hashing cost (the tests use the minimum, 4) | `12` |
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
| `npm run db:check` | Read-only health check of the configured database (see "First-time database setup") |
| `npm run seed:therapists` | Import the sample therapists from the `.docx` directory file (see "Sample data") |
| `npm run typecheck` | Type-check without building |
| `npm run build` / `npm start` | Compile to `dist/` and run it |

## First-time database setup

Use a database that belongs to this app alone. A connection string **without** a database name makes MongoDB use the default database `test`, which other applications often share.

1. **Put the database name in `server/.env`**, between the host and the options:
   ```
   MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/therapists_directory?appName=Cluster0
   ```
   The server logs `MongoDB connected {"database":"therapists_directory"}` on start, and warns if it ends up on `test`.
2. **Check the (empty) database:** `npm run db:check`. It is read-only. It should print `Database: "therapists_directory"` and `[ok] only this app's collections are present`.
3. **Seed it** (from `server/`):
   ```bash
   npm run seed                  # the 12 categories
   npm run seed:therapists       # sample therapists from the .docx (needs the file, see "Sample data")
   npm run seed:admin            # the admin account (needs ADMIN_EMAIL + ADMIN_PASSWORD in .env, see "Admin account")
   ```
4. **Verify:** `npm run db:check` again. A healthy database shows 12 categories, the seeded therapists with a profile each, 1 admin, and `[ok]` on every line, including the four unique indexes.

Notes:
- Every seed is safe to re-run; `seed:therapists -- --reset` removes only the seeded sample accounts first.
- Indexes are created automatically whenever the server or a seed connects (missing ones only; nothing is ever dropped).
- Switching `MONGODB_URI` to a new database does **not** move anything: accounts, profiles and sessions of the old database stay there. Files in `server/uploads/` belong to the old data, so start with an empty `uploads/` folder for a new database.
- `db:check` flags anything that is not this app's own data (extra collections, users without a role, categories without a slug), which is how a shared database shows up.

## Search filters

The public search (`GET /api/therapists`, and the sidebar on the home page) combines these filters:

| Filter | Parameter | Values | Matching |
|---|---|---|---|
| Keyword | `q` | text | name, professional title, bio or city contains the text |
| Categories | `category` | one or more category slugs | **any of** the selected (OR) |
| Gender | `gender` | `MALE`, `FEMALE` | exact |
| Region | `region` | `NORTH`, `CENTER`, `JERUSALEM`, `SOUTH`, `ONLINE_ONLY` | exact |
| City | `city` | text | city name contains the text (case-insensitive) |
| Target audience | `audience` | `CHILDREN`, `TEENS`, `ADULTS`, `COUPLES`, `PARENTS` | **any of** the selected (OR) |
| Online | `online` | `true` / `1` | only therapists who also treat online; `false`/`0` means no filter |

- **Different filters narrow each other (AND); several values of the same filter widen it (OR).** Example: `?category=anxiety,trauma&gender=FEMALE&region=NORTH` = women in the north who work with anxiety **or** trauma.
- Multiple values can be sent as `a,b` or repeated (`audience=TEENS&audience=COUPLES`). Empty parameters mean "no filter". Unknown enum values are rejected with `400`.
- **The URL is the source of truth on the website:** every filter lives in the address bar (`/?region=NORTH&gender=FEMALE&audience=ADULTS&online=1`), so a search can be bookmarked and shared, the Back button works, and unknown or tampered values are ignored. Changing a filter returns to page 1.
- **UI:** on desktop the filters are a permanent sidebar; on phones they collapse behind a "סינון מתקדם" button (with a badge showing how many options are selected). Active filters appear as removable tags above the results, and the city box suggests cities that really have therapists.
- Only publicly visible profiles are ever searched: pending or suspended therapists never match any filter.
- **Therapists set these fields themselves** in the dashboard (gender, region, target audiences, "I also treat online"). All are optional; a therapist who leaves one empty simply isn't matched when a client filters by it.

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
- Sign in at `/login`. The server enforces the role on every request (from the database, not the token); you land on the admin panel (see "Admin panel").

## Approval workflow

| Account status | Can sign in | Profile visible to the public | Set by |
|---|---|---|---|
| `PENDING_APPROVAL` | Yes (can edit the profile, upload a photo and certificates) | No | Registration |
| `ACTIVE` | Yes | Yes (`isPubliclyVisible: true`) | Admin approval |
| `SUSPENDED` | No, effective immediately (existing tokens get `403 Account suspended`) | No | Admin |

- **Registration** creates the account and profile as pending and hidden. The dashboard shows a yellow "waiting for approval" banner and no public-profile link; once approved it turns into a green "active" note.
- **Hidden means hidden everywhere:** the public search skips the profile and `/therapist/<slug>` returns 404 for it.
- **Status is always current:** it is read from the database on every request, never from the login token, so an approval or suspension shows up on the user's next request without logging in again.
- **Approve and suspend** are done in the admin panel. Approving sets the account to `ACTIVE` and the profile to visible in one step; suspending does the reverse (and hides first, so a failure halfway can never leave a suspended account visible).
- Therapists who registered before this step, and the seeded sample therapists, stay active and visible.

## Admin panel

Sign in with the admin account (see "Admin account") and you land on `/admin`. Only `ADMIN` users can open it; everyone else is sent to the home page, and the API refuses them with `403` (the role is checked against the database on every request).

| Tab / page | What you can do |
|---|---|
| **Pending approval** (`/admin`) | The moderation queue, oldest first, with a counter badge. Quick **Approve** button, or open a therapist to review them first. |
| **All therapists** (`/admin?tab=therapists`) | Every therapist account with search (name, e-mail, city, title) and a status filter. Seeded sample accounts are labelled "נתוני דוגמה"; accounts without a profile are labelled "אין פרופיל". |
| **Review page** (`/admin/therapists/<id>`) | Full profile, **Approve / Reject (suspend) / Suspend / Reactivate**, certificates, and the delete section. |
| **Categories** (`/admin?tab=categories`) | Add (name + latin slug), rename, deactivate / reactivate, with how many profiles use each. |

- **Certificates** are private. "View file" fetches the file with your admin token and opens it from a temporary local URL; the storage path is never exposed and the response is never cached. Every view and every verification is written to the server log (admin id and therapist id only, no personal details). **Verify** marks a certificate verified, which shows the "תעודות אומתו" badge on the therapist's public profile.
- **Categories are never deleted, only deactivated.** A deactivated category disappears from the public filter and from profiles (the data is kept, and reactivating brings it back). The slug appears in URLs, so it cannot be changed after creation.
- **Deleting a therapist** permanently removes the account, the profile, the avatar and all certificate files. It is guarded twice: the confirmation field must contain the account's exact e-mail (the button stays disabled until it does, and the server re-checks it), and admin accounts can never be deleted or suspended through these screens. To just hide someone, suspend them instead.
- **Suspending** hides the profile at once and locks the user out at once (existing sessions get `403`).
- Admin screens are keyed by user id, so accounts whose profile is missing can still be inspected and deleted.

## Uploads & storage

- **Avatar:** JPG/PNG/WEBP up to 5MB. The server checks the file's real bytes (not its name or Content-Type), rotates it per its EXIF orientation, crops it to a 512x512 square and saves it as WebP. All metadata (such as GPS location) is dropped. Each upload gets a new random file name, and the previous picture is deleted.
- **Certificates:** optional PDF/JPG/PNG/WEBP up to 5MB each (max 10 per therapist). They are stored in a **private** folder that is never served; the owner sees only title, name and verification status. Admins open them through an authenticated endpoint (see "Admin panel").
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
| POST | `/api/auth/register` | Public | Create a therapist account + empty profile, both **pending approval and hidden** (see "Approval workflow"). Returns `{ token, user }` |
| POST | `/api/auth/login` | Public | Returns `{ token, user }` |
| GET | `/api/categories` | Public | Active categories (`id`, `name`, `slug`) |
| GET | `/api/therapists` | Public | Search visible therapists. Query (all optional): `q`, `category` (slugs), `gender`, `region`, `city`, `audience`, `online`, `page`, `limit` (max 50). See "Search filters" |
| GET | `/api/therapists/filter-options` | Public | Cities that currently have visible therapists, with counts (for the search suggestions) |
| GET | `/api/therapists/:slug` | Public | Full public profile |
| GET | `/api/therapists/me` | Therapist | Own profile (to prefill the dashboard form), including `certificates`, `isPubliclyVisible` and the current `accountStatus` |
| PUT | `/api/therapists/me` | Therapist | Partial update of own profile |
| POST | `/api/therapists/me/avatar` | Therapist | Upload or replace the profile picture (multipart, field `avatar`) |
| DELETE | `/api/therapists/me/avatar` | Therapist | Remove the profile picture |
| POST | `/api/therapists/me/certificates` | Therapist | Upload a certificate (multipart: `title` + file `certificate`), max 10, private |
| DELETE | `/api/therapists/me/certificates/:certId` | Therapist | Delete one of your certificates |
| GET | `/uploads/avatars/<file>` | Public | Serves avatars (static, cacheable) |
| GET | `/api/admin/stats` | Admin | Counts of pending / active / suspended / total therapists |
| GET | `/api/admin/therapists` | Admin | All therapist accounts. Query: `status`, `q`, `sort` (`newest`/`oldest`), `page`, `limit` (max 50) |
| GET | `/api/admin/therapists/:id` | Admin | Full detail for review (`:id` is the user id) |
| PATCH | `/api/admin/therapists/:id/status` | Admin | Body `{ "status": "ACTIVE" \| "SUSPENDED" }`: approve / reactivate or suspend |
| DELETE | `/api/admin/therapists/:id` | Admin | Body `{ "confirmEmail": "<the account's e-mail>" }`: deletes account, profile and files |
| GET | `/api/admin/therapists/:id/certificates/:certId/file` | Admin | Streams the private certificate (inline, never cached, logged) |
| PATCH | `/api/admin/therapists/:id/certificates/:certId` | Admin | Body `{ "isVerified": true \| false }` |
| GET | `/api/admin/categories` | Admin | All categories (including deactivated) with usage counts |
| POST | `/api/admin/categories` | Admin | Body `{ "name", "slug" }` |
| PATCH | `/api/admin/categories/:id` | Admin | Body `{ "name"?, "isActive"? }` |

Details:

- **Search:** `q` matches name, professional title, bio and city (case-insensitive). Results only include profiles that are publicly visible and have a name. Response: `{ items, total, page, limit, totalPages }`.
- **`PUT /api/therapists/me` fields (all optional):** `fullName`, `professionalTitle`, `bio`, `city`, `phone`, `whatsapp`, `contactEmail`, `categories` (array of category **slugs**).
- **Privacy:** public responses never include the account `userId` or certificate files.
- **Approval:** new accounts start as `PENDING_APPROVAL` and are hidden until an admin approves them (see "Approval workflow").

## Deployment (production)

```text
 visitor's browser
        │  https://<your-site>.vercel.app          (static React site, built from client/)
        ▼
     Vercel ───────────── API calls ──────────────▶  Render  (Docker container built from server/Dockerfile)
                                                        │              │
                                                        ▼              ▼
                                                  MongoDB Atlas   persistent disk /data  (uploaded photos + certificates)
```

You need free accounts on **GitHub** (the code, already there), **MongoDB Atlas**, **Render** and **Vercel**. Do the steps in this order, because each one needs an address from the previous one.

### 0. Prepare two secrets (once)

- **`JWT_SECRET`** signs the login tokens. Generate a long random value and keep it private:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- **The admin password**: at least 12 characters, unique, not a keyboard pattern. It controls who gets approved, suspended and deleted.

### 1. MongoDB Atlas (the database)

1. Create a cluster (the free **M0** is fine to start with).
2. **Database Access** → add a database user with a strong password (role: *Read and write to any database*).
3. **Network Access** → allow Render to connect: add `0.0.0.0/0` (any address; protected by the user and password above), or the *outbound IP addresses* that Render lists for your service.
4. **Connect → Drivers** → copy the connection string and **insert the database name** between the host and the `?`:
   ```text
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/therapists_directory?appName=Cluster0
   ```
   If the password contains special characters (`@ : / ? # %`), URL-encode them. This is your `MONGODB_URI`.

### 2. Backend on Render (Docker)

1. **Render dashboard → New + → Web Service → Git provider** → pick this repository.
2. Fill in the settings:

   | Setting | Value |
   |---|---|
   | Name | for example `therapists-api` (it becomes part of the address) |
   | Region | the one closest to your Atlas cluster and your visitors |
   | Branch | `main` |
   | **Root Directory** | `server` |
   | **Language / Runtime** | `Docker` (Render finds `server/Dockerfile` by itself; Dockerfile path `./Dockerfile`) |
   | Instance type | `Free` to try it out; `Starter` or above for real use (see "Good to know") |
   | **Health Check Path** | `/api/health` |
   | Auto-Deploy | `After CI checks pass` (a red CI then blocks the deploy) |

3. **Environment variables** (Environment tab):

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | the connection string from step 1 (with `/therapists_directory`) |
   | `JWT_SECRET` | the value generated in step 0 |
   | `CLIENT_ORIGIN` | leave a placeholder for now, set it in step 5 |

   Everything else already has a production default inside the image: `NODE_ENV=production`, `PORT` (Render sets it), `UPLOADS_DIR=/data/uploads`, `TRUST_PROXY=1`. Full list: "Environment variable reference" below.
4. **Disks → Add Disk** (paid instance types only): name `uploads`, **mount path `/data`**, size `1 GB`. Without a disk the uploaded photos and certificates disappear whenever the service is redeployed.
5. **Create Web Service.** The first build takes a few minutes. When it is live, copy the address (for example `https://therapists-api.onrender.com`) and open `<address>/api/health`. You should see `{"status":"ok"}`.

### 3. Create the first data (once)

The production database starts empty. Create the categories and your admin account **from your own computer**, pointing at the production database. Run these in `server/` (the values you type here override `server/.env` and are not saved anywhere):

```powershell
# Windows PowerShell
$env:MONGODB_URI = "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/therapists_directory?appName=Cluster0"
npm run seed                                   # the 12 categories
$env:ADMIN_EMAIL = "you@yourdomain.com"
$env:ADMIN_PASSWORD = "your-long-unique-passphrase"
npm run seed:admin                             # the admin account
npm run db:check                               # should print: Database: "therapists_directory" and [ok] lines
```

```bash
# macOS / Linux
MONGODB_URI="mongodb+srv://..." npm run seed
MONGODB_URI="mongodb+srv://..." ADMIN_EMAIL="you@yourdomain.com" ADMIN_PASSWORD="..." npm run seed:admin
MONGODB_URI="mongodb+srv://..." npm run db:check
```

On a paid Render instance you can use the **Shell** tab instead: `npm run seed:prod`, `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin:prod`, `npm run db:check:prod` (these run the compiled files inside the container).

> Do **not** run `seed:therapists` in production: the sample document contains real people's contact details.

### 4. Frontend on Vercel

1. **Vercel dashboard → Add New → Project → Import** this repository.
2. In *Configure Project*:

   | Setting | Value |
   |---|---|
   | Framework Preset | `Vite` |
   | **Root Directory** | `client` (click *Edit*) |
   | Build Command | `npm run build` (default) |
   | Output Directory | `dist` (default) |

3. **Environment Variables:** add `VITE_API_URL` = the Render address from step 2, **without** a trailing slash and **without** `/api` (for example `https://therapists-api.onrender.com`).
4. **Deploy.** `client/vercel.json` makes direct links such as `/admin` or `/therapist/some-name` work after a page reload. Copy the address Vercel gives you (for example `https://therapists.vercel.app`).

### 5. Connect the two (CORS)

The browser only lets the website call the API if the API names the website. On Render → **Environment**, set:

```text
CLIENT_ORIGIN=https://therapists.vercel.app
```

Several addresses are allowed, separated by commas (for example a custom domain as well: `https://therapists.vercel.app,https://www.my-domain.co.il`). Saving restarts the service. If the site shows *"cannot connect to the server"* while `/api/health` works, this variable is the usual cause.

### 6. Check that everything works

1. Open the Vercel address: the home page loads and the search works.
2. Reload on `/login`: the page appears (no 404).
3. Register a test therapist: the dashboard shows the yellow *waiting for approval* banner.
4. Log in as the admin: `/admin` opens; approve the test therapist; the profile appears in the public search.
5. Upload a profile picture and reload: it is still there.
6. In Render → **Logs** you see one JSON line per request, and no passwords or tokens.
7. Delete the test therapist from the admin panel, and **remove `ADMIN_PASSWORD` from every place you typed it**.

### Environment variable reference

**Render (server)**

| Variable | Required | Meaning |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string, **with** the database name |
| `JWT_SECRET` | yes | at least 16 characters; changing it logs everybody out |
| `CLIENT_ORIGIN` | yes | website address(es) allowed to call the API, comma separated |
| `JWT_EXPIRES_IN` | no | login lifetime, default `7d` |
| `LOG_LEVEL` | no | `info` by default in production |
| `UPLOADS_DIR` | no | image default `/data/uploads`: keep it on the persistent disk |
| `TRUST_PROXY` | no | image default `1` (Render's load balancer). If every visitor shows the same IP, raise it to `2` |
| `BCRYPT_ROUNDS` | no | password hashing cost, default `12` |
| `PORT`, `NODE_ENV` | no | set by Render and by the image |

**Vercel (client):** `VITE_API_URL` (required). It is baked into the site at build time, so change it, then redeploy.

### Run the backend image on your own machine

```bash
docker build -t therapists-api ./server
docker run --rm -p 10000:10000 \
  -e MONGODB_URI="mongodb+srv://.../therapists_directory?appName=Cluster0" \
  -e JWT_SECRET="a-long-random-secret" \
  -e CLIENT_ORIGIN="http://localhost:5173" \
  -e TRUST_PROXY=0 \
  -v therapists-uploads:/data \
  therapists-api
# then open http://localhost:10000/api/health
```

The image runs as an unprivileged user, never contains `.env`, tests or sources (see `server/.dockerignore`), and shuts down cleanly (finishing open requests) when Render or Docker stop it.

### Continuous integration (GitHub Actions)

`.github/workflows/ci.yml` runs on **every push and pull request**, with three jobs in parallel:

| Job | What it does |
|---|---|
| **Server** | `npm ci`, type-check, build, then the whole server test suite (MongoDB binary cached) |
| **Client** | `npm ci`, type-check, the client test suite, and the production build |
| **Backend Docker image** | builds `server/Dockerfile`, **runs the image against a real MongoDB**, registers, logs in, uploads a picture, checks CORS, stops it the way Render does (must exit with code 0), and checks it runs unprivileged without secrets inside |

See the results in the repository's **Actions** tab (a green tick or red cross also appears next to every commit). The badge at the top of this README shows the latest status of `main`.

To make a deploy wait for a green CI: on Render use *Auto-Deploy → After CI checks pass* (step 2). For Vercel, protect `main` with GitHub **branch protection** (*Require status checks to pass*) and merge through pull requests.

### Good to know before going live

- **Free Render services go to sleep** after about 15 minutes without traffic; the next visitor waits roughly a minute while it wakes up. A paid instance stays awake.
- **Uploaded files live on the disk mounted at `/data`.** Free instances have no disk, so photos and certificates are lost on every deploy. Use a paid instance with a disk (it can only be attached to **one** instance), or later move storage to a cloud provider: `server/src/storage/` is built so that this is one new file.
- **Back up your data.** The free Atlas M0 has no automatic backups (use *Export*, or a paid tier); Render offers snapshots for disks on paid plans.
- **Deploys:** push to `main` and both Render and Vercel redeploy by themselves.
- **Never commit secrets.** They live only in the Render and Vercel dashboards (and your local, git-ignored `.env`).
- **HTTPS is automatic** on both platforms, including custom domains.

## Automated tests

Two test suites live in the repository. **Neither touches your real database or sends anything to the internet**, so they are safe to run any time, and they never create users in Atlas.

| Suite | Tool | Where | What it covers |
|---|---|---|---|
| **Server** | Vitest + Supertest, against a throw-away in-memory MongoDB | `server/tests/` | Registration and login, token handling, **role guards** (anonymous / therapist / admin on every protected route), the public directory and all search filters, profile editing (including mass-assignment attempts), the approval workflow end to end, the admin API (queue, approve / suspend, guarded delete, categories), avatar and certificate uploads and privacy, rate limiting, plus unit tests for file-type detection, storage path safety and the response mappers that must never leak private data |
| **Client** | Vitest + React Testing Library (simulated browser) | `client/src/**/*.test.ts(x)` next to the code | Login and registration forms, route guards, the logged-in session, automatic logout, the pending / active **status banners**, the dashboard form, avatar upload validation, the filter sidebar and the URL-driven search page, the admin screens (queue, categories, review page, **type-the-e-mail-to-delete**) |

### How to run them (step by step)

1. **Install once** (if you have not already): `npm install` inside `server/` and inside `client/`.
2. **Run everything** from the project root:
   ```bash
   npm test
   ```
   This runs the server suite, then the client suite. It stops at the first failing suite.
3. **Or run one side only:**
   ```bash
   npm run test:server      # from the project root, or: cd server && npm test
   npm run test:client      # from the project root, or: cd client && npm test
   ```
4. **While developing:** `npm run test:watch` inside `server/` or `client/` re-runs the affected tests whenever you save a file.
5. **One file or one test:**
   ```bash
   cd server && npm test -- tests/auth.test.ts
   cd client && npm test -- src/pages/Login.test.tsx
   cd client && npm test -- -t "pending therapist"     # only tests whose name contains this text
   ```
6. **Type-check the code and the tests together:** `npm run typecheck` from the project root.

A healthy run prints `Test Files  N passed (N)` and `Tests  M passed (M)` and exits with code 0. The server suite takes about a minute, the client suite about 20 seconds.

### Good to know

- **First server run downloads MongoDB once** (about 75 MB, cached in `~/.cache/mongodb-binaries`), so it takes a little longer; later runs start the in-memory database in about a second.
- **Safety net:** `server/tests/setup.ts` refuses to run unless the database address is a local in-memory one, and each test file gets its own empty database that is dropped afterwards.
- **`npm test` in `server/` is a small runner** (`tests/run.mjs`). On some Windows machines Node occasionally aborts a test worker by itself ("Worker exited unexpectedly with exit code 3221226505"); that is a crash of the runtime, not a failing test. The runner recognises exactly that and re-runs only the affected files (up to three times) and says so. A real test failure is **never** retried or hidden. `npm run test:raw` runs Vitest directly without this safety.
- **Test files are plain examples to copy:** server tests use the helpers in `server/tests/helpers.ts` (`createTherapist`, `createAdmin`, `api()`, ...), client tests use `client/src/test/utils.tsx` (`renderWithProviders`, `httpError`, fixtures).
- **To check that a test really protects something**, break the code on purpose (for example remove `requireRole('ADMIN')` from `adminRoutes.ts`) and run the suite: it should turn red. This was done for the key protections when the suites were written.
- The browser-level, whole-site checks used during development (real Edge against a running server) are not part of these suites. A natural next step is a small Playwright suite for them.

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
    test/               # test setup and helpers (render with router + auth, fixtures)
    **/*.test.ts(x)     # component, page and logic tests, next to the code they test
    App.tsx             # routes
    main.tsx
package.json            # root scripts: npm test, npm run typecheck
.github/workflows/ci.yml  # CI: type-check, tests, build, Docker image smoke test on every push
client/vercel.json      # Vercel: single-page-app routing
server/Dockerfile       # production image for Render (+ docker-entrypoint.sh, .dockerignore)
server/
  tests/                # server test suite (Vitest + Supertest, in-memory MongoDB); run with npm test
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
    # admin: controllers/adminController.ts + adminCategoryController.ts, routes/adminRoutes.ts, utils/adminDto.ts
    server.ts           # entry point
```
