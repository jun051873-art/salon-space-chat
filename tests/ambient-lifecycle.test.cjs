const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<body><div id="chat" style="position:fixed;z-index:1000"></div></body>',{pretendToBeVisual:true});
const document=dom.window.document;let n=0,modeSeen;const timers=new Map();
const scope={document,matchMedia:()=>({matches:false}),Date,Math,console,setTimeout:fn=>{timers.set(++n,fn);return n},clearTimeout:id=>timers.delete(id),ambientModule:{scenes:{rain:{},snow:{}},resolveScene:async(mode,effect)=>{modeSeen=mode;return {effect:mode==='manual'?effect:'rain'}},mountAmbient:target=>{const el=document.createElement('div');el.className='ambientScene';target.append(el);return ()=>el.remove()}}};
vm.createContext(scope);vm.runInContext(fs.readFileSync('salon-theme.js','utf8').replace(/^export /mg,'').replace("import('./ambient-scenes.js?v=P168')",'Promise.resolve(ambientModule)'),scope);
(async()=>{let cases=0;for(const role of ['admin','customer'])for(const mode of ['manual','random','solar','weather'])for(const greetingEnabled of [false,true])for(const atmosphereEnabled of [false,true])for(const effectLoop of [false,true]){
 document.body.className=role+'App';const raw={effect:'rain',backgroundMode:mode==='random'?'manual':mode,randomBackground:mode==='random',greetingEnabled,atmosphereEnabled,effectLoop};
 await scope.playAtmosphere(raw);scope.showGreeting(raw,{force:true});assert.equal(!!document.querySelector('.ambientScene'),atmosphereEnabled);assert.equal(!!document.querySelector('.salonGreeting'),greetingEnabled);
 if(atmosphereEnabled&&!(mode==='random'&&effectLoop))assert.equal(modeSeen,mode);
 scope.hideGreeting();assert.equal(!!document.querySelector('.ambientScene'),atmosphereEnabled);
 if(atmosphereEnabled&&!effectLoop){for(const fn of [...timers.values()])fn();assert.equal(document.querySelector('.ambientScene'),null);await scope.playAtmosphere(raw);assert.ok(document.querySelector('.ambientScene'),'expired animation must be restartable');}
 scope.stopAtmosphere();scope.hideGreeting();timers.clear();cases++;
}
const style=document.createElement('style');style.textContent='body>.ambientScene{z-index:1100}body>.salonGreeting{z-index:1101}';document.head.append(style);await scope.playAtmosphere({effect:'rain',effectLoop:true});scope.showGreeting({},{force:true});assert.ok(+dom.window.getComputedStyle(document.querySelector('.ambientScene')).zIndex>+dom.window.getComputedStyle(document.getElementById('chat')).zIndex);
const css=fs.readFileSync('salon-theme.css','utf8');assert.match(css,/body>\.ambientScene\{z-index:1100\}/);assert.match(css,/body>\.salonGreeting\{z-index:1101\}/);
console.log('PASS '+cases+' role/mode/switch/duration combinations, expiry/restart and live chat layer ordering');})();
