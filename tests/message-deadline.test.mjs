import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const src=fs.readFileSync('salon-suite.js','utf8'),now=Date.now();
const c={millis:v=>Number(v)||0,esc:v=>String(v??'')};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('export function messageHTML'),src.indexOf('export function installSuite')).replace('export ',''),c);
for(const [age,expected] of [[0,true],[1799999,true],[1800000,false],[1800001,false],[3600000,false],[-1000,false]])assert.equal(c.customerRevisionOpen({createdAt:now-age},now),expected,`age=${age}`);
assert.equal(c.customerRevisionOpen({},now),false);
for(const role of ['customer','admin'])for(const age of [60000,1801000]){
 const html=c.messageHTML({id:'m',senderId:'self',senderRole:role,createdAt:Date.now()-age,text:'hello'},'self');
 assert.equal(html.includes('data-edit='),role==='admin'||age<1800000);assert.equal(html.includes('data-retract='),role==='admin'||age<1800000);
}
assert.equal(c.customerRevisionOpen({createdAt:now-1800000,editedAt:now},now),false,'editing does not extend original deadline');
console.log('PASS exact 30-minute boundary, no timestamp/future rejection, admin exemption, controls and original deadline');
