// Durable per-message outbox. Firebase ID tokens preserve Firestore rules.
export function createDelivery({auth,projectId,role,notify,onChange,storage=localStorage,request=fetch,prepareImage=null}) {
 const prefix=`salon-outbox-v3:${projectId}:${role}:`;
 const root=`projects/${projectId}/databases/(default)/documents`;
 const base=`https://firestore.googleapis.com/v1/${root}`;
 let busy=false,timer=null,stopped=false,flushAgain=false;
 const notifying=new Set();let lastEnqueuedAt=0;
 const seen=new Set();
 const key=e=>prefix+e.senderId+":"+e.id;
 let emitPending=false;const emit=()=>{if(emitPending)return;emitPending=true;Promise.resolve().then(()=>{emitPending=false;onChange?.();});};
 const assetPrefix=prefix+'asset:';
 const hydrate=e=>{if(e.attachment?.assetKey&&!e.attachment.data)Object.defineProperty(e.attachment,'data',{enumerable:false,get:()=>storage.getItem(e.attachment.assetKey)||''});return e;};
 function collectAssets(){const live=new Set(all().map(e=>e.attachment?.assetKey).filter(Boolean));try{for(const b of JSON.parse(storage.getItem('salon-broadcast-draft:'+auth.currentUser?.uid)||'[]'))if(b.assetKey)live.add(b.assetKey);}catch{}const start=assetPrefix+auth.currentUser?.uid+':';for(let i=storage.length-1;i>=0;i--){const k=storage.key(i);if(k?.startsWith(start)&&!live.has(k))storage.removeItem(k);}}
 function readDraft(draftKey){return JSON.parse(storage.getItem(draftKey)||'[]').map(b=>b.assetKey?{...b,data:storage.getItem(b.assetKey)||''}:b);}
 function saveDraft(draftKey,blocks){
  if(draftKey!=='salon-broadcast-draft:'+auth.currentUser?.uid)throw Error('草稿帳號不符');
  const rows=blocks.map(b=>({...b}));
  const write=()=>storage.setItem(draftKey,JSON.stringify(rows.map(b=>{const v={...b};if(v.assetKey)delete v.data;return v;})));
  for(let i=0;i<rows.length;i++){const b=rows[i];if(b.type!=='photo'||!b.data)continue;
   if(b.assetKey&&b.assetKey.startsWith(assetPrefix+auth.currentUser.uid+':')&&storage.getItem(b.assetKey)===b.data)continue;
   const akey=assetPrefix+auth.currentUser.uid+':draft_'+crypto.randomUUID();storage.setItem(akey,b.data);b.assetKey=akey;
   try{write();blocks[i].assetKey=akey;}catch(error){storage.removeItem(akey);throw error;}
  }
  write();collectAssets();
 }
 function all(){
  const uid=auth.currentUser?.uid;if(!uid)return [];
  const start=prefix+uid+":";const entries=[];
  for(let i=0;i<storage.length;i++){
   const k=storage.key(i);if(!k?.startsWith(start))continue;
   try{const e=JSON.parse(storage.getItem(k));if(e.senderId===uid&&e.role===role)entries.push(hydrate(e));}catch{}
  }
  return entries.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
 }
 function save(e){storage.setItem(key(e),JSON.stringify(e));emit();}
 function timeout(p,ms=15000){let t;return Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error("連線逾時，訊息仍保存在此裝置")),ms);})]).finally(()=>clearTimeout(t));}
 async function api(path,options={}){
  const user=auth.currentUser;if(!user)throw Error("尚未登入");
  const token=await timeout(user.getIdToken());
  const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),12000);
  try{
   const res=await request(base+path,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},signal:ctrl.signal});
   const body=await res.json();
   if(!res.ok){const err=Error(body.error?.status==="RESOURCE_EXHAUSTED"?"Firebase 雲端配額已用完；訊息已保留，等待配額恢復":body.error?.message||"雲端請求失敗");err.status=res.status;err.code=body.error?.status;throw err;}
   return body;
  }finally{clearTimeout(t);}
 }
 async function fitAttachment(e){
  const a=e.attachment;if(!a)return;
  const data=a.data;
  if(typeof data!=='string'||!data)throw Error('照片資料遺失，請重新選取照片；尚未送出');
  if(data.length<=420000)return;
  if(!a.type?.startsWith('image/'))throw Error('檔案超過傳送大小限制，請重新選取');
  const fit=prepareImage|| (async data=>{const {compressCanvas}=await import('./salon-ui.js?v=HD2');const img=new Image();img.src=data;await img.decode();return compressCanvas(img,2400,400000,{minQuality:.74});});
  const resized=await fit(data);
  if(typeof resized!=='string'||!resized.startsWith('data:image/jpeg;base64,')||resized.length>420000)throw Error('照片調整失敗，原圖仍保留');
  if(a.assetKey){storage.setItem(a.assetKey,resized);a.size=Math.floor(resized.split(',')[1].length*.75);a.type='image/jpeg';}
  else e.attachment={...a,data:resized,type:'image/jpeg',size:Math.floor(resized.split(',')[1].length*.75)};
  save(e);
 }
 async function commit(e){
  if(auth.currentUser?.uid!==e.senderId)throw Error("登入身分已改變，保留訊息待原帳號恢復");
  const path=`/chats/${encodeURIComponent(e.room)}/messages/${e.id}`;
  // A lost HTTP response must not create a second message or change old timestamps.
  if(e.commitStarted||e.attempts>0)try{
   const existing=await api(path);
   if(existing.fields?.senderId?.stringValue!==e.senderId||existing.fields?.text?.stringValue!==e.text)throw Error("訊息識別碼衝突，已保留原文");
   return;
  }catch(err){if(err.status!==404)throw err;}
  await fitAttachment(e);
  e.commitStarted=true;save(e);
  const s=v=>({stringValue:v});
  await api(":commit",{method:"POST",body:JSON.stringify({writes:[
   {update:{name:root+`/chats/${e.room}/messages/${e.id}`,fields:{text:s(e.text),senderId:s(e.senderId),senderRole:s(e.role),clientMessageId:s(e.id),...(e.sticker?{sticker:{mapValue:{fields:{id:s(e.sticker.id),name:s(e.sticker.name),data:s(e.sticker.data)}}}}:{}),...(e.attachment?{attachment:{mapValue:{fields:{name:s(e.attachment.name),type:s(e.attachment.type),size:{integerValue:String(Math.floor((e.attachment.data?.split(',')[1]?.length||0)*.75))},...(e.attachment.width>0&&e.attachment.height>0?{width:{integerValue:String(Math.round(e.attachment.width))},height:{integerValue:String(Math.round(e.attachment.height))}}:{})}}}}:{})}},currentDocument:{exists:false},updateTransforms:[{fieldPath:"createdAt",setToServerValue:"REQUEST_TIME"}]},
   {update:{name:root+`/chats/${e.room}`,fields:{lastMessage:s(e.text)}},updateMask:{fieldPaths:["lastMessage"]},updateTransforms:[{fieldPath:"updatedAt",setToServerValue:"REQUEST_TIME"},...(e.role==="customer"?[{fieldPath:"lastCustomerMessageAt",setToServerValue:"REQUEST_TIME"}]:[{fieldPath:"lastAdminMessageAt",setToServerValue:"REQUEST_TIME"}])]},
   ...(e.attachment?[{update:{name:root+`/chats/${e.room}/files/${e.id}`,fields:{data:s(e.attachment.data),name:s(e.attachment.name),type:s(e.attachment.type),senderId:s(e.senderId)}},currentDocument:{exists:false}}]:[])
  ]})});
 }
 function cleanup(e){if(e.stage==="done"&&seen.has(e.id)&&!e.id.startsWith("b_")){storage.removeItem(key(e));emit();}}
 function schedule(ms){if(stopped)return;clearTimeout(timer);timer=setTimeout(()=>void flush(),ms);}
 function failEntry(e,err){
  e.attempts=(e.attempts||0)+1;e.error=err.name==='AbortError'?'連線逾時':err.message||String(err);
  e.quotaBlocked=err.code==='RESOURCE_EXHAUSTED';
  if(e.stage==='stored'&&e.attempts>=3)e.stage='notify-error';
  e.nextAt=Date.now()+((e.quotaBlocked||err.code==='PERMISSION_DENIED'||err.status===403)?15*60*1000:Math.min(60000,5000*2**Math.min(e.attempts-1,4)));
  save(e);
 }
 // Push has its own bounded lane. A slow device/worker never holds the next photo.
 function pumpNotifications(){
  if(stopped||!auth.currentUser)return;
  for(const e of all()){
   if(notifying.size>=4)break;
   if(e.stage!=='stored'||e.nextAt>Date.now()||notifying.has(e.id))continue;
   notifying.add(e.id);
   void (async()=>{
    try{await timeout(Promise.resolve().then(()=>notify(e,api)),15000);e.stage='done';e.error='';save(e);cleanup(e);}
    catch(err){failEntry(e,err);}
    finally{notifying.delete(e.id);if(!stopped){pumpNotifications();if(!busy)schedule(0);}}
   })();
  }
 }
 async function flush(){
  if(stopped||!auth.currentUser)return;
  if(busy){flushAgain=true;return;}
  flushAgain=false;busy=true;clearTimeout(timer);pumpNotifications();
  try{
   const blockedRooms=new Set();
   for(const e of all()){
    if(stopped||auth.currentUser?.uid!==e.senderId)break;
    if(e.stage==='done'){cleanup(e);continue;}
    if(e.stage!=='queued')continue;
    if(e.attachment?.data?.length>420000)e.nextAt=0;
    if(blockedRooms.has(e.room))continue;
    if(e.nextAt>Date.now()){blockedRooms.add(e.room);continue;}
    try{
     await commit(e);e.stage='stored';
     if(e.attachment?.assetKey){e.attachment={...e.attachment};delete e.attachment.assetKey;}
     e.error='';e.attempts=0;e.nextAt=0;save(e);pumpNotifications();
    }catch(err){failEntry(e,err);blockedRooms.add(e.room);}
   }
  }finally{
   busy=false;collectAssets();pumpNotifications();
   if(all().some(e=>e.stage==='queued'||e.stage==='stored'))schedule(flushAgain?0:5000);
  }
 }
 function retryFailed(ids=[]){
  const wanted=new Set(ids);
  let count=0;
  for(const e of all()){
   const queuedRetry=e.stage==='queued'&&(!!e.error||wanted.has(e.id));
   if(!(e.stage==='notify-error'||queuedRetry)||(wanted.size&&!wanted.has(e.id)))continue;
   // Retry the same durable entry and ID; never enqueue a duplicate message.
   if(e.stage==='notify-error')e.stage='stored';
   e.attempts=0;e.nextAt=0;e.error='';e.quotaBlocked=false;save(e);count++;
  }
  if(count){stopped=false;void flush();}
  return count;
 }
 function enqueue({room,text,senderId,attachment=null,sticker=null,id:providedId=null,assetId=null,defer=false}){
  if(auth.currentUser?.uid!==senderId)throw Error("登入身分已改變，文字仍保留在輸入框");
  if(sticker&&(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sticker.data||'')||sticker.data.length>30000||typeof sticker.name!=='string'||sticker.name.length>30))throw Error('貼圖格式或大小不正確');
  if(text.trim().length>4000)throw Error("訊息請控制在 4000 字以內，原文仍留在輸入框");
  if(!room||room.includes("/")||!text.trim())throw Error("聊天室或訊息無效");
  const id=providedId||"c3_"+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+"_"+Array.from(crypto.getRandomValues(new Uint32Array(4))).map(x=>x.toString(36)).join(""));
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(id))throw Error("訊息識別碼無效");
  const previous=storage.getItem(prefix+senderId+":"+id);if(previous)return JSON.parse(previous);
  const e={id,room,text:text.trim(),senderId,role,attachment,sticker,at:(lastEnqueuedAt=Math.max(Date.now(),lastEnqueuedAt+1)),stage:"queued",attempts:0,nextAt:0,error:""};
  // A storage error must leave the composer's original text untouched.
  let createdAsset=null;
  if(attachment?.assetKey&&attachment.assetKey.startsWith(assetPrefix+senderId+':')&&storage.getItem(attachment.assetKey)){e.attachment={...attachment};delete e.attachment.data;}else if(attachment?.data){const akey=assetPrefix+senderId+':'+(assetId||id);if(!/^[A-Za-z0-9_-]{1,160}$/.test(assetId||id))throw Error('照片識別碼無效');const existing=storage.getItem(akey);if(existing&&existing!==attachment.data)throw Error('照片識別碼衝突');if(!existing){storage.setItem(akey,attachment.data);createdAsset=akey;}e.attachment={...attachment,assetKey:akey};delete e.attachment.data;}
  try{save(e);}catch(error){if(createdAsset)storage.removeItem(createdAsset);throw error;}
  if(!defer)void flush();return hydrate(e);
 }
 function enqueueMany(jobs){const added=[];try{for(const job of jobs){const existed=job.id&&storage.getItem(prefix+job.senderId+':'+job.id);const e=enqueue({...job,defer:true});if(!existed)added.push(e);}}catch(error){for(const e of added)storage.removeItem(key(e));collectAssets();throw error;}void flush();return added;}
 function acknowledge(ids){for(const id of ids)seen.add(id);for(const e of all())cleanup(e);}
 function pruneCampaign(campaignId){if(typeof campaignId!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(campaignId))return 0;const start='b_'+campaignId+'_';let removed=0;for(const e of all()){if(e.id.startsWith(start)&&e.stage==='done'){storage.removeItem(key(e));removed++;}}if(removed)emit();return removed;}
 return {saveDraft,readDraft,enqueue,enqueueMany,flush,entries:all,acknowledge,api,retryFailed,
  pruneCampaign,
  resume(){void flush();},
  stop(){stopped=true;clearTimeout(timer);}
 };
}

