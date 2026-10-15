export const NOTIFICATION_VERSION='N3';
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
