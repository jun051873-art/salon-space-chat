import assert from 'node:assert/strict';
import {createNativePushBridge,isNativePushApp} from '../native-push-bridge.js';
let handler,timer;const sent=[];
const env={location:{href:'https://jun051873-art.github.io/salon-space-chat/customer.html?appBuild=15',origin:'https://jun051873-art.github.io'},addEventListener:(t,h)=>handler=h,setTimeout:h=>(timer=h,1),clearTimeout:()=>{}};
const bridge=createNativePushBridge(env),port={postMessage:s=>sent.push(JSON.parse(s)),start(){},close(){}};
const hello={data:JSON.stringify({protocol:'SALON_NATIVE_PUSH',type:'HELLO'}),ports:[port],origin:env.location.origin};
assert.equal(isNativePushApp(env),true);
let pending=bridge.register('customerA');
handler({...hello,origin:'https://attacker.example'});assert.equal(sent.length,0);
handler(hello);assert.deepEqual(sent[0],{protocol:'SALON_NATIVE_PUSH',type:'REGISTER',uid:'customerA'});
port.onmessage({data:JSON.stringify({protocol:'SALON_NATIVE_PUSH',type:'TOKEN',uid:'customerA',value:'x'.repeat(100),allowed:true})});
assert.deepEqual(await pending,{token:'x'.repeat(100),allowed:true});bridge.saved('customerA');assert.equal(sent.at(-1).type,'SAVED');
bridge.clear('other',999);assert.equal(sent.at(-1).type,'SAVED');bridge.clear('customerA',999);assert.equal(sent.at(-1).type,'CLEAR');
pending=bridge.register('customerB');timer();await assert.rejects(pending,/原生通知連線/);
console.log('Native push bridge PASS: origin, registration, receipt, timeout');

// Chromium transfers the port using an empty window message, then sends HELLO
// over the transferred port. Reproduce this independently of our Android mock.
const outgoing=[];
const realPort={postMessage:s=>outgoing.push(JSON.parse(s)),start(){},close(){}};
const realBridge=createNativePushBridge(env);
const realPending=realBridge.register('customerC');
handler({data:'',ports:[realPort],origin:'https://attacker.example'});
assert.equal(realPort.onmessage,undefined);
handler({data:'',ports:[realPort],origin:env.location.origin});
assert.equal(typeof realPort.onmessage,'function');
realPort.onmessage({data:JSON.stringify({protocol:'SALON_NATIVE_PUSH',type:'HELLO'})});
assert.deepEqual(outgoing[0],{protocol:'SALON_NATIVE_PUSH',type:'REGISTER',uid:'customerC'});
realPort.onmessage({data:JSON.stringify({protocol:'SALON_NATIVE_PUSH',type:'TOKEN',uid:'customerC',value:'z'.repeat(100),allowed:true})});
assert.deepEqual(await realPending,{token:'z'.repeat(100),allowed:true});
realBridge.saved('customerC');
assert.equal(outgoing.at(-1).type,'SAVED');
console.log('Chromium empty bootstrap → HELLO → REGISTER → TOKEN → SAVED PASS');
