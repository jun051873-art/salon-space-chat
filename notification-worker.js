export const NOTIFICATION_VERSION='P181';
function versionOf(worker,timeout=500){
 if(!worker||worker.state!=='activated')return Promise.resolve(null);
 return new Promise(resolve=>{
  const channel=new MessageChannel();
  let timer;
  const finish=value=>{clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
  channel.port1.onmessage=event=>finish(event.data?.version||null);
  timer=setTimeout(()=>finish(null),timeout);
  try{worker.postMessage({type:'SALON_NOTIFICATION_VERSION'},[channel.port2]);}catch{finish(null);}
 });
}
// ready/update() can still refer to the previous active worker. Verify the
// running version before reporting that this device has the new format.
export async function waitForNotificationVersion(registration,{timeout=12000,probe=versionOf,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const deadline=Date.now()+timeout;
 do{
  const active=registration.active;
  if(active?.state==='activated'&&await probe(active)===NOTIFICATION_VERSION&&registration.active===active)return registration;
  await pause(150);
 }while(Date.now()<deadline);
 throw Error('通知格式尚未更新完成，請保持網路連線，稍後重新開啟原本的桌面圖示。');
}
let pending;
export function ensureNotificationWorker(){
 if(pending)return pending;
 pending=(async()=>{
  const registration=await navigator.serviceWorker.register('./firebase-messaging-sw.js',{updateViaCache:'none'});
  await registration.update();
  return waitForNotificationVersion(registration);
 })().finally(()=>{pending=null;});
 return pending;
}

// Store notifications can subscribe through an active registration even when
// iOS does not answer the optional worker-version message.
export async function ensureAdminNotificationWorker(env=navigator.serviceWorker,{timeout=12000,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const script=new URL('./firebase-messaging-sw.js',import.meta.url);
 const scope=new URL('./',script).href;
 const active=registration=>registration?.scope===scope &&
  registration.active?.state==='activated' &&
  registration.active?.scriptURL===script.href;
 const existing=await env.getRegistration(scope).catch(()=>null);
 const refresh=()=>env.register(script.href,{scope,updateViaCache:'none'});
 if(active(existing)){
  // Reuse the current subscription and refresh without waiting for iOS to
  // deliver a message-channel reply or download a new worker.
  void refresh().then(registration=>registration.update()).catch(()=>{});
  return existing;
 }
 const registration=await refresh();
 const deadline=Date.now()+timeout;
 do{
  if(active(registration))return registration;
  if(Date.now()>=deadline)break;
  await pause(150);
 }while(true);
 throw Error('店家通知服務尚未啟動，請稍候再試。');
}
