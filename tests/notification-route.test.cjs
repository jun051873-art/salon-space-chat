const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const html=fs.readFileSync('customer.html','utf8'),handlers={},swHandlers={},pages=[];
 const ctx={document:{documentElement:{dataset:{}},body:{dataset:{}}},resumeVisibleReads(){},uid:undefined,profileReady:false,location:{hash:''},history:{replaceState:(_,__,hash)=>ctx.location.hash=hash},showCustomerPage:p=>pages.push(p),window:{addEventListener:(n,f)=>handlers[n]=f},navigator:{serviceWorker:{addEventListener:(n,f)=>swHandlers[n]=f}}};
 vm.runInNewContext(html.slice(html.indexOf('function restoreNotificationRoute()'),html.indexOf('$("chatShortcuts").onclick')),ctx);
 swHandlers.message({data:{type:'OPEN_NOTIFICATION_URL'}});assert.equal(ctx.location.hash,'#chat');assert.equal(ctx.document.documentElement.dataset.notificationChat,'pending');assert.equal(pages.length,0,'not accessible before auth');
 ctx.uid='test';ctx.profileReady=true;handlers.hashchange();assert.deepEqual(pages,['chat']);
 ctx.location.hash='';handlers.hashchange();assert.equal(pages.at(-1),'inbox');handlers['salon:open-notification']();assert.equal(pages.at(-1),'chat');
 const sw=fs.readFileSync('firebase-messaging-sw.js','utf8'),events={},calls=[];let pending;
 const origin='https://example.test';let url=origin+'/salon-space-chat/customer.html#chat';
 const client={url:origin+'/salon-space-chat/customer.html',navigate:async dest=>{calls.push(['navigate',dest]);return client},postMessage:m=>calls.push(['message',m.url]),focus:async()=>calls.push(['focus'])};
 const sc={URL,self:{location:{origin},navigator:{userAgent:'iPhone'},addEventListener:(n,f)=>events[n]=f,clients:{matchAll:async()=>[client],openWindow:async u=>calls.push(['open',u])}},SalonPush:{destination:()=>new URL(url)}};
 vm.runInNewContext(sw.slice(sw.indexOf("self.addEventListener('notificationclick'"),sw.indexOf('importScripts("https:')),sc);
 const click=()=>events.notificationclick({notification:{close(){},data:{url}},stopImmediatePropagation(){},waitUntil:p=>pending=p});click();await pending;assert.deepEqual(calls,[['navigate',url],['message',url],['focus']]);
 calls.length=0;client.url=url;click();await pending;assert.deepEqual(calls,[['message',url],['focus']],'existing chat wakes without reload');client.url=origin+'/salon-space-chat/customer.html';
 calls.length=0;client.navigate=async()=>{throw Error('unavailable')};click();await pending;assert.deepEqual(calls,[['message',url],['focus']]);
 calls.length=0;sc.self.navigator.userAgent='Android';click();await pending;assert.deepEqual(calls,[['message',url],['focus']],'Android resumes existing customer window');
 calls.length=0;client.focus=async()=>{throw Error('discarded')};click();await pending;assert.deepEqual(calls,[['message',url],['open',url]],'focus rejection falls back to opening chat');
 calls.length=0;sc.self.clients.matchAll=async()=>[];click();await pending;assert.deepEqual(calls,[['open',url]]);
 calls.length=0;client.url=origin+'/salon-space-chat/customer.html?appBuild=11';client.focus=async()=>calls.push(['focus']);sc.self.clients.matchAll=async()=>[client];click();await pending;
 assert.equal(new URL(calls.find(c=>c[0]==='message')[1]).searchParams.get('appBuild'),'11','APK native-settings context survives notification navigation');
 calls.length=0;url=origin+'/salon-space-chat/admin.html?chat=outside-first-page';
 client.url=origin+'/salon-space-chat/admin.html';client.navigate=async dest=>{calls.push(['navigate',dest]);return client};client.focus=async()=>calls.push(['focus']);sc.self.clients.matchAll=async()=>[client];
 for(const platform of ['Android','iPhone']){calls.length=0;sc.self.navigator.userAgent=platform;click();await pending;assert.deepEqual(calls,[['navigate',url],['message',url],['focus']],platform+' owner resumes exact room');}
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
(async()=>{
 const html=fs.readFileSync('admin.html','utf8'),pages=[],rooms=[];
 const ctx={booted:true,history:{replaceState(){}},openCustomerChat:async id=>rooms.push(id),auth:{currentUser:{uid:'owner'}},ADMIN:'owner',URL,location:{href:'https://example.test/salon-space-chat/admin.html',origin:'https://example.test',pathname:'/salon-space-chat/admin.html'},showAdminPage:p=>pages.push(p),openTool:p=>pages.push(p),console};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('let pendingNotificationURL='),html.indexOf("navigator.serviceWorker?.addEventListener('message'",html.indexOf('let pendingNotificationURL='))),ctx);
 await ctx.routeNotification({url:ctx.location.href+'?chat=customer'});assert.deepEqual(rooms,['customer']);assert.deepEqual(pages,[]);
 await ctx.routeNotification({url:ctx.location.href+'#chat/legacy'});assert.equal(rooms.at(-1),'legacy');
 ctx.auth.currentUser=null;ctx.booted=false;
 await ctx.routeNotification({url:ctx.location.href+'?chat=outside-first-page'});assert.equal(rooms.length,2,'pre-auth intent cannot open data');
 ctx.auth.currentUser={uid:'owner'};
 await ctx.routeNotification({url:ctx.location.href+'?chat=outside-first-page'});assert.equal(rooms.length,2,'wait for owner boot');
 ctx.booted=true;ctx.$=()=>({classList:{remove(){}}});ctx.syncPushToken=()=>{};
 await ctx.openAdminHome();assert.equal(rooms.at(-1),'outside-first-page','owner boot consumes pending notification');
 pages.length=0;
 ctx.location.href+='?chat=cold-launch';await ctx.openAdminHome();assert.equal(rooms.at(-1),'cold-launch');
 ctx.location.href=ctx.location.href.split('?')[0];pages.length=0;
 await ctx.routeNotification({url:ctx.location.href+'?chat=bad%2Fpath'});assert.equal(pages.at(-1),'admin');assert.equal(rooms.length,4);
 pages.length=0;
 await ctx.routeNotification({url:ctx.location.href+'?view=messages'});assert.equal(pages.at(-1),'admin');
 await ctx.routeNotification({url:'https://evil.test/salon-space-chat/admin.html?chat=customer'});assert.equal(pages.length,1);
 await ctx.routeNotification({url:ctx.location.href+'?view=approvals'});assert.equal(pages.at(-1),'approvals');
 const sw=fs.readFileSync('firebase-messaging-sw.js','utf8');let handler,shown=0,badges=0,owner=true;
 const sc={messaging:{onBackgroundMessage:f=>handler=f},readBrand:async()=>({ownerDevice:owner}),self:{navigator:{setAppBadge:async()=>badges++},location:{origin:'https://example.test'},registration:{showNotification:async()=>shown++}},SalonPush:{notification:()=>({title:'test',options:{}})},saveDiag:async()=>{},String};
 vm.runInNewContext(sw.slice(sw.indexOf('messaging.onBackgroundMessage')),sc);
 await handler({data:{automatic:'true',recipientRole:'customer'}});assert.equal(shown,0);assert.equal(badges,0,'automated reply does not create owner unread badge');
 await handler({data:{body:'customer message'}});assert.equal(shown,1);
 owner=false;await handler({data:{automatic:'true',recipientRole:'customer'}});assert.equal(shown,2,'customer still receives automatic replies');
 await handler({data:{automatic:'true',recipientRole:'admin'}});assert.equal(shown,2);
 console.log('PASS notification inbox routing and automatic-owner suppression; customer messages preserved');
})().catch(e=>{console.error(e);process.exit(1)});


// Chat shell is available after access validation; quick replies must not hold the cover.
{
 const html=fs.readFileSync('customer.html','utf8');
 assert.ok(html.includes('releaseCoverAfter(id==="chat"?undefined:rendered,splash,'));
 assert.ok(html.includes('<p class="startupHelp" hidden>'));
 assert.ok(html.includes("showCustomerPage(location.hash==='#chat'?'chat':'inbox')"));
 console.log('PASS cold chat route and nonblocking chat cover; startup recovery remains available');
}
