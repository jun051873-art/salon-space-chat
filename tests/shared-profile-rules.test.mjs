import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {saveCustomerProfile} from '../customer-profile.js';
import {ensureSharedProfile} from '../merged-customer-profile.js';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
const db=id=>env.authenticatedContext(id).firestore(),owner='HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
const read=async(id,path)=>(await getDoc(doc(db(id),path))).data();
try{
await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();for(const id of ['a','b','outsider','blocked']){await setDoc(doc(d,'users',id),{role:'customer',status:id==='blocked'?'blocked':'active',conversationId:id==='outsider'?'other':'g',name:id,phone:'123',avatar:'old',profileCover:'old-cover',birthMonth:1,birthDay:2});await setDoc(doc(d,'chats',id),{status:'active'});}await setDoc(doc(d,'conversations','g'),{state:'active',primaryUid:'a',memberIds:['a','b','blocked'],historyRoomIds:['a','b'],revision:1});});
await ensureSharedProfile({db:db(owner),id:'g',doc,runTransaction});
const baseline=(await read('a','conversations/g')).sharedProfile;
const save=(id,changes,base)=>saveCustomerProfile({db:db(id),uid:id,changes,baseline:base,doc,runTransaction,serverTimestamp});
await save('b',{...baseline,avatar:'cat'},baseline);
assert.equal((await read('a','conversations/g')).sharedProfile.avatar,'cat');
await save('a',{...baseline,phone:'456'},baseline); // stale editor must retain b's avatar
let shared=(await read('b','conversations/g')).sharedProfile;assert.equal(shared.avatar,'cat');assert.equal(shared.phone,'456');
await save('b',{avatar:'',profileCover:''},shared);shared=(await read('a','conversations/g')).sharedProfile;assert.equal(shared.avatar,'');assert.equal(shared.profileCover,'');
await save('a',{birthMonth:3,birthDay:4},shared);assert.equal((await read('b','conversations/g')).sharedProfile.birthDay,4);
await assertFails(updateDoc(doc(db('outsider'),'conversations','g'),{sharedProfile:{name:'attack'}}));
await assertFails(updateDoc(doc(db('blocked'),'conversations','g'),{sharedProfile:{name:'attack'}}));
for(const patch of [{primaryUid:'b'},{memberIds:['a','outsider']},{sharedProfile:{role:'admin'}},{sharedProfile:{notes:'private'}},{sharedProfile:{avatar:'a'.repeat(250001)}}])await assertFails(updateDoc(doc(db('a'),'conversations','g'),patch));
await assertFails(getDoc(doc(db('a'),'users','b'))); // no access to another account's private document
await assertFails(updateDoc(doc(db(owner),'users','a'),{avatar:'shop-edit'}));
console.log('PASS emulator: merged-account sync, stale editor preservation, deletion, birthday, foreign/blocked access, membership protection, private records');
}finally{await env.cleanup();}
