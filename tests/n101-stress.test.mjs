// 500 independent offline simulations, both roles every round. No real push or production writes.
import fs from 'node:fs';import assert from 'node:assert/strict';
const load=async f=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(f,'utf8')).toString('base64'));
const {createDelivery}=await load('chat-delivery.js'),{createPagedFeed}=await load('chat-feed.js'),{filterDesignerRooms}=await load('admin-designers.js');
class Storage{m=new Map();get length(){return this.m.size}key(i){return [...this.m.keys()][i]}getItem(k){return this.m.get(k)??null}setItem(k,v){this.m.set(k,v)}removeItem(k){this.m.delete(k)}}
let totalWrites=0,totalPushes=0;const began=Date.now();
for(let round=0;round<500;round++){
 for(const role of ['admin','customer']){
 let online=false,lost=true;const server=new Map(),storage=new Storage();let pushes=0;
 const d=createDelivery({role,projectId:'simulation',storage,auth:{currentUser:{uid:role,getIdToken:async()=> 'token'}},request:async(url,opt)=>{
 if(!online)throw Error('offline');if(url.endsWith(':commit')){const doc=JSON.parse(opt.body).writes[0].update;assert(!server.has(doc.name),'duplicate message');server.set(doc.name,doc);totalWrites++;if(lost){lost=false;throw Error('lost commit acknowledgement');}return {ok:true,status:200,json:async()=>({})};}
 const doc=server.get(url.replace('https://firestore.googleapis.com/v1/',''));return {ok:!!doc,status:doc?200:404,json:async()=>doc||{error:{status:'NOT_FOUND'}}};},notify:async()=>{pushes++;totalPushes++;}});
 d.enqueueMany(Array.from({length:3},(_,i)=>({id:`r${round}_${role}_${i}`,room:'customer',senderId:role,text:'訊息 '+i})));await d.flush();online=true;
 for(let attempt=0;attempt<6&&!d.entries().every(e=>e.stage==='done');attempt++){
 for(const [k,v]of storage.m){if(k.includes(':asset:'))continue;const e=JSON.parse(v);e.nextAt=0;storage.setItem(k,JSON.stringify(e));}await d.flush();await new Promise(r=>setTimeout(r,0));
 }
 assert(d.entries().every(e=>e.stage==='done'),`${round} ${role} unfinished`);assert.equal(server.size,3);assert.equal(pushes,3);d.stop();
 }
 let next,state,active=0;const docs=Array.from({length:90},(_,i)=>({id:String(i),data:()=>({updatedAt:{seconds:100-i},lastCustomerMessageAt:(100-i)*1000,assignedDesignerId:i%2?'nana':''})}));
 const feed=createPagedFeed({field:'updatedAt',subscribe:n=>{next=n;active++;return()=>active--},fetchPage:async c=>({docs:docs.slice(docs.indexOf(c)+1,docs.indexOf(c)+31)}),onChange:s=>state=s,onError:e=>{throw e}});
 feed.start();feed.start();assert.equal(active,1);next({docs:docs.slice(0,30),metadata:{fromCache:false}});await Promise.all([feed.loadMore(),feed.loadMore()]);await feed.loadMore();await feed.loadMore();assert.equal(state.docs.length,90);
 const newest={id:'new',data:()=>({updatedAt:{seconds:200},lastCustomerMessageAt:200000,assignedDesignerId:'nana'})};next({docs:[newest,...docs.slice(0,29)],metadata:{fromCache:false}});
 const rows=state.docs.map(d=>({id:d.id,...d.data()}));assert.equal(filterDesignerRooms(rows,'nana')[0].id,'new');assert.equal(filterDesignerRooms(rows)[0].id,'new');assert(filterDesignerRooms(rows,'').every(r=>!r.assignedDesignerId));
 feed.destroy();next({docs:[],metadata:{fromCache:false}});assert.equal(active,0);assert.equal(feed.entries().length,0);
}
console.log(JSON.stringify({result:'PASS',rounds:500,rolesPerRound:2,uniqueMockWrites:totalWrites,mockPushes:totalPushes,feedRounds:500,elapsedMs:Date.now()-began,scope:'offline simulations only; not real-device latency or production load'}));
