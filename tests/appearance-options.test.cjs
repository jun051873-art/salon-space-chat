const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<body><main></main></body>');const document=dom.window.document;
const scope=vm.createContext({document,matchMedia:()=>({matches:false}),Date,Math,console,setTimeout:()=>1,clearTimeout:()=>{}});
vm.runInContext(fs.readFileSync('salon-theme.js','utf8').replace(/^export /mg,''),scope);
let options=0;for(const role of ['admin','customer']){
 const host=document.querySelector('main');scope.mountThemeEditor(host,{},()=>{},{audience:role});
 for(const field of host.querySelectorAll('select[data-theme]'))for(const option of field.options){const key=field.dataset.theme;assert.equal(scope.normalizeTheme({[key]:option.value})[key],option.value,role+' unsupported '+key+' '+option.value);options++;}
 for(const field of host.querySelectorAll('[data-theme]'))assert(field.dataset.theme in scope.normalizeTheme(),role+' discarded field '+field.dataset.theme);
}
const variables={};scope.applyTheme({customerBubble:'#123456',shopBubble:'#234567',shopText:'#345678',greetingColor:'#456789',navText:'#567890',iconShape:'rounded',autoReplyRadius:31},{style:{setProperty:(k,v)=>variables[k]=v},dataset:{}});
assert.equal(variables['--salon-customer-bubble'],'#123456');assert.equal(variables['--salon-shop-bubble'],'#234567');assert.equal(variables['--salon-shop-text'],'#345678');assert.equal(variables['--salon-nav-text'],'#567890');assert.equal(variables['--salon-icon-radius'],'22px');assert.equal(variables['--salon-auto-reply-radius'],'31px');
const weather=scope.normalizeTheme({backgroundMode:'weather',randomBackground:true,weatherCity:'keelung'});assert.equal(weather.randomBackground,false);assert.equal(weather.weatherCity,'keelung');
console.log('PASS '+options+' both-role dropdown choices recognized; no discarded settings fields; color/shape variables and weather/random exclusivity');dom.window.close();
