const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {MessageChannel}=require('node:worker_threads');
const context={URL,MessageChannel,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('admin-notification-visibility.js','utf8'),context);
const policy=context.SalonAdminNotification,origin='https://example.test';
const data={url:origin+'/salon-space-chat/admin.html?chat=customer1'};
(async()=>{
 assert.equal(policy.suppress(data,{visible:true,rooms:['customer1']},origin),true);
 for(const state of [{visible:false,rooms:['customer1']},{visible:true,rooms:['other']},{}])assert.equal(policy.suppress(data,state,origin),false);
 assert.equal(policy.suppress(data,{visible:true,rooms:['primary','customer1']},origin),true);
 assert.equal(policy.suppress({url:'https://other.test/salon-space-chat/admin.html?chat=customer1'},{visible:true,rooms:['customer1']},origin),false);
 assert.equal(policy.suppress({url:origin+'/salon-space-chat/admin.html'},{visible:true,rooms:['customer1']},origin),false);
 const client={url:origin+'/salon-space-chat/admin.html',visibilityState:'visible',postMessage:(msg,ports)=>{ports[0].postMessage({visible:true,rooms:['customer1']});}};
 assert.equal(await policy.visibleChat(data,{matchAll:async()=>[client]},origin),true);
 assert.equal(await policy.visibleChat(data,{matchAll:async()=>[{...client,visibilityState:'hidden'}]},origin),false);
 assert.equal(await policy.visibleChat(data,{matchAll:async()=>[{...client,postMessage(){}}]},origin),false);
 assert.equal(await policy.visibleChat(data,{matchAll:async()=>{throw Error('unavailable')}},origin),false);
 console.log('PASS active chat, linked chat, background, different chat, timeout and failure notification policy');
})();
