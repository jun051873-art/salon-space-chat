import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,runTransaction,deleteField,serverTimestamp} from 'firebase/firestore';
import {savePrivateProfile} from '../customer-private-profile.js';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
const owner='HcFJGmzHw6MYoWbFmtq9IyFSjvL2',admin=env.authenticatedContext(owner).firestore(),customer=env.authenticatedContext('privacy-customer').firestore(),other=env.authenticatedContext('privacy-other').firestore(),anon=env.unauthenticatedContext().firestore();
const uid='privacy-customer';
try{
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'users',uid),{name:'客人真名',phone:'123',role:'customer',status:'active',avatar:'original',profileCover:'cover',adminProfile:{name:'舊稱呼',phone:'456'},adminName:'older-alias'});await setDoc(doc(db,'chats',uid),{name:'客人真名',adminName:'舊稱呼'});});
 for(const key of ['name','phone','birthMonth','birthDay','gender','avatar','profileCover','statusText','profileEffect','profileRandom','marketingOptIn','adminProfile','adminName'])await assertFails(updateDoc(doc(admin,'users',uid),{[key]:key==='birthMonth'||key==='birthDay'?1:'changed'}));
 await assertFails(deleteDoc(doc(admin,'users',uid)));
 await assertFails(setDoc(doc(admin,'users','new-customer'),{name:'替客人建資料',role:'customer',status:'active'}));
 await assertSucceeds(getDoc(doc(admin,'users',uid)));
 await assertSucceeds(updateDoc(doc(admin,'users',uid),{tags:['剪髮'],status:'active',lastVisitAt:null}));
 await assertSucceeds(updateDoc(doc(customer,'users',uid),{name:'自己改名',phone:'789',avatar:'mine',profileCover:'my-cover',birthMonth:5,birthDay:18}));
 await assertFails(updateDoc(doc(other,'users',uid),{name:'冒名'}));
 await savePrivateProfile({db:admin,uid,alias:'只給店家看',notes:'私人備註',doc,runTransaction,deleteField,stamp:serverTimestamp});
 const own=(await getDoc(doc(customer,'users',uid))).data();assert.equal(own.name,'自己改名');assert.equal(own.avatar,'mine');assert.equal(own.phone,'789');assert.equal(own.adminProfile,undefined);assert.equal(own.adminName,undefined);
 assert.equal((await getDoc(doc(customer,'chats',uid))).data().adminName,undefined);
 const note=(await getDoc(doc(admin,'customerNotes',uid))).data();assert.equal(note.alias,'只給店家看');assert.equal(note.legacyAdminProfile.name,'舊稱呼');assert.equal(note.legacyUserAdminName,'older-alias');
 for(const db of [customer,other,anon]){await assertFails(getDoc(doc(db,'customerNotes',uid)));await assertFails(setDoc(doc(db,'customerNotes',uid),{alias:'竄改'}));}
 await assertFails(updateDoc(doc(admin,'chats',uid),{adminName:'公開私人稱呼'}));
 await savePrivateProfile({db:admin,uid,alias:'',doc,runTransaction,deleteField,stamp:serverTimestamp});assert.equal((await getDoc(doc(admin,'customerNotes',uid))).data().alias,'');assert.equal((await getDoc(doc(admin,'customerNotes',uid))).data().notes,'私人備註');
 console.log('PASS customer ownership, direct admin-write denial, private alias isolation, atomic legacy cleanup and clear-alias behavior');
}finally{await env.cleanup();}
