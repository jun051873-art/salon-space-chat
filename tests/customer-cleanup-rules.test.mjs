import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,serverTimestamp,runTransaction} from 'firebase/firestore';
import {createCleanupRest} from '../cloudflare/cleanup-rest.js';
import {createCustomerCleanup,CLEANUP_OWNER,CLEANUP_PROJECT} from '../cloudflare/customer-cleanup.js';
import {createCustomerRecovery} from '../cloudflare/customer-recovery.js';
import {mergeConversations} from '../conversation-merge.js';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('release-preparation/P141/firestore.rules','utf8')}});
const db=id=>env.authenticatedContext(id).firestore(),owner=db(CLEANUP_OWNER);
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{for(const id of ['a','b']){await setDoc(doc(c.firestore(),'users',id),{role:'customer',status:'active',name:id});await setDoc(doc(c.firestore(),'chats',id),{status:'active'});}await setDoc(doc(c.firestore(),'chats/b/messages/m'),{text:'preserve',senderId:'b',senderRole:'customer',createdAt:serverTimestamp()});await setDoc(doc(c.firestore(),'chats/b/files/m'),{data:'test',type:'image/png',senderId:'b'});});
 await mergeConversations({db:owner,doc,runTransaction,stamp:serverTimestamp,primaryUid:'a',secondaryUid:'b'});
 await assertSucceeds(updateDoc(doc(db('b'),'conversations/a'),{sharedProfile:{name:'客人',avatar:'new'}}));
 await assertFails(updateDoc(doc(owner,'users/a'),{cleanupLock:'fake'}));
 await assertFails(setDoc(doc(owner,'retiredCustomers/b'),{retired:true}));
 const transport=createCleanupRest({project:'demo-salon',token:'owner',emulatorOrigin:'http://127.0.0.1:8089'}),calls=[];
 const api=createCustomerCleanup({db:transport.db,auth:{disable:async uid=>calls.push('disable:'+uid),remove:async uid=>calls.push('delete:'+uid)},project:CLEANUP_PROJECT,actor:CLEANUP_OWNER,enabled:true});
 await env.withSecurityRulesDisabled(async c=>{for(let i=0;i<9;i++)await setDoc(doc(c.firestore(),'bookings/booking'+i),{userId:'b',status:['confirmed','completed','cancelled'][i%3],startAt:serverTimestamp(),slotId:'booking'+i,service:'剪髮'});await setDoc(doc(c.firestore(),'availability/day'),{slots:{'10:00':true}});});
 const before=await transport.db.list('bookings','',20);
 const preview=await api.preview('a','b');await api.start('a','b',preview.token);
 for(const user of [owner,db('a'),db('b')]){
  await assertFails(updateDoc(doc(user,'users/b'),{status:'active'}));
  await assertFails(setDoc(doc(user,'chats/b/messages/revive'),{text:'x',senderId:user===owner?CLEANUP_OWNER:'b',senderRole:user===owner?'admin':'customer',createdAt:serverTimestamp()}));
 }
 await assertFails(updateDoc(doc(owner,'conversations/a'),{memberIds:['a','b','c']}));
 await assertFails(setDoc(doc(owner,'customerNotes/b'),{notes:'late'}));
 await assertFails(setDoc(doc(db('b'),'pushTokens/b/devices/d'),{token:'late'}));
 await assertFails(setDoc(doc(owner,'bookings/test'),{userId:'b'}));
 await assertFails(deleteDoc(doc(owner,'chats/a')));
 await api.step('b');
 await assertFails(updateDoc(doc(owner,'bookings/booking0'),{status:'cancelled'}));
 let result;for(let i=0;i<60;i++){result=await api.step('b');if(result.done)break;}
 assert.equal(result.done,true);
 for(const original of before)assert.deepEqual((await transport.db.get(original.path)).raw,{...original.raw,userId:{stringValue:'a'}});
 assert.deepEqual((await transport.db.get('availability/day')).data,{slots:{'10:00':true}});
 await assertSucceeds(getDoc(doc(db('a'),'bookings/booking0')));
 await assertFails(getDoc(doc(db('b'),'bookings/booking0')));
assert.deepEqual(calls,[]);assert.equal((await transport.db.get('retiredCustomers/b')).data.primaryUid,'a');
 assert.equal((await transport.db.get('users/b')),null);assert.equal((await transport.db.list('chats/b/messages','',10)).length,0);
 const messages=await transport.db.list('chats/a/messages','',10);assert.equal(messages.length,1);assert.ok(messages[0].raw.createdAt.timestampValue,'timestamp retained as native timestamp');
 await assertFails(setDoc(doc(owner,'users/b'),{role:'customer',status:'active'}));
 await assertFails(setDoc(doc(db('b'),'users/b'),{role:'customer',status:'pending'}));
 await assertFails(setDoc(doc(owner,'chats/b'),{lastMessage:'revive'}));
 await assertFails(updateDoc(doc(owner,'customerNotes/a'),{linkedCustomerIds:['b']}));
 await assertSucceeds(updateDoc(doc(db('a'),'users/a'),{name:'still works'}));
 await assertSucceeds(updateDoc(doc(db('a'),'conversations/a'),{sharedProfile:{name:'still works',avatar:''}}));
 const restored=await createCustomerRecovery({db:transport.db,actor:'b',checkAuth:async()=>{},mint:async id=>'custom:'+id}).follow();assert.equal(restored.customToken,'custom:a');
 console.log('PASS emulator P145 alias follows completed cleanup while retired direct access stays forbidden');
 console.log('PASS emulator P141: normal merge/profile sync, locks, stale clients, retired ID, real REST copy/verify/delete, timestamp preservation, surviving account');
}finally{await env.cleanup();}
