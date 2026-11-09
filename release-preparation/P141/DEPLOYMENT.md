# P141 deployment with booking-transfer follow-up

Do not run these steps until the user separately approves production Firebase rule deployment and backend activation. This preparation did not access or alter real customer records.

## Why a backend/rule deployment is necessary

Current client rules prohibit deleting an ordinary customer's `users/{uid}` document. Browser hiding/revocation cannot implement permanent consolidation. Broadening browser delete permission would also allow loss of untransferred history. The prepared backend instead verifies every copied document, deletes in resumable batches, and retires the original login. Candidate rules prevent old clients and concurrent owner sessions from recreating or changing the source during cleanup. They retain P139's shared profile permission, so older pre-P139 production rules can also explain failed photo/profile saves.

## Review before activation

1. Confirm Firebase project `salon-space-chat`, owner UID and existing Worker `salon-space-notify`. Export the currently deployed rule source and Worker version/config for review; do not infer deployed rules from GitHub. Preserve secrets, existing bindings and the single `* * * * *` cron. Do not create a second worker or schedule.
2. Compare `firestore.rules` with `release-preparation/P141/firestore.rules`; run `npm test`, `npm run test:cleanup`, `npm run test:cleanup-rules`, `npm run test:conversations`.
3. Confirm the existing service account has the needed Firestore access and Firebase Authentication user update/delete permissions (`firebaseauth.users.update`, `firebaseauth.users.delete`). Grant only the necessary permissions; do not grant Owner/Editor. The enabled backend requests the Cloud Platform OAuth scope for Identity Toolkit; an OAuth scope alone does not grant IAM access.

## Authorized deployment order

1. Deploy the new bundled Worker with `CUSTOMER_CLEANUP_RULES_VERSION` still unset. In the existing Cloudflare worker editor use **the full `worker-bundle.js` in this directory**, not the unbundled `cloudflare/worker-suite.js` (it now imports modules). Preserve all existing secrets/bindings/cron. GET should report version `17-permanent-merge-cleanup`, capability false. Verify existing notifications still work with your own test account.
2. Deploy only the reviewed candidate Firestore rules, explicitly targeting the project, from the repository root:

   ```sh
   npx firebase deploy --project salon-space-chat --config release-preparation/P141/firebase.json --only firestore:rules
   ```

   Read back the deployed rules and compare to the candidate. Verify normal owner access and cross-device profile saving with your own data before enabling cleanup.
3. Set `CUSTOMER_CLEANUP_RULES_VERSION=P141` on that same Worker and redeploy. GET must show `features.permanentMergeCleanup: true`. Confirm the frontend is P141. This flag is an operator attestation that the rules were deployed, **not** an automatic rules verification.
4. Use only an explicitly chosen redundant test account to verify preview, retirement, preservation of history/attachments and survivor login. Never run deletion on a real customer to test permissions.

## Impact and recovery

- Only the explicitly confirmed group is write-locked during a cleanup job. Other groups remain usable. After interruption, reopen its primary profile and select “接續清除”; the same persisted job resumes.
- The source login is disabled/deleted, so its phone will no longer use that account. Preserve the account used by the phone you intend to keep. Cross-device sync tests precede deletion; authentication migration is not part of this release.
- Existing scheduled reminders addressed to the source are removed. Check/reschedule desired reminders on the primary before permanently retiring a source. Bookings are transferred in place to the retained account: only `userId` changes. IDs, dates, time slots, status and native field types remain unchanged. Each batch is read back and verified before the old login is disabled. Unknown booking subcollections stop cleanup. This does not modify any separate booking application.
- Keep the retirement rules and worker guards after the first job starts. Do **not** downgrade to old rules, remove the P141 flag, or restore an old Worker after retirement: older writers can recreate removed data. Do not delete retirement markers. Investigate/resume stuck jobs rather than forcibly unlocking or dropping their state.
- Rule rollback to the exported previous version is only safe **before any cleanup has started**. After that, use a forward fix that retains the guards.

Official API reference: https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/update and https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/delete .

## Booking-transfer follow-up (2026-11-09)

For installations already running P141 rules with cleanup enabled, replace the existing Worker script with the updated full `worker-bundle.js` and deploy. Keep `CUSTOMER_CLEANUP_RULES_VERSION=P141`, all secrets, bindings and the existing cron. Do not disable the gate or revert the rules. GET must report `18-booking-merge-cleanup` and `permanentMergeCleanup: true`. No Firebase rules redeployment is required.

Jobs stopped by the previous booking preflight have not started; open permanent cleanup again. Jobs paused in `auth-disable` can resume with this update. Verify with the user's selected test account that bookings retain dates, slots and statuses, the retained account can read them, the retired account cannot, and the old account is removed only after verification. Production Auth API execution still requires device acceptance.
