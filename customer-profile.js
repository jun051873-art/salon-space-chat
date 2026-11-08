// Save the customer record and its conversation label together. Never write
// approval/status from a potentially stale browser copy of the profile.
export async function saveCustomerProfile({db,uid,changes,baseline,doc,runTransaction,serverTimestamp}) {
  if (!uid) throw new Error('登入狀態已失效，請重新開啟頁面；填寫內容會保留。');
  const editable = new Set(['name','phone','birthMonth','birthDay','gender','avatar','profileCover','statusText','profileEffect','profileWeatherCity','profileEffectDirection','profileRandom']);
  if (Object.keys(changes).some(key => !editable.has(key))) throw new Error('這項資料需由店家修改。');
  if ('statusText' in changes && (typeof changes.statusText !== 'string' || changes.statusText.length > 120)) throw new Error('近況最多 120 字。');
  if ('profileEffect' in changes && !["none", "sakura", "weather", "solar", "rain", "petals", "snow", "sun", "fireflies", "bubbles", "ripples", "leaves", "stars", "confetti", "wind", "clouds", "suncloud", "moon", "rainbow", "mist", "lanterns", "newyear", "fireworks", "christmas", "gifts", "midautumn", "dragonboat", "hearts", "birthday", "halloween", "sprouts", "wheat"].includes(changes.profileEffect)) throw new Error('請選擇有效的個人頁特效。');
  if ('profileWeatherCity' in changes && !['yingge','taipei','keelung','taoyuan','taichung','tainan','kaohsiung','hualien'].includes(changes.profileWeatherCity)) throw Error('請選擇天氣地區');
  if ('profileEffectDirection' in changes && !['left','right','stay'].includes(changes.profileEffectDirection)) throw Error('請選擇動態方向');
  if ('profileRandom' in changes && typeof changes.profileRandom !== 'boolean') throw Error('請選擇有效的隨機切換設定');
  try {
    return await runTransaction(db, async tx => {
      const userRef = doc(db,'users',uid);
      const snapshot = await tx.get(userRef);
      if (!snapshot.exists()) throw new Error('找不到原有資料，請聯絡店家協助核對；填寫內容會保留。');
      const current = snapshot.data();
      if ((current.status || 'active') !== 'active') throw new Error('帳戶目前尚未開放修改，請聯絡店家確認；填寫內容會保留。');
      if (current.role && current.role !== 'customer') throw new Error('請使用客人入口修改自己的資料。');
      const groupRef=current.conversationId?doc(db,'conversations',current.conversationId):null;
      const group=groupRef?(await tx.get(groupRef)).data():null;
      if(groupRef&&(!group||group.state!=='active'||group.blocked||!group.memberIds?.includes(uid)))throw Error('合併資料已變更，請重新開啟個人頁');
      const effective={...current,...(group?.sharedProfile||{})};
      const changed = Object.fromEntries(Object.entries(changes).filter(([key,value]) => value !== (baseline||effective)[key]));
      if('birthMonth' in changed||'birthDay' in changed){changed.birthMonth=changes.birthMonth??effective.birthMonth??null;changed.birthDay=changes.birthDay??effective.birthDay??null;}
      const next = {...effective,...changed};
      if (!Object.keys(changed).length) return next;
      const identityChanged = 'name' in changed || 'phone' in changed;
      const chatRef = doc(db,'chats',uid);
      const chat = identityChanged ? await tx.get(chatRef) : null;
      if (chat?.exists() && (chat.data().status || 'active') !== 'active') throw new Error('對話目前暫停使用，請聯絡店家確認；填寫內容會保留。');
      const update = {...changed,updatedAt:serverTimestamp()};
      // Older approved records may predate the role field.
      if (!current.role) update.role = 'customer';
      tx.set(userRef,update,{merge:true});
      if(groupRef)tx.update(groupRef,{sharedProfile:{...(group.sharedProfile||{}),...changed}});
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
