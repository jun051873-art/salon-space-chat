import fs from 'node:fs';import{initializeTestEnvironment,assertSucceeds,assertFails}from'@firebase/rules-unit-testing';
import{doc,setDoc,updateDoc,Timestamp,serverTimestamp,deleteDoc}from'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
try{
await env.clearFirestore();const customer=env.authenticatedContext('guest').firestore(),admin=env.authenticatedContext('HcFJGmzHw6MYoWbFmtq9IyFSjvL2').firestore(),other=env.authenticatedContext('other').firestore();
await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'users','guest'),{role:'customer',status:'active'});await setDoc(doc(db,'chats','guest'),{status:'active'});
for(const [id,age]of [['recent',60000],['before',29*60000],['boundary',30*60000],['old',31*60000],['future',-60000]])await setDoc(doc(db,'chats','guest','messages',id),{senderId:'guest',senderRole:'customer',text:'before',createdAt:Timestamp.fromMillis(Date.now()-age)});
await setDoc(doc(db,'chats','guest','messages','missing'),{senderId:'guest',senderRole:'customer',text:'before'});
});
const ref=(db,id)=>doc(db,'chats','guest','messages',id),edit={text:'edited',editedAt:serverTimestamp()},retract={text:'訊息已收回',editedAt:serverTimestamp(),retracted:true};
await assertSucceeds(updateDoc(ref(customer,'recent'),edit));await assertSucceeds(updateDoc(ref(customer,'before'),retract));
for(const id of ['boundary','old','future','missing']){await assertFails(updateDoc(ref(customer,id),edit));await assertFails(updateDoc(ref(customer,id),retract));}
await assertFails(updateDoc(ref(customer,'old'),{...edit,createdAt:serverTimestamp()}));await assertFails(updateDoc(ref(customer,'before'),{text:'restore',retracted:false}));await assertFails(deleteDoc(ref(customer,'old')));await assertFails(updateDoc(ref(other,'recent'),edit));
await assertSucceeds(updateDoc(ref(admin,'old'),edit));await assertSucceeds(updateDoc(ref(admin,'old'),retract));
console.log('PASS server rules: customer before/at/after 30 minutes, admin exemption, immutable deadline, no direct-delete or restore bypass');
}finally{await env.cleanup();}
