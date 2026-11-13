const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('home-celebration.js','utf8');const fn=source.slice(source.indexOf('export function createHomeCelebration'),source.indexOf('export function mountHomeCelebrationEditor')).replace('export ','');
let count=0,stops=0,home=true,enabled=true,handler;const context={document:{documentElement:{dataset:{}},hidden:false,addEventListener:(n,f)=>handler=f,removeEventListener(){}},homeCelebration:()=>enabled?{effect:'gifts',day:'2026-11-13'}:null,matchMedia:()=>({matches:false}),setTimeout:()=>1,clearTimeout(){},Date,localDate:()=>"2026-11-13",mountHomeEffect:()=>{count++;return()=>stops++;}};
vm.createContext(context);vm.runInContext(fn,context);
const controller=context.createHomeCelebration({target:{},getConfig:()=>({}),getPerson:()=>({}),isHome:()=>home});
controller.sync();controller.sync();assert.equal(count,1,'live home updates must not restart animation');home=false;controller.sync();assert.equal(stops,1,'chat transition removes effect immediately');controller.sync();assert.equal(count,1);home=true;controller.sync();assert.equal(count,2);context.document.hidden=true;handler();assert.equal(stops,2);context.document.hidden=false;handler();assert.equal(count,3);enabled=false;controller.sync();assert.equal(stops,3);controller.destroy();
assert.doesNotMatch(source,/fetch\(|setInterval\(/,'no new remote calls or polling');
console.log('PASS home-only lifecycle, hidden stop, resume, one effect per entry, independent disable and no network polling');
