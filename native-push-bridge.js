// Native tokens are supplied only over Chrome's origin-validated TWA channel.
export const isNativePushApp=(env=globalThis)=>Number(new URL(env.location.href).searchParams.get('appBuild')||0)>=15;
// Chromium serializes the verified app source as android-app://<verified host>.
export function trustedNativeOrigin(origin,env=globalThis){
 const site=new URL(env.location.href);
 return origin===site.origin||origin==='android-app://'+site.hostname||origin==='android-app://'+site.hostname+'/com.jun051873.salonspace';
}
export function createNativePushBridge(env=globalThis){
 let port=null,pending=null,uid='',last=null,receipt=null,phase='尚未收到 App 連線';
 const post=data=>port?.postMessage(JSON.stringify({protocol:'SALON_NATIVE_PUSH',...data}));
 function receive(raw){let d;try{d=typeof raw==='string'?JSON.parse(raw):raw;}catch{return;}
  if(d?.protocol!=='SALON_NATIVE_PUSH')return;
  if(d.type==='HELLO'){post({type:'READY'});phase='已連接 App，等待通知識別碼';if(pending)post({type:'REGISTER',uid});return;}
  if(!pending||d.uid!==uid)return;
  if(d.type==='ERROR'){pending.reject(Error(d.value||'原生通知設定失敗'));return;}
  if(d.type==='TOKEN'&&typeof d.value==='string'&&d.value.length>20&&d.value.length<4096){last=d;pending.resolve({token:d.value,allowed:d.allowed===true});}
 }
 const accept=e=>{
  if(!isNativePushApp(env)||!trustedNativeOrigin(e.origin,env)||!e.ports?.[0])return;
  // Chrome transfers the port in an EMPTY bootstrap message. HELLO follows
  // on that port; requiring JSON here discards the channel before registration.
  let d=null;
  if(e.data!==''){try{d=JSON.parse(e.data);}catch{return;}
   if(d?.protocol!=='SALON_NATIVE_PUSH'||d.type!=='HELLO')return;
  }
  phase='已收到連線通道，等待 App 回應';port?.close?.();port=e.ports[0];port.onmessage=e=>receive(e.data);port.start?.();post({type:'READY'});
  if(d)receive(d);
 };
 if(env.__salonNativeChannel){const inbox=env.__salonNativeChannel;inbox.accept=accept;if(inbox.pending){accept(inbox.pending);inbox.pending=null;}}
 else env.addEventListener('message',accept);
 return {
  register(account){
   if(pending)return pending.promise;
   uid=account;
   let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
   const timer=env.setTimeout(()=>reject(Error('原生通知連線尚未完成：'+phase+'。請關閉 App 後重新開啟')),20000);
   pending={promise,resolve,reject};post({type:'REGISTER',uid});
   return promise.finally(()=>{env.clearTimeout(timer);pending=null;});
  },
  saved(account){if(account===uid&&last){post({type:'SAVED',uid});if(receipt?.account===uid)post({type:'CLEAR',uid,cutoff:receipt.cutoff});}},
  clear(account,cutoff){if(typeof account!=='string'||!Number.isFinite(cutoff))return;receipt={account,cutoff};if(account===uid)post({type:'CLEAR',uid,cutoff});},
  settings(){post({type:'SETTINGS'});}
 };
}
export const nativePushBridge=typeof window==='undefined'?null:(window.__salonNativePushBridge ||= createNativePushBridge(window));
