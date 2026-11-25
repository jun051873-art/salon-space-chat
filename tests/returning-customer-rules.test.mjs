import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {mergeConversations} from '../conversation-merge.js';
import {findReturningProfiles} from '../returning-customer.js';

const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
const adminId='HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
const admin=env.authenticatedContext(adminId).firestore();
const applicant=env.authenticatedContext('new').firestore();
const profile={name:'Original',phone:'0912345678',role:'customer',status:'active'};
const cases=[{...profile,id:'main'},{...profile,id:'other',adminMergedInto:'main'},{...profile,id:'blocked',status:'blocked'},{...profile,id:'new'}];
try{
 await env.clearFirestore();
 const selection=await findReturningProfiles({applicant:{...profile,id:'new'},lookup:async()=>cases});
 assert.deepEqual(selection.map(x=>x.id),['main']);
 await env.withSecurityRulesDisabled(async context=>{
  const seed=context.firestore();
  await setDoc(doc(seed,'users','main'),profile);
  await setDoc(doc(seed,'chats','main'),{userId:'main',status:'active'});
  await setDoc(doc(seed,'chats','main','messages','original'),{senderId:adminId,senderRole:'admin',text:'Original history'});
 });
 await assertSucceeds(setDoc(doc(applicant,'users','new'),{name:'Returning',role:'customer',status:'pending',returningCustomer:true}));
 const stranger=env.authenticatedContext('stranger').firestore();
 await assertFails(setDoc(doc(stranger,'users','stranger'),{role:'customer',status:'pending',returningCustomer:'yes'}));
 await assertFails(updateDoc(doc(applicant,'users','new'),{status:'active'}));
 await assertFails(getDoc(doc(applicant,'chats','main','messages','original')));
 const merge={db:admin,doc,runTransaction,stamp:serverTimestamp,primaryUid:'main',secondaryUid:'new',approveReturning:true};
 await mergeConversations(merge);
 const approved=(await getDoc(doc(applicant,'users','new'))).data();
 assert.equal(approved.status,'active');
 assert.equal(approved.adminMergedInto,'main');
 assert.equal((await getDoc(doc(admin,'users','main'))).data().name,profile.name);
 assert.equal((await getDoc(doc(applicant,'chats','main','messages','original'))).data().text,'Original history');
 await assert.rejects(mergeConversations(merge),/狀態已變更/);
 await assertFails(updateDoc(doc(applicant,'users','new'),{returningCustomer:false}));
 console.log('PASS returning applicant has no prior access; owner approval atomically restores history and rejects repeated merge');
}finally{await env.cleanup();}
