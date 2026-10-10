const assert=require('node:assert/strict');require('../push-presentation.js');const p=globalThis.SalonPush,o='https://jun051873-art.github.io';
const brands={admin:{name:'舊店名',color:'rose'},customer:{name:'新店名',color:'teal'}};
let n=p.notification({title:'小刀｜新訊息',body:'你好',url:o+'/salon-space-chat/admin.html#chat/u1'},brands,o);
assert.equal(n.title,'小刀｜新訊息');assert.match(n.options.icon,/admin-rose-192.png$/);assert.match(n.options.badge,/admin-badge.png$/);assert.match(n.options.data.url,/#chat\/u1$/);
n=p.notification({title:'新店名',url:'./customer.html'},brands,o);assert.equal(n.title,'新店名');assert.match(n.options.icon,/customer-teal/);assert.match(n.options.data.url,/#chat$/);
assert.equal(p.destination('https://evil.test/admin.html',o).origin,o);assert.equal(p.palette('invalid','admin'),'violet');assert.equal(p.notification({},brands,o).title,'新店名');
console.log('PASS push: sender title, role-specific icons, renamed shop, safe destinations and defaults');
