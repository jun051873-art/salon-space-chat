import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../cloudflare/worker-suite.js',import.meta.url),'utf8');
const env={FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test',FIREBASE_PRIVATE_KEY:'test'};
const root='https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents/',base='projects/test/databases/(default)/documents/';
const now=Date.now(),user={id:'c1',name:'客人',status:'active'},job={type:'appointmentReminder',userId:'c1',status:'queued',revision:'r1',date:'2027-01-30',time:'13:00',remindAt:now-1000,appointmentAt:now+1800000,appointmentDueAt:now-1000,text:'{姓名}，{預約日期} {預約時間} 預約提醒'};
const pack=v=>v===null?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(pack)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,pack(x)]))}};
function harness({record=job,customer=user,enabled=true,failPush=0,race=false,failCommit=false}={}){
 const docs=new Map(),pushes=[],calls=[];let tick=0,commitCalls=0;
 const put=(path,value)=>docs.set(path,{name:base+path,fields:pack(value).mapValue.fields,updateTime:'2026-10-27T00:00:'+String(++tick).padStart(2,'0')+'.000000Z'});
 put('users/c1',customer);put('announcements/settings',{name:'專屬空間',appointmentReminder:{enabled}});put('broadcasts/appointment_c1',record);
 const ctx=vm.createContext({Response,Request,URLSearchParams,AbortController,TextEncoder,Uint8Array,atob,btoa,setTimeout,clearTimeout,console,fetch:async(url,opt={})=>{
 const u=String(url),b=opt.body?JSON.parse(opt.body):null;calls.push(u);const ok=x=>Response.json(x),bad=status=>Response.json({error:{status}},{status:status==='NOT_FOUND'?404:409});
 if(u.endsWith(':runQuery')){const q=b.structuredQuery,field=q.orderBy[0].field.fieldPath,max=Number(q.where.compositeFilter.filters[1].fieldFilter.value.integerValue);return ok([...docs.values()].filter(d=>d.name.includes('/broadcasts/')&&Number(d.fields[field]?.integerValue)>0&&Number(d.fields[field]?.integerValue)<=max).sort((a,b)=>Number(a.fields[field].integerValue)-Number(b.fields[field].integerValue)).slice(0,q.limit).map(document=>({document})));}
 if(u.endsWith(':commit')){commitCalls++;if(failCommit)return bad('UNAVAILABLE');if(race){put('broadcasts/appointment_c1',{...record,status:'cancelled',appointmentDueAt:null});race=false;}
 for(const w of b.writes){assert(!('verify' in w),'use only documented REST v1 Write operations');const p=(w.verify||w.update.name).split('/documents/')[1],old=docs.get(p);if(w.currentDocument?.updateTime&&old?.updateTime!==w.currentDocument.updateTime)return bad('FAILED_PRECONDITION');if(w.currentDocument?.exists===false&&old)return bad('ALREADY_EXISTS');}
 for(const w of b.writes){if(w.verify)continue;const p=w.update.name.split('/documents/')[1],old=docs.get(p);const fields=w.updateMask?{...old?.fields,...w.update.fields}:w.update.fields;docs.set(p,{name:w.update.name,fields,updateTime:'v'+(++tick)});}return ok({});}
 if(u.includes('messages:send')){if(failPush-->0)return bad('UNAVAILABLE');pushes.push(b.message);return ok({name:'accepted'});}
 if(u.includes('/devices?'))return ok({documents:[{fields:{token:pack(u.includes('/c1/')?'customer-token':'owner-token')}}]});
 if(u.includes('/pushTokens/'))return bad('NOT_FOUND');
 if(u.startsWith(root)){const p=u.slice(root.length).split('?')[0];if(opt.method==='PATCH'){const old=docs.get(p),qs=new URL(u).searchParams,version=qs.get('currentDocument.updateTime');if(version&&old?.updateTime!==version)return bad('FAILED_PRECONDITION');const fields={...old?.fields,...b.fields};const result={name:base+p,fields,updateTime:'v'+(++tick)};docs.set(p,result);return ok(result);}return docs.has(p)?ok(docs.get(p)):bad('NOT_FOUND');}
 throw Error('unexpected '+u);
 }});
 vm.runInContext(source.replace('export default {','const worker = {')+'\noauthCache={key:"test:test",token:"test",until:Date.now()+3600000};globalThis.api={appointmentDue,appointmentCopy,processAppointment,pushAppointment,runAppointments,runScheduledReminders,fieldsOf};',ctx);
 return {api:ctx.api,ctx,docs,pushes,calls,put,get commitCalls(){return commitCalls},getJob:()=>ctx.api.fieldsOf(docs.get('broadcasts/appointment_c1')),messages:()=>[...docs.keys()].filter(p=>p.includes('/messages/'))};
}
const h=harness();await h.api.processAppointment(env,root,'test',h.docs.get('broadcasts/appointment_c1'),now);assert.equal(h.getJob().status,'sent');assert.equal(h.messages().length,1);assert.equal(h.getJob().appointmentDueAt,null);
await h.api.processAppointment(env,root,'test',h.docs.get('broadcasts/appointment_c1'),now);assert.equal(h.messages().length,1,'repeated cron cannot duplicate message');
await h.api.pushAppointment(env,root,'test',h.docs.get('broadcasts/appointment_c1'),now);assert.equal(h.pushes.length,1);assert.equal(h.pushes[0].token,'customer-token');assert.equal(h.getJob().pushStatus,'accepted');
await h.api.pushAppointment(env,root,'test',h.docs.get('broadcasts/appointment_c1'),now);assert.equal(h.pushes.length,1);
for(const [label,record,customer,enabled,expected] of [
 ['draft',{...job,status:'draft'},user,true,'draft'],['cancelled',{...job,status:'cancelled'},user,true,'cancelled'],['future',{...job,remindAt:now+60000},user,true,'queued'],['blocked',job,{...user,status:'blocked'},true,'excluded'],['merged',job,{...user,adminMergedInto:'other'},true,'excluded'],['deleted',job,{...user,adminDeleted:true},true,'excluded'],['opt out',job,{...user,marketingOptIn:false},true,'excluded'],['disabled',job,user,false,'paused'],['late',{...job,remindAt:now-360000},user,true,'expired'],['past',{...job,appointmentAt:now-100,remindAt:now-60000},user,true,'expired']]){
 const x=harness({record,customer,enabled});await x.api.processAppointment(env,root,'test',x.docs.get('broadcasts/appointment_c1'),now);assert.equal(x.messages().length,0,label);assert.equal(x.getJob().status,expected,label);
}
const race=harness({race:true});await race.api.processAppointment(env,root,'test',race.docs.get('broadcasts/appointment_c1'),now);assert.equal(race.messages().length,0);assert.equal(race.getJob().status,'cancelled');
const failure=harness({failCommit:true});await assert.rejects(()=>failure.api.processAppointment(env,root,'test',failure.docs.get('broadcasts/appointment_c1'),now));assert.equal(failure.getJob().status,'queued');assert.equal(failure.messages().length,0);
const retry=harness({failPush:1});await retry.api.processAppointment(env,root,'test',retry.docs.get('broadcasts/appointment_c1'),now);await retry.api.pushAppointment(env,root,'test',retry.docs.get('broadcasts/appointment_c1'),now);assert.equal(retry.getJob().pushStatus,'retry');assert.equal(retry.messages().length,1);await retry.api.pushAppointment(env,root,'test',retry.docs.get('broadcasts/appointment_c1'),now+61000);assert.equal(retry.getJob().pushStatus,'accepted');assert.equal(retry.pushes.length,1);assert.equal(retry.messages().length,1);
const full=harness();await full.api.runAppointments(env,'* * * * *');assert.equal(full.messages().length,1);assert.equal(full.pushes.length,1);assert.equal(full.api.fieldsOf(full.docs.get('broadcasts/_runtime')).appointmentCron,'* * * * *');assert(!full.calls.some(u=>u.includes('users?pageSize')),'minute jobs must not scan customer collection');
const schedule=harness();vm.runInContext('globalThis.runs=[];runAppointments=async()=>runs.push("appointment");runCare=async()=>runs.push("care");',schedule.ctx);await schedule.api.runScheduledReminders(env,{scheduledTime:Date.parse('2026-10-27T10:00:00+08:00'),cron:'* * * * *'});assert.deepEqual([...schedule.ctx.runs],['appointment','care']);schedule.ctx.runs.length=0;await schedule.api.runScheduledReminders(env,{scheduledTime:Date.parse('2026-10-27T10:01:00+08:00'),cron:'* * * * *'});assert.deepEqual([...schedule.ctx.runs],['appointment']);
console.log('PASS combined worker: atomic queue/send, cancellation race, duplicate cron, failure retry, isolated recipients, draft/off/blocked exclusions, late expiry, push retry, minute queries and hourly care');
