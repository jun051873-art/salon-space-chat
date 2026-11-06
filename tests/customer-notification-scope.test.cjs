const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync('customer-notification-worker.js','utf8').replace(/^import .*\n/,'').replaceAll('export ','');
const ctx={URL};vm.createContext(ctx);vm.runInContext(code,ctx);
function env({android=true,build=9,owner=false,mode='customer',broken=false}={}){return {location:{href:`https://jun051873-art.github.io/salon-space-chat/customer.html?appBuild=${build}#chat`},navigator:{userAgent:android?'Android':'iPhone'},localStorage:{getItem:()=>mode},caches:{open:async()=>{if(broken)throw Error('unavailable');return {match:async()=>({json:async()=>({ownerDevice:owner})})}}}};}
(async()=>{
 const options=await ctx.customerWorkerOptions(env());
 assert.equal(options.scope,'https://jun051873-art.github.io/salon-space-chat/customer.html');
 assert.equal(new URL(options.scope).pathname,'/salon-space-chat/customer.html');
 assert(!new URL('https://jun051873-art.github.io/salon-space-chat/admin.html').href.startsWith(options.scope));
 for(const input of [{android:false},{owner:true},{mode:'admin'},{broken:true}])assert.equal(await ctx.customerWorkerOptions(env(input)),null);
 for(const build of [0,8,9,14])assert.equal((await ctx.customerWorkerOptions(env({build}))).scope,options.scope);
 // Multiple callers must share registration, and failed registrations must retry.
 let calls=0;ctx.globalThis=env();ctx.navigator={serviceWorker:{register:async(script,opts)=>{calls++;assert.equal(script,'./firebase-messaging-sw.js');assert.equal(opts.scope,options.scope);return {update:async()=>{}}}}};ctx.waitForNotificationVersion=async r=>r;ctx.sharedWorker=async()=>({shared:true});
 const results=await Promise.all([ctx.ensureNotificationWorker(),ctx.ensureNotificationWorker()]);assert.equal(calls,1);assert.equal(results[0],results[1]);
 ctx.globalThis=env({owner:true});assert.equal((await ctx.ensureNotificationWorker()).shared,true);assert.equal(calls,1);
 const html=fs.readFileSync('customer.html','utf8');
 const early=html.match(/<script>(if\(new URL[\s\S]*?)<\/script>/)[1];
 for(const suffix of ['?openChat=1','#chat']){const u=new URL('https://example.test/customer.html'+suffix),c={URL,location:u,document:{documentElement:{dataset:{}}}};vm.runInNewContext(early,c);assert.equal(c.document.documentElement.dataset.notificationChat,'pending');}
 assert(html.includes("if(profileReady&&document.documentElement.dataset.notificationChat==='pending')id='chat'"));
 assert(html.includes("delete document.documentElement.dataset.notificationChat"));
 console.log('PASS customer scope matches APK; Android web/APK share one scope; iOS/admin untouched; concurrent sync; notification entry gate');
})().catch(e=>{console.error(e);process.exit(1)});
