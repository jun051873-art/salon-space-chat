import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,Timestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'users','alice'),{status:'active',role:'customer'});for(const [id,type,days] of [['old','image/jpeg',91],['new','image/png',89],['text','text/plain',100],['pdf','application/pdf',100]]){await setDoc(doc(db,'chats/alice/messages/'+id),{text:'文字保留',createdAt:Timestamp.fromMillis(Date.now()-days*86400000),attachment:{type}});await setDoc(doc(db,'chats/alice/files/'+id),{type,data:'data:'+type+';base64,AA=='});}});
for(const uid of ['alice','HcFJGmzHw6MYoWbFmtq9IyFSjvL2']){const db=env.authenticatedContext(uid).firestore();await assertFails(getDoc(doc(db,'chats/alice/files/old')));for(const id of ['new','text','pdf'])await assertSucceeds(getDoc(doc(db,'chats/alice/files/'+id)));await assertSucceeds(getDoc(doc(db,'chats/alice/messages/old')));}
await assertFails(getDoc(doc(env.authenticatedContext('stranger').firestore(),'chats/alice/files/new')));
const model=fs.readFileSync('chat-image-retention.js','utf8');
const code=fs.readFileSync('cloudflare/chat-image-retention.js','utf8').replace("import {CHAT_IMAGE_TTL} from '../chat-image-retention.js';",'const CHAT_IMAGE_TTL=90*86400000;');
const {sweepChatImages}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const result=await sweepChatImages({root:'http://127.0.0.1:8089/v1/projects/demo-salon/databases/(default)/documents/',token:'owner'});
if(result.deleted!==1)throw Error('Expected one expired image deletion: '+JSON.stringify(result));
await env.withSecurityRulesDisabled(async ctx=>{if((await getDoc(doc(ctx.firestore(),'chats/alice/files/old'))).exists())throw Error('Old file not deleted');const old=(await getDoc(doc(ctx.firestore(),'chats/alice/messages/old'))).data();if(old.text!=='文字保留'||old.attachment.expired!==true)throw Error('Text/expiry patch incorrect');});
await env.cleanup();console.log('PASS server rules deny expired images for customer AND owner; preserve texts/PDF/messages and deny outsiders');
