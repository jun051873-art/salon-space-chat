import assert from 'node:assert/strict';
import {createCustomerCleanup,CLEANUP_OWNER,CLEANUP_PROJECT} from '../cloudflare/customer-cleanup.js';
import {encodeFields,decodeFields} from '../cloudflare/cleanup-rest.js';
function fixture(){
 const docs=new Map();let tick=0,fail=false;const authCalls=[];
 const seed=(path,data)=>docs.set(path,{path,data:structuredClone(data),raw:encodeFields(data),version:String(++tick)});
 seed('users/a',{role:'customer',status:'active',conversationId:'g',name:'主檔'});seed('users/b',{role:'customer',status:'active',conversationId:'g',name:'舊檔'});
 seed('conversations/g',{state:'active',primaryUid:'a',memberIds:['a','b'],historyRoomIds:['a','b'],revision:1,sharedProfile:{avatar:''}});
 seed('customerNotes/a',{notes:'主備註',linkedCustomerIds:['b']});seed('customerNotes/b',{notes:'舊備註'});
 seed('chats/a',{lastMessage:'新',updatedAt:'2026-11-09T12:00:00Z'});seed('chats/b',{lastMessage:'舊',updatedAt:'2026-11-08T12:00:00Z'});
 for(let i=0;i<9;i++)seed('chats/b/messages/msg'+i,{text:'歷史'+i,senderId:'b',senderRole:'customer',clientMessageId:'msg'+i,createdAt:'2026-11-01T00:00:00Z',...(i===0?{attachment:true}:{})});
 seed('chats/a/messages/msg0',{text:'主檔同名訊息不可覆蓋'});seed('chats/b/files/msg0',{data:'image',type:'image/png',senderId:'b'});seed('pushTokens/b/devices/device',{token:'old'});seed('feedback/f',{userId:'b',text:'回報'});seed('broadcasts/visit',{targetUserId:'b'});
 const db={get:async p=>structuredClone(docs.get(p)||null),list:async(c,cursor='',limit=4)=>[...docs.values()].filter(x=>x.path.startsWith(c+'/')&&x.path.split('/').length===c.split('/').length+1&&x.path.split('/').at(-1)>cursor).sort((a,b)=>a.path.localeCompare(b.path)).slice(0,limit).map(x=>structuredClone(x)),query:async(c,f,op,v,n)=>[...docs.values()].filter(x=>x.path.split('/').length===2&&x.path.startsWith(c+'/')&&(op==='EQUAL'?x.data[f]===v:x.data[f]?.includes(v))).slice(0,n).map(x=>structuredClone(x)),children:async p=>[...new Set([...docs.keys()].filter(x=>x.startsWith(p+'/')).map(x=>x.slice(p.length+1).split('/')[0]))],commit:async writes=>{
  if(fail){fail=false;throw Error('network lost');}
  assert.equal(new Set(writes.map(x=>x.path)).size,writes.length,'no duplicate writes');
  for(const w of writes){if(w.create&&docs.has(w.path)||w.version&&docs.get(w.path)?.version!==w.version)throw Error('CAS conflict');}
  for(const w of writes){if(w.delete){docs.delete(w.path);continue;}const raw=w.raw||encodeFields(w.data),next=w.merge?{...docs.get(w.path)?.raw,...raw}:raw;docs.set(w.path,{path:w.path,raw:structuredClone(next),data:decodeFields(next),version:String(++tick)});}
 }};
 const api=createCustomerCleanup({db,auth:{disable:async u=>authCalls.push('disable:'+u),remove:async u=>authCalls.push('delete:'+u)},project:CLEANUP_PROJECT,actor:CLEANUP_OWNER,enabled:true});
 return {api,db,docs,seed,authCalls,fail:()=>fail=true};
}
let f=fixture();const p=await f.api.preview('a','b');await f.api.start('a','b',p.token);f.fail();await assert.rejects(f.api.step('b'),/network/);
let j;for(let i=0;i<100;i++){j=await f.api.step('b');if(j.done)break;}assert.equal(j.done,true);assert.equal(j.copiedMessages,9);assert.equal(j.deletedMessages,9);assert.equal(j.copiedFiles,1);
assert.equal(f.docs.has('users/b'),false);assert.equal([...f.docs.keys()].some(x=>x.startsWith('chats/b')),false);assert.equal((await f.db.list('chats/a/messages','',100)).length,10);assert.equal(f.docs.get('chats/a/messages/msg0').data.text,'主檔同名訊息不可覆蓋');assert.match(f.docs.get('customerNotes/a').data.notes,/舊備註/);assert.deepEqual(f.docs.get('conversations/g').data.memberIds,['a']);assert.equal(f.docs.get('retiredCustomers/b').data.retired,true);assert.equal(f.docs.get('feedback/f').data.userId,'a');assert.equal(f.docs.has('broadcasts/visit'),false);assert.equal(f.docs.get('users/a').data.cleanupLock,'');assert.deepEqual(f.authCalls,[]);assert.equal(f.docs.get('retiredCustomers/b').data.primaryUid,'a');assert.equal(f.docs.get('retiredCustomers/b').data.automatic,true);assert.deepEqual(await f.api.step('b'),j);
console.log('PASS cleanup: all pages, collision-safe copy, attachments, notes, retry, retirement and idempotent completion');
f=fixture();await assert.rejects(f.api.start('a','b','wrong'),/變更/);f.seed('users/other',{role:'customer',status:'active',conversationId:'else'});await assert.rejects(f.api.preview('a','other'),/同組/);await assert.rejects(f.api.preview('b','a'),/主檔/);f.seed('users/b/unknown/secret',{data:'keep'});await assert.rejects(f.api.preview('a','b'),/其他資料/);
console.log('PASS cleanup: stale confirmation, wrong group, wrong primary, unknown descendants refused');
f=fixture();let q=await f.api.preview('a','b');await f.api.start('a','b',q.token);await f.api.step('b');await f.api.step('b');await f.api.step('b'); // copying messages next
await Promise.allSettled([f.api.step('b'),f.api.step('b')]);assert.equal(f.docs.get('customerCleanup/b').data.copiedMessages,4);
while(f.docs.get('customerCleanup/b').data.stage!=='erase-messages')await f.api.step('b');
const copied=[...f.docs.keys()].find(p=>p.startsWith('chats/a/messages/m_'));f.seed(copied,{text:'tampered'});await assert.rejects(f.api.step('b'),/不一致/);assert.equal((await f.db.list('chats/b/messages','',100)).length,9);
console.log('PASS cleanup: concurrent steps serialize; altered destination blocks deletion');
// Bookings keep their original document IDs, timestamps, status and slot data.
f=fixture();const originals=new Map();
for(let i=0;i<11;i++){
 const path='bookings/slot'+i;f.seed(path,{userId:'b',status:['confirmed','completed','cancelled'][i%3],date:'2026-11-10',time:'10:00',slotId:'slot'+i,service:'剪髮',adminArchived:i%2===0,custom:{keep:true}});
 f.docs.get(path).raw.startAt={timestampValue:'2026-11-10T02:00:00.123456Z'};originals.set(path,structuredClone(f.docs.get(path).raw));
}
f.seed('bookings/unrelated',{userId:'c',status:'confirmed'});f.seed('availability/day',{slots:{'10:00':true}});
q=await f.api.preview('a','b');await f.api.start('a','b',q.token);
f.fail();await assert.rejects(f.api.step('b'),/network/);assert.equal(f.authCalls.length,0);
await f.api.step('b'); // transfer committed, response may be lost
assert.equal(f.docs.get('customerCleanup/b').data.pendingBookings.length,4);
f.fail();await assert.rejects(f.api.step('b'),/network/);assert.equal(f.authCalls.length,0);
await Promise.allSettled([f.api.step('b'),f.api.step('b')]);
assert.equal(f.docs.get('customerCleanup/b').data.transferredBookings,4);
for(let i=0;i<100;i++){j=await f.api.step('b');if(j.done)break;}
assert.equal(j.done,true);assert.equal(f.docs.get('customerCleanup/b').data.transferredBookings,11);
for(const [path,raw] of originals)assert.deepEqual(f.docs.get(path).raw,{...raw,userId:{stringValue:'a'}});
assert.equal(f.docs.get('bookings/unrelated').data.userId,'c');assert.deepEqual(f.docs.get('availability/day').data,{slots:{'10:00':true}});
console.log('PASS booking migration: all statuses, multiple pages, native fields, retries, concurrent verification, unrelated records and slots preserved');
f=fixture();f.seed('bookings/one',{userId:'b',status:'confirmed'});q=await f.api.preview('a','b');await f.api.start('a','b',q.token);await f.api.step('b');
f.seed('bookings/one',{userId:'a',status:'cancelled'});await assert.rejects(f.api.step('b'),/預約移轉核對不一致/);assert.equal(f.authCalls.length,0);assert.ok(f.docs.has('users/b'));
f=fixture();f.seed('bookings/one',{userId:'b'});f.seed('bookings/one/unknown/data',{keep:true});q=await f.api.preview('a','b');await f.api.start('a','b',q.token);await assert.rejects(f.api.step('b'),/預約含其他資料/);assert.equal(f.docs.get('bookings/one').data.userId,'b');assert.equal(f.authCalls.length,0);
console.log('PASS booking migration: changed destination or unknown descendants block account deletion');
