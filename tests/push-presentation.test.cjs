const assert=require('node:assert/strict');require('../push-presentation.js');const p=globalThis.SalonPush,o='https://jun051873-art.github.io';
const brands={admin:{name:'舊店名',color:'rose'},customer:{name:'新店名',color:'teal'}};
let n=p.notification({title:'小刀｜新訊息',body:'你好',url:o+'/salon-space-chat/admin.html#chat/u1'},brands,o);
assert.equal(n.title,'小刀');assert.equal(n.options.body,'你好');assert.match(n.options.icon,/admin-rose-192.png$/);assert.match(n.options.badge,/admin-badge.png$/);assert.match(n.options.data.url,/\?view=messages$/);
n=p.notification({title:'新店名',url:'./customer.html'},brands,o);assert.equal(n.title,'店家回覆');assert.match(n.options.icon,/customer-teal/);assert.match(n.options.data.url,/#inbox$/);
n=p.notification({title:'小刀｜專屬空間',body:'小刀｜專屬空間\\n測試訊息',url:o+'/salon-space-chat/admin.html'},brands,o);assert.equal(n.options.body,'測試訊息');
assert.equal(p.destination('https://evil.test/admin.html',o).origin,o);assert.equal(p.palette('invalid','admin'),'violet');assert.equal(p.notification({},brands,o).title,'店家回覆');
for(const separator of ['\n','\r\n','\\n','\\r\\n']){
 n=p.notification({title:'客人甲｜新店名',body:'客人甲｜新店名'+separator+'我想預約',url:o+'/salon-space-chat/admin.html?chat=u1'},brands,o);
 assert.equal(n.title,'客人甲');assert.equal(n.options.body,'我想預約');assert.match(n.options.data.url,/\?view=messages$/);
}
n=p.notification({title:'客人甲｜新店名',body:'你的時段已確認',url:'./customer.html'},brands,o);
assert.equal(n.title,'店家回覆');assert.equal(n.options.body,'你的時段已確認');
n=p.notification({title:'活動通知',body:'第一行\n第二行',url:'./customer.html'},brands,o);
assert.equal(n.title,'店家回覆');assert.equal(n.options.body,'第一行\n第二行');
console.log('PASS push: customer name to admin, shop name to customer, legacy duplicate removal, original message, safe click destinations and icons');

