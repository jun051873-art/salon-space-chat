const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const origin = 'https://example.test/salon-space-chat/';
const owner = 'HcFJGmzHw6MYoWbFmtq9IyFSjvL2';

async function open(role, search = '', { waitForConfig, waitForBoard, waitForSettingsSnapshot, cachedAppearance, waitForPhoto } = {}) {
 const url = new URL(role + '.html' + search, origin);
 const html = fs.readFileSync(role + '.html', 'utf8');
 const dom = new JSDOM(html, { url: url.href, pretendToBeVisual: true, runScripts: 'outside-only' });
 const { window } = dom;
 const context = dom.getInternalVMContext();
 if(cachedAppearance)window.localStorage.setItem('salon-startup-appearance-v1:'+role,JSON.stringify(cachedAppearance));
 const user = { uid: role === 'admin' ? owner : 'test-customer' };
 const auth = { currentUser: user };
 const observers = [];
 const reads = new Map();
 const modules = new Map();
 window.scrollTo = () => {};
 if(waitForPhoto)window.HTMLImageElement.prototype.decode=()=>waitForPhoto;
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
  'announcements/settings': { name: '專屬空間', salonAvatar:'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=', theme:{background:'#dceae6'}, adminTheme:{background:'#e7def2'} },
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
   if(path==='announcements/board'&&waitForBoard)await waitForBoard;
   return snapshot(path);
  },
  getDocsFromServer: async path => snapshot(path),
  onSnapshot: (path, ...args) => {
   const next = args.find(arg => typeof arg === 'function');
   if(path==='announcements/settings'&&waitForSettingsSnapshot)waitForSettingsSnapshot.then(()=>next(snapshot(path)));
   else queueMicrotask(() => next(snapshot(path)));
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
   assert.equal(customer.reads.get('announcements/board'),undefined,'customer launch does not fetch announcements before opening them');
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
 let finishBoard;
 const waitForBoard=new Promise(resolve=>{finishBoard=resolve;});
 const late=await open('customer','',{waitForBoard});
 try{
  await new Promise(setImmediate);
  const {get,window}=late;
  get('homeCards').querySelector('[data-home-collection]').click();
  assert.equal(late.reads.get('announcements/board'),1);
  get('enterChat').click();
  finishBoard();
  await new Promise(setImmediate);
  assert.equal(window.document.body.dataset.page,'chat');
  assert.equal(window.document.querySelector('dialog.topicCollectionDialog'),null,'late announcement cannot cover chat');
 }finally{finishBoard();late.close();}
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
  home.click();
  document.querySelector('[data-tool=display]').click();
  const discardedTool=get('toolBody');
  home.click();
  assert.equal(discardedTool.isConnected,false,'leaving for home invalidates a pending tool');
  await new Promise(setImmediate);
  assert.ok(!get('adminHome').classList.contains('hidden'),'late tool load cannot return to the abandoned screen');
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
 for(const role of ['admin','customer']){
  const cover=role==='admin'?'bootSplash':'splash';
  let release;
  const delay=new Promise(resolve=>{release=resolve;});
  let finishPhoto;
  const waitForPhoto=new Promise(resolve=>{finishPhoto=resolve;});
  const offlineGate={waitForConfig:delay,waitForSettingsSnapshot:delay,waitForPhoto};
  const cold=await open(role,'',offlineGate);
  try{
   await new Promise(setImmediate);
   assert.ok(cold.get(cover),role+' keeps the cover until the first real appearance is ready');
   release();
   await new Promise(setImmediate);
   assert.ok(cold.get(cover),role+' waits for the branded avatar to decode');
   const avatar=cold.window.document.querySelector(role==='admin'?'.shopLogo img':'#enterChat .salonMonogram img');
   assert.match(avatar?.getAttribute('src')||'',/^data:image/);
   finishPhoto();
   await new Promise(setImmediate);
   assert.equal(cold.get(cover),null);
   const doc=cold.window.document;
   const correct=role==='admin'?'#e7def2':'#dceae6';
   assert.equal(doc.documentElement.style.getPropertyValue('--salon-bg'),correct);
   if(role==='customer')assert.equal(cold.get('homeCards').querySelectorAll('[data-topic]').length,4);
   const saved=JSON.parse(cold.window.localStorage.getItem('salon-startup-appearance-v1:'+role));
   assert.equal(saved.theme.background,correct);
   let resume;
   const slowRefresh=new Promise(resolve=>{resume=resolve;});
   const warm=await open(role,'',{waitForConfig:slowRefresh,waitForSettingsSnapshot:slowRefresh,cachedAppearance:saved});
   try{
    await new Promise(setImmediate);
    assert.equal(warm.get(cover),null,role+' uses cached appearance without waiting for the cloud');
    assert.equal(warm.window.document.documentElement.style.getPropertyValue('--salon-bg'),correct);
    if(role==='customer')assert.equal(warm.get('homeCards').querySelectorAll('[data-topic]').length,4);
   }finally{resume();await new Promise(setImmediate);warm.close();}
  }finally{release();finishPhoto();cold.close();}
 }
 console.log('PASS full module startup: web customer, Android customer, and store; 75 navigation round trips and all 16 store tools');
})().catch(error => { console.error(error); process.exitCode = 1; });
