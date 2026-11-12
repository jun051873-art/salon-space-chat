import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const src=fs.readFileSync('salon-suite.js','utf8');
let messages=new Map(),parent={updatedAt:100,lastMessage:'before'},writeCalls=0,allowed=true;
const doc=(_db,...path)=>path.join('/');
const context={admin:false,auth:{currentUser:{uid:'shop'}},db:{},sourceOf:(v,id)=>({room:v.room,id}),doc,stamp:()=>200,millis:Number,Error,
runTransaction:async(_db,fn)=>{const changes=[];await fn({get:async ref=>({exists:()=>true,data:()=>ref.includes('/messages/')?messages.get(ref):parent}),update:(ref,patch)=>changes.push([ref,patch])});if(!allowed)throw Error('permission-denied');for(const [ref,patch]of changes){if(ref.includes('/messages/'))messages.set(ref,{...messages.get(ref),...patch});else parent={...parent,...patch};}writeCalls++;}};
vm.createContext(context);vm.runInContext(src.slice(src.indexOf(' async function reviseMessage('),src.indexOf(' async function chatFileURL(')),context);
const v={room:'guest'};messages.set('chats/guest/messages/a',{senderId:'shop',senderRole:'admin',text:'before',createdAt:100});
await context.reviseMessage(v,'a',{text:'訊息已收回',retracted:true});assert.equal(messages.get('chats/guest/messages/a').retracted,true);assert.equal(parent.lastMessage,'');
context.auth.currentUser.uid='guest';messages.set('chats/guest/messages/b',{senderId:'guest',senderRole:'customer',text:'before',createdAt:100});
await context.reviseMessage(v,'b',{text:'edited'});assert.equal(messages.get('chats/guest/messages/b').text,'edited');await context.reviseMessage(v,'b',{text:'訊息已收回',retracted:true});assert.equal(parent.lastMessage,'訊息已收回');
await assert.rejects(()=>context.reviseMessage(v,'a',{text:'no'}),/只能修改/);
messages.set('chats/guest/messages/c',{senderId:'guest',senderRole:'customer',text:'keep',createdAt:100});allowed=false;await assert.rejects(()=>context.reviseMessage(v,'c',{text:'訊息已收回',retracted:true}),/permission/);assert.equal(messages.get('chats/guest/messages/c').text,'keep');assert.equal(writeCalls,3);
console.log('PASS actual revision transaction: admin removal/customer marker/edit/ownership/failed write preservation');
