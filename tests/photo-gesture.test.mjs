import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
class Element{
 constructor(tag){this.tagName=tag;this.style={};this.dataset={};this.children=[];this.events={};this.offsetWidth=300;this.offsetHeight=400;this.clientWidth=400;this.clientHeight=700;this.closed=false;}
 setAttribute(){} append(...c){this.children.push(...c)} addEventListener(n,f){(this.events[n]??=[]).push(f)} emit(n,e={}){for(const f of this.events[n]||[])f({type:n,...e})} setPointerCapture(){} showModal(){} focus(){} remove(){} close(){this.closed=true;this.emit('close')}decode(){return Promise.resolve()}
}
globalThis.document={querySelector:()=>null,createElement:t=>new Element(t),body:new Element('body')};globalThis.window={dispatchEvent(){},addEventListener(){},removeEventListener(){}};globalThis.Image=class extends Element{constructor(){super('img')}};
const{openPhotoViewer}=await import('../photo-viewer.js');
function fixture(){const d=openPhotoViewer('photo.jpg');return{d,stage:d.children[0],img:d.children[0].children[0]};}
let{d,stage,img}=fixture();stage.emit('pointerdown',{button:0,pointerId:1,clientX:30,clientY:30,target:img});stage.emit('pointerup',{pointerId:1,clientX:30,clientY:30});assert(!d.closed,'tapping photo must not close');
({d,stage}=fixture());stage.emit('pointerdown',{button:0,pointerId:1,clientX:5,clientY:5,target:stage});stage.emit('pointerup',{pointerId:1,clientX:5,clientY:5});assert(d.closed,'blank tap closes');
({d,stage}=fixture());stage.emit('pointerdown',{button:0,pointerId:1,clientX:5,clientY:5,target:stage});stage.emit('pointermove',{pointerId:1,clientX:35,clientY:5});stage.emit('pointerup',{pointerId:1,clientX:35,clientY:5});assert(!d.closed,'drag on blank must not close');
({d,stage}=fixture());for(const id of [1,2])stage.emit('pointerdown',{button:0,pointerId:id,clientX:id*10,clientY:5,target:stage});stage.emit('pointerup',{pointerId:1,clientX:10,clientY:5});stage.emit('pointerup',{pointerId:2,clientX:20,clientY:5});assert(!d.closed,'pinch must not close');
({d,stage}=fixture());stage.emit('pointerdown',{button:0,pointerId:1,clientX:5,clientY:5,target:stage});stage.emit('pointercancel',{pointerId:1});assert(!d.closed,'OS cancel does not close');
console.log('PASS photo tap, blank dismiss, drag, pinch and cancelled gesture behavior');
