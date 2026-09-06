# PUNKTURE STUDIOS

An offline-first piercing queue and order manager with multiple cashier tabs/devices, optional Firebase synchronization and five public customer pages.

## Run locally

Use Node.js 24 and npm. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

```sh
npm ci
npm run dev
```

The staff application is at **http://localhost:5174**. Keep this exact origin: changing the hostname, protocol or port opens a different IndexedDB database. The port is pinned and Vite will fail instead of silently choosing another port.

Multiple staff tabs can open at the same time. Short database-operation locks serialize local writes without blocking another tab from opening. IndexedDB remains usable without internet while the local server is running. This is not an installed PWA; keep the local server and its files available. Never open `dist/*.html` through `file://`.

## Architecture

| Area | Implementation |
| --- | --- |
| Staff interface | React 19, TypeScript strict mode, Zustand |
| Local database | Dexie/IndexedDB: tickets, items, meta counters and public settings |
| Styling | Tailwind CSS 4 and shared design tokens |
| Cloud | Firebase Authentication and Firestore |
| Public pages | Live queue, appointment request, acknowledgment, aftercare, privacy |
| Hosting | Firebase Hosting, public pages only |

`src/store.ts` owns staff mutations. `src/sync.ts` owns cloud synchronization. Local mutations, restores and sync's local merge steps serialize through `src/dataLock.ts`; network waits do not block local editing.

## Staff workflow

1. Add a client and optional notes. Saving opens the ticket workspace.
2. Add piercing placements or standalone jewelry; adjust quantity, upgrade and member labels.
3. Start piercing when the station is free. Only one called/in-progress session is allowed.
4. Review the order and confirm completion. An order needs at least one item; jewelry-only sales can finish without a piercing session.
5. Cancel Session returns the client to the front of the waiting queue. Cancel Ticket closes it as cancelled.

Drag waiting cards to change serving order. With the keyboard, focus a waiting ticket and press **Alt+Up / Alt+Down**. Reordering is disabled while searching. Wait estimates are approximate; called clients count toward the wait, and jewelry-only purchases add no piercing time.

History provides day, current-month and all-time totals. Reset #1 archives finished/cancelled records and renumbers active tickets while preserving waiting order. Archives remain in reports. Reopening an archived ticket allocates a fresh number to avoid collisions; reopening removes that ticket from finished revenue until completed again.

## Backup and recovery

Export **Full backup** after each event and before changing browsers or restoring data. Store the downloaded JSON somewhere separate from the working device.

Version 2 backups contain tickets, items, public settings and the exact ticket counter. Version 1 ticket/item backups still import; their counter is reconstructed from unarchived ticket numbers and settings default to empty.

Restore validates the complete file before changing storage, then replaces local tickets, items, settings and numbering in one transaction. Invalid records, duplicate IDs, orphan items, invalid prices and multiple active sessions are rejected. Imports are limited to 25 MB.

**When connected, restore also replaces the station's cloud ticket/item/settings copy.** Records absent from the backup become durable cloud deletion records. Appointment requests are a separate cloud collection and are not replaced or included in this backup. A pending restore survives offline use, reloads and partial network failures and retries before normal synchronization.

CSV export neutralizes formula-leading text in client-entered fields. Ticket Total repeats on each item row; sum Line Total for item-based revenue reports rather than summing the repeated Ticket Total column.

Clearing browser data deletes the local database. Reset #1 does not clear personal data. Appointment deletion is available in the Public tab; historical ticket removal can be performed through a reviewed replacement backup. Exported files and copies on other devices need separate handling.

## Firebase setup and staff access

1. Enable Firestore and Firebase Authentication Email/Password in project `punkture-studios`.
2. Create each staff Authentication account and copy its UID.
3. In the Firestore console, create **`staff/{UID}`** with the Boolean field **`enabled: true`**. These documents are managed only through the console/Admin SDK; clients cannot grant themselves access. Set `enabled: false` to revoke access.
4. Deploy the version-controlled rules together with the public pages. The rules require the staff registry above; the old email-placeholder template is no longer used.
5. Open the local staff app and Connect using the staff account.

The Firebase web configuration in `src/firebase.ts` is public configuration. Access is controlled by Firestore rules. Rules reject client names/notes in the public queue, validate booking fields and times, require server timestamps for booking creation and the heartbeat, and keep private records staff-only.

Public booking creates requests without customer sign-in. Signed-in staff can also use the form. Public clients cannot read or list requests. Date/time is Philippine time, must be in the future and within 366 days, and must agree with the stored requested timestamp. Configure Firebase App Check in your Firebase project before exposing a high-traffic booking form; field validation alone is not rate limiting. App Check is not enabled by this repository without a project-specific provider setup.

### Multiple cashier browsers

Open the cashier on any tab or device and connect with your staff account. No browser claims exclusive ownership; existing `cloudControl/station` records are ignored. Deploy the current rules if the older station-restricted rules were previously deployed.

Each browser keeps its own local database and syncs records by `updatedAt` (last write wins). Changes appear on the next successful sync. Simultaneous offline edits are not coordinated: different devices can allocate the same ticket number or overwrite edits to the same record. This mode allows personal testing across devices; it does not provide transactional multi-cashier coordination.

Restore remains an explicit replacement of the shared cloud copy. Do not manually clear item/ticket cloud deletion records: they prevent stale copies from resurrecting removed charges.

### Synchronization and public status

Local edits request sync after a short delay, with a safety sync every 30 seconds. Remote collection snapshots refresh every sync cycle so other devices' changes are picked up; successful writes update the cache within that cycle. Unchanged public tickets are not rewritten. Historical data is still read each cycle, so this is intended for a small setup rather than a large distributed service.

The public queue receives a server-timestamped heartbeat. After 90 seconds without one it shows **Updates paused** with the last known queue. An empty, recently updated queue is labeled **Queue empty**. Closing the cashier does not falsely keep an indefinitely live status.

## Public pages and appointments

| Path | Purpose |
| --- | --- |
| `/live` | Queue, studio details and upcoming event |
| `/appointment` | Booking request |
| `/waiver` | English/Tagalog information acknowledgment |
| `/aftercare` | Aftercare information |
| `/privacy` | Data-handling information |

The acknowledgment asks on each visit. It stores no identity, signature or acknowledgment record and is not a staff-verifiable consent ledger. Public queue access is available independently of it.

The staff Public tab supports fresh-install settings, request loading errors, loading older requests, confirmation, cancellation and permanent deletion. Confirming updates the record only: staff must contact the customer separately. It does not reserve capacity or send an email/SMS.

## Checks and deployment

```sh
npm test
npm run lint
npm run build
npm run test:rules
```

Unit/integration tests use disposable IndexedDB and a mocked cloud transport. Rules tests use the Firestore emulator at `127.0.0.1:8180` with **`demo-punkture-tests`**, never the live project. Install Java 21+ to run the emulator; the test runner also recognizes the optional portable runtime under `node_modules/.tmp/java-test/runtime`. The test runner downloads the pinned Firebase CLI on first use when it is not already installed; emulator and test CLI caches remain under `node_modules/.tmp`. Deployment also uses that pinned CLI version.

```sh
npm run firebase:login
npm run deploy
```

Deployment builds the five public pages and publishes Hosting plus Firestore rules. It intentionally excludes `index.html`/the staff application. Provision the staff registry before deploying the new rules, then restart/update the local cashier. Root URLs redirect to the public live queue. Review the build and rules tests before deployment.

Firebase rules reference: [field validation](https://firebase.google.com/docs/firestore/security/rules-fields), [transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions).
