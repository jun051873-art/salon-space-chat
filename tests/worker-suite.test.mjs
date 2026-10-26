import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../cloudflare/worker-suite.js',import.meta.url),'utf8');
const admin='HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
const env={FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test',FIREBASE_PRIVATE_KEY:'test'};
const root='https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents/';
const pack=x=>typeof x==='string'?{stringValue:x}:typeof x==='boolean'?{booleanValue:x}:typeof x==='number'?{integerValue:String(x)}:Array.isArray(x)?{arrayValue:{values:x.map(pack)}}:{mapValue:{fields:Object.fromEntries(Object.entries(x).map(([k,v])=>[k,pack(v)]))}};
function harness({users=[],chats=[],rules=[],settings={},holiday=false,caller="c1",sourceMessage={senderId:"c1",text:"預約"},sharedDevice=false,failMessage=false}={}){
 const calls=[],payloads=[],messages=new Map();let writes=0,pushes=0;
 const doc=(id,x)=>({name:root+id,fields:pack(x).mapValue.fields});
 const context=vm.createContext({Response,Request,URLSearchParams,AbortController,TextEncoder,Uint8Array,atob,btoa,setTimeout,clearTimeout,console,fetch:async(url,opt={})=>{
  calls.push(String(url));const u=String(url),body=opt.body?JSON.parse(opt.body):null;
  const ok=x=>Response.json(x);
  if(u.includes('accounts:lookup'))return ok({users:[{localId:caller}]});
  if(u===root+'announcements/settings')return ok(doc('settings',settings));
  if(u.startsWith(root+'holidays/'))return holiday?ok(doc('holiday',{closed:true})):Response.json({error:{status:'NOT_FOUND'}},{status:404});
  if(u===root+'users/c1')return ok(doc('c1',users.find(x=>x.id==='c1')||{}));
  if(u.includes('/messages/source'))return ok(doc('source',sourceMessage));
  if(u.includes('/devices?'))return ok({documents:[doc('device',{token:sharedDevice?'shared-device':u.includes('/'+admin+'/')?'owner-device':'customer-device'})]});
  if(u.includes('/pushTokens/'))return Response.json({error:{status:'NOT_FOUND'}},{status:404});
  if(u.endsWith(':commit')){const name=body.writes[0].update.name;if(failMessage&&name.includes('/chats/bad/'))return Response.json({error:{status:'UNAVAILABLE'}},{status:503});if(messages.has(name))return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});messages.set(name,body.writes[0]);writes+=body.writes.length;return ok({});}
  if(u.includes('messages:send')){pushes++;payloads.push(body.message);return ok({name:'accepted'});}
  for(const [name,data] of Object.entries({users,chats,broadcasts:rules}))if(u===root+name+'?pageSize=300')return ok({documents:data.map(x=>doc(x.id,x))});
  if(u.includes('broadcasts/_runtime?'))return ok({});
  throw Error('Unexpected request '+u);
 }});
 vm.runInContext(source.replace('export default {','const worker = {')+'\noauthCache={key:"test:test",token:"test",until:Date.now()+3600000};globalThis.api={worker,automaticReply,runCare,findReply,careDue};',context);
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
const adminNotice=await sendNotification(named,'admin');assert.equal(adminNotice.title,'常客小刀｜改名髮藝');assert.equal(adminNotice.body,'預約');
const renamed=harness({caller:admin,users:[{id:'c1',name:'小刀'}],settings:{name:'改名髮藝'},sourceMessage:{senderId:admin,text:'raw-id',sticker:{id:'raw-id'}}});
const notice=await sendNotification(renamed,'customer');assert.equal(notice.title,'小刀｜改名髮藝');assert.equal(notice.body,'傳來一張貼圖');
console.log('PASS notification payload: customer identity, shop rename, readable attachment preview');

const timeContext=vm.createContext({Intl,Date});
vm.runInContext(source.slice(source.indexOf('function timeReply('),source.indexOf('async function automaticReply('))+';globalThis.choose=timeReply;',timeContext);
const timed={weeklyHours:Object.fromEntries(Array.from({length:7},(_,i)=>[i,{closed:i===1,open:'11:30',close:'19:00'}])),timeReplies:Object.fromEntries(['business','outside','holiday'].map(k=>[k,{enabled:true,text:k}]))};
assert.equal(timeContext.choose(timed,'2026-10-15T03:29:59Z').answer,'outside');
assert.equal(timeContext.choose(timed,'2026-10-15T03:30:00Z').answer,'business');
assert.equal(timeContext.choose(timed,'2026-10-15T11:00:00Z').answer,'outside');
assert.equal(timeContext.choose(timed,'2026-10-15T04:00:00Z',true).answer,'holiday');
assert.equal(timeContext.choose(timed,'2026-10-18T16:00:00Z').answer,'holiday','Taipei Monday begins at UTC Sunday 16:00');
const disabled=structuredClone(timed);disabled.timeReplies.holiday.enabled=false;
assert.equal(timeContext.choose(disabled,'2026-10-15T04:00:00Z',true),null,'disabled holiday does not fall through to busy reply');
assert.equal(timeContext.choose({...timed,weeklyHours:null},'2026-10-15T04:00:00Z'),null,'do not guess hours');
console.log('PASS time replies: Taipei boundaries, holiday precedence, disabled category and missing hours');

const timedHarness=harness({settings:timed});
await timedHarness.api.automaticReply(env,root,'test','c1','photo','[照片]','2026-10-15T04:00:00Z');
await timedHarness.api.automaticReply(env,root,'test','c1','photo','[照片]','2026-10-15T04:00:00Z');
assert.equal(timedHarness.messages.size,1);assert.equal(timedHarness.payloads[0].data.body,'business');
const holidayHarness=harness({settings:{...timed,keywordRepliesEnabled:true,quickReplies:[{title:'預約',answer:'keyword'}]},holiday:true});
await holidayHarness.api.automaticReply(env,root,'test','c1','source','預約','2026-10-15T04:00:00Z');
assert.equal(holidayHarness.messages.size,1);assert.equal(holidayHarness.payloads[0].data.body,'keyword');
console.log('PASS time reply integration: attachment trigger, duplicate prevention, keyword over holiday');

const shared=harness({sharedDevice:true,settings:{keywordRepliesEnabled:true,quickReplies:[{title:'預約',answer:'收到'}]}});
await shared.api.automaticReply(env,root,'test','c1','source','預約');
assert.equal(shared.messages.size,1);assert.equal(shared.pushes,0,'automatic reply never alerts a device registered to the owner');
console.log('PASS automatic reply persists while owner/shared devices are excluded');

const price=harness({settings:{...timed,keywordRepliesEnabled:true,quickReplies:[{title:'護髮多少錢',keywords:['護髮'],answer:'蒸汽護髮1000打7折=700'}]}});
await price.api.automaticReply(env,root,'test','c1','price','護髮多少錢','2026-10-15T04:00:00Z');
assert.equal(price.payloads[0].data.body,'蒸汽護髮1000打7折=700');
await price.api.automaticReply(env,root,'test','c1','other','您好','2026-10-15T04:00:00Z');
assert.equal(price.payloads[1].data.body,'business');
assert.equal(price.messages.size,2);
console.log('PASS configured price before busy reply, unmatched message falls back');

const chooseCare=h.api.careDue;
const visitRule={kind:'visit',days:7,text:'關心'};
const guest={id:'c1',name:'客人',lastVisitAt:'2026-10-16T12:00:00+08:00'};
assert.equal(chooseCare(visitRule,guest,{},Date.parse('2026-10-23T10:00:00+08:00')),Date.parse(guest.lastVisitAt));
assert.equal(chooseCare(visitRule,guest,{},Date.parse('2026-10-22T23:59:59+08:00')),null);
assert.equal(chooseCare(visitRule,{id:'c1',name:'客人'},{lastCustomerMessageAt:'2026-10-01T12:00:00+08:00'},Date.parse('2026-10-23')),null,'a booking inquiry or chat cannot substitute for a recorded visit');
assert.equal(chooseCare(visitRule,{...guest,lastVisitAt:'2026-10-22T12:00:00+08:00'},{},Date.parse('2026-10-23')),null,'a new recorded visit resets the care interval');
assert.equal(chooseCare(visitRule,guest,{},Date.parse('2026-10-25')),Date.parse(guest.lastVisitAt),'overdue unsent visits are eligible on the next scheduled check');
assert.equal(chooseCare(visitRule,{...guest,adminMergedInto:'other'},{},Date.parse('2026-10-24')),null);
assert.equal(chooseCare(visitRule,{...guest,marketingOptIn:false},{},Date.parse('2026-10-24')),null);
assert.equal(chooseCare({...visitRule,days:0},guest,{},Date.parse('2026-10-24')),null);
assert.equal(chooseCare({kind:'birthday',text:'生日快樂'},{id:'c1',name:'客人',birthMonth:10,birthDay:23},{},Date.parse('2026-10-22T16:00:00Z')),2026);
assert.equal(chooseCare({kind:'inactive',days:7,text:'好久不見'},guest,{lastCustomerMessageAt:'2026-10-20T00:00:00Z'},Date.parse('2026-10-23')),null);
console.log('PASS Taipei calendar day reminders, merged records, opt-out, invalid rules and birthday boundary');

const manyRules=Array.from({length:21},(_,i)=>({id:'r'+i,type:'automation',kind:'birthday',enabled:true,text:'生日快樂'}));
const many=harness({users:[{id:'c1',name:'客人',birthMonth:day[1],birthDay:day[2]}],rules:manyRules});
await many.api.runCare(env);assert.equal(many.messages.size,21,'rules after the first twenty must not disappear');
const isolation=harness({users:[{id:'bad',name:'甲',birthMonth:day[1],birthDay:day[2]},{id:'c1',name:'乙',birthMonth:day[1],birthDay:day[2]}],rules:[manyRules[0]],failMessage:true});
await isolation.api.runCare(env);assert.equal(isolation.messages.size,1,'one failed customer must not stop remaining reminders');
console.log('PASS all enabled rules processed and per-customer write failures isolated');

// Personal visit plans are isolated by recipient and replace only generic visit care.
const personalRules=[7,30].map(days=>({id:'personal_visit_c1_'+days,type:'automation',kind:'personalVisit',targetUserId:'c1',days,enabled:true,text:'{姓名} '+days+' 天關心'}));
const personalUsers=[{id:'c1',name:'甲',visitCareManaged:true,lastVisitAt:new Date(Date.now()-31*86400000).toISOString()},{id:'c2',name:'乙',lastVisitAt:new Date(Date.now()-31*86400000).toISOString()}];
const personal=harness({users:personalUsers,rules:[...personalRules,{id:'general',type:'automation',kind:'visit',days:7,enabled:true,text:'通用關心'}]});
await personal.api.runCare(env);await personal.api.runCare(env);
assert.equal(personal.messages.size,3,'two personal reminders to c1 and only the general reminder to c2; retries do not duplicate');
const personalMessages=[...personal.messages.values()];
assert.equal(personalMessages.filter(m=>m.update.name.includes('/chats/c1/')).length,2);
assert.equal(personalMessages.filter(m=>m.update.name.includes('/chats/c2/')).length,1);
const checkPersonal=personal.api.careDue,at=Date.parse('2026-11-02T10:00:00+08:00');
const one={id:'c1',name:'甲',visitCareManaged:true,lastVisitAt:'2026-10-26T12:00:00+08:00'};
assert.notEqual(checkPersonal(personalRules[0],one,{},at),null);
assert.equal(checkPersonal(personalRules[1],one,{},at),null);
assert.equal(checkPersonal(personalRules[0],{...one,id:'c2'},{},at),null);
assert.equal(checkPersonal(personalRules[0],{...one,visitCareManaged:false},{},at),null);
for(const patch of [{status:'blocked'},{status:'pending'},{marketingOptIn:false},{adminDeleted:true},{adminMergedInto:'old'},{lastVisitAt:null},{lastVisitAt:'2026-11-01T12:00:00+08:00'}])assert.equal(checkPersonal(personalRules[0],{...one,...patch},{},at),null,JSON.stringify(patch));
const noPersonal=harness({users:personalUsers,rules:[{id:'general',type:'automation',kind:'visit',days:7,enabled:true,text:'通用關心'},...personalRules.map(r=>({...r,enabled:false}))]});await noPersonal.api.runCare(env);assert.equal(noPersonal.messages.size,1,'personal off must not fall back to generic visit care');
console.log('PASS per-customer 7/30-day isolation, legacy exclusion, opt-out, missing dates, new visits and retry deduplication');
