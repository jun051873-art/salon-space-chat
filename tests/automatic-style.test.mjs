import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync('salon-suite.js','utf8');
const code=src.slice(src.indexOf('export function messageHTML'),src.indexOf('export function installSuite')).replace('export ','');
const c={millis:v=>Number(v)||0,esc:v=>String(v??'').replaceAll('<','&lt;')};vm.createContext(c);vm.runInContext(code,c);
for(const viewer of ['shop','customer']){
 const auto=c.messageHTML({id:'a',senderId:'shop',automatic:true,text:'收到'},viewer);
 assert.match(auto,/automaticReplyLabel/);assert.match(auto,/自動回覆/);
 assert.doesNotMatch(c.messageHTML({id:'b',senderId:'shop',text:'收到'},viewer),/automaticReplyLabel/);
 assert.doesNotMatch(c.messageHTML({id:'a',senderId:'shop',automatic:true,retracted:true},viewer),/automaticReplyLabel/);
}
console.log('PASS automatic replies: both roles, human messages unchanged, retraction');
