const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');const{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<body><div id="preview"></div></body>');global.document=dom.window.document;
 const module=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('broadcast-preview.js')).toString('base64'));
 const line=fs.readFileSync('salon-suite.js','utf8').split('\n').find(s=>s.startsWith('export function messageHTML'));
 const renderMessage=vm.runInNewContext('('+line.replace('export ','')+')',{millis:v=>v,esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),chatImageExpired:()=>false,customerRevisionOpen:()=>false});
 const photo='data:image/jpeg;base64,AA==',blocks=[{type:'text',text:'第一則\n第二行 <script>alert(1)</script>'},{type:'photo',data:photo,name:'a.jpg',text:'照片說明',width:100,height:200},{type:'text',text:'最後一則'}];
 const opts={renderMessage,applyTheme:(t,host)=>host.style.setProperty('--salon-shop-bubble',t.shopBubble),config:{name:'專屬空間',theme:{shopBubble:'#ffeeff'}}};
 const host=document.getElementById('preview');module.renderBroadcastPreview(host,blocks,opts);
 assert.equal(host.querySelectorAll('.bubbleRow').length,3);assert.equal(host.querySelectorAll('.own').length,0);assert.equal(host.querySelector('img').src,photo);assert.equal(host.querySelector('script'),null);assert.equal(host.querySelector('[data-image-status]'),null);assert.equal(host.querySelector('[data-edit]'),null);assert.equal(host.style.getPropertyValue('--salon-shop-bubble'),'#ffeeff');
 assert(host.querySelectorAll('.msg')[0].textContent.includes('第一則\n第二行'));assert.equal(host.querySelectorAll('.msg')[2].textContent,'最後一則');
 const msg=host.querySelectorAll('.msg')[1];assert.equal(msg.firstChild.textContent,'照片說明','caption precedes image exactly as live messageHTML');
 let dialog;const modal=(title,html,options)=>{assert.equal(options.nested,true);dialog=document.createElement('dialog');dialog.innerHTML=html;document.body.append(dialog);dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new dom.window.Event('close'));};return dialog;};
 for(const action of ['[data-edit]','close','cancel','[data-send]']){const p=module.confirmBroadcastPreview({modal,blocks,count:4,...opts});assert.equal(dialog.querySelectorAll('img').length,1);if(action==='close')dialog.close();else if(action==='cancel')dialog.dispatchEvent(new dom.window.Event('cancel'));else dialog.querySelector(action).click();assert.equal(await p,action==='[data-send]');dialog.remove();}
 const source=fs.readFileSync('salon-suite.js','utf8');assert(source.includes('if(!await confirmBroadcastPreview('));assert(source.indexOf('if(!await confirmBroadcastPreview(')<source.indexOf("const id=crypto.randomUUID(),total=recipients.length*valid.length"));
 module.renderBroadcastPreview(host,[{type:'photo',data:photo,text:''}],opts);assert.equal(host.querySelector('.msg').textContent,'');
 console.log('PASS actual chat renderer, image/caption order, escaping, customer theme, cancel/close/back, explicit send confirmation');
})();
