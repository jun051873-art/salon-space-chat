import assert from 'node:assert/strict';
import fs from 'node:fs';
const load=s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
const modelSource=fs.readFileSync('chat-image-retention.js','utf8');
const {chatImageExpired,CHAT_IMAGE_TTL}=await load(modelSource);
const {sweepChatImages}=await load(fs.readFileSync('cloudflare/chat-image-retention.js','utf8').replace("import {CHAT_IMAGE_TTL} from '../chat-image-retention.js';",`const CHAT_IMAGE_TTL=${CHAT_IMAGE_TTL};`));
const now=Date.parse('2026-11-11T00:00:00Z'),sent=now-CHAT_IMAGE_TTL;
const message={attachment:{type:'image/jpeg'},createdAt:sent};
assert.equal(chatImageExpired(message,now-1),false);assert.equal(chatImageExpired(message,now),true);
assert.equal(chatImageExpired({...message,pending:true},now),false);
assert.equal(chatImageExpired({...message,attachment:{type:'text/plain'}},now),false);
assert.equal(chatImageExpired({...message,createdAt:undefined},now),false);
const base='projects/test/databases/(default)/documents',root='https://firestore.googleapis.com/v1/'+base+'/';
const f=(type)=>({type:{stringValue:type}});
const doc=(path,fields,at=sent)=>({name:base+'/'+path,fields,createTime:new Date(at).toISOString(),updateTime:'2026-11-10T00:00:00Z'});
function harness({race=false,fail=false}={}){
 const docs=new Map();let queries=0;
 for(const [id,type,at] of [['expired','image/jpeg',sent],['new','image/png',sent+1],['pdf','application/pdf',sent],['txt','text/plain',sent]]){
  docs.set('chats/c/files/'+id,doc('chats/c/files/'+id,f(type),at));
  docs.set('chats/c/messages/'+id,doc('chats/c/messages/'+id,{text:{stringValue:'保留文字'},createdAt:{timestampValue:new Date(at).toISOString()},attachment:{mapValue:{fields:f(type)}}},at));
 }
 docs.set('products/p/files/expired',doc('products/p/files/expired',f('image/jpeg')));
 docs.set('chats/removed/files/orphan',doc('chats/removed/files/orphan',f('image/webp')));
 const request=async(url,options)=>{
  const body=options.body&&JSON.parse(options.body);
  if(url.endsWith(':runQuery')){queries++;assert.deepEqual(body.structuredQuery.select.fields,[{fieldPath:'type'}]);let list=[...docs.values()].filter(d=>d.name.includes('/files/')).sort((a,b)=>a.name.localeCompare(b.name));const cursor=body.structuredQuery.startAt?.values[0].referenceValue;if(cursor)list=list.filter(d=>d.name>cursor);return Response.json(list.slice(0,body.structuredQuery.limit).map(document=>({document})));}
  if(url.endsWith(':commit')){
   if(fail||race&&body.writes.some(w=>w.delete))return Response.json({error:{}},{status:409});
   for(const w of body.writes){const path=(w.delete||w.update.name).slice(base.length+1),old=docs.get(path);if(w.currentDocument?.updateTime&&old?.updateTime!==w.currentDocument.updateTime)return Response.json({error:{}},{status:409});}
   for(const w of body.writes){const path=(w.delete||w.update.name).slice(base.length+1);if(w.delete)docs.delete(path);else if(w.updateMask){assert.deepEqual(w.updateMask.fieldPaths,['attachment.expired']);docs.get(path).fields.attachment.mapValue.fields.expired={booleanValue:true};}else docs.set(path,{...w.update,updateTime:'2026-11-11T00:00:00Z'});}
   return Response.json({});
  }
  const d=docs.get(url.slice(root.length));return d?Response.json(d):Response.json({}, {status:404});
 };
 return {docs,request};
}
let h=harness();assert.deepEqual(await sweepChatImages({root,token:'mock',now,request:h.request}),{scanned:6,deleted:2});
assert.equal(h.docs.has('chats/c/files/expired'),false);assert.equal(h.docs.get('chats/c/messages/expired').fields.text.stringValue,'保留文字');
assert.equal(h.docs.get('chats/c/messages/expired').fields.attachment.mapValue.fields.expired.booleanValue,true);
for(const p of ['chats/c/files/new','chats/c/files/pdf','chats/c/files/txt','products/p/files/expired'])assert(h.docs.has(p),p);
assert.equal((await sweepChatImages({root,token:'mock',now,request:h.request})).deleted,0);
h=harness({race:true});await assert.rejects(sweepChatImages({root,token:'mock',now,request:h.request}));assert(h.docs.has('chats/c/files/expired'));assert(!h.docs.has('broadcasts/_chatImageRetention'));
h=harness();for(let i=0;i<4;i++)await sweepChatImages({root,token:'mock',now,request:h.request,limit:2});assert(!h.docs.has('chats/c/files/expired'));assert(!h.docs.has('chats/removed/files/orphan'));
console.log('PASS 90-day boundary, pending upload, image-only deletion, message retention, product/PDF/text exclusion, orphan expiry, replay, conflict, cursor batches');

const vm=await import('node:vm');
const suite=fs.readFileSync('salon-suite.js','utf8');
const code=suite.slice(suite.indexOf('export function messageHTML'),suite.indexOf('export function installSuite')).replace('export ','');
const context=vm.createContext({chatImageExpired,millis:v=>Number(v)||0,esc:v=>String(v??'')});vm.runInContext(code,context);
for(const viewer of ['customer','shop']){const html=context.messageHTML({...message,id:'old',text:'說明保留',senderId:'customer',createdAt:Date.now()-CHAT_IMAGE_TTL-100},viewer);assert.match(html,/圖片已到期/);assert.match(html,/說明保留/);assert.doesNotMatch(html,/data-image-preview|data-file/);}
console.log('PASS both-role actual renderer preserves caption and removes image/download controls');
