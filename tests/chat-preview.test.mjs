import assert from 'node:assert/strict';
import {bindLongPress,readPreview} from '../chat-preview.js';
class Element extends EventTarget {}
const e=new Element();let count=0,clicks=0;const cancel=bindLongPress(e,()=>count++,{delay:15,tolerance:10});e.addEventListener('click',()=>clicks++);
const ev=(type,props={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,{clientX:0,clientY:0,button:0,...props});e.dispatchEvent(event);return event;};
ev('pointerdown');await new Promise(r=>setTimeout(r,25));ev('pointerup');assert.equal(count,1);assert.equal(ev('click').defaultPrevented,true);assert.equal(clicks,0);
ev('pointerdown');ev('pointermove',{clientX:20});await new Promise(r=>setTimeout(r,25));ev('pointerup');assert.equal(count,1);
ev('pointerdown');ev('pointercancel');await new Promise(r=>setTimeout(r,25));assert.equal(count,1);cancel();
const cache=new Map();let reads=0;const read=async(room,n)=>{reads++;assert.equal(n,12);return [{text:room}];};
await readPreview({room:'a',read,cache,now:100});await readPreview({room:'a',read,cache,now:200});assert.equal(reads,1);await readPreview({room:'a',read,cache,now:20000});assert.equal(reads,2);
console.log('Preview: long press, click suppression, scroll/cancel and bounded cached read passed.');
