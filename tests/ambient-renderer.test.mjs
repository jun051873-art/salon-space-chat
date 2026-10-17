import assert from 'node:assert/strict';
import {startAtmosphere} from '../ambient-renderer.js';
import {scenes} from '../ambient-scenes.js';
let next,cancelled=0,disconnected=0;
globalThis.requestAnimationFrame=fn=>(next=fn,1);
globalThis.cancelAnimationFrame=()=>cancelled++;
globalThis.ResizeObserver=class{observe(){}disconnect(){disconnected++}};
function run(effect){const calls=[];const ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop(){}}):(...args)=>{assert.ok(args.filter(x=>typeof x==='number').every(Number.isFinite));calls.push([key,...args])},set:()=>true});const canvas={isConnected:true,getContext:()=>ctx,getBoundingClientRect:()=>({width:390,height:680})};const stop=startAtmosphere(canvas,effect,{rng:()=>.4});next(100);next(1500);stop();return JSON.stringify(calls)}
const outputs=Object.fromEntries(Object.keys(scenes).map(effect=>[effect,run(effect)]));
assert.notEqual(outputs.petals,outputs.rain);assert.notEqual(outputs.rain,outputs.snow);assert.notEqual(outputs.sun,outputs.clouds);assert.equal(cancelled,28);assert.equal(disconnected,28);
assert.doesNotThrow(()=>startAtmosphere({getContext:()=>null},'rain')());
console.log('PASS all 28 canvas scenes render finite geometry, distinct rain/snow/petals, cleanup and no-canvas fallback');
