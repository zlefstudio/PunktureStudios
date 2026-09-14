# PUNKTURE STUDIOS — SYSTEM ARCHITECTURE & SOURCE OF TRUTH

**Current booking environment (2026-09-14 — LIVE, QR Ph, first real payment verified):** Worker `punkture-booking` runs `PAYMONGO_LIVE=true` against a **verified but unregistered (Individual)** PayMongo account, so `PAYMENT_METHODS=qrph` only: PayMongo restricts direct Cards/GCash/Maya/GrabPay/ShopeePay/online-banking channels to registered business types (DTI/SEC), while an Individual account can accept **QR Ph** — payable from GCash, Maya, ShopeePay, GrabPay and participating bank apps — at the cheapest rate, 1.34% (PHP 1.34 on the PHP 100.00 deposit) versus GCash 2.23% and cards 3.125% + PHP 13.39. The live secret key and the live webhook signing secret are Worker secrets, never in the repo or a `VITE_` variable. **Verified end-to-end on 2026-09-14:** one real PHP 100.00 QR Ph payment (`ee73211b-506e-4883-ac88-e6d0d37e339d`, `pay_fbszE8Xr3p6f…`) produced a signed `li` webhook, a `confirmed` booking, and both customer/admin emails recorded `sent` (the first two attempts returned `email_delivery_uncertain`; the retry queue recovered them — see the `sent` caveat below). Remaining for the studio: an inbox spot-check. The studio chose **not** to refund the first ₱100, so it stays as the PayMongo balance and the booking remains `confirmed` in the ledger; the only cost is the QR Ph fee (about ₱1.34). The live D1 ledger now holds that payment alone (1 row, 10000 centavos gross); all pre-launch test rows were removed with an `audit` trace. Customers can hand an unpaid hold back immediately with `POST /bookings/:id/release`. Set `BOOKING_LAUNCH_READY=false` and redeploy to pause new checkout creation.

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
        ├── HomePage.tsx               # Public orbital landing page; home/ owns media, motion and styles
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

### Clearing test data before launch (there is no ticket-delete action)
- **No delete exists for tickets.** **Reset #1** only archives, and archived finished tickets still count in the Earnings dashboard, History and CSV exports — so test orders survive a reset. Removal must go through the **Restore** path.
- Restore is the only supported purge: it replaces local IndexedDB and writes `deleted: true` tombstones for every cloud record missing from the payload (`applyPendingRestore` covers `tickets` and `items`), so nothing resurrects on the next sync. The durable `restorePending` intent makes it safe to retry after a partial failure.
- Procedure used on 2026-09-15: export a **Full backup** first as the safety copy, then restore a validated empty payload (`schemaVersion: 2`, `tickets: []`, `items: []`, `ticketCounter: 0`, plus the current `settings` so the Public configuration survives). Use `ticketCounter: 0`, not `1` — numbering allocates `counter + 1`, so `1` would make the first new ticket #2.
- **The public queue mirrors local tickets.** `republishPublicQueue` upserts a sanitized `publicQueue` row per live ticket and deletes rows that no longer map to one, so leftover local `waiting` tickets stay visible to customers on `/live.html`. On 2026-09-14 sixteen stale `waiting` rows (tickets #11–#26 from the 2026-09-06 test session) were still published while the staff app kept syncing; an empty restore removes them on the next publish. Confirm the live page is empty after clearing test data.

### Settings workspace layout
`PublicSettingsView.tsx` shows **one panel at a time** — *Bookings & deposits*, *Schedule*, *Pop-ups & studio*, *Legacy requests* — under a sticky title/status/Save bar, so the Save button and the live/paused state stay reachable while editing. Each panel keeps its original anchor id (`#paid-bookings`, `#booking-schedule`, `#popup-event`, `#incoming-requests`) and a `hashchange` listener opens the panel that owns a clicked link, so any deep link resolves instead of scrolling to a hidden section. `SettingsSidebar` deliberately does **not** repeat the panel nav (its overview and “Sections” list were removed) — the switcher above is the single navigation source, and the sidebar keeps only the live website links. Long record lists are bounded: paid bookings scroll inside `max-h-[60vh]` (up to 500 loaded records, compact status-chip cards with the accepted-policy text collapsed) and legacy requests scroll inside `max-h-[50vh]`. A busy week therefore cannot stretch the settings page.

**Legacy requests → “Delete unpaid requests”** removes every `appointments` document whose status is missing or `requested` (batches of 400; up to 500 scanned per click). Records marked `confirmed` are never touched because they may be real promises to clients. Always follow it with **Import / refresh legacy slot safeguards** so the private D1 `legacy_holds` drop the removed records and those times become bookable online again. Never delete the D1 `deployment_checks.legacy_import` row itself — the Worker fails its launch gate without it — but a successful re-import rewrites it safely.

### Backups & Data Portability
- **Format**: JSON backup payload (schemaVersion: 2) containing `tickets`, `items`, `ticketCounter`, and `settings`.
- **Restore Behavior**: Completely replaces local storage and, if connected to the cloud, **replaces the station's cloud documents**. Records missing from the backup are converted into cloud tombstones (`deleted: true`) so old records are not resurrected.
- **CSV Export**: Sanitizes client-entered fields against formula injection (prepends apostrophe to `=`, `+`, `-`, `@`). Sum `Line Total` rather than `Ticket Total` for accurate item-based revenue reporting.

---

## 6. Surface 2: Public Customer Web & Booking Funnel

The public surface comprises **7 dedicated pages** wrapped in a unified layout component (`PublicShell.tsx`):

| Page | URL | Description |
| --- | --- | --- |
| **Home** | `/home.html` | Full-viewport orbital media experience, editorial piercing studies, live pop-up callout, care links and booking CTA. |
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

**Live PayMongo account switch + QR Ph (2026-09-14):** The studio replaced the original PayMongo test account with a verified live account. `backend/wrangler.jsonc` now carries `PAYMONGO_LIVE="true"`, `PAYMENT_METHODS="qrph"` and `BOOKING_LAUNCH_READY="true"` (Worker version `db36e0ed-d11b-46cb-8674-47a4f8c27d61`). **Business-type constraint:** PayMongo exposes Cards, GCash, Maya, GrabPay, ShopeePay, Google Pay, direct online banking and BNPL only to registered business types (Sole Proprietorship / Partnership / OPC / Corporation). A verified **Individual (unregistered)** account — valid ID and liveness only, no DTI/SEC — may accept **QR Ph** only, which is active by default once the account is activated. QR Ph is the BSP national QR standard, so one code is payable from GCash, Maya, ShopeePay, GrabPay and participating bank apps (BPI, BDO Pay, Metrobank, UnionBank, Landbank, GoTyme, SeaBank and others), and it is the cheapest channel at 1.34% versus GCash 2.23% and cards 3.125% + PHP 13.39. Business-type upgrade is a single request from Settings → Business Information. Because `ready()` requires the secret key prefix to match `PAYMONGO_LIVE`, a key/mode mismatch fails every booking endpoint closed with HTTP 503 — including `/availability` — so the secret and the flag must land together; live webhook events sign with `li` (test uses `te`) and the signing secret is unique per endpoint. **Blind spot:** neither `ready()` nor session creation can detect an inactive channel — PayMongo still returns a checkout URL and the dead end appears only on the hosted page as "No payment methods are available" (observed live before this fix), so a rendered preflight checkout is a mandatory launch step. Adding a channel that is not activated also fails checkout creation while the row holds the slot for 15 minutes as `checkout_creation_uncertain`. **Slot release:** `POST /bookings/:id/release` (bearer booking token) expires an unpaid `creating`/`pending` hold at once, but first verifies with the provider — an already-paid slot is confirmed via `reconcile()` instead of being freed — and the status page calls it automatically when PayMongo returns `cancelled=1`, plus exposes a manual button; previously an abandoned or cancelled checkout blocked the slot for the whole 15-minute hold. Pre-live `expired` rows had their old-account `session_id`/`checkout_url` cleared so the per-minute cron reconciler stops requesting sessions that no longer exist on the new account; the two test-mode `confirmed` rows are retained for the ledger and annotated in `audit` as `prelive_test_payment_old_paymongo_account` (preflight rows were removed and recorded as `preflight_channel_check_removed`). A D1 export backup was taken before the writes. Real-payment, webhook-delivery and inbox acceptance remain pending.

**Launcher ledger cleanup (2026-09-14):** after the first real live payment, every pre-launch test row was removed from the live D1 ledger so staff reports start clean. Kept: `ee73211b-506e-4883-ac88-e6d0d37e339d` (PHP 100.00, `confirmed`, `pay_fbszE8Xr3p6f…`, the first real QR Ph payment). Removed: the two test-mode `confirmed` rows from the retired test account (`pay_Tr2ZHWQbm1…`, `pay_sgJNVR6Zof…`) and four unpaid `expired` rows. The trace survives in `audit` (`test_ledger_row_removed_for_launch`, `unpaid_test_row_removed_for_launch`) and in the pre-cleanup export `/tmp/punkture-d1-precleanup-2026-09-14.sql`; `deployment_checks` (the launch prerequisite) and `legacy_holds` were not touched. Resulting totals: 1 booking row, 1 payment, 10000 centavos gross, 1 webhook event, 2 outbox jobs. Both confirmation emails were recovered by the retry queue and are recorded `sent` (third attempt, `provider_id` = the job id) — `sent` still means provider acceptance, so the studio should spot-check the customer and admin inboxes.

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

**GitHub booking build URL:** CI defaults `VITE_BOOKING_API_URL` to `https://punkture-booking.zlef-dev.workers.dev` when the repository variable is unset. A nonempty repository variable can override it. This is a public endpoint, not a credential. A previous successful hosting build omitted the URL and compiled booking requests into an immediate configuration error; pushing this workflow fix rebuilds the frontend with the endpoint.

**Public responsive UI:** The shared public header spans the viewport, with a 44px menu target at its safe-area-aware left edge and centered adaptive branding. Public content widens to 42rem on larger screens; booking date cells retain readable widths. Navigation scrolls on short screens, exposes dialog/current-page semantics, traps keyboard focus and returns focus to the trigger. Mobile form fields use 16px text, waiver height follows dynamic viewport, and reduced-motion preferences are respected. Backend, prices, consent and payment state logic are unchanged.

**Premium public styling:** The `studio-premium` scope applies only when PublicShell page is not `home`. It refines heading scale, text contrast, spacing, form focus, navigation and surfaces across booking, pop-up, live queue and guides. Home uses its isolated orbital landing experience described below. No data, routing, booking, payment, pricing, consent or scheduling behavior changes.

**Live ritual alignment:** Original `/logo.png` avatar is preserved. The fixed-stage ear contact point is (294,201); the avatar has a subtle 2.2px vertical float shared by all tools and contact effects, preserving alignment. Marker approach no longer overshoots, and needle approach/penetration/withdrawal follows its shaft axis. Reduced-motion view uses a neutral session label. This loop is decorative, not a measurement of actual procedure phase or a training demonstration; queue state and timing are unchanged.

The ritual float completes two seven-second cycles per 14-second loop, without a reset jump. Contact offsets follow the additional reactions described below; reduced-motion mode remains static.

**Avatar reactions:** `ritualMotion.ts` adds a soft yes-nod after marker lift (4.65–5.45s) and two diminishing happy hops after jewelry release (13–14s). Contact offsets account for the nod scale about the avatar origin so tools, mark and stud remain attached. Original avatar asset and live queue behavior are unchanged; reduced motion stays static.

**Expressive ritual acting:** Two visible approval nods follow marking; a single brief recoil at 9.95–10.19s resolves gently, then two happy hops finish the reveal. Contact points use the full avatar translation, rotation and scale around its CSS origin so jewelry and tool tips track the ear. Original avatar pixels and queue/payment functionality are unchanged.

**Clamp artwork:** Restored the original four clamp frames and jewelry forceps asset, with their original anchors and frame transitions. Avatar reactions and contact tracking remain in place.

**Shared UI polish:** All seven public pages (including Home), booking/payment views, and local staff controls share softer hover/press feedback without universal control movement. Keyboard skip navigation targets a semantic public main region; footer contrast, form focus and touch feedback are consistent. Reduced-motion preferences cover staff and public CSS animations. Staff queue/workspace stack below 1024px instead of clipping the second pane; desktop layout is preserved. Checkout summary height follows the dynamic viewport. This pass changes presentation only, with no data, payment, queue, routing or pricing changes.

**Responsive audit refinement:** Staff panes stack at tablet widths below 1024px; desktop sidebar width adapts from 320–420px. Settings grids use the available workspace container width, and legacy status filters wrap on narrow screens. Public branding compacts below 360px. No state or persistence changes.

Responsive browser checks (2026-09-13): public page layout measurements at 320, 390, 768, 1024 and 1440px; populated staff settings also checked at 900px after the fixes, with no measured controls beyond the viewport. Verified the mobile settings section jump and scrollable navigation at 667×375 landscape. These are local browser checks, not certification of every device or data state. Public booking was paused by the loaded settings, so all checkout states still need a separate visual pass when available. Unit tests, lint and production build passed after these changes.


## Home page: orbital studio experience (2026-09-14)

`src/components/HomePage.tsx` composes `home/OrbitHero.tsx`, `MediaViewer.tsx`, `Media.tsx`, the editorial gallery, marquee, care links and magnetic booking CTA. `home/home.css` is imported only by HomePage and scopes all layout overrides to `.pk-home` / the shell containing it. The existing PublicShell navigation, brand header, design tokens and legal footer are reused without editing the shared component. Existing public settings subscription and next-event selection remain read-only and unchanged. Other routes, auth, backend, state actions and Firestore rules are untouched by this change.

**Interaction contract:** Twelve mixed-aspect cards use one requestAnimationFrame loop outside React rendering. Ellipse angle supplies position, scale, opacity, stacking and depth softness. Depth blur crossfades a statically blurred poster, keeping the continuously animated properties to transforms and opacity; z-index is discrete. At most two front-facing orbit videos play. Video sources are loaded on first use and retained when paused. Offscreen, hidden-tab, paused and modal states stop video playback; reduced motion suppresses automatic rotation, inertia, videos, smooth scrolling, marquee and reveal animation. Manual dragging and opening remain available. Horizontal pointer capture supports mouse, touch and pen while `touch-action: pan-y pinch-zoom` preserves native vertical touch scrolling. Cancellation never opens a card. Keyboard focus pauses rotation for card selection.

The native modal dialog is a 92vw × 92dvh panel with transform-based FLIP expansion/reversal, a dimmed blurred backdrop, muted looping inline video, Escape / close button / backdrop dismissal, trapped focus, inert background, source focus restoration and saved body/scroll restoration. Closing during expansion retargets the current animation. ResizeObserver recalculates the paused orbit geometry for closing after viewport rotation. Lenis respects both this modal and the existing navigation drawer's scroll locks.

### Animation tool decision

| Tool evaluated | Decision for this build |
| --- | --- |
| Motion / Framer Motion | **Use `motion/mini` (MIT)**: small native Web Animations wrapper for FLIP, custom easing, reveals and magnetic CTA; React is already installed. |
| Lenis | **Use (MIT)**: smooth wheel/anchor scrolling, lifecycle cleanup and explicit modal locks; touch scrolling stays native. |
| GSAP | Capable, but its free standard license is not MIT; Motion meets the requested licensing constraint. |
| Rive, Lottie | Skip: no authored state-machine/vector animation assets to justify runtimes or an asset pipeline. |
| Spline, Three.js | Skip: the requested depth is achieved with DOM transforms, with no 3D scene or WebGL context. |
| PixiJS, Curtains.js, OGL | Skip: no particle, shader or canvas requirement; DOM media preserves normal video and button accessibility. |
| Theatre.js | Skip: no timeline-authoring workflow; a few explicit durations/easings suffice. |
| Matter.js | Skip: a single angle and analytic exponential decay provide controlled, refresh-rate-independent momentum. |
| Barba.js | Skip: page transitions would cross the explicit home-only boundary of this multipage app. |

Licenses: [Motion MIT](https://github.com/motiondivision/motion/blob/main/LICENSE.md), [Lenis MIT](https://github.com/darkroomengineering/lenis/blob/main/LICENSE), [GSAP standard license](https://gsap.com/community/standard-license/). These dependencies enter only the home bundle.

### Tuning and swapping media

`src/components/home/orbitMath.ts` exports `ORBIT`: idle **0.075 rad/s** (~84 seconds/revolution), drag sensitivity **−0.0055 rad/pixel** (front cards follow horizontal dragging), max release velocity **4.5 rad/s**, exponential friction **3.2/s**, click limit **7px / 350ms**, stale-release cutoff **90ms**, expansion **780ms**, close **480ms**. Frame delta is capped at 50ms after interruptions. The radius adapts to stage width/height. Scale is 0.48–1; opacity 0.32–1. Expansion uses cubic-bezier(0.22,1,0.36,1); reveals use cubic-bezier(0.16,1,0.3,1), closing uses (0.65,0,0.35,1); Lenis lerp is 0.085. CSS controls card sizes, ring placement and the 28-second marquee.

**One manifest:** edit `src/components/home/mediaItems.js`, preserving each stable `id`. Each entry is `{ id, type: 'video' | 'image', src, aspect: width / height, caption }`. Optional `poster` provides a real thumbnail for videos (also used for the depth-blur layer); without it, the demo uses a Picsum seed. Put studio files under `public/media/` and use `/media/filename.mp4` or an HTTPS CDN URL. Prefer short, compressed, web-playable MP4s; maintain 10–14 entries. Gallery selections reference entries from this same array. The original ear/jewelry SVGs in `public/media/` are illustrative placeholders, not client photography. Sample films use MDN's ~1.1MB CC0 flower clip in different aspect ratios; the suggested Google gtv bucket returned 403 during verification, so it is not used. Captions clearly disclose the concept/demo status.

Validation includes momentum equivalence at 30/60/120Hz, click/drag thresholds, depth order, manifest shape, and mounted React pointer tests for mouse/touch/pen taps, drags and cancellation (`tests/home-orbit.test.mjs`, `tests/home-interactions.test.mjs`). Browser checks verify desktop and phone layouts, native dialog opening/dismissal/focus restoration, active muted looping video, offscreen video pause and gallery reveals. These are local browser and synthetic-pointer checks, not a claim of measured 60fps on physical mid-range phones. No reference screenshots were available in this conversation; visual composition follows the written brief.

Final local validation: **62 tests passed**, lint completed without warnings/errors, and the seven-page production build passed. Responsive checks at 320×667, 390×844, 1280×720 and 1440×900 found no horizontal overflow. A later browser pass recorded the existing Firestore listener's backend-unavailable/network errors; the home callout used its fallback. No new UI exceptions were observed, and the backend/listener configuration was not changed or its logging suppressed. Physical-device performance and screenshot matching remain unverified.

**Home interaction refinement:** Reversed both drag displacement and tracked release velocity so front-facing cards follow the pointer. The orbit center now shows the existing `/logo.png` only; the drawn ring and “The art of becoming” tagline are removed. Hero copy is “Customize your character.” / “Be fierce. Get pierced.” The media viewer measures and initializes FLIP in a layout effect before paint, resets transforms for StrictMode measurements, expands over 780ms and delays its controls/caption reveal. Marquee duration is now 28 seconds (previously 48) for a faster readable pace. Reduced-motion behavior is preserved.

Refinement validation: 63 tests, lint and production build pass. Added a regression check that front-card displacement and release momentum both follow left/right dragging. Center logo stays above the orbit cards so it remains visible.

**Reel layer fix + sidebar trim (2026-09-15):** The reels now paint **above** the centre logo, as the studio requested: `.pk-ring-brand` dropped from `z-index: 103` to `1`, while each orbit card is painted `2–102` from `orbitPose().zIndex`, so front cards overlap the logo and rear cards still pass behind it. The hero chrome is unaffected (`.pk-hero-top`/`.pk-hero-bottom` stay at 110, `.pk-hero-heading` at 105) and the black preloader keeps its own `.pk-boot-mark` element from `home.html`, so the intro mark is not affected by the brand's layer. `SettingsSidebar` no longer repeats the section nav — the "SETTINGS & ONLINE CONTROL" overview and the "Sections" anchor list were removed because the sticky panel switcher already owns that navigation; the sidebar keeps only the live website links, and the `hashchange` listener still opens the panel that owns an anchor.

## Cinematic home load / reload intro (2026-09-14)

The home-only intro adds no libraries and changes no other route, backend or shared navigation component. Every navigation/reload uses the same full deterministic choreography; no session-storage shortcut changes repeat visits. The existing center logo remains the final mark, surrounded by a thin ring during the black preloader.

- **First paint:** `home.html` contains a tiny critical black curtain/logo and pending-state CSS before the main bundle. Header, hero chrome and cards are hidden before React mounts. Home font CSS loads without blocking this first paint. `scrollbar-gutter: stable` reserves the scrollbar width; section/card dimensions remain unchanged. Scroll restoration is temporarily manual for the opening stage and restored on completion/exit. Reduced-motion CSS bypasses the curtain immediately. A separate six-second boot fallback releases the critical curtain if the app module is delayed or fails.
- **Honest preload:** `home/preloadFirstMedia.ts` waits only for `mediaItems[0]` (decoded image or first decoded video data), with an **850ms hard cap**. Failed/aborted loads cannot strand the curtain; no pretend progress counter or whole-gallery readiness dependency is used. Existing orbit posters may load normally, but only that one media asset gates the sequence. Gallery `<Media>` components do not mount until handoff and keep their native lazy loading afterward.
- **One master clock:** `home/homeIntro.ts` owns one requestAnimationFrame timeline, with the pure choreography in `home/introTimeline.ts`. It writes transforms/opacity only; static blurred-poster layers are crossfaded instead of animating filters. Geometry is measured once outside the frame loop, and stacking order comes from final orbit depth. The preloader curtain fades, scattered dim cards gather into their exact orbit slots, the loading logo moves/scales/rotates into the existing center-logo position, header/hero chrome and bottom controls stagger in, and grain fades to its existing strength. The boot logo disappears on the same frame that the normal center logo becomes visible.
- **Handoff:** `OrbitHero` accepts a mutable `IntroGate`. Its existing RAF loop cannot touch card styles, advance the angle or start video playback until `gate.ready` becomes true. Both systems share `ORBIT.initialAngle`, so the last intro pose is exactly the first orbit pose, with zero initial momentum. Drag direction/friction and media viewer animation are unchanged. Lenis is created/resized after intro completion. The existing IntersectionObserver gallery reveal setup is also deferred until completion; this repo does not use GSAP ScrollTrigger, so none was added.
- **Interrupt safety:** Capturing `pointerdown`, `click`, `touchstart`, `wheel`, `keydown` or meaningful scroll synchronously writes the full final frame, aborts pending preload callbacks, cancels the timeline/watchdog, reveals the normal logo and all chrome, removes the curtain/temporary scroll constraint, and sets the gate ready **before the same input reaches the orbit**. Default input behavior is not cancelled. Resize and page exit also settle safely. Finishing is idempotent; late image callbacks cannot restart it. An independent wall-clock failsafe finishes even if RAF is suspended in a background tab. StrictMode cleanup invalidates the old run so it cannot race the next setup. Changing reduced-motion preferences after interaction does not reset the user's orbit angle.

### Intro tuning

All choreography values are in `src/components/home/introTimeline.ts` → `INTRO` (seconds unless named `Ms`):

| Segment | Timing / tuning |
| --- | --- |
| Preloader | First asset readiness, at most `preloadCapMs: 850` |
| Master reveal | `duration: 2.12` seconds after readiness/cap |
| Stage fade | `stageDuration: 0.62` |
| Cards | `cardStart: 0.2`, `cardStagger: 0.045`, `cardDuration: 1.25`; quintic ease-out for a soft landing |
| Scatter | `scatterX: 0.23` × stage width, `scatterY: 0.3` × stage height, `scatterScale: 0.42`, `scatterRotation: 22` degrees; golden-angle seed gives the same arrangement on reload |
| Center logo | `logoDuration: 1.52`; scales from 96px to the existing responsive mark size, with a subtle 14° turning arc |
| Header + hero chrome | `headerStart: 0.72`, `chromeStagger: 0.1`, `chromeDuration: 0.65` |
| Bottom controls | `bottomStart: 1.28`, 70ms stagger, 14px rise |
| Grain | `grainStart: 1.15`, 700ms fade to the existing 0.035 opacity |

The natural reveal completes in about **2.1–3 seconds**, depending only on first-asset readiness. Interruptions and reduced motion render the final state directly. `tests/home-intro.test.mjs` covers deterministic end poses for 10/12/14 cards and phone/desktop sizes, preload gating/cap/abort, loading and mid-reveal interruptions, StrictMode cancellation, suspended-RAF recovery and preference changes. Existing mounted pointer tests additionally verify exclusive intro ownership and the orbit handoff. Browser checks observed pending/revealing with zero gallery images, ready state with all four gallery images mounted, phone drag interruption without accidental viewer opening, and the existing viewer opening/closing after handoff. These checks do not certify physical-device 60fps or matching a reference video that was not attached.

Intro validation: all **70 tests passed**, lint passed, and the seven-page production build passed. Fresh desktop/390px phone browser passes showed no console errors, no horizontal overflow, zero gallery images before handoff, normal scrolling/offscreen video pause afterward, and successful viewer open/close after interruption. Lenis also checks an existing body lock when it is first created, so opening navigation during the intro cannot start scrolling behind the drawer. Production build emitted a non-failing bundler plugin-timing advisory during concurrent validation; no source/build error occurred.


## Local studio reels (2026-09-14)

The 12 orbit slots now use **all 12 MP4 files directly under `public/videos/` exactly once**, in filename order, through `src/components/home/mediaItems.js`. Native track metadata confirmed every file is **9:16 H.264/AVC**: eleven 1080×1920 clips and one 720×1280 clip. Original MP4 bytes are preserved. Twelve 540×960 JPEG posters under `public/videos/posters/` were extracted around the first second of their corresponding footage; paused cards, loading previews and depth-blur layers now show that footage, without remote demo imagery. Videos remain muted/looped with at most two orbit videos playing; the intro, drag momentum and FLIP viewer remain in place.

Orbit widths are calculated from a responsive height and each item's `aspect`, rather than a width plus an independent maximum height that could distort/crop portrait framing. The viewer keeps `object-fit: contain`, preserving the complete reel. Viewer captions identify real videos as studio reels, not placeholders. Below-fold editorial illustrations are unchanged: optional nested `gallery` image records in the same single manifest retain the four prior studies, and HomePage selects those explicitly. Their existing concept labels and image-viewer behavior remain unchanged.

To swap a reel, update its `src`, `poster`, `aspect` and caption in the manifest. The manifest test compares the listed video filenames to all MP4s in `public/videos/`, verifies uniqueness/9:16 sizing and checks each local poster exists. Intro test media mocks now exercise first-video readiness (the previous first asset was an image).

## Appointment placement atelier (2026-09-14)

The appointment graphic maps now use original, softly shaded silicone-style SVG sculptures for ear, face/oral and torso. `booking/PiercingMap.tsx` owns shared gradients, metallic jewelry previews, hover/focus/selected feedback and the accessible placement directory; `booking/piercing-map.css` is loaded only by `appointment.tsx`. The existing three diagram components own coordinates paired to their 400×500 sculpture. Jewelry is translucent at rest and brightens on interaction; selected placements retain a mint check. Industrial jewelry spans two rim contacts, with a hit target along the full bar. Named directory buttons provide 44px minimum touch targets. Reduced-motion preferences disable entrance and feedback transitions.

Placement corrections include the forward rim, tragus/anti-tragus and inner cartilage folds; Medusa above the Cupid's bow, Labret below the lower lip, and Monroe on the depicted person's left. Smiley and Tongue live in a separate internal-mouth detail, not on facial skin. Classic and floating navel previews share the upper navel rim; floating fit depicts a flat lower end, not a lower-navel piercing. `PiercingSpotModal` reuses the same sculpture in a noninteractive selected-only preview, replacing the old mismatched miniature diagrams. Legacy catalog x/y fields are retained for compatibility but are no longer used to render the maps. Prices, IDs, jewelry tier restrictions, healing copy, cart, scheduling, waiver and payment behavior are unchanged.

These are stylized placement previews, not individualized procedure markings or a guarantee of suitability. The page retains anatomy confirmation wording, consistent with the [Association of Professional Piercers' consultation guidance](https://safepiercing.org/picking-your-piercer/). No new animation or graphics dependency was added. `tests/piercing-map.test.mjs` checks catalog selection identity, keyboard selection, selected state, internal oral separation and shared upper-rim navel positioning.

**Placement accuracy refinement:** `booking/mapGeometry.ts` now holds the ear/face/oral artwork points with named tissue landmarks, jewelry orientation and size. The ear has a continuous anterior helix/crus, a triangular fossa, a distinct inferior antihelix shelf for the rook, and a separate lower antihelix and antitragus. The rook's two ends sit above/below the shelf; its concealed shaft is not drawn across skin. Daith uses a larger bowl-facing hoop with its upper-left segment tucked at the crus. Snug spans the lower antihelix; the industrial spans both upper rims. Face artwork distinguishes nostril wings from openings; the nostril stud sits on the wing, the septum's hidden upper arc sits inside the nose and its circular barbell opens downward. Smaller facial studs are aligned with the philtrum, lower-lip border, wearer's left upper-lip area and cheek. Jewelry no longer scales on hover/selection: contact coordinates remain fixed while opacity and an independent aura provide feedback. Active captions name the anatomical region. These changes also apply to the modal preview.

Anatomical reference review used professional piercer Lynn Loheide's [Rook Piercing 101](https://www.lynnloheide.com/post/rook-piercing-101), [Daith Piercings 101](https://www.lynnloheide.com/post/daith-piercings-101), [Nostril Piercing 101](https://www.lynnloheide.com/post/nostril-piercing-101), and [septum placement discussion](https://www.lynnloheide.com/post/septum-stretching). Artwork is original and stylized; references informed tissue relationships, not patient-specific dimensions. In-person assessment remains necessary, and software tests establish interaction/consistency rather than clinical placement certification.

## Reference-based appointment maps (2026-09-14)

The user's three supplied grayscale reference PNGs now replace the hand-drawn outer ear, face and torso sculptures. They are stored **unchanged** in `public/media/anatomy/ear-reference.png`, `face-reference.png` and `body-reference.png`. An attempted built-in image-generation batch failed on the torso safety filter; no generated assets or CLI fallback are used. `ReferenceImage.tsx` renders the supplied pixels, and `referenceGeometry.ts` pairs source-pixel landmarks with the exact uniform scale/translation used by each image. SVG viewport clipping reframes the ear and excludes the torso screenshot's bottom/right interface controls without editing the original files or stretching anatomy. Existing internal-mouth artwork remains an explicitly separate schematic in `mapGeometry.ts`.

Presentation is now a clean light image canvas with dark header/footer, controls outside the anatomy, quiet pinpoint markers, faint jewelry previews, fixed jewelry anchors and 46px directory buttons. Industrial exposes two rim targets, not a misleading center-of-ear target. The daith attachment point is separate from its visible hoop center. Each hit region is clipped to the nearest landmark's cell so close facial spots cannot intercept each other's taps. All coordinates remain coupled to the image on responsive resize and in the selected-only modal preview.

The September 15 annotated-image corrections place the Daith clickable marker inside its hoop at source pixel (367, 616), with jewelry offset (-7, -1) and scale 1.35, and move Conch to (422, 648). The marker's offset preserves the existing jewelry origin at (360, 615), so moving the tap target does not move the hoop. The annotation is a positioning guide only; no red markings are added. Both the appointment map and selected-only preview share these corrected coordinates. The follow-up jewelry correction hides the final 24% of both Daith hoop strokes (the returning left segment) beneath the fold, retaining the original visible curve, bead, size and position.

The supplied torso has no visible nipple landmarks. It is used for navel placement only; **Chest detail** offers a clearly labeled, non-patient-specific nipple schematic with the barbell ends at the base instead of inventing a nipple location on the supplied model. Classic/floating navel retain their shared upper-rim placement and existing price restrictions. The placement modal now saves/restores scroll position and fixes the body while open, avoiding the observed mobile jump to the top of the booking page. Prices, catalog, selected-item data, scheduling, payment and other routes are unchanged.

Tests additionally cover original PNG dimensions, image/point transforms, nonoverlapping facial hit cells, the industrial's two targets, and separating chest detail from the torso image. These verify UI geometry and behavior, not individualized piercing suitability.

## Compressed home media and RPG copy (2026-09-15)

**Appointment catalog update:** Helix now sits at ear-reference pixel (515, 612), matching the user's red guide. Hidden Helix (`hidden_helix`) is added at (399, 444), beneath the upper rim at the blue guide, to the map, directory, search and shared modal preview. Its studio piercing price is ₱400 with only the existing ₱200 Titanium jewelry tier (`jewelryPrices: [200]`), automatically selected: ₱600 for one ear, ₱1,200 for both. The normal cart/booking selection carries both prices. No staff pop-up rate or payment deposit policy is changed. Healing and pain fields defer to consultation rather than inventing specific estimates. Tests cover its single jewelry choice and saved pricing.

Home's single `mediaItems.js` manifest now resolves the user's renamed compressed `/videos/1.mp4`–`12.mp4` with matching `/videos/posters/1.jpg`–`12.jpg`. Gallery order is `/media/a.png` (ear guide), `b.png` (face guide), `c.png` (pop-up rates), `d.png` (studio rates). All four graphics are 1240×1748; their aspect ratios are reserved before loading. Old illustrative rotation, mirroring, cropping and overlaid tags are removed so labels and prices remain readable. Full-image viewing and deferred/lazy gallery loading remain. The original compressed files are used without re-encoding or duplicating assets; pricing logic is unchanged.

The perspective section uses the requested RPG/character-creation copy, with “Start your build →” linking to appointments and adjacent “Punkture Point” opening the supplied Google Maps link in a new tab. Home intro, orbit gestures and viewer behavior are retained. No PayMongo/account/live-payment settings are changed.

## Complete booking cart summaries (2026-09-15)

`booking/cartSnapshot.ts` now serializes every selected piercing, service and custom request into the existing D1 `bookings.notes` field, with side, jewelry tier/price, per-line estimate and total. The old 300-character Firestore-era truncation is removed. Worker validation accepts up to 20,000 characters; larger summaries stop with an error rather than silently dropping items. Settings preserves line breaks, and the existing admin email includes the same full snapshot. No database migration is needed; older notes remain readable. Existing records that saved no selections cannot have missing choices reconstructed from these changes.

The cart persists in per-tab session storage across refreshes/navigation until checkout creation succeeds, then the saved draft is cleared. Customer contact details are not added to this draft. Both-ear selections count twice consistently in the floating cart, review and saved estimate (the modal already did so). Estimates remain client-supplied consultation information, not verified payment amounts; the fixed reservation deposit and payment verification rules are unchanged.

Release order: deploy the Worker with the increased notes limit first, then publish the frontend; the old Worker rejects summaries over 300 characters. Local tests cover draft restoration/clearing, complete multi-item serialization, both-ear totals, size rejection, D1 storage, authenticated Settings retrieval and admin email delivery. These changes have not been deployed by this task.
