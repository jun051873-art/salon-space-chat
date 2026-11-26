const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const origin = 'https://example.test/salon-space-chat/';
const owner = 'HcFJGmzHw6MYoWbFmtq9IyFSjvL2';

async function open(role, search = '', { waitForConfig } = {}) {
 const url = new URL(role + '.html' + search, origin);
 const html = fs.readFileSync(role + '.html', 'utf8');
 const dom = new JSDOM(html, { url: url.href, pretendToBeVisual: true, runScripts: 'outside-only' });
 const { window } = dom;
 const context = dom.getInternalVMContext();
 const user = { uid: role === 'admin' ? owner : 'test-customer' };
 const auth = { currentUser: user };
 const observers = [];
 const reads = new Map();
 const modules = new Map();
 window.scrollTo = () => {};
 window.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
 window.HTMLDialogElement.prototype.close = function(){this.open=false;this.dispatchEvent(new window.Event("close"));};
 window.Element.prototype.getAnimations = () => [];
 window.ResizeObserver = class { observe() {} disconnect() {} };
 window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
 window.fetch = async () => ({ ok: true, json: async () => ({ features: {} }) });
 window.AbortSignal = AbortSignal;
 window.Headers = Headers;
 window.Response = Response;
 window.Request = Request;
 window.structuredClone = structuredClone;
 const records = {
  'users/test-customer': { name: '測試客人', status: 'active' },
  'announcements/settings': { name: '專屬空間' },
  'chats/test-customer': { name: '測試客人' }
 };
 const snapshot = (path = '') => ({
  id: path.split('/').at(-1), docs: [], metadata: { fromCache: false, hasPendingWrites: false },
  exists: () => Object.hasOwn(records, path), data: () => records[path]
 });
 const firebase = {
  initializeApp: () => ({}), getAuth: () => auth, getFirestore: () => ({}),
  onAuthStateChanged: (_, fn) => observers.push(fn), setPersistence: async () => {},
  doc: (_, ...parts) => parts.join('/'), collection: (_, ...parts) => parts.join('/'),
  query: path => path, where() {}, orderBy() {}, limit() {}, startAfter() {},
  getDoc: async path => snapshot(path), getDocFromServer: async path => {
   reads.set(path,(reads.get(path)||0)+1);
   if(path==='announcements/settings'&&waitForConfig)await waitForConfig;
   return snapshot(path);
  },
  getDocsFromServer: async path => snapshot(path),
  onSnapshot: (path, ...args) => {
   const next = args.find(arg => typeof arg === 'function');
   queueMicrotask(() => next(snapshot(path)));
   return () => {};
  },
  isSupported: async () => false, Timestamp: { fromMillis: value => value }
 };
 function load(identifier, code) {
  if (modules.has(identifier)) return modules.get(identifier);
  const at = new URL(identifier);
  let result;
  if (at.hostname === 'www.gstatic.com') {
   const sources = [html, ...fs.readdirSync('.').filter(name => /\.m?js$/.test(name)).map(name => fs.readFileSync(name, 'utf8'))];
   const names = new Set();
   for (const source of sources) {
    for (const [, fields, specifier] of source.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"](https:\/\/[^'"]+)['"]/g)) {
     if (specifier === identifier) for (const field of fields.split(',')) names.add(field.trim().split(/\s+/)[0]);
    }
   }
   result = new vm.SyntheticModule([...names], function () {
    for (const name of names) this.setExport(name, firebase[name] ?? (() => {}));
   }, { identifier, context });
  } else {
   const path = at.pathname.slice(new URL(origin).pathname.length);
   result = new vm.SourceTextModule(code ?? fs.readFileSync(path, 'utf8'), {
    identifier, context, initializeImportMeta(meta) { meta.url = identifier; }
   });
  }
  modules.set(identifier, result);
  return result;
 }
 const link = (specifier, parent) => load(new URL(specifier, parent.identifier).href);
 const get = id => window.document.getElementById(id);
 try {
  for (const script of window.document.querySelectorAll('script[type="module"]')) {
   const module = script.src ? load(script.src) : load(url.href, script.textContent);
   if (module.status === 'unlinked') await module.link(link);
   await module.evaluate();
  }
  for (const observe of observers) await observe(user);
  return { window, get, reads, close: () => window.close() };
 } catch (error) {
  window.close();
  throw error;
 }
}

(async () => {
 for (const search of ['', '?appBuild=21']) {
  const customer = await open('customer', search);
  try {
   const { window, get } = customer;
   await new Promise(setImmediate);
   assert.equal(window.document.body.dataset.page, 'inbox');
   assert.equal(get('homeCards')?.querySelectorAll('[data-topic]').length, 4, 'the customer home renders all four cards');
   for (let i = 0; i < 25; i++) {
    get('enterChat').click();
    assert.equal(window.document.body.dataset.page, 'chat');
    assert.ok(!get('chat').classList.contains('hidden'));
    get('leaveChat').click();
    assert.equal(window.document.body.dataset.page, 'inbox');
   }
  } finally { customer.close(); }
 }
 const admin = await open('admin', '?view=messages');
 try {
  assert.ok(!admin.get('admin').classList.contains('hidden'), 'store notification opens the inbox');
  for (let i = 0; i < 25; i++) {
   admin.window.document.querySelector('[data-admin-page=adminHome]').click();
   assert.ok(!admin.get('adminHome').classList.contains('hidden'));
   admin.window.document.querySelector('[data-admin-page=admin]').click();
   assert.ok(!admin.get('admin').classList.contains('hidden'));
  }
  const { window, get } = admin;
  const document = window.document;
  const home = document.querySelector('[data-admin-page=adminHome]');
  const tools = {
   customers: '顧客資料庫', broadcast: '群發訊息', gallery: '商品管理',
   notice: '跑馬燈與休假', board: '公告與活動', display: '客人首頁設定',
   approvals: '新客加入審核', tags: '標籤庫', designers: '設計師管理',
   phrases: '常用訊息設定', autoreply: '快捷詢問・自動回覆', welcome: '新客歡迎',
   automation: '自動提醒（自行啟用）', switches: '功能開關',
   theme: '外觀與玻璃', feedback: '客人回報'
  };
  assert.deepEqual(Object.keys(tools).sort(),[...document.querySelectorAll('#adminHome [data-tool]')].map(button=>button.dataset.tool).sort());
  for(const [key,title] of Object.entries(tools)){
   home.click();
   const button=document.querySelector('#adminHome [data-tool='+key+']');
   const group=button.closest('details');
   if(group)group.open=true;
   button.click();
   await new Promise(setImmediate);
   assert.equal(get('toolTitle').textContent,title,key);
   assert.ok(!get('adminTool').classList.contains('hidden'),key);
   assert.doesNotMatch(get('toolBody').textContent,/^載入中…$|無法載入：/,key);
   if(key==='display'){
    const section=[...get('toolBody').querySelectorAll('details[open] > summary')].find(summary=>summary.textContent.includes('客人主頁展示'));
    assert.ok(section,'customer-home controls are open on first entry');
   }
   if(key==='gallery'||key==='board'){
    get(key==='gallery'?'newProduct':'boardNew').click();
    await new Promise(setImmediate);
    const dialog=document.querySelector('dialog[open]');
    assert.ok(dialog,key+' opens its editor');
    assert.ok(dialog.querySelector(key==='gallery'?'#prodTitle':'#boardTitle'));
    dialog.querySelector('[data-close]').click();
    await new Promise(setImmediate);
   }
   get('toolBack').click();
   await new Promise(setImmediate);
   assert.ok(!get('adminHome').classList.contains('hidden'),key+' back to home');
  }
  document.querySelector('[data-admin-page=adminAnalysis]').click();
  await new Promise(setImmediate);
  assert.match(get('adminAnalysis').textContent,/顧客概況/);
  assert.equal(admin.reads.get('announcements/settings'),1,'switching owner pages uses the same settings fetch');
 } finally { admin.close(); }
 let resumeConfig;
 const stalledConfig=new Promise(resolve=>{resumeConfig=resolve;});
 const slow=await open('admin','',{waitForConfig:stalledConfig});
 try{
  await new Promise(setImmediate);
  assert.equal(slow.get('bootSplash'),null,'the owner home responds with settings still pending');
  const document=slow.window.document;
  for(let i=0;i<20;i++){
   document.querySelector('[data-tool=display]').click();
   slow.get('toolBack').click();
   document.querySelector('[data-admin-page=admin]').click();
   document.querySelector('[data-admin-page=adminHome]').click();
  }
  resumeConfig();
  await new Promise(setImmediate);
  assert.ok(!slow.get('adminHome').classList.contains('hidden'));
  assert.equal(slow.reads.get('announcements/settings'),1,'rapid navigation shares one in-flight read');
 }finally{resumeConfig();slow.close();}
 console.log('PASS full module startup: web customer, Android customer, and store; 75 navigation round trips and all 16 store tools');
})().catch(error => { console.error(error); process.exitCode = 1; });
