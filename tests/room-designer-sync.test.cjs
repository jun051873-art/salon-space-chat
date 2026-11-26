const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const {JSDOM}=require('jsdom');
const source=fs.readFileSync('salon-suite.js','utf8');
const assignment=source.slice(source.indexOf(' async function assignRoomDesigner'),source.indexOf(' const previewCache='));
const menu=source.slice(source.indexOf(' function roomMenu(u)'),source.indexOf('\n',source.indexOf(' function roomMenu(u)')));
(async()=>{const dom=new JSDOM('<body><section id="admin"></section></body>');const document=dom.window.document;let dbRecord={assignedDesignerId:'',assignedDesignerName:''},watch,stopped=0,writes=0,failWrite=false,waitRead,redraws=0;
const paths=[];
const ctx={document,console,db:{},demo:false,config:{},inboxDocs:[],liveInboxRows:new Map(),inboxPhotos:new Map(),notificationRow:null,$:id=>document.getElementById(id),readConfig:async()=>({}),designerList:()=>[{id:'dao',name:'小刀'},{id:'nana',name:'Nana'}],doc:(_,...parts)=>parts.join('/'),getDocFromServer:async path=>{paths.push(path);if(waitRead)await waitRead;return {data:()=>({...dbRecord})};},assignedDesignerLabel:u=>u.assignedDesignerName||'未指定',esc:s=>s,icon:()=>'<svg></svg>',syncCustomerRow:()=>{},renderInbox:()=>{redraws++;},toast:()=>{},fail:e=>{throw e;},onSnapshot:(_,cb)=>{watch=cb;return()=>stopped++;},task:(b,fn)=>{b.onclick=fn;},modal:(title,html)=>{const d=document.createElement('dialog');d.innerHTML='<h2>'+title+'</h2>'+html;document.body.append(d);d.open=true;d.close=()=>{d.open=false;d.dispatchEvent(new dom.window.Event('close'));d.remove();};return d;},runTransaction:async(_,fn)=>{if(failWrite)throw Error('offline');await fn({get:async()=>({exists:()=>true,data:()=>({...dbRecord})}),update:(_,patch)=>{dbRecord={...dbRecord,...patch};writes++;}});}};
vm.createContext(ctx);vm.runInContext(assignment+'\n'+menu,ctx);const u={id:'old-room',conversationPrimaryUid:'primary',name:'客人'};ctx.roomMenu(u);const parent=document.querySelector('dialog');assert(parent.classList.contains('roomMenuCompact'));assert(parent.querySelector('.roomMoreManagement #roomBlock'));assert(parent.querySelector('.roomMoreManagement #roomNotifications'));assert(!parent.querySelector('.roomMoreManagement').open);
let resumeRead;waitRead=new Promise(resolve=>{resumeRead=resolve;});
const opening=parent.querySelector('#roomDesigner').onclick();
let editor=document.querySelectorAll('dialog')[1];assert(editor.open);assert(editor.querySelector('select').disabled);
resumeRead();await opening;waitRead=null;
assert(!editor.querySelector('select').disabled);assert.deepEqual(paths,['chats/primary']);editor.querySelector('select').value='dao';await editor.querySelector('#saveRoomDesigner').onclick();assert.equal(writes,1);assert.equal(u.assignedDesignerId,'dao','the menu reflects the primary assignment immediately');assert.equal(parent.querySelector('[data-room-designer-label]').textContent,'小刀');assert.equal(stopped,0,'closing nested editor must preserve parent listener');
await parent.querySelector('#roomDesigner').onclick();editor=document.querySelectorAll('dialog')[1];assert.equal(editor.querySelector('select').value,'dao','reopen must use persisted value');editor.querySelector('select').value='nana';failWrite=true;await assert.rejects(editor.querySelector('#saveRoomDesigner').onclick(),/offline/);assert.equal(parent.querySelector('[data-room-designer-label]').textContent,'小刀');assert(editor.open);failWrite=false;await editor.querySelector('#saveRoomDesigner').onclick();assert.equal(parent.querySelector('[data-room-designer-label]').textContent,'Nana');
for(let i=0;i<25;i++){
 await parent.querySelector('#roomDesigner').onclick();
 editor=document.querySelectorAll('dialog')[1];assert.equal(editor.querySelector('select').value,'nana');
 await editor.querySelector('#saveRoomDesigner').onclick();
}
assert.equal(writes,2,'reopening and confirming unchanged assignment avoids writes');
assert.equal(redraws,3);
let resumeClosed;waitRead=new Promise(resolve=>{resumeClosed=resolve;});
const cancelled=parent.querySelector('#roomDesigner').onclick();
editor=document.querySelectorAll('dialog')[1];editor.close();resumeClosed();await cancelled;waitRead=null;
assert.equal(document.querySelectorAll('dialog').length,1);
watch({data:()=>({assignedDesignerId:'',assignedDesignerName:''})});assert.equal(parent.querySelector('[data-room-designer-label]').textContent,'未指定','remote unassignment must refresh');parent.close();assert.equal(stopped,1);console.log('PASS actual room menu + assignment: primary room, immediate panel and labels, 25 reopens, no redundant writes, failed save, remote clear, listener cleanup, compact management');})();
