import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,onSnapshot} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
try{
await env.clearFirestore();
const owner=env.authenticatedContext('HcFJGmzHw6MYoWbFmtq9IyFSjvL2').firestore(),guest=env.authenticatedContext('alice').firestore(),other=env.authenticatedContext('bob').firestore(),anon=env.unauthenticatedContext().firestore();
await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'users','alice'),{role:'customer',status:'active',birthMonth:11,birthDay:13});});
await assertSucceeds(getDoc(doc(guest,'users','alice')));await assertFails(getDoc(doc(other,'users','alice')));await assertFails(getDoc(doc(anon,'users','alice')));
const settings={enabled:true,birthday:true,automatic:true,manual:true,start:'2026-12-20',end:'2027-01-05',effect:'snow',festivals:{halloween:true}};
await assertSucceeds(setDoc(doc(owner,'announcements','settings'),{homeCelebration:settings},{merge:true}));
assert.deepEqual((await assertSucceeds(getDoc(doc(guest,'announcements','settings')))).data().homeCelebration,settings);
await assertFails(setDoc(doc(guest,'announcements','settings'),{homeCelebration:{enabled:false}},{merge:true}));await assertFails(getDoc(doc(anon,'announcements','settings')));
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{stop();reject(Error('live sync timed out'))},8000);const stop=onSnapshot(doc(guest,'announcements','settings'),s=>{if(s.data()?.homeCelebration.effect==='gifts'){clearTimeout(timer);stop();resolve();}},reject);setDoc(doc(owner,'announcements','settings'),{homeCelebration:{...settings,effect:'gifts'}},{merge:true}).catch(reject);});
console.log('PASS actual rules: owner writes, customer reads/live sync, customer write denied, birthday privacy, unauthenticated denial');
}finally{await env.cleanup();}
