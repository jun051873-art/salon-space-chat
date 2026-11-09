// Only owner-confirmed conversation members may contribute profile fields.
const textFields=['name','phone','gender','avatar','profileCover','statusText','profileEffect','profileWeatherCity','profileEffectDirection'];
const present=v=>typeof v==='string'&&v.trim().length>0;
const time=u=>{const v=u.createdAt||u.joinedAt;return v?.toMillis?.()||(v?.seconds?Number(v.seconds)*1000:typeof v==='number'?v:0)||Number.MAX_SAFE_INTEGER;};
export function ownerProfile(u){
 const {adminProfile,adminName,...result}=u;
 return result;
}
export function mergedProfileFields(primary,accounts){
 const others=accounts.filter(u=>u.id!==primary.id).sort((a,b)=>time(a)-time(b)||String(a.id).localeCompare(String(b.id)));
 const records=[primary,...others].map(ownerProfile),result={};
 for(const key of textFields){const source=records.find(u=>present(u[key]));if(source)result[key]=source[key];}
 // A birthday is one value: never assemble a month and day from different people/records.
 const birthday=records.find(u=>Number(u.birthMonth)>0&&Number(u.birthDay)>0);
 if(birthday){result.birthMonth=birthday.birthMonth;result.birthDay=birthday.birthDay;}
 return result;
}
export function createMergedProfileReader({readUser,readGroup}){
 const cache=new Map();
 return {clear(){cache.clear();},async resolve(user){
  if(!user.conversationId)return ownerProfile(user);
  let pending=cache.get(user.conversationId);
  if(!pending){pending=(async()=>{
   const group=await readGroup(user.conversationId);
   if(!group||group.state!=='active'||!group.memberIds?.includes(user.id))throw Error('合併資料尚未完整載入，請重新整理');
   const accounts=await Promise.all(group.memberIds.map(readUser));
   if(accounts.some(u=>!u||u.conversationId!==user.conversationId))throw Error('合併資料已變更，請重新整理');
   const primary=accounts.find(u=>u.id===group.primaryUid);
   if(!primary)throw Error('找不到合併顧客主檔');
   return {memberIds:group.memberIds,profile:{...ownerProfile(primary),...mergedProfileFields(primary,accounts),...sharedProfile(group.sharedProfile)}};
  })();cache.set(user.conversationId,pending);pending.catch(()=>cache.delete(user.conversationId));}
  const result=await pending;
  // Check membership even on a cached group, never use name/phone similarity.
  if(!result.memberIds.includes(user.id))throw Error('顧客不屬於此合併群組');
  return result.profile;
 }};
}


// The shared projection contains owner-controlled identity only, never shop notes,
// permissions, device tokens or account state. Empty values deliberately clear fields.
export const sharedProfileKeys=['name','phone','birthMonth','birthDay','gender','avatar','profileCover','statusText','profileEffect','profileWeatherCity','profileEffectDirection','profileRandom'];
export function sharedProfile(value={}){return Object.fromEntries(sharedProfileKeys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]]));}
// A resolved profile belongs to the group's primary account. Never copy that
// account's ID, lifecycle, tags or routing onto a different member's list row.
export function customerListProfile(row,profile,account=row){
 if(account.id!==row.id)throw Error('顧客資料已變更，請重新開啟');
 return {...row,...account,...sharedProfile(profile),privateAlias:profile.privateAlias||'',customerProvided:profile.customerProvided};
}
export async function ensureSharedProfile({db,id,doc,runTransaction}){
 return runTransaction(db,async tx=>{
  const ref=doc(db,'conversations',id),snap=await tx.get(ref),group=snap.data();
  if(!group||group.state!=='active')throw Error('合併資料已變更，請重新開啟');
  if(group.profileInitialized)return group;
  const snapshots=await Promise.all(group.memberIds.map(uid=>tx.get(doc(db,'users',uid))));
  const accounts=snapshots.map(s=>({id:s.id,...s.data()}));
  if(snapshots.some(s=>!s.exists())||accounts.some(u=>u.conversationId!==id))throw Error('合併資料尚未完整');
  const primary=accounts.find(u=>u.id===group.primaryUid);if(!primary)throw Error('找不到顧客主檔');
  const profile={...sharedProfile(primary),...mergedProfileFields(primary,accounts),...sharedProfile(group.sharedProfile)};
  tx.update(ref,{sharedProfile:profile,profileInitialized:true});
  return {...group,sharedProfile:profile,profileInitialized:true};
 });
}
// Subscriptions follow membership changes and ignore queued events after teardown.
export function watchIdentity({uid,watchUser,watchGroup,onChange,onError=()=>{}}){
 let stopped=false,user=null,groupId='',group=null,groupStop=null,epoch=0;
 const emit=()=>{if(!stopped&&user)onChange({...user,...(group?.state==='active'&&group.memberIds?.includes(uid)?sharedProfile(group.sharedProfile):{})});};
 const stopUser=watchUser(uid,value=>{if(stopped)return;user=value;if(!value)return;
  const id=value.conversationId||'';
  if(id!==groupId){groupStop?.();groupStop=null;groupId=id;group=null;const generation=++epoch;
   if(id)groupStop=watchGroup(id,next=>{if(stopped||generation!==epoch)return;group=next;emit();},e=>{if(!stopped&&generation===epoch)onError(e);});
  }emit();
 },e=>{if(!stopped)onError(e);});
 return ()=>{stopped=true;++epoch;stopUser?.();groupStop?.();};
}
