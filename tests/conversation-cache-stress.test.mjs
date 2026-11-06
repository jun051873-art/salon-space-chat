import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDocFromServer,collection,query,orderBy,limit,startAfter,getDocsFromServer,onSnapshot,runTransaction,serverTimestamp,writeBatch} from 'firebase/firestore';
import {mergeConversations} from '../conversation-merge.js';
import {createConversationFeed,watchConversationRooms,watchServerDocument} from '../conversation-feed.js';
import {groupConversationRows} from '../customer-management.js';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
const admin='HcFJGmzHw6MYoWbFmtq9IyFSjvL2',owner=env.authenticatedContext(admin).firestore(),customer=env.authenticatedContext('new').firestore();
const stops=[],errors=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,label)=>{for(let i=0;i<400;i++){if(fn())return;await wait(25);}throw Error('Timeout: '+label+' '+errors.map(e=>e.message).join(','));};
try{
 await env.clearFirestore();
 for(const uid of ['old','new','third']){await setDoc(doc(owner,'users',uid),{name:'test',role:'customer',status:'active'});await setDoc(doc(owner,'chats',uid),{status:'active',updatedAt:serverTimestamp()});}
 await mergeConversations({db:owner,doc,runTransaction,stamp:serverTimestamp,primaryUid:'old',secondaryUid:'new'});
 await mergeConversations({db:owner,doc,runTransaction,stamp:serverTimestamp,primaryUid:'old',secondaryUid:'third'});
 for(const db of [owner,customer])for(const [c,id]of [['users','old'],['users','new'],['conversations','old']]){if(db===customer&&id==='old'&&c==='users')continue;await getDocFromServer(doc(db,c,id));}
 // Reproduce the production adapter: a cached document's identical server response
 // is suppressed without metadata events, so the message listener never starts.
 let cached=0,server=0;const oldStop=onSnapshot(doc(owner,'users','old'),s=>{if(s.metadata.fromCache)cached++;else server++;});await wait(700);oldStop();
 assert(cached>0);assert.equal(server,0);console.log('REPRODUCED old adapter: cached account never delivers server callback');
 const views=[];
 for(const [db,room]of [[owner,'old'],[customer,'new']]){
  const v={docs:[],ready:false};views.push(v);
  const args={room,watchAccount:(next,error)=>watchServerDocument(onSnapshot,doc(db,'users',room),next,error),watchGroup:(id,next,error)=>watchServerDocument(onSnapshot,doc(db,'conversations',id),next,error)};
  v.feed=createConversationFeed({...args,makeSource:r=>{const ref=collection(db,'chats',r,'messages');return {subscribe:(next,error)=>onSnapshot(query(ref,orderBy('createdAt','desc'),limit(30)),{includeMetadataChanges:true},next,error),fetchPage:cursor=>getDocsFromServer(query(ref,orderBy('createdAt','desc'),startAfter(cursor),limit(30)))};},onChange:s=>Object.assign(v,s),onError:e=>errors.push(e)});stops.push(()=>v.feed.destroy());v.feed.start();
  stops.push(watchConversationRooms({...args,watchRoom:(id,next,error)=>onSnapshot(doc(db,'chats',id),{includeMetadataChanges:true},s=>next(s.data()||{},s.metadata.fromCache),error),onChange:(rows,confirmed)=>{v.parents=rows;v.confirmed=confirmed;},onError:e=>errors.push(e)}));
 }
 await until(()=>views.every(v=>v.ready&&v.confirmed),'warm cached initial open');
 // Concurrent messages in both directions on separate historical sources.
 const writes=[];
 for(let i=0;i<120;i++){
  const isOwner=i%2===0,db=isOwner?owner:customer,room=isOwner?'old':'new';const b=writeBatch(db);
  b.set(doc(db,'chats',room,'messages','stress-'+i),{senderId:isOwner?admin:'new',senderRole:isOwner?'admin':'customer',text:'stress-'+i,createdAt:serverTimestamp()});
  b.update(doc(db,'chats',room),{lastMessage:'stress-'+i,updatedAt:serverTimestamp(),[isOwner?'lastAdminMessageAt':'lastCustomerMessageAt']:serverTimestamp()});writes.push(b.commit());
 }
 await Promise.all(writes);await until(()=>views.every(v=>v.docs.length>=60),'both realtime windows');
 for(const v of views){for(let n=0;n<8&&v.more;n++)await v.feed.loadMore();}
 await until(()=>views.every(v=>v.docs.length===120),'complete paged histories');
 assert.deepEqual(views[0].docs.map(d=>d.data().text).sort(),views[1].docs.map(d=>d.data().text).sort());
 assert.equal(new Set(views[0].docs.map(d=>d.id)).size,120);
 await until(()=>views.every(v=>v.parents.some(x=>x.lastAdminMessageAt)&&v.parents.some(x=>x.lastCustomerMessageAt)),'both unread sources');
 assert.equal(groupConversationRows(views[0].parents).length,1);
 assert.equal(groupConversationRows(views[0].parents)[0].groupUnread,true);
 for(let round=0;round<12;round++){for(const v of views){v.feed.pause();v.ready=false;v.feed.start();}await until(()=>views.every(v=>v.ready&&v.docs.length===120),'resume '+round);}
 assert.equal(errors.length,0);
 console.log('PASS cache stress: 3 merged accounts, 120 concurrent bidirectional messages, exact histories, one inbox row, both unread sources, 12 background/resume cycles');
}finally{stops.forEach(f=>f());await env.cleanup();}
