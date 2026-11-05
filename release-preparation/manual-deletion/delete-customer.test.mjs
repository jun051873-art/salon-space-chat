import {processCustomer,GRACE_MS} from './delete-customer.mjs';
import assert from 'node:assert/strict';
import {assess,validateTarget,OWNER,PROJECT} from './deletion-plan.mjs';
for(const uid of [OWNER,'','../abc','abc/def',null]) assert.throws(()=>validateTarget(PROJECT,uid));
assert.throws(()=>validateTarget('other-project','test'));
const rows=new Map([
 ['users/test',{role:'customer'}],['chats/test/messages/a',{text:'private'}],
 ['chats/test/files/a',{data:'private'}],['pushTokens/test/devices/a',{token:'private'}],
 ['customerNotes/test',{linkedCustomerIds:['other']}],['customerNotes/other',{linkedCustomerIds:['test']}],
 ['bookings/b',{userId:'test'}],['notificationJobs/join_test',{}],['users/other',{role:'customer'}]
]);
for(let i=0;i<401;i++) rows.set(`feedback/${String(i).padStart(4,'0')}`,{userId:'test',text:'private'});
const ref=path=>({path,delete:async()=>{rows.delete(path)},update:async patch=>{rows.set(path,{...rows.get(path),...patch})},get:async()=>({exists:rows.has(path),data:()=>rows.get(path)}),listCollections:async()=>[...new Set([...rows.keys()].filter(p=>p.startsWith(path+'/')).map(p=>p.split('/').slice(0,path.split('/').length+1).join('/')))].map(coll),});
function coll(path) {
  return {
    listDocuments: async () => [...new Set([...rows.keys()].filter(p=>p.startsWith(path+'/')).map(p=>p.split('/').slice(0,path.split('/').length+1).join('/')))].map(ref),
    where(field,op,value) {
      let after='',max=Infinity;
      return {
        orderBy(){return this}, limit(n){max=n;return this},
        startAfter(d){after=d.ref.path;return this},
        async get(){
          return {docs:[...rows.entries()]
            .filter(([p,v])=>p.split('/').length===path.split('/').length+1&&p.startsWith(path+'/')&&p>after&&(op==='=='?v[field]===value:v[field]?.includes(value)))
            .sort(([a],[b])=>a.localeCompare(b)).slice(0,max)
            .map(([p,v])=>({ref:ref(p),data:()=>v}))};
        }
      };
    }
  };
}

const db={doc:ref,collection:coll};

let disabled=false,authDeleted=false;
const auth={updateUser:async()=>{disabled=true},revokeRefreshTokens:async()=>{},getUser:async()=>({disabled}),deleteUser:async()=>{authDeleted=true}};
const base={db,auth,uid:'test',identityConfirmed:true,now:100000};
await assert.rejects(processCustomer({...base,mode:'prepare'}),/合併/);
rows.delete('customerNotes/test');rows.delete('customerNotes/other');rows.delete('bookings/b');
const before=JSON.stringify([...rows]);
await processCustomer({...base,mode:'inspect'});
assert.equal(JSON.stringify([...rows]),before);assert.equal(disabled,false);
await assert.rejects(processCustomer({...base,mode:'prepare',identityConfirmed:false}));
await processCustomer({...base,mode:'prepare'});
assert.equal(disabled,true);assert.equal(authDeleted,false);
const erase={...base,mode:'erase',confirm:'DELETE test',writersPaused:true};
await assert.rejects(processCustomer(erase),/65/);
await assert.rejects(processCustomer({...erase,now:100000+GRACE_MS,writersPaused:false}));
await assert.rejects(processCustomer({...erase,now:100000+GRACE_MS,confirm:'DELETE other'}));
// An interrupted run leaves the profile marker and can resume after inspection.
const originalDoc=db.doc;let fail=true;
db.doc=p=>{const r=originalDoc(p);if(p==='chats/test/files/a')r.delete=async()=>{if(fail){fail=false;throw Error('simulated interruption')}rows.delete(p)};return r};
await assert.rejects(processCustomer({...erase,now:100000+GRACE_MS}),/interruption/);
assert(rows.has('users/test'));assert(authDeleted);
const result=await processCustomer({...erase,now:100000+GRACE_MS});
assert.equal(result.deleted,true);
assert.deepEqual([...rows.keys()],['users/other']);
console.log('PASS deletion: owner/project guards; dry-run; identity; linked/bookings block; grace; maintenance; exact target; orphan files; 401 feedback rows; interrupted resume; other customer intact');
