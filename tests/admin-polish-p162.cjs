const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('salon-suite.js','utf8');
const keys=['customers','tags','approvals','designers','phrases','broadcast','autoreply','welcome','automation','gallery','notice','board','theme','feedback','settings'];
const dom=new JSDOM('<body><div class="shopHeader"></div><div class="toolGrid">'+keys.map(k=>`<button data-tool="${k}" class="toolItem"><span></span><b>${k}</b></button>`).join('')+'</div></body>');
let opened;const ctx={document:dom.window.document,ctx:{openTool:k=>opened=k},icon:()=>'<svg></svg>',editShopPortrait:()=>{}};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf(' function organizeAdmin()'),source.indexOf(' async function myProfile(')),ctx);ctx.organizeAdmin();
const doc=dom.window.document;for(const k of ['customers','broadcast','gallery','notice','board','display']){const b=doc.querySelector(`[data-tool=${k}]`);assert(b);assert(!b.closest('details'));b.click();assert.equal(opened,k);}
for(const k of ['tags','approvals','designers','theme','autoreply','feedback'])assert(doc.querySelector(`[data-tool=${k}]`).closest('details'));
assert.equal(doc.querySelectorAll('[data-tool=broadcast]').length,1);assert.equal(doc.querySelector('.inviteCard').getAttribute('href'),'./join.html?from=admin');
assert(!source.includes('bAddProduct'));assert(source.includes("confirmAction('傳送給 '"));assert(source.includes('bRetryPrevious'));
console.log('PASS direct home entry routes, collapsed advanced settings, no duplicate broadcast, invitation and preserved broadcast confirmation/retry');
