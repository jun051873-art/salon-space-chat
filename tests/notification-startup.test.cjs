const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
(async()=>{
 const html=fs.readFileSync('admin.html','utf8');
 const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://example.test/salon-space-chat/admin.html?chat=merged-member'});
 const {document}=dom.window;const rooms=[];let reads=0;
 const ctx={rememberAdminRoute(){},document,$:id=>document.getElementById(id),sel:null,adminFeed:null,currentChatView:null,ADMIN:'owner',auth:{currentUser:{uid:'owner'}},suite:{demo:false},chatPresence:{enter(){}},listen:(id)=>rooms.push(id),getDoc:()=>{reads++;return new Promise(()=>{})},doc:()=>({}),db:{},chatError:e=>e.message};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('async function openCustomerChat('),html.indexOf('$("adminCustomerPill").onclick')),ctx);
 // Identity lookup and homepage config may never resolve. The destination must
 // still be visible, accept typing, and start listening before either finishes.
 void ctx.openCustomerChat('merged-member');
 assert.equal(document.getElementById('bootSplash'),null);
 assert.equal(document.getElementById('adminChat').style.display,'block');
 assert.deepEqual(rooms,['merged-member']);
 const input=document.getElementById('reply');input.value='正在輸入';input.focus();
 await ctx.openCustomerChat('merged-member');
 assert.equal(document.activeElement,input);assert.equal(input.value,'正在輸入');assert.equal(reads,1);assert.equal(rooms.length,1);
 // Two notification delivery events must not re-open/blur the active customer chat.
 const customer=fs.readFileSync('customer.html','utf8'),handlers={},pages=[];
 const cc={document:{documentElement:{dataset:{}},body:{dataset:{page:'chat'}}},uid:'customer',profileReady:true,location:{hash:'#chat'},history:{replaceState(){}},resumeVisibleReads(){},showCustomerPage:p=>pages.push(p),window:{addEventListener:(n,f)=>handlers[n]=f},navigator:{serviceWorker:{addEventListener(){}}}};
 vm.createContext(cc);vm.runInContext(customer.slice(customer.indexOf('function restoreNotificationRoute()'),customer.indexOf('$("chatShortcuts").onclick')),cc);
 for(let i=0;i<100;i++)handlers['salon:open-notification']();
 assert.equal(pages.length,0);
 // Neither automatic nor explicit receipt writes can clear unread behind a launch cover.
 const suite=fs.readFileSync('salon-suite.js','utf8');let touched=0;
 const rc={document:{getElementById:id=>id==='bootSplash'?{}:null},getChat(){touched++;throw Error('receipt must not run under cover')}};
 vm.createContext(rc);
 const a=suite.indexOf('async function writeSharedReceipt('),b=suite.indexOf('function receiptIssue',a);vm.runInContext(suite.slice(a,b),rc);
 const c=suite.indexOf('async function writeReceipt('),d=suite.indexOf('async function reviseMessage',c);vm.runInContext(suite.slice(c,d),rc);
 await rc.writeReceipt();await rc.writeReceipt(true);await rc.writeSharedReceipt({},false);assert.equal(touched,0);
 const badgeCalls=[];const bc={clearCustomerNotifications:async()=>{},navigator:{setAppBadge:n=>{badgeCalls.push(n);return Promise.resolve()},clearAppBadge:()=>{badgeCalls.push(0);return Promise.resolve()}}};vm.createContext(bc);vm.runInContext(fs.readFileSync('salon-unread.js','utf8').replace(/^import .*\n/,'').replaceAll('export ',''),bc);
 bc.appPending(0);bc.appDot(0,false);assert.deepEqual(badgeCalls,[],'unconfirmed empty cache must not erase push badge');bc.appDot(2,true);bc.appPending(0);assert.deepEqual(badgeCalls,[2,2]);bc.appDot(0,true);assert.equal(badgeCalls.at(-1),0,'server-confirmed read may clear badge');
 const cleared=[];
 bc.clearCustomerNotifications=async()=>cleared.push(true);
 bc.document={visibilityState:'visible',body:{classList:{contains:()=>false},dataset:{page:'inbox'}}};
 bc.appDot(0,true);bc.appDot(1,true);bc.appDot(0,true);
 assert.equal(cleared.length,0,'home never dismisses system notifications');
 bc.document.body.dataset.page='chat';
 bc.appDot(1,true);bc.document.visibilityState='hidden';bc.appDot(0,true);
 assert.equal(cleared.length,0,'background read state never dismisses system notifications');
 bc.document.visibilityState='visible';
 bc.appDot(1,true);bc.appDot(0,true);bc.appDot(0,true);
 assert.equal(cleared.length,1,'only a confirmed read in a visible conversation clears old notifications');
 dom.window.close();console.log('PASS real owner chat DOM: cold notification removes cover with stalled identity fetch; duplicate opens retain typing; 100 customer events do not reopen; covered chats never mark read');
})().catch(e=>{console.error(e);process.exitCode=1});

(async()=>{
 const dom=new JSDOM('<section id="admin"><div id="list"></div></section>');
 const document=dom.window.document;
 const source=fs.readFileSync('salon-suite.js','utf8');
 const {unreadSummary}=await import('../salon-unread.js');
 const {inboxRoomVisible,groupConversationRows}=await import('../customer-management.js');
 const snapshots=[
  {id:'front',data:()=>({name:'第一位',updatedAt:300,lastCustomerMessageAt:300,readAdminMs:200})},
  {id:'read',data:()=>({name:'已讀',updatedAt:400,lastCustomerMessageAt:400,readAdminMs:400})},
  {id:'second',data:()=>({name:'第二位',updatedAt:100,lastCustomerMessageAt:100,readAdminMs:0})}
 ];
 const context={document,$:id=>document.getElementById(id),unreadSummary,groupConversationRows,inboxRoomVisible,
  filterDesignerRooms:rows=>rows,liveInboxRows:new Map(),inboxPhotos:new Map(),config:{},designerList:()=>[],designerFilterOptions:()=>[],
  hasDuplicateCustomers:()=>false,esc:String,icon:()=>'',avatar:()=>'',millis:n=>Number(n||0),appointmentLabel:()=>'',assignedDesignerLabel:row=>row.assignedDesignerName||'未指定',watchInboxIdentities(){},bindSwipe(){},task(){},openChat(){throw Error('inbox focus must not open a chat');},
  getDocFromServer:async()=>({...snapshots[2],exists:()=>true}),doc:()=>({}),db:{}};
 vm.runInNewContext(source.slice(source.indexOf(' let inboxDocs='),source.indexOf(' async function loadDesignerHistory()')),context);
 context.renderInbox(snapshots.slice(0,2));
 await context.focusInboxNotification('second');
 assert.deepEqual([...document.querySelectorAll('.unreadDot')].map(dot=>dot.closest('[data-room]').dataset.room),['front','second']);
 assert.match(document.querySelector('[data-room="second"]').textContent,/通知帶你到這裡/);
 const primary={id:'primary',data:()=>({name:'小芳',conversationId:'merged',conversationPrimaryUid:'primary',updatedAt:100,assignedDesignerId:'dao',assignedDesignerName:'小刀'})};
 const old={id:'old',data:()=>({name:'舊對話',conversationId:'merged',conversationPrimaryUid:'primary',updatedAt:200,assignedDesignerId:''})};
 context.renderInbox([primary,old]);
 assert.equal(document.querySelector('[data-room="old"] .assignedDesigner').textContent,'小刀');
 context.inboxPhotos.set('old',{primaryId:'primary',assignedDesignerId:'dao',assignedDesignerName:'小刀'});
 context.renderInbox([old]);
 assert.equal(document.querySelector('[data-room="old"] .assignedDesigner').textContent,'小刀');
 context.renderInbox([{...primary,data:()=>({...primary.data(),assignedDesignerId:'',assignedDesignerName:''})},old]);
 assert.equal(document.querySelector('[data-room="old"] .assignedDesigner').textContent,'未指定');
 assert.equal(document.querySelectorAll('dialog').length,0);
 dom.window.close();
 console.log('PASS owner inbox keeps multiple red dots and highlights a notification outside the loaded page');
})().catch(e=>{console.error(e);process.exit(1);});
