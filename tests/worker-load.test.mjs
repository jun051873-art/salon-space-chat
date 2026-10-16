import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('cloudflare/worker-suite.js','utf8'),root='https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents/',env={FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test',FIREBASE_PRIVATE_KEY:'test'};
const pack=x=>typeof x==='string'?{stringValue:x}:typeof x==='boolean'?{booleanValue:x}:typeof x==='number'?{integerValue:String(x)}:Array.isArray(x)?{arrayValue:{values:x.map(pack)}}:{mapValue:{fields:Object.fromEntries(Object.entries(x).map(([k,v])=>[k,pack(v)]))}};
const doc=x=>({fields:pack(x).mapValue.fields});const saved=new Map(),jobs=new Map(),pushes=[];
const context=vm.createContext({Response,Request,URLSearchParams,AbortController,TextEncoder,Uint8Array,atob,btoa,setTimeout,clearTimeout,console,fetch:async(url,opt={})=>{const u=String(url),body=opt.body?JSON.parse(opt.body):{},ok=x=>Response.json(x),missing=()=>Response.json({error:{status:'NOT_FOUND'}},{status:404});
 if(u.includes('accounts:lookup'))return ok({users:[{localId:body.idToken}]});
 if(u===root+'announcements/settings')return ok(doc({keywordRepliesEnabled:true,quickReplies:[{title:'預約',answer:'請留下方便的時間'}]}));
 if(u.startsWith(root+'users/'))return ok(doc({name:'測試',status:u.includes('/pending')?'pending':u.includes('/blocked')?'blocked':'active'}));
 if(u.includes('/notificationJobs/')){const key=u.split('?')[0];if(!opt.method)return jobs.has(key)?ok({...jobs.get(key),updateTime:'2026-01-01T00:00:00Z'}):missing();if(u.includes('exists=false')&&jobs.has(key))return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});jobs.set(key,body);return ok(body);}
 if(u.includes('/devices?'))return ok({documents:[doc({token:u.split('/pushTokens/')[1].split('/')[0]})]});
 if(u.includes('/pushTokens/'))return missing();
 if(u.endsWith(':commit')){const key=body.writes[0].update.name;if(saved.has(key))return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});saved.set(key,body.writes);return ok({});}
 if(u.includes('messages:send')){pushes.push(body.message);return ok({name:'accepted'});}
 throw Error('Unexpected mock URL '+u);
}});
vm.runInContext(source.replace('export default {','const worker={')+'\noauthCache={key:"test:test",token:"test",until:Date.now()+3600000};globalThis.api={worker,automaticReply,notifyNewCustomer};',context);
for(const n of [200,300]){saved.clear();pushes.length=0;const work=Array.from({length:n},(_,i)=>context.api.automaticReply(env,root,'test','u'+i,'source','預約'));await Promise.all(work);assert.equal(saved.size,n);assert.equal(pushes.length,n);assert.equal(new Set(pushes.map(p=>p.token)).size,n);await Promise.all(Array.from({length:n},(_,i)=>context.api.automaticReply(env,root,'test','u'+i,'source','預約')));assert.equal(pushes.length,n);console.log(`PASS ${n} concurrent mocked auto-replies: isolated recipients, duplicate delivery suppressed`);}
pushes.length=0;await Promise.all(Array.from({length:10},()=>context.api.notifyNewCustomer(env,'pending1')));assert.equal(pushes.length,1);await context.api.notifyNewCustomer(env,'pending1');assert.equal(pushes.length,1);assert.match(pushes[0].data.url,/view=approvals/);
const denied=await context.api.worker.fetch(new Request('https://worker/',{method:'POST',headers:{Authorization:'Bearer pending1'},body:JSON.stringify({action:'customer-joined',customerUid:'pending2'})}),env,{});assert.equal(denied.status,403);await context.api.notifyNewCustomer(env,'active1');assert.equal(pushes.length,1);console.log('PASS new-customer alert: pending-only, authenticated self-only, concurrent dedup and review destination');
