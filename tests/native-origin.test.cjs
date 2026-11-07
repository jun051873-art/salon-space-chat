const {JSDOM}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');
const html=fs.readFileSync((process.env.ORIGIN_FIX_BASE||'')+'customer.html','utf8');const bootstrap=html.match(/<script id="native-channel-bootstrap">([\s\S]*?)<\/script>/)[1];
const bridge=fs.readFileSync((process.env.ORIGIN_FIX_BASE||'')+'native-push-bridge.js','utf8').replaceAll('export ','');
(async()=>{
 for(const early of [true,false])for(const origin of ['android-app://jun051873-art.github.io','android-app://jun051873-art.github.io/com.jun051873.salonspace']){
 const dom=new JSDOM('',{url:'https://jun051873-art.github.io/salon-space-chat/customer.html?appBuild=16',runScripts:'outside-only'});const w=dom.window;w.eval(bootstrap);
 const sent=[];const port={postMessage:s=>sent.push(JSON.parse(s)),start(){},close(){}};
 const event=o=>new w.MessageEvent('message',{origin:o,data:'',ports:[port]});
 if(!early)w.eval(bridge);
 for(const bad of ['null','android-app://evil.test','android-app://jun051873-art.github.io.evil.test','android-app://jun051873-art.github.io/other.package','https://evil.test']){w.dispatchEvent(event(bad));assert.equal(w.__salonNativeChannel.pending,null);assert.equal(sent.length,0);}
 w.dispatchEvent(event(origin));if(early)w.eval(bridge);
 assert.equal(sent[0]?.type,'READY','Chrome app origin must not be dropped');
 const pending=w.__salonNativePushBridge.register('testUid');
 port.onmessage({data:JSON.stringify({protocol:'SALON_NATIVE_PUSH',type:'HELLO'})});
 assert.ok(sent.some(x=>x.type==='REGISTER'&&x.uid==='testUid'));
 port.onmessage({data:JSON.stringify({protocol:'SALON_NATIVE_PUSH',type:'TOKEN',uid:'testUid',allowed:true,value:'x'.repeat(100)})});
 assert.equal((await pending).allowed,true);w.__salonNativePushBridge.saved('testUid');assert.equal(sent.at(-1).type,'SAVED');dom.window.close();
 }
 console.log('PASS actual inline bootstrap + module: Chromium android-app origins, before/after module load, register/token/saved, reject wrong hosts/packages/null');
})().catch(e=>{console.error(e);process.exitCode=1});
