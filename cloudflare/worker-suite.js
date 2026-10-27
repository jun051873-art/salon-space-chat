// salon-space-notify v4. Existing secrets: FIREBASE_PROJECT_ID,
// FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY. Never put their values here.
const ADMIN_UID = "HcFJGmzHw6MYoWbFmtq9IyFSjvL2";
const SITE = "https://jun051873-art.github.io";
// Public Firebase web configuration; this is not a private service-account key.
const WEB_API_KEY = "AIzaSyBS-lHTp1YPhhFOKriBRSrwdSomT3ZGw0c";
let oauthCache = null;
let oauthPending = null;

export default {
 async fetch(request, env, ctx) {
  const cors = {"Access-Control-Allow-Origin":SITE,"Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};
  if(request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
  if(request.method === "GET") return json({ok:true,service:"salon-space-notify",version:"13-appointment-and-visit-care",authenticated:true,features:{newCustomerNotifications:true,timeReplies:true,keywordReplies:true,keywordContains:true,scheduledCare:true,visitCare:true,personalVisitCare:true,appointmentReminders:true}},200,cors);
  if(request.method !== "POST") return json({ok:false,error:"METHOD_NOT_ALLOWED"},405,cors);
  try {
   if(request.headers.get("Origin") && request.headers.get("Origin") !== SITE) throw fault("ORIGIN_NOT_ALLOWED",403);
   const raw = await request.text();
   if(raw.length > 24000) throw fault("REQUEST_TOO_LARGE",413);
   let body;try{body=JSON.parse(raw);}catch{throw fault("INVALID_JSON",400);}
   if(!body || typeof body !== "object") throw fault("INVALID_REQUEST",400);
   const idToken = request.headers.get("Authorization")?.replace(/^Bearer /i,"") || body.idToken;
   if(typeof idToken !== "string" || !idToken) throw fault("LOGIN_REQUIRED_UPDATE_APP",401);
   const who = await readJSON("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+WEB_API_KEY,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken})},"AUTH");
   const user = who.users?.[0];
   if(!user?.localId || user.disabled) throw fault("LOGIN_INVALID",401);
   if(body.action==='customer-joined'){
    if(user.localId===ADMIN_UID||body.customerUid!==user.localId)throw fault('NOT_AUTHORIZED',403);
    return json(await notifyNewCustomer(env,user.localId),200,cors);
   }
   const toAdmin = body.target === "admin";
   if(toAdmin ? user.localId === ADMIN_UID || body.customerUid !== user.localId : user.localId !== ADMIN_UID) throw fault("NOT_AUTHORIZED",403);
   const recipient = toAdmin ? ADMIN_UID : body.customerUid;
   if(typeof recipient !== "string" || !recipient || recipient.includes("/") || recipient.length > 128) throw fault("INVALID_RECIPIENT",400);
   const accessToken = await googleToken(env);
   const docRoot = "https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(env.FIREBASE_PROJECT_ID)+"/databases/(default)/documents/";
   // Only notify for a message which actually exists in this sender's conversation.
   if(typeof body.messageId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(body.messageId)) throw fault("MESSAGE_ID_REQUIRED_UPDATE_APP",400);
   const room = toAdmin ? user.localId : recipient;
   const msg = await readJSON(docRoot+"chats/"+encodeURIComponent(room)+"/messages/"+body.messageId,{headers:{Authorization:"Bearer "+accessToken}},"MESSAGE");
   if(msg.fields?.senderId?.stringValue !== user.localId) throw fault("MESSAGE_SENDER_MISMATCH",403);
   const message = msg.fields?.text?.stringValue;
   if(typeof message !== "string") throw fault("MESSAGE_NOT_READY",409);
   const customer=fieldsOf(await readJSON(docRoot+'users/'+encodeURIComponent(room),{headers:{Authorization:'Bearer '+accessToken}},'CUSTOMER'));
   if((customer.status||'active')!=='active')throw fault('CUSTOMER_INACTIVE',403);
   if(toAdmin){const job=automaticReply(env,docRoot,accessToken,room,body.messageId,message,msg.fields?.createdAt?.timestampValue).catch(e=>console.error("auto-reply",e.code||e.message));if(ctx?.waitUntil)ctx.waitUntil(job);else await job;}
   const tokens = await recipientTokens(docRoot,recipient,accessToken);
   if(!tokens.length) return json({ok:false,error:"NO_DEVICE_TOKENS",target:toAdmin?"admin":"customer",devices:0,success:0,failed:0},404,cors);
   const url = SITE+"/salon-space-chat/"+(toAdmin?"admin.html?chat="+encodeURIComponent(room):"customer.html");
   const configuration=await salonConfig(docRoot,accessToken),shopName=configuration.name||'專屬空間';
   // A shop owner may keep a private admin nickname; never reveal it to the customer.
   const customerName=(toAdmin?customer.adminProfile?.name:customer.name)||customer.name||'客人';
   // One compact identity line; keep only the actual message in the preview.
   const title=customerName+'｜'+shopName;
   const preview=msg.fields?.sticker?'傳來一張貼圖':msg.fields?.attachment?(unpack(msg.fields.attachment)?.type?.startsWith('image/')?'傳來一張照片':'傳來一份附件'):message;

   const results=[];
   // Bounded parallelism: one slow device cannot hold up all the others.
   for(let i=0;i<tokens.length;i+=5){
    results.push(...await Promise.all(tokens.slice(i,i+5).map(async token=>{
     try{
      await readJSON("https://fcm.googleapis.com/v1/projects/"+encodeURIComponent(env.FIREBASE_PROJECT_ID)+"/messages:send",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({message:{token,data:{title,body:preview.slice(0,500),tag:"salon-"+room+"-"+body.messageId,messageId:body.messageId,url},webpush:{headers:{Urgency:"high",TTL:"86400"}}}})},"FCM");
      return {ok:true};
     }catch(e){return {ok:false,error:e.code||"FCM_FAILED",status:e.status||502};}
    })));
   }
   const success=results.filter(r=>r.ok).length;
   return json({ok:success>0,target:toAdmin?"admin":"customer",devices:tokens.length,success,failed:tokens.length-success,errors:results.filter(r=>!r.ok),acceptedBy:"FCM",messageId:body.messageId},success>0?200:502,cors);
  } catch(e) {
   console.error("salon-notify",e.code||"INTERNAL_ERROR",e.status||500);
   return json({ok:false,error:e.code||"INTERNAL_ERROR"},e.status||500,cors);
  }
 },
 async scheduled(controller,env,ctx){ctx.waitUntil(runScheduledReminders(env,controller));}
};
function fault(code,status=502){const e=new Error(code);e.code=code;e.status=status;return e;}
async function readJSON(url,options={},stage="UPSTREAM"){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
 try{
  const r=await fetch(url,{...options,signal:ctrl.signal});
  let data;try{data=await r.json();}catch{throw fault(stage+"_INVALID_RESPONSE");}
  if(!r.ok){
   const detail=data.error?.details?.find(x=>x.errorCode)?.errorCode||data.error?.status||"HTTP_"+r.status;
   throw fault(stage+"_"+detail,r.status===429?429:stage==="AUTH"?401:r.status===404?404:502);
  }
  return data;
 }catch(e){if(e.name==="AbortError")throw fault(stage+"_TIMEOUT",504);throw e;}
 finally{clearTimeout(timer);}
}
async function recipientTokens(root,uid,accessToken){
 const headers={Authorization:"Bearer "+accessToken},tokens=new Set();
 let page="";
 do{
  const data=await readJSON(root+"pushTokens/"+encodeURIComponent(uid)+"/devices?pageSize=100"+(page?"&pageToken="+encodeURIComponent(page):""),{headers},"DEVICES");
  for(const d of data.documents||[]){const t=d.fields?.token?.stringValue;if(t)tokens.add(t);}
  page=data.nextPageToken||"";
 }while(page);
 // Include installations from before the per-device collection was introduced.
 try{const d=await readJSON(root+"pushTokens/"+encodeURIComponent(uid),{headers},"LEGACY_DEVICE");const t=d.fields?.token?.stringValue;if(t)tokens.add(t);}catch(e){if(e.status!==404)throw e;}
 return [...tokens];
}
async function googleToken(env){
 if(!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY)throw fault("MISSING_FIREBASE_ENV",500);
 const cacheKey=env.FIREBASE_PROJECT_ID+":"+env.FIREBASE_CLIENT_EMAIL;
 if(oauthCache?.key===cacheKey && oauthCache.until>Date.now()+60000)return oauthCache.token;
 if(oauthPending?.key===cacheKey)return oauthPending.promise;
 const pending={key:cacheKey,promise:null};
 pending.promise=(async()=>{
  const now=Math.floor(Date.now()/1000),encode=obj=>base64Url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned=encode({alg:"RS256",typ:"JWT"})+"."+encode({iss:env.FIREBASE_CLIENT_EMAIL,scope:"https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600});
  const pem=env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
  let cryptoKey;try{cryptoKey=await crypto.subtle.importKey("pkcs8",Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);}catch{throw fault("INVALID_PRIVATE_KEY_FORMAT",500);}
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",cryptoKey,new TextEncoder().encode(unsigned));
  const data=await readJSON("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+base64Url(new Uint8Array(signature))})},"OAUTH");
  if(!data.access_token)throw fault("OAUTH_NO_ACCESS_TOKEN");
  oauthCache={key:cacheKey,token:data.access_token,until:Date.now()+Number(data.expires_in||3600)*1000};return data.access_token;
 })();oauthPending=pending;
 try{return await pending.promise;}finally{if(oauthPending===pending)oauthPending=null;}
}
function base64Url(bytes){return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers});}

// Deploy with ONE every-minute Cron: * * * * *. Visit care is throttled to hourly daytime runs.
let salonConfigCache=null;
function unpack(v){if(v==null)return null;if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return v.timestampValue;if(v.arrayValue)return(v.arrayValue.values||[]).map(unpack);if(v.mapValue)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,unpack(x)]));return null;}
function fieldsOf(d){return Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,unpack(v)]));}
async function salonConfig(root,token,fresh=false){if(!fresh&&salonConfigCache?.until>Date.now())return salonConfigCache.data;let data={};try{data=fieldsOf(await readJSON(root+'announcements/settings',{headers:{Authorization:'Bearer '+token}},'SETTINGS'));}catch(e){if(e.status!==404)throw e;}salonConfigCache={until:Date.now()+300000,data};return data;}
async function systemMessage(env,root,token,uid,id,text,customer={},shopName='專屬空間'){
 const name='projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents/';
 const s=v=>({stringValue:v});
 try{await readJSON(root.slice(0,-1)+':commit',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({writes:[{update:{name:name+'chats/'+uid+'/messages/'+id,fields:{text:s(text.slice(0,4000)),senderId:s(ADMIN_UID),senderRole:s('admin'),clientMessageId:s(id),automatic:{booleanValue:true}}},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]},{update:{name:name+'chats/'+uid,fields:{lastMessage:s(text.slice(0,4000))}},updateMask:{fieldPaths:['lastMessage']},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'},{fieldPath:'lastAdminMessageAt',setToServerValue:'REQUEST_TIME'}]}]})},'AUTO_WRITE');}
 catch(e){if(e.code?.includes('ALREADY_EXISTS')||e.code?.includes('FAILED_PRECONDITION'))return false;throw e;}
 // Shared browser tokens may be registered under both customer and owner accounts.
 // Automatic messages remain in the conversation, but never alert an owner device.
 const [customerTokens,ownerTokens]=await Promise.all([recipientTokens(root,uid,token),recipientTokens(root,ADMIN_UID,token)]);
 const ownerDevices=new Set(ownerTokens);
 const tokens=customerTokens.filter(device=>!ownerDevices.has(device));
 const customerName=customer.name||'客人';
 for(let i=0;i<tokens.length;i+=5)await Promise.all(tokens.slice(i,i+5).map(device=>readJSON('https://fcm.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device,data:{title:customerName+'｜'+shopName,body:text.slice(0,500),messageId:id,automatic:'true',recipientRole:'customer',tag:'salon-'+uid+'-'+id,url:SITE+'/salon-space-chat/customer.html'},webpush:{headers:{Urgency:'high',TTL:'86400'}}}})},'AUTO_PUSH').catch(e=>console.error('auto-push',e.code))));
 return true;
}
// Exactly one applicable time category. A disabled category never falls through to another.
function timeReply(config,instant,holiday=false){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 const date=parts.year+'-'+parts.month+'-'+parts.day;
 const weekday=new Date(date+'T12:00:00+08:00').getUTCDay(),hours=config.weeklyHours?.[weekday];
 let kind;
 if(holiday||hours?.closed===true)kind='holiday';
 else if(hours&&/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.open)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.close)&&hours.open<hours.close){const clock=parts.hour+':'+parts.minute;kind=clock>=hours.open&&clock<hours.close?'business':'outside';}
 else return null; // Never guess structured opening hours from free text.
 const rule=config.timeReplies?.[kind];
 return rule?.enabled===true&&typeof rule.text==='string'&&rule.text.trim()?{kind,answer:rule.text.trim().slice(0,2000)}:null;
}
async function automaticReply(env,root,token,uid,sourceId,text,sourceTime){
 const config=await salonConfig(root,token,true);
 let reply=config.keywordRepliesEnabled===true?findReply(config.quickReplies,text):null;
 if(!reply&&Object.values(config.timeReplies||{}).some(r=>r?.enabled===true)){
  const instant=sourceTime&&Number.isFinite(Date.parse(sourceTime))?sourceTime:new Date().toISOString();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
  let holiday=false;try{const h=fieldsOf(await readJSON(root+'holidays/'+date,{headers:{Authorization:'Bearer '+token}},'HOLIDAY'));holiday=h.closed!==false;}catch(e){if(e.status!==404)throw e;}
  reply=timeReply(config,instant,holiday);
 }
 if(!reply)return;
 const customer=fieldsOf(await readJSON(root+'users/'+uid,{headers:{Authorization:'Bearer '+token}},'CUSTOMER'));
 if((customer.status||'active')!=='active')return;
 await systemMessage(env,root,token,uid,'auto_'+sourceId,reply.answer,customer,config.name||'專屬空間');
}
async function scanCollection(root,path,token){let page='',rows=[];do{const result=await readJSON(root+path+'?pageSize=300'+(page?'&pageToken='+encodeURIComponent(page):''),{headers:{Authorization:'Bearer '+token}},'CARE_SCAN');rows.push(...(result.documents||[]).map(d=>({id:d.name.split('/').pop(),...fieldsOf(d)})));page=result.nextPageToken||'';if(rows.length>5000)throw fault('CARE_CUSTOMER_LIMIT',400);}while(page);return rows;}
// Dates are compared in the shop's calendar, not elapsed 24-hour periods.
function taipeiDay(value){const ms=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(ms))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));}
function careDue(rule,user,chat,now=Date.now()){
 if(user.id===ADMIN_UID||user.role==='admin'||user.adminDeleted||user.adminMergedInto||(user.status||'active')!=='active'||user.marketingOptIn===false||!user.name||typeof rule.text!=='string'||!rule.text.trim())return null;
 const day=taipeiDay(now),[year,month,date]=day.split('-').map(Number);
 if(rule.kind==='birthday')return Number(user.birthMonth)===month&&Number(user.birthDay)===date?year:null;
 if(rule.kind==='personalVisit'&&(rule.targetUserId!==user.id||user.visitCareManaged!==true))return null;
 if(rule.kind==='visit'&&user.visitCareManaged===true)return null;
 if(!['inactive','visit','personalVisit'].includes(rule.kind))return null;
 const value=['visit','personalVisit'].includes(rule.kind)?user.lastVisitAt:chat?.lastCustomerMessageAt;
 const last=typeof value==='number'?value:Date.parse(value||'');
 const days=Number(rule.days);
 if(!Number.isFinite(last)||last<=0||!Number.isInteger(days)||days<1||days>365)return null;
 const elapsed=(Date.parse(day)-Date.parse(taipeiDay(last)))/86400000;
 return elapsed>=days?last:null;
}
async function runCare(env){
 const token=await googleToken(env),root='https://firestore.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents/';
 const all=await scanCollection(root,'broadcasts',token),rules=all.filter(r=>r.type==='automation'&&r.enabled===true);
 let sent=0,failed=0,deferred=0;
 if(rules.length){
  const [users,chats,config]=await Promise.all([scanCollection(root,'users',token),scanCollection(root,'chats',token),salonConfig(root,token,true)]),chatMap=new Map(chats.map(c=>[c.id,c])),now=Date.now();
  const userMap=new Map(users.map(u=>[u.id,u]));
  for(const rule of rules)for(const user of rule.kind==='personalVisit'?[userMap.get(rule.targetUserId)].filter(Boolean):users){
   const occurrence=careDue(rule,user,chatMap.get(user.id),now);if(occurrence===null)continue;
   if(sent>=300){deferred++;continue;}
   const id='care_'+rule.id+'_'+user.id+'_'+occurrence;
   try{if(await systemMessage(env,root,token,user.id,id,rule.text.replaceAll('{姓名}',user.name),user,config.name||'專屬空間'))sent++;}
   catch(e){failed++;console.error('care-message',e.code||'FAILED');}
  }
 }
 await readJSON(root+'broadcasts/_runtime?updateMask.fieldPaths=lastRun&updateMask.fieldPaths=sent&updateMask.fieldPaths=failed&updateMask.fieldPaths=deferred&updateMask.fieldPaths=type',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({fields:{lastRun:{timestampValue:new Date().toISOString()},sent:{integerValue:String(sent)},failed:{integerValue:String(failed)},deferred:{integerValue:String(deferred)},type:{stringValue:'runtime'}}})},'CARE_HEARTBEAT');
}

// Literal matching only: customer text never becomes a regular expression.
function findReply(rules,text){const input=String(text||'').normalize('NFKC').toLocaleLowerCase().trim();return (Array.isArray(rules)?rules:[]).slice(0,12).find(r=>{if(r.enabled===false||!r.title||!r.answer)return false;const keys=Array.isArray(r.keywords)?r.keywords.filter(k=>typeof k==='string'&&k.trim()).slice(0,8):[];return input===String(r.title).normalize('NFKC').toLocaleLowerCase().trim()||keys.some(k=>input.includes(k.normalize('NFKC').toLocaleLowerCase().trim()));});}

// A pending applicant can request only their own review alert. A durable lease
// prevents repeated taps/concurrent requests from broadcasting the same alert.
async function notifyNewCustomer(env,uid){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw fault('INVALID_RECIPIENT',400);
 const token=await googleToken(env),root='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(env.FIREBASE_PROJECT_ID)+'/databases/(default)/documents/',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const customer=fieldsOf(await readJSON(root+'users/'+uid,{headers},'CUSTOMER'));
 if(customer.status!=='pending')return {ok:true,skipped:'not-pending'};
 const path='notificationJobs/join_'+uid;let previous=null;
 try{previous=await readJSON(root+path,{headers},'JOIN_JOB');}catch(e){if(e.status!==404)throw e;}
 const state=fieldsOf(previous||{});
 if(state.status==='sent')return {ok:true,alreadySent:true};
 if(state.status==='sending'&&Number(state.leaseUntil)>Date.now())return {ok:true,inProgress:true};
 const precondition=previous?'currentDocument.updateTime='+encodeURIComponent(previous.updateTime):'currentDocument.exists=false';
 try{await readJSON(root+path+'?'+precondition,{method:'PATCH',headers,body:JSON.stringify({fields:{status:{stringValue:'sending'},leaseUntil:{integerValue:String(Date.now()+120000)}}})},'JOIN_LEASE');}catch(e){if(/ALREADY_EXISTS|FAILED_PRECONDITION/.test(e.code||''))return {ok:true,inProgress:true};throw e;}
 try{
  const tokens=await recipientTokens(root,ADMIN_UID,token);if(!tokens.length)throw fault('NO_DEVICE_TOKENS',404);
  const results=[];for(let i=0;i<tokens.length;i+=5)results.push(...await Promise.all(tokens.slice(i,i+5).map(async device=>{try{await readJSON('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(env.FIREBASE_PROJECT_ID)+'/messages:send',{method:'POST',headers,body:JSON.stringify({message:{token:device,data:{title:'新客加入・待核准',body:String(customer.name||'新客人').slice(0,60)+' 已送出加入申請，點此核對。',tag:'salon-join-'+uid,url:SITE+'/salon-space-chat/admin.html?view=approvals'},webpush:{headers:{Urgency:'high',TTL:'86400'}}}})},'FCM');return true;}catch{return false;}})));
  const success=results.filter(Boolean).length;if(!success)throw fault('FCM_FAILED');
  await readJSON(root+path,{method:'PATCH',headers,body:JSON.stringify({fields:{status:{stringValue:'sent'},leaseUntil:{integerValue:'0'}}})},'JOIN_RESULT');
  return {ok:true,success,devices:tokens.length,acceptedBy:'FCM'};
 }catch(e){try{await readJSON(root+path,{method:'PATCH',headers,body:JSON.stringify({fields:{status:{stringValue:'retry'},leaseUntil:{integerValue:'0'}}})},'JOIN_RETRY');}catch{}throw e;}
}

// v13 appointments. Firestore queue, not an open browser timer. Drafts never send.
function packValue(v){if(v===null||v===undefined)return {nullValue:null};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};if(typeof v==='string')return {stringValue:v};if(Array.isArray(v))return {arrayValue:{values:v.map(packValue)}};return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,packValue(x)]))}};}
const packFields=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,packValue(v)]));
async function appointmentDoc(root,path,token){try{return await readJSON(root+path,{headers:{Authorization:'Bearer '+token}},'APPOINTMENT_READ');}catch(e){if(e.status===404)return null;throw e;}}
async function appointmentPatch(root,path,token,data,version){return readJSON(root+path+'?'+Object.keys(data).map(k=>'updateMask.fieldPaths='+encodeURIComponent(k)).join('&')+(version?'&currentDocument.updateTime='+encodeURIComponent(version):''),{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({fields:packFields(data)})},'APPOINTMENT_UPDATE');}
async function dueAppointments(root,token,field,now,limit=4){const data=await readJSON(root.slice(0,-1)+':runQuery',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'broadcasts'}],where:{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:field},op:'GREATER_THAN',value:{integerValue:'0'}}},{fieldFilter:{field:{fieldPath:field},op:'LESS_THAN_OR_EQUAL',value:{integerValue:String(now)}}}]}},orderBy:[{field:{fieldPath:field},direction:'ASCENDING'}],limit}})},'APPOINTMENT_QUERY');return data.filter(x=>x.document).map(x=>x.document);}
function appointmentDue(job,user,config,now){
 if(job.type!=='appointmentReminder'||job.status!=='queued')return 'skip';
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(job.userId||'')||!/^[A-Za-z0-9_-]{1,80}$/.test(job.revision||'')||!Number.isFinite(job.remindAt)||!Number.isFinite(job.appointmentAt)||job.remindAt>=job.appointmentAt||typeof job.text!=='string'||!job.text.trim())return 'invalid';
 if(job.remindAt>now)return 'future';
 if(now>=job.appointmentAt||now-job.remindAt>5*60000)return 'expired';
 if(config.appointmentReminder?.enabled!==true)return 'paused';
 if(!user||user.id===ADMIN_UID||user.role==='admin'||user.adminDeleted||user.adminMergedInto||(user.status||'active')!=='active'||user.marketingOptIn===false)return 'excluded';
 return 'send';
}
function appointmentCopy(job,user){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(job.appointmentAt)).map(p=>[p.type,p.value]));return job.text.replaceAll('{姓名}',user.name||'您好').replaceAll('{預約日期}',parts.year+'/'+parts.month+'/'+parts.day).replaceAll('{預約時間}',parts.hour+':'+parts.minute).slice(0,4000);}
async function processAppointment(env,root,token,queueDoc,now=Date.now()){
 const path=queueDoc.name.split('/documents/')[1],fresh=await appointmentDoc(root,path,token);if(!fresh)return false;
 const job=fieldsOf(fresh);if(job.type!=='appointmentReminder'||job.status!=='queued')return false;
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(job.userId||'')){await appointmentPatch(root,path,token,{status:'invalid',appointmentDueAt:null},fresh.updateTime);return false;}
 const [userDoc,configDoc]=await Promise.all([appointmentDoc(root,'users/'+job.userId,token),appointmentDoc(root,'announcements/settings',token)]),user=userDoc?{...fieldsOf(userDoc),id:job.userId}:null,config=fieldsOf(configDoc||{}),decision=appointmentDue(job,user,config,now);
 if(decision==='skip'||decision==='future')return false;
 const base='projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents/',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 // REST v1 has no verify operation. Compare-and-set unchanged fields to guard both snapshots atomically.
 const guard=(document,path,field)=>({update:{name:base+path,fields:document.fields?.[field]?{[field]:document.fields[field]}:{}},updateMask:{fieldPaths:[field]},currentDocument:{updateTime:document.updateTime}});
 const verify=[...(userDoc?[guard(userDoc,'users/'+job.userId,'status')]:[]),...(configDoc?[guard(configDoc,'announcements/settings','appointmentReminder')]:[])];
 const id='appointment_'+job.userId+'_'+job.revision,text=decision==='send'?appointmentCopy(job,user):'',next={...job,status:decision==='send'?'sent':decision,appointmentDueAt:null,appointmentPushDueAt:decision==='send'?now:null,deliveredTokens:[],pushAttempts:0,...(decision==='send'?{messageId:id,messageText:text,sentAt:now}: {})};
 const writes=[...verify,{update:{name:base+path,fields:packFields(next)},currentDocument:{updateTime:fresh.updateTime}},{update:{name:base+'chats/'+job.userId,fields:packFields({appointmentReminderDraft:next,...(decision==='send'?{lastMessage:text}:{})})},updateMask:{fieldPaths:decision==='send'?['appointmentReminderDraft','lastMessage']:['appointmentReminderDraft']},...(decision==='send'?{updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'},{fieldPath:'lastAdminMessageAt',setToServerValue:'REQUEST_TIME'}]}:{})}];
 if(decision==='send')writes.push({update:{name:base+'chats/'+job.userId+'/messages/'+id,fields:packFields({text,senderId:ADMIN_UID,senderRole:'admin',clientMessageId:id,automatic:true})},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]});
 try{await readJSON(root.slice(0,-1)+':commit',{method:'POST',headers,body:JSON.stringify({writes})},'APPOINTMENT_COMMIT');return decision==='send';}catch(e){if(/ALREADY_EXISTS|FAILED_PRECONDITION|ABORTED/.test(e.code||''))return false;throw e;}
}
async function pushAppointment(env,root,token,queueDoc,now=Date.now()){
 const path=queueDoc.name.split('/documents/')[1],fresh=await appointmentDoc(root,path,token);if(!fresh)return;
 const job=fieldsOf(fresh);if(job.type!=='appointmentReminder'||job.status!=='sent'||!job.appointmentPushDueAt||job.appointmentPushDueAt>now)return;
 if(now>=job.appointmentAt||Number(job.pushAttempts)>=3){await appointmentPatch(root,path,token,{appointmentPushDueAt:null,pushStatus:'expired'},fresh.updateTime);return;}
 let lease;try{lease=await appointmentPatch(root,path,token,{appointmentPushDueAt:now+120000,pushAttempts:Number(job.pushAttempts||0)+1},fresh.updateTime);}catch(e){if(/FAILED_PRECONDITION|ABORTED/.test(e.code||''))return;throw e;}
 const delivered=new Set(job.deliveredTokens||[]);let pending=true;
 try{
  const userDoc=await appointmentDoc(root,'users/'+job.userId,token),user=userDoc?fieldsOf(userDoc):null;
  if(!user||user.adminDeleted||user.adminMergedInto||(user.status||'active')!=='active'||user.marketingOptIn===false){await appointmentPatch(root,path,token,{appointmentPushDueAt:null,pushStatus:'excluded'},lease.updateTime);return;}
  const customerTokens=await recipientTokens(root,job.userId,token),ownerTokens=new Set(await recipientTokens(root,ADMIN_UID,token)),tokens=customerTokens.filter(t=>!ownerTokens.has(t)),config=await salonConfig(root,token);
  const ttl=Math.max(1,Math.min(3600,Math.floor((job.appointmentAt-now)/1000)));
  for(const device of tokens.filter(t=>!delivered.has(t)).slice(0,5)){try{await readJSON('https://fcm.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device,data:{title:(user.name||'客人')+'｜'+(config.name||'專屬空間'),body:job.messageText.slice(0,500),messageId:job.messageId,automatic:'true',recipientRole:'customer',tag:'salon-'+job.userId+'-'+job.messageId,url:SITE+'/salon-space-chat/customer.html'},webpush:{headers:{Urgency:'high',TTL:String(ttl)}}}})},'APPOINTMENT_PUSH');delivered.add(device);}catch(e){console.error('appointment-push',e.code);}}
  pending=!tokens.length||tokens.some(t=>!delivered.has(t));
 }catch(e){console.error('appointment-push-read',e.code||e.message);}
 const exhausted=Number(job.pushAttempts||0)+1>=3;
 await appointmentPatch(root,path,token,{deliveredTokens:[...delivered],appointmentPushDueAt:pending&&!exhausted?now+60000:null,pushStatus:pending?exhausted?'failed':'retry':'accepted'},lease.updateTime);
}
async function runAppointments(env,cron=''){
 const token=await googleToken(env),root='https://firestore.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents/',now=Date.now();let failed=0,sent=0;
 for(const d of await dueAppointments(root,token,'appointmentDueAt',now,2)){try{if(await processAppointment(env,root,token,d,now))sent++;}catch(e){failed++;console.error('appointment-message',e.code||e.message);}}
 for(const d of await dueAppointments(root,token,'appointmentPushDueAt',now,2)){try{await pushAppointment(env,root,token,d,now);}catch(e){failed++;console.error('appointment-notification',e.code||e.message);}}
 await appointmentPatch(root,'broadcasts/_runtime',token,{lastAppointmentRun:new Date().toISOString(),appointmentCron:cron,appointmentSent:sent,appointmentFailed:failed});
}
async function runScheduledReminders(env,controller){
 // One every-minute schedule. Keep day-based care at 10:00–20:00 Taiwan, hourly.
 const time=new Date(controller?.scheduledTime||Date.now()),hour=(time.getUTCHours()+8)%24;
 const jobs=[runAppointments(env,controller?.cron||'')];
 if(time.getUTCMinutes()===0&&hour>=10&&hour<=20)jobs.push(runCare(env));
 const results=await Promise.allSettled(jobs);for(const r of results)if(r.status==='rejected')throw r.reason;
}
