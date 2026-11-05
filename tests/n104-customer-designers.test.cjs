const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const source=fs.readFileSync('salon-suite.js','utf8'),helpers=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('admin-designers.js')).toString('base64'));
 const dom=new JSDOM('<div id="toolBody"></div>'),doc=dom.window.document;
 const rows=[{id:'a',name:'甲',assignedDesignerId:'tao',lastCustomerMessageAt:1},{id:'b',name:'乙',assignedDesignerId:'nana',lastCustomerMessageAt:3},{id:'c',name:'丙',lastCustomerMessageAt:2}];
 const ctx={...helpers,customerDesignerFilter:'*',config:{designers:[{id:'tao',name:'小桃'},{id:'nana',name:'NaNa'}]},designerList:c=>c.designers,loadCustomers:async()=>rows,demo:false,customerScope:()=>'',hasDuplicateCustomers:()=>false,countHTML:()=>'',filterHTML:()=>'',manualMatch:()=>true,getFilter:()=>({}),esc:s=>String(s??''),avatar:()=>'',ago:()=>'',pills:()=>'',customTags:()=>[],bindFilter:()=>{},bindGroups:()=>{},task:()=>{},refreshCustomerData:()=>{},moreCustomers:()=>{},$:id=>doc.getElementById(id),body:doc.getElementById('toolBody')};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf(' async function customerPage('),source.indexOf(' function profileFields(')),ctx);
 await vm.runInContext('customerPage(body)',ctx);
 const ids=()=>[...doc.querySelectorAll('[data-person-id]')].map(x=>x.dataset.personId);
 assert.deepEqual(ids(),['b','c','a']);
 const select=doc.getElementById('customerDesigner');assert.equal(select.options.length,4);
 select.value='tao';select.onchange({target:select});assert.deepEqual(ids(),['a']);
 select.value='';select.onchange({target:select});assert.deepEqual(ids(),['c']);
 await vm.runInContext('customerPage(body)',ctx);assert.equal(doc.getElementById('customerDesigner').value,'');assert.deepEqual(ids(),['c']);
 assert(source.includes("assignedDesignerId:chats.get(u.id)?.assignedDesignerId||''"));
 assert(source.includes('syncCustomerRow(u.id,patch);d.close();renderInbox'));
 console.log('PASS customer designer dropdown, newest sorting, unassigned, selection preserved after reload, shared chat assignment');
})().catch(e=>{console.error(e);process.exit(1)});
