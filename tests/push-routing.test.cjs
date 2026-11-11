const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {MessageChannel}=require('node:worker_threads');
const origin='https://jun051873-art.github.io';
const source=fs.readFileSync('firebase-messaging-sw.js','utf8');
async function scenario({role='customer',visibleRole,activeRoom,hidden=false,timeout=false,foreign=false}={}){
 const handlers={},shown=[],diagnostics=[],channels=[];let firebasePush=0,badges=0,stopped=false,work;
 const data={url:origin+'/salon-space-chat/'+role+'.html'+(role==='admin'?'?chat=room-a':''),tag:'salon-room-a-msg-1',messageId:'msg-1',body:'測試'};
 const client={url:origin+'/salon-space-chat/'+visibleRole+'.html',visibilityState:hidden?'hidden':'visible',postMessage(message,ports){channels.push(message.type);if(!timeout)ports[0].postMessage({visible:!!activeRoom,rooms:[activeRoom]});}};
 const ctx={URL,Request,Response,MessageChannel,setTimeout,clearTimeout,console,Date,
  importScripts(path){if(path.startsWith('./'))vm.runInContext(fs.readFileSync(path.split('?')[0],'utf8'),ctx);},
  caches:{open:async()=>({match:async()=>null,put:async(_,response)=>diagnostics.push(await response.json())})},
  firebase:{initializeApp(){},messaging(){return {onBackgroundMessage(){}}}},
  self:{location:{origin},navigator:{setAppBadge:async()=>badges++},clients:{matchAll:async()=>visibleRole?[client]:[]},registration:{showNotification:async(title,options)=>shown.push({title,options})},addEventListener(type,fn){(handlers[type]??=[]).push(fn);}}
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 // Model Firebase's visible-window path: it would consume the push rather than
 // showing an OS notification. Our earlier listener must take responsibility.
 handlers.push.push(()=>firebasePush++);
 const payload={from:foreign?'other-project':'103245363547',data};
 for(const listener of handlers.push){if(stopped)break;listener({data:{json:()=>payload},stopImmediatePropagation(){stopped=true},waitUntil(p){work=p}});}
 await work;
 return {shown,badges,firebasePush,diagnostics,channels};
}
(async()=>{
 for(const role of ['admin','customer']){
  for(const visibleRole of [undefined,role==='admin'?'customer':'admin',role]){
   const out=await scenario({role,visibleRole});assert.equal(out.shown.length,1,`${role}: visible ${visibleRole} outside target chat must not swallow push`);assert.equal(out.badges,1);assert.equal(out.firebasePush,0,'one owner of a push, no duplicate');
   assert(out.shown[0].options.data.url.includes(role+'.html'));
  }
  assert.equal((await scenario({role,visibleRole:role,activeRoom:'room-a'})).shown.length,0,'matching foreground chat suppresses banner');
  assert.equal((await scenario({role,visibleRole:role,activeRoom:'room-b'})).shown.length,1,'another room cannot silence recipient');
  assert.equal((await scenario({role,visibleRole:role,activeRoom:'room-a',hidden:true})).shown.length,1,'background chat still notifies');
  assert.equal((await scenario({role,visibleRole:role,timeout:true})).shown.length,1,'unresponsive page fails open');
 }
 const foreign=await scenario({foreign:true});assert.equal(foreign.shown.length,0);assert.equal(foreign.firebasePush,1,'unknown payload remains with Firebase');
 const context={URL};vm.createContext(context);vm.runInContext(fs.readFileSync('push-routing.js','utf8'),context);
 assert.equal(context.SalonPushRouting.customerRoom({url:origin+'/salon-space-chat/customer.html',messageId:'id-with-dash',tag:'salon-room-with-dash-id-with-dash'},origin),'room-with-dash');
 assert.equal(context.SalonPushRouting.owns({from:'103245363547',data:{url:'https://evil.test/salon-space-chat/customer.html',tag:'salon-x'}},origin),false);
 console.log('PASS worker push routing: both roles, other visible app, matching/wrong/hidden chat, timeout, single banner+badge, unknown source and safe destination');
})().catch(e=>{console.error(e);process.exit(1)});
