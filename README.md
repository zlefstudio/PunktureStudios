# PUNKTURE STUDIOS — SYSTEM ARCHITECTURE & SOURCE OF TRUTH

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
   - Connects directly to Firestore to display live queue status, pop-up events, studio schedules, and accepts appointment booking requests.

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

Use **Node.js 24+** and **npm**. On Windows PowerShell, use `npm.cmd` if execution policies restrict `.ps1`.

```sh
# Install dependencies
npm ci

# Start local staff cashier + dev server (PINNED to port 5174)
npm run dev

# Run unit and integration tests (23 tests covering db, store, components, and sync)
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
   - Customer name, contact number / social handle, and optional notes.
   - The inline consent checkbox was removed: pressing **Submit** opens a waiver review modal showing the exact `/waiver.html` content (EN/Fil toggle, shared `src/waiverContent.ts`), with a consent checkbox. The appointment is only written to Firestore after the client ticks consent and presses **Confirm & Submit Appointment**.
   - Submits write-only appointment document to Firestore collection `appointments`.
   - Notes field automatically truncated to 300 characters to strictly satisfy Firestore security rule constraints.

---

## 7. Cloud Backend, Firestore Rules & Sync Engine

### Firebase Configuration & Security Rules (`firestore.rules`)
- **Staff Authentication**: Managed via Firebase Auth. Staff accounts are authorized by creating a Firestore document at **`staff/{UID}`** with `{ enabled: true }`. Clients cannot self-authorize.
- **Manila Timezone (UTC+8)**: Appointments strictly validate that the ISO date and time match the epoch millisecond `requestedFor` in Asia/Manila (+08:00).
- **Public Privacy Safeguards**:
  - `publicQueue` documents strip all customer names and notes; only `ticketNumber`, `status`, `position`, `seq`, and timestamps are exposed.
  - Public users can create appointments with status `requested` and `serverTimestamp()`, but cannot list, read, or inspect appointments.

### Firestore Collections Contract

| Collection / Path | Read Permission | Write Permission | Contents / Notes |
| --- | --- | --- | --- |
| `staff/{UID}` | Staff only | Console / Admin only | `{ enabled: true }` staff registry. |
| `tickets/{id}` | Staff only | Staff only | Private ticket data with client names, notes, and lifecycle timestamps. |
| `items/{id}` | Staff only | Staff only | Order line items, placements, upgrades, quantities, and prices. |
| `cloudControl/counter` | Staff only | Staff only | Ticket numbering counter `{ value: number }`. |
| `publicQueue/{id}` | Public | Staff only | Stripped public queue tickets (`waiting`, `called`, `in_progress`). |
| `public/public` | Public | Staff only | Studio profile, pop-up announcements, and booking rules (`bookingSlots`, `blockedDates`). |
| `public/heartbeat` | Public | Staff only | Server timestamp `{ publishedAt: request.time }`. |
| `appointments/{id}` | Staff only | Public (Create only), Staff (Update/Delete) | Customer booking requests. Rules require future dates within 366 days, Manila timezone, status `requested`, notes <= 300 chars. |

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
   - Run `npm test` (all 23 unit tests must pass).
   - Run `npm run lint` (0 errors, 0 warnings).
   - Run `npm run build` (TypeScript check + Vite production bundle must succeed).
   - Run `npm run test:rules` when modifying Firestore rules.

