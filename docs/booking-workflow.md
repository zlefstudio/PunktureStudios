# Booking and payment runbook

**Current email setup (2026-09-11): Gmail + Google Apps Script, replacing Resend. Start with [gmail-setup.md](gmail-setup.md).** The user has deployed the initial Worker and uploaded both PayMongo secrets; Gmail connection and full payment/inbox acceptance remain pending.

## Delivery status

Implemented locally. Do not describe this as a production-tested integration until the staging checks below pass with the studio's own accounts. No live charge or email was sent during implementation. The user deployed the initial Worker; the Gmail update has not yet been deployed. The automated integration tests use the actual SQL migration, Worker request handlers, and Apps Script source with simulated external services, not live PayMongo or Gmail delivery.

**Gmail verification — 2026-09-11:** All 51 tests, lint, production build, and Wrangler deployment dry-run passed. Actual Google authorization, script deployment, and inbox acceptance remain pending. The table below records the earlier pre-migration checks.

## Verification record — 2026-09-10

| Check | Observed result |
| --- | --- |
| `npm test` | **44 passed, 0 failed**, including 21 added payment/UI checks alongside existing tests. Actual Worker handlers and SQLite schema; external APIs simulated. |
| `npm run lint` | Passed; no reported lint errors/warnings. |
| `npm run build` | Passed TypeScript and Vite; exactly seven public HTML entries, no hosted staff entry. |
| `npm run test:rules` | **11 passed, 0 failed**, on Firestore emulator 1.22.0 with Java 21. Includes own enabled staff registry access, no staff self-provisioning, no public appointment create, and no direct confirmation bypass. |
| `git diff --check` | Passed. |
| Actual PayMongo checkout/webhook and Resend inbox delivery | **Not tested**: studio credentials, verified mail sender, admin address, deployed Worker/D1 and API URL are not configured. |
| Deployed Cloudflare runtime / browser visual acceptance | **Not tested**. Follow staging checks before claiming production readiness. |

The default Node 22 and Java 8 could not run the repository's full test tooling. Verification used bundled Node 24.19.0 and a temporary free Temurin Java 21 runtime without changing the system installation. Firebase emulator downloads are now cached under the ignored `node_modules/.tmp` directory. Runtime/module-mocking deprecation notices and expected permission-denied messages from negative security tests are not test failures.

## Services and costs

- Public pages: existing Firebase Hosting free plan. Existing Firebase Auth / Firestore continue to serve staff accounts and schedule settings. No Firebase Cloud Functions or Blaze upgrade is required.
- Backend: Cloudflare Workers **Free** and D1 **Free**, using the free `workers.dev` hostname. Keep the account on Free; quota exhaustion should stop requests rather than require a paid upgrade. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
- Customer confirmation/receipt and admin notification: personal Gmail + Google Apps Script MailApp. No sending-domain purchase or Resend subscription. Shared quota: 100 recipients/day, roughly 50 two-recipient bookings/day before other notices. Quota exhaustion queues work until reset, without paid upgrades. See [Gmail setup](gmail-setup.md) and [Google quotas](https://developers.google.com/apps-script/guides/services/quotas).
- PayMongo Hosted Checkout has payment-processing fees. The user explicitly accepted transaction fees. The customer pays exactly PHP 100.00; the studio absorbs provider fees. Do not enable pass-on fees or a surcharge. No paid storefront plan is needed. [Hosted Checkout](https://www.paymongo.com/products/payment-channels/hosted-checkout), [pricing](https://www.paymongo.com/en/pricing).

## Explicit business assumptions

1. Capacity is one booking per exact Manila date/time slot. Different start times are distinct appointment slots; no variable service-duration overlap model is introduced.
2. The owner specifies a **PHP 100.00 deposit** (`10000` centavos) deducted from the final total at the studio. It is not an additional charge. The policy appears before consent, in PayMongo checkout, on the status page and in receipt emails. Staff verifies the payment reference and applies the deposit when collecting the remaining balance. Automatic POS redemption is not implemented; do not count this advance again as extra service revenue. Existing bookings retain their accepted policy snapshot; already-sent receipts cannot be rewritten. Any exception for an older booking requires staff reconciliation.
3. The temporary hold lasts 15 minutes from backend creation. Selecting a slot alone does not hold it. Only backend verification while the hold is still active confirms it.
4. A payment first verified after expiry is `payment_review`, even if the provider timestamp says it was paid earlier. This conservative rule never displaces a newer booking. Customer and admin receive a payment acknowledgement and review notice. Refunds/rescheduling require studio action in PayMongo; automatic refunds are not implemented.
5. Cancellation releases a confirmed slot and queues customer/admin emails. It does not refund the payment. Gross reporting includes cancelled/review payments and is clearly not net revenue.
6. The generated document is a **payment acknowledgement receipt**, not a claimed BIR tax invoice. Tax invoice issuance remains with the studio.
7. Existing legacy requested/confirmed appointments retain their slot promises through imported `legacy_holds`; they are not treated as verified payments.

## State, security, and recovery

`creating → pending → confirmed`

`creating/pending → expired → payment_review` (only if payment is subsequently verified)

`confirmed → cancelled`

- D1 is the only source of truth for new paid bookings. A partial SQL unique index covers `creating`, `pending`, and `confirmed` slot owners. Legacy holds are also checked by a database trigger. Race losers never create a checkout.
- Client posts name, email, contact, 300-character notes, date/time, explicit waiver/fee consent, and random booking/access identifiers. Prices/status/payment IDs supplied by a client are never trusted. The server fixes amount/currency, validates the latest Firestore schedule and Manila date, checks a per-IP hourly attempt limit, and stores the policy accepted at creation.
- Random access tokens are stored as SHA-256 hashes. Public status access requires a bearer token; public availability returns times only. Return URLs keep access tokens in fragments, not query strings. Preserve the private status URL; do not share it publicly.
- PayMongo signature validation uses **raw** body bytes, HMAC-SHA256, mode-specific `te`/`li`, constant-time cryptographic verification and a five-minute timestamp window. The server independently fetches the checkout with the secret key, checks stored checkout ID, booking reference, mode, paid payment status, PHP and 10000 centavos.
- Duplicate event IDs are recorded, payment IDs are unique, and conditional state transitions are idempotent. Confirmation and notification outbox creation commit atomically through a SQL trigger. Different events for the same payment do not send additional receipts.
- A network timeout creating checkout is ambiguous. Do not blindly create another session. That booking remains `creating` until expiry, unless a signed paid webhook recovers its session using the verified booking reference. A normal API retry reuses the same booking and payload.
- Expired holds are released on relevant API calls as well as cron; availability ignores expired holds even if cron is down. A cron runs every minute, rotates through up to ten checkouts, fetches payments and attempts provider expiry. Provider outages cannot keep local holds forever. An old checkout might still receive a late payment: it goes to review, never double booking.
- Cron reconciliation covers pending checkouts and expired checkouts created within the previous 24 hours. Signed webhooks can recover older payments. Inspect PayMongo dashboard for older/missing webhook cases; no claim of unlimited historical auto-reconciliation.
- Outbox processes up to five messages per run. Customer and admin deliveries retry independently with exponential backoff and stable message IDs and the private Apps Script delivery ledger. `sent` means provider accepted, not confirmed inbox delivery. Check provider delivery/bounce logs.
- Gmail quota errors retry after six hours without a 23-hour cutoff. A durable script-side intent is saved before sending; ambiguous results become `needs_review`. Inspect delivery evidence before manual resend. Preserve ledger rows so old IDs cannot be sent twice. See the Gmail guide for recovery limits.
- Structured Worker logs include action, booking ID and numeric failure code, not email, access tokens or card data. D1 `audit` records verification, cancellations and migration. `last_error` and outbox errors expose safe operational reason codes to staff.
- Staff APIs validate Firebase ID token with Identity Toolkit and verify `staff/{uid}.enabled` using Firestore rules. An enabled staff member can read their own registry document only, never list or modify the registry. No client/admin endpoint can manually mark new bookings paid. Firestore now disallows all new appointment writes and confirmation updates; legacy cancellation/deletion remain staff-only.
- Backend HTTP requests time out; request bodies are capped at 32 KiB, including streamed bodies. Missing payment/email configuration or missing legacy import fails closed.

## Changed pages and dependent features

| Surface | Changes |
| --- | --- |
| `/appointment.html`, placement → schedule → contact | Live availability polling every 10 seconds; disable occupied/unavailable/unverified-availability/past slots; reset time when date changes; Manila calendar correction; required receipt email; clear PHP 100.00 disclosure and consent; backend checkout creation replaces Firestore write. |
| Waiver review modal | Shows the accepted fee policy and payment-specific button before checkout. Shared health waiver text remains unchanged. |
| Payment page | PayMongo hosted checkout, fixed PHP 100.00 line item, full policy, billing email and enabled provider receipt. |
| Success/failure/cancelled/expired/review screens | Dedicated states inside `/appointment.html#booking=...&token=...`; server polling every five seconds. A success redirect alone never renders confirmation. Failed/cancelled attempts reuse the same checkout before expiry. Receipt is printable/saveable after verified payment. |
| Local staff Public Settings | New paid booking/payment panel, authenticated reports, review/notification errors, cancellation and legacy-hold import. Legacy records remain separately visible; manual confirm action removed. |
| Email templates / admin notifications | Plain-text confirmation + acknowledgement receipt; separate customer/admin destinations; review and cancellation notices; durable retry queue. Plain text prevents injected HTML from customer fields. |
| Privacy page | Discloses required email, payment references, consent record, Cloudflare/PayMongo/Google Apps Script processing and retention workflow. |
| Database / rules | D1 migration, slot uniqueness, legacy-hold trigger, event ledger, outbox, audit/rate-limit tables; Firestore legacy appointments cannot bypass payments. |
| Reporting | Separate gross reservation-payment report, review counts, delivery issue queue. Existing cashier totals/CSV are service revenue and do not include online fees. Staff must manually reconcile deposit credit against the final bill; no automatic POS redemption or duplicate ticket revenue. |
| CI | Passes public `VITE_BOOKING_API_URL` from GitHub repository variables during build. Backend deployment is separate. |
| Existing home/popup/aftercare/live queue/standalone waiver, cashier/store/sync/backups | Reviewed; no booking status writes or payment assumptions requiring code changes. Existing seven public build entries and local-only staff app remain. D1 requires separate backup; existing Dexie backup does not include payments. |

## Command troubleshooting on this Mac

Start a new terminal with:

```sh
cd /Users/azifaith/Downloads/PunkTest
source scripts/use-local-tools.sh
node --version
```

The version must be 24 or newer. Running `npm test` with this machine's default Node 22 reproduces module-loading errors; selecting the existing Node 24 runtime resolves them. The helper reuses the downloaded CLI cache and also selects the temporary Java 21 runtime if it is still present. If that temporary folder has been cleaned, put Java 21+ on PATH before `npm run test:rules`.

Command verification on 2026-09-11: Node 24 setup succeeded; 44 app/backend tests and 11 rules tests passed; lint and build passed. Wrangler 4.131.0 `whoami` and Firebase `login:list` confirmed existing logins. `wrangler deploy --dry-run --config backend/wrangler.jsonc` succeeded. `wrangler d1 migrations apply punkture-booking --local --config backend/wrangler.jsonc --persist-to /private/tmp/punkture-d1-command-check` successfully applied all 16 SQL commands to a disposable local database. No remote migration, production rules deploy, or Worker publish was performed during this command check.

On this Mac, the next two **remote** steps (not executed by the command check) are:

```sh
npx --yes wrangler@4 d1 migrations apply punkture-booking --remote --config backend/wrangler.jsonc
npx --yes wrangler@4 deploy --config backend/wrangler.jsonc
```

Accept the migration prompt with `y`. Keep `BOOKING_LAUNCH_READY=false` until the remaining secret/sender/legacy-import setup is complete. Save the Worker URL printed by deploy.

For Cloudflare commands, use `npx --yes wrangler@4 ...` so an initial package-install prompt does not look like a stalled command. A package-registry `ENOTFOUND` error in the restricted agent environment is a network/sandbox issue, not a booking-code failure; use approved network access to download the CLI. Normal terminal network/proxy settings may differ.

On 2026-09-11, `wrangler d1 list` confirmed the existing `punkture-booking` database had zero tables. Its actual ID has now replaced `REPLACE_WITH_D1_DATABASE_ID` in the config. Do not recreate it. If using another Cloudflare account, create a separate database and update the ID accordingly. Missing authentication, a placeholder database ID, and missing secrets/API URL are setup blockers; passing local tests does not supply them. Run commands below in order, without pasting example placeholders as actual values.

## Deployment steps (free accounts; no credentials in source)

Use Node.js **24+**, and Java **21+** for the Firestore emulator. The default Node 22 on this workstation failed the existing ESM test setup; Node 24 runs it successfully.

1. Keep public booking disabled in staff settings during rollout. Do not push to `main` until ready: the existing CI automatically deploys Firebase public pages and rules. It does **not** deploy the Worker.
2. Create a Cloudflare Free account/Worker and D1 database using the dashboard or Wrangler:

   ```sh
   npx wrangler@4 d1 create punkture-booking
   ```

   Put the returned database ID in `backend/wrangler.jsonc`. Keep the free plan and `workers.dev` hostname. Configure `PUBLIC_ORIGIN` to the actual public origin and `ALLOWED_ORIGINS` to exact approved origins (including `http://localhost:5174` for staff). Add the production custom/`firebaseapp.com` origin if used. Do not use `*`.
3. Apply schema to an **empty new** database; never reuse a production DB for testing:

   ```sh
   npx wrangler@4 d1 migrations apply punkture-booking --remote --config backend/wrangler.jsonc
   ```

4. Set encrypted Worker secrets through the dashboard or one-at-a-time Wrangler prompts:

   ```sh
   npx wrangler@4 secret put PAYMONGO_SECRET_KEY --config backend/wrangler.jsonc
   npx wrangler@4 secret put PAYMONGO_WEBHOOK_SECRET --config backend/wrangler.jsonc
   npx wrangler@4 secret put GMAIL_SCRIPT_URL --config backend/wrangler.jsonc
   npx wrangler@4 secret put GMAIL_SCRIPT_SECRET --config backend/wrangler.jsonc
   npx wrangler@4 secret put ADMIN_EMAIL --config backend/wrangler.jsonc
   ```

   Use `sk_test_...` initially; match `PAYMONGO_LIVE=false`. Follow [gmail-setup.md](gmail-setup.md) to create and authorize the script. Use its /exec URL and generated MAILER_SECRET; no EMAIL_FROM or purchased domain is needed; `ADMIN_EMAIL` is the owner's real mailbox. Never use fabricated addresses. Only enable PayMongo methods activated for that account; `PAYMENT_METHODS` defaults to `gcash,card`.
5. Deploy initially with `BOOKING_LAUNCH_READY=false`:

   ```sh
   npx wrangler@4 deploy --config backend/wrangler.jsonc
   ```

6. Register `https://YOUR_WORKER.workers.dev/webhooks/paymongo` for `checkout_session.payment.paid` in the matching PayMongo test environment. Save its signing secret above. Check cron is enabled. [Signature setup](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management), [checkout resource](https://docs.paymongo.com/reference/checkout-session-resource), [provider expiry](https://docs.paymongo.com/reference/expire-a-checkout-session).
7. Set `VITE_BOOKING_API_URL` in `.env.local` for local builds/staff, and in GitHub **repository variables** for CI. It contains only the public Worker URL. Never put secrets in `VITE_` variables. Deploy the restrictive Firestore rules during maintenance before importing legacy holds, so old browser tabs cannot create new legacy promises.
8. Start local staff app, sign in with an enabled staff account, open Public Settings → **Import / refresh legacy slot safeguards**. It imports future requested/confirmed appointments from Firestore into private D1 legacy holds and records a launch prerequisite. Works even while launch is disabled. Nothing is marked paid. Imports are transactional, fail on overlaps with new active bookings, and stop at 1,000 legacy records to require a paginated migration. Review duplicate legacy requests with customers separately.
9. Use a separate staging Worker/D1 for test mode. Set `BOOKING_LAUNCH_READY=true` only after credentials, legacy import and Gmail script are ready; enable booking schedule for tests. Run the staging acceptance tests below. If no eligible email sender is available, leave bookings disabled.
10. After staging acceptance, use a separate empty/migrated live D1, `sk_live_...`, a live webhook/signing secret, and `PAYMONGO_LIVE=true`. Repeat legacy import and verify real sender/admin addresses. The business must have PayMongo activation/KYC completed. Run one explicitly authorized real PHP 100.00 smoke payment and check actual emails/refund handling before broad launch.
11. Validate and deploy public pages and rules:

   ```sh
   npm test
   npm run lint
   npm run build
   npm run test:rules
   npm run deploy
   ```

   Never add staff `index.html` to production entries. Port stays 5174. Do not revert rules to public appointment creation if rolling back the UI; instead pause booking and keep receiving/reconciling payments until all pending sessions are settled.

## Automated and staging test steps

Local: `npm test` covers actual SQL uniqueness, full handler flow with simulated provider responses, signature validation, duplicate requests/events, amount/mode mismatch, expiry/reallocation/late review, ambiguous checkout, email retry and retention cutoff, reconciliation without return, schedule validation, access control, legacy blockers and body limits. Existing component/store/sync tests also run. `npm run test:rules` separately runs Firebase emulator rules assertions.

Staging acceptance, required before a production claim:

1. Select an allowed slot. Check fee scope and PHP 100.00 both before consent and in hosted checkout. Check only PHP 100.00 is charged.
2. Open two browsers on the same slot. Only one checkout is created; the other gets a conflict and sees the slot disabled on refresh. Try a legacy-held slot too.
3. Successful test payment: verify signed webhook → stored paid reference → confirmed status → customer confirmation/receipt → admin notice. Close the customer browser before paying in another tab; delivery must not depend on return navigation.
4. Visit/copy the return fragment without paying: remain pending. Forge a webhook or use a wrong signature/mode/amount: never confirm. Replay the real event twice: one booking, one customer email, one admin email.
5. Fail payment in PayMongo or click cancel: no confirmation; same checkout may be retried. Let the hold expire, verify slot becomes available and checkout is expired by cron. Simulate a late paid event after reallocation: original goes to review, replacement keeps slot, both notices are accurate.
6. Disable webhook temporarily: cron retrieves the paid checkout and confirms it while the hold remains valid. Test provider timeout: no repeated checkout POST and no permanent hold.
7. Use an invalid script signing secret in staging: booking stays confirmed, outbox shows retries. Restore it and verify delivery with the same idempotency key. Verify customer spam folder, Google script deployment permissions and admin recipient. `sent` alone is not inbox proof. Review ambiguous sends manually.
8. Try admin API without login and with nonstaff/disabled staff account: reject. Try public Firestore appointment create or staff direct confirm: reject. Private status lookup with another token must return 404.
9. Cancel a confirmed booking through staff UI: slot frees, notices are sent, report still shows collected gross fee; handle refund in PayMongo. Refresh legacy safeguards after cancelling or deleting a legacy appointment.
10. Check mobile and desktop layouts, disabled button appearance, status reload, receipt printing, schedule blackouts/notice changes, Manila midnight edge, admin list, legacy records, and unchanged local cashier revenue.

## Operations, reports and data recovery

- Worker logs: Cloudflare dashboard or `npx wrangler@4 tail --config backend/wrangler.jsonc`. Do not paste customer access URLs/secrets in logs.
- Staff panel displays newest bookings (up to 500) and newest 100 unsent notification jobs. D1 holds the full ledger; export through restricted admin tooling when a larger report is needed.
- Daily: inspect `payment_review`, `checkout_creation_uncertain`, `needs_review`, bounced mail and failed webhook delivery in both providers. Match `payment_id` against PayMongo and manually handle refunds. No automatic refund accounting is claimed.
- For manual outbox recovery, follow the Gmail guide. Inspect the private delivery ledger and mail delivery evidence; never blindly clear a sending intent or repeat an ambiguous send.
- Back up D1 using Cloudflare export before migrations; existing staff JSON backups contain neither payment records nor outbox. Keep backups private. Use administrative anonymization for approved data deletion while retaining the minimal payment ledger required by the business; do not delete a slot owner as a substitute for cancellation.
- Quotas: remain on free plans and monitor D1/Worker request and mail limits. A quota outage can delay confirmation and mail, potentially resulting in review after expiry. Paid upgrades require an explicit decision; never silently switch plans.
