# Keeping the public site within Spark

## Baseline: September 24, 2026

The supplied screenshot reports **4.47 GB Hosting downloads over 7 days**, **36K current Firestore reads**, and **4.7K current writes**. The owner says public launch was four days earlier. These are different reporting windows: do not subtract 4.47 GB from the monthly allowance without checking the month-to-date Hosting view. If all 4.47 GB came from four launch days, the illustrative rate is **1.12 GB/day, or 33.5 GB per 30 days**. If spread evenly over the entire seven-day view, it is still about **19.2 GB/30 days**. Neither is a measured forecast.

Verified official limits:

| Resource | Spark allowance | What to track |
| --- | --- | --- |
| Firebase Hosting transfer | 10 GB/month | Month-to-date and daily downloads; cached CDN delivery still counts |
| Firebase Hosting storage | 10 GB | Stored releases; keep a small rollback history using the console's release retention setting |
| Firestore document reads | 50,000/day | Daily reads, including listener updates/reconnections and rule-dependent reads |
| Firestore writes / deletes | 20,000/day each | Successful sync mutations and heartbeat traffic |
| Firestore stored data / outbound transfer | 1 GiB / 10 GiB per month | History growth and data sent by reads |

Sources: [Hosting quota](https://firebase.google.com/docs/hosting/usage-quotas-pricing), [Firestore quota](https://firebase.google.com/docs/firestore/quotas), [listener billing](https://firebase.google.com/docs/firestore/pricing). Firestore daily quota resets around midnight Pacific, not Manila midnight. If the screenshot's 36K value represents one day, it is 72% of the read allowance; confirm that in the detailed usage view. Hosting's Spark overage can disable the site after its grace period. These changes cannot guarantee unlimited visitors within a finite allowance.

## Changes implemented

- Staff sync maintains server-confirmed listeners for tickets, items, public settings and public queue. An idle 30-second safety cycle reuses these snapshots instead of downloading the entire history. Local edits still queue sync quickly; remote changes trigger sync too. Pending/cache-only snapshots cannot authorize a merge, publication or restore. Errors, offline transitions and sign-out discard listeners; restore obtains fresh snapshots. Records and tombstones are retained.
- The ticket counter writes only when the local value changes (or after session reset). Successful healthy sync publishes heartbeats at most once per 25 seconds; the 30-second safety tick and existing 90-second stale indicator remain. An eight-hour idle session previously wrote roughly 960 counters plus 960 heartbeats; it now writes roughly one counter plus 960 heartbeats, before actual edits/reconnections.
- The public queue does not listen to heartbeat updates while empty. Both public queue listeners detach after 30 seconds hidden, and reattach when visible. The heartbeat is cleared before reconnect so old information cannot be labelled live. Brief tab switches keep the connection.
- Booking availability keeps its 10-second interval while visible, prevents overlapping requests, stops polling while hidden and refreshes on return. Checkout still revalidates against the live Worker schedule and atomic D1 slot lock. Worker authentication, payment checks, notification retries, and Firestore rules are unchanged.
- All 12 reels, 12 posters and 4 gallery graphics are emitted byte-for-byte under content-hashed `/assets/` URLs with one-year immutable caching. Replacing a media file changes its URL automatically. Unversioned public media has only a one-hour cache lifetime. HTML keeps Firebase's default revalidation behavior. The intro decodes its first poster instead of requesting a disposable copy of the first video; autoplay, orbit, viewer and all reels remain.
- Optional standalone Cloudflare static media hosting moves those 28 files off Firebase delivery. It uses no Worker script, D1 binding, R2 bucket, payment secret, or paid-plan upgrade. Static requests are free/unlimited under [Cloudflare's documented limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/); each file must be at most 25 MiB. The build enforces that size limit.

The savings above are structural estimates and local test results, not post-deployment billing measurements. Each new staff browser still reads initial history, real changes still cost reads/writes, and each visible occupied queue viewer still reads heartbeat updates. At 30-second intervals that is approximately 120 heartbeat reads per viewer-hour. The booking Worker's availability endpoint still reads Firestore settings per visible poll. Browser caching primarily helps repeat requests; **activate the media host for the strongest Hosting reduction**.

## Release the optional media host

Cloudflare CLI login has now completed, and Firebase CLI access is verified. The media host is published at `https://punkture-media.zlef-dev.workers.dev`, version `c283a60e-fdcc-4f85-b299-2cae4cb50801`. All 28 files passed live size/type/cache checks, and actual browser playback passed. The following procedure applies to subsequent media releases and new machines.

**Frontend released September 25, 2026:** Firebase Hosting deployment to `punkture-studios` completed successfully. The live site plays the Cloudflare-hosted reel, all seven public routes return HTTP 200, the live media manifest includes the correct origin/all 28 assets, and the deployed appointment bundle matches the tested build with the existing production booking API. Tests 137/137, lint and build passed. No rules, live settings, billing plan or booking Worker changes were made. Local source changes are not yet committed/pushed. Reload the local cashier on port 5174 to activate the staff-side optimizations.

1. Sign into the studio's existing Cloudflare account with `npx wrangler@4.138.0 login`. Do not use a temporary account. The existing booking Worker is unrelated to this deployment.
2. With `VITE_MEDIA_BASE_URL` empty, run `npm run build`, then `npm run media:prepare`. Only files listed in the public media manifest are staged under ignored `dist-media/`; the staging operation adds/updates hashed files and does not purge previous versions.
3. Run `npx wrangler@4.138.0 deploy --config media/wrangler.jsonc`. This publishes **punkture-media**, not **punkture-booking**. Record the actual returned HTTPS origin; never assume the account subdomain.
4. Set `VITE_MEDIA_BASE_URL` in `.env.local` to that exact origin (no trailing slash), rebuild, and run `npm run media:verify`. Every URL must return the expected content type, exact file size and immutable cache headers. The verifier accepts HTTP 206 plus the exact content range, or HTTP 200 plus the exact content length, then cancels the response body. Cloudflare Static Assets currently returns full-file responses; short-reel playback has been verified. Do not publish the frontend if any check fails. Preserve `VITE_BOOKING_API_URL=https://punkture-booking.zlef-dev.workers.dev` in the production build; a build without the booking API disables online payments.
5. Vite and GitHub Actions now default to the verified media origin above. An optional nonempty GitHub repository **variable** `VITE_MEDIA_BASE_URL` overrides the CI origin. The workflow's verification step blocks releases pointing at missing media. Manual `npm run deploy` performs the same check when configured. No Cloudflare token is required in GitHub for this verification-only workflow.
6. After replacing media, rebuild/stage/publish media **before** the Firebase frontend. Keep the previous hashed files on the media host for visitors with older open pages; retain `dist-media` between media deployments, or combine the previous release's media files when deploying from another computer/CI. No credentials or private staff files belong in this directory.
7. Reload the local cashier at **localhost:5174** to activate staff-side read/write savings. Firebase frontend deployment alone cannot update the local staff app.

Fallback/rollback: set local `VITE_MEDIA_BASE_URL` explicitly to an empty string; for CI also replace the workflow media environment value with an explicit empty string. Removing the variable alone does not disable the verified default. Rebuild and publish the self-contained Firebase version. The same reels remain available locally and in Firebase output. This increases Firebase traffic again. Do not delete media still referenced by active frontend releases. No rules/data migration is necessary.

## Measure after release

Compare two or three similarly busy days in the Firebase usage console, noting staff online hours and customer activity. Track Hosting month-to-date downloads separately from the 7-day summary, daily Firestore reads/writes, and Worker request counts. Aim for operational headroom (for example below 30K reads/day and a Hosting projection below 7 GB/month), not merely one day below the hard cap. This is an operating target, not an enforced limit or an automatically configured monitor.

If reads remain high, inspect visible queue viewer-hours, duplicate cashier tabs/devices and availability polling before changing intervals. Further growth may justify a shared public queue/presence service or a short-lived availability-only schedule cache with fresh checkout validation. Do not drop old sales records, remove tombstones, delay payments, weaken staff authorization, or label stale data live just to reduce quota.
