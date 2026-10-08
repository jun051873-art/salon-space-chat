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
  if(request.method === "GET") return json({ok:true,service:"salon-space-notify",version:"6-care",authenticated:true,features:{keywordReplies:true,keywordContains:true,scheduledCare:true,visitCare:true}},200,cors);
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
   if(toAdmin){const job=automaticReply(env,docRoot,accessToken,room,body.messageId,message).catch(e=>console.error("auto-reply",e.code||e.message));if(ctx?.waitUntil)ctx.waitUntil(job);else await job;}
   const tokens = await recipientTokens(docRoot,recipient,accessToken);
   if(!tokens.length) return json({ok:false,error:"NO_DEVICE_TOKENS",target:toAdmin?"admin":"customer",devices:0,success:0,failed:0},404,cors);
   const url = SITE+"/salon-space-chat/"+(toAdmin?"admin.html?chat="+encodeURIComponent(room):"customer.html");
   const title = toAdmin ? "專屬空間 SALON｜客人新訊息" : "專屬空間 SALON";
   const results=[];
   // Bounded parallelism: one slow device cannot hold up all the others.
   for(let i=0;i<tokens.length;i+=5){
    results.push(...await Promise.all(tokens.slice(i,i+5).map(async token=>{
     try{
      await readJSON("https://fcm.googleapis.com/v1/projects/"+encodeURIComponent(env.FIREBASE_PROJECT_ID)+"/messages:send",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({message:{token,data:{title,body:message.slice(0,500),tag:"salon-"+room+"-"+body.messageId,messageId:body.messageId,url},webpush:{headers:{Urgency:"high",TTL:"86400"}}}})},"FCM");
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
 async scheduled(controller,env,ctx){ctx.waitUntil(runCare(env));}
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

// Deploy this file only with the documented once-daily Cron Trigger.
let salonConfigCache=null;
function unpack(v){if(v==null)return null;if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return v.timestampValue;if(v.arrayValue)return(v.arrayValue.values||[]).map(unpack);if(v.mapValue)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,unpack(x)]));return null;}
function fieldsOf(d){return Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,unpack(v)]));}
async function salonConfig(root,token){if(salonConfigCache?.until>Date.now())return salonConfigCache.data;let data={};try{data=fieldsOf(await readJSON(root+'announcements/settings',{headers:{Authorization:'Bearer '+token}},'SETTINGS'));}catch(e){if(e.status!==404)throw e;}salonConfigCache={until:Date.now()+300000,data};return data;}
async function systemMessage(env,root,token,uid,id,text){
 const name='projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents/';
 const s=v=>({stringValue:v});
 try{await readJSON(root.slice(0,-1)+':commit',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({writes:[{update:{name:name+'chats/'+uid+'/messages/'+id,fields:{text:s(text.slice(0,4000)),senderId:s(ADMIN_UID),senderRole:s('admin'),clientMessageId:s(id),automatic:{booleanValue:true}}},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]},{update:{name:name+'chats/'+uid,fields:{lastMessage:s(text.slice(0,4000))}},updateMask:{fieldPaths:['lastMessage']},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'},{fieldPath:'lastAdminMessageAt',setToServerValue:'REQUEST_TIME'}]}]})},'AUTO_WRITE');}
 catch(e){if(e.code?.includes('ALREADY_EXISTS')||e.code?.includes('FAILED_PRECONDITION'))return false;throw e;}
 const tokens=await recipientTokens(root,uid,token);
 for(let i=0;i<tokens.length;i+=5)await Promise.all(tokens.slice(i,i+5).map(device=>readJSON('https://fcm.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device,data:{title:'專屬空間 SALON',body:text.slice(0,500),messageId:id,tag:'salon-'+uid+'-'+id,url:SITE+'/salon-space-chat/customer.html'},webpush:{headers:{Urgency:'high',TTL:'86400'}}}})},'AUTO_PUSH').catch(e=>console.error('auto-push',e.code))));
 return true;
}
async function automaticReply(env,root,token,uid,sourceId,text){
 const config=await salonConfig(root,token);
 if(config.keywordRepliesEnabled!==true)return;
 const reply=findReply(config.quickReplies,text);
 if(!reply)return;
 const customer=fieldsOf(await readJSON(root+'users/'+uid,{headers:{Authorization:'Bearer '+token}},'CUSTOMER'));
 if(['blocked','archived'].includes(customer.status))return;
 await systemMessage(env,root,token,uid,'auto_'+sourceId,reply.answer);
}
async function scanCollection(root,path,token){let page='',rows=[];do{const result=await readJSON(root+path+'?pageSize=300'+(page?'&pageToken='+encodeURIComponent(page):''),{headers:{Authorization:'Bearer '+token}},'CARE_SCAN');rows.push(...(result.documents||[]).map(d=>({id:d.name.split('/').pop(),...fieldsOf(d)})));page=result.nextPageToken||'';if(rows.length>5000)throw fault('CARE_CUSTOMER_LIMIT',400);}while(page);return rows;}
async function runCare(env){
 const token=await googleToken(env),root='https://firestore.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents/';
 const all=await scanCollection(root,'broadcasts',token),rules=all.filter(r=>r.type==='automation'&&r.enabled===true);
 let sent=0;
 if(rules.length){const [users,chats]=await Promise.all([scanCollection(root,'users',token),scanCollection(root,'chats',token)]),chatMap=new Map(chats.map(c=>[c.id,c]));const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}),[year,month,date]=day.split('-').map(Number);
  outer: for(const rule of rules.slice(0,20))for(const user of users){if(user.id===ADMIN_UID||['blocked','archived'].includes(user.status)||!user.name||!rule.text)continue;const last=Date.parse((rule.kind==='visit'?user.lastVisitAt:chatMap.get(user.id)?.lastCustomerMessageAt)||'')||0;const due=rule.kind==='birthday'?Number(user.birthMonth)===month&&Number(user.birthDay)===date:['inactive','visit'].includes(rule.kind)&&last>0&&Date.now()-last>=Number(rule.days||30)*86400000;if(!due)continue;const id='care_'+rule.id+'_'+user.id+'_'+(rule.kind==='birthday'?year:last);const text=rule.text.replaceAll('{姓名}',user.name);if(await systemMessage(env,root,token,user.id,id,text))sent++;if(sent>=300)break outer;}
 }
 await readJSON(root+'broadcasts/_runtime?updateMask.fieldPaths=lastRun&updateMask.fieldPaths=sent&updateMask.fieldPaths=type',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({fields:{lastRun:{timestampValue:new Date().toISOString()},sent:{integerValue:String(sent)},type:{stringValue:'runtime'}}})},'CARE_HEARTBEAT');
}

// Literal matching only: customer text never becomes a regular expression.
function findReply(rules,text){const input=String(text||'').normalize('NFKC').toLocaleLowerCase().trim();return (Array.isArray(rules)?rules:[]).slice(0,12).find(r=>{if(r.enabled===false||!r.title||!r.answer)return false;const keys=Array.isArray(r.keywords)?r.keywords.filter(k=>typeof k==='string'&&k.trim()).slice(0,8):[];return input===String(r.title).normalize('NFKC').toLocaleLowerCase().trim()||keys.some(k=>input.includes(k.normalize('NFKC').toLocaleLowerCase().trim()));});}
