# C18 implementation checkpoint — 44 requirements

Status: IN PROGRESS, NOT DEPLOYED. Never present this branch as a complete release.
Base: 84298f5c3fa717f731cc30c5518fbbb2043d5e0d.

Customer revocation: the owner specified Amy and supplied a phone number in the private conversation. Match both in Firebase before any account action. Do not put private phone data in this repository. Firebase browser was signed out; authentication attempt was interrupted. No customer has been revoked yet.

Implemented locally, integration/device acceptance still required:
- 1 / 16: separate customer/store bubble and text/border colors in theme editor.
- 2–5: wider bottom nav with phone/messages/booking/products; profile left, info/map/settings/report right.
- 7–8: Worker sender name / configurable shop name and friendly attachment summary.
- 9–12: product detail gallery, five ordered pictures, regular/sale price, responsive list and inquiry draft preservation.
- 13 PARTIAL: pending signup, owner approval/reject UI, active-account backend gates. New URL migration, production rules, named revocation remain pending.
- 18–19: merged attachment chooser and persistent close-button circle.
- 20–26 PARTIAL: info blocks with drag/up/down order and visibility, custom amenities, scheduled board cards, landing announcements, feature detail. Product reuse/feature scheduling need finishing.
- 27–30: notification status, marketing opt-out, local reading preferences, help and data-removal request.
- 31–33 / 35–37 PARTIAL: camera/photos shortcuts, textarea auto height, compact tool sheet, smaller admin icon grid; physical-device keyboard and camera checks pending.
- 38: shorter centered admin heading CSS.
- 41–43 PARTIAL: all eligible customers by default, optional recipient list, text/photo/product blocks, local draft, preview, deterministic per-recipient message IDs. Multi-tag union, failed-only retry and persistent result reporting need finishing.
- 44: long-press preview of latest 12 messages. Independent one-shot read; no receipt writes, no live-chat lifecycle. Movement cancels, opening click suppressed, cached 15 seconds, max 20 rooms. Tests cover press/move/cancel/cache. Needs device and UI acceptance.

Still outstanding:
- 6: configurable installation/notification icons and role colors.
- 13: new URL, links/QR/manifests/service worker migration and deployed access controls.
- 14–15: final separate chat header pills and smooth back animation.
- 17: clear sticker storage or styled phrase replacement.
- 23–26: remaining shared content builder behavior and return scroll preservation.
- 34: voice messaging requires authenticated external binary storage, not Firestore base64; not yet implemented.
- 39–40: contact shortcuts and bounded server-backed search.
- 43: broadcast result/retry completion.
- All: mobile UI inspection, Firestore emulator gate, deployment verification.

Validation so far: existing npm test suite passes; chat-preview unit test passes; edited JS and extracted customer module syntax checks pass. Rules emulator has not run (dependencies/CLI unavailable locally). These tests do not constitute mobile or production verification.

Deployment order: validate rules, deploy backend rules/Worker, then publish compatible frontend and retire old entry. Do not publish pending-signup frontend against old rules. Do not send real test broadcasts.
