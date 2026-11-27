const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
(async()=>{
let cb,signouts=0,anonymous=0;const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{classList:{add(){}},innerHTML:'',textContent:''});return els.get(id)};
const customer=fs.readFileSync('customer.html','utf8');const code=customer.slice(customer.indexOf('onAuthStateChanged(auth,async user=>'),customer.indexOf('\n',customer.indexOf('onAuthStateChanged(auth,async user=>')));
assert(code.length>0);const ctx={auth:{currentUser:{uid:'owner'}},ADMIN:'owner',started:false,onAuthStateChanged:(_,f)=>cb=f,signOut:async()=>signouts++,signInAnonymously:async()=>anonymous++,show(){},$:el};vm.runInNewContext(code,ctx);await cb({uid:'owner'});assert.equal(signouts,0);assert.equal(anonymous,0);assert.match(el('setup').innerHTML,/返回店家端/);
const admin=fs.readFileSync('admin.html','utf8');const ac=admin.slice(admin.indexOf('onAuthStateChanged(auth,async user=>'),admin.indexOf('\n$("go").onclick'));let destroyed=0,paused=0,closed=0,route;const classes={add(){},remove(){}};const a={auth:{},ADMIN:'owner',booted:true,suite:{stopUnread(){}},adminFeed:{destroy(){destroyed++}},currentChatView:{feed:{pause(){paused++}}},closeChatListener(){closed++},document:{querySelectorAll:()=>[],body:{classList:classes},documentElement:{classList:classes}},$:el,show:x=>route=x,onAuthStateChanged:(_,f)=>cb=f,openAdminHome:async()=>route='home'};vm.runInNewContext(ac,a);await cb(null);assert.equal(route,'login');assert.equal(destroyed,1);assert.equal(paused,1);assert.equal(closed,1);await cb({uid:'owner'});assert.equal(route,'home');const launch=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
for(const [suffix,saved,expected] of [
 ['?mode=customer','admin','/salon-space-chat/customer.html'],
 ['?mode=admin','customer','/salon-space-chat/admin.html'],
 ['?view=approvals','customer','/salon-space-chat/admin.html?view=approvals'],
 ['?openChat=1','admin','/salon-space-chat/customer.html?openChat=1'],
 ['?chat=legacy','','/salon-space-chat/admin.html?chat=legacy'],
 ['','','/salon-space-chat/customer.html']
]){
 let destination;
 const url=new URL('https://example.test/salon-space-chat/'+suffix);
 vm.runInNewContext(launch,{URL,URLSearchParams,localStorage:{getItem:()=>saved},location:{href:url.href,search:url.search,hash:url.hash,replace:next=>destination=new URL(next)}});
 assert.equal(destination.pathname+destination.search,expected);
}
console.log('PASS explicit launch roles override old shortcuts and preserve notification routes');
console.log('PASS customer entry preserves owner session; expired admin returns to login, stops chat, and reauth restores home');
})().catch(e=>{console.error(e);process.exit(1)});
