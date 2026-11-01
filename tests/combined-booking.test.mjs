import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {inquiryTimes,inquiryText} from '../booking-inquiry.js';
const source=fs.readFileSync(new URL('../salon-suite.js',import.meta.url),'utf8');
const start=source.indexOf(' async function calendar('),end=source.indexOf('\n }',source.indexOf(' async function showSlots('))+3;
class Node {
 constructor(){this.nodes=new Map();this.buttons=[];this.classList={contains:()=>false};this.value='';this.attrs={};}
 set innerHTML(v){this.html=v;this.nodes.clear();this.buttons=[...v.matchAll(/<button\b([^>]*)>/g)].map(([,a])=>{const n=new Node();n.disabled=/\bdisabled\b/.test(a);n.dataset=Object.fromEntries([...a.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([,k,v])=>[k.replace(/-([a-z])/g,(_,x)=>x.toUpperCase()),v]));return n;});}
 get innerHTML(){return this.html||'';}
 querySelector(sel){for(const child of this.nodes.values())if(child.innerHTML.includes('id="'+sel.slice(1)+'"'))return child.querySelector(sel);if(!this.nodes.has(sel))this.nodes.set(sel,new Node());return this.nodes.get(sel);}
 querySelectorAll(sel){const key=sel.slice(6,-1).replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return this.buttons.filter(b=>key in b.dataset);}
 setAttribute(k,v){this.attrs[k]=v;}
 scrollIntoView(){}
}
const config={services:['剪髮'],times:['12:00','14:00']};let closures=[{id:'2030-11-03',closed:true}],sent=[],page='';
class Clock extends Date {static now(){return Date.parse('2030-11-01T00:00:00+08:00');}}
const context={Date:Clock,readConfig:async()=>config,listOnce:async()=>closures,localDay:date=>date?date.toISOString().slice(0,10):'2030-11-01',DAY:86400000,esc:String,icon:()=>'',hoursForDay:(_,day)=>({closed:day==='2030-11-02'}),task:(b,f)=>b.onclick=f,inquiryTimes,inquiryText,designerChoices:()=>[{id:'',name:'不指定'}],profile:{status:'active'},auth:{currentUser:{uid:'guest'}},demo:false,delivery:{enqueue:v=>sent.push(v)},showPage:id=>page=id,toast(){}};
vm.createContext(context);vm.runInContext(source.slice(start,end)+';this.calendar=calendar;',context);
const first=new Node(),second=new Node();await context.calendar(first,false,true);await context.calendar(second,false,true);
const buttons=first.querySelector('#calendar').buttons;
assert(buttons.find(x=>x.dataset.day==='2030-11-02').disabled);
assert(buttons.find(x=>x.dataset.day==='2030-11-03').disabled);
await buttons.find(x=>x.dataset.day==='2030-11-04').onclick();
const slots=first.querySelector('#slotArea');assert.match(slots.innerHTML,/2030-11-04/);assert.doesNotMatch(second.querySelector('#slotArea').innerHTML,/2030-11-04/);
slots.querySelectorAll('[data-inquiry-time]')[0].onclick();slots.querySelectorAll('[data-inquiry-service]')[0].onclick();
closures.push({id:'2030-11-04',closed:true});await assert.rejects(slots.querySelector('#inquirySend').onclick(),/店休/);assert.equal(sent.length,0);
closures.pop();await slots.querySelector('#inquirySend').onclick();assert.equal(sent.length,1);assert.match(sent[0].text,/待店家確認/);assert.match(sent[0].text,/12:00/);assert.equal(page,'chat');
console.log('PASS shared holiday/booking calendar, disabled closures, independent route DOM, closure revalidation and pending inquiry into existing chat');
