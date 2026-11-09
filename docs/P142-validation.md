# P142 — booking references during P141 cleanup

The production recording showed the cleanup preflight refusing an old account that still had `bookings.userId` references. The old guard did not distinguish completed, cancelled or active bookings.

The backend now transfers up to four existing booking documents per step by changing only `userId`. The transfer and verification manifest are committed together with update-time preconditions. A following step compares raw Firestore field hashes and commits guards before advancing; interruption resumes from the same manifest. No booking is deleted or recreated, and availability is unchanged. Unknown subcollections and verification mismatches fail closed. A final source-reference check precedes Auth deletion. Existing jobs without booking progress remain compatible.

Validation: cleanup unit tests cover 11 bookings across all three statuses, timestamps, custom fields, unrelated bookings, availability, failed commits, concurrent steps, changed destinations and unknown subcollections. Firestore Emulator uses nine synthetic bookings, real REST patches and readback, checks locks after transfer and read permissions after retirement. Authentication disable/delete is mocked, not executed against production. The general npm suite is also run.

Deployment: only the existing Cloudflare Worker bundle changes. Keep the already-deployed P141 rules and P141 gate. Health version: `18-booking-merge-cleanup`. No production customer records were accessed or modified during implementation. Manual deployment and the selected test-account acceptance remain outstanding.
