import assert from 'node:assert/strict';
import {createConversationFeed,sourceOf} from '../conversation-feed.js';
let account,group,last,errors=[],callbacks=new Map(),pages=[];
const d=(id,n)=>({id,data:()=>({text:id,createdAt:{seconds:n}}),metadata:{hasPendingWrites:false}});
const snap=docs=>({docs,metadata:{fromCache:false}});
const f=createConversationFeed({room:'new',watchAccount:next=>(account=next,()=>{}),watchGroup:(id,next)=>(group=next,()=>{}),
 makeSource:room=>({subscribe:(next,error)=>(callbacks.set(room,{next,error}),()=>callbacks.delete(room)),fetchPage:async cursor=>{pages.push([room,cursor.id]);return snap([d('older-'+room,0)]);}}),onChange:s=>last=s,onError:e=>errors.push(e)});
f.start();account({conversationId:'group'});group({state:'active',memberIds:['old','new'],historyRoomIds:['old','new']});
callbacks.get('old').next(snap(Array.from({length:30},(_,i)=>d(i===0?'collision':'old-'+i,100-i))));
callbacks.get('new').next(snap(Array.from({length:30},(_,i)=>d(i===0?'collision':'new-'+i,101-i))));
assert.equal(last.docs.length,60);assert(last.ready);assert.equal(last.docs[0].id,'collision');assert(last.docs.some(x=>x.id==='old/collision'));
assert.deepEqual(sourceOf({room:'new',docs:last.docs},'old/collision'),{room:'old',id:'collision'});
await f.loadMore();assert.equal(pages.length,2);assert.equal(last.docs.length,62);assert(!last.more);
const stale=callbacks.get('old').next;group({state:'active',memberIds:['new'],historyRoomIds:['new']});
stale(snap([d('forbidden',999)]));assert(!last.docs.some(x=>x.id.includes('forbidden')));
f.pause();f.start();account({conversationId:'group'});group({state:'active',historyRoomIds:['new']});callbacks.get('new').next(snap([d('fresh',200)]));assert.equal(last.docs[0].id,'fresh');
f.destroy();assert.equal(errors.length,0);
console.log('PASS combined histories: collision-safe source IDs, independent cursors, member change ignores stale callbacks, resume');
