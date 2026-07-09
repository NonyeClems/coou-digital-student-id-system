# COOU Digital Student ID System

A web application for **Chukwuemeka Odumegwu Ojukwu University (COOU)** that issues, manages, and verifies digital student identity cards. Students self-enroll and receive a downloadable digital ID card containing a unique QR code; anyone (security staff, lecturers, external parties) can scan that QR code with a standard phone camera or the built-in scanner to confirm the student's identity and registration status against the live university registry.

---

## Table of Contents

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Technology Stack](#2-technology-stack)
3. [Prerequisites](#3-prerequisites)
4. [Installation](#4-installation)
5. [Environment Variables](#5-environment-variables)
6. [Database Setup (Firebase)](#6-database-setup-firebase)
7. [Running the Application](#7-running-the-application)
8. [Administrator Credentials](#8-administrator-credentials)
9. [QR Code Verification — How It Works](#9-qr-code-verification--how-it-works)
10. [Deployment](#10-deployment)
11. [Troubleshooting](#11-troubleshooting)
12. [Assumptions, Limitations & External Services](#12-assumptions-limitations--external-services)

---

## 1. Project Overview & Architecture

This is a **single-page application (SPA)** with a **serverless backend**. There is no Node/Express server process to run — Firebase provides authentication and the database directly from the browser:

```
┌────────────────────────────────────────────┐
│  Browser (React SPA, built with Vite)      │
│                                            │
│  Routes:                                   │
│   /            Login / Student Portal /    │
│                Admin Dashboard (by role)   │
│   /scanner     QR code scanner (public)    │
│   /verify/:id  Verification page (public,  │
│                opened by scanning a QR)    │
└──────────────┬─────────────────────────────┘
               │ Firebase Web SDK (HTTPS)
     ┌─────────┴──────────┐
     │  Firebase Auth      │  Email/password sign-in
     │  Cloud Firestore    │  Collections: students, profiles
     └─────────────────────┘
```

### Key source files

| File | Purpose |
|---|---|
| `src/App.tsx` | Routing, landing (login/signup/reset) page, route guards |
| `src/AuthContext.tsx` | Auth state, login/signup/logout, role assignment, admin allow-list |
| `src/components/StudentPortal.tsx` | Student self-enrollment and the digital ID card (with QR code) |
| `src/components/AdminDashboard.tsx` | Admin CRUD over all student records |
| `src/components/Scanner.tsx` | In-app camera QR scanner |
| `src/VerificationPortal.tsx` | Public page a scanned QR resolves to (`/verify/:id`) |
| `src/lib/firebase.ts` | Firebase initialization from environment variables |
| `src/lib/utils.ts` | ID sanitization, level calculation, image compression, QR base URL |
| `src/constants.ts` | Departments, department codes, university branding |
| `src/types.ts` | `Student` and `UserProfile` data models |

### Data model (Firestore)

**`students` collection** — one document per student. The **document ID is the registration number** with any `/` characters replaced by `-` (Firestore does not allow slashes in document IDs).

| Field | Type | Notes |
|---|---|---|
| `id` | string | Registration number exactly as entered |
| `docId` | string | Sanitized registration number (same as document ID) |
| `name`, `email` | string | |
| `department` | string | One of `DEPARTMENTS` in `src/constants.ts` |
| `admissionYear` | number | Used to compute `level` |
| `level` | string | e.g. `"200 Level"` |
| `status` | string | `active` \| `suspended` \| `graduated` — shown on verification |
| `passportURL` | string | Base64 JPEG (compressed client-side to ≤400px wide) |
| `phone`, `gender`, `dob`, `bloodGroup`, `religion` | string | Optional |
| `createdAt`, `updatedAt` | number | Unix ms timestamps |

**`profiles` collection** — one document per authenticated user, keyed by Firebase Auth UID: `uid`, `email`, `displayName`, `role` (`admin` \| `staff` \| `student`).

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | ~5.8 |
| UI framework | React | 19 |
| Routing | react-router-dom | 7 |
| Build tool / dev server | Vite | 6 |
| Styling | Tailwind CSS (via `@tailwindcss/vite`) | 4 |
| Auth + database | Firebase (Auth, Cloud Firestore) | Web SDK 12 |
| QR generation | qrcode.react | 4 |
| QR scanning | html5-qrcode | 2 |
| Icons | lucide-react | — |
| Card image export | html-to-image | — |
| Animations (non-landing pages) | motion | 12 |

> Note: `package.json` also lists `@google/genai`, `express`, `dotenv`, and `html2canvas`. These are **not used** by the application (leftovers from the original AI Studio template) and are tree-shaken out of the production bundle.

---

## 3. Prerequisites

**Hardware:** any machine capable of running Node.js; ≥ 2 GB free RAM for the build; a device with a camera if you want to test the in-app scanner.

**Software:**

- **Node.js 18+** (20 LTS recommended) — https://nodejs.org
- **npm 9+** (bundled with Node) — `pnpm` also works (a `pnpm-lock.yaml` is present)
- **Git**
- A **Google account** to create a free Firebase project (Spark plan is sufficient)
- A modern browser (Chrome, Edge, Firefox, Safari)

---

## 4. Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd Chinonye

# 2. Install dependencies
npm install

# 3. Create your environment file
#    Windows (PowerShell):
copy .env.example .env.local
#    macOS/Linux:
cp .env.example .env.local

# 4. Fill in .env.local with your Firebase credentials (see sections 5 and 6)
```

---

## 5. Environment Variables

All variables live in `.env.local` (never commit this file) and are read **at build time** — after changing any value you must restart the dev server or rebuild.

| Variable | Required | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web API key. Firebase Console → Project Settings → General → Your apps. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Usually `<project-id>.firebaseapp.com`. |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Your Firebase project ID. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Usually `<project-id>.firebasestorage.app`. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Numeric sender ID from the same settings page. |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase Web app ID (`1:...:web:...`). |
| `VITE_APP_BASE_URL` | Recommended in production | Public URL of the deployed site, **no trailing slash** (e.g. `https://coou-id.example.com`). Baked into every ID card QR code so scanned codes always point at the live site. If unset, QR codes use the origin of the browser that rendered the card — fine on the deployed site, but cards viewed on `localhost` would encode a localhost URL unreachable from a phone. |

> Firebase web API keys are identifiers, not secrets — security is enforced by Firestore rules and Auth. Still, keep `.env.local` out of version control.
>
> ⚠️ **If you cloned a repository that already contains `.env.local`:** it was committed before `.gitignore` covered it. Untrack it with `git rm --cached .env.local` and commit, then rotate/restrict the key in Google Cloud Console if the repo is public.

---

## 6. Database Setup (Firebase)

Firestore is schemaless, so there are **no migration scripts** — collections and documents are created automatically the first time the app writes them. One-time setup:

### 6.1 Create the project

1. Go to https://console.firebase.google.com → **Add project** (Analytics optional).
2. In the project, click the **Web** icon (`</>`) → register an app → copy the `firebaseConfig` values into `.env.local`.

### 6.2 Enable Authentication

1. **Build → Authentication → Get started**.
2. Enable the **Email/Password** sign-in provider.
3. (After deploying) **Authentication → Settings → Authorized domains** → add your production domain, otherwise sign-in fails on the deployed site.

### 6.3 Create the Firestore database

1. **Build → Firestore Database → Create database**.
2. Choose a location close to your users (e.g. `europe-west1`).
3. Start in **production mode**, then set the rules below.

### 6.4 Security rules

**Firestore Database → Rules** — publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Student records: publicly readable so scanned QR codes can be
    // verified without an account. Writes require a signed-in user.
    match /students/{studentId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // User profiles: each user can only read/write their own profile.
    match /profiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

> Public read on `students` is a deliberate product decision — it is what lets any phone verify a scanned ID without logging in. If that is unacceptable, verification must be moved behind a Cloud Function; see [Limitations](#12-assumptions-limitations--external-services).

### 6.5 Indexes

Not required. All queries used by the app (`where email ==`, `where id ==`, `orderBy createdAt`) are covered by Firestore's automatic single-field indexes. If Firestore ever raises a "query requires an index" error, the error message contains a link that creates the index in one click.

---

## 7. Running the Application

There is **no separate backend to start** — Firebase is the backend. All commands run from the project root.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server at **http://localhost:3000** (hot reload, listens on all interfaces so you can open it from a phone on the same network) |
| `npm run lint` | Type-checks the entire project (`tsc --noEmit`) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the production build locally (for pre-deployment smoke tests) |
| `npm run clean` | Deletes `dist/` (uses `rm -rf`; on Windows run it from Git Bash, or delete the folder manually) |

There is currently **no automated test suite**; `npm run lint` (type-check) plus the manual smoke test below are the verification steps.

### First-run smoke test

1. `npm run dev` → open http://localhost:3000 — the login page appears.
2. **Sign Up** with any email/password → you land in the Student Portal.
3. **Start Self-Enrollment** → fill the form, upload any photo → an ID card with a QR code is rendered.
4. Open http://localhost:3000/scanner (or click *Verify* in the navbar) and scan the card's QR from another screen, or simply open `http://localhost:3000/verify/<REG-NUMBER>` — the verification page shows the student's record and status.

---

## 8. Administrator Credentials

Admin access is granted by an **email allow-list** in the source code — there is no separate admin signup flow.

1. Open [src/AuthContext.tsx](src/AuthContext.tsx) and edit:

   ```ts
   const INITIAL_ADMINS = ['nonyeasuzu3@gmail.com'];
   ```

   Add the email address(es) that should have admin rights.

2. Rebuild/restart the app, then **sign up (or log in) with that exact email**. The account's profile is created — or automatically upgraded on next login if it already exists — with `role: 'admin'`.

3. Admins see the **Admin Dashboard** at `/` instead of the student portal: full search, enroll, edit, suspend, and delete over all student records.

To grant `staff` (dashboard access without the admin badge), edit the user's document in the Firestore `profiles` collection and set `role: "staff"` manually.

> Limitation: the allow-list is compiled into the client bundle and roles are enforced client-side plus by the Firestore rules above. For a production hardening step, enforce roles in Firestore rules (e.g. custom claims via the Admin SDK) rather than trusting the client.

---

## 9. QR Code Verification — How It Works

- Every enrolled student's ID card embeds a QR code (`qrcode.react`, error-correction level **H**) encoding:

  ```
  <VITE_APP_BASE_URL or current origin>/verify/<url-encoded registration number>
  ```

  Registration numbers are unique (enrollment refuses a number already registered to a different account), so every card's QR code is unique.

- **Scanning with any standard phone camera** opens the public `/verify/:id` page, which looks the record up live in Firestore and displays: full name, registration/ID number, department, level, **verification status** (Active / Suspended / Graduated — with distinct banner colors), photo, blood group, date of birth, and contact.

- **Scanning with the in-app scanner** (`/scanner`, public, no login required) accepts both full verification URLs and raw registration numbers, and shows the same registry data inline.

- **Error handling:** an unknown/invalid/deleted ID shows a "Verification Failed / record not found" page; suspended records are clearly flagged as **not valid**; network failures show a connection error with a retry option.

- **Deployment requirements for QR codes to keep working** (both covered by this repo / docs):
  1. The host must rewrite all paths to `index.html` (see [Deployment](#10-deployment)) so `/verify/...` deep links don't 404.
  2. Set `VITE_APP_BASE_URL` to the production URL before building, so cards always encode the live domain.

---

## 10. Deployment

The production build is a fully static site (`dist/`) — it can be hosted anywhere that serves static files **and supports SPA rewrites** (all routes → `index.html`).

### Checklist (any host)

1. Set all `VITE_FIREBASE_*` variables **and** `VITE_APP_BASE_URL=https://your-domain` in the host's environment (or in `.env.local` if building locally).
2. `npm run build`.
3. Deploy `dist/`.
4. Ensure SPA rewrites are active (see per-host notes below).
5. Add the production domain to **Firebase Auth → Settings → Authorized domains**.
6. Smoke test on the live URL: log in, open an ID card, scan its QR with a real phone.

### Netlify

`public/_redirects` (already in this repo, copied into `dist/` automatically) handles the SPA rewrite. Set the environment variables in **Site settings → Environment variables**, build command `npm run build`, publish directory `dist`.

### Vercel

`vercel.json` (already in this repo) handles the rewrite. Framework preset: *Vite*. Set the environment variables in **Project → Settings → Environment Variables**.

### Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # public directory: dist, configure as SPA: Yes
npm run build
firebase deploy --only hosting
```

The "configure as SPA" answer writes the required rewrite into `firebase.json`.

### Any other static host / nginx

```nginx
location / {
  try_files $uri /index.html;
}
```

---

## 11. Troubleshooting

| Symptom | Cause & fix |
|---|---|
| Login/signup fails with `auth/invalid-api-key` or a blank page with console errors about Firebase | `.env.local` missing or has placeholder values. Fill in real values and **restart the dev server** (env vars are read at startup only). |
| `auth/operation-not-allowed` on signup | Email/Password provider not enabled — see [6.2](#62-enable-authentication). |
| `auth/unauthorized-domain` on the deployed site | Add the domain under Firebase Auth → Settings → Authorized domains. |
| `Missing or insufficient permissions` (Firestore) | Security rules not published or too strict — publish the rules in [6.4](#64-security-rules). |
| Scanned QR code opens a 404 | The host is not rewriting routes to `index.html` — see [Deployment](#10-deployment). |
| Scanned QR opens `http://localhost:3000/...` | The card was generated from a build without `VITE_APP_BASE_URL`. Set it and rebuild; the card view re-renders the QR from live data, so no data fix is needed. |
| In-app scanner camera never starts | Browsers only expose the camera on **HTTPS or localhost**. Test on `localhost` or the deployed HTTPS site, and accept the camera permission prompt. |
| "This Registration Number is already registered to another account" | Registration numbers are unique document IDs. Use the correct number, or have an admin delete/edit the conflicting record. |
| `Failed to save student record ... document exceeds maximum size` | Firestore documents max out at ~1 MB and passport photos are stored inline as base64. Upload a smaller photo (the app already compresses to 400px wide, but extremely large originals can still fail). |
| Port 3000 already in use | Stop the other process, or change the port in the `dev` script in `package.json`. |
| `npm run clean` fails on Windows | The script uses `rm -rf`. Run it from Git Bash or delete `dist/` manually. |
| Admin sees the student portal instead of the dashboard | The logged-in email is not in `INITIAL_ADMINS` (exact match, case-sensitive as typed). Add it, rebuild, log out and back in. |

---

## 12. Assumptions, Limitations & External Services

**External services (the only one):**
- **Firebase** (Auth + Cloud Firestore). Free Spark plan suffices for moderate usage. No other APIs, servers, or databases are required. (The `GEMINI_API_KEY` reference in `vite.config.ts` is a leftover from the original template and is unused.)

**Assumptions:**
- Registration numbers are unique per student and are entered correctly at enrollment (they become the record's identity and the QR payload).
- Verification pages are intentionally public (no login) so any scanner can validate an ID.

**Known limitations:**
- Passport photos are stored as base64 strings inside Firestore documents (~1 MB document cap) rather than in Cloud Storage.
- Role enforcement relies on the client and basic Firestore rules; the admin allow-list ships in the client bundle. Harden with Firebase custom claims for a high-stakes deployment.
- Academic level is derived from admission year with hardcoded year thresholds in `src/lib/utils.ts` (`calculateLevel`) — update these each academic session.
- Students can self-enroll with any registration number that is not already taken; there is no cross-check against an official registry import.
- No automated tests yet; verification is type-checking plus the manual smoke test in [Section 7](#7-running-the-application).
