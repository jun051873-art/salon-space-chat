import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../salon-suite.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf(' async function holidayCalendar('),source.indexOf(' async function calendar('));
function element(){return {dataset:{},textContent:'',innerHTML:'',setAttribute(){},removeAttribute(){},querySelectorAll(){return [...this.innerHTML.matchAll(/data-holiday-day="([^"]+)"/g)].map(m=>({dataset:{holidayDay:m[1]}}));}};}
function body(){const nodes=new Map(),prev={dataset:{month:'-1'}},next={dataset:{month:'1'}};return {dataset:{holidayMonth:'2028-02'},classList:{contains:()=>false},innerHTML:'',querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)},querySelectorAll(){return [prev,next]},prev,next};}
let rows=[],writes=[],failWrite=false;const config={homeSections:{products:true,holidays:false}};
const ctx={readConfig:async()=>config,listOnce:async()=>rows,localDay:()=> '2028-02-01',hoursForDay:(_,day)=>({closed:day==='2028-02-07'}),icon:()=>'',store:async(path,data)=>{if(failWrite)throw Error('offline');writes.push({path,data})},stamp:()=>123,fail:()=>{},saveConfig:async data=>Object.assign(config,data),calendar:async(body,editable,booking)=>{body.booking=booking;},ctx:{openTool(){}}};
vm.createContext(ctx);vm.runInContext(code+';this.render=holidayCalendar;',ctx);
const b=body();
// Keep rendered controls so a real onClick handler can be invoked after drawing.
const grid=b.querySelector('.holidayDates');grid.querySelectorAll=function(){this.buttons=[...this.innerHTML.matchAll(/data-holiday-day="([^"]+)"/g)].map(m=>({dataset:{holidayDay:m[1]}}));return this.buttons;};
await ctx.render(b,true);assert.equal(grid.buttons.length,29);
await grid.buttons.find(x=>x.dataset.holidayDay==='2028-02-08').onclick();assert.equal(writes[0].data.closed,true);
await grid.buttons.find(x=>x.dataset.holidayDay==='2028-02-08').onclick();assert.equal(writes[1].data.closed,false);
await grid.buttons.find(x=>x.dataset.holidayDay==='2028-02-07').onclick();assert.equal(writes.length,2);
failWrite=true;await grid.buttons.find(x=>x.dataset.holidayDay==='2028-02-09').onclick();assert.equal(rows.some(x=>x.id==='2028-02-09'),false);assert.match(b.querySelector('.holidayStatus').textContent,/尚未儲存/);failWrite=false;
b.next.onclick();assert.equal(b.dataset.holidayMonth,'2028-03');await ctx.render(b,true);assert.equal(b.dataset.holidayMonth,'2028-03');
const toggle=b.querySelector('[data-holiday-visible]');toggle.checked=true;await toggle.onchange();assert.equal(config.homeSections.products,true);assert.equal(config.homeSections.holidays,false);assert.equal(config.customerHomeCards.holidays,true);
const guest=body();await ctx.render(guest,false);assert.equal(guest.booking,true);assert.equal(writes.length,2);
console.log('PASS reversible closures, fixed holidays, failed writes, month retention, isolated visibility settings and customer booking handoff');
