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
8. [Local Development with the Firebase Emulator Suite](#8-local-development-with-the-firebase-emulator-suite)
9. [Administrator Credentials](#9-administrator-credentials)
10. [Backend Verification Suite](#10-backend-verification-suite)
11. [QR Code Verification — How It Works](#11-qr-code-verification--how-it-works)
12. [Deployment](#12-deployment)
13. [Troubleshooting](#13-troubleshooting)
14. [Assumptions, Limitations & External Services](#14-assumptions-limitations--external-services)

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
| `src/lib/firebase.ts` | Firebase initialization from environment variables (+ emulator wiring) |
| `src/lib/utils.ts` | ID sanitization, level calculation, image compression, QR base URL |
| `src/constants.ts` | Departments, department codes, university branding |
| `src/types.ts` | `Student` and `UserProfile` data models |
| `firestore.rules` | Firestore security rules (role-based access control) |
| `firebase.json` | Firebase Emulator Suite configuration (ports, Emulator UI) |
| `scripts/dev-menu.mjs` | Interactive terminal menu (`npm start`) with Start Over / Exit |
| `scripts/seed-admin.mjs` | Seeds the local admin account into the emulators |
| `scripts/verify-backend.mjs` | End-to-end backend verification suite (24 checks) |
| `scripts/test-backend.mjs` | Runs the suite, managing emulator startup/cleanup |

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
- **Java 11+** (JRE or JDK) — required only for the local Firestore emulator (`npm start` / `npm run emulators` / `npm run test:backend`) — https://adoptium.net
- A **Google account** to create a free Firebase project (Spark plan is sufficient) — *not needed for emulator-only local development*
- A modern browser (Chrome, Edge, Firefox, Safari)

> `firebase-tools` (the Firebase CLI used to run the emulators) is a project devDependency — `npm install` provides it; no global install required.

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

> **You can skip this whole section for local development** — `npm start` → option **[1]** runs the app against the offline [Firebase Emulator Suite](#8-local-development-with-the-firebase-emulator-suite) with no Firebase project, credentials, or internet required. A real Firebase project is only needed to deploy or to run against live data.

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

The rules live in [firestore.rules](firestore.rules) at the repo root (they are also what the local emulator enforces). Publish them to production either by pasting the file's contents into **Firestore Database → Rules**, or from the CLI:

```bash
npx firebase deploy --only firestore:rules --project <your-project-id>
```

What they enforce:

- **`students`** — publicly readable (so any phone can verify a scanned QR code without an account). Admins/staff can create, update, and delete any record; a signed-in student can only write/delete the record bearing their own email.
- **`profiles`** — each user can read/write only their own profile, and the `admin`/`staff` role can only be stored for emails on the admin allow-list (see [Administrator Credentials](#9-administrator-credentials)). This means a tampered client **cannot** self-promote to admin — the allow-list is enforced server-side.

> Public read on `students` is a deliberate product decision — it is what lets any phone verify a scanned ID without logging in. If that is unacceptable, verification must be moved behind a Cloud Function; see [Limitations](#14-assumptions-limitations--external-services).

### 6.5 Indexes

Not required. All queries used by the app (`where email ==`, `where id ==`, `orderBy createdAt`) are covered by Firestore's automatic single-field indexes. If Firestore ever raises a "query requires an index" error, the error message contains a link that creates the index in one click.

---

## 7. Running the Application

There is **no separate backend server process to write or start** — Firebase (or its local emulator) is the backend. All commands run from the project root.

**The recommended entry point is the interactive development console:**

```bash
npm start
```

It presents a menu:

```
[1] Start app with LOCAL Firebase emulators (recommended for development)
[2] Start app with LIVE Firebase (uses .env.local credentials)
[3] Run backend verification suite (end-to-end checks against emulators)
[4] Type-check the project
[Q] Exit
```

While the app is running, the console stays interactive — the terminal is never cleared:

- **`R` — Start Over**: shuts the dev server (and emulators) down, resets all state, and relaunches the same session automatically. No manual re-running, no clearing the terminal.
- **`Q` — Exit**: gracefully terminates every child process (dev server, emulators) and quits.

If the default app port 3000 is taken, launch with another one: `PORT=3001 npm start` (PowerShell: `$env:PORT='3001'; npm start`).

### All npm scripts

| Command | Purpose |
|---|---|
| `npm start` | **Interactive dev console** (menu above, with Start Over / Exit) |
| `npm run dev` | Dev server only, against **live Firebase** (`.env.local`), at http://localhost:3000 |
| `npm run dev:emulators` | Dev server only, in **emulator mode** (expects emulators already running) |
| `npm run emulators` | Firebase Local Emulator Suite only (Auth + Firestore + Emulator UI) |
| `npm run seed:admin` | Creates the local admin account in the running emulators |
| `npm run test:backend` | **Backend verification suite** — 24 end-to-end checks (starts/stops emulators automatically) |
| `npm run lint` | Type-checks the entire project (`tsc --noEmit`) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the production build locally (for pre-deployment smoke tests) |
| `npm run clean` | Deletes `dist/` (cross-platform) |

### First-run smoke test

1. `npm start` → choose **[1]** — emulators boot, the admin account is seeded, the dev server starts. No Firebase project or credentials needed.
2. Open http://localhost:3000 → **Sign Up** with any email/password → you land in the Student Portal.
3. **Start Self-Enrollment** → fill the form, upload any photo → an ID card with a QR code is rendered.
4. Open http://localhost:3000/scanner (or click *Verify* in the navbar) and scan the card's QR from another screen, or simply open `http://localhost:3000/verify/<REG-NUMBER>` — the verification page shows the student's record and status.
5. Open http://localhost:4000/firestore — the record you just created is visible in the **Emulator UI**.
6. Press **`R`** in the terminal to start over, or **`Q`** to exit.

---

## 8. Local Development with the Firebase Emulator Suite

Development runs **fully offline** against the [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite) — no production project is needed or touched.

### How it is wired

- `npm start` → option **[1]** (or `npm run emulators` + `npm run dev:emulators` manually) starts:
  - **Auth emulator** on port `9099`
  - **Firestore emulator** on port `8181`
  - **Emulator UI** on port `4000` — browse/edit Firestore documents and Auth users live
- In emulator mode Vite loads [.env.emulators](.env.emulators), which sets `VITE_USE_FIREBASE_EMULATORS=true` and a **`demo-` project ID**. `src/lib/firebase.ts` sees the flag and calls `connectAuthEmulator` / `connectFirestoreEmulator`. Firebase treats `demo-*` projects as strictly offline, so **development data can never reach a real Firebase project** — even accidentally.
- The emulators enforce the same [firestore.rules](firestore.rules) as production, so permission behavior is identical.
- The emulators listen on all interfaces and the app derives the emulator host from the page URL, so opening the app **from a phone on the same network** works too.
- Emulator data is in-memory: **Start Over** (`R`) or restarting the emulators resets the database to a clean slate (the admin account is re-seeded automatically).

Ports are configured in [firebase.json](firebase.json); if you change them, update `src/lib/firebase.ts` and `scripts/emulator-utils.mjs` to match.

> **Windows note:** firebase-tools occasionally fails to terminate the Java Firestore emulator on shutdown, which would leave port 8181 taken. The dev console and `npm run test:backend` detect and clean up such orphaned processes automatically.

---

## 9. Administrator Credentials

### Local development (emulators)

A ready-to-use administrator is seeded automatically when you start via `npm start` → **[1]** (or manually with `npm run seed:admin`):

| | |
|---|---|
| **Email** | `admin@coou.edu.ng` |
| **Password** | `Admin123!` |

Log in with these credentials → you land on the **Admin Dashboard**.

### Production

Admin access is granted by an **email allow-list** — there is no separate admin signup flow. The list lives in **two places that must stay in sync**:

1. [src/AuthContext.tsx](src/AuthContext.tsx) — assigns the role on signup/login:

   ```ts
   const INITIAL_ADMINS = ['nonyeasuzu3@gmail.com', 'admin@coou.edu.ng'];
   ```

2. [firestore.rules](firestore.rules) — `isAdminEmail()` **enforces** the same list server-side, so a modified client cannot self-promote.

To add an administrator: add the email to both files, rebuild/redeploy the app, republish the rules ([section 6.4](#64-security-rules)), then **sign up (or log in) with that exact email**. The account's profile is created — or automatically upgraded on next login — with `role: 'admin'`, and the **Admin Dashboard** appears at `/`: full search, enroll, edit, suspend, and delete over all student records. Non-admin users see only their own student portal, and the security rules block them from writing other students' records or reading other profiles.

To grant `staff` (dashboard access without the admin badge), add the email to both allow-lists as above but set the user's `role` field to `"staff"` in the Firestore `profiles` collection.

---

## 10. Backend Verification Suite

`npm run test:backend` (or `npm start` → **[3]**) runs **24 automated end-to-end checks** against the emulator-backed Firestore — the exact reads/writes the app performs, plus adversarial cases:

1. **Account registration** — Auth signup, profile document persistence.
2. **Enrollment** — the student record is written with the full data-model structure and exact values, is immediately queryable, and duplicate registration numbers are detectable.
3. **QR verification** — the QR payload round-trips to the right document ID; an **unauthenticated** client (a phone that scanned the code) resolves the record; Student A's QR yields only Student A; unknown IDs report "not found" without crashing.
4. **Administrator** — admin credentials authenticate, the allow-listed email may hold the admin role, admin can enroll/update/list/delete any student.
5. **Role-based access control** — unauthenticated writes are rejected; a student cannot overwrite or delete another student's record, cannot self-promote to admin, and cannot read another user's profile.
6. **Deletion lifecycle** — deleted records immediately fail verification gracefully.

The suite exits non-zero on any failure, so it can be used in CI. If the emulators are already running it reuses them; otherwise it starts and stops them automatically.

---

## 11. QR Code Verification — How It Works

- Every enrolled student's ID card embeds a QR code (`qrcode.react`, error-correction level **H**) encoding:

  ```
  <VITE_APP_BASE_URL or current origin>/verify/<url-encoded registration number>
  ```

  Registration numbers are unique (enrollment refuses a number already registered to a different account), so every card's QR code is unique.

- **Scanning with any standard phone camera** opens the public `/verify/:id` page, which looks the record up live in Firestore and displays: full name, registration/ID number, department, level, **verification status** (Active / Suspended / Graduated — with distinct banner colors), photo, blood group, date of birth, and contact.

- **Scanning with the in-app scanner** (`/scanner`, public, no login required) accepts both full verification URLs and raw registration numbers, and shows the same registry data inline.

- **Error handling:** an unknown/invalid/deleted ID shows a "Verification Failed / record not found" page; suspended records are clearly flagged as **not valid**; network failures show a connection error with a retry option.

- **Testing QR codes from a real phone during development:** the dev console (`npm start`) automatically points QR codes at this machine's LAN address (e.g. `http://192.168.x.x:3000`) when `VITE_APP_BASE_URL` is not set, and both the dev server and the emulators listen on all interfaces — so a phone on the same Wi-Fi can scan a card rendered on your desktop and load the verification page end-to-end.

- **Deployment requirements for QR codes to keep working** (both covered by this repo / docs):
  1. The host must rewrite all paths to `index.html` (see [Deployment](#12-deployment)) so `/verify/...` deep links don't 404.
  2. Set `VITE_APP_BASE_URL` to the production URL before building, so cards always encode the live domain.

---

## 12. Deployment

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
npx firebase login
npx firebase init hosting   # public directory: dist, configure as SPA: Yes
npm run build
npx firebase deploy --only hosting
```

The "configure as SPA" answer writes the required rewrite into `firebase.json`.

### Any other static host / nginx

```nginx
location / {
  try_files $uri /index.html;
}
```

---

## 13. Troubleshooting

| Symptom | Cause & fix |
|---|---|
| Login/signup fails with `auth/invalid-api-key` or a blank page with console errors about Firebase | In live mode: `.env.local` missing or has placeholder values — fill in real values and **restart the dev server**. Or simply develop against the emulators (`npm start` → **[1]**), which needs no credentials. |
| `auth/operation-not-allowed` on signup | Email/Password provider not enabled — see [6.2](#62-enable-authentication). (Not applicable in emulator mode.) |
| `auth/unauthorized-domain` on the deployed site | Add the domain under Firebase Auth → Settings → Authorized domains. |
| `Missing or insufficient permissions` (Firestore) | Security rules not published or too strict — publish [firestore.rules](firestore.rules), see [6.4](#64-security-rules). Also occurs legitimately when a non-admin attempts an admin operation. |
| Scanned QR code opens a 404 | The host is not rewriting routes to `index.html` — see [Deployment](#12-deployment). |
| Scanned QR opens `http://localhost:3000/...` | The card was generated from a build without `VITE_APP_BASE_URL`. Set it and rebuild; the card view re-renders the QR from live data, so no data fix is needed. (The dev console auto-substitutes your LAN IP during development.) |
| In-app scanner camera never starts | Browsers only expose the camera on **HTTPS or localhost**. Test on `localhost` or the deployed HTTPS site, and accept the camera permission prompt. |
| "This Registration Number is already registered to another account" | Registration numbers are unique document IDs. Use the correct number, or have an admin delete/edit the conflicting record. |
| `Failed to save student record ... document exceeds maximum size` | Firestore documents max out at ~1 MB and passport photos are stored inline as base64. Upload a smaller photo (the app already compresses to 400px wide, but extremely large originals can still fail). |
| Port 3000 already in use | The dev console detects this and tells you; launch with `PORT=3001 npm start` (PowerShell: `$env:PORT='3001'; npm start`) or stop the other process. |
| Emulator fails to start: "port taken" (8181/9099) | Usually an orphaned emulator from a previous run — `npm start` and `npm run test:backend` clean these up automatically. If it persists, another app owns the port: change the ports in [firebase.json](firebase.json) (and the matching constants in `src/lib/firebase.ts` / `scripts/emulator-utils.mjs`). |
| Firestore emulator fails to start mentioning Java | Install Java 11+ (https://adoptium.net) — the Firestore emulator runs on the JVM. |
| Admin sees the student portal instead of the dashboard | The logged-in email is not in `INITIAL_ADMINS` (exact match, case-sensitive as typed). Add it to **both** `src/AuthContext.tsx` and `firestore.rules`, rebuild, log out and back in. |

---

## 14. Assumptions, Limitations & External Services

**External services (the only one):**
- **Firebase** (Auth + Cloud Firestore) — and only in production; local development runs entirely on the offline Emulator Suite. Free Spark plan suffices for moderate usage. No other APIs, servers, or databases are required.

**Assumptions:**
- Registration numbers are unique per student and are entered correctly at enrollment (they become the record's identity and the QR payload).
- Verification pages are intentionally public (no login) so any scanner can validate an ID.

**Known limitations:**
- Passport photos are stored as base64 strings inside Firestore documents (~1 MB document cap) rather than in Cloud Storage.
- The admin allow-list is duplicated between `src/AuthContext.tsx` (role assignment) and `firestore.rules` (enforcement) and the two must be kept in sync. For a higher-assurance deployment, migrate to Firebase custom claims set via the Admin SDK.
- Academic level is derived from admission year with hardcoded year thresholds in `src/lib/utils.ts` (`calculateLevel`) — update these each academic session.
- Students can self-enroll with any registration number that is not already taken; there is no cross-check against an official registry import.
- Automated coverage is the backend verification suite ([Section 10](#10-backend-verification-suite)) plus type-checking; there are no UI/component tests yet.
