import fs from 'node:fs';import assert from 'node:assert/strict';
const {createPagedFeed}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../chat-feed.js',import.meta.url))).toString('base64'));
const doc=(n,t=n)=>({id:String(n).padStart(4,'0'),data:()=>({createdAt:{seconds:t,nanoseconds:0}}),metadata:{hasPendingWrites:false}});
let source=Array.from({length:100},(_,i)=>doc(100-i)),next,error,active=0,starts=0,reads=0,state,resolvePage;
const snapshot=docs=>({docs,metadata:{fromCache:false}});
const feed=createPagedFeed({field:'createdAt',subscribe:(n,e)=>{next=n;error=e;starts++;active++;return()=>active--;},fetchPage:async c=>{reads++;return snapshot(source.filter(d=>d.data().createdAt.seconds<c.data().createdAt.seconds).slice(0,30));},onChange:s=>state=s,onError:e=>{throw e}});
feed.start();feed.start();assert.equal(active,1);assert.equal(starts,1);next(snapshot(source.slice(0,30)));assert.equal(state.docs.length,30);assert.equal(state.more,true);assert.equal(reads,0);
await Promise.all([feed.loadMore(),feed.loadMore()]);assert.equal(reads,1);assert.equal(state.docs.length,60);assert.equal(state.docs.at(-1).id,'0041');
source.unshift(doc(101));next(snapshot(source.slice(0,30)));assert.equal(state.docs.length,61);assert.equal(new Set(state.docs.map(d=>d.id)).size,61);
await feed.loadMore();await feed.loadMore();assert.equal(state.docs.length,101);assert.equal(state.more,false);await feed.loadMore();assert.equal(reads,3);
// Actual deletion within live window must disappear; evicted history must remain.
source=source.filter(d=>d.id!=='0099');next(snapshot(source.slice(0,30)));assert.ok(!state.docs.some(d=>d.id==='0099'));assert.ok(state.docs.some(d=>d.id==='0001'));
feed.pause();assert.equal(active,0);const stale=next;feed.start();assert.equal(active,1);stale(snapshot([]));assert.equal(state.docs.length,100);
// More than one window arriving while disconnected resets to latest; history is paged without a silent gap.
source=Array.from({length:150},(_,i)=>doc(150-i));next(snapshot(source.slice(0,30)));assert.equal(state.docs.length,30);assert.equal(state.more,true);await feed.loadMore();assert.equal(state.docs.length,60);assert.equal(state.docs.at(-1).id,'0091');
feed.destroy();assert.equal(active,0);next(snapshot(source));assert.equal(feed.entries().length,0);
// Equal timestamps: snapshot cursor, deterministic document ID order, no timestamp-only paging.
let tied;const f=createPagedFeed({field:'createdAt',subscribe:n=>{tied=n;return()=>{}},fetchPage:async()=>snapshot([]),onChange:s=>state=s,onError:e=>{throw e}});f.start();tied(snapshot([doc(2,1),doc(1,1)]));assert.deepEqual(state.docs.map(d=>d.id),['0002','0001']);f.destroy();
console.log('PASS: 30-document live window, single listener, explicit 30-document pages, concurrent click suppression, new-message eviction retention, deletion, equal timestamps, stop/stale-callback isolation, reconnect gap recovery.');
