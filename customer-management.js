// Admin-managed lifecycle; deletion is reversible and never purges messages.
export function customerVisible(u,status='') {return !u.adminMergedInto && (status==='deleted' ? u.adminDeleted===true : !u.adminDeleted);}
export function broadcastEligible(u,adminId){return customerVisible(u)&&u.id!==adminId&&u.role!=='admin'&&(u.status||'active')==='active'&&u.marketingOptIn!==false;}
export function customerDeletionPatch(restoring=false){return {adminDeleted:!restoring,status:restoring?'pending':'revoked'};}
function createdMillis(v){return v?.toMillis?.()??(typeof v==='number'?v:typeof v==='string'?Date.parse(v)||0:v?.seconds?Number(v.seconds)*1000:0);}
// Keep the established customer identity as the primary record when a returning
// customer joins again. Unknown dates preserve the record the owner opened.
export function olderCustomerPrimary(current,candidate){
 const currentAt=createdMillis(current?.createdAt||current?.joinedAt),candidateAt=createdMillis(candidate?.createdAt||candidate?.joinedAt);
 return candidateAt&&currentAt?candidateAt<currentAt?candidate:current:candidateAt&&!currentAt?candidate:current;
}


// Archived rooms with unread incoming messages must remain reachable in the inbox.
export function inboxRoomVisible(room,archived=false){
 const at=createdMillis(room.lastCustomerMessageAt);
 return !room.adminDeleted&&(archived?room.adminArchived===true:!room.adminArchived||at>Number(room.readAdminMs||0));
}

// Group only records explicitly mapped by the owner, never names or phone numbers.
export function groupConversationRows(rows){
 const groups=new Map();
 for(const row of rows){const key=row.conversationId||row.id;const prior=groups.get(key);
  if(!prior){groups.set(key,{...row,memberRows:[row],name:row.conversationName||row.name});continue;}
  prior.memberRows.push(row);
  const latest=createdMillis(row.updatedAt)>createdMillis(prior.updatedAt)?row:prior;
  const members=prior.memberRows;groups.set(key,{...latest,memberRows:members,name:row.conversationName||prior.name});
 }
 return [...groups.values()].map(row=>{
  if(!row.conversationId)return row;
  const unread=row.memberRows.some(x=>createdMillis(x.lastCustomerMessageAt)>Number(x.readAdminMs||0));
  return {...row,adminDeleted:row.memberRows.every(x=>x.adminDeleted),adminArchived:row.memberRows.every(x=>x.adminArchived),groupUnread:unread,readAdminMs:unread?0:Math.max(...row.memberRows.map(x=>Number(x.readAdminMs||0))),lastCustomerMessageAt:Math.max(...row.memberRows.map(x=>createdMillis(x.lastCustomerMessageAt)))};
 });
}
