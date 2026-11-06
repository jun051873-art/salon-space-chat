# Unified conversations — N115 rollout

Implementation replaces the original non-runtime prototype proposal. No production
customer records are migrated automatically. Names and phones are candidate
searches only; the owner must confirm both identities and existing groups.

## Storage and compatibility

`conversations/{id}` is the stable group identity. It holds owner-managed member
UIDs, historical room IDs, primary card identity, revision and blocking state.
Every account mapping and group record is changed in one Firestore transaction,
with an owner-only audit record. Prior groups become redirects; account mappings
are updated atomically. Maximum 20 accounts / 40 historical rooms per group.

Messages and attachments remain at their ORIGINAL UID paths. New writes also use
the authenticated customer's original room, or the room opened by the owner.
This intentionally replaces the prototype's proposed new central message path:
old app instances and offline queues keep writing their original authorized
paths, and the shared reader sees those writes directly. There is no copy/delete
migration, server bridge, or duplicate auto-reply caused by copying records.

Each source has its own 30-message realtime window and pagination cursor. The
combined timeline keys each message by source room and message ID, so identical
IDs in two rooms cannot overwrite each other. Attachment reads, edits and
retractions use original paths. Customers may edit only messages sent by their
currently authenticated UID, even when their older messages appear on their side.
Receipts are written separately to each loaded source room. Customer unread
indicators watch all sources; owner inbox rows and unread counts group by the
explicit owner-managed conversation ID.

Hiding a linked entry never removes membership, history or login authorization.
Merged secondary cards are hidden by their primary mapping. The single primary
card is retained instead of allowing the user to accidentally remove their last
entry. Block on the merged profile additionally blocks the shared group; previously
revoked individual accounts are not activated by a merge or by group unblock.

## Authorization and notifications

Only the owner writes groups, membership mappings and merge audit records.
Shared readers must have an active customer account, not be deleted, and have
both a matching account mapping and membership in an active, unblocked group.
Private customerNotes and other users' profile documents stay owner-only/own-only.
Shared access grants reads of conversation source data plus monotonic customer
receipts, not arbitrary writes to another UID's room or messages.

Worker v15 retains original per-UID authenticated message verification. Owner
replies and automatic/reminder replies collect devices from active matching
members and deduplicate tokens. Revoked, deleted and mismatched accounts are
excluded. Existing old notification URLs retain their original room IDs; the
updated reader resolves that room's group, so old links open the same timeline.
Owner presence in any historical source suppresses automatic replies.

## Validation performed locally

- Existing `npm test` regression suite.
- `npm run test:conversations`: source-ID collisions, independent pagination,
  stale callbacks on membership changes, pause/resume and Worker token filtering.
- `npm run test:conversation-rules`: actual Firestore emulator tests for legacy
  behavior, approved shared history/files, outsider isolation, forged membership,
  blocked/revoked/deleted accounts, group blocking, owner merge atomicity/audit,
  retained histories and owner/customer bidirectional live snapshots.

## Rollout order (not yet deployed)

1. Apply the additive Firestore rules after retaining the current version.
2. Deploy `cloudflare/worker-suite.js` as the existing salon-space-notify Worker.
   Keep all environment secrets and existing Cron settings unchanged. GET must
   report version `15-unified-conversations` and `unifiedConversations: true`.
3. Release the complete N115 web change together. APK/TWA loads the same web
   content; its native Android version stays 1.0.10, separate from web N115.
4. Reload both owner and customer clients. Use two test accounts first. Verify
   both histories, new messages in both directions, original attachments,
   per-source read receipts, notification opening and badges. Then test iOS
   home-screen/locked/background and Android APK. Actual device push delivery
   has NOT been verified by local tests.
5. Only then merge real duplicate customers after identity confirmation.

The merge UI refuses to activate groups unless the Worker advertises support.
Missing rules fail the atomic transaction without changing accounts. Do not roll
back to old clients after enabling groups: old clients see only their own source.
Preserve rules, group mappings and messages while diagnosing any rollout problem.
