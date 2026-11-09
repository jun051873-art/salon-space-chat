# P141 — permanent cleanup of an owner-confirmed merged account

Date: 2026-11-09. Builds on P140 (49edf787887a179c7fa2b1c02ba5ab87440af6e9).

## Release boundary

Frontend and implementation are prepared for publication. The production Firestore rules and Cloudflare deployment are **not** verified or changed by this work. The normal `firestore.rules` and `firebase.json` remain unchanged. Candidate rules and a bundled Worker are under `release-preparation/P141/`. A disabled button is not evidence of successful deletion. Backend capability stays off unless `CUSTOMER_CLEANUP_RULES_VERSION=P141` is explicitly configured after deploying and verifying the candidate rules.

This is permanent retirement of a redundant **account**, not just hiding a UI link. Its Firebase Auth login is disabled then deleted. Any phone using that old account loses that login. Do not select the phone/account that must remain usable. This does not migrate an old phone's authentication to the surviving account. A fresh anonymous sign-up with a different UID is a new application, not resurrection of the retired UID.

## Implemented behavior

- Owner identity and exact Firebase project are enforced server-side. Arbitrary customers, primary accounts, different groups, unknown descendants, and existing bookings are rejected.
- Confirmation checks the selected primary, source and group versions. One persisted job per source UID is resumed after interruption; concurrent steps use atomic version preconditions.
- All member writes are locked. Background message creation checks fresh account versions. Frontend feeds suspend during cleanup and reconnect when unlocked.
- Copy files and messages in bounded pages using collision-resistant IDs and native Firestore typed fields. Verify copied content before switching the group; re-verify each destination under a version guard before deleting the corresponding source.
- Preserve history, attachments, notes, tags and latest visit in the selected primary. Transfer feedback; remove obsolete device tokens, source-targeted reminders and reverse links. No other customer's profile is deleted.
- Retain a minimal retirement marker and job/audit identifiers to block stale writes. This intentionally does not mean erasing every identifier from all audit records or backups. The user requested retaining the consolidated history.
- Unknown or inconsistent data stops progress instead of guessing. There is no automatic unlock/rollback after a partial migration: fix the specific discrepancy and resume the same job.

## Executed checks

- `npm test`: all existing tests passed, including P140 lifecycle and chosen-primary regressions.
- `npm run test:cleanup`: bounded paging, name collisions, attachments, notes, lost response/retry, concurrent steps, altered destination refusing deletion, idempotent completion; DOM confirmation and distinct authentication/confirmation tokens; feed lock/recovery.
- `npm run test:conversations`: shared histories and worker shared-device token behavior passed.
- `npm run test:cleanup-rules`: Firestore Emulator, synthetic `demo-salon` only. Normal merge and shared avatar save; owner/customer writes denied during locks; deleted UID cannot recreate users/chats/tokens/links; full REST migration keeps native timestamps; survivor can still save profile.
- Worker bundled with `esbuild@0.25.12`, ES module format. Firebase Auth update/delete are mocked in tests: actual IAM permissions and Auth deletion require a separate, explicitly authorized test account.

## Not verified in production

Candidate rule deployment, Worker/service-account IAM, real Firebase Auth retirement, iPhone/Play-installed Android synchronization, deployed-version/cache behavior on those devices, and a full permanent-cleanup acceptance run. No production customer data was read or modified for these tests.

## Shortest device acceptance

1. Before deleting anything: use only your test accounts, confirm the selected primary and linked iPhone/Android identities. Keep Android customer screen and the shop chat open (shop can be in an additional browser tab).
2. On iPhone change avatar and name, save once. Android customer and shop chat should update without reload. Then remove the avatar: both must clear it without reload. Reverse the direction once. Record versions and any permission error.
3. Permanent deletion is a separate test: select a **redundant test login**, confirm all history and attachments are visible in the chosen primary, then run cleanup. The retired phone's old login should stop working; the preserved login should still send/receive messages. Reopen the shop list: exactly the chosen primary remains, with no old link. Do not expect a deleted login to continue syncing.
