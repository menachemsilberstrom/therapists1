# Project Master Specification & Incremental Build Plan
**Project Name:** Community Therapists Directory & Content Platform  
**Tech Stack:** MongoDB (Mongoose), Express.js (TypeScript), React (Vite + TypeScript + Tailwind CSS), Node.js  
**Target Language / Locale:** Hebrew (RTL layout - `dir="rtl"`)

---

## 🤖 CRITICAL INSTRUCTIONS FOR AI ASSISTANT (CLAUDE CODE)
1. **DO NOT BUILD EVERYTHING AT ONCE:** You must strictly follow the phased roadmap (**POC -> MVP -> V1**). Only implement the specific step requested by the user.
2. **STOP & VERIFY:** After completing each sub-step, stop, explain how to test it locally, and wait for user confirmation before moving to the next step.
3. **STRICT TYPESCRIPT:** No `any` types allowed. Share interfaces/types or keep strict parity between Backend DTOs and Frontend interfaces.
4. **RTL FIRST:** Every UI component in React must be built with Right-to-Left (Hebrew) alignment in mind (`dir="rtl"`, logical Tailwind properties like `ms-4`, `me-2`, `text-start`).
5. **SECURITY & RBAC:** Never trust client-side role checks. Enforce JWT authentication and Role-Based Access Control (`THERAPIST`, `ADMIN`) via Express middlewares.

---

## 1. System Architecture & Folder Structure

Use a clean monorepo-style structure with two separate applications:

```text
/project-root
├── /server                  # Express + TypeScript + Mongoose
│   ├── /src
│   │   ├── /config          # DB connection, env validation, Cloudinary/S3 setup
│   │   ├── /models          # Mongoose Schemas (User, TherapistProfile, Category, Article)
│   │   ├── /middlewares     # authMiddleware, roleMiddleware, uploadMiddleware, errorHandler
│   │   ├── /controllers     # Business logic separated from routes
│   │   ├── /routes          # Express routers (/api/auth, /api/therapists, /api/admin, /api/articles)
│   │   ├── /types           # Express Request extensions & shared interfaces
│   │   └── server.ts        # App entry point
│   ├── package.json
│   └── tsconfig.json
│
└── /client                  # React + Vite + TypeScript + Tailwind CSS
    ├── /src
    │   ├── /api             # Axios instance with JWT interceptors & API service functions
    │   ├── /components      # Reusable UI components (Navbar, TherapistCard, FilterSidebar, etc.)
    │   ├── /context         # AuthContext (user state, login, logout)
    │   ├── /pages           # Route views (Home, Search, TherapistProfile, Dashboard, AdminPanel)
    │   ├── /types           # Frontend TypeScript interfaces
    │   ├── App.tsx          # React Router setup
    │   └── main.tsx
    ├── index.html           # Set <html lang="he" dir="rtl">
    └── package.json
```

---

## 2. Database Schema Design (Mongoose + TypeScript)

### A. `User` Collection (`models/User.ts`)
Handles authentication and system-level permissions.
```typescript
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: 'THERAPIST' | 'ADMIN';
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}
```

### B. `TherapistProfile` Collection (`models/TherapistProfile.ts`)
Stores public directory details AND private verification documents.
```typescript
export interface ICertificate {
  title: string;        // e.g., "M.A. Clinical Psychology"
  fileUrl: string;      // Cloud storage URL (PDF/Image)
  uploadedAt: Date;
  isVerified: boolean;  // Verified by Admin
}

export interface ITherapistProfile extends Document {
  userId: mongoose.Types.ObjectId; // Ref: 'User'
  slug: string;                    // URL-friendly unique identifier (e.g., "moshe-cohen-123")
  fullName: string;
  professionalTitle: string;       // e.g., "מטפל רגשי וזוגי"
  gender: 'MALE' | 'FEMALE';
  bio: string;
  profileImageUrl?: string;
  city: string;
  region: 'NORTH' | 'CENTER' | 'JERUSALEM' | 'SOUTH' | 'ONLINE_ONLY';
  acceptsOnline: boolean;
  targetAudiences: ('CHILDREN' | 'TEENS' | 'ADULTS' | 'COUPLES' | 'PARENTS')[];
  categories: mongoose.Types.ObjectId[]; // Ref: 'Category'
  contactInfo: {
    phone: string;
    whatsapp?: string;
    email?: string;
  };
  certificates: ICertificate[];    // Optional during signup, visible to Admin (and badge if verified)
  isPubliclyVisible: boolean;      // True only when User.status === 'ACTIVE'
  createdAt: Date;
  updatedAt: Date;
}
```

### C. `Category` Collection (`models/Category.ts`)
Admin-managed areas of expertise (e.g., Anxiety, Couples Therapy, Youth).
```typescript
export interface ICategory extends Document {
  name: string;       // Hebrew display name (e.g., "חרדה ומתח")
  slug: string;       // Unique identifier
  isActive: boolean;
}
```

### D. `Article` Collection (`models/Article.ts`) - *Reserved for V1*
```typescript
export interface IArticle extends Document {
  authorId: mongoose.Types.ObjectId; // Ref: 'TherapistProfile'
  title: string;
  slug: string;
  summary: string;
  content: string;                   // HTML or Markdown
  coverImageUrl?: string;
  categoryId: mongoose.Types.ObjectId;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED';
  publishedAt?: Date;
  createdAt: Date;
}
```

---

## 3. Phased Development Roadmap (POC -> MVP -> V1)

### 🟢 PHASE 1: POC (Proof of Concept) — Core Data & Basic Directory
**Goal:** Prove the end-to-end flow: Therapist signs up -> Creates a basic profile -> Guest searches and views the therapist's profile page. No complex file uploads or admin UI yet.

*   **Step 1.1: Backend Setup & Auth**
    *   Initialize `/server` with Express, TS, Mongoose, `dotenv`, `cors`, `bcryptjs`, `jsonwebtoken`.
    *   Create `User`, `TherapistProfile`, and `Category` models + a seed script for initial categories.
    *   Build `/api/auth/register` (creates `User` + empty `TherapistProfile`) and `/api/auth/login` (returns JWT).
*   **Step 1.2: Basic Therapist & Public Endpoints**
    *   `GET /api/therapists`: Public endpoint returning profiles (with basic text search & category filter). *Note: During POC, default new users to `ACTIVE` or provide a seed script so results appear immediately.*
    *   `GET /api/therapists/:slug`: Public endpoint returning full details for a single therapist's public page.
    *   `PUT /api/therapists/me`: Protected endpoint for logged-in therapist to update text fields (name, bio, city, phone, categories).
*   **Step 1.3: Frontend Setup & Core Pages**
    *   Initialize `/client` with Vite, React, TS, Tailwind CSS (`dir="rtl"` in `index.html`).
    *   Build `AuthContext` & Login/Register forms.
    *   Build **Home/Search Page**: Simple search bar + grid of `TherapistCard` components.
    *   Build **Therapist Public Profile Page (`/therapist/:slug`)**: Displays full bio, specialties, and click-to-call / WhatsApp link.
    *   Build **Basic Therapist Dashboard**: Form to edit profile text fields.

---

### 🟡 PHASE 2: MVP (Minimum Viable Product) — Verification, Media Uploads & Admin Control
**Goal:** Make the platform production-ready and safe for the community. Add profile photos, optional certificate uploads, advanced filtering, and the Admin moderation workflow.

*   **Step 2.1: Cloud File Upload Infrastructure**
    *   Integrate `multer` + Cloudinary (or AWS S3) on the backend.
    *   Create upload endpoints for:
        1. `POST /api/therapists/me/avatar` (Image compression, JPG/PNG/WEBP).
        2. `POST /api/therapists/me/certificates` (Optional upload of PDF/Image credentials with a title).
*   **Step 2.2: Approval Workflow & RBAC**
    *   Change default registration status to `PENDING_APPROVAL` (`isPubliclyVisible: false`).
    *   Ensure public `GET /api/therapists` strictly filters `{ isPubliclyVisible: true }`.
*   **Step 2.3: Admin Panel (Backend & Frontend)**
    *   Protect `/api/admin/*` routes with `requireRole('ADMIN')`.
    *   Build Admin endpoints & UI:
        *   View pending therapists, inspect uploaded certificates, and click **Approve** or **Suspend**.
        *   Mark specific certificates as `isVerified: true` (displays a "תעודות אומתו" badge on the public profile).
        *   CRUD interface for managing `Categories`.
*   **Step 2.4: Advanced Public Filtering**
    *   Upgrade `GET /api/therapists` and the Frontend Search Sidebar to filter simultaneously by:
        *   Keyword search (Name/Bio)
        *   Category (Multi-select)
        *   Gender (`MALE` / `FEMALE`)
        *   Region / City
        *   Target Audience (`CHILDREN`, `TEENS`, `ADULTS`, `COUPLES`)
        *   Online availability (`acceptsOnline: true`)

---

### 🔵 PHASE 3: V1 (Version 1.0) — Content Engine (Articles) & SEO Growth
**Goal:** Allow approved therapists to publish professional articles to drive organic traffic and build authority.

*   **Step 3.1: Articles Backend & Moderation**
    *   Create `/api/articles` endpoints:
        *   Therapists (`status === 'ACTIVE'`) can create, edit, and submit drafts (`PENDING_REVIEW`).
        *   Admin can review, edit, and publish (`PUBLISHED`) articles.
        *   Public endpoints to list articles by category and fetch a single article by `slug`.
*   **Step 3.2: Rich Text Editor & Public Reading Experience**
    *   Add a Rich Text Editor (e.g., TipTap or React-Quill with RTL support) to the Therapist Dashboard.
    *   Build Public **Articles Hub (`/articles`)** and **Article Reader Page (`/articles/:slug`)**.
    *   Include an "About the Author" card at the bottom of every article linking directly to the therapist's profile page.
*   **Step 3.3: SEO & Polish**
    *   Add dynamic `<title>` and `<meta description>` tags (using `react-helmet-async`) for every therapist profile and article.
    *   Add contact lead tracking (optional counter for WhatsApp/Phone clicks in the therapist dashboard).

---

## 4. How to Start (First Prompt to Claude Code)
Copy and paste this exact prompt to start building Step 1.1:

> "Read `CLAUDE_BUILD_PLAN.md` carefully. Follow all rules strictly—especially building step-by-step without jumping ahead. Start **ONLY with Phase 1, Step 1.1 (Backend Setup & Auth)**. Initialize the `/server` project with TypeScript, Express, Mongoose, JWT auth, the core database schemas, and a category seed script. Once done, stop and give me instructions on how to test the auth endpoints."