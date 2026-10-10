import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,runTransaction,serverTimestamp} from 'firebase/firestore';
const {saveCustomerProfile}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('customer-profile.js')).toString('base64'));
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
try{
for(const [uid,status,chatStatus] of [['profile-active','active','active'],['profile-blocked-chat','active','blocked'],['profile-pending','pending','active'],['profile-legacy',null,null]]){
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'users',uid),{name:'原名',adminProfile:{name:'店家私用'},...(status?{status,role:'customer'}:{})});if(chatStatus)await setDoc(doc(c.firestore(),'chats',uid),{status:chatStatus,lastMessage:'保留訊息'});});
}
const save=(uid,changes)=>saveCustomerProfile({db:env.authenticatedContext(uid).firestore(),uid,changes,doc,runTransaction,serverTimestamp});
await save('profile-active',{name:'小刀 ✨',phone:'+886 912-345-678',profileCover:'data:image/jpeg;base64,YQ==',gender:'男性',birthMonth:'05',birthDay:'18',avatar:'data:image/png;base64,YQ=='});
await env.withSecurityRulesDisabled(async c=>{let db=c.firestore(),u=(await getDoc(doc(db,'users','profile-active'))).data(),chat=(await getDoc(doc(db,'chats','profile-active'))).data();assert.equal(u.name,'小刀 ✨');assert.equal(u.profileCover,'data:image/jpeg;base64,YQ==');assert.equal(u.adminProfile.name,'店家私用');assert.equal(chat.name,u.name);assert.equal(chat.phone,u.phone);assert.equal(chat.lastMessage,'保留訊息');});
await assert.rejects(save('profile-blocked-chat',{name:'不可寫入'}),/暫停/);
await assert.rejects(save('profile-pending',{name:'不可寫入'}),/尚未開放/);
await assert.rejects(save('profile-active',{status:'active'}),/店家/);
await save('profile-legacy',{name:'舊客人'});
await env.withSecurityRulesDisabled(async c=>{let db=c.firestore();assert.equal((await getDoc(doc(db,'users','profile-blocked-chat'))).data().name,'原名');assert.equal((await getDoc(doc(db,'users','profile-legacy'))).data().role,'customer');assert.equal((await getDoc(doc(db,'chats','profile-legacy'))).data().name,'舊客人');});
console.log('PASS profile transaction: identity sync, private fields preserved, blocked rollback, pending rejection, legacy profile repair');
}finally{await env.cleanup();}
