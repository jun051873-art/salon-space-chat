import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import fs from 'node:fs';import vm from 'node:vm';import {bindMessageMenu} from '../message-menu.js';
const dom=new JSDOM('<main><div class="bubbleRow"><div class="msg">test</div><button data-retract>收回</button></div></main>');const w=dom.window,root=w.document.querySelector('main'),msg=root.querySelector('.msg');let n=0;bindMessageMenu(root,()=>n++);bindMessageMenu(root,()=>n++);
const fire=(type,x=0)=>msg.dispatchEvent(new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:0}));
fire('pointerdown');await new Promise(r=>setTimeout(r,550));assert.equal(n,1);fire('pointerup');fire('click');fire('pointerdown');fire('pointermove',30);await new Promise(r=>setTimeout(r,550));assert.equal(n,1);fire('pointerup');fire('contextmenu');assert.equal(n,2);
const src=fs.readFileSync('salon-suite.js','utf8');const code=src.slice(src.indexOf('export function messageHTML'),src.indexOf('export function installSuite')).replace('export ','');const c={millis:v=>Number(v)||0,esc:v=>String(v??'')};vm.createContext(c);vm.runInContext(code,c);for(const viewer of ['shop','guest']){assert.match(c.messageHTML({id:'1',senderRole:'admin',retracted:true},viewer),/hidden/);assert.match(c.messageHTML({id:'2',senderRole:'customer',retracted:true},viewer),/訊息已收回/);}console.log('PASS long press, scroll cancellation, single binding, desktop menu, role-specific retraction');
// A menu must not swallow its own action, or the next direct/keyboard button click.
let clicks=0;root.querySelector('button').onclick=()=>clicks++;
fire('contextmenu');root.querySelector('button').click();assert.equal(clicks,1);
fire('pointerdown');await new Promise(r=>setTimeout(r,550));root.querySelector('button').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));assert.equal(clicks,2);
for(const viewer of ['shop','guest']){const html=c.messageHTML({id:'own',senderId:viewer,senderRole:viewer==='shop'?'admin':'customer',text:'hello',createdAt:Date.now()-1000},viewer);assert.match(html,/data-edit="own"/);assert.match(html,/data-retract="own"/);}
assert.doesNotMatch(c.messageHTML({id:'peer',senderId:'guest',text:'hello'},'shop'),/data-retract/);
// Actual long-press action callback must not depend on a DOM row surviving a snapshot.
assert.doesNotMatch(src.slice(src.indexOf(' bindMessageMenu(v.el,'),src.indexOf('\n clearTimeout',src.indexOf(' bindMessageMenu(v.el,'))),/\.click\(|row.isConnected/);
console.log('PASS menu actions, direct buttons after long press, both authors controls, peer ownership');
