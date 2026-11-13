const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<body><main id="editor"></main></body>',{pretendToBeVisual:true});const document=dom.window.document;let reduced=false;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))};
 const scope=vm.createContext({document,matchMedia:()=>({matches:reduced}),Date,Math,console,setTimeout:()=>1,clearTimeout:()=>{},ambientModule:{scenes:{rain:{},snow:{}},resolveScene:async(mode,effect)=>({effect}),mountAmbient:(target,scene)=>{const el=document.createElement('i');el.className='testAmbient';el.dataset.effect=scene.effect;target.append(el);return ()=>el.remove()}}});
 vm.runInContext(fs.readFileSync('salon-theme.js','utf8').replace(/^export /mg,'').replace("import('./ambient-scenes.js?v=P168')",'Promise.resolve(ambientModule)'),scope);
 const host=document.getElementById('editor');let saved;
 for(const role of ['admin','customer']){
  scope.mountThemeEditor(host,{greetingEnabled:false,atmosphereEnabled:false,motif:'rocket',effect:'snow'},async t=>saved=t,{audience:role});
  host.querySelector('#themeGreetingTest').click();let d=document.querySelector('.greetingPreviewDialog');assert(d.querySelector('.salonGreeting'),'disabled live greeting must still be previewable');assert.equal(d.querySelector('.salonGreeting').dataset.action,'launch');assert.match(d.querySelector('.effectPreviewStatus').textContent,/不會自動啟用/);d.querySelector('button').click();assert(!document.querySelector('.greetingPreviewDialog'));
  host.querySelector('#themeEffectTest').click();await new Promise(r=>setImmediate(r));d=document.querySelector('.effectPreviewDialog');assert(d.querySelector('.testAmbient'),'disabled live atmosphere is previewable');d.querySelector('button').click();
  await host.querySelector('#themePublish').onclick({currentTarget:host.querySelector('#themePublish')});assert.equal(saved.greetingEnabled,false);assert.equal(saved.atmosphereEnabled,false);
 }
 const motifs=['cloud','flower','cat','dog','bear','rabbit','panda','moon','star','sun','heart','robot','rocket','coffee','scissors','gift','none'];
 let cases=0;for(const motif of motifs)for(const motion of [false,true])for(const position of ['top-left','middle-center','bottom-right']){
  scope.showGreeting({motif,greetingMotion:motion,greetingPosition:position},{force:true});const el=document.querySelector('.salonGreeting');assert.equal(el.dataset.motif,motif);assert.equal(el.dataset.position,position);assert.equal(el.classList.contains('still'),!motion);if(motif!=='none')assert(el.querySelector('.greetingMark').textContent);scope.hideGreeting();cases++;
 }
 reduced=true;scope.showGreeting({greetingMotion:true},{force:true});assert(document.querySelector('.salonGreeting').classList.contains('still'));scope.hideGreeting();reduced=false;
 scope.mountThemeEditor(host,{effect:'fireworks',greetingMotion:false,motif:'none'},()=>{});assert(host.querySelector('[data-theme="effectDirection"]').closest('label').hidden);assert(host.querySelector('[data-theme="greetingDirection"]').closest('label').hidden);assert(host.querySelector('[data-theme="greetingSide"]').closest('label').hidden);
 const{resolveChatTheme}=await import('../home-celebration.js');const raw={followHomeCelebration:true,atmosphereEnabled:true,greetingEnabled:false,randomBackground:true,effect:'rain'},config={enabled:true,automatic:true,birthday:true,manual:true,effect:'petals',start:'2026-12-20',end:'2027-01-02'};
 assert.equal(resolveChatTheme(raw,config,{birthMonth:12,birthDay:25},new Date('2026-12-25T12:00:00+08:00')).effect,'gifts');
 assert.equal(resolveChatTheme(raw,config,{},new Date('2027-01-01T12:00:00+08:00')).effect,'petals');
 const christmas=resolveChatTheme(raw,{...config,manual:false},{},new Date('2026-12-25T12:00:00+08:00'));assert.equal(christmas.effect,'snow');assert.equal(christmas.randomBackground,false);assert.equal(christmas.greetingEnabled,false);
 assert.equal(resolveChatTheme(raw,config,{},new Date('2026-11-13T12:00:00+08:00')),raw,'no holiday falls back to original random mode');
 assert.equal(resolveChatTheme({...raw,followHomeCelebration:false},config,{},new Date('2026-12-25T12:00:00+08:00')).effect,'rain');
 assert.equal(resolveChatTheme({...raw,atmosphereEnabled:false},config,{},new Date('2026-12-25T12:00:00+08:00')).atmosphereEnabled,false);
 dom.window.close();console.log('PASS '+cases+' greeting motif/motion/anchor cases; both-role disabled preview, no silent enable, reduced motion, irrelevant controls hidden, birthday/manual/festival/fallback priority');
})().catch(e=>{console.error(e);process.exitCode=1});
