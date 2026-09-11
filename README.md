# PUNKTURE STUDIOS — SYSTEM ARCHITECTURE & SOURCE OF TRUTH

**Current booking environment:** Worker launch flag is enabled for acceptance testing, with `PAYMONGO_LIVE=false` enforced. Required secret names are present; their presence is not proof of valid credentials or email delivery. This is not production payment readiness. Set `BOOKING_LAUNCH_READY=false` to pause new checkout creation after testing. Actual payment, webhook and inbox acceptance remain pending.

> 🤖 **MANDATORY AI AGENT DIRECTIVE (TOKEN ECONOMY & SYSTEM BIBLE)**:
> This `README.md` is the **Single Source of Truth (SSOT)** for the entire repository.
>
> 1. **Read this file first** to immediately understand the full architecture, schema contracts, directory layout, and invariants without burning context tokens on exploratory file searches.
> 2. **MANDATORY UPDATE PROTOCOL**: Whenever any AI makes architectural changes, adds/modifies components, updates Zustand state actions, modifies database tables/models, adjusts Firestore rules, or alters public routes, **YOU MUST UPDATE THIS `README.md` BEFORE ENDING YOUR TASK/SESSION**.
> 3. Keeping this file accurate guarantees that future AI sessions with zero prior memory immediately understand the system at minimal token cost.

---

## 1. System Overview & Core Philosophy

**Punkture Studios** is an offline-first piercing queue, POS, and appointment booking ecosystem built for a sterile, minimalist body piercing studio based in the Philippines.

The application is architected with a strict **dual-surface separation**:
1. **Local Staff Cashier & Queue Tool**:
   - Private desktop/tablet operational application.
   - Runs strictly on **`http://localhost:5174`** using **Dexie (IndexedDB)**.
   - Fully operational offline. Mutates local storage first; synchronizes bidirectionally with Firebase Firestore in the background when online.
   - **CRITICAL**: The staff app is **NEVER** built or hosted on Firebase Hosting. `index.html` is intentionally excluded from the Vite build rollup.
2. **Public Customer Portal (7 Multi-Page Web Applications)**:
   - Hosted on Firebase Hosting at the production domain.
   - Built with Vite and Tailwind CSS 4 as a multi-page application with 7 independent HTML entries.
   - Connects directly to Firestore to display live queue status, pop-up events, studio schedules, and uses a separate Cloudflare Worker/D1 backend for paid appointments.

---

## 2. Tech Stack & Dependencies

| Layer | Technologies | Key Packages & Versions |
| --- | --- | --- |
| **Framework & UI** | React 19, TypeScript strict mode, Tailwind CSS v4 | `react@^19.2`, `react-dom@^19.2`, `@tailwindcss/vite@^4.3` |
| **State Management** | Zustand | `zustand@^5.0` |
| **Local Database** | Dexie.js (IndexedDB wrapper) | `dexie@^4.4` |
| **Icons & Visuals** | Lucide React | `lucide-react@^1.31` |
| **Cloud & Backend** | Firebase Authentication, Cloud Firestore | `firebase@^12.18` |
| **Bundler & Tooling** | Vite 8, Oxlint, TypeScript 6 | `vite@^8.2`, `oxlint@^1.75`, `typescript@~6.0` |
| **Testing** | Node.js Test Runner, fake-indexeddb, JSDOM, Firebase Rules Unit Testing | `@firebase/rules-unit-testing@^5.0`, `fake-indexeddb@^6.2`, `jsdom@^30.0` |

---

## 3. Quick Start & Developer Commands

Use **Node.js 24+** and **npm**. Firestore emulator checks also require **Java 21+** on PATH. On Windows PowerShell, use `npm.cmd` if execution policies restrict `.ps1`.

```sh
# Install dependencies
npm ci

# Start local staff cashier + dev server (PINNED to port 5174)
npm run dev

# Run unit and integration tests (tests covering payment backend, db, store, components, and sync)
npm test

# Lint codebase (Oxlint)
npm run lint

# Build production bundle (7 public pages only)
npm run build

# Run Firestore security rules test suite (uses local Firestore emulator at 127.0.0.1:8180)
npm run test:rules

# Deploy public pages and Firestore rules to Firebase Hosting manually
npm run firebase:login
npm run deploy
```

### Terminal setup on this Mac

The default terminal runtime is Node 22, which fails parts of the test suite. From this repository, run `source scripts/use-local-tools.sh` before the commands above. It selects the existing bundled Node 24 and, when present, the temporary Java 21 test runtime and reuses the project CLI download cache for the current terminal only. It does not install software or change your shell profile. Repeat in each new terminal. `.nvmrc` also specifies Node 24 for users of nvm. Other machines need their own Node 24+ and Java 21+ installation.

Cloudflare setup is separate from local validation. `backend/wrangler.jsonc` now contains the verified ID of the existing `punkture-booking` D1 database (checked 2026-09-11); the previous placeholder prevented remote setup. Firebase and Cloudflare logins are present on this Mac. The remote database had zero tables at inspection. Wrangler 4.131.0 deployment dry-run and the 16-command D1 migration on a disposable local database passed; remote migration and publishing remain separate from local checks. See the runbook's command troubleshooting section.

### Automated CI/CD (GitHub Actions)
A workflow is configured in `.github/workflows/deploy.yml`. On every `git push origin main`, GitHub Actions automatically:
1. Runs `npm run lint` and `npm test` (all tests must pass).
2. Runs `npm run build` to compile the 7 public customer pages.
3. Automatically deploys the public pages to **Firebase Hosting** and updates **Firestore Security Rules**.
*(Requires adding `FIREBASE_TOKEN` via `npx firebase login:ci` or `FIREBASE_SERVICE_ACCOUNT` into GitHub Repository Secrets).*

> [!IMPORTANT]
> **PINNED PORT 5174**: The staff cashier must always be served at `http://localhost:5174`. IndexedDB storage is strictly scoped per origin (`protocol + domain + port`). If Vite were to switch to port 5175, it would open a completely blank database, making history and active queues appear wiped out. `strictPort: true` is configured in `vite.config.ts`.

---

## 4. Repository Directory Map

```text
PunktureStudios/
├── .agents/rules/              # Agent directives and documentation maintenance rules
├── scripts/
│   └── run-rules-tests.cjs     # Firestore security rules test runner with emulator
├── tests/
│   ├── components.test.mjs     # React component unit tests (AppointmentPage, PublicSettingsView, etc.)
│   ├── firestore.rules.mjs     # Cloud Firestore security rules assertion suite
│   ├── sync.test.mjs           # Offline-first sync & tombstone resurrection test suite
│   ├── system.test.mjs         # IndexedDB, queue ordering, and backup/restore tests
│   └── register.mjs            # Test setup & loaders
├── public/                     # Static assets (favicons, logos, manifests)
│   └── logo.png
├── index.html                  # Local Staff Application HTML entry (NOT built for production)
├── home.html                   # Public: Main Studio Landing Page
├── live.html                   # Public: Live Queue Monitor
├── popup.html                  # Public: Pop-up Event Details & Schedule
├── appointment.html            # Public: 3-Step Studio Booking Wizard
├── waiver.html                 # Public: Digital Health & Safety Waiver
├── aftercare.html              # Public: Piercing Aftercare & LITHA Guide
├── privacy.html                # Public: Data Privacy Policy (RA 10173)
├── backend/                    # Cloudflare Worker, D1 migration and deployment config
├── docs/booking-workflow.md     # Payment rollout, assumptions, test and operations runbook
├── firestore.rules             # Production security rules for Firestore
├── firebase.json               # Firebase Hosting & Emulator configuration
├── vite.config.ts              # Vite multi-page config, port 5174 pin, Tailwind CSS 4
└── src/
    ├── main.tsx                # Entry point for Staff Application (mounts App.tsx)
    ├── App.tsx                 # Staff App root layout (QueueBoard + Workspace / PublicSettings)
    ├── home.tsx                # Entry point for home.html
    ├── live.tsx                # Entry point for live.html
    ├── popup.tsx               # Entry point for popup.html
    ├── appointment.tsx         # Entry point for appointment.html
    ├── waiver.tsx              # Entry point for waiver.html
    ├── aftercare.tsx           # Entry point for aftercare.html
    ├── privacy.tsx             # Entry point for privacy.html
    ├── bookingApi.ts           # Public Worker client and disclosed fee policy
    ├── constants.ts            # POP-UP piercing catalog, add-on services catalog, jewelry upgrades
    ├── dataLock.ts             # Mutex lock (`withDataLock`) serializing local IndexedDB transactions
    ├── db.ts                   # Dexie database definitions, ticket number generator, deletion log
    ├── firebase.ts             # Firebase app client initialization
    ├── index.css               # Design tokens, custom utility animations, font variables
    ├── queue.ts                # Queue sorting and contiguous sequence normalization logic
    ├── store.ts                # Zustand centralized store for staff state and actions
    ├── sync.ts                 # Firestore synchronization engine, heartbeat, tombstones
    ├── timeEstimate.ts         # Waiting time estimation algorithms
    ├── types.ts                # Core TypeScript interfaces (Ticket, PiercingItem, PublicSettings)
    ├── validation.ts           # Input sanitization, CSV escaping, Manila timezone validations
    ├── waiverContent.ts        # Bilingual (EN/Fil) waiver copy shared by /waiver.html & booking modal
    └── components/
        ├── AddPiercingPanel.tsx       # Staff placement & add-on service selector (pop-up rates)
        ├── AftercarePage.tsx          # Bilingual aftercare guide component
        ├── AppointmentPage.tsx        # 3-step interactive booking funnel with calendar
        ├── BreakdownModal.tsx         # Detailed price/item breakdown modal
        ├── CalendarPicker.tsx         # Reusable calendar component
        ├── DataTools.tsx              # Backup import/export (v2 JSON) and CSV download
        ├── EarningsDashboard.tsx      # Revenue totals (Day, Month, All-Time)
        ├── HistoryView.tsx            # Historical ticket ledger, reopen ticket, reset #1
        ├── HomePage.tsx               # Public landing page with hero, ethos, and dynamic cards
        ├── ItemsList.tsx              # Active order item list with inline adjustments
        ├── LiveQueuePage.tsx          # Public real-time queue display with heartbeat check
        ├── PiercingRitualAnimation.tsx# Visual animation feedback during active sessions
        ├── PopupEventPage.tsx         # Next pop-up event details, venue map, and checklists
        ├── PrivacyPage.tsx            # Data handling & compliance details
        ├── PublicSettingsView.tsx     # Staff online schedule controls, slots, and booking management
        ├── PublicShell.tsx            # Shared header, navigation drawer, and footer for public pages
        ├── QueueBoard.tsx             # Staff left column (Waiting queue, Next button, Tabs)
        ├── ritualConfig.ts            # Animation timing configurations
        ├── SyncPanel.tsx              # Staff cloud login bar, status, and manual sync button
        ├── TicketCard.tsx             # Individual ticket card with drag-and-drop handles
        ├── TicketWorkspace.tsx        # Staff right column workspace for selected ticket
        ├── WaitingQueueList.tsx       # Reorderable waiting ticket queue with drag & keyboard support
        ├── WaiverPage.tsx             # Bilingual health & safety waiver / consent gate
        ├── WorkspaceHeader.tsx        # Ticket header with Call, Start, Finish, and Cancel actions
        └── booking/                   # Visual booking subsystem
            ├── PaymentStatus.tsx    # Verified payment / expiry / review / receipt screen
            ├── PaidBookingsView.tsx # Local staff payment ledger and notification issues
            ├── BodyDiagram.tsx        # Interactive SVG diagram for body placements (Navel, Nipple)
            ├── BookingCartBar.tsx     # Floating booking cart with live cost estimate & proceed action
            ├── EarDiagram.tsx         # Interactive SVG diagram for ear placements (Lobe, Helix, etc.)
            ├── FaceDiagram.tsx        # Interactive SVG diagram for facial placements (Nostril, Septum, etc.)
            ├── PiercingSpotModal.tsx  # Placement detail modal (pain level, healing, upgrades, side)
            ├── WaiverReviewModal.tsx  # Step-3 consent modal mirroring waiver page content
            └── types.ts               # Hotspot coordinates, healing notes, and catalog definitions
```

---

## 5. Surface 1: Staff Cashier Application (Local Offline-First)

### Workflow & Lifecycle
1. **Add Ticket**: Enter client name and optional notes. Creates ticket with status `waiting`.
2. **Reordering Queue**: Drag cards or press **Alt+Up / Alt+Down** while focused on a waiting ticket. Rearranging updates `queueOrder` across all waiting cards.
3. **Call Client**: Marks status as `called`. Only **ONE** active session (called or in-progress) is allowed at any time.
4. **Order Assembly**: Add piercing placements, standalone jewelry items, or add-on services (`PiercingItem`). Initial jewelry material options: Free Stainless Studs, +50 Rhinestone Stainless, 150/200 Titanium. Set member discounts and quantities.
5. **Start Piercing**: Advances status to `in_progress`.
6. **Finish / Checkout**: Confirms payment and completion. Marks status as `finished`. Jewelry-only purchases do not require a piercing session.
7. **Cancel Options**:
   - **Cancel Session**: Returns ticket to the front of the waiting queue.
   - **Cancel Ticket**: Terminates the ticket as `cancelled`.

### Rate Cards: Pop-Up vs Studio
The studio operates **two rate cards** that are hard-split by surface:
- **Staff Cashier** — the placement chips in `AddPiercingPanel.tsx` (data: `PLACEMENTS` in `src/constants.ts`) always use **Pop-Up rates**.
- **Public Booking** — the `appointment.html` wizard (data: hotspots in `src/components/booking/types.ts`) always uses **Studio rates**.
Placements added in the latest rate sheet that are not drawn on the booking diagrams are deliberately **not** added as new graphic hotspots — clients request them through the **Custom Piercing** flow instead.
**Add-on services** (`OTHER_SERVICES` in `src/constants.ts`: Downsizing, Upsizing, Jewelry Installation/Removal, Piercing Cleaning, Aftercare Solution) appear in both surfaces:
- Staff cashier → the **🧰 SERVICES** tab inside `AddPiercingPanel.tsx`.
- Public booking → the **Others** tab, placed immediately before **Custom Piercing**.
Tier wording: **"My Work"** = the piercing/jewelry was originally done at Punkture (lower tier); **"Not My Work"** = done elsewhere. **"from"** prices (e.g. Jewelry Removal) are starting rates confirmed at checkout. Embedded removal is recorded at its ₱100 floor.

### Concurrency & Data Locking (`src/dataLock.ts`)
Local IndexedDB transactions are protected by `withDataLock<T>()`. Multiple tabs open in the same browser will not interleave or corrupt ticket numbers or queue orders. Network sync writes run asynchronously without freezing cashier UI edits.

### Reset #1, Archive & Renumbering
- Clicking **Reset #1** archives finished and cancelled tickets (sets `archivedAt`), while preserving unarchived waiting tickets in their exact order and renumbering them starting from 1.
- Archived tickets remain accessible in the **History** tab and contribute to historical revenue reports.
- Reopening an archived ticket allocates a fresh ticket number to avoid ID or display collisions.

### Backups & Data Portability
- **Format**: JSON backup payload (schemaVersion: 2) containing `tickets`, `items`, `ticketCounter`, and `settings`.
- **Restore Behavior**: Completely replaces local storage and, if connected to the cloud, **replaces the station's cloud documents**. Records missing from the backup are converted into cloud tombstones (`deleted: true`) so old records are not resurrected.
- **CSV Export**: Sanitizes client-entered fields against formula injection (prepends apostrophe to `=`, `+`, `-`, `@`). Sum `Line Total` rather than `Ticket Total` for accurate item-based revenue reporting.

---

## 6. Surface 2: Public Customer Web & Booking Funnel

The public surface comprises **7 dedicated pages** wrapped in a unified layout component (`PublicShell.tsx`):

| Page | URL | Description |
| --- | --- | --- |
| **Home** | `/home.html` | Studio landing page. Shows active pop-up banner or home studio address, brand ethos, and service cards. |
| **Live Queue** | `/live.html` | Real-time queue monitor for pop-up attendees. Displays currently called ticket and waiting queue. |
| **Next Pop-up** | `/popup.html` | Dedicated event information page with venue details, map link, hours, and attendee checklist. |
| **Appointment** | `/appointment.html` | 3-step visual booking wizard for home studio appointments. |
| **Waiver** | `/waiver.html` | Bilingual (English/Tagalog) paperless health & consent waiver with interactive checklist. |
| **Aftercare** | `/aftercare.html` | Bilingual aftercare protocol (LITHA, sterile saline routine, normal symptoms, things to avoid). |
| **Privacy** | `/privacy.html` | Legal disclosure and Philippine Data Privacy Act of 2012 (RA 10173) compliance information. |

### Interactive 3-Step Booking Wizard (`src/components/AppointmentPage.tsx`)
1. **Step 1: Placement Selection**:
   - Visual diagrams: Ear (`EarDiagram.tsx`), Face (`FaceDiagram.tsx`), and Body (`BodyDiagram.tsx`).
   - Interactive hotspot modal (`PiercingSpotModal.tsx`) showing pain levels, healing times, side picker (Left/Right/Both), and jewelry upgrades.
   - The old **Custom Piercing** tab was removed — placements not shown on the diagrams are handled directly with the studio.
   - **Others tab** (last tab; Aftercare Solution pinned at the top): add-on services — Downsizing / Upsizing / Jewelry Installation & Removal (My Work vs Not My Work tiers), Piercing Cleaning (per ear), and Aftercare Solution. Estimated totals are added to the same floating cart.
   - Per-placement initial-jewelry rules on the booking modal (hotspot `jewelryPrices`): Navel = free stainless studs only; Floating Navel = +200 tier only; Rook = 150 titanium only (no rhinestone). The staff cashier is unaffected.
   - Sticky / Floating cart (`BookingCartBar.tsx`) calculating running estimated totals.
2. **Step 2: Schedule & Slots**:
   - Dynamic date chip selector reflecting studio scheduling settings from Firestore (`public/public`).
   - Respects studio operating days (`bookingDays`), time slots (`bookingSlots`), advance notice (`bookingNoticeDays`, default 1 day), and blackout dates (`blockedDates`).
3. **Step 3: Contact Details & Submission**:
   - Customer name, required confirmation/receipt email, contact number / social handle, and optional notes.
   - Submit opens the shared health waiver plus explicit **PHP 100.00 reservation deposit** policy. Consent is required before backend checkout creation.
   - The owner specifies a PHP 100.00 advance deposit deducted from the final total, not an additional charge. Staff must verify the payment reference and collect only the remaining balance; automatic POS deposit redemption is not implemented. Studio absorbs PayMongo transaction fees (explicitly accepted by the owner).
   - New bookings go exclusively through `src/bookingApi.ts` → Cloudflare Worker/D1. No frontend Firestore booking writes or manual confirmation bypass.
   - Availability polls every 10 seconds; taken, expired/past, and unavailable-to-verify slot buttons are disabled. Date changes clear the selected time. Backend always revalidates schedule and locks the slot atomically.
   - After consent, a 15-minute temporary hold and PayMongo hosted checkout are created. The payment/status page is on the same `/appointment.html` entry using a private URL fragment. `creating`, `pending`, failed attempt, `confirmed`, `expired`, `payment_review`, and `cancelled` states are server-driven. A success redirect alone never confirms.
   - Notes, including the selected-service estimate, are truncated to 300 characters. This estimate is informational; backend amount is always 10000 centavos.

### Verified payment backend (`backend/worker.mjs`)

Cloudflare **Workers Free + D1 Free** handles checkout creation, atomic slot ownership, raw-body signed PayMongo webhooks, server-side checkout retrieval, expiry and notification retries. No Firebase Functions/Blaze plan is used. PayMongo processing fees apply; no paid service subscription is introduced. Gmail + Google Apps Script MailApp sends customer confirmation/receipt and admin email without buying a domain. The sender is the Google account deploying `backend/apps-script/Code.gs`; a private Google Sheet records delivery intent/status. Personal accounts have a shared 100-recipient/day script quota (about 50 bookings/day before other notices). See [Gmail setup](docs/gmail-setup.md). Resend is no longer required.

**D1 is the source of truth for new bookings**; Firestore `appointments` is a legacy collection. Schema is `backend/migrations/0001_booking.sql`:

| Table | Contract |
| --- | --- |
| `bookings` | Private name/email/contact/notes, Manila date/time, `requestedFor`, policy consent snapshot, token hash/request hash, timestamps, checkout/payment references, fixed 10000-centavo (PHP 100.00) amount, status and safe error code. Partial unique `(date,time)` index for creating/pending/confirmed. Unique session/payment IDs. |
| `legacy_holds` / `deployment_checks` | Staff-imported future legacy requested/confirmed slots; SQL insertion guard prevents new payments for these slots. Completed migration is mandatory before launch. |
| `webhook_events` | Unique event ID, booking ID and time, for idempotent processing. |
| `outbox` | Transactionally created customer/admin notification jobs on confirmation/review/cancellation. Independent leases, attempts/backoff, provider IDs and review state. |
| `audit` / `rate_limits` | Verification/cancellation/migration audit trail and temporary hashed-IP hourly attempt counters. |

Only secret-key verified PHP 100.00 payments can confirm an active hold. Verification after expiry becomes **payment_review** and never takes another booking's slot. Expiry is enforced on API reads/creates and cron so provider failures do not hold slots forever. Cron also retrieves unpaid pending/recent expired sessions for missed-webhook recovery. No automatic refund/rescheduling is claimed.

Customer/admin emails include acknowledgement receipt details after verification, with an additional PayMongo receipt enabled. Provider acceptance is distinguished from actual inbox delivery. The Worker signs messages with `GMAIL_SCRIPT_SECRET` and posts to `GMAIL_SCRIPT_URL` (/exec). A script lock and private sheet deduplicate stable job IDs. Quota exhaustion remains pending and retries after six hours. Ambiguous sends become `needs_review` to avoid blindly sending twice; there is no 23-hour cutoff. The existing D1 outbox schema is unchanged. Required mail configuration is GMAIL_SCRIPT_URL, GMAIL_SCRIPT_SECRET and ADMIN_EMAIL; sender identity comes from Google, not EMAIL_FROM.

`PaidBookingsView` in local staff settings shows paid bookings, gross reservation collections (separate from cashier revenue), late-payment and notification issues, legacy hold import, and cancellation. Staff authorization uses existing Firebase ID tokens + enabled staff registry. Clients cannot manually mark payments paid. The receipt is not represented as a tax invoice.

**Local verification (2026-09-10):** 44 application/backend tests and 11 Firestore emulator tests passed; lint and production build passed. External PayMongo/Resend and deployed Cloudflare/browser acceptance remain untested until studio accounts are configured. Gmail migration adds local script/Worker tests; actual Gmail inbox acceptance is still required.

**Gmail migration (2026-09-11):** `backend/gmail.mjs` and `backend/apps-script/Code.gs` replace Resend. Follow [docs/gmail-setup.md](docs/gmail-setup.md) before enabling bookings. Privacy disclosure includes Google Apps Script and the private delivery ledger. No domain purchase, paid subscription, or new D1 migration is needed. All 51 local tests, lint, production build, and Wrangler deployment dry-run passed. Google authorization/deployment and actual inbox delivery remain untested; the Gmail Worker update has not been published.

**Deployment, exact affected-page list, assumptions, test steps, failure recovery and free-tier limits:** [docs/booking-workflow.md](docs/booking-workflow.md). Configure `backend/wrangler.jsonc`, Worker secrets and public-only `VITE_BOOKING_API_URL` from `.env.example`. Public booking fails closed until launch configuration and legacy import are complete. Existing Firebase CI deploys frontend/rules only; Worker deployment is separate.

**Deployment correction (2026-09-11):** Live Firebase rules still lacked the own-staff-record read required by Worker authorization, causing admin booking/import 403 responses despite an enabled staff record. After 51 application tests, lint, build and 11 emulator rules tests passed, the current `firestore.rules` was successfully deployed to `punkture-studios`. This also disables legacy direct appointment creation/confirmation. The user has deployed the Gmail Worker; authenticated browser retry, legacy import and actual payment/email acceptance remain pending.

---

## 7. Cloud Backend, Firestore Rules & Sync Engine

### Firebase Configuration & Security Rules (`firestore.rules`)
- **Staff Authentication**: Managed via Firebase Auth. Staff accounts are authorized by creating a Firestore document at **`staff/{UID}`** with `{ enabled: true }`. Clients cannot self-authorize.
- **Manila Timezone (UTC+8)**: Appointments strictly validate that the ISO date and time match the epoch millisecond `requestedFor` in Asia/Manila (+08:00).
- **Public Privacy Safeguards**:
  - `publicQueue` documents strip all customer names and notes; only `ticketNumber`, `status`, `position`, `seq`, and timestamps are exposed.
  - Public users cannot create, list or inspect Firestore appointments. Staff may read/cancel/delete legacy records, but cannot create or confirm them; new payments are backend-only.

### Firestore Collections Contract

| Collection / Path | Read Permission | Write Permission | Contents / Notes |
| --- | --- | --- | --- |
| `staff/{UID}` | Enabled staff can get their own entry only; no list | Console / Admin only | `{ enabled: true }` registry used by Worker authorization. Clients cannot self-authorize. |
| `tickets/{id}` | Staff only | Staff only | Private ticket data with client names, notes, and lifecycle timestamps. |
| `items/{id}` | Staff only | Staff only | Order line items, placements, upgrades, quantities, and prices. |
| `cloudControl/counter` | Staff only | Staff only | Ticket numbering counter `{ value: number }`. |
| `publicQueue/{id}` | Public | Staff only | Stripped public queue tickets (`waiting`, `called`, `in_progress`). |
| `public/public` | Public | Staff only | Studio profile, pop-up announcements, and booking rules (`bookingSlots`, `blockedDates`). |
| `public/heartbeat` | Public | Staff only | Server timestamp `{ publishedAt: request.time }`. |
| `appointments/{id}` | Staff only | Staff cancellation/delete only | Legacy requests. New creates and confirmation updates are denied; new bookings live in private D1. Import future legacy slot holds before enabling payments. |

### Sync Engine Protocol (`src/sync.ts`)
- **Conflict Resolution**: Last write wins determined by `updatedAt` (epoch milliseconds).
- **Deletion Tombstones**: Deleted tickets and items create a tombstone `{ id, deleted: true, updatedAt, writerId }` in Firestore. This prevents older offline replicas from resurrecting deleted records upon reconnection.
- **Heartbeat & Queue Liveness**: The active cashier publishes a heartbeat every 30 seconds. If no heartbeat is received for **90 seconds**, the public queue shows **"UPDATES PAUSED"** with the last known queue snapshot.

---

## 8. Invariants & Rules for AI Agents (Never Violate)

When modifying or extending this codebase, adhere strictly to these rules:

1. **NEVER host the Staff Application**: Do NOT add `index.html` to `rollupOptions.input` in `vite.config.ts`. The staff tool is an internal offline-first desktop application.
2. **DO NOT change port 5174**: Any change to port breaks IndexedDB access and creates an empty database.
3. **Max 1 Active Session**: The system allows only ONE called or in-progress ticket at a time. Never bypass this invariant.
4. **All Local Mutations must use `withDataLock`**: Always wrap IndexedDB updates in `withDataLock()` to prevent race conditions.
5. **Keep Firestore Rules in Sync with TypeScript**:
   - If adding a field to `tickets`, `items`, `publicQueue`, `appointments`, or `publicSettings`, update both `src/types.ts` AND `firestore.rules`.
   - Remember appointment notes are capped at 300 characters in `firestore.rules`.
6. **Timezone is always Asia/Manila (UTC+8)**: Booking dates, time slots, and schedule rules must use Manila timezone.
7. **Always verify tests & builds**:
   - Run `npm test` (all unit and integration tests must pass).
   - Run `npm run lint` (0 errors, 0 warnings).
   - Run `npm run build` (TypeScript check + Vite production bundle must succeed).
   - Run `npm run test:rules` when modifying Firestore rules.

**Staff settings refresh:** Local-only settings now places the page heading and booking overview before operations, with deposit guidance, customer preview and sidebar anchors. Bookings has gross collection/review summaries, manual refresh, search by name/email/date/ID and status filters over loaded records. Import feedback persists separately from load errors; older reservation safeguards are collapsible. Existing schedule and website save behavior is preserved. No payment mode switch or automatic POS deposit credit is implied.

**Settings public links:** The left sidebar is the single public-page link list. All seven links use absolute `https://punkture-studios.web.app/` URLs and show their destination. The duplicate booking preview card is removed; the staff app itself remains local-only.

## Multiple pop-up events

`PublicSettings.events` is an optional array of up to 12 entries with stable `id`, `eventDate` (YYYY-MM-DD), `eventTitle`, `eventHours`, `eventLocation`, `eventMapUrl`, and per-event `eventActive`. Settings supports adding, editing, publishing/unpublishing and removing entries before Save all changes. Title, real date and venue are required, even for saved drafts; map links must be HTTP(S).

`src/popupEvents.ts` migrates the legacy single event in memory only when `events` is absent. An explicit empty array means no events, preventing old data from reappearing. Local save, sync and backup validation preserve the list; Firestore rules restrict writes to staff and validate the bounded list. No IndexedDB version change is needed for the settings document.

Home and Live Queue feature the earliest published event on or after today's Manila date; the pop-up page lists all upcoming events when there are multiple. Only one event/venue is allowed per day; inclusive date ranges cannot overlap, including drafts. Past and draft events stay editable but are excluded from public selection on render. Published pop-up ranges automatically block new studio bookings, alongside manual blackout dates. Existing paid bookings are preserved and require staff review if a newly published event conflicts. Existing reservations, payments and receipts are unaffected. Deploy Firestore rules before saving the new list and deploy the public build for online customers to see multiple events.

**Pop-up date ranges:** Each event has a start `eventDate` and optional inclusive `eventEndDate` (omitted means a single day). The venue and hours apply to every date in that range. Settings and Firestore rules reject overlapping ranges and reversed dates. All public event labels show the range, and an ongoing event remains visible through its final day in Manila. Existing single-day records remain compatible.

Event arrays are saved in start-date order. Cloud rules require that order and compare adjacent inclusive ranges, keeping overlap enforcement within Firestore expression limits. Blank optional end dates are omitted before sync.

The Worker decodes nested Firestore event maps, rejects pop-up dates during checkout creation, and returns all configured slots unavailable on those dates. The customer calendar also disables these dates. Draft events do not block bookings; an explicit empty events list overrides legacy fields.
