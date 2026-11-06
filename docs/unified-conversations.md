# Unified conversations — implementation contract, not enabled

User decision (2026-11-06): the owner and customer must both see one combined
conversation after the owner verifies and merges duplicate customer accounts.
Removing an old card must not remove messages or invalidate the remaining
conversation. Never merge on name or phone alone.

## Verified current constraints

- `chats/{uid}/messages` and `files` use the Firebase Auth UID as the room ID.
- Existing `adminMergedInto`/`customerNotes.linkedCustomerIds` merely connect
  owner-side cards. Customer security rules do not grant access to other UIDs.
- Notification Worker v14 validates customerUid against authenticated UID and
  reads a message from that UID's room. Changing a client room ID alone breaks
  both notification authorization and Firestore authorization.
- Main N114 remains enabled. This draft has NO production imports, no rule
  modifications, no cloud deployment and no account/data mutations.

## Intended contract

Create a stable, server-owned conversation identity independent of any member
Auth UID. Keep customer-provided profiles separate from owner-private notes.
Membership is explicitly approved by the owner; both account-side mapping and
conversation membership must agree before any customer read is allowed.

The owner sees one card per conversation. Each verified active customer member
sees the same combined timeline. Card display identity can change while the
conversation ID remains fixed. Hiding a card is separate from disabling an
account; blocked/revoked/pending/deleted accounts cannot read shared history or
receive notifications. A newly registered UID requires owner approval again.

Store new messages in the stable conversation. Maintain server-owned aliases
for old notification links. Keep old message/file paths as historical sources;
render them in one time-ordered timeline with source-qualified identifiers.
Never use message ID alone across historical rooms. Editing, retracting,
downloading and receipts must operate on each message's original source.
Do not expose owner-private notes, admin nicknames, unrelated bookings or other
customer records through the conversation membership grant.

Push delivery must validate the authenticated sender's current membership and
the actual stored message. Owner replies notify all currently active, verified
member installations with token deduplication; blocked/revoked members are
excluded. Customer messages notify the owner once. Conversation-based tags,
click targets, unread counts and per-account receipts must agree on this ID.

## Preparation / activation / recovery

1. Read authoritative account, chat, group and note documents, including prior
   explicitly merged aliases. Resolve the full group; fail on cycles, missing
   membership, inconsistent mappings or concurrent revision changes.
2. Prepare an owner-only operation record, original mappings and expected
   revisions. Read-only checks verify historical room/file access. Do not alter
   live routing, statuses or existing messages in preparation.
3. Deploy and test server membership authorization and the new Worker capability
   before any client can activate a prepared group. Preserve v14 auto-reply,
   presence suppression and reminder features.
4. Implement the shared web client timeline, list grouping, receipts, attachment
   source routing and old-notification aliases. APK/TWA loads this web code.
   Do not treat rollout as complete merely because the HTML was deployed.
5. Activation must atomically validate revisions and publish the group/mappings.
   For merges larger than one transaction, stage data with an inactive operation
   ID; readers must ignore it until an atomic activation pointer is committed.
6. Old clients/queued messages need server bridging while they continue writing
   old UID paths. Bridging must be idempotent, preserve server timestamps and
   source identity, and avoid duplicate auto-replies, pushes and receipts.
7. Rollback must preserve any new messages: freeze further merge changes, keep
   the readable combined view or verified bridge, and only then revert mappings.
   Never simply restore mappings after new shared messages exist.

## Remaining work before release

This PR supplies only the executable model and tests, not the integrated feature.
The following are outstanding and must not be represented as completed:

- Access to the deployed Firebase project/rules and current Cloudflare Worker.
- Server-owned groups, transactional merge endpoint, audit/rollback persistence.
- Actual Firestore emulator tests for cross-member access, outsiders, removed
  members, group forgery, files, reads, writes and private-note isolation.
- Idempotent legacy message bridging and full historical pagination.
- Shared client integration for list, timeline, edits/files, receipts and auth.
- Push recipient and click routing, token deduplication and unread/badge behavior.
- iOS owner/customer real-device tests: visible, background, home screen and
  notification click; then Android web and installed APK regression testing.

Model validation: `node tests/conversation-merge-model.test.mjs`.
Existing production behavior is intentionally unchanged until those dependencies
can be connected and verified together.
