const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('salon-suite.js','utf8');
const fn=source.slice(source.indexOf('async function customerPage(body)'),source.indexOf(' function profileFields('));
const pending=[];
const context=vm.createContext({activeTool:'customers',document:{createElement:()=>({})},loadCustomers:()=>new Promise(resolve=>pending.push(resolve))});
vm.runInContext(fn,context);
const body={firstElementChild:null,html:'',replaceChildren(child){this.firstElementChild=child;this.html=child.textContent;},set innerHTML(value){throw Error('Stale customer request tried to render');}};
(async()=>{
 const first=context.customerPage(body);
 context.activeTool='theme';body.replaceChildren({textContent:'Appearance controls'});
 pending.shift()([]);await first;assert.equal(body.html,'Appearance controls');
 context.activeTool='customers';const older=context.customerPage(body);const newer=context.customerPage(body);const newestLoading=body.firstElementChild;
 pending.shift()([]);await older;assert.equal(body.firstElementChild,newestLoading);
 context.activeTool='tags';body.replaceChildren({textContent:'Tags'});pending.shift()([]);await newer;assert.equal(body.html,'Tags');
 console.log('Customer page navigation and overlapping-request regressions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
