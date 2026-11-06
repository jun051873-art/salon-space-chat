// Proposed unified-conversation contract. Not imported by the production app.
// Membership must be established by the authenticated owner on the server.
export const OWNER_UID = 'HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
export function validId(id) {
 return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}
function requireId(id) { if (!validId(id)) throw Error('INVALID_ID'); return id; }
export function timestampMs(value) {
 if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
 if (typeof value?.toMillis === 'function') return value.toMillis();
 if (typeof value?.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
 return 0;
}
function uniqueIds(ids) {
 if (!Array.isArray(ids)) throw Error('INVALID_MEMBERS');
 return [...new Set(ids.map(requireId))].sort();
}
// A preparation plan cannot change live routing. Every source group must have
// been explicitly selected by the owner; names/phone numbers are never keys.
export function prepareMerge({actorId, conversationId, primaryUid, accounts, sourceGroups = [], expectedRevisions = {}}) {
 if (actorId !== OWNER_UID) throw Error('OWNER_REQUIRED');
 requireId(conversationId); requireId(primaryUid);
 if (!Array.isArray(accounts) || accounts.length < 2) throw Error('TWO_ACCOUNTS_REQUIRED');
 const ids = uniqueIds(accounts.map(a => a.uid));
 if (ids.length !== accounts.length || ids.includes(OWNER_UID)) throw Error('INVALID_MEMBERS');
 if (!ids.includes(primaryUid)) throw Error('PRIMARY_NOT_MEMBER');
 if (accounts.some(a => a.role !== 'customer')) throw Error('CUSTOMERS_ONLY');
 const groupIds = uniqueIds(sourceGroups.map(g => g.id));
 const required = uniqueIds(sourceGroups.flatMap(g => g.memberIds));
 if (required.some(id => !ids.includes(id))) throw Error('PARTIAL_GROUP_MERGE');
 for (const g of sourceGroups) {
  if (g.state !== 'active' || !Number.isInteger(g.revision) || expectedRevisions[g.id] !== g.revision) throw Error('STALE_GROUP');
 }
 for (const a of accounts) {
  if (a.conversationId && !groupIds.includes(a.conversationId)) throw Error('UNCONFIRMED_EXISTING_GROUP');
 }
 return {
  schemaVersion: 1, state: 'prepared', conversationId, primaryUid,
  memberIds: ids, sourceGroupIds: groupIds,
  // Old room data stays in place; no message or file delete/copy operations.
  historyRoomIds: uniqueIds([...ids, ...sourceGroups.flatMap(g => g.historyRoomIds || [])]),
  expectedRevisions: Object.fromEntries(sourceGroups.map(g => [g.id, g.revision])),
  previousAccounts: accounts.map(a => ({uid:a.uid, conversationId:a.conversationId || null, status:a.status || 'active'})),
  revision: 1,
 };
}
export function activateMerge(plan, {rulesReady, workerReady, clientsReady, verifiedRooms, currentRevisions}) {
 if (plan.state !== 'prepared') throw Error('NOT_PREPARED');
 if (!rulesReady || !workerReady || !clientsReady) throw Error('DEPENDENCIES_NOT_READY');
 const verified = new Set(verifiedRooms || []);
 if (plan.historyRoomIds.some(id => !verified.has(id))) throw Error('HISTORY_NOT_VERIFIED');
 for (const [id, revision] of Object.entries(plan.expectedRevisions)) {
  if (currentRevisions?.[id] !== revision) throw Error('STALE_GROUP');
 }
 return {...plan, state:'active'};
}
// Hiding an old card is presentation only, never membership revocation.
export function hideMemberCard(group, uid) {
 if (!group.memberIds.includes(uid)) throw Error('NOT_MEMBER');
 return {...group, hiddenCardIds:uniqueIds([...(group.hiddenCardIds || []), uid])};
}
export function setPrimaryCard(group, uid) {
 if (!group.memberIds.includes(uid)) throw Error('NOT_MEMBER');
 return {...group, primaryUid:uid};
}
export function canAccessConversation(group, account) {
 return group?.state === 'active' && account?.role === 'customer' &&
  account.status === 'active' && !account.adminDeleted &&
  account.conversationId === group.conversationId && group.memberIds.includes(account.uid);
}
// Group records/aliases are server-owned. Redirects do not confer membership.
export function resolveConversation(id, records) {
 requireId(id); const seen = new Set(); let next = id;
 while (true) {
  if (seen.has(next)) throw Error('GROUP_CYCLE');
  seen.add(next); const record = records.get(next);
  if (!record) throw Error('GROUP_MISSING');
  if (record.state === 'active') return record;
  if (record.state !== 'redirect' || !validId(record.to)) throw Error('GROUP_NOT_ACTIVE');
  next = record.to;
 }
}
// Message identity includes its actual path: two old rooms may share an ID.
// Origin fields must never be accepted from customer-written message payloads.
export function combineHistory(snapshots) {
 const rows = new Map();
 for (const s of snapshots) {
  requireId(s.roomId);
  for (const m of s.messages) {
   requireId(m.id); const key = s.roomId + '/' + m.id;
   const entry = {...m, key, sourceRoomId:s.roomId, sourceMessageId:m.id};
   const existing = rows.get(key);
   if (!existing || (!m.fromCache && existing.fromCache) ||
       m.fromCache === existing.fromCache && timestampMs(m.editedAt) >= timestampMs(existing.editedAt)) rows.set(key, entry);
  }
 }
 return [...rows.values()].sort((a,b) => timestampMs(a.createdAt)-timestampMs(b.createdAt) || a.key.localeCompare(b.key));
}
export function messageSource(message) {
 return {roomId:requireId(message.sourceRoomId), messageId:requireId(message.sourceMessageId)};
}
export function eligibleNotificationMembers(group, accounts) {
 return accounts.filter(a => canAccessConversation(group, a)).map(a => a.uid).sort();
}
