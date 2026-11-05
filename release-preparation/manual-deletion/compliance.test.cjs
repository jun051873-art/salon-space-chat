const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let submit;
const fields={deleteRequest:{addEventListener:(type,fn)=>submit=fn},requestName:{value:'測試客人 & A'},requestPhone:{value:'0900000000'},requestNote:{value:'測試\n內容'},requestStatus:{}};
const window={location:{href:''}};
vm.runInNewContext(fs.readFileSync(__dirname+'/customer-delete-request.js','utf8'),{document:{getElementById:id=>fields[id]},window});
submit({preventDefault(){}});
assert(window.location.href.startsWith('mailto:doujun051873@gmail.com?'));
assert(new URL(window.location.href).searchParams.get('body').includes('測試客人 & A'));
assert(fields.requestStatus.textContent.includes('自行寄出'));
for(const file of ['customer-privacy.html','customer-terms.html','customer-delete-account.html']){
 const text=fs.readFileSync(__dirname+'/'+file,'utf8');assert(!text.includes('上架準備稿'));assert(text.includes('com.jun051873.salonspace'));assert(text.includes('doujun051873@gmail.com'));
}
let touched=false;
let source=fs.readFileSync(__dirname+'/customer-compliance.js','utf8').replace('export function','function');
vm.runInNewContext(source,{document:{body:{classList:{contains:()=>false}},getElementById:()=>{touched=true}}});
assert(!touched,'owner pages must not be touched');
console.log('PASS public policies, encoded email request, explicit send instruction, owner-page isolation');
