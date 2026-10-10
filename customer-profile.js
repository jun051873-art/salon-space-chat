// Save the customer record and its conversation label together. Never write
// approval/status from a potentially stale browser copy of the profile.
export async function saveCustomerProfile({db,uid,changes,doc,runTransaction,serverTimestamp}) {
  if (!uid) throw new Error('登入狀態已失效，請重新開啟頁面；填寫內容會保留。');
  const editable = new Set(['name','phone','birthMonth','birthDay','gender','avatar']);
  if (Object.keys(changes).some(key => !editable.has(key))) throw new Error('這項資料需由店家修改。');
  try {
    return await runTransaction(db, async tx => {
      const userRef = doc(db,'users',uid);
      const snapshot = await tx.get(userRef);
      if (!snapshot.exists()) throw new Error('找不到原有資料，請聯絡店家協助核對；填寫內容會保留。');
      const current = snapshot.data();
      if ((current.status || 'active') !== 'active') throw new Error('帳戶目前尚未開放修改，請聯絡店家確認；填寫內容會保留。');
      if (current.role && current.role !== 'customer') throw new Error('請使用客人入口修改自己的資料。');
      const changed = Object.fromEntries(Object.entries(changes).filter(([key,value]) => value !== current[key]));
      const next = {...current,...changed};
      if (!Object.keys(changed).length) return next;
      const identityChanged = 'name' in changed || 'phone' in changed;
      const chatRef = doc(db,'chats',uid);
      const chat = identityChanged ? await tx.get(chatRef) : null;
      if (chat?.exists() && (chat.data().status || 'active') !== 'active') throw new Error('對話目前暫停使用，請聯絡店家確認；填寫內容會保留。');
      const update = {...changed,updatedAt:serverTimestamp()};
      // Older approved records may predate the role field.
      if (!current.role) update.role = 'customer';
      tx.set(userRef,update,{merge:true});
      if (identityChanged) {
        const label = {name:next.name || '',phone:next.phone || ''};
        if (!chat.exists()) Object.assign(label,{userId:uid,status:'active'});
        tx.set(chatRef,label,{merge:true});
      }
      return next;
    });
  } catch (error) {
    const code = String(error.code || '').replace(/^firestore\//,'');
    if (code === 'permission-denied') throw new Error('資料尚未儲存，請聯絡店家確認帳戶權限；你填的內容會保留，不用重填。');
    if (code === 'unavailable' || code === 'deadline-exceeded') throw new Error('目前連線不穩，資料尚未儲存；請恢復網路後再按一次儲存，填寫內容會保留。');
    throw error;
  }
}
