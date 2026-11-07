import assert from 'node:assert/strict';
import {retireCustomerBrowserPush} from '../native-browser-handoff.js';
const customer='https://jun051873-art.github.io/salon-space-chat/customer.html';
for(let i=0;i<100;i++){
 let unsub=0,closed=0,owner=0;const env={location:{href:customer+'?appBuild=16'},navigator:{serviceWorker:{getRegistrations:async()=>[
 {scope:customer,pushManager:{getSubscription:async()=>i%2?null:{unsubscribe:async()=>{unsub++;return true;}}},getNotifications:async()=>[{close(){closed++;}}]},
 {scope:'https://jun051873-art.github.io/salon-space-chat/',pushManager:{getSubscription:async()=>{owner++;throw Error('owner touched');}}}
 ]}}};
 assert.equal(await retireCustomerBrowserPush(env),true);assert.equal(unsub,i%2?0:1);assert.equal(closed,1);assert.equal(owner,0);
 env.location.href=customer;assert.equal(await retireCustomerBrowserPush(env),false);assert.equal(owner,0);
}
await assert.rejects(retireCustomerBrowserPush({location:{href:customer+'?appBuild=16'},navigator:{serviceWorker:{getRegistrations:async()=>[{scope:customer,pushManager:{getSubscription:async()=>({unsubscribe:async()=>false})}}]}}}),/尚未停止/);
console.log('PASS 100 native handoffs: only customer subscription retired, owner scope untouched, web unchanged, failure surfaced');
