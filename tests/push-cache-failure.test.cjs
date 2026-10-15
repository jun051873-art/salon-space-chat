const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let receive,shown=0;
 const context={importScripts(){},firebase:{initializeApp(){},messaging(){return{onBackgroundMessage(fn){receive=fn}}}},self:{location:{origin:'https://example.test'},navigator:{setAppBadge:async()=>{}},addEventListener(){},registration:{showNotification:async(title,options)=>{assert.equal(title,'Test');shown++;}}},SalonPush:{notification:()=>({title:'Test',options:{body:'message'}})},caches:{open:async()=>{throw Error('storage unavailable')}},Date,Request,Response};
 vm.runInNewContext(fs.readFileSync('firebase-messaging-sw.js','utf8'),context);
 await receive({data:{body:'message'}});
 assert.equal(shown,1,'diagnostic cache failure must not suppress the notification');
 console.log('PASS background notification still displays when CacheStorage fails');
})();
