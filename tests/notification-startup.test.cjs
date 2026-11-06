const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
(async()=>{
 const html=fs.readFileSync('admin.html','utf8');
 const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://example.test/salon-space-chat/admin.html?chat=merged-member'});
 const {document}=dom.window;const rooms=[];let reads=0;
 const ctx={document,$:id=>document.getElementById(id),sel:null,adminFeed:null,currentChatView:null,ADMIN:'owner',auth:{currentUser:{uid:'owner'}},suite:{demo:false},chatPresence:{enter(){}},listen:(id)=>rooms.push(id),getDoc:()=>{reads++;return new Promise(()=>{})},doc:()=>({}),db:{},chatError:e=>e.message};
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
 dom.window.close();console.log('PASS real owner chat DOM: cold notification removes cover with stalled identity fetch; duplicate opens retain typing; 100 customer events do not reopen; covered chats never mark read');
})().catch(e=>{console.error(e);process.exitCode=1});
