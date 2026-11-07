const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('salon-suite.js','utf8');
const fn=source.slice(source.indexOf(' async function broadcast(body)'),source.indexOf('  async function replyEditor(body)'));
(async()=>{
const dom=new JSDOM('<div id="body"></div>',{url:'https://example.test'}),document=dom.window.document,body=document.getElementById('body');
let draft=null,zoomBound=0,resolvePhoto;const tasks=new Map();
const context={document,localStorage:dom.window.localStorage,auth:{currentUser:{uid:'owner'}},ADMIN_UID:'owner',listOnce:async()=>[{id:'a',name:'甲',tags:['常客']},{id:'b',name:'乙',tags:['新客']}],ownerView:x=>x,broadcastEligible:()=>true,customTags:x=>x.tags,delivery:{readDraft:()=>null,saveDraft:(k,x)=>draft=JSON.parse(JSON.stringify(x))},$:id=>document.getElementById(id),esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),pills:()=>'',toast:()=>{},fail:e=>{throw e},task:(el,handler)=>tasks.set(el.id,handler),bindPhotoViewer:()=>zoomBound++,chatPhoto:()=>new Promise(r=>resolvePhoto=r),confirmAction:async()=>false};
vm.createContext(context);vm.runInContext(fn+'\nthis.run=broadcast;',context);await context.run(body);
assert.equal(document.querySelector('#bCount').textContent,'全部客人 · 2 位');
document.querySelector('#bByTag').click();assert.match(document.querySelector('#bCount').textContent,/0 位/);document.querySelector('[data-b-tag]').click();assert.match(document.querySelector('#bCount').textContent,/1 位/);
document.querySelector('#bAll').click();document.querySelector('#bAddText').click();assert.equal(document.querySelectorAll('textarea').length,2);
const text=document.querySelector('textarea');text.value='測試草稿';text.oninput();assert.equal(draft[0].text,'測試草稿');
document.querySelector('[data-b-up="1"]').click();assert.equal(draft[1].text,'測試草稿');
const input=document.querySelector('#bPhotoFile');Object.defineProperty(input,'files',{value:[{name:'photo.jpg'}]});const pending=input.onchange();assert.equal(document.querySelector('#bAddText').disabled,true);document.querySelector('#bAddText').onclick();assert.equal(document.querySelectorAll('textarea').length,2);resolvePhoto({data:'data:image/jpeg;base64,YQ=='});await pending;
assert.equal(zoomBound,1);assert.equal(document.querySelector('#bAddText').disabled,false);assert.equal(document.querySelectorAll('textarea').length,3);
await tasks.get('bSend')(); // cancelling confirmation must not invoke any backend
while(document.querySelector('[data-b-remove]'))document.querySelector('[data-b-remove]').click();assert.ok(document.querySelector('.broadcastEmpty'));
console.log('PASS broadcast: tags, all recipients, draft, reorder, photo locking/viewer, remove-all and cancelled send');
// Execute route dispatch with every renderer mocked: never writes live customer data.
const route=source.slice(source.indexOf(' async function openTool(key)'),source.indexOf('\n async function page(',source.indexOf(' async function openTool(key)')));
assert.ok(route.length<6000,'route boundary');
const d2=new JSDOM('<h2 id="toolTitle"></h2><div id="toolBody"></div>');let called='';const c={$:id=>d2.window.document.getElementById(id),activeTool:'',roomUnsub:null,contentUnsub:null,esc:x=>x,ctx:{openTool:k=>called=k}};
for(const name of ['approvalPage','feedbackInbox','stickerEditor','tagLibrary','customerPage','broadcast','products','calendar','holidayCalendar','boardEditor','themeSettings','automations'])c[name]=async()=>called=name;
c.settings=async(b,k)=>called=k;vm.createContext(c);vm.runInContext(route+'\nthis.run=openTool;',c);
const routes={approvals:'approvalPage',feedback:'feedbackInbox',stickers:'stickerEditor',tags:'tagLibrary',customers:'customerPage',broadcast:'broadcast',gallery:'products',notice:'calendar',holidays:'holidayCalendar',board:'boardEditor',theme:'themeSettings',automation:'automations',settings:'settings',autoreply:'autoreply',welcome:'welcome',phrases:'phrases',designers:'designers',switches:'switches'};
for(const [key,expected]of Object.entries(routes)){await c.run(key);assert.equal(called,expected,key);}
await c.run('display');const nested=[...d2.window.document.querySelectorAll('[data-manage-tool]')];assert.equal(nested.length,5);for(const b of nested){b.click();assert.equal(called,b.dataset.manageTool);}
c.customerPage=async()=>{throw Error('offline')};await c.run('customers');assert.ok(d2.window.document.getElementById('retryTool'));
console.log('PASS admin: 18 routes, 5 nested content entrances, failed-load retry');
})().catch(e=>{console.error(e);process.exitCode=1});
