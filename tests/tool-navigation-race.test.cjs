const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('salon-suite.js','utf8');
const code=source.slice(source.indexOf(' async function openTool(key)'),source.indexOf(' async function page(id,'));
async function run(rejectOld){
 const dom=new JSDOM('<h2 id="toolTitle"></h2><div id="toolBody"></div>');
 const document=dom.window.document;
 let release;
 const gate=new Promise(resolve=>release=resolve);
 const scope={stopListIdentities(){},chatIdentityStop:null,document,$:id=>document.getElementById(id),activeTool:'',roomUnsub:null,contentUnsub:null,ctx:{},esc:String,icon:()=>'<svg></svg>',
 boardEditor:async body=>{await gate;if(rejectOld)throw Error('old request failed');body.innerHTML='<p>OLD BOARD</p>';}};
 vm.createContext(scope);vm.runInContext(code+';this.openTool=openTool;',scope);
 const pending=scope.openTool('board');
 const old=document.getElementById('toolBody');
 await scope.openTool('display');
 const current=document.getElementById('toolBody');
 assert.notEqual(current,old);
 release();await pending;
 assert.match(current.textContent,/選擇要更新的內容/);
 assert.doesNotMatch(current.textContent,/OLD BOARD|old request failed/);
 assert.equal(document.getElementById('toolTitle').textContent,'客人頁面管理');
 dom.window.close();
}
(async()=>{await run(false);await run(true);console.log('PASS stale tool success and error cannot overwrite new screen');})().catch(e=>{console.error(e);process.exitCode=1;});
