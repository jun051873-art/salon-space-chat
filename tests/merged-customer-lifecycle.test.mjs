import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {createMergedProfileReader,customerListProfile,sharedProfile} from '../merged-customer-profile.js';
import {mergeConversations} from '../conversation-merge.js';
import {mergeCandidateVisible} from '../customer-management.js';

const primary={id:'chosen',role:'customer',name:'Chosen',status:'active',conversationId:'g',adminMergedInto:'',createdAt:20,tags:['primary']};
const secondary={id:'old',role:'customer',name:'Old',status:'revoked',conversationId:'g',adminMergedInto:'chosen',adminDeleted:true,createdAt:1,tags:['old']};
const group={state:'active',primaryUid:'chosen',memberIds:['chosen','old'],sharedProfile:{name:'Current',avatar:'',profileCover:''}};
const reader=createMergedProfileReader({readUser:async id=>id===primary.id?primary:secondary,readGroup:async()=>group});
const completed=await reader.resolve(secondary);
const projected=customerListProfile({...secondary,avatar:'stale'},completed,secondary);
for(const k of ['id','status','adminMergedInto','adminDeleted','createdAt','tags'])assert.deepEqual(projected[k],secondary[k],k+' must belong to the member');
assert.equal(projected.avatar,'');assert.equal(projected.name,'Current');
assert.throws(()=>customerListProfile(secondary,completed,primary));

// Run the actual customer-page listener wiring, not just a field helper.
const source=fs.readFileSync('salon-suite.js','utf8');
const page=source.split('\n').find(l=>l.startsWith(' async function customerPage('));
const dom=new JSDOM('<div id="toolBody"></div>');
const rows=[{...primary},{...secondary}],listeners=new Map();
const scope={document:dom.window.document,$:id=>dom.window.document.getElementById(id),activeTool:'customers',demo:false,config:{},customerDesignerFilter:'',customerIdentityStops:[],loadCustomers:async()=>rows,customerScope:()=>'',hasDuplicateCustomers:()=>false,countHTML:()=>'',filterHTML:()=>'',designerList:()=>[],designerFilterOptions:()=>[],filterDesignerRooms:r=>r,manualMatch:u=>!u.adminDeleted,getFilter:()=>({}),avatar:()=>'',esc:String,ago:()=>'',pills:()=>'',customTags:()=>[],assignedDesignerLabel:()=>'',followOwner:(id,cb)=>{listeners.set(id,cb);return()=>{};},customerListProfile,bindFilter(){},bindGroups(){},task(){},refreshCustomerData(){},moreCustomers(){},editCustomer(){},sample:{}};
vm.createContext(scope);vm.runInContext(page,scope);
await scope.customerPage(scope.$('toolBody'));
for(let n=0;n<3;n++){
 listeners.get('old')(await reader.resolve(secondary),secondary);
 assert.equal(scope.$('customerResults').querySelectorAll('[data-profile]').length,1,'deleted/merged card must not reappear on live updates');
 assert.equal(rows[1].id,'old');assert.equal(rows[1].adminDeleted,true);
}
assert.equal(scope.$('customerResults').querySelector('[data-profile]').dataset.profile,'chosen');
dom.window.close();
console.log('PASS P140 actual customer list: repeated live updates preserve IDs, merged/deleted state and explicit photo removal');

// Run the real merge dialog handler; opening the newer record must keep it.
const opened={id:'new',role:'customer',name:'Same',phone:'123',createdAt:20},old={id:'old',role:'customer',name:'Same',phone:'123',createdAt:1};
const button={dataset:{linkCustomer:'old'}};let selection;
const mergeScope={demo:false,db:{},doc:(_,c,id)=>c+'/'+id,getDocFromServer:async()=>({exists:()=>true,data:()=>opened}),ownerView:x=>x,customers:[opened,old],getDocsFromServer:async()=>({docs:[]}),query(){},collection(){},where(){},limit(){},mergeCandidateVisible,modal:()=>({querySelectorAll:()=>[button],close(){}}),esc:String,fmt:()=>'',task:(b,fn)=>{b.run=fn;},confirmAction:async()=>true,fetch:async()=>({json:async()=>({features:{unifiedConversations:true}})}),mergeConversations:async args=>{selection=args;},runTransaction(){},stamp(){},inboxPhotos:new Map(),loadCustomers:async()=>{},inboxDocs:[],toast(){},activeTool:'',renderInbox(){}};
vm.createContext(mergeScope);vm.runInContext(source.slice(source.indexOf(' async function duplicateCustomer('),source.indexOf(' let stickerCache=')),mergeScope);
await mergeScope.duplicateCustomer(opened);await button.run();
assert.equal(selection.primaryUid,'new');assert.equal(selection.secondaryUid,'old');
console.log('PASS P140 actual merge dialog keeps the opened account even when the candidate is older');

// Actual merge transaction must preserve explicit removals and room archive state.
const records=new Map([['users/chosen',primary],['users/old',{...secondary,status:'active',adminDeleted:false,avatar:'old-photo'}],['users/another',{id:'another',role:'customer',status:'active',avatar:'other-photo'}],['conversations/g',{...group,historyRoomIds:['chosen','old'],revision:2}],['chats/old',{adminArchived:true}]]);
const tx={get:async path=>({id:path.split('/').at(-1),exists:()=>records.has(path),data:()=>records.get(path)}),set:(path,value,opts)=>records.set(path,opts?.merge?{...records.get(path),...value}:value),update:(path,value)=>records.set(path,{...records.get(path),...value})};
await mergeConversations({db:{},doc:(_, ...parts)=>parts.join('/'),runTransaction:(_,fn)=>fn(tx),stamp:()=>1,primaryUid:'chosen',secondaryUid:'another'});
assert.equal(records.get('conversations/g').primaryUid,'chosen');
assert.equal(records.get('conversations/g').sharedProfile.avatar,'');
assert.equal(records.get('chats/old').adminArchived,true);
assert.deepEqual(sharedProfile(records.get('conversations/g').sharedProfile),records.get('conversations/g').sharedProfile);
console.log('PASS P140 remerge retains chosen primary, cleared photo, and archived history rooms');
