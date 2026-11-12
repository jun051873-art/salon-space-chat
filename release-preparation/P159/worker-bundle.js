var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// cloudflare/customer-recovery.js
var customer_recovery_exports = {};
__export(customer_recovery_exports, {
  RECOVERY_OWNER: () => RECOVERY_OWNER,
  createCustomerRecovery: () => createCustomerRecovery
});
function createCustomerRecovery({ db, actor, checkAuth, mint, now = Date.now }) {
  async function target(uid) {
    if (!validUid(uid)) fail();
    const [profile, retired, job] = await Promise.all([db.get("users/" + uid), db.get("retiredCustomers/" + uid), db.get("customerCleanup/" + uid)]);
    const p = profile?.data;
    if (p?.cleanupLock) throw Object.assign(new Error("MERGE_IN_PROGRESS"), { code: "MERGE_IN_PROGRESS", status: 409 });
    if (!p || p.role !== "customer" || p.status !== "active" || p.adminDeleted || p.adminMergedInto || p.cleanupLock || retired || job) fail();
    const group = p.conversationId ? await db.get("conversations/" + p.conversationId) : null;
    if (p.conversationId && (!group || group.data.state !== "active" || group.data.blocked || group.data.cleanupLock || group.data.primaryUid !== uid || !group.data.memberIds?.includes(uid))) fail();
    await checkAuth(uid);
    return [profile, ...group ? [group] : []];
  }
  const guards = (docs) => docs.map((d) => ({ path: d.path, raw: d.raw, version: d.version }));
  return {
    async follow() {
      if (!validUid(actor)) fail();
      let uid = actor;
      const seen = /* @__PURE__ */ new Set(), links = [];
      for (let i = 0; i < 32; i++) {
        if (seen.has(uid)) fail();
        seen.add(uid);
        const alias = await db.get("retiredCustomers/" + uid);
        if (!alias) {
          if (!links.length) return { ok: true, linked: false };
          const docs = await target(uid), customToken = await mint(uid);
          await db.commit([...guards(docs), ...guards(links)]);
          return { ok: true, linked: true, customToken };
        }
        if (!alias.data.automatic || !validUid(alias.data.primaryUid)) {
          const job = await db.get("customerCleanup/" + uid);
          if (job && job.data.stage !== "done") throw Object.assign(new Error("MERGE_IN_PROGRESS"), { code: "MERGE_IN_PROGRESS", status: 409 });
          fail();
        }
        links.push(alias);
        uid = alias.data.primaryUid;
      }
      fail();
    },
    async issue(uid) {
      if (actor !== RECOVERY_OWNER) throw Object.assign(new Error("NOT_AUTHORIZED"), { code: "NOT_AUTHORIZED", status: 403 });
      const docs = await target(uid), path = "customerRecovery/" + uid, old = await db.get(path);
      const secret = hex(crypto.getRandomValues(new Uint8Array(32))), code = uid + "." + secret, expiresAt = now() + 15 * 60 * 1e3;
      await db.commit([...guards(docs), { path, data: { digest: await digest(code), expiresAt, used: false, issuedAt: now() }, ...old ? { version: old.version } : { create: true } }]);
      return { ok: true, code, expiresAt };
    },
    async redeem(code) {
      if (actor === RECOVERY_OWNER || !actor) fail();
      if (typeof code !== "string" || !/^([A-Za-z0-9_-]{1,128})\.[a-f0-9]{64}$/.test(code)) fail();
      const uid = code.split(".")[0], path = "customerRecovery/" + uid, ticket = await db.get(path);
      if (!ticket || ticket.data.used || ticket.data.expiresAt <= now() || ticket.data.digest !== await digest(code)) fail();
      const docs = await target(uid), customToken = await mint(uid);
      await db.commit([...guards(docs), { path, version: ticket.version, data: { used: true, usedAt: now(), expiresAt: ticket.data.expiresAt } }]);
      return { ok: true, customToken };
    }
  };
}
var RECOVERY_OWNER, validUid, fail, hex, digest;
var init_customer_recovery = __esm({
  "cloudflare/customer-recovery.js"() {
    RECOVERY_OWNER = "HcFJGmzHw6MYoWbFmtq9IyFSjvL2";
    validUid = (x) => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x) && x !== RECOVERY_OWNER;
    fail = () => {
      throw Object.assign(new Error("RECOVERY_UNAVAILABLE"), { code: "RECOVERY_UNAVAILABLE", status: 409 });
    };
    hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
    digest = async (text) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
  }
});

// cloudflare/customer-cleanup.js
var customer_cleanup_exports = {};
__export(customer_cleanup_exports, {
  CLEANUP_OWNER: () => CLEANUP_OWNER,
  CLEANUP_PROJECT: () => CLEANUP_PROJECT,
  cleanupError: () => cleanupError,
  cleanupHash: () => cleanupHash,
  createCustomerCleanup: () => createCustomerCleanup
});
function cleanupError(message, status = 409) {
  const e = new Error(message);
  e.status = status;
  return e;
}
function requireValue(ok, message) {
  if (!ok) throw cleanupError(message);
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
async function cleanupHash(value) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function createCustomerCleanup({ db, auth, project, actor, enabled = false, now = Date.now }) {
  function authorize() {
    requireValue(enabled, "\u6C38\u4E45\u6E05\u9664\u670D\u52D9\u5C1A\u672A\u555F\u7528");
    requireValue(project === CLEANUP_PROJECT, "\u5C08\u6848\u4E0D\u7B26");
    requireValue(actor === CLEANUP_OWNER, "\u50C5\u5E97\u4E3B\u53EF\u64CD\u4F5C");
  }
  async function target(primaryUid, sourceUid) {
    authorize();
    requireValue(idOK(primaryUid) && idOK(sourceUid) && primaryUid !== sourceUid, "\u8ACB\u9078\u64C7\u4E3B\u6A94\u8207\u4E0D\u540C\u7684\u820A\u5E33\u865F");
    const [primary, source] = await Promise.all([db.get("users/" + primaryUid), db.get("users/" + sourceUid)]);
    requireValue(primary && source && primary.data.role === "customer" && source.data.role === "customer", "\u627E\u4E0D\u5230\u5B8C\u6574\u9867\u5BA2\u8CC7\u6599");
    const p = primary.data, s = source.data;
    requireValue(p.conversationId && p.conversationId === s.conversationId, "\u53EA\u80FD\u6E05\u9664\u5DF2\u7531\u5E97\u4E3B\u5408\u4F75\u7684\u540C\u7D44\u5E33\u865F");
    const group = await db.get("conversations/" + p.conversationId), g = data(group);
    requireValue(g.state === "active" && !g.blocked && g.primaryUid === primaryUid && g.memberIds?.includes(sourceUid) && g.memberIds.includes(primaryUid) && g.historyRoomIds?.includes(sourceUid) && g.historyRoomIds.includes(primaryUid), "\u8ACB\u5F9E\u76EE\u524D\u4FDD\u7559\u7684\u4E3B\u6A94\u64CD\u4F5C");
    requireValue(!p.cleanupLock && !s.cleanupLock && !g.cleanupLock && !p.adminDeleted && p.status === "active", "\u6B64\u7D44\u6B63\u5728\u8655\u7406\u6216\u4E3B\u6A94\u672A\u555F\u7528");
    requireValue(g.memberIds.length <= 20 && g.historyRoomIds.length <= 40 && g.memberIds.every(idOK) && new Set(g.memberIds).size === g.memberIds.length && g.historyRoomIds.every(idOK), "\u7FA4\u7D44\u8CC7\u6599\u4E0D\u5B8C\u6574");
    requireValue(!await db.get("retiredCustomers/" + sourceUid), "\u820A\u5E33\u865F\u5DF2\u505C\u7528");
    for (const [path, allowed] of [["users/" + sourceUid, []], ["chats/" + sourceUid, ["messages", "files"]], ["pushTokens/" + sourceUid, ["devices"]], ["customerNotes/" + sourceUid, []]]) {
      requireValue((await db.children(path)).every((x) => allowed.includes(x)), "\u767C\u73FE\u5176\u4ED6\u8CC7\u6599\u985E\u578B\uFF0C\u66AB\u505C\u6E05\u9664\u4E26\u4FDD\u7559\u5168\u90E8\u8CC7\u6599");
    }
    const related = await db.query("conversations", "memberIds", "ARRAY_CONTAINS", sourceUid, 3);
    requireValue(related.every((x) => x.path === group.path), "\u820A\u5E33\u865F\u5C6C\u65BC\u5176\u4ED6\u7FA4\u7D44\uFF0C\u8ACB\u5148\u6838\u5C0D");
    return { primary, source, group };
  }
  async function preview(primaryUid, sourceUid) {
    authorize();
    requireValue(idOK(sourceUid), "\u820A\u5E33\u865F\u7121\u6548");
    const pending = await db.get("customerCleanup/" + sourceUid);
    if (pending) {
      requireValue(pending.data.primaryUid === primaryUid, "\u6B64\u820A\u5E33\u865F\u5DF2\u6709\u5176\u4ED6\u6E05\u9664\u5DE5\u4F5C");
      return { ok: true, resume: true, jobId: sourceUid, ...publicJob(pending.data) };
    }
    const t = await target(primaryUid, sourceUid);
    return { ok: true, primaryUid, sourceUid, primaryName: t.primary.data.name || "\u4FDD\u7559\u4E3B\u6A94", sourceName: t.source.data.name || "\u820A\u5E33\u865F", token: await cleanupHash([t.primary.version, t.source.version, t.group.version]), warning: "\u820A\u8CC7\u6599\u6E05\u9664\u5F8C\uFF0C\u4FDD\u7559\u5FC5\u8981\u7684\u767B\u5165\u5C0D\u61C9\uFF0C\u8B93\u539F\u624B\u6A5F\u81EA\u52D5\u63A5\u56DE\u4E3B\u6A94\uFF1B\u5DF2\u6E05\u9664\u7684\u820A\u8CC7\u6599\u7121\u6CD5\u5FA9\u539F\u3002" };
  }
  async function start(primaryUid, sourceUid, token) {
    authorize();
    requireValue(idOK(sourceUid), "\u820A\u5E33\u865F\u7121\u6548");
    const pending = await db.get("customerCleanup/" + sourceUid);
    if (pending) {
      requireValue(pending.data.primaryUid === primaryUid, "\u5DE5\u4F5C\u4E3B\u6A94\u4E0D\u540C");
      return publicJob(pending.data);
    }
    const t = await target(primaryUid, sourceUid);
    requireValue(token === await cleanupHash([t.primary.version, t.source.version, t.group.version]), "\u8CC7\u6599\u5DF2\u8B8A\u66F4\uFF0C\u8ACB\u91CD\u65B0\u67E5\u770B\u522A\u9664\u78BA\u8A8D");
    const members = await Promise.all(t.group.data.memberIds.map((id) => db.get("users/" + id)));
    requireValue(members.every((x) => x && x.data.conversationId === t.primary.data.conversationId && !x.data.cleanupLock), "\u7FA4\u7D44\u8CC7\u6599\u5DF2\u8B8A\u66F4");
    const job = { schema: 2, primaryUid, sourceUid, groupId: t.primary.data.conversationId, memberIds: t.group.data.memberIds, stage: "auth-disable", cursor: "", copiedMessages: 0, copiedFiles: 0, deletedMessages: 0, deletedFiles: 0, startedAt: now(), updatedAt: now(), serial: 0 };
    await db.commit([
      ...members.map((x) => patch(x, { cleanupLock: sourceUid })),
      patch(t.group, { cleanupLock: sourceUid }),
      put("retiredCustomers/" + sourceUid, { retired: true }, null),
      put("customerCleanup/" + sourceUid, job, null)
    ]);
    return publicJob(job);
  }
  function publicJob(j) {
    return { ok: true, jobId: j.sourceUid, primaryUid: j.primaryUid, sourceUid: j.sourceUid, stage: j.stage, done: j.stage === "done", copiedMessages: j.copiedMessages, copiedFiles: j.copiedFiles, deletedMessages: j.deletedMessages, deletedFiles: j.deletedFiles };
  }
  async function step(jobId) {
    authorize();
    requireValue(idOK(jobId), "\u5DE5\u4F5C\u7DE8\u865F\u7121\u6548");
    const record = await db.get("customerCleanup/" + jobId);
    requireValue(record, "\u627E\u4E0D\u5230\u6E05\u9664\u5DE5\u4F5C");
    const j = record.data;
    if (j.stage === "done") return publicJob(j);
    const primary = await db.get("users/" + j.primaryUid), source = await db.get("users/" + j.sourceUid), group = await db.get("conversations/" + j.groupId);
    requireValue(primary?.data.cleanupLock === jobId && source?.data.cleanupLock === jobId && group?.data.cleanupLock === jobId, "\u6E05\u9664\u9396\u5B9A\u5DF2\u8B8A\u66F4\uFF0C\u505C\u6B62\u4EE5\u514D\u8AA4\u522A");
    const commit = async (writes = [], change = {}) => {
      const next = { ...j, ...change, serial: j.serial + 1, updatedAt: now() };
      await db.commit([...writes, put(record.path, next, record)]);
      return publicJob(next);
    };
    if (j.stage === "auth-disable") {
      if (j.pendingBookings?.length) {
        const saved = await Promise.all(j.pendingBookings.map((x) => db.get(x.path)));
        for (let i = 0; i < saved.length; i++) requireValue(saved[i] && await cleanupHash(saved[i].raw) === j.pendingBookings[i].hash, "\u9810\u7D04\u79FB\u8F49\u6838\u5C0D\u4E0D\u4E00\u81F4\uFF0C\u66AB\u505C\u6E05\u9664\u4E26\u4FDD\u7559\u5E33\u865F");
        return commit(saved.map(guard), { pendingBookings: [], transferredBookings: (j.transferredBookings || 0) + saved.length });
      }
      const bookings = await db.query("bookings", "userId", "EQUAL", j.sourceUid, PAGE);
      if (bookings.length) {
        const pendingBookings = [];
        for (const booking of bookings) {
          requireValue(!(await db.children(booking.path)).length, "\u9810\u7D04\u542B\u5176\u4ED6\u8CC7\u6599\uFF0C\u66AB\u505C\u6E05\u9664\u4E26\u4FDD\u7559\u5E33\u865F");
          pendingBookings.push({ path: booking.path, hash: await cleanupHash({ ...booking.raw, userId: { stringValue: j.primaryUid } }) });
        }
        return commit(bookings.map((x) => patch(x, { userId: j.primaryUid })), { pendingBookings });
      }
      if (j.schema !== 2) await auth.disable(j.sourceUid);
      return commit([], { stage: "copy-files" });
    }
    const kind = j.stage.endsWith("files") ? "files" : "messages";
    const collection = "chats/" + j.sourceUid + "/" + kind;
    async function destination(doc) {
      const id = "m_" + await cleanupHash([j.sourceUid, doc.path.split("/").at(-1)]), raw = structuredClone(doc.raw);
      if (raw.senderRole?.stringValue === "customer" || raw.senderId?.stringValue === j.sourceUid) raw.senderId = { stringValue: j.primaryUid };
      if (raw.clientMessageId) raw.clientMessageId = { stringValue: id };
      return { path: "chats/" + j.primaryUid + "/" + kind + "/" + id, raw };
    }
    if (j.stage.startsWith("copy-")) {
      const docs = await db.list(collection, j.cursor, PAGE), writes = [];
      for (const doc of docs) {
        requireValue(!(await db.children(doc.path)).length, "\u8A0A\u606F\u6216\u9644\u4EF6\u5305\u542B\u5176\u4ED6\u8CC7\u6599\uFF0C\u66AB\u505C\u8655\u7406");
        const dest = await destination(doc);
        requireValue(!await db.get(dest.path), "\u4E3B\u6A94\u5DF2\u6709\u540C\u7DE8\u865F\u8CC7\u6599\uFF0C\u505C\u6B62\u4EE5\u514D\u8986\u84CB");
        if (kind === "messages" && doc.data.attachment && !doc.data.retracted) requireValue(await db.get("chats/" + j.sourceUid + "/files/" + doc.path.split("/").at(-1)), "\u820A\u8A0A\u606F\u7F3A\u5C11\u9644\u4EF6\uFF0C\u66AB\u505C\u4E26\u4FDD\u7559\u539F\u59CB\u8CC7\u6599");
        writes.push(guard(doc), { ...dest, create: true });
      }
      const counter = kind === "files" ? "copiedFiles" : "copiedMessages";
      return commit(writes, { [counter]: j[counter] + docs.length, cursor: docs.at(-1)?.path.split("/").at(-1) || "", ...!docs.length ? { stage: kind === "files" ? "copy-messages" : "verify-files", cursor: "" } : {} });
    }
    if (j.stage.startsWith("verify-") || j.stage.startsWith("erase-")) {
      const removing = j.stage.startsWith("erase-"), docs = await db.list(collection, j.cursor, PAGE), writes = [];
      for (const doc of docs) {
        const dest = await destination(doc), saved = await db.get(dest.path);
        requireValue(saved && canonical(saved.raw) === canonical(dest.raw), "\u642C\u79FB\u6838\u5C0D\u4E0D\u4E00\u81F4\uFF0C\u672A\u522A\u9664\u9019\u6279\u820A\u8CC7\u6599");
        if (removing) writes.push(guard(saved), erase(doc));
      }
      let change = { cursor: docs.at(-1)?.path.split("/").at(-1) || "" };
      if (removing) {
        const counter = kind === "files" ? "deletedFiles" : "deletedMessages";
        change[counter] = j[counter] + docs.length;
      }
      if (!docs.length) change = { ...change, cursor: "", stage: removing ? kind === "messages" ? "erase-files" : "references" : kind === "files" ? "verify-messages" : "switch" };
      return commit(writes, change);
    }
    if (j.stage === "switch") {
      const [pn, sn, pc, sc] = await Promise.all(["customerNotes/" + j.primaryUid, "customerNotes/" + j.sourceUid, "chats/" + j.primaryUid, "chats/" + j.sourceUid].map((p) => db.get(p)));
      const notes = [data(pn).notes, data(sn).notes].filter((x) => typeof x === "string" && x.trim());
      const notePatch = { notes: [...new Set(notes)].join("\n\n\u2500\u2500 \u5408\u4F75\u4FDD\u7559\u7684\u5099\u8A3B \u2500\u2500\n"), linkedCustomerIds: without(data(pn).linkedCustomerIds, j.sourceUid), hiddenLinkedCustomerIds: without(data(pn).hiddenLinkedCustomerIds, j.sourceUid) };
      const latest = instant(data(sc).updatedAt) > instant(data(pc).updatedAt) ? sc : pc;
      const raw = { ...pc?.raw || {} };
      for (const k of ["lastMessage", "updatedAt"]) if (latest?.raw[k]) raw[k] = latest.raw[k];
      for (const k of ["lastCustomerMessageAt", "lastAdminMessageAt"]) {
        const newest = instant(data(sc)[k]) > instant(data(pc)[k]) ? sc : pc;
        if (newest?.raw[k]) raw[k] = newest.raw[k];
      }
      const accountRaw = { tags: { arrayValue: { values: [.../* @__PURE__ */ new Set([...primary.data.tags || [], ...source.data.tags || []])].map((x) => ({ stringValue: x })) } } };
      if (instant(source.data.lastVisitAt) > instant(primary.data.lastVisitAt) && source.raw.lastVisitAt) accountRaw.lastVisitAt = source.raw.lastVisitAt;
      raw.userId = { stringValue: j.primaryUid };
      raw.conversationPrimaryUid = { stringValue: j.primaryUid };
      raw.readAdminMs = { integerValue: "0" };
      raw.readCustomerMs = { integerValue: "0" };
      const g = { memberIds: without(group.data.memberIds, j.sourceUid), historyRoomIds: without(group.data.historyRoomIds, j.sourceUid), revision: Number(group.data.revision || 0) + 1 };
      return commit([{ path: primary.path, raw: accountRaw, merge: true, version: primary.version }, patch(group, g), pn ? patch(pn, notePatch) : put("customerNotes/" + j.primaryUid, notePatch, null), { path: "chats/" + j.primaryUid, raw, version: pc?.version, create: !pc }], { stage: "erase-messages", cursor: "" });
    }
    if (j.stage === "references") {
      const feedback = await db.query("feedback", "userId", "EQUAL", j.sourceUid, PAGE);
      if (feedback.length) return commit(feedback.map((x) => patch(x, { userId: j.primaryUid })));
      for (const [c, field] of [["broadcasts", "userId"], ["broadcasts", "targetUserId"], ["notificationJobs", "userId"]]) {
        const rows = await db.query(c, field, "EQUAL", j.sourceUid, PAGE);
        if (rows.length) {
          for (const x of rows) requireValue(!(await db.children(x.path)).length, "\u901A\u77E5\u5DE5\u4F5C\u5305\u542B\u672A\u77E5\u8CC7\u6599");
          return commit(rows.map(erase));
        }
      }
      for (const key of ["linkedCustomerIds", "hiddenLinkedCustomerIds"]) {
        const rows = await db.query("customerNotes", key, "ARRAY_CONTAINS", j.sourceUid, PAGE);
        if (rows.length) return commit(rows.map((x) => patch(x, { [key]: without(x.data[key], j.sourceUid) })));
      }
      const devices = await db.list("pushTokens/" + j.sourceUid + "/devices", "", PAGE);
      if (devices.length) {
        for (const x of devices) requireValue(!(await db.children(x.path)).length, "\u88DD\u7F6E\u8CC7\u6599\u542B\u672A\u77E5\u5167\u5BB9");
        return commit(devices.map(erase));
      }
      const join = await db.get("notificationJobs/join_" + j.sourceUid);
      if (join) return commit([erase(join)]);
      return commit([], { stage: "auth-delete" });
    }
    if (j.stage === "auth-delete") {
      requireValue(!(await db.query("bookings", "userId", "EQUAL", j.sourceUid, 1)).length, "\u4ECD\u6709\u820A\u5E33\u865F\u9810\u7D04\u95DC\u806F\uFF0C\u66AB\u505C\u6E05\u9664");
      if (j.schema !== 2) await auth.remove(j.sourceUid);
      return commit([], { stage: "finish" });
    }
    if (j.stage === "finish") {
      requireValue(j.copiedMessages === j.deletedMessages && j.copiedFiles === j.deletedFiles, "\u642C\u79FB\u8207\u6E05\u9664\u6578\u91CF\u4E0D\u7B26");
      for (const c of ["chats/" + j.sourceUid + "/messages", "chats/" + j.sourceUid + "/files", "pushTokens/" + j.sourceUid + "/devices"]) requireValue(!(await db.list(c, "", 1)).length, "\u4ECD\u6709\u820A\u8CC7\u6599\uFF0C\u8ACB\u7E7C\u7E8C\u6838\u5C0D");
      const survivors = await Promise.all(without(j.memberIds, j.sourceUid).map((id) => db.get("users/" + id)));
      requireValue(survivors.every((x) => x?.data.cleanupLock === jobId), "\u4FDD\u7559\u5E33\u865F\u72C0\u614B\u5DF2\u8B8A\u66F4");
      const alias = j.schema === 2 ? await db.get("retiredCustomers/" + j.sourceUid) : null;
      const roots = await Promise.all(["users", "chats", "pushTokens", "customerNotes"].map((c) => db.get(c + "/" + j.sourceUid)));
      return commit([...alias ? [patch(alias, { primaryUid: j.primaryUid, automatic: true })] : [], ...roots.filter(Boolean).map(erase), ...survivors.map((x) => patch(x, { cleanupLock: "" })), patch(group, { cleanupLock: "" })], { stage: "done", memberIds: [], finishedAt: now() });
    }
    throw cleanupError("\u672A\u77E5\u8655\u7406\u968E\u6BB5\uFF0C\u672A\u522A\u9664\u8CC7\u6599");
  }
  return { preview, start, step };
}
var CLEANUP_PROJECT, CLEANUP_OWNER, PAGE, idOK, put, patch, guard, erase, without, data, instant;
var init_customer_cleanup = __esm({
  "cloudflare/customer-cleanup.js"() {
    CLEANUP_PROJECT = "salon-space-chat";
    CLEANUP_OWNER = "HcFJGmzHw6MYoWbFmtq9IyFSjvL2";
    PAGE = 4;
    idOK = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) && id !== CLEANUP_OWNER;
    put = (path, data2, record) => ({ path, data: data2, version: record?.version, create: !record });
    patch = (record, data2) => ({ path: record.path, data: data2, merge: true, version: record.version });
    guard = (record) => ({ path: record.path, raw: record.raw, version: record.version });
    erase = (record) => ({ path: record.path, delete: true, version: record.version });
    without = (list, id) => (list || []).filter((x) => x !== id);
    data = (record) => record?.data || {};
    instant = (v) => typeof v === "number" ? v : Date.parse(v) || 0;
  }
});

// cloudflare/cleanup-rest.js
var cleanup_rest_exports = {};
__export(cleanup_rest_exports, {
  createCleanupRest: () => createCleanupRest,
  decodeFields: () => decodeFields,
  decodeValue: () => decodeValue,
  encodeFields: () => encodeFields,
  encodeValue: () => encodeValue
});
function decodeValue(v) {
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeValue);
  if (v.mapValue) return decodeFields(v.mapValue.fields || {});
  return v;
}
function createCleanupRest({ project, token, fetcher = fetch, emulatorOrigin }) {
  const base = "projects/" + project + "/databases/(default)/documents", root = (emulatorOrigin || "https://firestore.googleapis.com") + "/v1/" + base;
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");
  async function request(url, payload) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15e3);
    try {
      const response = await fetcher(url, { method: payload === void 0 ? "GET" : "POST", headers, body: payload === void 0 ? void 0 : JSON.stringify(payload), signal: controller.signal });
      const out = await response.json();
      if (!response.ok) {
        const e = cleanupError(out.error?.message || out.error?.status || "\u96F2\u7AEF\u64CD\u4F5C\u5931\u6557", response.status);
        e.code = out.error?.status;
        throw e;
      }
      return out;
    } finally {
      clearTimeout(timer);
    }
  }
  const snapshot = (d) => ({ path: d.name.split("/documents/")[1], version: d.updateTime, raw: d.fields || {}, data: decodeFields(d.fields || {}) });
  async function get(path) {
    try {
      return snapshot(await request(root + "/" + encodePath(path)));
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }
  async function select(path, { field, op, value, cursor = "", limit = 4 } = {}) {
    const parts = path.split("/"), collectionId = parts.pop(), parent = parts.join("/");
    const structuredQuery = { from: [{ collectionId }], orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }], limit };
    if (field) structuredQuery.where = { fieldFilter: { field: { fieldPath: field }, op, value: encodeValue(value) } };
    if (cursor) structuredQuery.startAt = { values: [{ referenceValue: base + "/" + path + "/" + cursor }], before: false };
    const out = await request(root + (parent ? "/" + encodePath(parent) : "") + ":runQuery", { structuredQuery });
    return out.filter((x) => x.document).map((x) => snapshot(x.document));
  }
  async function children(path) {
    let pageToken = "", ids = [];
    do {
      const out = await request(root + "/" + encodePath(path) + ":listCollectionIds", { pageSize: 100, ...pageToken ? { pageToken } : {} });
      ids.push(...out.collectionIds || []);
      pageToken = out.nextPageToken || "";
    } while (pageToken);
    return ids;
  }
  async function commit(writes) {
    const body = { writes: writes.map((w) => {
      const name = base + "/" + w.path, currentDocument = w.version ? { updateTime: w.version } : w.create ? { exists: false } : void 0;
      if (w.delete) return { delete: name, ...currentDocument ? { currentDocument } : {} };
      const fields = w.raw || encodeFields(w.data);
      return { update: { name, fields }, ...w.merge ? { updateMask: { fieldPaths: Object.keys(fields) } } : {}, ...currentDocument ? { currentDocument } : {} };
    }) };
    if (new TextEncoder().encode(JSON.stringify(body)).length > 8 * 1024 * 1024) throw cleanupError("\u8CC7\u6599\u6279\u6B21\u904E\u5927\uFF0C\u672A\u57F7\u884C\u6E05\u9664");
    return request(root + ":commit", body);
  }
  const authRoot = "https://identitytoolkit.googleapis.com/v1/projects/" + encodeURIComponent(project) + "/accounts:";
  async function authAction(action, uid) {
    try {
      await request(authRoot + action, { localId: uid, ...action === "update" ? { disableUser: true } : {} });
    } catch (e) {
      if (!/USER_NOT_FOUND|EMAIL_NOT_FOUND/.test(e.message)) throw e;
    }
  }
  return { db: { get, list: (path, cursor, limit) => select(path, { cursor, limit }), query: (path, field, op, value, limit) => select(path, { field, op, value, limit }), children, commit }, auth: { disable: (uid) => authAction("update", uid), remove: (uid) => authAction("delete", uid) } };
}
var encodeValue, encodeFields, decodeFields;
var init_cleanup_rest = __esm({
  "cloudflare/cleanup-rest.js"() {
    init_customer_cleanup();
    encodeValue = (v) => v == null ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v } : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(encodeValue) } } : { mapValue: { fields: encodeFields(v) } };
    encodeFields = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeValue(x)]));
    decodeFields = (raw) => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, decodeValue(v)]));
  }
});

// chat-image-retention.js
var CHAT_IMAGE_DAYS, CHAT_IMAGE_TTL;
var init_chat_image_retention = __esm({
  "chat-image-retention.js"() {
    CHAT_IMAGE_DAYS = 90;
    CHAT_IMAGE_TTL = CHAT_IMAGE_DAYS * 864e5;
  }
});

// cloudflare/chat-image-retention.js
var chat_image_retention_exports = {};
__export(chat_image_retention_exports, {
  sweepChatImages: () => sweepChatImages
});
async function sweepChatImages({ root, token, now = Date.now(), request = fetch, limit = 10 }) {
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  async function call(url, body) {
    const response = await request(url, { method: body === void 0 ? "GET" : "POST", headers, ...body === void 0 ? {} : { body: JSON.stringify(body) }, signal: AbortSignal.timeout(15e3) });
    if (response.status === 404 && body === void 0) return null;
    const data2 = await response.json();
    if (!response.ok) throw Error("IMAGE_RETENTION_" + response.status);
    return data2;
  }
  const base = root.replace(/^https?:\/\/[^/]+\/v1\//, "").replace(/\/$/, ""), stateName = base + "/broadcasts/_chatImageRetention";
  const state = await call(root + "broadcasts/_chatImageRetention");
  const cursor = state?.fields?.cursor?.stringValue || "";
  const structuredQuery = { from: [{ collectionId: "files", allDescendants: true }], select: { fields: [{ fieldPath: "type" }] }, orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }], limit };
  if (cursor.startsWith(base + "/")) structuredQuery.startAt = { values: [{ referenceValue: cursor }], before: false };
  const rows = (await call(root.slice(0, -1) + ":runQuery", { structuredQuery })).filter((x) => x.document).map((x) => x.document);
  let deleted = 0;
  for (const file of rows) {
    const path = file.name.slice(base.length + 1);
    if (!file.name.startsWith(base + "/") || !/^chats\/[^/]+\/files\/[^/]+$/.test(path) || !file.fields?.type?.stringValue?.startsWith("image/") || !file.updateTime) continue;
    const messagePath = path.replace("/files/", "/messages/"), message = await call(root + messagePath);
    const sent = Date.parse(message?.fields?.createdAt?.timestampValue || file.createTime || "");
    if (!Number.isFinite(sent) || sent <= 0 || now < sent + CHAT_IMAGE_TTL) continue;
    const writes = [{ delete: file.name, currentDocument: { updateTime: file.updateTime } }];
    if (message) {
      if (!message.updateTime || !message.fields?.attachment?.mapValue?.fields?.type?.stringValue?.startsWith("image/")) continue;
      writes.push({ update: { name: message.name, fields: { attachment: { mapValue: { fields: { expired: { booleanValue: true } } } } } }, updateMask: { fieldPaths: ["attachment.expired"] }, currentDocument: { updateTime: message.updateTime } });
    }
    await call(root.slice(0, -1) + ":commit", { writes });
    deleted++;
  }
  await call(root.slice(0, -1) + ":commit", { writes: [{ update: { name: stateName, fields: { cursor: { stringValue: rows.length === limit ? rows.at(-1).name : "" }, lastRun: { timestampValue: new Date(now).toISOString() }, deleted: { integerValue: String(deleted) } } }, currentDocument: state ? { updateTime: state.updateTime } : { exists: false } }] });
  return { scanned: rows.length, deleted };
}
var init_chat_image_retention2 = __esm({
  "cloudflare/chat-image-retention.js"() {
    init_chat_image_retention();
  }
});

// cloudflare/worker-suite.js
var ADMIN_UID = "HcFJGmzHw6MYoWbFmtq9IyFSjvL2";
var SITE = "https://jun051873-art.github.io";
var WEB_API_KEY = "AIzaSyBS-lHTp1YPhhFOKriBRSrwdSomT3ZGw0c";
var oauthCache = null;
var oauthPending = null;
var worker_suite_default = {
  async fetch(request, env, ctx) {
    const cors = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET") return json({ ok: true, service: "salon-space-notify", version: "22-timed-manual-chat", authenticated: true, features: { timedManualChat: true, chatImageRetentionDays: 90, automaticMergedRecovery: true, customerRecovery: true, permanentMergeCleanup: env.CUSTOMER_CLEANUP_RULES_VERSION === "P141", androidNativePush: true, unifiedConversations: true, activeChatAutoReplySuppression: true, newCustomerNotifications: true, timeReplies: true, keywordReplies: true, keywordContains: true, scheduledCare: true, visitCare: true, personalVisitCare: true, appointmentReminders: true } }, 200, cors);
    if (request.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405, cors);
    try {
      if (request.headers.get("Origin") && request.headers.get("Origin") !== SITE) throw fault("ORIGIN_NOT_ALLOWED", 403);
      const raw = await request.text();
      if (raw.length > 24e3) throw fault("REQUEST_TOO_LARGE", 413);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        throw fault("INVALID_JSON", 400);
      }
      if (!body || typeof body !== "object") throw fault("INVALID_REQUEST", 400);
      const idToken = request.headers.get("Authorization")?.replace(/^Bearer /i, "") || body.idToken;
      if (typeof idToken !== "string" || !idToken) throw fault("LOGIN_REQUIRED_UPDATE_APP", 401);
      const who = await readJSON("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + WEB_API_KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }, "AUTH");
      const user = who.users?.[0];
      if (!user?.localId || user.disabled) throw fault("LOGIN_INVALID", 401);
      if (["recovery-issue", "recovery-redeem", "recovery-follow"].includes(body.action)) {
        if (body.action === "recovery-issue" && user.localId !== ADMIN_UID) throw fault("NOT_AUTHORIZED", 403);
        const [{ createCustomerRecovery: createCustomerRecovery2 }, { createCleanupRest: createCleanupRest2 }] = await Promise.all([Promise.resolve().then(() => (init_customer_recovery(), customer_recovery_exports)), Promise.resolve().then(() => (init_cleanup_rest(), cleanup_rest_exports))]);
        const access = await googleToken(env), connection = createCleanupRest2({ project: env.FIREBASE_PROJECT_ID, token: access });
        const recovery = createCustomerRecovery2({
          db: connection.db,
          actor: user.localId,
          checkAuth: async (uid) => {
            const result = await readJSON("https://identitytoolkit.googleapis.com/v1/projects/" + encodeURIComponent(env.FIREBASE_PROJECT_ID) + "/accounts:lookup", { method: "POST", headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" }, body: JSON.stringify({ localId: [uid] }) }, "RECOVERY_AUTH");
            if (!result.users?.some((u) => u.localId === uid && !u.disabled)) throw fault("RECOVERY_UNAVAILABLE", 409);
          },
          mint: (uid) => recoveryCustomToken(env, uid)
        });
        return json(body.action === "recovery-follow" ? await recovery.follow() : body.action === "recovery-issue" ? await recovery.issue(body.primaryUid) : await recovery.redeem(body.code), 200, cors);
      }
      if (["cleanup-preview", "cleanup-start", "cleanup-step"].includes(body.action)) {
        if (user.localId !== ADMIN_UID) throw fault("NOT_AUTHORIZED", 403);
        if (env.CUSTOMER_CLEANUP_RULES_VERSION !== "P141") return json({ ok: false, error: "\u6C38\u4E45\u6E05\u9664\u670D\u52D9\u5C1A\u672A\u555F\u7528\uFF1B\u9700\u5148\u5B8C\u6210\u898F\u5247\u8207\u5F8C\u7AEF\u90E8\u7F72\u3002" }, 409, cors);
        const [{ createCustomerCleanup: createCustomerCleanup2 }, { createCleanupRest: createCleanupRest2 }] = await Promise.all([Promise.resolve().then(() => (init_customer_cleanup(), customer_cleanup_exports)), Promise.resolve().then(() => (init_cleanup_rest(), cleanup_rest_exports))]);
        const connection = createCleanupRest2({ project: env.FIREBASE_PROJECT_ID, token: await googleToken(env) });
        const cleanup = createCustomerCleanup2({ ...connection, project: env.FIREBASE_PROJECT_ID, actor: user.localId, enabled: true });
        try {
          const result = body.action === "cleanup-preview" ? await cleanup.preview(body.primaryUid, body.sourceUid) : body.action === "cleanup-start" ? await cleanup.start(body.primaryUid, body.sourceUid, body.token) : await cleanup.step(body.jobId);
          return json(result, 200, cors);
        } catch (e) {
          return json({ ok: false, error: e.message || "\u6E05\u9664\u5C1A\u672A\u5B8C\u6210\uFF1B\u8CC7\u6599\u6703\u4FDD\u7559\u4EE5\u4FBF\u7E7C\u7E8C\u3002", retryable: ["ABORTED", "FAILED_PRECONDITION"].includes(e.code) }, e.status || 409, cors);
        }
      }
      if (body.action === "customer-joined") {
        if (user.localId === ADMIN_UID || body.customerUid !== user.localId) throw fault("NOT_AUTHORIZED", 403);
        return json(await notifyNewCustomer(env, user.localId), 200, cors);
      }
      const toAdmin = body.target === "admin";
      if (toAdmin ? user.localId === ADMIN_UID || body.customerUid !== user.localId : user.localId !== ADMIN_UID) throw fault("NOT_AUTHORIZED", 403);
      const recipient = toAdmin ? ADMIN_UID : body.customerUid;
      if (typeof recipient !== "string" || !recipient || recipient.includes("/") || recipient.length > 128) throw fault("INVALID_RECIPIENT", 400);
      const accessToken = await googleToken(env);
      const docRoot = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(env.FIREBASE_PROJECT_ID) + "/databases/(default)/documents/";
      if (typeof body.messageId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(body.messageId)) throw fault("MESSAGE_ID_REQUIRED_UPDATE_APP", 400);
      const room = toAdmin ? user.localId : recipient;
      const msg = await readJSON(docRoot + "chats/" + encodeURIComponent(room) + "/messages/" + body.messageId, { headers: { Authorization: "Bearer " + accessToken } }, "MESSAGE");
      if (msg.fields?.senderId?.stringValue !== user.localId) throw fault("MESSAGE_SENDER_MISMATCH", 403);
      const message = msg.fields?.text?.stringValue;
      if (typeof message !== "string") throw fault("MESSAGE_NOT_READY", 409);
      const customer = fieldsOf(await readJSON(docRoot + "users/" + encodeURIComponent(room), { headers: { Authorization: "Bearer " + accessToken } }, "CUSTOMER"));
      if (toAdmin && ((customer.status || "active") !== "active" || customer.adminDeleted)) throw fault("CUSTOMER_INACTIVE", 403);
      if (!toAdmin && !customer.conversationId && (customer.status || "active") !== "active") throw fault("CUSTOMER_INACTIVE", 403);
      if (toAdmin && customer.conversationId) {
        const g = fieldsOf(await readJSON(docRoot + "conversations/" + encodeURIComponent(customer.conversationId), { headers: { Authorization: "Bearer " + accessToken } }, "CONVERSATION"));
        if (g.blocked || g.state !== "active" || !g.memberIds?.includes(user.localId)) throw fault("CUSTOMER_INACTIVE", 403);
      }
      if (toAdmin) {
        const job = automaticReply(env, docRoot, accessToken, room, body.messageId, message, msg.fields?.createdAt?.timestampValue).catch((e) => console.error("auto-reply", e.code || e.message));
        if (ctx?.waitUntil) ctx.waitUntil(job);
        else await job;
      }
      const tokens = toAdmin ? await recipientTokens(docRoot, recipient, accessToken) : await conversationTokens(docRoot, recipient, accessToken);
      if (!tokens.length) return json({ ok: false, error: "NO_DEVICE_TOKENS", target: toAdmin ? "admin" : "customer", devices: 0, success: 0, failed: 0 }, 404, cors);
      const url = SITE + "/salon-space-chat/" + (toAdmin ? "admin.html?chat=" + encodeURIComponent(room) : "customer.html");
      const configuration = await salonConfig(docRoot, accessToken), shopName = configuration.name || "\u5C08\u5C6C\u7A7A\u9593";
      const customerName = customer.name || "\u5BA2\u4EBA";
      const title = customerName + "\uFF5C" + shopName;
      const preview = msg.fields?.sticker ? "\u50B3\u4F86\u4E00\u5F35\u8CBC\u5716" : msg.fields?.attachment ? unpack(msg.fields.attachment)?.type?.startsWith("image/") ? "\u50B3\u4F86\u4E00\u5F35\u7167\u7247" : "\u50B3\u4F86\u4E00\u4EFD\u9644\u4EF6" : message;
      const results = [];
      for (let i = 0; i < tokens.length; i += 5) {
        results.push(...await Promise.all(tokens.slice(i, i + 5).map(async (token) => {
          try {
            await readJSON("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(env.FIREBASE_PROJECT_ID) + "/messages:send", { method: "POST", headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token, data: { title, body: preview.slice(0, 500), tag: "salon-" + room + "-" + body.messageId, messageId: body.messageId, url }, webpush: { headers: { Urgency: "high", TTL: "86400" } } } }) }, "FCM");
            return { ok: true };
          } catch (e) {
            return { ok: false, error: e.code || "FCM_FAILED", status: e.status || 502 };
          }
        })));
      }
      const success = results.filter((r) => r.ok).length;
      return json({ ok: success > 0, target: toAdmin ? "admin" : "customer", devices: tokens.length, success, failed: tokens.length - success, errors: results.filter((r) => !r.ok), acceptedBy: "FCM", messageId: body.messageId }, success > 0 ? 200 : 502, cors);
    } catch (e) {
      console.error("salon-notify", e.code || "INTERNAL_ERROR", e.status || 500);
      return json({ ok: false, error: e.code || "INTERNAL_ERROR" }, e.status || 500, cors);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledReminders(env, controller));
  }
};
function fault(code, status = 502) {
  const e = new Error(code);
  e.code = code;
  e.status = status;
  return e;
}
async function readJSON(url, options = {}, stage = "UPSTREAM") {
  if (url.startsWith("https://fcm.googleapis.com/v1/projects/") && options.body) {
    const payload = JSON.parse(options.body), m = payload.message;
    if (m?.data?.url?.startsWith(SITE + "/salon-space-chat/customer.html")) {
      m.android = { ...m.android, priority: "HIGH", ttl: String(m.webpush?.headers?.TTL || 86400) + "s" };
      options = { ...options, body: JSON.stringify(payload) };
    }
  }
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8e3);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    let data2;
    try {
      data2 = await r.json();
    } catch {
      throw fault(stage + "_INVALID_RESPONSE");
    }
    if (!r.ok) {
      const detail = data2.error?.details?.find((x) => x.errorCode)?.errorCode || data2.error?.status || "HTTP_" + r.status;
      throw fault(stage + "_" + detail, r.status === 429 ? 429 : stage === "AUTH" ? 401 : r.status === 404 ? 404 : 502);
    }
    return data2;
  } catch (e) {
    if (e.name === "AbortError") throw fault(stage + "_TIMEOUT", 504);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function recipientTokens(root, uid, accessToken) {
  const headers = { Authorization: "Bearer " + accessToken }, tokens = /* @__PURE__ */ new Set();
  let page = "";
  do {
    const data2 = await readJSON(root + "pushTokens/" + encodeURIComponent(uid) + "/devices?pageSize=100" + (page ? "&pageToken=" + encodeURIComponent(page) : ""), { headers }, "DEVICES");
    for (const d of data2.documents || []) {
      const t = d.fields?.token?.stringValue;
      if (t) tokens.add(t);
    }
    page = data2.nextPageToken || "";
  } while (page);
  try {
    const d = await readJSON(root + "pushTokens/" + encodeURIComponent(uid), { headers }, "LEGACY_DEVICE");
    const t = d.fields?.token?.stringValue;
    if (t) tokens.add(t);
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  return [...tokens];
}
async function conversationTokens(root, uid, token) {
  const headers = { Authorization: "Bearer " + token };
  const user = fieldsOf(await readJSON(root + "users/" + encodeURIComponent(uid), { headers }, "CUSTOMER"));
  if (!user.conversationId) return (user.status || "active") === "active" && !user.adminDeleted ? recipientTokens(root, uid, token) : [];
  const group = fieldsOf(await readJSON(root + "conversations/" + encodeURIComponent(user.conversationId), { headers }, "CONVERSATION"));
  if (group.blocked) return [];
  if (group.state !== "active" || !Array.isArray(group.memberIds) || group.memberIds.length > 20 || !group.memberIds.includes(uid) || !group.historyRoomIds?.includes(uid)) throw fault("CONVERSATION_NOT_READY", 409);
  const tokens = /* @__PURE__ */ new Set();
  for (const member of group.memberIds) {
    if (typeof member !== "string" || member.includes("/") || member === ADMIN_UID) throw fault("INVALID_CONVERSATION", 409);
    const account = fieldsOf(await readJSON(root + "users/" + encodeURIComponent(member), { headers }, "MEMBER"));
    if (account.role !== "customer" || account.status !== "active" || account.adminDeleted || account.conversationId !== user.conversationId) continue;
    for (const value of await recipientTokens(root, member, token)) tokens.add(value);
  }
  return [...tokens];
}
async function googleToken(env) {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) throw fault("MISSING_FIREBASE_ENV", 500);
  const cacheKey = env.FIREBASE_PROJECT_ID + ":" + env.FIREBASE_CLIENT_EMAIL + (env.CUSTOMER_CLEANUP_RULES_VERSION === "P141" ? ":cleanup" : "");
  if (oauthCache?.key === cacheKey && oauthCache.until > Date.now() + 6e4) return oauthCache.token;
  if (oauthPending?.key === cacheKey) return oauthPending.promise;
  const pending = { key: cacheKey, promise: null };
  pending.promise = (async () => {
    const now = Math.floor(Date.now() / 1e3), encode = (obj) => base64Url(new TextEncoder().encode(JSON.stringify(obj)));
    const unsigned = encode({ alg: "RS256", typ: "JWT" }) + "." + encode({ iss: env.FIREBASE_CLIENT_EMAIL, scope: "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore" + (env.CUSTOMER_CLEANUP_RULES_VERSION === "P141" ? " https://www.googleapis.com/auth/cloud-platform" : ""), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
    const pem = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
    let cryptoKey;
    try {
      cryptoKey = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    } catch {
      throw fault("INVALID_PRIVATE_KEY_FORMAT", 500);
    }
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsigned));
    const data2 = await readJSON("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + base64Url(new Uint8Array(signature)) }) }, "OAUTH");
    if (!data2.access_token) throw fault("OAUTH_NO_ACCESS_TOKEN");
    oauthCache = { key: cacheKey, token: data2.access_token, until: Date.now() + Number(data2.expires_in || 3600) * 1e3 };
    return data2.access_token;
  })();
  oauthPending = pending;
  try {
    return await pending.promise;
  } finally {
    if (oauthPending === pending) oauthPending = null;
  }
}
function base64Url(bytes) {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function json(data2, status, headers) {
  return new Response(JSON.stringify(data2), { status, headers });
}
var salonConfigCache = null;
function unpack(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(unpack);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, unpack(x)]));
  return null;
}
function fieldsOf(d) {
  return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, unpack(v)]));
}
async function salonConfig(root, token, fresh = false) {
  if (!fresh && salonConfigCache?.until > Date.now()) return salonConfigCache.data;
  let data2 = {};
  try {
    data2 = fieldsOf(await readJSON(root + "announcements/settings", { headers: { Authorization: "Bearer " + token } }, "SETTINGS"));
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  salonConfigCache = { until: Date.now() + 3e5, data: data2 };
  return data2;
}
async function systemMessage(env, root, token, uid, id, text, customer = {}, shopName = "\u5C08\u5C6C\u7A7A\u9593") {
  if (await adminViewingChat(root, token, uid, true)) return false;
  const name = "projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/";
  const s = (v) => ({ stringValue: v });
  const cleanupGuard = await cleanupWriteGuard(env, root, token, uid);
  if (cleanupGuard === null) return false;
  try {
    await readJSON(root.slice(0, -1) + ":commit", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ writes: [...cleanupGuard, { update: { name: name + "chats/" + uid + "/messages/" + id, fields: { text: s(text.slice(0, 4e3)), senderId: s(ADMIN_UID), senderRole: s("admin"), clientMessageId: s(id), automatic: { booleanValue: true } } }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }] }, { update: { name: name + "chats/" + uid, fields: { lastMessage: s(text.slice(0, 4e3)) } }, updateMask: { fieldPaths: ["lastMessage"] }, updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }, { fieldPath: "lastAdminMessageAt", setToServerValue: "REQUEST_TIME" }] }] }) }, "AUTO_WRITE");
  } catch (e) {
    if (e.code?.includes("ALREADY_EXISTS") || e.code?.includes("FAILED_PRECONDITION")) return false;
    throw e;
  }
  const [customerTokens, ownerTokens] = await Promise.all([conversationTokens(root, uid, token), recipientTokens(root, ADMIN_UID, token)]);
  const ownerDevices = new Set(ownerTokens);
  const tokens = customerTokens.filter((device) => !ownerDevices.has(device));
  const customerName = customer.name || "\u5BA2\u4EBA";
  for (let i = 0; i < tokens.length; i += 5) await Promise.all(tokens.slice(i, i + 5).map((device) => readJSON("https://fcm.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/messages:send", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token: device, data: { title: customerName + "\uFF5C" + shopName, body: text.slice(0, 500), messageId: id, automatic: "true", recipientRole: "customer", tag: "salon-" + uid + "-" + id, url: SITE + "/salon-space-chat/customer.html" }, webpush: { headers: { Urgency: "high", TTL: "86400" } } } }) }, "AUTO_PUSH").catch((e) => console.error("auto-push", e.code))));
  return true;
}
function timeReply(config, instant2, holiday = false) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant2)).map((p) => [p.type, p.value]));
  const date = parts.year + "-" + parts.month + "-" + parts.day;
  const weekday = (/* @__PURE__ */ new Date(date + "T12:00:00+08:00")).getUTCDay(), hours = config.weeklyHours?.[weekday];
  let kind;
  if (holiday || hours?.closed === true) kind = "holiday";
  else if (hours && /^([01]\d|2[0-3]):[0-5]\d$/.test(hours.open) && /^([01]\d|2[0-3]):[0-5]\d$/.test(hours.close) && hours.open < hours.close) {
    const clock = parts.hour + ":" + parts.minute;
    kind = clock >= hours.open && clock < hours.close ? "business" : "outside";
  } else return null;
  const rule = config.timeReplies?.[kind];
  return rule?.enabled === true && typeof rule.text === "string" && rule.text.trim() ? { kind, answer: rule.text.trim().slice(0, 2e3) } : null;
}
function hasActiveAdminChat(notes, now = Date.now()) {
  if (notes?.chatMode === "auto") return false;
  if (notes?.chatMode === "manual") return manualChatActive(notes, now);
  return Object.values(notes?.adminChatPresence || {}).some((value) => {
    const at = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(at) && now - at >= 0 && now - at < 45e3;
  });
}
function manualChatActive(notes, now = Date.now()) {
  const start = Date.parse(notes?.manualChatStartedAt || ""), hours = Number(notes?.manualChatHours);
  return notes?.chatMode === "manual" && Number.isFinite(start) && Number.isFinite(hours) && hours >= 1 && now >= start && now < start + hours * 36e5;
}
async function adminViewingChat(root, token, uid, manualOnly = false) {
  const user = fieldsOf(await readJSON(root + "users/" + encodeURIComponent(uid), { headers: { Authorization: "Bearer " + token } }, "CUSTOMER"));
  let id = uid;
  if (user.conversationId) {
    const group = fieldsOf(await readJSON(root + "conversations/" + encodeURIComponent(user.conversationId), { headers: { Authorization: "Bearer " + token } }, "CONVERSATION"));
    if (group.state === "active" && Array.isArray(group.historyRoomIds) && group.historyRoomIds.length > 0 && group.historyRoomIds.length <= 40) id = [...group.historyRoomIds].sort()[0];
  }
  try {
    const notes = fieldsOf(await readJSON(root + "customerNotes/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token } }, "ADMIN_PRESENCE"));
    return manualOnly ? manualChatActive(notes) : hasActiveAdminChat(notes);
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}
async function automaticReply(env, root, token, uid, sourceId, text, sourceTime) {
  if (await adminViewingChat(root, token, uid)) return;
  const config = await salonConfig(root, token, true);
  let reply = config.keywordRepliesEnabled === true ? findReply(config.quickReplies, text) : null;
  if (!reply && Object.values(config.timeReplies || {}).some((r) => r?.enabled === true)) {
    const instant2 = sourceTime && Number.isFinite(Date.parse(sourceTime)) ? sourceTime : (/* @__PURE__ */ new Date()).toISOString();
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant2));
    let holiday = false;
    try {
      const h = fieldsOf(await readJSON(root + "holidays/" + date, { headers: { Authorization: "Bearer " + token } }, "HOLIDAY"));
      holiday = h.closed !== false;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    reply = timeReply(config, instant2, holiday);
  }
  if (!reply) return;
  const customer = fieldsOf(await readJSON(root + "users/" + uid, { headers: { Authorization: "Bearer " + token } }, "CUSTOMER"));
  if ((customer.status || "active") !== "active") return;
  if (await adminViewingChat(root, token, uid)) return;
  await systemMessage(env, root, token, uid, "auto_" + sourceId, reply.answer, customer, config.name || "\u5C08\u5C6C\u7A7A\u9593");
}
async function scanCollection(root, path, token) {
  let page = "", rows = [];
  do {
    const result = await readJSON(root + path + "?pageSize=300" + (page ? "&pageToken=" + encodeURIComponent(page) : ""), { headers: { Authorization: "Bearer " + token } }, "CARE_SCAN");
    rows.push(...(result.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...fieldsOf(d) })));
    page = result.nextPageToken || "";
    if (rows.length > 5e3) throw fault("CARE_CUSTOMER_LIMIT", 400);
  } while (page);
  return rows;
}
function taipeiDay(value) {
  const ms = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}
function careDue(rule, user, chat, now = Date.now()) {
  if (user.id === ADMIN_UID || user.role === "admin" || user.adminDeleted || user.adminMergedInto || (user.status || "active") !== "active" || user.marketingOptIn === false || !user.name || typeof rule.text !== "string" || !rule.text.trim()) return null;
  const day = taipeiDay(now), [year, month, date] = day.split("-").map(Number);
  if (rule.kind === "birthday") return Number(user.birthMonth) === month && Number(user.birthDay) === date ? year : null;
  if (rule.kind === "personalVisit" && (rule.targetUserId !== user.id || user.visitCareManaged !== true)) return null;
  if (rule.kind === "visit" && user.visitCareManaged === true) return null;
  if (!["inactive", "visit", "personalVisit"].includes(rule.kind)) return null;
  const value = ["visit", "personalVisit"].includes(rule.kind) ? user.lastVisitAt : chat?.lastCustomerMessageAt;
  const last = typeof value === "number" ? value : Date.parse(value || "");
  const days = Number(rule.days);
  if (!Number.isFinite(last) || last <= 0 || !Number.isInteger(days) || days < 1 || days > 365) return null;
  const elapsed = (Date.parse(day) - Date.parse(taipeiDay(last))) / 864e5;
  return elapsed >= days ? last : null;
}
async function runCare(env) {
  const token = await googleToken(env), root = "https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/";
  const all = await scanCollection(root, "broadcasts", token), rules = all.filter((r) => r.type === "automation" && r.enabled === true);
  let sent = 0, failed = 0, deferred = 0;
  if (rules.length) {
    const [users, chats, config] = await Promise.all([scanCollection(root, "users", token), scanCollection(root, "chats", token), salonConfig(root, token, true)]), chatMap = new Map(chats.map((c) => [c.id, c])), now = Date.now();
    const userMap = new Map(users.map((u) => [u.id, u]));
    for (const rule of rules) for (const user of rule.kind === "personalVisit" ? [userMap.get(rule.targetUserId)].filter(Boolean) : users) {
      const occurrence = careDue(rule, user, chatMap.get(user.id), now);
      if (occurrence === null) continue;
      if (sent >= 300) {
        deferred++;
        continue;
      }
      const id = "care_" + rule.id + "_" + user.id + "_" + occurrence;
      try {
        if (await systemMessage(env, root, token, user.id, id, rule.text.replaceAll("{\u59D3\u540D}", user.name), user, config.name || "\u5C08\u5C6C\u7A7A\u9593")) sent++;
      } catch (e) {
        failed++;
        console.error("care-message", e.code || "FAILED");
      }
    }
  }
  await readJSON(root + "broadcasts/_runtime?updateMask.fieldPaths=lastRun&updateMask.fieldPaths=sent&updateMask.fieldPaths=failed&updateMask.fieldPaths=deferred&updateMask.fieldPaths=type", { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ fields: { lastRun: { timestampValue: (/* @__PURE__ */ new Date()).toISOString() }, sent: { integerValue: String(sent) }, failed: { integerValue: String(failed) }, deferred: { integerValue: String(deferred) }, type: { stringValue: "runtime" } } }) }, "CARE_HEARTBEAT");
}
function findReply(rules, text) {
  const input = String(text || "").normalize("NFKC").toLocaleLowerCase().trim();
  return (Array.isArray(rules) ? rules : []).slice(0, 12).find((r) => {
    if (r.enabled === false || !r.title || !r.answer) return false;
    const keys = Array.isArray(r.keywords) ? r.keywords.filter((k) => typeof k === "string" && k.trim()).slice(0, 8) : [];
    return input === String(r.title).normalize("NFKC").toLocaleLowerCase().trim() || keys.some((k) => input.includes(k.normalize("NFKC").toLocaleLowerCase().trim()));
  });
}
async function notifyNewCustomer(env, uid) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw fault("INVALID_RECIPIENT", 400);
  const token = await googleToken(env), root = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(env.FIREBASE_PROJECT_ID) + "/databases/(default)/documents/", headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const customerDoc = await readJSON(root + "users/" + uid, { headers }, "CUSTOMER"), customer = fieldsOf(customerDoc);
  if (customer.cleanupLock || customer.status !== "pending") return { ok: true, skipped: "not-pending" };
  const path = "notificationJobs/join_" + uid;
  let previous = null;
  try {
    previous = await readJSON(root + path, { headers }, "JOIN_JOB");
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const state = fieldsOf(previous || {});
  if (state.status === "sent") return { ok: true, alreadySent: true };
  if (state.status === "sending" && Number(state.leaseUntil) > Date.now()) return { ok: true, inProgress: true };
  const precondition = previous ? "currentDocument.updateTime=" + encodeURIComponent(previous.updateTime) : "currentDocument.exists=false";
  try {
    await writeJoinJob(env, root, token, path, { status: "sending", leaseUntil: Date.now() + 12e4 }, customerDoc, previous ? { updateTime: previous.updateTime } : { exists: false });
  } catch (e) {
    if (/ALREADY_EXISTS|FAILED_PRECONDITION/.test(e.code || "")) return { ok: true, inProgress: true };
    throw e;
  }
  try {
    const tokens = await recipientTokens(root, ADMIN_UID, token);
    if (!tokens.length) throw fault("NO_DEVICE_TOKENS", 404);
    const results = [];
    for (let i = 0; i < tokens.length; i += 5) results.push(...await Promise.all(tokens.slice(i, i + 5).map(async (device) => {
      try {
        await readJSON("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(env.FIREBASE_PROJECT_ID) + "/messages:send", { method: "POST", headers, body: JSON.stringify({ message: { token: device, data: { title: "\u65B0\u5BA2\u52A0\u5165\u30FB\u5F85\u6838\u51C6", body: String(customer.name || "\u65B0\u5BA2\u4EBA").slice(0, 60) + " \u5DF2\u9001\u51FA\u52A0\u5165\u7533\u8ACB\uFF0C\u9EDE\u6B64\u6838\u5C0D\u3002", tag: "salon-join-" + uid, url: SITE + "/salon-space-chat/admin.html?view=approvals" }, webpush: { headers: { Urgency: "high", TTL: "86400" } } } }) }, "FCM");
        return true;
      } catch {
        return false;
      }
    })));
    const success = results.filter(Boolean).length;
    if (!success) throw fault("FCM_FAILED");
    await writeJoinJob(env, root, token, path, { status: "sent", leaseUntil: 0 }, customerDoc);
    return { ok: true, success, devices: tokens.length, acceptedBy: "FCM" };
  } catch (e) {
    try {
      await writeJoinJob(env, root, token, path, { status: "retry", leaseUntil: 0 }, customerDoc);
    } catch {
    }
    throw e;
  }
}
function packValue(v) {
  if (v === null || v === void 0) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(v) };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(packValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, packValue(x)])) } };
}
var packFields = (x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, packValue(v)]));
async function appointmentDoc(root, path, token) {
  try {
    return await readJSON(root + path, { headers: { Authorization: "Bearer " + token } }, "APPOINTMENT_READ");
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}
async function appointmentPatch(root, path, token, data2, version) {
  return readJSON(root + path + "?" + Object.keys(data2).map((k) => "updateMask.fieldPaths=" + encodeURIComponent(k)).join("&") + (version ? "&currentDocument.updateTime=" + encodeURIComponent(version) : ""), { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ fields: packFields(data2) }) }, "APPOINTMENT_UPDATE");
}
async function dueAppointments(root, token, field, now, limit = 4) {
  const data2 = await readJSON(root.slice(0, -1) + ":runQuery", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "broadcasts" }], where: { compositeFilter: { op: "AND", filters: [{ fieldFilter: { field: { fieldPath: field }, op: "GREATER_THAN", value: { integerValue: "0" } } }, { fieldFilter: { field: { fieldPath: field }, op: "LESS_THAN_OR_EQUAL", value: { integerValue: String(now) } } }] } }, orderBy: [{ field: { fieldPath: field }, direction: "ASCENDING" }], limit } }) }, "APPOINTMENT_QUERY");
  return data2.filter((x) => x.document).map((x) => x.document);
}
function appointmentDue(job, user, config, now) {
  if (job.type !== "appointmentReminder" || job.status !== "queued") return "skip";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(job.userId || "") || !/^[A-Za-z0-9_-]{1,80}$/.test(job.revision || "") || !Number.isFinite(job.remindAt) || !Number.isFinite(job.appointmentAt) || job.remindAt >= job.appointmentAt || typeof job.text !== "string" || !job.text.trim()) return "invalid";
  if (job.remindAt > now) return "future";
  if (now >= job.appointmentAt || now - job.remindAt > 5 * 6e4) return "expired";
  if (config.appointmentReminder?.enabled !== true) return "paused";
  if (!user || user.id === ADMIN_UID || user.role === "admin" || user.adminDeleted || user.adminMergedInto || (user.status || "active") !== "active" || user.marketingOptIn === false) return "excluded";
  return "send";
}
function appointmentCopy(job, user) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(job.appointmentAt)).map((p) => [p.type, p.value]));
  return job.text.replaceAll("{\u59D3\u540D}", user.name || "\u60A8\u597D").replaceAll("{\u9810\u7D04\u65E5\u671F}", parts.year + "/" + parts.month + "/" + parts.day).replaceAll("{\u9810\u7D04\u6642\u9593}", parts.hour + ":" + parts.minute).slice(0, 4e3);
}
async function processAppointment(env, root, token, queueDoc, now = Date.now()) {
  const path = queueDoc.name.split("/documents/")[1], fresh = await appointmentDoc(root, path, token);
  if (!fresh) return false;
  const job = fieldsOf(fresh);
  if (job.type !== "appointmentReminder" || job.status !== "queued") return false;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(job.userId || "")) {
    await appointmentPatch(root, path, token, { status: "invalid", appointmentDueAt: null }, fresh.updateTime);
    return false;
  }
  const [userDoc, configDoc] = await Promise.all([appointmentDoc(root, "users/" + job.userId, token), appointmentDoc(root, "announcements/settings", token)]), user = userDoc ? { ...fieldsOf(userDoc), id: job.userId } : null, config = fieldsOf(configDoc || {}), decision = appointmentDue(job, user, config, now);
  if (env.CUSTOMER_CLEANUP_RULES_VERSION === "P141" && (!user || user.cleanupLock)) return false;
  if (decision === "skip" || decision === "future") return false;
  if (decision === "send" && await adminViewingChat(root, token, job.userId, true)) return false;
  const base = "projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/", headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const guard2 = (document, path2, field) => ({ update: { name: base + path2, fields: document.fields?.[field] ? { [field]: document.fields[field] } : {} }, updateMask: { fieldPaths: [field] }, currentDocument: { updateTime: document.updateTime } });
  const verify = [...userDoc ? [guard2(userDoc, "users/" + job.userId, "status")] : [], ...configDoc ? [guard2(configDoc, "announcements/settings", "appointmentReminder")] : []];
  const id = "appointment_" + job.userId + "_" + job.revision, text = decision === "send" ? appointmentCopy(job, user) : "", next = { ...job, status: decision === "send" ? "sent" : decision, appointmentDueAt: null, appointmentPushDueAt: decision === "send" ? now : null, deliveredTokens: [], pushAttempts: 0, ...decision === "send" ? { messageId: id, messageText: text, sentAt: now } : {} };
  const writes = [...verify, { update: { name: base + path, fields: packFields(next) }, currentDocument: { updateTime: fresh.updateTime } }, { update: { name: base + "chats/" + job.userId, fields: packFields({ appointmentReminderDraft: next, ...decision === "send" ? { lastMessage: text } : {} }) }, updateMask: { fieldPaths: decision === "send" ? ["appointmentReminderDraft", "lastMessage"] : ["appointmentReminderDraft"] }, ...decision === "send" ? { updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }, { fieldPath: "lastAdminMessageAt", setToServerValue: "REQUEST_TIME" }] } : {} }];
  if (decision === "send") writes.push({ update: { name: base + "chats/" + job.userId + "/messages/" + id, fields: packFields({ text, senderId: ADMIN_UID, senderRole: "admin", clientMessageId: id, automatic: true }) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }] });
  try {
    await readJSON(root.slice(0, -1) + ":commit", { method: "POST", headers, body: JSON.stringify({ writes }) }, "APPOINTMENT_COMMIT");
    return decision === "send";
  } catch (e) {
    if (/ALREADY_EXISTS|FAILED_PRECONDITION|ABORTED/.test(e.code || "")) return false;
    throw e;
  }
}
async function pushAppointment(env, root, token, queueDoc, now = Date.now()) {
  const path = queueDoc.name.split("/documents/")[1], fresh = await appointmentDoc(root, path, token);
  if (!fresh) return;
  const job = fieldsOf(fresh);
  if (job.type !== "appointmentReminder" || job.status !== "sent" || !job.appointmentPushDueAt || job.appointmentPushDueAt > now) return;
  if (now >= job.appointmentAt || Number(job.pushAttempts) >= 3) {
    await appointmentPatch(root, path, token, { appointmentPushDueAt: null, pushStatus: "expired" }, fresh.updateTime);
    return;
  }
  let lease;
  try {
    lease = await appointmentPatch(root, path, token, { appointmentPushDueAt: now + 12e4, pushAttempts: Number(job.pushAttempts || 0) + 1 }, fresh.updateTime);
  } catch (e) {
    if (/FAILED_PRECONDITION|ABORTED/.test(e.code || "")) return;
    throw e;
  }
  const delivered = new Set(job.deliveredTokens || []);
  let pending = true;
  try {
    const userDoc = await appointmentDoc(root, "users/" + job.userId, token), user = userDoc ? fieldsOf(userDoc) : null;
    if (!user || user.cleanupLock || user.adminDeleted || user.adminMergedInto || (user.status || "active") !== "active" || user.marketingOptIn === false) {
      await appointmentPatch(root, path, token, { appointmentPushDueAt: null, pushStatus: "excluded" }, lease.updateTime);
      return;
    }
    const customerTokens = await conversationTokens(root, job.userId, token), ownerTokens = new Set(await recipientTokens(root, ADMIN_UID, token)), tokens = customerTokens.filter((t) => !ownerTokens.has(t)), config = await salonConfig(root, token);
    const ttl = Math.max(1, Math.min(3600, Math.floor((job.appointmentAt - now) / 1e3)));
    for (const device of tokens.filter((t) => !delivered.has(t)).slice(0, 5)) {
      try {
        await readJSON("https://fcm.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/messages:send", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token: device, data: { title: (user.name || "\u5BA2\u4EBA") + "\uFF5C" + (config.name || "\u5C08\u5C6C\u7A7A\u9593"), body: job.messageText.slice(0, 500), messageId: job.messageId, automatic: "true", recipientRole: "customer", tag: "salon-" + job.userId + "-" + job.messageId, url: SITE + "/salon-space-chat/customer.html" }, webpush: { headers: { Urgency: "high", TTL: String(ttl) } } } }) }, "APPOINTMENT_PUSH");
        delivered.add(device);
      } catch (e) {
        console.error("appointment-push", e.code);
      }
    }
    pending = !tokens.length || tokens.some((t) => !delivered.has(t));
  } catch (e) {
    console.error("appointment-push-read", e.code || e.message);
  }
  const exhausted = Number(job.pushAttempts || 0) + 1 >= 3;
  await appointmentPatch(root, path, token, { deliveredTokens: [...delivered], appointmentPushDueAt: pending && !exhausted ? now + 6e4 : null, pushStatus: pending ? exhausted ? "failed" : "retry" : "accepted" }, lease.updateTime);
}
async function runAppointments(env, cron = "") {
  const token = await googleToken(env), root = "https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/", now = Date.now();
  let failed = 0, sent = 0;
  for (const d of await dueAppointments(root, token, "appointmentDueAt", now, 2)) {
    try {
      if (await processAppointment(env, root, token, d, now)) sent++;
    } catch (e) {
      failed++;
      console.error("appointment-message", e.code || e.message);
    }
  }
  for (const d of await dueAppointments(root, token, "appointmentPushDueAt", now, 2)) {
    try {
      await pushAppointment(env, root, token, d, now);
    } catch (e) {
      failed++;
      console.error("appointment-notification", e.code || e.message);
    }
  }
  await appointmentPatch(root, "broadcasts/_runtime", token, { lastAppointmentRun: (/* @__PURE__ */ new Date()).toISOString(), appointmentCron: cron, appointmentSent: sent, appointmentFailed: failed });
}
async function runScheduledReminders(env, controller) {
  const time = new Date(controller?.scheduledTime || Date.now()), hour = (time.getUTCHours() + 8) % 24;
  const jobs = [runAppointments(env, controller?.cron || ""), runImageRetention(env, time.getTime())];
  if (time.getUTCMinutes() === 0 && hour >= 10 && hour <= 20) jobs.push(runCare(env));
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === "rejected") throw r.reason;
}
async function cleanupWriteGuard(env, root, token, uid) {
  if (env.CUSTOMER_CLEANUP_RULES_VERSION !== "P141") return [];
  const snapshot = await appointmentDoc(root, "users/" + uid, token);
  if (!snapshot) return null;
  const user = fieldsOf(snapshot);
  if (user.cleanupLock || user.adminDeleted || (user.status || "active") !== "active") return null;
  return [{ update: { name: snapshot.name, fields: snapshot.fields.status ? { status: snapshot.fields.status } : {} }, updateMask: { fieldPaths: ["status"] }, currentDocument: { updateTime: snapshot.updateTime } }];
}
async function writeJoinJob(env, root, token, path, values, customerDoc, currentDocument) {
  const fields = packFields(values), headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  if (env.CUSTOMER_CLEANUP_RULES_VERSION !== "P141") {
    const q = currentDocument ? "?" + (currentDocument.updateTime ? "currentDocument.updateTime=" + encodeURIComponent(currentDocument.updateTime) : "currentDocument.exists=false") : "";
    return readJSON(root + path + q, { method: "PATCH", headers, body: JSON.stringify({ fields }) }, "JOIN_WRITE");
  }
  customerDoc = await appointmentDoc(root, "users/" + customerDoc.name.split("/").pop(), token);
  if (!customerDoc || fieldsOf(customerDoc).cleanupLock || fieldsOf(customerDoc).status !== "pending") throw fault("CUSTOMER_CHANGED", 409);
  const name = "projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/";
  return readJSON(root.slice(0, -1) + ":commit", { method: "POST", headers, body: JSON.stringify({ writes: [{ update: { name: customerDoc.name, fields: { status: customerDoc.fields.status } }, updateMask: { fieldPaths: ["status"] }, currentDocument: { updateTime: customerDoc.updateTime } }, { update: { name: name + path, fields }, ...currentDocument ? { currentDocument } : {} }] }) }, "JOIN_WRITE");
}
async function recoveryCustomToken(env, uid) {
  const now = Math.floor(Date.now() / 1e3), encode = (obj) => base64Url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = encode({ alg: "RS256", typ: "JWT" }) + "." + encode({ iss: env.FIREBASE_CLIENT_EMAIL, sub: env.FIREBASE_CLIENT_EMAIL, aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit", iat: now, exp: now + 300, uid });
  const pem = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return unsigned + "." + base64Url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned))));
}
async function runImageRetention(env, now) {
  const { sweepChatImages: sweepChatImages2 } = await Promise.resolve().then(() => (init_chat_image_retention2(), chat_image_retention_exports));
  const token = await googleToken(env);
  return sweepChatImages2({ root: "https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/", token, now });
}
export {
  worker_suite_default as default
};
