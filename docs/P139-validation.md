# P139 — live merged identity and return paths

## Changes

- Customer-owned identity is projected onto an owner-confirmed conversation group. Membership, account state, private shop aliases/notes and push credentials are not editable through this projection.
- New merges initialize the projection transactionally. Existing groups initialize when the owner reads them. Existing conflicting fields retain the previously chosen primary-account precedence; there is no reliable historical per-field edit timestamp to infer a different winner.
- Customer saves apply only fields changed from the editor baseline, atomically to their own record and the shared projection. Empty photo/cover values clear the projection. Birthday is saved as a pair.
- Shop chat, visible conversation list, customer list and read-only customer details observe identity updates. Customer home/profile observe their own account and shared projection. Listener cleanup rejects late callbacks. Open editors retain unsaved changes.
- Shop back navigation preserves the entry path through nested tools and chat. Customer chat returns to its entry path. Profile back closes the photo lightbox or editing sheet first, then editing mode, then the profile. Saving stays on the profile.

## Verification

- `npm test`: passed (81 PASS output lines, including existing regressions and new identity/DOM/navigation tests).
- `npm run test:shared-profile`: Firestore emulator profile transaction, shared-profile authorization and existing rules/shared-conversation tests.
- New emulator checks: either merged member changes identity, a stale editor preserves another device's photo, photo/cover removal, birthday pair, blocked/outsider rejection, membership and primary-account protection, no access to the other member's private user document, no shop overwrite of customer avatar.
- New DOM checks: nested editing sheet, cancel editing, avatar lightbox, profile close, save stays open, incoming identity changes preserve dirty fields.
- `git diff --check`: passed.

## Deployment gate / limits

Deploy `firestore.rules` before publishing P139 frontend. Otherwise merged customer saves are rejected by the old rules. No production merge or customer data edit was executed during this work. The current browser environment has no retained Firebase sign-in. Production two-session verification and physical iPhone / Play-installed Android checks remain pending; unit/DOM/emulator results are not a claim that those devices have passed.

After authorized rules deployment and frontend publication, verify with dedicated test accounts: open both sides; update avatar/name/cover from each merged member; verify chat and home without reload; delete a photo; edit separate fields concurrently; navigate photo editing → profile → original chat; navigate shop home → tool menu → nested tool → back.
