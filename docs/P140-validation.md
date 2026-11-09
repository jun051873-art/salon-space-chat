# P140 — preserve merged member lifecycle and the selected primary

## Released behavior

- Customer-list live updates copy only shared identity and private display fields from the resolved primary. The member's own ID, deletion flag, merge mapping, status, tags and routing remain attached to that member. Fresh account lifecycle events still apply.
- Initial customer-list hydration retains explicit empty avatar/cover values instead of reviving local old values.
- The record opened by the owner is the primary for a new merge, regardless of account age. The confirmation states this choice.
- Merging another account into an existing group preserves explicitly cleared shared profile fields and does not unarchive historical rooms.
- Both entry pages report P140 and request the updated module versions.

## Verification

- Existing `npm test` passed before adding the new regression to the default script.
- `node tests/merged-customer-lifecycle.test.mjs` passed: real customer-page DOM/listener wiring, repeated deleted/merged member updates, real merge-dialog selection, and actual merge transaction behavior for cleared photos and archived rooms.
- `npm run test:shared-profile` passed with the existing rules in the local Firestore Emulator (demo-salon). Includes customer save transactions, shared-profile authorization, general rules and shared-conversation rules.
- No production customer reads, merges, edits or deletes were performed.
- No Firebase rules or backend deployment was performed. Physical iPhone/Play Android tests remain pending.

## Explicit remaining boundary: permanent consolidation/deletion

P140 does **not** add permanent deletion. The existing linked-entry removal is still reversible hiding. Historical messages/files still reside in their original rooms. Do not describe P140 as a permanent-deletion release.

The existing browser rule for users/{uid} permits deletion only when the administrator is also that UID; it cannot delete an ordinary customer record. Frontend-only deletion cannot satisfy the requested full cleanup. Existing owner-only manual erasure tooling explicitly rejects merged accounts; it is not a merge migration tool.

The next implementation must provide an owner-authenticated, resumable backend operation: freeze the exact selected source accounts, copy messages/files with collision-safe IDs and rewritten attachment references into the chosen primary, verify content and counts, update all membership/history/notes/push/background-job references, then erase the redundant personal records and source data. A non-personal revocation marker (plus corresponding access checks) or an equivalent authentication invalidation strategy is required so old devices cannot recreate the deleted account. Preserve both active-device access requirements and a precise preview of which device logins will stop before destructive confirmation.

Deploying P139 rules can enable shared-profile saves but does not implement this cleanup. Before any Firebase rule deployment, inspect the currently active production rules for project salon-space-chat, preserve a rollback copy, compare the full diff, run authorization tests, and obtain the user's separate confirmation as requested. No broad allow-write/delete workaround is acceptable.
