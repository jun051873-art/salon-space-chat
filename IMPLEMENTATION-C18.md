# SALON 44-item release checkpoint

Status: implementation work is not yet published. This checkpoint does not claim all 44 requests are complete. Release target keeps the existing customer URL and the existing Amy customer record; it does not request account deletion or URL migration.

## Implemented in the current local build

- Customer and store appearance controls, glass cards, responsive page layouts, chat tools, appointment inquiry, product details/gallery/pricing, configurable store information, information-block ordering, notice/board cards, owner-managed customer tags, feedback collection, customer approval UI, and long-press read-only message preview.
- Broadcast audience defaults to all eligible opted-in customers; optional tag union and individual selection remain available. Draft content persists locally. Delivery has stable message IDs, persisted progress, and a failed-only retry that reuses the original outbox entry.
- Sticker send entry points were replaced with quick phrases; old sticker records and editor code remain in the database/source and have not been purged.
- The customer and admin pages now request the C19 asset version so browsers invalidate the previous C18 build.

## Still incomplete or not verified

- #6: custom app/notification identity and complete per-role color choices need final UI wiring and device acceptance.
- #13: approval depends on the updated Firestore rules being deployed; changing the public URL is explicitly out of scope.
- #14–15: final chat header and back-navigation transition need visual and device acceptance.
- #17: sticker data has not been deleted; replacement quick phrases are present.
- #23–26: shared content/feature scheduling and exact scroll restoration need review; some block ordering, notices and featured-card behavior are present.
- #34: voice message recording/upload is not implemented. It needs authenticated binary storage and is not safe to emulate with Firestore base64.
- #39–40: one-tap call/map entries exist, but a fully bounded server-backed search/contact flow still needs completion.
- #43: broadcast report/retry code is implemented locally; live Firestore rules and real delivery result reconciliation need deployment verification. No broadcast was sent.
- #44: long-press preview logic and unit tests are present; iOS/Android gesture acceptance remains outstanding.
- Firestore production rules and the Cloudflare Worker have not been deployed/verified. Full mobile acceptance on iOS, Android and non-Chrome Android browsers has not been completed.

## Verification

- `node --check salon-suite.js`: pass.
- `npm test`: pass, including delivery retry/idempotency, notification, appointment, theme, customer record, bounded feed, and long-press preview tests.
- `npm run test:rules`: pass against the local Firestore emulator after enabling localhost port binding.
- These checks do not establish production deployment or physical-device behavior.

## Release order and constraints

1. Publish and verify `firestore.rules` before publishing the customer signup UI, because the new signup flow creates pending accounts.
2. Deploy and verify `cloudflare/worker-suite.js` plus its documented UTC Cron Trigger before enabling scheduled care/keyword replies. Keep automations disabled until a heartbeat is confirmed.
3. Publish the C19 frontend to the existing customer URL and verify the live assets.
4. Do not send test broadcasts. Do not change customer URLs or delete Amy's customer record.
