import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let scheduled,resize;const events=new Map();const el={scrollTop:0,scrollHeight:1000,children:[{}],getClientRects:()=>[{}],addEventListener:(e,f)=>events.set(e,f),removeEventListener:(e)=>events.delete(e)};
const c=vm.createContext({requestAnimationFrame:f=>(scheduled=f,1),cancelAnimationFrame:()=>{},ResizeObserver:class{constructor(f){resize=f}observe(){}disconnect(){}}});
vm.runInContext(fs.readFileSync('chat-bottom.js','utf8').replace('export function','function')+';globalThis.pin=pinChatBottom;',c);
const view={el};c.pin(view);scheduled();assert.equal(el.scrollTop,1000);
el.scrollHeight=1600;events.get('load')();scheduled();assert.equal(el.scrollTop,1600,'image load retains latest message');
events.get('touchstart')();el.scrollTop=200;resize();scheduled();assert.equal(el.scrollTop,200,'manual reading is not pulled back');
c.pin(view);scheduled();assert.equal(el.scrollTop,1600,'re-entry returns to newest');
for(const name of ['customer.html','admin.html']){const s=fs.readFileSync(name,'utf8');assert.match(s,/currentChatView.first=true;pinChatBottom/);assert.match(s,/document.activeElement\?\.blur/);for(const m of s.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/salon-inline-check.mjs',m[1]);}}
console.log('PASS chat entry: initial bottom, delayed image load, manual scroll release, same-room reentry, no forced keyboard');
