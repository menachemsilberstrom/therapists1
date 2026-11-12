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
| Phase 2 (MVP) / Phase 3 (V1) | Not started |

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

> **Windows + Atlas note:** if you see `querySrv ECONNREFUSED`, Node's DNS was pointed at `127.0.0.1`.
> `src/config/db.ts` already works around this by switching to public DNS for `mongodb+srv://` URIs.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the server with auto-reload |
| `npm run seed` | Seed categories |
| `npm run typecheck` | Type-check without building |
| `npm run build` / `npm start` | Compile to `dist/` and run it |

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
    scripts/            # seedCategories
    server.ts           # entry point
```
