const {JSDOM}=require('jsdom');
const fs=require('fs'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..')+'/';
const bridge=fs.readFileSync(root+'native-push-bridge.js','utf8').replaceAll('export ','').replace(/const nativePushBridge=typeof window[^;]+;/,'');
const help=fs.readFileSync(root+'notification-help.js','utf8').replaceAll('export ','');
const page=fs.readFileSync(root+'customer.html','utf8');
const sync=page.slice(page.indexOf('async function performPushSync(){'),page.indexOf("window.addEventListener('salon:resume'"));
(async()=>{
 for(let i=0;i<100;i++){
 const denied=i%3===0,blocked=i%5===0,saveFails=i%7===0;
 const dom=new JSDOM('<body><header id="customerHeader"></header><main id="inbox"></main><div id="notifyBox"></div><p id="notifyStatus"></p>',{url:'https://jun051873-art.github.io/salon-space-chat/customer.html?appBuild=15',runScripts:'outside-only'});
 const w=dom.window;w.Notification={permission:denied?'denied':'default'};w.matchMedia=()=>({matches:true});w.saved=[];w.cloud=[];w.blocked=blocked;w.saveFails=saveFails;
 w.eval(bridge+'\n'+help+`\nconst $=id=>document.getElementById(id);const uid='customer';const nativePushBridge=createNativePushBridge(window);const notificationHelp=mountNotificationHelp($('inbox'),()=>{},'customer');const customerPushRegistration=(uid,token)=>({path:'pushTokens/'+uid+'/devices/device',values:{token,uid}});async function savePushToken(path,values){if(window.saveFails)throw Error('雲端拒絕儲存');window.cloud.push({path,values});}\n`+sync+'\nwindow.runSync=performPushSync;');
 const {port1,port2}=new MessageChannel();
 port1.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='REGISTER')port1.postMessage(JSON.stringify({protocol:'SALON_NATIVE_PUSH',type:'TOKEN',uid:d.uid,value:'n'.repeat(100),allowed:!blocked}));else w.saved.push(d.type);};
 w.dispatchEvent(new w.MessageEvent('message',{data:'',origin:w.location.origin,ports:[port2]}));
 port1.postMessage(JSON.stringify({protocol:'SALON_NATIVE_PUSH',type:'HELLO'}));
 const ok=await w.runSync();await new Promise(r=>setTimeout(r,20));
 assert.equal(ok,!blocked&&!saveFails);assert.equal(w.document.body.dataset.notificationReady,String(ok));assert.equal(w.saved.includes('SAVED'),ok);if(ok){assert.equal(w.cloud[0].values.client,'android-native');assert(w.document.getElementById('notifyBox').classList.contains('hidden'));}else assert.match(w.document.getElementById('notifyStatus').textContent,/尚未設定完成/);
 port1.close();port2.close();w.close();
 }
 console.log('PASS 100 registration integration cases: actual MessageChannel + customer performPushSync + UI + simulated cloud success/failure + native permission; no production writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
