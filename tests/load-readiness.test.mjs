// Offline mocks only. No production database writes or notifications.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {createDelivery}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('chat-delivery.js','utf8')).toString('base64'));
class Storage{m=new Map();peak=0;budget=5*1024*1024;get length(){return this.m.size}key(i){return [...this.m.keys()][i]}getItem(k){return this.m.get(k)??null}setItem(k,v){const bytes=[...this.m].reduce((n,[a,b])=>n+2*(a.length+b.length),0)-2*(k.length+(this.m.get(k)?.length||0))+2*(k.length+v.length);if(bytes>this.budget)throw Error('quota full');this.m.set(k,v);this.peak=Math.max(this.peak,bytes)}removeItem(k){this.m.delete(k)}}
const response=(status,body={})=>({status,ok:status<300,json:async()=>body});const auth={currentUser:{uid:'owner',getIdToken:async()=> 'test'}};
for(const people of [100,200,300,400]){
 const storage=new Storage(),server=new Map();let online=false,lost=true,commits=0,pushes=0,renderTicks=0;
 const request=async(url,opt)=>{if(!online)throw Error('offline');if(url.endsWith(':commit')){const writes=JSON.parse(opt.body).writes,doc=writes[0].update;assert(!server.has(doc.name),'duplicate write');server.set(doc.name,doc);commits++;if(writes.length===3)assert.equal(writes[2].update.fields.data.stringValue.length,400023);if(lost){lost=false;throw Error('response lost');}return response(200);}const doc=server.get(url.replace('https://firestore.googleapis.com/v1/',''));return doc?response(200,doc):response(404,{error:{status:'NOT_FOUND'}});};
 const make=()=>createDelivery({auth,projectId:'load',role:'admin',storage,request,notify:async()=>{pushes++;},onChange:()=>renderTicks++});
 let d=make();const photo={name:'photo.jpg',type:'image/jpeg',size:300000,data:'data:image/jpeg;base64,'+'A'.repeat(400000)+'='};
 const blocks=[{...photo,type:'photo'},{...photo,type:'photo',data:photo.data.replaceAll('A','B')},{type:'text',text:'campaign text'}],draftKey='salon-broadcast-draft:owner';
 storage.setItem(draftKey,JSON.stringify(blocks)); // Existing legacy draft, including both full photos.
 d.saveDraft(draftKey,blocks);assert.equal(d.readDraft(draftKey)[1].data,blocks[1].data);
 const jobs=Array.from({length:people},(_,i)=>blocks.map((b,j)=>({room:'u'+i,senderId:'owner',id:'b_test_u'+i+'_'+j,text:b.text||'photo',attachment:b.type==='photo'?{...b,type:'image/jpeg'}:null}))).flat();
 d.enqueueMany(jobs);storage.removeItem(draftKey);await d.flush();await new Promise(r=>setTimeout(r,10));d.stop();assert.equal(d.entries().length,people*3);assert.equal([...storage.m.keys()].filter(k=>k.includes(':asset:')).length,2);assert(storage.peak<5*1024*1024);
 // Closing/reopening plus lost-response retry. Advance retry deadlines only in the fixture.
 for(const [k,v]of storage.m)if(!k.includes(':asset:')){const e=JSON.parse(v);e.nextAt=0;storage.setItem(k,JSON.stringify(e));}
 online=true;d=make();for(let attempt=0;attempt<4;attempt++){for(const [k,v]of storage.m)if(!k.includes(':asset:')){const e=JSON.parse(v);e.nextAt=0;storage.setItem(k,JSON.stringify(e));}await d.flush();}
 for(let wait=0;wait<200&&!d.entries().every(e=>e.stage==='done');wait++)await new Promise(r=>setTimeout(r,5));
 assert.equal(commits,people*3);assert.equal(pushes,people*3);assert(d.entries().every(e=>e.stage==='done'));assert(![...storage.m.keys()].some(k=>k.includes(':asset:')));d.acknowledge(jobs.map(e=>e.id));assert.equal(d.entries().length,people*3,'report accounting survives viewing a chat');d.stop();
 console.log(`PASS ${people} recipients: ${commits} unique commits, ${pushes} mock notifications, offline/reopen/lost-response retry; peak local queue ${(storage.peak/1048576).toFixed(2)} MiB`);
}
const storage=new Storage();storage.budget=10000;let requests=0;const d=createDelivery({auth,projectId:'quota',role:'admin',storage,request:async()=>{requests++;return response(200)},notify:async()=>{}});
assert.throws(()=>d.enqueueMany(Array.from({length:300},(_,i)=>({id:'b_q_'+i,room:'u'+i,senderId:'owner',text:'test'}))),/quota/);await new Promise(r=>setTimeout(r,0));assert.equal(requests,0);assert.equal(storage.length,0);d.stop();console.log('PASS quota failure rolls back the entire new batch before any network send');
