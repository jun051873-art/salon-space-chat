import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../notification-worker.js',import.meta.url),'utf8');
const {NOTIFICATION_VERSION,waitForNotificationVersion}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const old={state:'activated',version:'N1'},current={state:'activated',version:NOTIFICATION_VERSION},registration={active:old};
let attempts=0;
await waitForNotificationVersion(registration,{probe:async w=>{attempts++;return w.version;},pause:async()=>{registration.active=current;}});
assert.equal(attempts,2,'do not report success while the old worker is active');
await assert.rejects(waitForNotificationVersion({active:old},{timeout:0,probe:async w=>w.version,pause:async()=>{}}),/尚未更新完成/);
const moving={active:current};let first=true;
await waitForNotificationVersion(moving,{probe:async w=>{if(first){first=false;moving.active=old;}return w.version;},pause:async()=>{moving.active=current;}});
assert.equal(first,false,'recheck registration if its worker changes during acknowledgement');
const handlers={};const sw=await readFile(new URL('../firebase-messaging-sw.js',import.meta.url),'utf8');
const end=sw.indexOf('// Register click handling');
const context={self:{addEventListener:(name,fn)=>handlers[name]=fn},importScripts(){},SalonPush:{}};
vm.runInNewContext(sw.slice(0,end),context);
let response;
handlers.message({data:{type:'SALON_NOTIFICATION_VERSION'},ports:[{postMessage:x=>response=x}]});
assert.equal(response.version,NOTIFICATION_VERSION);
for(const [name,expected]of [['manifest-customer.json','專屬空間'],['manifest-admin.json','沙龍管理']]){
 const manifest=JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
 assert.equal(manifest.name,expected);assert.equal(manifest.short_name,expected);
 assert.equal(manifest.start_url,name.includes('customer')?'./customer.html':'./admin.html');
}
console.log('PASS notification update: reject stale worker, confirm active N2, version reply, safe timeout, fixed entry identities and clear app names');
