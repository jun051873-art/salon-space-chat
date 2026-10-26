# salon-space-notify v4

Replace the source of the existing `salon-space-notify` Cloudflare Worker with `worker.js`, then deploy. Keep its existing workers.dev address and its three existing secrets unchanged:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

The matching admin.html/customer.html client change must be live before deploying this Worker. It includes the Firebase ID token, conversation ID, and persisted message ID in notification requests. The previous Worker ignores these extra fields, allowing the client update to be deployed first. Older open pages should be reloaded before sending notifications.

GET / returns version `4-reliable`. This verifies deployment only, not end-to-end FCM delivery.

The Worker authenticates the caller, reads the actual saved message, resolves new and legacy device token records with pagination, caches the Google OAuth token, and reports FCM acceptance/error counts. It performs no Firestore writes. A successful FCM response means accepted by FCM, not that a device displayed the notification. Stable message tags reduce duplicate visible notifications; exactly-once push delivery across retries is not guaranteed without durable server deduplication.

Known deployment blocker on 2026-10-06: Firestore Spark write quota exhausted. The frontend keeps new pending messages on the device and backs off quota retries. Backend writes and end-to-end messaging cannot be verified until quota is available. No billing changes have been made.


## Time-based replies (7-time-replies)

Deploy `worker-suite.js` to the existing salon-space-notify Worker, preserving all existing secrets, bindings and Cron triggers. GitHub Pages deployment does not deploy this Worker. GET / must report `features.timeReplies: true` before the admin can enable the three rules.

Settings are in announcements/settings.timeReplies with business/outside/holiday each containing enabled and text. All default disabled. Configure weeklyHours for business/outside rules; holidays/YYYY-MM-DD overrides a working day. Fixed weekly days off also use holiday. Source creation time in Asia/Taipei selects the category; a matching enabled keyword reply takes priority over time replies. The existing deterministic auto_<sourceId> message ID and create-only transaction prevent duplicate replies on retries. The authenticated message-notification request triggers this logic, including attachment messages; a delayed or failed client request can delay automation. No Firestore trigger or always-on phone is assumed.

Rollback: redeploy the prior worker-suite.js from commit 77c7454512ab14ce6a57d9d87119311a799edf87. This leaves all conversations and configuration intact. No new secrets, billing changes or scheduled tasks are required.


## N56.1 manual deployment — version 11-care-calendar

Use the complete `worker-suite.js` (not the legacy `worker.js`) in the existing
`salon-space-notify` Worker. Preserve secrets, URL, bindings and existing data.
GET / should report `11-care-calendar`. No Firebase rule changes are required.

In Cloudflare Settings > Triggers > Cron Triggers, inspect the existing schedule.
For hourly daytime checks in Taiwan use `0 2-12 * * *` (UTC; Taiwan 10:00–20:00).
Use one matching schedule rather than adding duplicates. Scheduling checks does not
enable draft rules. After the first successful scheduled run, open the admin
自動提醒 page and enable only the intended rules. A new Cron can take 15 minutes
to propagate; execution waits until its next scheduled time.

Priority: configured keyword answer, otherwise enabled holiday/outside/business
reply. One automatic chat message per source message. Birthday: once per rule per
year on the exact birthday; visit/inactive: once per rule per last visit/message.
Days use Taiwan calendar dates. Missing dates, invalid days, disabled rules,
blocked/pending customers, merged-away records and marketing opt-outs are skipped.
A customer failure does not stop subsequent customers. Runtime records sent,
failed and deferred counts; at most 300 new messages per run. Later runs can catch
remaining eligible recipients, subject to Worker/Firestore quotas.

Notifications: incoming customer messages alert the shop; automatic answers/care
alert customer devices, excluding tokens also registered to the owner. Chat
messages persist even if notifications are disabled. Push delivery is best effort:
a failed token/FCM call after message creation is not automatically retried.
Welcome copy is an in-app onboarding display, not a scheduled push. Group sends
are manually initiated in the admin app. Neither is enabled by the Cron.

Verification: check version, send a NEW configured question, check both chat views
and device notifications, and inspect the admin schedule status after a scheduled
run. Mock tests do not prove production credentials, quotas, Cron or phone delivery.


## N69: per-customer visit care — version 12-personal-visit-care

Deploy the complete `cloudflare/worker-suite.js` to the existing
`salon-space-notify` Worker (not `worker.js`). Preserve all secrets, bindings,
URL and existing Cron triggers. No Firebase rules change is needed.
GitHub Pages publication alone does not deploy this backend.

The frontend enables personal care only when GET / advertises
`features.personalVisitCare: true` and broadcasts/_runtime has a successful
heartbeat within 36 hours. Until then, date registration works, and existing
legacy generic visit rules continue to apply. Do not claim personal reminders
are enabled before this check passes.

Admin: 訊息 → customer ⋯ → 到店與關心. Today records Taiwan noon, preserving
an existing timestamp on the same date. Personal choices write two stable,
recipient-specific automation records (kind personalVisit, days 7 and 30),
and users/{uid}.visitCareManaged=true, atomically. Disabled personal rules remain
stored, and the managed marker suppresses generic visit rules even for no-reminder.
Birthday/inactivity rules are unaffected. New kinds are ignored by old workers.
Rules apply to each newly recorded visit until changed; editing content or toggling
a rule does not change its deduplication ID. Selecting an already overdue interval
makes it eligible on the next scheduled check. Blocked/pending/deleted/merged and
marketing-opt-out customers are excluded. No customer records or enabled rules
were created by the implementation/testing workflow.

Validation: npm test; browser harness tests the real visit-care module at
320/390/768 pixels with mocked writes. Physical phone delivery and live Cron
execution require verification after deployment.
