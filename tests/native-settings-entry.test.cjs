const {JSDOM}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<body><header id="customerHeader"></header><main id="inbox"></main>',{url:'https://example.com/customer.html?appBuild=16',runScripts:'outside-only'});const w=dom.window;
 w.matchMedia=()=>({matches:true});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.eval(fs.readFileSync('notification-help.js','utf8').replaceAll('export ',''));
 let reject,calls=0;const h=w.mountNotificationHelp(w.document.querySelector('main'),()=>{calls++;return new Promise((a,b)=>reject=b);},'customer');
 h.open();const panel=w.document.getElementById('notificationStatusDialog');
 assert.equal(panel.open,true);assert.match(panel.textContent,/正在設定/);h.open();assert.equal(calls,1);
 reject(Error('尚未收到 App 連線'));await new Promise(r=>setImmediate(r));
 assert.equal(panel.open,true);assert.match(panel.textContent,/尚未收到 App 連線/);assert.equal(panel.querySelector('.notificationHelp').getAttribute('aria-busy'),'false');
 const suite=fs.readFileSync('salon-suite.js','utf8');const handler=suite.match(/task\(\$\('settingsNotify'\),async\(\)=>\{([\s\S]*?)\}\);\}/)[1];
 let opened=0;w.ctx={openNotificationSettings:()=>{opened++;},enableNotifications:()=>{throw Error('should open panel first')}};await w.eval('(async()=>{'+handler+'})()');assert.equal(opened,1);
 dom.window.close();console.log('PASS native settings opens immediately, pending single request, error remains visible, actual settings handler opens panel');
})().catch(e=>{console.error(e);process.exitCode=1});
