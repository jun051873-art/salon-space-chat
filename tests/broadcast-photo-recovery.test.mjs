import fs from 'node:fs';import assert from 'node:assert/strict';
const {createDelivery}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('chat-delivery.js','utf8')).toString('base64'));
class Storage {m=new Map();get length(){return this.m.size}key(i){return [...this.m.keys()][i]}getItem(k){return this.m.get(k)??null}setItem(k,v){this.m.set(k,v)}removeItem(k){this.m.delete(k)}}
const storage=new Storage(),auth={currentUser:{uid:'owner',getIdToken:async()=> 'test'}},prefix='salon-outbox-v3:test:admin:',server=new Map(),files=new Map();
const large='data:image/jpeg;base64,'+'A'.repeat(600000),small='data:image/jpeg;base64,'+'B'.repeat(300000),fixed='data:image/jpeg;base64,'+'C'.repeat(399976);
const asset=prefix+'asset:owner:old';storage.setItem(asset,large);let resized=0,pushes=0;
for(const room of ['one','two'])for(const [i,attachment]of [{name:'A.jpg',type:'image/jpeg',size:450000,assetKey:asset},{name:'B.jpg',type:'image/jpeg',size:225000,data:small},null].entries()){
 const e={id:`b_recover_${room}_${i}`,room,senderId:'owner',role:'admin',text:i===2?'text':'photo',attachment,at:i,stage:'queued',commitStarted:true,attempts:1,error:'Missing or insufficient permissions',nextAt:Date.now()+900000};storage.setItem(prefix+'owner:'+e.id,JSON.stringify(e));
}
const ok=(status,body)=>({ok:status<300,status,json:async()=>body});
const d=createDelivery({auth,projectId:'test',role:'admin',storage,prepareImage:async data=>{assert.equal(data,large);resized++;return fixed},notify:async()=>{pushes++;throw Error('No notification device')},request:async(url,opt)=>{
 if(!url.endsWith(':commit')){const doc=server.get(url.split('/messages/')[1]);return doc?ok(200,doc):ok(404,{error:{status:'NOT_FOUND'}})}
 const writes=JSON.parse(opt.body).writes,id=writes[0].update.name.split('/').at(-1),file=writes[2]?.update.fields.data.stringValue;
 if(file&&file.length>420000)return ok(403,{error:{status:'PERMISSION_DENIED'}});
 assert(!server.has(id),'do not duplicate already stored messages');server.set(id,writes[0].update);if(file)files.set(id,file);return ok(200,{});
}});
await d.flush();assert.equal(resized,1,'shared oversized photo repaired once');
// Retry the remaining old failures on the original IDs, as the UI does.
d.retryFailed(d.entries().filter(e=>e.stage==='queued').map(e=>e.id));await new Promise(r=>setTimeout(r,30));await d.flush();d.stop();
assert.equal(server.size,6);assert.equal(files.size,4);for(const room of ['one','two']){assert.equal(files.get(`b_recover_${room}_0`),fixed);assert.equal(files.get(`b_recover_${room}_1`),small)}
assert(d.entries().every(e=>['stored','notify-error'].includes(e.stage)));assert.equal(pushes,6);assert.equal(resized,1);
console.log('PASS legacy oversize recovery: 2 different photos + text × 2 recipients; original IDs, shared repair once, push failure does not lose either image');
