// Owner-only, resumable consolidation. No credentials or production calls at import.
export const CLEANUP_PROJECT='salon-space-chat';
export const CLEANUP_OWNER='HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
const PAGE=4;
const idOK=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id)&&id!==CLEANUP_OWNER;
export function cleanupError(message,status=409){const e=new Error(message);e.status=status;return e;}
function requireValue(ok,message){if(!ok)throw cleanupError(message);}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
export async function cleanupHash(value){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const put=(path,data,record)=>({path,data,version:record?.version,create:!record});
const patch=(record,data)=>({path:record.path,data,merge:true,version:record.version});
const guard=record=>({path:record.path,raw:record.raw,version:record.version});
const erase=record=>({path:record.path,delete:true,version:record.version});
const without=(list,id)=>(list||[]).filter(x=>x!==id);
const data=record=>record?.data||{};
const instant=v=>typeof v==='number'?v:Date.parse(v)||0;

// Store API: get/list/query/children/commit; snapshots carry raw Firestore fields
// so timestamps, nulls, bytes and other typed values are never lossy JSON copies.
export function createCustomerCleanup({db,auth,project,actor,enabled=false,now=Date.now}){
 function authorize(){requireValue(enabled,'永久清除服務尚未啟用');requireValue(project===CLEANUP_PROJECT,'專案不符');requireValue(actor===CLEANUP_OWNER,'僅店主可操作');}
 async function target(primaryUid,sourceUid){
  authorize();requireValue(idOK(primaryUid)&&idOK(sourceUid)&&primaryUid!==sourceUid,'請選擇主檔與不同的舊帳號');
  const [primary,source]=await Promise.all([db.get('users/'+primaryUid),db.get('users/'+sourceUid)]);
  requireValue(primary&&source&&primary.data.role==='customer'&&source.data.role==='customer','找不到完整顧客資料');
  const p=primary.data,s=source.data;
  requireValue(p.conversationId&&p.conversationId===s.conversationId,'只能清除已由店主合併的同組帳號');
  const group=await db.get('conversations/'+p.conversationId),g=data(group);
  requireValue(g.state==='active'&&!g.blocked&&g.primaryUid===primaryUid&&g.memberIds?.includes(sourceUid)&&g.memberIds.includes(primaryUid)&&g.historyRoomIds?.includes(sourceUid)&&g.historyRoomIds.includes(primaryUid),'請從目前保留的主檔操作');
  requireValue(!p.cleanupLock&&!s.cleanupLock&&!g.cleanupLock&&!p.adminDeleted&&p.status==='active','此組正在處理或主檔未啟用');
  requireValue(g.memberIds.length<=20&&g.historyRoomIds.length<=40&&g.memberIds.every(idOK)&&new Set(g.memberIds).size===g.memberIds.length&&g.historyRoomIds.every(idOK),'群組資料不完整');
  requireValue(!(await db.get('retiredCustomers/'+sourceUid)),'舊帳號已停用');
  // Unknown collections must be handled explicitly, never silently discarded.
  for(const [path,allowed] of [['users/'+sourceUid,[]],['chats/'+sourceUid,['messages','files']],['pushTokens/'+sourceUid,['devices']],['customerNotes/'+sourceUid,[]]]){
   requireValue((await db.children(path)).every(x=>allowed.includes(x)),'發現其他資料類型，暫停清除並保留全部資料');
  }
  const related=await db.query('conversations','memberIds','ARRAY_CONTAINS',sourceUid,3);
  requireValue(related.every(x=>x.path===group.path),'舊帳號屬於其他群組，請先核對');
  return {primary,source,group};
 }
 async function preview(primaryUid,sourceUid){
  authorize();requireValue(idOK(sourceUid),'舊帳號無效');
  const pending=await db.get('customerCleanup/'+sourceUid);
  if(pending){requireValue(pending.data.primaryUid===primaryUid,'此舊帳號已有其他清除工作');return {ok:true,resume:true,jobId:sourceUid,...publicJob(pending.data)};}
  const t=await target(primaryUid,sourceUid);
  return {ok:true,primaryUid,sourceUid,primaryName:t.primary.data.name||'保留主檔',sourceName:t.source.data.name||'舊帳號',token:await cleanupHash([t.primary.version,t.source.version,t.group.version]),warning:'舊帳號登入的裝置將停用；對話、附件與備註會保留在主檔。此操作無法復原。'};
 }
 async function start(primaryUid,sourceUid,token){
  authorize();requireValue(idOK(sourceUid),'舊帳號無效');
  const pending=await db.get('customerCleanup/'+sourceUid);
  if(pending){requireValue(pending.data.primaryUid===primaryUid,'工作主檔不同');return publicJob(pending.data);}
  const t=await target(primaryUid,sourceUid);
  requireValue(token===await cleanupHash([t.primary.version,t.source.version,t.group.version]),'資料已變更，請重新查看刪除確認');
  const members=await Promise.all(t.group.data.memberIds.map(id=>db.get('users/'+id)));
  requireValue(members.every(x=>x&&x.data.conversationId===t.primary.data.conversationId&&!x.data.cleanupLock),'群組資料已變更');
  const job={schema:1,primaryUid,sourceUid,groupId:t.primary.data.conversationId,memberIds:t.group.data.memberIds,stage:'auth-disable',cursor:'',copiedMessages:0,copiedFiles:0,deletedMessages:0,deletedFiles:0,startedAt:now(),updatedAt:now(),serial:0};
  await db.commit([
   ...members.map(x=>patch(x,{cleanupLock:sourceUid})),patch(t.group,{cleanupLock:sourceUid}),
   put('retiredCustomers/'+sourceUid,{retired:true},null),put('customerCleanup/'+sourceUid,job,null)
  ]);
  return publicJob(job);
 }
 function publicJob(j){return {ok:true,jobId:j.sourceUid,primaryUid:j.primaryUid,sourceUid:j.sourceUid,stage:j.stage,done:j.stage==='done',copiedMessages:j.copiedMessages,copiedFiles:j.copiedFiles,deletedMessages:j.deletedMessages,deletedFiles:j.deletedFiles};}
 async function step(jobId){
  authorize();requireValue(idOK(jobId),'工作編號無效');
  const record=await db.get('customerCleanup/'+jobId);requireValue(record,'找不到清除工作');
  const j=record.data;if(j.stage==='done')return publicJob(j);
  const primary=await db.get('users/'+j.primaryUid),source=await db.get('users/'+j.sourceUid),group=await db.get('conversations/'+j.groupId);
  requireValue(primary?.data.cleanupLock===jobId&&source?.data.cleanupLock===jobId&&group?.data.cleanupLock===jobId,'清除鎖定已變更，停止以免誤刪');
  const commit=async(writes=[],change={})=>{
   const next={...j,...change,serial:j.serial+1,updatedAt:now()};
   await db.commit([...writes,put(record.path,next,record)]);return publicJob(next);
  };
  if(j.stage==='auth-disable'){
   // Update the existing booking in place: its ID, slots, status and all native
   // Firestore values stay intact. Locks protect both old and new references.
   if(j.pendingBookings?.length){
    const saved=await Promise.all(j.pendingBookings.map(x=>db.get(x.path)));
    for(let i=0;i<saved.length;i++)requireValue(saved[i]&&await cleanupHash(saved[i].raw)===j.pendingBookings[i].hash,'預約移轉核對不一致，暫停清除並保留帳號');
    return commit(saved.map(guard),{pendingBookings:[],transferredBookings:(j.transferredBookings||0)+saved.length});
   }
   const bookings=await db.query('bookings','userId','EQUAL',j.sourceUid,PAGE);
   if(bookings.length){
    const pendingBookings=[];
    for(const booking of bookings){
     requireValue(!(await db.children(booking.path)).length,'預約含其他資料，暫停清除並保留帳號');
     pendingBookings.push({path:booking.path,hash:await cleanupHash({...booking.raw,userId:{stringValue:j.primaryUid}})});
    }
    return commit(bookings.map(x=>patch(x,{userId:j.primaryUid})),{pendingBookings});
   }
   await auth.disable(j.sourceUid);return commit([],{stage:'copy-files'});
  }
  const kind=j.stage.endsWith('files')?'files':'messages';
  const collection='chats/'+j.sourceUid+'/'+kind;
  async function destination(doc){
   const id='m_'+await cleanupHash([j.sourceUid,doc.path.split('/').at(-1)]),raw=structuredClone(doc.raw);
   if(raw.senderRole?.stringValue==='customer'||raw.senderId?.stringValue===j.sourceUid)raw.senderId={stringValue:j.primaryUid};
   if(raw.clientMessageId)raw.clientMessageId={stringValue:id};
   return {path:'chats/'+j.primaryUid+'/'+kind+'/'+id,raw};
  }
  if(j.stage.startsWith('copy-')){
   const docs=await db.list(collection,j.cursor,PAGE),writes=[];
   for(const doc of docs){
    requireValue(!(await db.children(doc.path)).length,'訊息或附件包含其他資料，暫停處理');
    const dest=await destination(doc);
    requireValue(!(await db.get(dest.path)),'主檔已有同編號資料，停止以免覆蓋');
    if(kind==='messages'&&doc.data.attachment&&!doc.data.retracted)requireValue(await db.get('chats/'+j.sourceUid+'/files/'+doc.path.split('/').at(-1)),'舊訊息缺少附件，暫停並保留原始資料');
    writes.push(guard(doc),{...dest,create:true});
   }
   const counter=kind==='files'?'copiedFiles':'copiedMessages';
   return commit(writes,{[counter]:j[counter]+docs.length,cursor:docs.at(-1)?.path.split('/').at(-1)||'',...(!docs.length?{stage:kind==='files'?'copy-messages':'verify-files',cursor:''}:{})});
  }
  if(j.stage.startsWith('verify-')||j.stage.startsWith('erase-')){
   const removing=j.stage.startsWith('erase-'),docs=await db.list(collection,j.cursor,PAGE),writes=[];
   for(const doc of docs){const dest=await destination(doc),saved=await db.get(dest.path);requireValue(saved&&canonical(saved.raw)===canonical(dest.raw),'搬移核對不一致，未刪除這批舊資料');if(removing)writes.push(guard(saved),erase(doc));}
   let change={cursor:docs.at(-1)?.path.split('/').at(-1)||''};
   if(removing){const counter=kind==='files'?'deletedFiles':'deletedMessages';change[counter]=j[counter]+docs.length;}
   if(!docs.length)change={...change,cursor:'',stage:removing?(kind==='messages'?'erase-files':'references'):(kind==='files'?'verify-messages':'switch')};
   return commit(writes,change);
  }
  if(j.stage==='switch'){
   const [pn,sn,pc,sc]=await Promise.all(['customerNotes/'+j.primaryUid,'customerNotes/'+j.sourceUid,'chats/'+j.primaryUid,'chats/'+j.sourceUid].map(p=>db.get(p)));
   const notes=[data(pn).notes,data(sn).notes].filter(x=>typeof x==='string'&&x.trim());
   const notePatch={notes:[...new Set(notes)].join('\n\n── 合併保留的備註 ──\n'),linkedCustomerIds:without(data(pn).linkedCustomerIds,j.sourceUid),hiddenLinkedCustomerIds:without(data(pn).hiddenLinkedCustomerIds,j.sourceUid)};
   const latest=instant(data(sc).updatedAt)>instant(data(pc).updatedAt)?sc:pc;
   const raw={...(pc?.raw||{})};
   for(const k of ['lastMessage','updatedAt'])if(latest?.raw[k])raw[k]=latest.raw[k];
   for(const k of ['lastCustomerMessageAt','lastAdminMessageAt']){const newest=instant(data(sc)[k])>instant(data(pc)[k])?sc:pc;if(newest?.raw[k])raw[k]=newest.raw[k];}
   const accountRaw={tags:{arrayValue:{values:[...new Set([...(primary.data.tags||[]),...(source.data.tags||[])])].map(x=>({stringValue:x}))}}};
   if(instant(source.data.lastVisitAt)>instant(primary.data.lastVisitAt)&&source.raw.lastVisitAt)accountRaw.lastVisitAt=source.raw.lastVisitAt;
   raw.userId={stringValue:j.primaryUid};raw.conversationPrimaryUid={stringValue:j.primaryUid};
   raw.readAdminMs={integerValue:'0'};raw.readCustomerMs={integerValue:'0'};
   const g={memberIds:without(group.data.memberIds,j.sourceUid),historyRoomIds:without(group.data.historyRoomIds,j.sourceUid),revision:Number(group.data.revision||0)+1};
   return commit([{path:primary.path,raw:accountRaw,merge:true,version:primary.version},patch(group,g),pn?patch(pn,notePatch):put('customerNotes/'+j.primaryUid,notePatch,null),{path:'chats/'+j.primaryUid,raw,version:pc?.version,create:!pc}],{stage:'erase-messages',cursor:''});
  }
  if(j.stage==='references'){
   // Transfer feedback, remove obsolete device credentials/jobs, and remove all
   // reverse links. Every page is a CAS commit together with the job progress.
   const feedback=await db.query('feedback','userId','EQUAL',j.sourceUid,PAGE);
   if(feedback.length)return commit(feedback.map(x=>patch(x,{userId:j.primaryUid})));
   for(const [c,field] of [['broadcasts','userId'],['broadcasts','targetUserId'],['notificationJobs','userId']]){
    const rows=await db.query(c,field,'EQUAL',j.sourceUid,PAGE);if(rows.length){for(const x of rows)requireValue(!(await db.children(x.path)).length,'通知工作包含未知資料');return commit(rows.map(erase));}
   }
   for(const key of ['linkedCustomerIds','hiddenLinkedCustomerIds']){
    const rows=await db.query('customerNotes',key,'ARRAY_CONTAINS',j.sourceUid,PAGE);if(rows.length)return commit(rows.map(x=>patch(x,{[key]:without(x.data[key],j.sourceUid)})));
   }
   const devices=await db.list('pushTokens/'+j.sourceUid+'/devices','',PAGE);
   if(devices.length){for(const x of devices)requireValue(!(await db.children(x.path)).length,'裝置資料含未知內容');return commit(devices.map(erase));}
   const join=await db.get('notificationJobs/join_'+j.sourceUid);if(join)return commit([erase(join)]);
   return commit([],{stage:'auth-delete'});
  }
  if(j.stage==='auth-delete'){requireValue(!(await db.query('bookings','userId','EQUAL',j.sourceUid,1)).length,'仍有舊帳號預約關聯，暫停清除');await auth.remove(j.sourceUid);return commit([],{stage:'finish'});}
  if(j.stage==='finish'){
   requireValue(j.copiedMessages===j.deletedMessages&&j.copiedFiles===j.deletedFiles,'搬移與清除數量不符');
   for(const c of ['chats/'+j.sourceUid+'/messages','chats/'+j.sourceUid+'/files','pushTokens/'+j.sourceUid+'/devices'])requireValue(!(await db.list(c,'',1)).length,'仍有舊資料，請繼續核對');
   const survivors=await Promise.all(without(j.memberIds,j.sourceUid).map(id=>db.get('users/'+id)));
   requireValue(survivors.every(x=>x?.data.cleanupLock===jobId),'保留帳號狀態已變更');
   const roots=await Promise.all(['users','chats','pushTokens','customerNotes'].map(c=>db.get(c+'/'+j.sourceUid)));
   return commit([...roots.filter(Boolean).map(erase),...survivors.map(x=>patch(x,{cleanupLock:''})),patch(group,{cleanupLock:''})],{stage:'done',memberIds:[],finishedAt:now()});
  }
  throw cleanupError('未知處理階段，未刪除資料');
 }
 return {preview,start,step};
}
