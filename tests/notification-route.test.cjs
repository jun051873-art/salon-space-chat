const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const html=fs.readFileSync('customer.html','utf8'),handlers={},swHandlers={},pages=[];
 const ctx={resumeVisibleReads(){},uid:undefined,profileReady:false,location:{hash:''},history:{replaceState:(_,__,hash)=>ctx.location.hash=hash},showCustomerPage:p=>pages.push(p),window:{addEventListener:(n,f)=>handlers[n]=f},navigator:{serviceWorker:{addEventListener:(n,f)=>swHandlers[n]=f}}};
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
 calls.length=0;client.url=url;click();await pending;assert.deepEqual(calls,[['message',url],['focus']],'existing chat wakes without reload');client.url=origin+'/salon-space-chat/customer.html';
 calls.length=0;client.navigate=async()=>{throw Error('unavailable')};click();await pending;assert.deepEqual(calls,[['message',url],['focus']]);
 calls.length=0;sc.self.clients.matchAll=async()=>[];click();await pending;assert.deepEqual(calls,[['open',url]]);
 console.log('PASS notification route: loading auth retains intent, hash resume, iPhone existing-window URL, navigation fallback, cold launch');
})().catch(e=>{console.error(e);process.exit(1)});
// Resume must replace a potentially frozen subscription while preserving the view.
{
 const html=fs.readFileSync('customer.html','utf8');let pauses=0,starts=0,now=5000,hidden=false;
 const ctx={Date:{now:()=>now},currentChatView:{feed:{pause(){pauses++},start(){starts++}}},$:id=>id==='chat'?{classList:{contains:()=>hidden}}:{textContent:''}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('let lastReadRecovery='),html.indexOf('let backgroundReadTimer=')),ctx);
 ctx.resumeVisibleReads();ctx.resumeVisibleReads();assert.equal(pauses,1);assert.equal(starts,2);
 ctx.resumeVisibleReads(true);assert.equal(pauses,2,'notification forces fresh subscription even after visibility event');
 hidden=true;now+=5000;ctx.resumeVisibleReads();assert.equal(pauses,2,'hidden chat must not subscribe');
 hidden=false;ctx.resumeVisibleReads();assert.equal(pauses,3,'later wake replaces stalled subscription');
}
