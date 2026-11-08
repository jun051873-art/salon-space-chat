const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync('profile-scene.js','utf8');
 const exit=source.slice(source.indexOf('async function exit()'),source.indexOf(" d.addEventListener('close'"));
 let ready,closed=0;const events=[];
 const ctx={q:()=>null,sheet:{hidden:true},saving:false,closed:false,editing:false,onBeforeClose:()=>new Promise(r=>{ready=r;events.push('prepare-return')}),d:{close:()=>{closed++;events.push('close')},classList:{add:()=>events.push('fade')}},setTimeout,feedback:()=>{},render:()=>{},setEditing:()=>{}};
 vm.createContext(ctx);vm.runInContext(exit,ctx);const job=ctx.exit();assert.equal(closed,0);await ctx.exit();assert.deepEqual(events,['prepare-return']);ready();await job;assert.equal(closed,1);assert.deepEqual(events,['prepare-return','close']);
 ctx.closed=false;ctx.onBeforeClose=()=>Promise.reject(Error('offline'));await ctx.exit();assert.equal(ctx.closed,false);assert.equal(closed,1);
 const html=fs.readFileSync('customer.html','utf8');const guard=html.slice(html.indexOf('function watchPageLoad('),html.indexOf('let pageGeneration=0;'));
 let timer,cleared=0,removed=0,shown=0;const actions={};const box={setAttribute(){},querySelector(s){return actions[s]??=( {} )},remove(){removed++}};
 const g={setTimeout(fn,ms){assert.equal(ms,12000);timer=fn;return 7},clearTimeout(id){assert.equal(id,7);cleared++},document:{getElementById(){return null},createElement(){return box},body:{append(){shown++}}},Promise,confirm:()=>false,location:{reload(){throw Error('unexpected reload')}}};vm.createContext(g);vm.runInContext(guard,g);
 let finish;g.watchPageLoad(new Promise(r=>finish=r),()=>true);timer();assert.equal(shown,1);actions['[data-reload]'].onclick();actions['[data-dismiss]'].onclick();assert.equal(removed,1);finish();await new Promise(r=>setImmediate(r));assert.equal(cleared,1);
 g.watchPageLoad(Promise.resolve(),()=>false);timer();assert.equal(shown,1);await new Promise(r=>setImmediate(r));assert.equal(cleared,2);
 console.log('PASS profile return order, repeated close, failed return retry; slow page recovery, cancellation, stale route and timer cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
