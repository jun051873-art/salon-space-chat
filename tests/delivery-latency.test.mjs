import fs from 'node:fs';import assert from 'node:assert/strict';
const {createDelivery}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('chat-delivery.js','utf8')).toString('base64'));
class Storage{m=new Map();get length(){return this.m.size}key(i){return [...this.m.keys()][i]}getItem(k){return this.m.get(k)??null}setItem(k,v){this.m.set(k,v)}removeItem(k){this.m.delete(k)}}
const tick=()=>new Promise(r=>setTimeout(r,20));
for(const role of ['admin','customer']){
 let releases=[],writes=[],active=0,peak=0;
 const d=createDelivery({auth:{currentUser:{uid:'test',getIdToken:async()=> 'token'}},projectId:'test',role,storage:new Storage(),request:async(u,o)=>{writes.push(JSON.parse(o.body).writes[0].update.fields.text.stringValue);return {ok:true,json:async()=>({})}},notify:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>releases.push(r));active--;}});
 d.enqueueMany([1,2,3].map(i=>({room:'test',senderId:'test',id:'test_'+i,text:'message '+i})));
 await tick();assert.deepEqual(writes,['message 1','message 2','message 3'],'all writes must complete while every push is still pending');assert(d.entries().every(e=>e.stage==='stored'));
 d.enqueue({room:'test',senderId:'test',text:'immediate new chat'});await tick();assert.equal(writes.at(-1),'immediate new chat','new chat must not wait for pending pushes');
 for(let i=4;i<15;i++)d.enqueue({room:'test',senderId:'test',text:'more '+i});await tick();assert.equal(writes.length,15);assert(peak<=4,'bounded notifications');
 while(d.entries().some(e=>e.stage!=='done')){releases.splice(0).forEach(r=>r());await tick();}
 d.stop();console.log('PASS '+role+': blocked push never delays subsequent photos/text or newly queued messages; push concurrency <=4');
}
