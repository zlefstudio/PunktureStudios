# PUNKTURE STUDIOS — Queue Manager

An **offline-first**, internal staff tool for a pop-up piercing station inside a bazaar or café.  
No cloud, no backend, no internet required. All data lives in your browser's IndexedDB.

---

## Features at a glance

- **FIFO queue** — first added, first served. Position numbers visible on every waiting card.
- **↕ Drag-to-reorder queue** — grab any waiting card and glide it up/down to fix the line order instantly (premium Spotify-style motion). Order survives reloads & backups.
- **Auto-open upon saving** — adding a client immediately opens their active workspace for zero-delay order taking.
- **⚡ In Progress = Now Serving** — the moment you hit *Start Piercing*, the ticket lives in exactly one place (the In Progress section) wrapped in a soft **moving light halo** (Session Aura) with a live session timer — no duplicated banners, no loading-bar look, no confusion.
- **One-tap piercing catalog** — 30+ placements across Ear / Oral / Face / Body + Custom free-text.
- **💍 Standalone Jewelry sales** — separate jewelry tab with all upgrade tiers (Free excluded).
- **Clear all button** — single-tap to clear all items on an active ticket.
- **Reset Ticket Numbering** — reset ticket numbers back to #1 anytime from the History tab.
- **Full group support** — one ticket, optional per-member labels on each item.
- **Large client-facing review modal** — bold high-contrast breakdown view for showing total to clients.
- **Offline backup** — export / import JSON; survives power outages and device swaps.

---

## Tech stack

| | |
|---|---|
| Framework | Vite + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS v4 (build-time, no CDN) |
| Icons | lucide-react (bundled) |
| State | Zustand |
| Persistence | Dexie.js → IndexedDB |

---

## Getting started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install

```bash
npm install
```

### Run (development)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in Chrome or Edge.

### Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file server:

```bash
npx serve dist
# or just open dist/index.html directly in your browser
```

---

## How to use

### Adding a client

1. Click **Add Client to Queue** (left panel).
2. Enter name / nickname / group name (required) and optional notes.
3. Press **Enter** or **Save to Queue** — they join the waiting list instantly.
4. Or press **Save & Open** to jump straight to their workspace.

### Adding piercings

1. Click any ticket to open the right workspace.
2. Pick a category tab: **EAR / ORAL / FACE / BODY / CUSTOM**.
3. Tap a placement chip — it's added immediately with Free upgrade, qty 1.
4. Adjust member label, upgrade, and quantity in the item row.

### Queue flow

```
Waiting → Called → In Progress → Finished
                ↘ (no-show) → Send to End (rejoins Waiting at the back)
                            → Cancel
```

- **Call Next** (top-right) calls the oldest waiting ticket automatically.
- Any waiting ticket can also be called manually from the workspace.
- Multiple called / in-progress tickets are supported for two piercers.
- Once you hit **Start Piercing**, the ticket is shown **only** in the ⚡ In Progress section (which doubles as the Now Serving display) so nothing appears twice.
- **Cancel Session** (workspace, when In Progress) — aborts the session and puts the client straight back at the front of the waiting queue.
- **Cancel Ticket** (always, side-by-side with Cancel Session) — permanently cancels the ticket (client won't be pierced).

### Reordering the waiting line

1. The **Waiting** section shows a ⋮⋮ grip and a *drag to reorder* hint.
2. **Mouse / trackpad:** press and hold anywhere on a waiting card, then drag it up or down. Other cards slide out of the way to preview the new line, and the list auto-scrolls near the edges.
3. **Touch:** press and drag the ⋮⋮ grip handle on the right of the card.
4. Release to drop — the card settles into place with a smooth animation.
5. **Call Next** and the position badges (1, 2, 3…) follow the new order automatically.

> Reordering is disabled while a search is active (search shows a filtered subset).

### Finishing a ticket

1. Add at least one piercing item.
2. Click **Finish & Review** (bottom-right of workspace).
3. Review the breakdown, then **Confirm Finish**.
4. Or **Copy** the breakdown text to paste into your notes / message thread.

### No-show client

When a ticket is in **Called** status:
- **Copy Call Msg** — copies `Hi [name], next na po kayo sa piercing station.` to clipboard. Staff can paste into Messenger/Viber manually.
- **Send to End** — moves them back to the waiting list at the end (new timestamp).
- **Cancel** — removes them with a confirmation prompt.

---

## Backup & restore

> ⚠️ **Data is stored locally in the browser only.** Clearing browser data, using a different browser, or using a private/incognito window will result in data loss.

### Export a backup

1. Click the **💾 Backup** tab (left panel).
2. Click **Export JSON Backup**.
3. A file named `piercing-backup-YYYY-MM-DD-HHmm.json` downloads automatically.
4. Copy the file to a USB drive, Google Drive (when online), or another safe location.

**Recommended: export a backup at the end of every event day.**

### Import a backup

1. Click the **💾 Backup** tab.
2. Click **Choose Backup File** and select a `.json` backup file.
3. Review the summary (ticket count, export date).
4. Click **Yes, Replace Data** — ⚠️ this permanently replaces all current data.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Save client form |
| `Escape` | Cancel / close client form |

---

## Data model

All data is stored in **IndexedDB** (browser storage, not cookies, not localStorage).

```
tickets: id, ticketNumber, name, status, piercer, notes, timestamps, queueOrder...
items:   id, ticketId, memberLabel, placementName, basePrice, upgradeLabel, upgradePrice, quantity
```

Backup file schema: `{ schemaVersion: 1, exportedAt, tickets[], items[] }`

---

## Pricing reference

| Category | Placement | Base Price |
|----------|-----------|------------|
| EAR | Lobe | ₱250 |
| EAR | Auricle | ₱300 |
| EAR | Helix / Forward Helix / Flat / Conch | ₱350 |
| EAR | Faux Rook / Rook / Daith / Snug / Tragus | ₱400 |
| EAR | Anti Tragus | ₱450 |
| EAR | Industrial | ₱600 |
| ORAL | Labret / Madonna / Monroe / Medusa | ₱300 |
| ORAL | Smiley | ₱350 |
| ORAL | Tongue | ₱400 |
| ORAL | Jestrum / Spider Bites / Angel Bites / Snake Bites / Angel Fangs | ₱450 |
| FACE | Nostril | ₱350 |
| FACE | Eyebrow / Septum | ₱400 |
| FACE | Dahlia | ₱450 |
| FACE | Dimple | ₱500 |
| BODY | Nipple (single) | ₱400 |
| BODY | Navel | ₱450 |
| BODY | Floating Navel | ₱500 |

Jewelry upgrades: Free (+₱0) · +50 · 150 Gold · 150 Silver · 200 Gold · 200 Silver

**Formula:** `(basePrice + upgradePrice) × quantity = line total`

---

## Important warnings

> ⚠️ **Do NOT clear browser data, reset browser settings, or uninstall the browser without exporting a backup first.** This will permanently delete all ticket and item data.

> ⚠️ **Do NOT use incognito/private mode** for active sessions — data is lost when the window closes.

> ⚠️ **This app is a single-browser tool.** Multiple devices do not sync. Use one laptop as the station terminal.
# PunktureStudios
