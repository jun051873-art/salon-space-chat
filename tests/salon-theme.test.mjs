import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../salon-theme.js',import.meta.url),'utf8');
const {normalizeTheme,applyTheme}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const t=normalizeTheme({glass:900,blur:-1,radius:0,duration:99,font:'url(unsafe)',background:'red;display:none',greeting:'a'.repeat(100)});
assert.equal(t.glass,85);assert.equal(t.blur,0);assert.equal(t.radius,12);assert.equal(t.duration,20);assert.equal(t.font,'sans');assert.match(t.background,/^#[0-9a-f]{6}$/i);assert.equal(t.greeting.length,60);
assert.deepEqual(normalizeTheme(null),normalizeTheme());
const vars={},target={style:{setProperty:(k,v)=>vars[k]=v},dataset:{}};
applyTheme({bubble:'#000000',accent:'#ffffff',motion:false,layout:'list'},target);
assert.equal(vars['--salon-bubble-ink'],'#ffffff');assert.equal(vars['--salon-accent-ink'],'#292722');assert.equal(target.dataset.salonMotion,'off');assert.equal(target.dataset.salonLayout,'list');
console.log('PASS: untrusted theme values, clamps, null defaults, contrasting text, reduced motion and scoped preview variables.');

assert.equal(normalizeTheme({effectDuration:999,greetingSize:999,greetingOpacity:0}).effectDuration,20);assert.equal(normalizeTheme({greetingSize:999}).greetingSize,320);assert.equal(normalizeTheme({greetingOpacity:0}).greetingOpacity,35);
const custom=normalizeTheme({buttonColor:'#123456',tagColor:'#ffffff',iconShape:'capsule',navBackground:'#aabbcc',pageColors:{broadcast:{buttonColor:'#aa0033',tagColor:'red;display:none'},'bad"{}':{buttonColor:'#123456'}}});
assert.deepEqual(custom.pageColors,{broadcast:{buttonColor:'#aa0033'}});assert.equal(custom.iconShape,'capsule');applyTheme(custom,target);assert.equal(vars['--salon-button'],'#123456');assert.equal(vars['--salon-tag-ink'],'#292722');assert.equal(vars['--salon-icon-width'],'76px');assert.equal(vars['--salon-nav-background'],'#aabbcc');assert.equal(normalizeTheme({accent:'red;display:none'}).buttonColor,'#8c7158');
const copy=normalizeTheme(custom);copy.pageColors.broadcast.buttonColor='#ffffff';assert.equal(custom.pageColors.broadcast.buttonColor,'#aa0033');
console.log('PASS global/page palettes: validated colors, isolated draft copies, contrast, navigation and icon shapes');

for(const position of ['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right']){assert.equal(normalizeTheme({greetingPosition:position}).greetingPosition,position);}
for(const motif of ['dog','bear','rabbit','panda','moon','star'])assert.equal(normalizeTheme({motif}).motif,motif);
assert.equal(normalizeTheme({greetingPosition:'bad',greetingSide:'bad',greetingStyle:'bad'}).greetingPosition,'bottom-right');
assert.deepEqual(normalizeTheme(normalizeTheme({greetingSide:'left',greetingStyle:'shape'})),normalizeTheme({greetingSide:'left',greetingStyle:'shape'}));
