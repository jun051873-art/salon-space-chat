# C23 — selected pending items 1 and 2

Scope: customer profile saves and notification identity/icons. Items 3 and 4 canceled. Existing URLs and customers unchanged.

Implemented:
- Atomic customer profile/conversation identity transaction, changed fields only, legacy customer role repair, no client status rewrite, actionable errors retaining form input.
- Separate shop/customer notification icons (four configurable palettes); static manifest PNGs and browser touch icons.
- Shared service worker notification presentation with role-specific icons, safe destination handling and cached branding. Server title takes precedence.
- Shop settings > notification identity controls both palettes.

Verification:
- npm test passed, including actual Worker source payload tests for customer names, shop rename and readable sticker preview.
- Firestore emulator existing rules suite and new profile transaction suite passed: valid saves, private data preservation, blocked rollback, pending rejection, legacy records.
- Changed scripts and embedded HTML modules passed syntax checks.
- Production Worker GET reports version 6-care.

Pending verification:
- 2026-10-10 08:12 Asia/Taipei: Firebase sign-in succeeded after user verification. Current starred rules release (2026-10-09 22:33) inspected in console. Deployed owner/profile fields, active status, users create/update, chats create/update and message rules (lines 1–27) match the locally emulator-tested rules. No new rules deployment needed for this profile change. Remaining rules outside the selected scope were not re-audited.
- No real customer messages sent; no physical Android/iOS/watch end-to-end notification verification. OS status bar icons can remain monochrome; existing iOS installed icon metadata may not refresh immediately.
