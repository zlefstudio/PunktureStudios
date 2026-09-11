# Free Gmail sender setup

This replaces Resend. No custom domain, Workspace subscription, Gmail API OAuth client, or billing upgrade is needed. The website stays on Firebase. Google Apps Script MailApp sends from the Google account that deploys the script. Personal accounts have a 100-recipient daily Apps Script quota shared with their other scripts: roughly 50 bookings/day for customer + admin notices, fewer with cancellation/review emails. Check [Google's current quotas](https://developers.google.com/apps-script/guides/services/quotas). No automatic paid upgrade is implemented.

## 1. Create the Google script

1. Sign into the Gmail account that should send booking emails.
2. Open https://script.google.com and select **New project**. Name it **Punkture Booking Emails**.
3. Open the local file `backend/apps-script/Code.gs`, copy its entire contents, and replace the default contents of **Code.gs** in the Google editor. Save.
4. In the function dropdown above the editor choose **setupMailer**, then **Run**. Do not run `doPost` from the editor: it expects a signed backend request.
5. Authorize your own script to send mail and manage its delivery spreadsheet. Google may show an unverified-app notice because this is your private script; confirm the project/account is the one you just created. Setup itself sends no email.
6. Successful output says **Setup complete**. It creates a private spreadsheet named **Punkture email delivery ledger — private** and generates a secret in Script properties. Re-running setup does not replace existing values.

## 2. Deploy the Google script

1. Click **Deploy → New deployment → Select type → Web app**.
2. Choose **Execute as: Me** (your sender Gmail account).
3. Choose **Who has access: Anyone**. The backend cannot use a deployment requiring Google sign-in. HMAC authentication inside the script still rejects unsigned email requests.
4. Click **Deploy** and copy the Web app URL ending in **/exec**, not /dev.
5. Opening that URL in a signed-out/incognito browser should show JSON identifying **Punkture Gmail mailer**. It does not send mail or expose secrets. If it asks for Google login, fix the access setting. If your account policy does not allow Anyone, use a personal Google account; do not buy Workspace.
6. Open **Project Settings (gear) → Script properties**. Copy the value of **MAILER_SECRET** privately. Do not edit/delete **MAILER_LEDGER_ID** or share the ledger publicly.

## 3. Connect the Worker

In Terminal:

```sh
cd /Users/azifaith/Downloads/PunkTest
source scripts/use-local-tools.sh
npx --yes wrangler@4 secret put GMAIL_SCRIPT_URL --config backend/wrangler.jsonc
```

Paste the Google Web app /exec URL at the hidden prompt. Then:

```sh
npx --yes wrangler@4 secret put GMAIL_SCRIPT_SECRET --config backend/wrangler.jsonc
```

Paste the **MAILER_SECRET** from Google Script properties (not either PayMongo secret). Then:

```sh
npx --yes wrangler@4 secret put ADMIN_EMAIL --config backend/wrangler.jsonc
```

Paste the email address that should receive booking notifications. This can be the same Gmail account as the sender. The sender is automatically the Google account that deployed the script; no EMAIL_FROM setting is needed. Existing PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET stay configured. Resend settings are unused by this code.

Deploy the updated Worker code:

```sh
npx --yes wrangler@4 deploy --config backend/wrangler.jsonc
```

Keep `BOOKING_LAUNCH_READY=false` while configuring. Do not assume a successful deploy means email delivery is proven.

## 4. Finish and test the booking flow

Ensure D1 migrations, restrictive Firestore rules, `VITE_BOOKING_API_URL`, and legacy slot import are complete as described in `docs/booking-workflow.md`. With PayMongo still in test mode and after Gmail setup, enable the launch flag and booking schedule for a controlled test. Redeploy Worker after changing the flag.

Complete a PayMongo sandbox booking. Check actual customer inbox/spam, the admin inbox, D1 outbox and the private delivery sheet. Customer and admin emails are independent jobs. No actual inbox test was performed by the local automated tests. The script uses MailApp's return value as service acceptance; that is not proof of final inbox delivery. Print/save the acknowledgement receipt from the status page if needed.

For later script changes, save Code.gs, then **Deploy → Manage deployments → Edit → New version → Deploy** to keep the same /exec URL. Do not create a new ledger or change the mailer secret during normal updates.

## Reliability and recovery

- The Worker signs each message with HMAC-SHA256 over the timestamp and exact payload. The script rejects invalid/stale (over five minutes) requests and recipient/header injection. No customer browser possesses the shared secret.
- A script-wide lock serializes check-and-send. The private sheet stores only job ID, payload hash, status and timestamp, not email bodies or addresses. Keep it private and do not delete sent rows: it is the durable duplicate-delivery protection.
- A `sending` intent is flushed before calling MailApp. A duplicate `sent` request returns success without sending again. Changed payload for the same ID or an interrupted/ambiguous send returns `needs_review` and the Worker stops automatic retries for that job.
- MailApp cannot atomically send and update a ledger. If execution crashes between these steps, a message may need manual review. Do not claim exactly-once inbox delivery. Inspect Gmail delivery evidence/customer confirmation before resolving such a job; never clear intent blindly. If definitively unsent, an operator can remove only that intent row and requeue only that D1 outbox job. If sent, mark the ledger/D1 job sent without sending again.
- Quota is checked before an intent is recorded. `email_quota_exhausted` stays pending in D1 and retries after six hours, including across daily resets. Other network errors retry with capped exponential backoff. There is no Resend-style 23-hour cutoff.
- Spreadsheet/auth/endpoint failures do not undo a verified booking; pending or needs_review jobs appear in staff settings. If the free quota is too low, reduce volume or wait for reset; no paid service is enabled automatically.
- This migration assumes the current installation has never sent via Resend (the owner has no verified domain). If migrating a different installation that has ambiguous pending Resend jobs, reconcile those in Resend first and mark them reviewed before switching transports, to avoid duplicates across providers.

## Verification

Local tests execute the actual Apps Script source in a mock Google-services runtime and exercise the Worker-to-script signed message flow. Tests cover tampering, stale timestamps, duplicate requests, payload changes, quota exhaustion, lock contention, uncertain sends and lost HTTP responses. Actual Google deployment, permissions and inbox delivery still require the manual setup and sandbox test above.

Official references: [Web app deployment](https://developers.google.com/apps-script/guides/web), [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app), [ContentService redirects](https://developers.google.com/apps-script/guides/content).
