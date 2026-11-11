const fs=require('fs'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('join.html','utf8');
async function run(mode){
 const dom=new JSDOM(html,{url:'https://jun051873-art.github.io/salon-space-chat/join.html?from=admin',runScripts:'outside-only'}),w=dom.window;let copied='',shared=null;
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async s=>{if(mode==='fallback')throw Error('denied');copied=s;}}});
 w.document.execCommand=()=>false;w.navigator.share=async s=>{shared=s;};
 for(const script of w.document.scripts)w.eval(script.textContent);
 const url='https://jun051873-art.github.io/salon-space-chat/customer.html';
 assert.equal(w.document.querySelector('#joinLink').value,url);
 await w.document.querySelector('#copyJoinLink').onclick();
 if(mode==='fallback'){assert.match(w.document.querySelector('#shareStatus').textContent,/長按/);assert.equal(w.document.activeElement.id,'joinLink');}else assert.equal(copied,url);
 await w.document.querySelector('#shareJoinLink').onclick();assert.equal(shared.url,url);
 assert.equal(w.document.querySelector('.secondary').target,'_blank');
 w.close();
}
(async()=>{await run('clipboard');await run('fallback');
 const admin=new JSDOM(fs.readFileSync('admin.html','utf8')).window.document;
 assert.equal(admin.querySelector('#adminAccount').tagName,'DETAILS');assert.equal(admin.querySelector('#adminAccount').open,false);assert.equal(admin.querySelectorAll('#adminSignOut').length,1);
 const src=fs.readFileSync('salon-suite.js','utf8');const frag=src.slice(src.indexOf("if(key==='display'){body.innerHTML="),src.indexOf("}else if(key==='approvals')"));
 const w=new JSDOM('<main id="body"></main>',{runScripts:'outside-only'}).window;w.eval("const key='display',body=document.querySelector('main'),icon=()=>'<svg></svg>',ctx={openTool:k=>window.clicked=k};"+frag+'}');
 const cards=[...w.document.querySelectorAll('[data-manage-tool]')];assert.equal(cards.length,5);for(const card of cards){assert(card.querySelector('.managementCopy b'));assert(card.querySelector('.managementCopy small'));assert(card.querySelector('.managementIcon svg'));card.click();assert.equal(w.clicked,card.dataset.manageTool);}w.close();
 console.log('PASS share clipboard/fallback/native sharing, account collapse, 5 management routes');
})().catch(e=>{console.error(e);process.exit(1)});
