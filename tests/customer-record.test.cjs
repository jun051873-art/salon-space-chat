const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../salon-suite.js'),'utf8');
const expr=source.match(/const ownerView=(.*);\n const avatar/)[1];const ownerView=vm.runInNewContext(expr);
const customer={name:'客人新改名字',phone:'0900000000',avatar:'photo',adminProfile:{name:'店家保存名字',phone:'0911111111'}};
const view=ownerView(customer);assert.equal(view.name,'店家保存名字');assert.equal(view.phone,'0911111111');assert.equal(view.customerProvided.name,'客人新改名字');assert.equal(view.avatar,'photo');assert.equal(ownerView(view).customerProvided.name,'客人新改名字');
const rules=fs.readFileSync(require('path').join(__dirname,'../firestore.rules'),'utf8');assert.ok(!rules.match(/function profileFields\(\)\{([^}]+)\}/)[1].includes('adminProfile'));
console.log('PASS: owner record takes precedence; customer-submitted identity and photo retained separately; owner fields excluded from customer update allowlist.');
