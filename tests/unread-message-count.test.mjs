import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createUnreadMessageCount,publishUnreadMessages} from '../unread-message-count.js';

const persistent=new Map(),displayed=[];
let time=200;
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('push-badge-ledger.js','utf8'),context);
const openLedger=()=>context.SalonPushBadge.create({
 load:role=>structuredClone(persistent.get(role)),
 save:async(role,state)=>persistent.set(role,structuredClone(state)),
 apply:count=>displayed.push(count),
 now:()=>time++
});
let ledger=openLedger();
await Promise.all(Array.from({length:400},(_,i)=>ledger.push('admin','salon-'+(i%4)+'-msg'+(i%200))));
assert.equal(displayed.at(-1),200);
ledger=openLedger();
await ledger.push('admin','salon-0-msg0');
assert.equal(displayed.at(-1),200,'duplicate after worker restart');
const capture=time;
await Promise.all([ledger.push('admin','salon-new-1'),ledger.push('admin','salon-new-2')]);
await ledger.sync('admin',[],capture);
assert.equal(displayed.at(-1),2,'concurrent messages survive clearing older entries');
await ledger.sync('admin',['salon-old-1'],capture-1);
assert.equal(displayed.at(-1),2,'a stale tab may not overwrite a newer confirmed read');
await ledger.push('admin','salon-0-msg0');
assert.equal(displayed.at(-1),2,'retry after read does not resurrect the badge');
await ledger.push('customer','salon-0-msg0');
assert.equal(displayed.at(-1),1,'the customer ledger starts separately');
await ledger.sync('customer',[],time+1);
assert.equal(displayed.at(-1),0);

let active=0,max=0,queries=0,shown;
const counter=createUnreadMessageCount({role:'admin',visible:()=>true,
 async load(id,after){assert.equal(after,40);queries++;max=Math.max(max,++active);await new Promise(resolve=>setImmediate(resolve));active--;return ['one','two'];},
 publish:async(role,keys)=>{assert.equal(role,'admin');shown=keys;}
});
const roomRows=Array.from({length:15},(_,i)=>({id:'room'+i,lastCustomerMessageAt:50,readAdminMs:40}));
await counter.update([...roomRows,{id:'read',lastCustomerMessageAt:50,readAdminMs:50},{id:'removed',lastCustomerMessageAt:50,readAdminMs:40,adminDeleted:true}]);
assert.equal(max,5);assert.equal(queries,15);assert.equal(shown.length,30);
await counter.update(roomRows.slice(1));
assert.equal(queries,15,'read receipts need no new query on unaffected rooms');assert.equal(shown.length,28);
await counter.update([]);
assert.deepEqual(shown,[]);
const revisions=[];
let unblock;
const staggered=createUnreadMessageCount({role:'customer',visible:()=>true,
 load:()=>new Promise(resolve=>unblock=resolve),
 publish:async(_,keys)=>{revisions.push(keys);}
});
const first=staggered.update([{id:'r1',lastAdminMessageAt:101,readCustomerMs:0}]);
await staggered.update([{id:'r1',lastAdminMessageAt:101,readCustomerMs:101}]);
unblock(['read']);
await first;
assert.deepEqual(revisions,[[]],'in-flight initial result cannot restore a read message');
console.log('PASS 400 concurrent push deliveries, both badge roles, restart, retries, cloud reconciliation, receipt races and bounded room reads');

const visiblePage={hidden:false};
let finishRegistration,posted;
const clearSent=publishUnreadMessages('admin',[],100,{
 location:{href:'https://example.test/salon-space-chat/admin.html'},document:visiblePage,
 navigator:{serviceWorker:{getRegistration:()=>new Promise(resolve=>finishRegistration=resolve)}}
});
visiblePage.hidden=true;
finishRegistration({active:{postMessage:value=>{posted=value;}}});
await clearSent;
assert.deepEqual(posted,{type:'SALON_UNREAD_MESSAGES',role:'admin',keys:[],startedAt:100},
 'confirmed empty result still reaches the worker if iOS backgrounds the window');

const lagging=openLedger();
await lagging.push('admin','salon-ghost-1');
await lagging.sync('admin',[],time-1);
assert(displayed.at(-1)>0,'old snapshots must preserve newer pushes');
await lagging.sync('admin',[],time+1);
assert.equal(displayed.at(-1),0,'fresh empty server scan clears the stale icon');

const platform={navigator:{
 clearAppBadge:async()=>{platform.cleared=(platform.cleared||0)+1;},
 setAppBadge:async number=>{platform.number=number;}
}};
const worker=fs.readFileSync('firebase-messaging-sw.js','utf8');
const ios=vm.createContext({self:platform});
vm.runInContext(worker.slice(worker.indexOf('async function updatePushBadge'),worker.indexOf('messaging.onBackgroundMessage')),ios);
assert.equal(await ios.updatePushBadge(0),'accepted');
assert.equal(platform.cleared,1);
assert.equal(platform.number,undefined);
assert.equal(await ios.updatePushBadge(2),'accepted');
assert.equal(platform.number,2);
console.log('PASS stale iPhone badge: refresh cutoff, valid background delivery and explicit clear API');
