const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
const {createPageTrail}=await import('../customer-navigation.js');
const html=fs.readFileSync('admin.html','utf8');
const ids=['login','adminHome','adminTool','admin','adminAnalysis','adminChat','adminNav','toolTitle'];
const dom=new JSDOM(ids.map(id=>`<section id="${id}"></section>`).join(''));
const $=id=>dom.window.document.getElementById(id);let release,wait=false;
const scope={createPageTrail,$,window:{scrollY:15,scrollTo(){}},document:dom.window.document,adminFeed:null,closeChatListener(){},TOOL_NAMES:{},show(id){ids.filter(x=>x!=='adminNav').forEach(x=>$(x).classList.toggle('hidden',id!==x));},suite:{openTool:async()=>{if(wait)await new Promise(r=>release=r);}},openCustomerChat:()=>{},showAdminPage(){}};
vm.createContext(scope);
const route=html.slice(html.indexOf("const adminTrail="),html.indexOf('import{createDelivery}'));
vm.runInContext(route,scope);
vm.runInContext(html.slice(html.indexOf('function openTool(key){'),html.indexOf('document.querySelectorAll(".toolItem[data-tool]")')),scope);
for(let i=0;i<100;i++){
 vm.runInContext("adminTrail.reset('adminHome');openTool('customers');rememberAdminRoute('chat:a');",scope);
 $('adminTool').style.display='none';$('adminTool').classList.add('hidden');
 await scope.backAdminPage();assert.equal($('adminTool').style.display,'');assert.equal($('adminTool').classList.contains('hidden'),false);
}
// An unresolved read during Back cannot swallow the next user navigation.
vm.runInContext("adminTrail.reset();openTool('customers');rememberAdminRoute('chat:a');",scope);
wait=true;const back=scope.backAdminPage();wait=false;scope.openTool('gallery');release();await back;
assert.equal(vm.runInContext('adminTrail.back().id',scope),'tool:customers');
console.log('PASS 100 tool/chat/back cycles and new navigation during a slow return');dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
