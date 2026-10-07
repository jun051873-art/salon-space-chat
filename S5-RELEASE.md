# SALON S5 — 2026-10-07

## Frontend and Firestore
- Existing app URLs, Auth identities, Firestore project and durable v3 outbox keys preserved.
- Ivory/glass shared style; own messages right, peer left; message edit/retract and beside-bubble receipts.
- Receipt writes a monotonic room watermark, only while visible and at bottom, coalesced for two seconds. No per-message readAt updates. Legacy readAt remains prohibited in rules.
- Customer profiles: name, phone, birthday month/day, optional gender and compressed avatar. Admin can edit, tag, record visits, block, archive/restore. Admin notes in a separate admin-only collection.
- Recency tags are computed, not written daily. Last incoming message and actual visit are distinct. No full-history backfill; unknown historical last incoming timestamps are shown as unknown.
- Customer management scans profiles and chat summaries on demand and caches for five minutes. No customer-list polling. Chat remains bounded to 30 live documents and explicit older pages.
- Broadcast requires explicit recipient selection and confirmation, queues separate durable messages on the admin device. Keep the page open to finish; reopening resumes pending work. No real broadcast was sent during implementation.
- Products with compressed photo; store announcement, contact info, editable holidays; configurable customer quick-answer buttons; welcome shown after signup.
- Self-service booking requires merchant configuration first. One customer per configured slot. Atomic booking + availability transaction; cancellation releases slot. Store records visits on completion. Availability carries no names or phones. Booking data is owner/admin only.
- Small attachments are stored separately from message documents. JPEG compressed to <=400,000 data-URL characters; PDF/text <=300 KiB. A normal text send remains two document writes; an attachment adds one. Large files are not supported; use a share link.
- Anonymous device identities are preserved. Rejoining with the same identity restores the profile to recent joiners. Different devices or cleared browser data create different identities; matching name/phone does not silently merge accounts.

## Cloudflare deployment boundary
The live Worker remains **4-reliable**, which supports existing message notifications. `cloudflare/worker-suite.js` is a prepared **5-suite** replacement, not deployed by this release. Cloudflare's cloud-browser login reported a verification error. Therefore:
- Birthday/inactivity automation is stored as disabled drafts.
- Free-text exact-keyword automatic replies remain disabled; customer quick-answer buttons work immediately.
- Do not label background automation active until Worker and Cron are actually deployed and its `_runtime` heartbeat is visible.

To complete deployment once access is available:
1. Replace the Worker with the complete `cloudflare/worker-suite.js`. Reuse the existing three Firebase secrets; no new billing services are needed by this code.
2. Add **one** Cron Trigger `0 1 * * *` (09:00 Asia/Taipei; Cloudflare cron uses UTC).
3. Confirm daily heartbeat at `broadcasts/_runtime` before enabling rules in the admin UI. The UI enables scheduled-care switches only after a heartbeat within 36 hours.
4. Explicitly enable chosen automation drafts. Each birthday is once per year; inactivity is once per last-incoming-message timestamp. Archived/blocked customers are excluded. Deterministic message IDs suppress duplicate writes; FCM acceptance does not prove device display.
5. Turn on exact-name keyword replies in settings if desired. Responses use merchant configured content only.

## Verification
- Existing delivery/feed tests: pass.
- Model tests for tag/date/filter/receipt/idempotency logic: pass.
- Firebase emulator: owner isolation, notes privacy, message edits, legacy readAt denial, monotonic receipts, blocked sends, files, double-booking, cancellation/rebooking: pass.
- Physical iPhone background notifications cannot be revalidated from this environment. Existing notification routing is retained. Do not infer successful chat or notifications from Worker health JSON.
