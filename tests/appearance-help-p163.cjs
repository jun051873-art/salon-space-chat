const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('salon-theme.js','utf8');
const dom=new JSDOM('<body><main></main></body>');
const context={document:dom.window.document,matchMedia:()=>({matches:false}),setTimeout,clearTimeout};vm.createContext(context);
vm.runInContext(src.replace(/export /g,''),context);
for(const audience of ['admin','customer']){
const host=dom.window.document.querySelector('main');context.mountThemeEditor(host,{},()=>{}, {audience});
assert(host.querySelector('.appearanceExample'));assert(host.querySelector('.appearanceNote').textContent.includes(audience==='admin'?'店家端':'客人端'));
const input=host.querySelector('[data-theme=iconColor]');input.value='#123456';input.oninput();
assert.equal(host.querySelector('.appearanceSample').style.getPropertyValue('--salon-icon'),'#123456');
assert.equal(host.querySelectorAll('#themePublish').length,1);
assert(!host.querySelector('.appearanceSample [id]'));
if(audience==='admin'){
assert.equal(host.querySelector('[data-theme=layout]').options.length,4);
assert(host.querySelector('[data-theme=navBackground]').closest('label').hidden);
[...host.querySelectorAll('button')].find(b=>b.textContent==='調整導覽列玻璃 →').click();
assert.equal(host.querySelector('[data-surface-page]').value,'nav');assert(host.querySelector('.surfaceEditor').closest('details').open);
}
}
console.log('PASS both audience editors mount, scoped live draft examples, unique IDs, precise help and supported layouts');
