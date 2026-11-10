import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc} from 'firebase/firestore';
import {createCleanupRest} from '../cloudflare/cleanup-rest.js';
import {createCustomerRecovery,RECOVERY_OWNER} from '../cloudflare/customer-recovery.js';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('release-preparation/P141/firestore.rules','utf8')}});
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'users/main'),{role:'customer',status:'active',name:'retained'});await setDoc(doc(c.firestore(),'chats/main/messages/keep'),{text:'history'});});
 const {db}=createCleanupRest({project:'demo-salon',token:'owner',emulatorOrigin:'http://127.0.0.1:8089'});
 const api=actor=>createCustomerRecovery({db,actor,checkAuth:async()=>{},mint:async uid=>'test:'+uid});
 const ticket=await api(RECOVERY_OWNER).issue('main');
 for(const id of [RECOVERY_OWNER,'main','attacker']){const client=env.authenticatedContext(id).firestore();await assertFails(getDoc(doc(client,'customerRecovery/main')));await assertFails(setDoc(doc(client,'customerRecovery/main'),{digest:'forged'}));}
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'customerRecovery/main')));
 const result=await Promise.allSettled([api('one').redeem(ticket.code),api('two').redeem(ticket.code)]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await db.get('chats/main/messages/keep')).data.text,'history');
 assert.equal((await db.get('users/main')).data.name,'retained');
 console.log('PASS recovery emulator: private tickets for all clients, real REST CAS single-use, retained profile/history unchanged');
}finally{await env.cleanup();}
