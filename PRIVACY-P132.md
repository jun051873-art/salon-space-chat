# Customer-owned profiles (P132)

Shop profile forms expose customer name, phone, birthday, gender, avatar and cover as read-only. Shop aliases and notes use admin-only `customerNotes/{uid}`. Customer profile editing remains available. Profile image views do not offer download/upload controls; screenshots and saving already displayed image data cannot be prevented.

Firestore rules reject shop-account changes to customer identity, including direct API writes, document replacement and delete/recreate. Shop lifecycle metadata (approval, archive, tags, visit date) remains supported. This is an application-account boundary; privileged cloud Admin SDK credentials bypass Firestore rules.

Conversation merging retains source identities without writing merged photos or identity overrides. Legacy aliases/overrides are copied to private notes and removed from shared documents transactionally when the shop loads each profile. Existing private aliases take precedence; clearing an alias uses the customer's name. Customer-directed and notification payloads use the customer's actual name, never legacy private overrides.

## Deployment gates — not yet live

1. Deploy and verify `firestore.rules` with an authenticated Firebase deployment identity. This workspace has no authenticated Firebase CLI session.
2. Publish the coordinated UI and worker changes. Keep N131 active-chat notification/layout fixes intact. Old shop UI identity edits will be denied by the new rules.
3. Complete migration of **all** customer records, including archived/merged accounts, and verify `adminProfile`/`adminName` are absent from shared user/chat documents. Lazy migration alone is insufficient to certify the historical dataset private. Preserve private legacy backups.
4. Check shop/customer sessions on real iOS/Android: own profile editing, private alias visibility, alias clearing, merged profiles, approval/archive, chat and notification routing. Native sender-avatar notification work is separate and remains pending.

## Validation

- Local `npm test` regression suite passed (notification route test extraction updated to select the routing listener after N131 added an earlier message listener).
- `node tests/customer-privacy-ui.test.cjs`: read-only customer fields and private alias form.
- Firestore emulator: customer-privacy, profile-save and firestore-rules suites passed; direct shop identity writes denied, customer self-edit works, notes inaccessible to customers/anonymous, atomic legacy cleanup preserves private backups.
- Firestore emulator conversation-integration passed: two-way live messages and original histories retained after merge, source identity unchanged.
- No production migration, Firebase rule deployment, Android build or physical-device validation performed by this change.
