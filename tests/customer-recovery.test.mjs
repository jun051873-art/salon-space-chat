import assert from 'node:assert/strict';
import {createCustomerRecovery,RECOVERY_OWNER} from '../cloudflare/customer-recovery.js';
import {encodeFields} from '../cloudflare/cleanup-rest.js';
function fixture(){
 const docs=new Map();let tick=0,time=1000,authValid=true,mints=0,hook=()=>{};
 const seed=(path,data)=>docs.set(path,{path,data:structuredClone(data),raw:encodeFields(data),version:String(++tick)});
 seed('users/main',{role:'customer',status:'active',name:'existing',conversationId:'g'});
 seed('conversations/g',{primaryUid:'main',state:'active',memberIds:['main'],historyRoomIds:['main'],sharedProfile:{name:'retained'}});
 const db={get:async p=>structuredClone(docs.get(p)||null),commit:async writes=>{for(const w of writes){if(w.create&&docs.has(w.path)||w.version&&docs.get(w.path)?.version!==w.version)throw Error('CAS');}for(const w of writes){if(w.raw){const old=docs.get(w.path);docs.set(w.path,{...old,version:String(++tick)});}else seed(w.path,w.data);}}};
 const api=actor=>createCustomerRecovery({db,actor,now:()=>time,checkAuth:async()=>{if(!authValid)throw Error('Auth unavailable');},mint:async uid=>{mints++;hook();return 'token:'+uid;}});
 return {docs,seed,api,expire:()=>time+=900001,disable:()=>authValid=false,mints:()=>mints,hook:f=>hook=f};
}
let f=fixture();await assert.rejects(f.api('attacker').issue('main'),/NOT_AUTHORIZED/);assert.equal(f.docs.size,2);
let ticket=await f.api(RECOVERY_OWNER).issue('main');assert.ok(!JSON.stringify([...f.docs.values()]).includes(ticket.code));
assert.deepEqual(await f.api('temporary').redeem(ticket.code),{ok:true,customToken:'token:main'});
await assert.rejects(f.api('temporary').redeem(ticket.code));assert.equal(f.mints(),1);assert.equal(f.docs.get('users/main').data.name,'existing');assert.equal(f.docs.get('conversations/g').data.sharedProfile.name,'retained');
f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');f.expire();await assert.rejects(f.api('temporary').redeem(ticket.code));assert.equal(f.mints(),0);
f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');await f.api(RECOVERY_OWNER).issue('main');await assert.rejects(f.api('temporary').redeem(ticket.code));
f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');const results=await Promise.allSettled([f.api('one').redeem(ticket.code),f.api('two').redeem(ticket.code)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
for(const patch of [{status:'blocked'},{status:'pending'},{adminDeleted:true},{adminMergedInto:'other'},{cleanupLock:'old'},{role:'admin'}]){f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');f.seed('users/main',{...f.docs.get('users/main').data,...patch});await assert.rejects(f.api('temporary').redeem(ticket.code));assert.equal(f.mints(),0);}
for(const path of ['retiredCustomers/main','customerCleanup/main']){f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');f.seed(path,{retired:true});await assert.rejects(f.api('temporary').redeem(ticket.code));}
for(const patch of [{blocked:true},{state:'archived'},{primaryUid:'someone-else'},{memberIds:[]},{cleanupLock:'old'}]){f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');f.seed('conversations/g',{...f.docs.get('conversations/g').data,...patch});await assert.rejects(f.api('temporary').redeem(ticket.code));}
f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');f.disable();await assert.rejects(f.api('temporary').redeem(ticket.code),/Auth/);assert.equal(f.mints(),0);
f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');f.hook(()=>f.seed('users/main',{role:'customer',status:'blocked'}));await assert.rejects(f.api('temporary').redeem(ticket.code),/CAS/);assert.equal(f.docs.get('customerRecovery/main').data.used,false);
f=fixture();ticket=await f.api(RECOVERY_OWNER).issue('main');await assert.rejects(f.api(RECOVERY_OWNER).redeem(ticket.code));await assert.rejects(f.api('temporary').redeem('main.bad'));await assert.rejects(f.api(RECOVERY_OWNER).issue(RECOVERY_OWNER));await assert.rejects(f.api(RECOVERY_OWNER).issue('../main'));
console.log('PASS recovery: owner authorization, hash-only storage, preservation, expiry, replacement, replay, concurrent CAS, blocked/retired/merged/missing-auth rejection, role isolation and race guards');
// Existing authenticated aliases can follow repeated merges, without names/phone matching.
f=fixture();assert.deepEqual(await f.api('fresh').follow(),{ok:true,linked:false});assert.equal(f.mints(),0);
f.seed('retiredCustomers/old',{retired:true,automatic:true,primaryUid:'middle'});f.seed('retiredCustomers/middle',{retired:true,automatic:true,primaryUid:'main'});
assert.deepEqual(await f.api('old').follow(),{ok:true,linked:true,customToken:'token:main'});
assert.equal(f.docs.has('users/old'),false);assert.equal(f.docs.has('users/middle'),false);
f.seed('users/main',{role:'customer',status:'blocked'});await assert.rejects(f.api('old').follow());
f=fixture();f.seed('retiredCustomers/old',{retired:true});f.seed('customerCleanup/old',{stage:'copy-files'});await assert.rejects(f.api('old').follow(),/MERGE_IN_PROGRESS/);
f.seed('customerCleanup/old',{stage:'done'});await assert.rejects(f.api('old').follow(),/RECOVERY_UNAVAILABLE/);
f=fixture();f.seed('retiredCustomers/old',{retired:true,automatic:true,primaryUid:'old'});await assert.rejects(f.api('old').follow());
f=fixture();f.seed('retiredCustomers/old',{retired:true,automatic:true,primaryUid:RECOVERY_OWNER});await assert.rejects(f.api('old').follow());
f=fixture();f.seed('retiredCustomers/old',{retired:true,automatic:true,primaryUid:'main'});f.hook(()=>f.seed('retiredCustomers/old',{retired:true,automatic:true,primaryUid:'changed'}));await assert.rejects(f.api('old').follow(),/CAS/);
console.log('PASS automatic merge recovery: authenticated alias, transitive redirects, no new profiles, blocked destination, in-progress cleanup, legacy deleted identities, cycles and concurrent mapping changes');
