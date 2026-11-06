import fs from 'node:fs';import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc} from 'firebase/firestore';
import {customerPushRegistration} from '../customer-push-registration.js';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
try{await env.clearFirestore();const db=env.authenticatedContext('review').firestore();
for(const [name,id]of [['android','22222222-2222-4222-8222-222222222222'],['iphone','11111111-1111-4111-8111-111111111111']]){const r=customerPushRegistration('review',name,{storage:{getItem:()=>id},href:'https://example.test/customer.html'});await assertSucceeds(setDoc(doc(db,r.path),r.values));assert.equal((await getDoc(doc(db,r.path))).data().token,name);}
await assertFails(setDoc(doc(env.authenticatedContext('other').firestore(),'pushTokens/review/devices/22222222-2222-4222-8222-222222222222'),{token:'hijack'}));
console.log('PASS real Firestore rules: each phone registration succeeds; another account cannot overwrite it');}finally{await env.cleanup();}
