const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const html=fs.readFileSync('customer.html','utf8'),handlers={},swHandlers={},pages=[];
 const ctx={uid:undefined,profileReady:false,location:{hash:''},history:{replaceState:(_,__,hash)=>ctx.location.hash=hash},showCustomerPage:p=>pages.push(p),window:{addEventListener:(n,f)=>handlers[n]=f},navigator:{serviceWorker:{addEventListener:(n,f)=>swHandlers[n]=f}}};
 vm.runInNewContext(html.slice(html.indexOf('function restoreNotificationRoute()'),html.indexOf('$("chatShortcuts").onclick')),ctx);
 swHandlers.message({data:{type:'OPEN_NOTIFICATION_URL'}});assert.equal(ctx.location.hash,'#chat');assert.equal(pages.length,0,'not accessible before auth');
 ctx.uid='test';ctx.profileReady=true;handlers.hashchange();assert.deepEqual(pages,['chat']);
 ctx.location.hash='';handlers.hashchange();assert.equal(pages.at(-1),'inbox');handlers['salon:open-notification']();assert.equal(pages.at(-1),'chat');
 const sw=fs.readFileSync('firebase-messaging-sw.js','utf8'),events={},calls=[];let pending;
 const origin='https://example.test',url=origin+'/salon-space-chat/customer.html#chat';
 const client={url:origin+'/salon-space-chat/customer.html',navigate:async dest=>{calls.push(['navigate',dest]);return client},postMessage:m=>calls.push(['message',m.url]),focus:async()=>calls.push(['focus'])};
 const sc={URL,self:{location:{origin},navigator:{userAgent:'iPhone'},addEventListener:(n,f)=>events[n]=f,clients:{matchAll:async()=>[client],openWindow:async u=>calls.push(['open',u])}},SalonPush:{destination:()=>new URL(url)}};
 vm.runInNewContext(sw.slice(sw.indexOf("self.addEventListener('notificationclick'"),sw.indexOf('importScripts("https:')),sc);
 const click=()=>events.notificationclick({notification:{close(){},data:{url}},stopImmediatePropagation(){},waitUntil:p=>pending=p});click();await pending;assert.deepEqual(calls,[['navigate',url],['message',url],['focus']]);
 calls.length=0;client.navigate=async()=>{throw Error('unavailable')};click();await pending;assert.deepEqual(calls,[['message',url],['focus']]);
 calls.length=0;sc.self.clients.matchAll=async()=>[];click();await pending;assert.deepEqual(calls,[['open',url]]);
 console.log('PASS notification route: loading auth retains intent, hash resume, iPhone existing-window URL, navigation fallback, cold launch');
})().catch(e=>{console.error(e);process.exit(1)});
