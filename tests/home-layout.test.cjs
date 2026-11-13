const fs=require('fs'),assert=require('node:assert/strict');
const css=fs.readFileSync('home-celebration.css','utf8');
assert.match(css,/\.homeCelebrationLayer\{position:fixed;inset:0;width:100%;height:100%/);
assert.match(css,/pointer-events:none!important/);assert.match(css,/\[data-preview=true\]\{position:absolute/);
assert.match(css,/@media\(max-width:480px\)\{\.homeDateRange\{grid-template-columns:1fr/);
assert.match(css,/input\[type=date\][^{]*\{[^}]*min-width:0;[^}]*width:100%;[^}]*max-width:100%;font-size:16px/s);
assert.match(css,/\.homeAnimationActions\{display:flex;flex-wrap:wrap/);
for(const file of ['admin.html','customer.html'])assert.match(fs.readFileSync(file,'utf8'),/home-celebration.css\?v=P166/);
console.log('PASS viewport overlay isolation and responsive CSS contracts (not physical-device rendering)');
