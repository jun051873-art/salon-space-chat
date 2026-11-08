const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const dom=new JSDOM('<body></body>',{url:'https://example.test'}),w=dom.window;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
const code=fs.readFileSync('profile-scene.js','utf8').replace(/^import .*;$/mg,'').replace('export function','function');
let saves=0,returns=0;
const scope={document:w.document,Date,setTimeout,clearTimeout,scenes:{},randomScene:()=>'',icon:()=>'',resolveScene:async()=>({}),mountAmbient:()=>()=>{},sceneArtwork:()=>'',mountPhotoPicker:()=>({choose(){}})};
vm.createContext(scope);vm.runInContext(code,scope);
(async()=>{
const d=scope.openProfileScene({person:{id:'a',name:'Alice',avatar:'data:image/png;base64,YQ=='},onBeforeClose:async()=>{returns++;},onSaveProfile:async(p,baseline)=>{saves++;assert.equal(baseline.name,'Alice');return p;}}),q=s=>d.querySelector(s);
await q('[data-edit]').onclick();assert(d.querySelector('.profileScene').classList.contains('isEditing'));
q('[data-words]').click();assert.equal(q('.sceneSheet').hidden,false);
await q('[data-exit]').onclick();assert(q('.sceneSheet').hidden);assert(d.querySelector('.profileScene').classList.contains('isEditing'));assert.equal(returns,0);
q('[data-words]').click();const input=q('[data-name]');input.value='New';input.dispatchEvent(new w.Event('input'));
d.updatePerson({name:'Remote',avatar:'data:image/png;base64,Yg=='});assert.equal(q('h1').textContent,'New','live data must preserve edited name');assert.equal(q('.sceneAvatar img').getAttribute('src'),'data:image/png;base64,Yg==');
// Close the sheet and cancel edit: returns to saved profile, not home.
await q('[data-exit]').onclick();await q('[data-exit]').onclick();assert.equal(q('h1').textContent,'Remote');assert.equal(returns,0);
q('.sceneAvatar').click();assert(q('.sceneLightbox'));await q('[data-exit]').onclick();assert.equal(q('.sceneLightbox'),null);assert.equal(returns,0);
await q('[data-exit]').onclick();assert.equal(returns,1);assert.equal(d.isConnected,false);
const second=scope.openProfileScene({person:{name:'Alice'},onSaveProfile:async p=>{saves++;return p;},onBeforeClose:async()=>{returns++;}});
await second.querySelector('[data-edit]').onclick();await second.querySelector('[data-edit]').onclick();assert.equal(saves,1);assert(second.isConnected,'save stays on profile');assert.equal(returns,1);second.close();
dom.window.close();console.log('PASS profile DOM: nested sheet, cancel editing, lightbox, return one level, save stays, remote update preserves draft');
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close();});
