// Only owner-confirmed conversation members may contribute profile fields.
const textFields=['name','phone','gender','avatar','profileCover','statusText'];
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
   return {memberIds:group.memberIds,profile:{...ownerProfile(primary),...mergedProfileFields(primary,accounts)}};
  })();cache.set(user.conversationId,pending);pending.catch(()=>cache.delete(user.conversationId));}
  const result=await pending;
  // Check membership even on a cached group, never use name/phone similarity.
  if(!result.memberIds.includes(user.id))throw Error('顧客不屬於此合併群組');
  return result.profile;
 }};
}

