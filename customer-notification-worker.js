import {ensureNotificationWorker as sharedWorker,waitForNotificationVersion} from './notification-worker.js?v=N113';

// Chrome resolves notification delegation using the service worker SCOPE,
// not the message's click URL. Keep it equal to the APK's exact customer path.
// Never broaden the APK to handle the shared admin notification scope.
export async function customerWorkerOptions(env=globalThis){
 const url=new URL(env.location.href);
 if(!/Android/i.test(env.navigator.userAgent)||Number(url.searchParams.get('appBuild')||0)<9)return null;
 // Firebase Messaging stores its token per appId. Do not rotate a shared
 // browser's owner token while migrating a customer-only device.
 try{
  if(env.localStorage.getItem('salonMode')==='admin')return null;
  const cache=await env.caches.open('salon-notification-brand-v1');
  const response=await cache.match('/salon-space-chat/__notification_brand__');
  if(response&&(await response.json()).ownerDevice===true)return null;
 }catch{return null;}
 return {scope:new URL('./customer.html',url).href,updateViaCache:'none'};
}
let pending;
export function ensureNotificationWorker(){
 if(pending)return pending;
 pending=(async()=>{
  const options=await customerWorkerOptions();
  if(!options)return sharedWorker();
  const registration=await navigator.serviceWorker.register('./firebase-messaging-sw.js',options);
  await registration.update();
  return waitForNotificationVersion(registration);
 })().finally(()=>{pending=null;});
 return pending;
}
