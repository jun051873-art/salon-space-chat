// Durable per-message outbox. Firebase ID tokens preserve Firestore rules.
export function createDelivery({auth,projectId,role,notify,onChange,storage=localStorage,request=fetch}) {
 const prefix=`salon-outbox-v3:${projectId}:${role}:`;
 const root=`projects/${projectId}/databases/(default)/documents`;
 const base=`https://firestore.googleapis.com/v1/${root}`;
 let busy=false,timer=null,stopped=false;
 const seen=new Set();
 const key=e=>prefix+e.senderId+":"+e.id;
 const emit=()=>onChange?.();
 function all(){
  const uid=auth.currentUser?.uid;if(!uid)return [];
  const start=prefix+uid+":";const entries=[];
  for(let i=0;i<storage.length;i++){
   const k=storage.key(i);if(!k?.startsWith(start))continue;
   try{const e=JSON.parse(storage.getItem(k));if(e.senderId===uid&&e.role===role)entries.push(e);}catch{}
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
 async function commit(e){
  if(auth.currentUser?.uid!==e.senderId)throw Error("登入身分已改變，保留訊息待原帳號恢復");
  const path=`/chats/${encodeURIComponent(e.room)}/messages/${e.id}`;
  // A lost HTTP response must not create a second message or change old timestamps.
  if(e.commitStarted||e.attempts>0)try{
   const existing=await api(path);
   if(existing.fields?.senderId?.stringValue!==e.senderId||existing.fields?.text?.stringValue!==e.text)throw Error("訊息識別碼衝突，已保留原文");
   return;
  }catch(err){if(err.status!==404)throw err;}
  e.commitStarted=true;save(e);
  const s=v=>({stringValue:v});
  await api(":commit",{method:"POST",body:JSON.stringify({writes:[
   {update:{name:root+`/chats/${e.room}/messages/${e.id}`,fields:{text:s(e.text),senderId:s(e.senderId),senderRole:s(e.role),clientMessageId:s(e.id),...(e.sticker?{sticker:{mapValue:{fields:{id:s(e.sticker.id),name:s(e.sticker.name),data:s(e.sticker.data)}}}}:{}),...(e.attachment?{attachment:{mapValue:{fields:{name:s(e.attachment.name),type:s(e.attachment.type),size:{integerValue:String(e.attachment.size)}}}}}:{})}},currentDocument:{exists:false},updateTransforms:[{fieldPath:"createdAt",setToServerValue:"REQUEST_TIME"}]},
   {update:{name:root+`/chats/${e.room}`,fields:{lastMessage:s(e.text)}},updateMask:{fieldPaths:["lastMessage"]},updateTransforms:[{fieldPath:"updatedAt",setToServerValue:"REQUEST_TIME"},...(e.role==="customer"?[{fieldPath:"lastCustomerMessageAt",setToServerValue:"REQUEST_TIME"}]:[{fieldPath:"lastAdminMessageAt",setToServerValue:"REQUEST_TIME"}])]},
   ...(e.attachment?[{update:{name:root+`/chats/${e.room}/files/${e.id}`,fields:{data:s(e.attachment.data),name:s(e.attachment.name),type:s(e.attachment.type),senderId:s(e.senderId)}},currentDocument:{exists:false}}]:[])
  ]})});
 }
 function cleanup(e){if(e.stage==="done"&&seen.has(e.id)){storage.removeItem(key(e));emit();}}
 function schedule(ms){if(stopped)return;clearTimeout(timer);timer=setTimeout(()=>void flush(),ms);}
 async function flush(){
  if(busy||stopped||!auth.currentUser)return;
  busy=true;clearTimeout(timer);
  try{
   for(let e of all()){
    if(stopped||auth.currentUser?.uid!==e.senderId)break;
    if(e.stage==="done"){cleanup(e);continue;}
    if(e.stage==="notify-error")continue;
    if(e.nextAt>Date.now()){if(e.stage==="queued")break;continue;}
    try{
     if(e.stage==="queued"){
      await commit(e);e.stage="stored";e.error="";e.attempts=0;e.nextAt=0;save(e);
     }
     // The notification job survives closing/reopening the page as well.
     await notify(e,api);
     e.stage="done";e.error="";save(e);cleanup(e);
    }catch(err){
     e.attempts=(e.attempts||0)+1;
     e.error=(err.name==="AbortError"?"連線逾時":err.message||String(err));
     e.quotaBlocked=err.code==="RESOURCE_EXHAUSTED";
     if(e.stage==="stored"&&e.attempts>=3)e.stage="notify-error";
     e.nextAt=Date.now()+((e.quotaBlocked||err.code==="PERMISSION_DENIED"||err.status===403)?15*60*1000:Math.min(60000,5000*2**Math.min(e.attempts-1,4)));
     save(e);
     // Preserve order for messages still waiting to reach the server.
     if(e.stage==="queued")break;
    }
   }
  }finally{busy=false;if(all().some(e=>e.stage==="queued"||e.stage==="stored"))schedule(5000);}
 }
 function retryFailed(ids=[]){
  const wanted=new Set(ids);
  let count=0;
  for(const e of all()){
   if(!(['notify-error'].includes(e.stage)||(e.stage==='queued'&&e.error))||(wanted.size&&!wanted.has(e.id)))continue;
   // Keep the same durable entry and ID. A notification retry never creates a
   // second chat message; a failed Firestore write resumes its original entry.
   if(e.stage==='notify-error')e.stage='stored';
   e.attempts=0;e.nextAt=0;e.error='';e.quotaBlocked=false;save(e);count++;
  }
  if(count){stopped=false;void flush();}
  return count;
 }
 function enqueue({room,text,senderId,attachment=null,sticker=null,id:providedId=null}){
  if(auth.currentUser?.uid!==senderId)throw Error("登入身分已改變，文字仍保留在輸入框");
  if(sticker&&(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sticker.data||'')||sticker.data.length>30000||typeof sticker.name!=='string'||sticker.name.length>30))throw Error('貼圖格式或大小不正確');
  if(text.trim().length>4000)throw Error("訊息請控制在 4000 字以內，原文仍留在輸入框");
  if(!room||room.includes("/")||!text.trim())throw Error("聊天室或訊息無效");
  const id=providedId||"c3_"+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+"_"+Array.from(crypto.getRandomValues(new Uint32Array(4))).map(x=>x.toString(36)).join(""));
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(id))throw Error("訊息識別碼無效");
  const previous=storage.getItem(prefix+senderId+":"+id);if(previous)return JSON.parse(previous);
  const e={id,room,text:text.trim(),senderId,role,attachment,sticker,at:Date.now(),stage:"queued",attempts:0,nextAt:0,error:""};
  // A storage error must leave the composer's original text untouched.
  save(e);void flush();return e;
 }
 function acknowledge(ids){for(const id of ids)seen.add(id);for(const e of all())cleanup(e);}
 return {enqueue,flush,entries:all,acknowledge,api,retryFailed,
  resume(){void flush();},
  stop(){stopped=true;clearTimeout(timer);}
 };
}
