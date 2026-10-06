# salon-space-notify v4

Replace the source of the existing `salon-space-notify` Cloudflare Worker with `worker.js`, then deploy. Keep its existing workers.dev address and its three existing secrets unchanged:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

The matching admin.html/customer.html client change must be live before deploying this Worker. It includes the Firebase ID token, conversation ID, and persisted message ID in notification requests. The previous Worker ignores these extra fields, allowing the client update to be deployed first. Older open pages should be reloaded before sending notifications.

GET / returns version `4-reliable`. This verifies deployment only, not end-to-end FCM delivery.

The Worker authenticates the caller, reads the actual saved message, resolves new and legacy device token records with pagination, caches the Google OAuth token, and reports FCM acceptance/error counts. It performs no Firestore writes. A successful FCM response means accepted by FCM, not that a device displayed the notification. Stable message tags reduce duplicate visible notifications; exactly-once push delivery across retries is not guaranteed without durable server deduplication.

Known deployment blocker on 2026-10-06: Firestore Spark write quota exhausted. The frontend keeps new pending messages on the device and backs off quota retries. Backend writes and end-to-end messaging cannot be verified until quota is available. No billing changes have been made.
