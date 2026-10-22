import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../salon-theme.js',import.meta.url),'utf8');
const {makeDrawer}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.handlers={};this.open=false;}
 append(...nodes){for(const n of nodes){if(n.parent)n.parent.children.splice(n.parent.children.indexOf(n),1);n.parent=this;this.children.push(n);}}
 before(n){const parent=this.parent;n.parent=parent;parent.children.splice(parent.children.indexOf(this),0,n);}
 addEventListener(name,fn){this.handlers[name]=fn;}
 contains(n){return this.children.some(c=>c===n||c.contains(n));}
 querySelectorAll(){return this.children.flatMap(c=>[...(c.className==='settingsDrawer'?[c]:[]),...c.querySelectorAll()]);}
}
globalThis.document={createElement:tag=>new Element(tag)};
const host=new Element('main'),group=new Element('section'),input=new Element('input'),button=new Element('button'),second=new Element('section');
input.value='未儲存的店名';let saves=0;button.addEventListener('click',()=>saves++);group.append(input,button);host.append(group,second);
const a=makeDrawer(host,[group],'店家資訊','影響客人店名'),b=makeDrawer(host,[second],'主頁','影響客人主頁');
assert.equal(a.open,false);assert.equal(b.open,false);assert(a.contains(input));assert.equal(input.value,'未儲存的店名');button.handlers.click();assert.equal(saves,1);
a.open=true;a.handlers.toggle();b.open=true;b.handlers.toggle();assert.equal(a.open,false);assert.equal(b.open,true);assert.equal(input.value,'未儲存的店名');
const html=fs.readFileSync(new URL('../customer.html',import.meta.url),'utf8');
assert.deepEqual([...html.matchAll(/class="navBtn[^"\n]*" data-customer-page="([^"]+)"/g)].map(x=>x[1]),['info','inbox','booking','preferences']);
assert(!html.includes('data-header-page="preferences"'));assert(!html.includes('data-header-page="info"'));
console.log('PASS drawers preserve unsaved values and handlers, exclusive expansion, customer four-tab navigation');
