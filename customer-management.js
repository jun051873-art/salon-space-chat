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

