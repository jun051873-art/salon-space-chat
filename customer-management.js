// Admin-managed lifecycle; deletion is reversible and never purges messages.
export function customerVisible(u,status='') {return !u.adminMergedInto && (status==='deleted' ? u.adminDeleted===true : !u.adminDeleted);}
export function broadcastEligible(u,adminId){return customerVisible(u)&&u.id!==adminId&&u.role!=='admin'&&(u.status||'active')==='active'&&u.marketingOptIn!==false;}
export function customerDeletionPatch(restoring=false){return {adminDeleted:!restoring,status:restoring?'pending':'revoked'};}
