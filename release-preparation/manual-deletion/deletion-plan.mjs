/** Read-only assessment. Never calls delete/update APIs. */
export const PROJECT = 'salon-space-chat';
export const OWNER = 'HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
export function validateTarget(project, uid) {
  if (project !== PROJECT) throw new Error('專案不符；禁止處理其他雲端。');
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || uid === OWNER)
    throw new Error('須指定單一客人 UID，不能是店主或資料路徑。');
}
export async function assess({project, uid, db}) {
  validateTarget(project, uid);
  const user = await db.doc(`users/${uid}`).get();
  if (!user.exists || user.data().role !== 'customer') throw new Error('查無可確認的客人資料；停止。');
  const paths = new Set();
  async function walk(ref) {
    const snap = await ref.get();
    if (snap.exists) paths.add(ref.path);
    // listCollections/listDocuments includes descendants under missing parent docs.
    for (const collection of await ref.listCollections())
      for (const child of await collection.listDocuments()) await walk(child);
  }
  for (const name of ['users','chats','pushTokens','customerNotes']) await walk(db.doc(`${name}/${uid}`));
  for (const name of ['feedback','broadcasts','notificationJobs']) {
    let cursor;
    do {
      let query = db.collection(name).where('userId','==',uid).orderBy('__name__').limit(200);
      if (cursor) query=query.startAfter(cursor);
      const page=await query.get();
      for(const doc of page.docs) await walk(doc.ref);
      cursor=page.docs.length === 200 ? page.docs.at(-1) : null;
    } while(cursor);
  }
  await walk(db.doc(`notificationJobs/join_${uid}`));
  const ownLinks = (await db.doc(`customerNotes/${uid}`).get()).data()?.linkedCustomerIds || [];
  const reverseLinks = await db.collection('customerNotes').where('linkedCustomerIds','array-contains',uid).get();
  const bookings = await db.collection('bookings').where('userId','==',uid).limit(1).get();
  return {
    schema:1, project, uid, assessedAt:new Date().toISOString(),
    mode:'read-only', productionDeletionEnabled:false,
    firestorePaths:[...paths].sort(),
    authTarget:uid,
    blockers:[
      '尚未確認備份、Cloud Storage、外部匯出與完整資料保留清單。',
      '尚未驗證永久刪除時阻止舊登入權杖、推播排程及正在傳送的訊息重新寫入。',
      ...(ownLinks.length || reverseLinks.docs.length ? ['此客人有合併關聯；須先核對本人所有身分，不可連帶刪除其他客人。'] : []),
      ...(bookings.docs.length ? ['存在預約紀錄；本工具不修改預約表，須另確認資料範圍。'] : [])
    ],
    note:'此報告僅供核對，不代表已刪除。身分核對由店主處理；不得只憑來信稱呼認定申請者。'
  };
}
