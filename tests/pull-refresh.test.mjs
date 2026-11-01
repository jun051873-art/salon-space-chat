import fs from 'node:fs';import assert from 'node:assert/strict';
const {mountPullRefresh}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('pull-refresh.js')).toString('base64'));
const handlers={},arrow={style:{}},label={},hint={hidden:true,setAttribute(){},classList:{add(){},remove(){}},querySelector(s){return s.includes('Arrow')?arrow:label},remove(){}};
let allowed=true,dialog=false,refreshes=0,resolve,prevented=0;
const body={},doc={body:{append(){}},defaultView:{scrollY:0},scrollingElement:{scrollTop:0},createElement:()=>hint,querySelector:()=>dialog?{}:null,addEventListener(n,f){handlers[n]=f},removeEventListener(n){delete handlers[n]}};
const stop=mountPullRefresh({doc,enabled:()=>allowed,refresh:()=>{refreshes++;return new Promise(r=>resolve=r)}});
const target={scrollTop:0,parentElement:null,closest:()=>null};
function touch(y,x=0){return {target,touches:[{clientY:y,clientX:x}],cancelable:true,preventDefault(){prevented++}}}
handlers.touchstart(touch(0));handlers.touchmove(touch(30));await handlers.touchend();assert.equal(refreshes,0);
handlers.touchstart(touch(0));handlers.touchmove(touch(140));const done=handlers.touchend();assert.equal(refreshes,1);assert.equal(label.textContent,'正在更新…');handlers.touchstart(touch(0));handlers.touchmove(touch(160));await handlers.touchend();assert.equal(refreshes,1);resolve();await done;assert.equal(label.textContent,'已更新');
for(const mode of ['scroll','dialog','disabled','horizontal','cancel','field']){target.scrollTop=mode==='scroll'?10:0;dialog=mode==='dialog';allowed=mode!=='disabled';target.closest=()=>mode==='field'?{}:null;handlers.touchstart(touch(0));handlers.touchmove(touch(140,mode==='horizontal'?200:0));if(mode==='cancel')handlers.touchcancel();await handlers.touchend();assert.equal(refreshes,1,mode);}
assert(prevented>0);stop();assert.equal(Object.keys(handlers).length,0);console.log('PASS pull threshold, feedback, duplicate suppression, scroll/dialog/form guards, horizontal/cancel and cleanup');
