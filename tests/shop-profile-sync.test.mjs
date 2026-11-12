import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {shopDisplayName} from '../customer-private-profile.js';
import {JSDOM} from 'jsdom';
assert.equal(shopDisplayName('小刀','常客'),'小刀（常客）');
assert.equal(shopDisplayName('小刀','（常客）'),'小刀（常客）');
assert.equal(shopDisplayName('小刀','小刀（常客）'),'小刀（常客）');
assert.equal(shopDisplayName('小刀',''),'小刀');
const source=fs.readFileSync('salon-suite.js','utf8');
let nextUser;const watchers=new Map(),values=[],stopped=[];
const ctx={shopDisplayName,db:{},doc:(_,c,id)=>c+'/'+id,mergedProfiles:{clear(){}},fail:e=>{throw e;},
 observeIdentity:(_,cb)=>{nextUser=cb;return()=>stopped.push('identity');},
 completeOwnerProfile:async u=>({...u,privateAlias:'',customerProvided:{name:u.name}}),
 onSnapshot:(ref,cb)=>{watchers.set(ref,cb);return()=>stopped.push(ref);}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf(' function followOwner('),source.indexOf(' function watchInboxIdentities(')),ctx);
const stop=ctx.followOwner('member',p=>values.push(p));await nextUser({id:'primary',name:'本名',avatar:'original'});
watchers.get('customerNotes/primary')({data:()=>({alias:'常客',notes:'秘密'})});
assert.equal(values.at(-1).name,'本名（常客）');assert.equal(values.at(-1).notes,undefined);
watchers.get('chats/primary')({data:()=>({assignedDesignerId:'d1',assignedDesignerName:'設計師一'})});
assert.equal(values.at(-1).assignedDesignerId,'d1');
await nextUser({id:'primary',name:'新本名',avatar:'new-photo'});assert.equal(values.at(-1).name,'新本名（常客）');assert.equal(values.at(-1).avatar,'new-photo');
const stale=watchers.get('customerNotes/primary');await nextUser({id:'new-primary',name:'新主檔'});const n=values.length;stale({data:()=>({alias:'過期回呼'})});assert.equal(values.length,n);
stop();const end=values.length;watchers.get('customerNotes/new-primary')({data:()=>({alias:'關閉後'})});assert.equal(values.length,end);assert(stopped.includes('chats/primary'));
// Execute actual designer selector and transaction: canonical primary + stale-write guard.
const dom=new JSDOM('<body></body>');let saved,handler,patch,live='old';
Object.assign(ctx,{demo:false,beginDialogRequest:()=>()=>true,readConfig:async()=>({}),designerList:()=>[{id:'new',name:'新設計師'}],completeOwnerProfile:async()=>({id:'primary'}),getDocFromServer:async()=>({data:()=>({assignedDesignerId:'old'})}),assignedDesignerLabel:()=> '原設計師',esc:x=>x,modal:(title,html,options)=>{assert.equal(options.nested,true);const d=dom.window.document.createElement('div');d.innerHTML=html;d.close=()=>{};dom.window.document.body.replaceChildren(d);return d;},task:(_,cb)=>{handler=cb;},runTransaction:async(_,fn)=>fn({get:async ref=>{assert.equal(ref,'chats/primary');return{exists:()=>true,data:()=>({assignedDesignerId:live})};},update:(ref,p)=>{patch=p;}}),inboxDocs:[],syncCustomerRow:()=>{},renderInbox:()=>{},toast:()=>{}});
vm.runInContext(source.slice(source.indexOf(' async function assignRoomDesigner('),source.indexOf(' const previewCache=')),ctx);
await ctx.assignRoomDesigner({id:'member'},{onSaved:p=>saved=p});dom.window.document.querySelector('select').value='new';await handler();assert.equal(patch.assignedDesignerId,'new');assert.equal(saved.assignedDesignerName,'新設計師');
await ctx.assignRoomDesigner({id:'member'});live='changed-by-other-device';await assert.rejects(handler(),/其他裝置/);
console.log('PASS private alias realtime sync, original profile preservation, merged-primary subscriptions, cleanup, shared designer save and conflict guard');
