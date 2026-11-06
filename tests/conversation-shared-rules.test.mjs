import fs from 'node:fs';
import assert from 'node:assert/strict';
import {mergeConversations} from '../conversation-merge.js';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,collection,getDocs,serverTimestamp,runTransaction} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
try{
 await env.clearFirestore();
 const a=env.authenticatedContext('old').firestore(),b=env.authenticatedContext('new').firestore(),outsider=env.authenticatedContext('stranger').firestore();
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const uid of ['old','new','stranger']){
   await setDoc(doc(db,'users',uid),{role:'customer',status:'active',...(uid!=='stranger'?{conversationId:'group'}:{})});
   await setDoc(doc(db,'chats',uid),{status:'active'});
   await setDoc(doc(db,'chats',uid,'messages','same-id'),{senderId:uid,senderRole:'customer',text:uid,createdAt:serverTimestamp()});
   await setDoc(doc(db,'chats',uid,'files','same-id'),{type:'text/plain',data:'old attachment'});
  }
  await setDoc(doc(db,'conversations','group'),{state:'active',memberIds:['old','new'],historyRoomIds:['old','new']});
  await setDoc(doc(db,'customerNotes','old'),{notes:'private'});
 });
 await assertSucceeds(getDocs(collection(b,'chats','old','messages')));
 await assertSucceeds(getDoc(doc(b,'chats','old','files','same-id')));
 await assertFails(getDoc(doc(b,'customerNotes','old')));
 await assertFails(getDoc(doc(b,'users','old')));
 await assertFails(getDocs(collection(outsider,'chats','old','messages')));
 await assertFails(getDoc(doc(outsider,'conversations','group')));
 await assertFails(updateDoc(doc(b,'users','new'),{conversationId:'forged'}));
 await assertFails(setDoc(doc(b,'conversations','forged'),{state:'active',memberIds:['new'],historyRoomIds:['stranger']}));
 await assertSucceeds(updateDoc(doc(b,'chats','old'),{readCustomerMs:Date.now()-1000}));
 await assertFails(updateDoc(doc(b,'chats','old'),{readAdminMs:1}));
 await assertFails(updateDoc(doc(b,'chats','old'),{name:'rewrite'}));
 await assertFails(updateDoc(doc(b,'chats','old','messages','same-id'),{text:'rewrite another UID'}));
 await assertSucceeds(setDoc(doc(b,'chats','new','messages','new-message'),{senderId:'new',senderRole:'customer',text:'new',createdAt:serverTimestamp()}));
 await assertSucceeds(getDoc(doc(a,'chats','new','messages','new-message')));
 for(const status of ['pending','blocked','revoked']){
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users','new'),{status}));
  await assertFails(getDoc(doc(b,'chats','old','messages','same-id')));
 }
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users','new'),{status:'active',adminDeleted:true}));
 await assertFails(getDoc(doc(b,'chats','old','files','same-id')));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users','new'),{adminDeleted:false,conversationId:'wrong'}));
 await assertFails(getDoc(doc(b,'chats','old','messages','same-id')));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users','new'),{conversationId:'group',status:'active',adminDeleted:false}));
 const owner=env.authenticatedContext('HcFJGmzHw6MYoWbFmtq9IyFSjvL2').firestore();
 const merge=database=>mergeConversations({db:database,doc,runTransaction,stamp:serverTimestamp,primaryUid:'old',secondaryUid:'new'});
 await assertFails(merge(b));
 const merged=await assertSucceeds(merge(owner));
 assert.equal(merged.id,'group');
 assert.equal((await getDoc(doc(b,'users','new'))).data().conversationId,'group');
 assert.equal((await getDoc(doc(owner,'chats','old','messages','same-id'))).data().text,'old');
 assert.equal((await getDoc(doc(owner,'chats','new','messages','same-id'))).data().text,'new');
 await assertSucceeds(getDoc(doc(b,'chats','old','messages','same-id')));
 await assertFails(getDocs(collection(b,'conversationMergeAudit')));
 await updateDoc(doc(owner,'conversations','group'),{blocked:true});
 await assertFails(getDoc(doc(b,'chats','new','messages','same-id')));
 await assertFails(getDoc(doc(b,'chats','old','messages','same-id')));
 await assertFails(setDoc(doc(b,'chats','new','messages','blocked-group'),{senderId:'new',senderRole:'customer',text:'blocked',createdAt:serverTimestamp()}));
 await updateDoc(doc(owner,'conversations','group'),{blocked:false});
 await assertSucceeds(getDoc(doc(b,'chats','old','messages','same-id')));
 console.log('PASS owner merge transaction persists mappings and audit; customer merge denied; both histories untouched');
 console.log('PASS actual rules: shared history/files, UID writes, source receipts, outsider isolation, membership forgery, revoked/deleted/mismatched membership');
}finally{await env.cleanup();}
