const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('join.html', 'utf8');
const root = 'https://jun051873-art.github.io/salon-space-chat/';
const expected = [root+'customer.html', 'https://play.google.com/store/apps/details?id=com.jun051873.salonspace'];

async function run(useClipboard) {
 const dom = new JSDOM(html, { url:root+'join.html?from=admin', runScripts:'outside-only' });
 const {window}=dom, {document}=window;
 let copied, shared, printed=0;
 if(useClipboard)Object.defineProperty(window.navigator,'clipboard',{value:{writeText:async url=>{copied=url;}}});
 window.document.execCommand=()=>false;
 window.navigator.share=async data=>{shared=data.url;};
 window.print=()=>{printed++;};
 for(const script of document.scripts)window.eval(script.textContent);
 const panels=[...document.querySelectorAll('.platform')];
 assert.equal(panels.length,2);
 for(const [i,panel] of panels.entries()){
  const input=panel.querySelector('[data-share-url]');
  assert.equal(input.value,expected[i]);
  assert.equal(panel.querySelector('[data-invite-link]').href,expected[i]);
  assert.equal(panel.querySelector('a.primary').href,expected[i]);
  const picture=panel.querySelector('.qr').getAttribute('src');
  assert.equal(picture,i===0?'./customer-qr.svg':'./android-play-qr.svg');
  assert.equal(panel.querySelector('[download]').getAttribute('href'),picture);
  assert.ok(fs.existsSync(picture));
  await panel.querySelector('[data-copy]').onclick();
  if(useClipboard)assert.equal(copied,expected[i]);
  else{
   assert.equal(document.activeElement,input);
   assert.match(panel.querySelector('[role=status]').textContent,/複製/);
  }
  await panel.querySelector('[data-share]').onclick();
  assert.equal(shared,expected[i]);
 }
 assert.equal(document.querySelector('.actions [download]').href,document.querySelector('.printSheet').src);
 await document.getElementById('printPoster').onclick();
 assert.equal(printed,1);
 window.close();
}

(async()=>{
 await run(true);
 await run(false);
 const admin=new JSDOM(fs.readFileSync('admin.html','utf8')).window.document;
 assert.equal(admin.querySelector('#adminAccount').tagName,'DETAILS');
 assert.equal(admin.querySelector('#adminAccount').open,false);
 assert.equal(admin.querySelectorAll('#adminSignOut').length,1);
 assert.match(fs.readFileSync('salon-suite.js','utf8'),/join\.html\?from=admin/);
 console.log('PASS iPhone and Android invitation links, sharing, clipboard fallback, individual QR downloads, and print');
})().catch(error=>{console.error(error);process.exitCode=1;});
