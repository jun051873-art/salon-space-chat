import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../cloudflare/worker-suite.js',import.meta.url),'utf8');
const admin='HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
const env={FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test',FIREBASE_PRIVATE_KEY:'test'};
const root='https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents/';
const pack=x=>typeof x==='string'?{stringValue:x}:typeof x==='boolean'?{booleanValue:x}:typeof x==='number'?{integerValue:String(x)}:Array.isArray(x)?{arrayValue:{values:x.map(pack)}}:{mapValue:{fields:Object.fromEntries(Object.entries(x).map(([k,v])=>[k,pack(v)]))}};
function harness({users=[],chats=[],rules=[],settings={},caller="c1",sourceMessage={senderId:"c1",text:"預約"}}={}){
 const calls=[],payloads=[],messages=new Map();let writes=0,pushes=0;
 const doc=(id,x)=>({name:root+id,fields:pack(x).mapValue.fields});
 const context=vm.createContext({Response,Request,URLSearchParams,AbortController,TextEncoder,Uint8Array,atob,btoa,setTimeout,clearTimeout,console,fetch:async(url,opt={})=>{
  calls.push(String(url));const u=String(url),body=opt.body?JSON.parse(opt.body):null;
  const ok=x=>Response.json(x);
  if(u.includes('accounts:lookup'))return ok({users:[{localId:caller}]});
  if(u===root+'announcements/settings')return ok(doc('settings',settings));
  if(u===root+'users/c1')return ok(doc('c1',users.find(x=>x.id==='c1')||{}));
  if(u.includes('/messages/source'))return ok(doc('source',sourceMessage));
  if(u.includes('/devices?'))return ok({documents:[doc('device',{token:'device-token'})]});
  if(u.includes('/pushTokens/'))return Response.json({error:{status:'NOT_FOUND'}},{status:404});
  if(u.endsWith(':commit')){const name=body.writes[0].update.name;if(messages.has(name))return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});messages.set(name,body.writes[0]);writes+=body.writes.length;return ok({});}
  if(u.includes('messages:send')){pushes++;payloads.push(body.message);return ok({name:'accepted'});}
  for(const [name,data] of Object.entries({users,chats,broadcasts:rules}))if(u===root+name+'?pageSize=300')return ok({documents:data.map(x=>doc(x.id,x))});
  if(u.includes('broadcasts/_runtime?'))return ok({});
  throw Error('Unexpected request '+u);
 }});
 vm.runInContext(source.replace('export default {','const worker = {')+'\noauthCache={key:"test:test",token:"test",until:Date.now()+3600000};globalThis.api={worker,automaticReply,runCare,findReply};',context);
 return {api:context.api,calls,messages,payloads,get writes(){return writes},get pushes(){return pushes}};
}
const h=harness({users:[{id:'c1',name:'測試'}],settings:{keywordRepliesEnabled:true,quickReplies:[{title:'預約',answer:'請選時段'}]}});
await h.api.automaticReply(env,root,'test','c1','source','預約');
await h.api.automaticReply(env,root,'test','c1','source','預約');
assert.equal(h.writes,2);assert.equal(h.pushes,1,'duplicate source must not push again');
const blocked=harness({users:[{id:'c1',status:'blocked'}],settings:{keywordRepliesEnabled:true,quickReplies:[{title:'預約',answer:'回答'}]}});
await blocked.api.automaticReply(env,root,'test','c1','source','預約');assert.equal(blocked.writes,0);
const off=harness();await off.api.runCare(env);assert(!off.calls.some(x=>x.includes('/users?')||x.includes('/chats?')),'no enabled rules must not scan customers');
const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}).split('-').map(Number);
const care=harness({users:[{id:'c1',name:'小刀',birthMonth:day[1],birthDay:day[2]},{id:'c2',name:'封鎖',status:'blocked',birthMonth:day[1],birthDay:day[2]}],rules:[{id:'birthday',type:'automation',kind:'birthday',enabled:true,text:'{姓名}生日快樂'}]});
await care.api.runCare(env);await care.api.runCare(env);assert.equal(care.writes,2);assert.equal(care.pushes,1);assert.equal([...care.messages.values()][0].update.fields.text.stringValue,'小刀生日快樂');
const unauth=await h.api.worker.fetch(new Request('https://worker.test/',{method:'POST',body:'{}'}),env,{});assert.equal(unauth.status,401);
const mismatch=await h.api.worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({target:'admin',customerUid:'other',messageId:'source'})}),env,{});assert.equal(mismatch.status,403);
console.log('Worker suite: duplicate prevention, blocked customers, idle scan budget, birthday personalization, auth isolation PASS');

const matcher=h.api.findReply;
assert.equal(matcher([{title:'護髮多少錢',keywords:['護髮'],answer:'700'}],'請問護髮多少錢呢').answer,'700');
assert.equal(matcher([{title:'護髮',keywords:['護髮'],answer:'700',enabled:false}],'護髮'),undefined);
assert.equal(matcher([{title:'價格',keywords:['.*'],answer:'bad'}],'隨便'),undefined);
const visit=harness({users:[{id:'c1',name:'客人',lastVisitAt:new Date(Date.now()-31*86400000).toISOString()}],rules:[{id:'visit',type:'automation',kind:'visit',days:30,enabled:true,text:'髮況如何？'}]});
await visit.api.runCare(env);await visit.api.runCare(env);assert.equal(visit.writes,2);assert.equal(visit.pushes,1);
console.log('PASS literal keyword matching, disabled replies and one care message per visit.');

const sendNotification=async(h,target)=>{const result=await h.api.worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({target,customerUid:'c1',messageId:'source'})}),env,{});assert.equal(result.status,200);return h.payloads.at(-1).data;};
const named=harness({users:[{id:'c1',name:'小刀',adminProfile:{name:'常客小刀'}}],settings:{name:'改名髮藝'}});
assert.equal((await sendNotification(named,'admin')).title,'常客小刀｜新訊息');
const renamed=harness({caller:admin,users:[{id:'c1',name:'小刀'}],settings:{name:'改名髮藝'},sourceMessage:{senderId:admin,text:'raw-id',sticker:{id:'raw-id'}}});
const notice=await sendNotification(renamed,'customer');assert.equal(notice.title,'改名髮藝');assert.equal(notice.body,'傳來一張貼圖');
console.log('PASS notification payload: customer identity, shop rename, readable attachment preview');
