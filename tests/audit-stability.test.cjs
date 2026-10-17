const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('salon-suite.js','utf8');
const start=source.indexOf(' async function reviseMessage('),end=source.indexOf(' async function chatFileURL(',start);
assert(start>0&&end>start);
let message={senderId:'customer',createdAt:100,text:'original'},parent={updatedAt:100,lastMessage:'original'},updates=[];
const c=vm.createContext({auth:{currentUser:{uid:'customer'}},admin:false,db:{},doc:(_, ...p)=>p.join('/'),stamp:()=>999,millis:x=>Number(x)||0,runTransaction:async(_,fn)=>fn({get:async ref=>({exists:()=>true,data:()=>ref.includes('/messages/')?message:parent}),update:(ref,data)=>updates.push({ref,data})})});
vm.runInContext(source.slice(start,end),c);
(async()=>{
 await c.reviseMessage({room:'a'},'m',{text:'changed',senderId:'intruder'});
 assert.deepEqual(JSON.parse(JSON.stringify(updates)),[{ref:'chats/a/messages/m',data:{text:'changed',editedAt:999}},{ref:'chats/a',data:{lastMessage:'changed'}}]);
 updates=[];parent.updatedAt=200;await c.reviseMessage({room:'a'},'m',{text:'訊息已收回',retracted:true});assert.equal(updates.length,1,'newer list preview must remain intact');assert.equal(updates[0].data.retracted,true);
 updates=[];message.senderId='other';await assert.rejects(c.reviseMessage({room:'a'},'m',{text:'no'}),/自己/);assert.equal(updates.length,0);
 c.admin=true;await c.reviseMessage({room:'a'},'m',{text:'訊息已收回',retracted:true});assert.equal(updates.length,1,'owner may retract a received photo');
 message.retracted=true;await assert.rejects(c.reviseMessage({room:'a'},'m',{text:'restore'}),/已收回/);
 await assert.rejects(c.reviseMessage({room:'a'},'m',{text:' '}),/1–4000/);
 console.log('PASS edits/retractions: permission, existing retraction, payload allowlist, stable room, latest preview race');
 // Execute the actual startup tail with its removed guide absent. The regression used to throw before listeners registered.
 const html=fs.readFileSync('customer.html','utf8'),tail=html.slice(html.indexOf('$("closeGuideRibbon")'),html.indexOf('</script></body>'));
 const events=[],ctx=vm.createContext({$:()=>null,document:{addEventListener:n=>events.push(n)},window:{addEventListener:n=>events.push(n)},sessionStorage:{getItem:()=>null}});
 vm.runInContext(tail,ctx);assert(events.includes('pageshow'));assert(events.includes('visibilitychange'));
 console.log('PASS absent guide does not abort background recovery setup');
})();
// Replacing a confirmation dialog must settle its pending operation as cancelled.
const dialogs=[],buttons={};
class Dialog{constructor(){this.open=false;this.listeners={};this.isConnected=true;}set innerHTML(value){for(const id of ['confirmYes','confirmNo'])buttons[id]={};}querySelector(){return{}}addEventListener(n,f){(this.listeners[n]??=[]).push(f)}showModal(){this.open=true}close(){if(!this.open)return;this.open=false;for(const fn of this.listeners.close||[])fn()}remove(){this.isConnected=false}}
const mc=vm.createContext({admin:false,activeTool:'',document:{querySelectorAll:()=>dialogs.filter(d=>d.isConnected),createElement:()=>new Dialog(),body:{dataset:{},append:d=>dialogs.push(d)}},esc:x=>x,icon:()=>'', $:id=>buttons[id]});
vm.runInContext(source.slice(source.indexOf(' function modal('),source.indexOf(' async function store(')),mc);
(async()=>{const answer=mc.confirmAction('確認','測試');mc.modal('下一個視窗','');assert.equal(await answer,false);assert.equal(dialogs.filter(d=>d.isConnected).length,1);console.log('PASS replacing a confirmation cancels its pending operation and leaves one dialog');})();
