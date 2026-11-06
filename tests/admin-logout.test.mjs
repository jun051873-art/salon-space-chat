import assert from 'node:assert/strict';
import {performAdminLogout} from '../admin-logout.mjs';
for (const fail of [null, 'notifications', 'auth']) {
 const calls=[];
 const run=performAdminLogout({
  stopNotifications:async()=>{calls.push('notifications');if(fail==='notifications')throw Error('offline');},
  signOut:async()=>{calls.push('auth');if(fail==='auth')throw Error('failed');},
  storage:{removeItem:k=>calls.push(['remove',k]),setItem:(k,v)=>calls.push(['set',k,v])},
  navigate:()=>calls.push('navigate')
 });
 if(fail){await assert.rejects(run);assert.deepEqual(calls,fail==='notifications'?['notifications']:['notifications','auth']);}
 else {await run;assert.deepEqual(calls,['notifications','auth',['remove','salonAdminLoggedIn'],['set','salonMode','customer'],'navigate']);}
}
let navigated=false;
await performAdminLogout({stopNotifications:async()=>{},signOut:async()=>{},storage:{removeItem(){throw Error('blocked');}},navigate:()=>{navigated=true;}});
assert.equal(navigated,true);
console.log('Admin logout sequencing and failure checks passed');
