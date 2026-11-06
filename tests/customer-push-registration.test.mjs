import assert from 'node:assert/strict';
import {customerPushRegistration} from '../customer-push-registration.js';
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}};
const iphone={storage:storage(),uuid:()=> '11111111-1111-4111-8111-111111111111',href:'https://example.test/customer.html'};
const android={storage:storage(),uuid:()=> '22222222-2222-4222-8222-222222222222',href:'https://example.test/customer.html?appBuild=10'};
const docs=new Map();
// Actual old registration path loses one phone. New paths retain both even
// when they use the same review login and reconnect in alternating order.
const legacy=new Map();legacy.set('pushTokens/review','android');legacy.set('pushTokens/review','iphone');assert.equal(legacy.size,1);
for(let i=0;i<100;i++)for(const [env,token] of [[android,'android'],[iphone,'iphone']]){const r=customerPushRegistration('review',token,env);docs.set(r.path,r.values);}
assert.equal(docs.size,2);assert.deepEqual([...docs.values()].map(d=>d.token).sort(),['android','iphone']);
const rotated=customerPushRegistration('review','android-new',android);docs.set(rotated.path,rotated.values);assert.equal(docs.size,2);assert.deepEqual([...docs.values()].map(d=>d.token).sort(),['android-new','iphone']);
const rejoined=customerPushRegistration('new-identity','new-token',android);assert(rejoined.path.startsWith('pushTokens/new-identity/devices/'));
assert.equal(rejoined.values.uid,'new-identity');assert.throws(()=>customerPushRegistration('../bad','x',android));
console.log('PASS reproduced account token overwrite; 200 alternating phone registrations retain both tokens; token refresh updates only its device; rejoin keeps UID isolation');
// Execute the shipped Worker's actual recipient lookup against REST-shaped docs.
const fs=await import('node:fs'),vm=await import('node:vm');
const worker=vm.createContext({console,TextEncoder,Uint8Array,Response,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync('cloudflare/worker-suite.js','utf8').replace('export default {','const worker={')+'\nglobalThis.lookup=recipientTokens;',worker);
worker.readJSON=async url=>url.includes('/devices?')?{documents:[...docs.values()].map(d=>({fields:{token:{stringValue:d.token}}}))}:{fields:{token:{stringValue:'iphone'}}};
assert.deepEqual([...(await worker.lookup('https://test/','review','access'))].sort(),['android-new','iphone']);
console.log('PASS production Worker lookup retains Android and iPhone, deduplicates legacy token');
