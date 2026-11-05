const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {JSDOM}=require('jsdom');
(async()=>{
 const helpers=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('admin-designers.js','utf8')).toString('base64'));
 const source=fs.readFileSync('salon-suite.js','utf8'),dom=new JSDOM('<section id="admin"><div id="list"></div></section>');
 const config={designers:[{id:'tao',name:'小桃'},{id:'nana',name:'NaNa'}]},ctx={...helpers,document:dom.window.document,config,designerList:c=>c.designers||[],Map,Date,Number,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),$:id=>dom.window.document.getElementById(id),millis:v=>typeof v==='number'?v:v?.seconds*1000||0,unreadSummary:()=>({}),icon:()=>'<svg></svg>',avatar:()=>'',appointmentLabel:()=>'',hydrateInboxPhotos:()=>{},bindSwipe:()=>{},bindLongPress:()=>{},task:()=>{},openChat:()=>{},demo:false};
 vm.createContext(ctx);
 const code=source.slice(source.indexOf(' let inboxDocs=[]'),source.indexOf(' async function loadDesignerHistory'));
 vm.runInContext('const inboxPhotos=new Map();'+code,ctx);
 ctx.docs=[{id:'a',data:()=>({name:'甲',assignedDesignerId:'tao',lastCustomerMessageAt:1})},{id:'b',data:()=>({name:'乙',assignedDesignerId:'nana',lastCustomerMessageAt:2})}];
 vm.runInContext('renderInbox(docs)',ctx);assert.equal(dom.window.document.querySelectorAll('[data-open-room]').length,2);assert.equal(dom.window.document.querySelector('#inboxDesigner').options.length,4);
 vm.runInContext("designerFilter='tao';renderInbox(docs)",ctx);assert.equal(dom.window.document.querySelector('[data-open-room]').dataset.openRoom,'a');assert.equal(dom.window.document.querySelectorAll('[data-open-room]').length,1);
 vm.runInContext("designerFilter='';renderInbox(docs)",ctx);assert(dom.window.document.querySelector('.empty'));
 assert(source.includes('id="roomDesigner"'));assert(source.includes('await assignRoomDesigner(u)'));
 console.log('PASS actual inbox DOM render, designer dropdown, matching/nonmatching rows, empty state, assignment action binding');
})().catch(e=>{console.error(e);process.exit(1)});
