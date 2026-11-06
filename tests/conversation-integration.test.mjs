import fs from 'node:fs';import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,collection,query,orderBy,limit,startAfter,getDocsFromServer,onSnapshot,runTransaction,serverTimestamp,writeBatch} from 'firebase/firestore';
import {mergeConversations} from '../conversation-merge.js';
import {createConversationFeed,sourceOf,watchServerDocument} from '../conversation-feed.js';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
const owner=env.authenticatedContext('HcFJGmzHw6MYoWbFmtq9IyFSjvL2').firestore(),customer=env.authenticatedContext('new').firestore();let feeds=[];
const until=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out waiting for shared conversation');};
try{
 await env.clearFirestore();
 for(const uid of ['old','new']){await setDoc(doc(owner,'users',uid),{name:uid,role:'customer',status:'active',avatar:uid==='new'?'data:image/png;base64,new-photo':'',phone:uid==='new'?'0912345678':''});await setDoc(doc(owner,'chats',uid),{status:'active'});await setDoc(doc(owner,'chats',uid,'messages','collision'),{senderId:'HcFJGmzHw6MYoWbFmtq9IyFSjvL2',senderRole:'admin',text:'history-'+uid,createdAt:serverTimestamp()});}
 await mergeConversations({db:owner,doc,runTransaction,stamp:serverTimestamp,primaryUid:'old',secondaryUid:'new'});
 const merged=(await getDoc(doc(owner,'users','old'))).data();assert.equal(merged.avatar,'data:image/png;base64,new-photo');assert.equal(merged.adminProfile.phone,'0912345678');
 const views=[];
 for(const [db,room]of [[owner,'old'],[customer,'new']]){
  const v={room,docs:[],errors:[]};views.push(v);
  const f=createConversationFeed({room,watchAccount:(next,error)=>watchServerDocument(onSnapshot,doc(db,'users',room),next,error),watchGroup:(id,next,error)=>watchServerDocument(onSnapshot,doc(db,'conversations',id),next,error),makeSource:r=>{const ref=collection(db,'chats',r,'messages');return{subscribe:(next,error)=>onSnapshot(query(ref,orderBy('createdAt','desc'),limit(30)),{includeMetadataChanges:true},next,error),fetchPage:cursor=>getDocsFromServer(query(ref,orderBy('createdAt','desc'),startAfter(cursor),limit(30)))};},onChange:s=>Object.assign(v,s),onError:e=>v.errors.push(e)});feeds.push(f);f.start();
 }
 await until(()=>views.every(v=>v.ready&&v.docs.length===2));
 const batch=writeBatch(customer);batch.set(doc(customer,'chats','new','messages','live-new'),{senderId:'new',senderRole:'customer',text:'customer-live',createdAt:serverTimestamp()});batch.update(doc(customer,'chats','new'),{lastMessage:'customer-live',lastCustomerMessageAt:serverTimestamp(),updatedAt:serverTimestamp()});await batch.commit();
 await until(()=>views.every(v=>v.docs.some(d=>d.data().text==='customer-live')));
 await setDoc(doc(owner,'chats','old','messages','live-owner'),{senderId:'HcFJGmzHw6MYoWbFmtq9IyFSjvL2',senderRole:'admin',text:'owner-live',createdAt:serverTimestamp()});
 await until(()=>views.every(v=>v.docs.length===4));
 assert.deepEqual(views[0].docs.map(d=>d.data().text).sort(),views[1].docs.map(d=>d.data().text).sort());
 const old=views[1].docs.find(d=>d.data().text==='history-old');assert.deepEqual(sourceOf(views[1],old.id),{room:'old',id:'collision'});
 assert(views.every(v=>v.errors.length===0));
 console.log('PASS emulator integration: owner/customer shared live timeline, both send directions, original histories retained and collision-safe source routing');
}finally{feeds.forEach(f=>f.destroy());await env.cleanup();}
