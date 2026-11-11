const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const lifecycle=fs.readFileSync('dialog-lifecycle.js','utf8').replaceAll('export function','function');
const suite=fs.readFileSync('salon-suite.js','utf8');
function fixture(role){
 const dom=new JSDOM(`<body class="${role}App"><button id="opener">開啟</button><input id="draft" value="尚未傳送的訊息"></body>`),w=dom.window;
 const closeEvents=[];let gaps=0;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.open=false;closeEvents.push(()=>this.dispatchEvent(new w.Event('close')));if(!w.document.querySelector('dialog[open]'))gaps++;};
 const c=vm.createContext({document:w.document,admin:role==='admin',activeTool:'',esc:String,icon:()=>'', $:id=>w.document.getElementById(id)});
 vm.runInContext(lifecycle,c);vm.runInContext(suite.slice(suite.indexOf(' function modal('),suite.indexOf(' async function store(')),c);
 return {dom,w,c,flush:()=>{while(closeEvents.length)closeEvents.shift()();},gaps:()=>gaps};
}
(async()=>{
 for(const role of ['admin','customer']){
 const f=fixture(role),{c,w}=f;
 for(let i=0;i<500;i++){
 const old=c.modal('選單','<button>下一張</button>');
 const next=c.modal('預約','<p data-dialog-status>讀取中</p>',{loading:true});
 assert.equal(w.document.querySelectorAll('dialog').length,1);assert.equal(next.open,true);assert.equal(old.isConnected,false);
 assert.equal(w.document.activeElement,next.querySelector('h2'),'focus stays off inputs and does not open keyboard');
 f.flush();assert.equal(next.isConnected,true,'late close event cannot remove new dialog');
 assert.equal(next.classList.contains('asyncFormDialog'),true);
 next.close();f.flush();assert.equal(w.document.querySelectorAll('dialog').length,0);
 assert.equal(w.document.getElementById('draft').value,'尚未傳送的訊息');
 }
 assert.equal(f.gaps(),500,'only explicit final close exposes background, never card replacement');
 const parent=c.modal('主卡片','<input value="保留">'),child=c.modal('子卡片','',{nested:true});child.close();f.flush();assert(parent.open);assert.equal(parent.querySelector('input').value,'保留');
 const check=c.beginDialogRequest();parent.close();assert.equal(check(),false);f.flush();
 const first=c.beginDialogRequest(),latest=c.beginDialogRequest();assert.equal(first(),false);assert.equal(latest(),true);c.modal('更新','');assert.equal(latest(),false);
 f.dom.window.close();
 }
 // Execute the real asynchronous appointment opening path against delayed/error responses.
 for(const mode of ['success','closed','replaced','failure']){
 const f=fixture('admin'),{c,w}=f;let resolve,reject,mounts=0;
 const gate=new Promise((a,b)=>{resolve=a;reject=b;});
 Object.assign(c,{demo:false,db:{},doc:()=>({}),getDocFromServer:()=>gate,readConfig:async()=>({}),appointmentAvailability:async()=>true,mountAppointmentReminder:host=>{mounts++;host.innerHTML='<input value="預約內容">';}});
 vm.runInContext(suite.slice(suite.indexOf(' async function appointmentReminder('),suite.indexOf(' async function appointmentSettings(')),c);
 const pending=c.appointmentReminder({id:'test',name:'測試'}),original=w.document.querySelector('dialog');
 if(mode==='closed')original.close();
 if(mode==='replaced')c.modal('新卡片','<p>新內容</p>');
 if(mode==='failure')reject(Error('offline'));else resolve({data:()=>({status:'active'})});
 await pending;f.flush();
 assert.equal(mounts,mode==='success'?1:0);
 if(mode==='failure'){assert(original.open);assert.match(original.textContent,/無法讀取.*offline/);assert.equal(original.hasAttribute('aria-busy'),false);}
 if(mode==='replaced')assert.match(w.document.querySelector('dialog').textContent,/新內容/);
 f.dom.window.close();
 }
 console.log('PASS 1000 modal replacement/open-close cycles across both roles; nested drafts, deferred close, cancellation, stale request, offline/error and late-response guards');
})().catch(e=>{console.error(e);process.exitCode=1});
