const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<body><main id="editor"></main><aside id="preview"></aside></body>',{pretendToBeVisual:true});
const document=dom.window.document;let nextTimer=0;const timers=new Map();
const c=vm.createContext({document,matchMedia:()=>({matches:false}),Date,Math,console,setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer},clearTimeout:id=>timers.delete(id),ambientModule:{scenes:{rain:{},snow:{}},resolveScene:async(mode,effect)=>({effect}),mountAmbient:(target,scene)=>{const el=document.createElement('div');el.className='testAmbient';el.dataset.effect=scene.effect;target.append(el);return ()=>el.remove();}}});
const source=fs.readFileSync('salon-theme.js','utf8').replace(/^export /mg,'').replace("import('./ambient-scenes.js?v=P168')",'Promise.resolve(ambientModule)');vm.runInContext(source,c);
(async()=>{
let combos=0,fieldsChecked=0;
for(const role of ['admin','customer']){
 document.body.className=role+'App';
 for(const motion of [false,true])for(const greetingEnabled of [false,true])for(const greetingMotion of [false,true])for(const atmosphereEnabled of [false,true]){
  const raw={motion,greetingEnabled,greetingMotion,atmosphereEnabled,effect:'rain',effectLoop:true};
  await c.playAtmosphere(raw);c.showGreeting(raw,{force:true});
  assert.equal(!!document.body.querySelector(':scope > .testAmbient'),atmosphereEnabled);
  const greeting=document.body.querySelector(':scope > .salonGreeting');assert.equal(!!greeting,greetingEnabled);
  if(greeting)assert.equal(greeting.classList.contains('still'),!greetingMotion);
  c.hideGreeting();assert.equal(!!document.body.querySelector(':scope > .testAmbient'),atmosphereEnabled,'hiding greeting must leave background untouched');
  c.stopAtmosphere();combos++;
 }
 // The real editor handlers must retain every unrelated setting when one control changes.
 const host=document.getElementById('editor');let published;
 const base=c.normalizeTheme({motion:true,greetingMotion:true,atmosphereEnabled:true,greetingEnabled:true,effect:'rain',surfaces:{header:{start:'#123456'}},pageColors:{customers:{buttonColor:'#abcdef'}}});
 c.mountThemeEditor(host,base,async value=>{published=value;},{audience:role});
 const keys=[...host.querySelectorAll('[data-theme]')].map(x=>x.dataset.theme);
 for(const key of keys){
  c.mountThemeEditor(host,base,async value=>{published=value;},{audience:role});
  const el=host.querySelector(`[data-theme="${key}"]`);
  if(el.type==='checkbox')el.checked=!el.checked;
  else if(el.tagName==='SELECT')el.value=[...el.options].find(o=>o.value!==el.value)?.value||el.value;
  else if(el.type==='color')el.value=el.value==='#123456'?'#654321':'#123456';
  else if(['number','range'].includes(el.type))el.value=Number(el.value)===Number(el.min)?el.max:el.min;
  else el.value='測試招呼';
  el.oninput();await host.querySelector('#themePublish').onclick({currentTarget:host.querySelector('#themePublish')});
  for(const k of Object.keys(base)){
   if(k===key||(['randomBackground','backgroundMode'].includes(key)&&['randomBackground','backgroundMode'].includes(k)))continue;
   assert.deepEqual(JSON.parse(JSON.stringify(published[k])),JSON.parse(JSON.stringify(base[k])),`${role} ${key} changed unrelated ${k}`);
  }
  fieldsChecked++;
 }
}
// Saving an unrelated field must not rewrite a previously saved background mode.
let legacySaved;const editor=document.getElementById('editor');
c.mountThemeEditor(editor,{backgroundMode:'weather',greetingEnabled:false},async t=>{legacySaved=t;});
await editor.querySelector('#themePublish').onclick({currentTarget:editor.querySelector('#themePublish')});assert.equal(legacySaved.backgroundMode,'weather');assert.equal(legacySaved.greetingEnabled,false);
// Run the actual audience save handler, including the legacy shared-theme fallback.
const suite=fs.readFileSync('salon-suite.js','utf8'),themeSettings=suite.match(/ async function themeSettings[^\n]+/)[0];
for(const hasOwner of [false,true]){
 const cfg={theme:{greetingEnabled:true,effect:'rain'},...(hasOwner?{adminTheme:{effect:'snow'}}:{})};let save;
 const shell=document.createElement('div');document.body.append(shell);
 const saveContext=vm.createContext({readConfig:async()=>cfg,$:id=>document.getElementById(id),mountHomeCelebrationEditor:()=>{},resolveChatTheme:t=>t,config:cfg,profile:null,mountThemeEditor:(_host,_raw,fn)=>save=fn,saveConfig:async patch=>Object.assign(cfg,patch),setTimeout:()=>{},syncBrand:()=>{}});
 vm.runInContext(themeSettings,saveContext);await saveContext.themeSettings(shell);
 const oldOwner=JSON.parse(JSON.stringify(cfg.adminTheme||cfg.theme));await save({greetingEnabled:false,effect:'petals'});assert.deepEqual(cfg.adminTheme,oldOwner);
 const oldCustomer=JSON.parse(JSON.stringify(cfg.theme));document.getElementById('themeOwner').click();await save({effect:'sun'});assert.deepEqual(cfg.theme,oldCustomer);shell.remove();
}
const stage=document.getElementById('preview'),live={effect:'rain',effectLoop:true,motion:false,atmosphereEnabled:true,greetingEnabled:true,greetingMotion:true};
await c.playAtmosphere(live);const original=document.body.querySelector(':scope > .testAmbient');
await c.playAtmosphere({...live,greetingEnabled:false,greetingFill:'#123456',radius:40,motion:true});assert.equal(document.body.querySelector(':scope > .testAmbient'),original,'unrelated appearance changes must not restart the scene');
c.showGreeting(live,{force:true});const mainGreeting=document.body.querySelector(':scope > .salonGreeting');
c.showGreeting(live,{force:true,target:stage});c.hideGreeting(stage);assert(mainGreeting.isConnected);assert(original.isConnected);
await c.playAtmosphere({...live,effect:'snow'},{target:stage});c.stopAtmosphere(stage);assert(original.isConnected);assert(mainGreeting.isConnected);
c.hideGreeting();c.stopAtmosphere();dom.window.close();
console.log(`PASS ${combos} both-role effect combinations; ${fieldsChecked} independent editor control changes; live/preview timers and teardown isolated`);
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
