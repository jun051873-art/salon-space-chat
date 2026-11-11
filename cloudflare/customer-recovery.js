// Owner-approved recovery. Names, phone numbers and deleted UIDs never prove identity.
export const RECOVERY_OWNER='HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
const validUid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x)&&x!==RECOVERY_OWNER;
const fail=()=>{throw Object.assign(new Error('RECOVERY_UNAVAILABLE'),{code:'RECOVERY_UNAVAILABLE',status:409});};
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const digest=async text=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));
export function createCustomerRecovery({db,actor,checkAuth,mint,now=Date.now}){
 async function target(uid){
  if(!validUid(uid))fail();
  const [profile,retired,job]=await Promise.all([db.get('users/'+uid),db.get('retiredCustomers/'+uid),db.get('customerCleanup/'+uid)]);
  const p=profile?.data;
  if(p?.cleanupLock)throw Object.assign(new Error('MERGE_IN_PROGRESS'),{code:'MERGE_IN_PROGRESS',status:409});
  if(!p||p.role!=='customer'||p.status!=='active'||p.adminDeleted||p.adminMergedInto||p.cleanupLock||retired||job)fail();
  const group=p.conversationId?await db.get('conversations/'+p.conversationId):null;
  if(p.conversationId&&(!group||group.data.state!=='active'||group.data.blocked||group.data.cleanupLock||group.data.primaryUid!==uid||!group.data.memberIds?.includes(uid)))fail();
  await checkAuth(uid); // Refuse missing/disabled Auth users; never recreate a retired identity.
  return [profile,...(group?[group]:[])];
 }
 const guards=docs=>docs.map(d=>({path:d.path,raw:d.raw,version:d.version}));
 return {
  async follow(){
   if(!validUid(actor))fail();
   let uid=actor;const seen=new Set(),links=[];
   for(let i=0;i<32;i++){
    if(seen.has(uid))fail();seen.add(uid);
    const alias=await db.get('retiredCustomers/'+uid);
    if(!alias){
     if(!links.length)return {ok:true,linked:false};
     const docs=await target(uid),customToken=await mint(uid);
     await db.commit([...guards(docs),...guards(links)]);
     return {ok:true,linked:true,customToken};
    }
    if(!alias.data.automatic||!validUid(alias.data.primaryUid)){
     const job=await db.get('customerCleanup/'+uid);
     if(job&&job.data.stage!=='done')throw Object.assign(new Error('MERGE_IN_PROGRESS'),{code:'MERGE_IN_PROGRESS',status:409});
     fail();
    }
    links.push(alias);uid=alias.data.primaryUid;
   }
   fail();
  },
  async issue(uid){
   if(actor!==RECOVERY_OWNER)throw Object.assign(new Error('NOT_AUTHORIZED'),{code:'NOT_AUTHORIZED',status:403});
   const docs=await target(uid),path='customerRecovery/'+uid,old=await db.get(path);
   const secret=hex(crypto.getRandomValues(new Uint8Array(32))),code=uid+'.'+secret,expiresAt=now()+15*60*1000;
   await db.commit([...guards(docs),{path,data:{digest:await digest(code),expiresAt,used:false,issuedAt:now()},...(old?{version:old.version}:{create:true})}]);
   return {ok:true,code,expiresAt};
  },
  async redeem(code){
   if(actor===RECOVERY_OWNER||!actor)fail();
   if(typeof code!=='string'||!/^([A-Za-z0-9_-]{1,128})\.[a-f0-9]{64}$/.test(code))fail();
   const uid=code.split('.')[0],path='customerRecovery/'+uid,ticket=await db.get(path);
   if(!ticket||ticket.data.used||ticket.data.expiresAt<=now()||ticket.data.digest!==await digest(code))fail();
   const docs=await target(uid),customToken=await mint(uid);
   // Consume and recheck the exact customer/group versions atomically. Only one caller wins.
   await db.commit([...guards(docs),{path,version:ticket.version,data:{used:true,usedAt:now(),expiresAt:ticket.data.expiresAt}}]);
   return {ok:true,customToken};
  }
 };
}
