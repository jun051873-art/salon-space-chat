// Caller must be authenticated salon owner. Firestore rules enforce the same boundary.
export async function mergeConversations({db,doc,runTransaction,stamp,primaryUid,secondaryUid}) {
 if(!primaryUid||!secondaryUid||primaryUid===secondaryUid)throw Error('請選擇兩筆不同顧客資料');
 return runTransaction(db,async tx=>{
  const selected=await Promise.all([primaryUid,secondaryUid].map(uid=>tx.get(doc(db,'users',uid))));
  if(selected.some(s=>!s.exists()||s.data().role!=='customer'||s.data().adminDeleted||['blocked','revoked','archived'].includes(s.data().status)))throw Error('請先確認兩筆都是有效的顧客資料');
  const groupIds=[...new Set(selected.map(s=>s.data().conversationId).filter(Boolean))];
  const groupSnaps=await Promise.all(groupIds.map(id=>tx.get(doc(db,'conversations',id))));
  if(groupSnaps.some(s=>!s.exists()||s.data().state!=='active'||s.data().blocked===true))throw Error('原合併資料不完整，請先核對');
  const groups=groupSnaps.map(s=>({id:s.id,...s.data()}));
  const members=[...new Set([primaryUid,secondaryUid,...groups.flatMap(g=>g.memberIds)])];
  const rooms=[...new Set([...members,...groups.flatMap(g=>g.historyRoomIds)])];
  if(members.length>20||rooms.length>40)throw Error('這組顧客帳號過多，請先核對資料');
  const accounts=await Promise.all(members.map(uid=>tx.get(doc(db,'users',uid))));
  if(accounts.some(s=>!s.exists()||s.data().role!=='customer'||s.data().conversationId&&!groupIds.includes(s.data().conversationId)))throw Error('合併資料已變更，請重新開啟後再試');
  const id=selected[0].data().conversationId||selected[1].data().conversationId||primaryUid;
  const revision=Math.max(0,...groups.map(g=>g.revision||0))+1;
  const note=await tx.get(doc(db,'customerNotes',primaryUid));
  const group={state:'active',primaryUid,memberIds:members,historyRoomIds:rooms,revision,updatedAt:stamp()};
  tx.set(doc(db,'conversations',id),group);
  const tags=[...new Set(accounts.flatMap(s=>s.data().tags||[]))].slice(0,20);
  const visits=accounts.map(s=>s.data().lastVisitAt).filter(Boolean).sort((a,b)=>(b.toMillis?.()||0)-(a.toMillis?.()||0));
  tx.update(doc(db,'users',primaryUid),{tags,...(visits.length?{lastVisitAt:visits[0]}:{})});
  tx.set(doc(db,'customerNotes',primaryUid),{linkedCustomerIds:[...new Set([...(note.data()?.linkedCustomerIds||[]),...members.filter(uid=>uid!==primaryUid)])],updatedAt:stamp()},{merge:true});
  for(const uid of members){
   tx.update(doc(db,'users',uid),{conversationId:id,adminMergedInto:uid===primaryUid?'':primaryUid});
   tx.set(doc(db,'chats',uid),{conversationId:id,conversationPrimaryUid:primaryUid,conversationName:selected[0].data().adminProfile?.name||selected[0].data().name||'客人',adminArchived:false},{merge:true});
  }
  for(const old of groupIds)if(old!==id)tx.set(doc(db,'conversations',old),{state:'redirect',to:id,updatedAt:stamp()});
  tx.set(doc(db,'conversationMergeAudit',id+'_'+revision),{primaryUid,memberIds:members,historyRoomIds:rooms,previous:accounts.map(s=>({uid:s.id,conversationId:s.data().conversationId||null})),createdAt:stamp()});
  return {id,...group};
 });
}
