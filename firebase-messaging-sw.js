importScripts('./push-presentation.js?v=C30');
const BRAND_CACHE='salon-notification-brand-v1';
const BRAND_URL='/salon-space-chat/__notification_brand__';
async function readBrand(){try{const response=await (await caches.open(BRAND_CACHE)).match(BRAND_URL);return response?await response.json():{};}catch{return {};}}
self.addEventListener('message',event=>{
 if(event.data?.type!=='SALON_NOTIFICATION_BRAND')return;
 const input=event.data.branding||{},branding={};
 for(const role of ['admin','customer'])branding[role]={name:String(input[role]?.name||'專屬空間').slice(0,100),color:SalonPush.palette(input[role]?.color,role)};
 event.waitUntil(caches.open(BRAND_CACHE).then(cache=>cache.put(BRAND_URL,new Response(JSON.stringify(branding),{headers:{'Content-Type':'application/json'}}))));
});
// Register click handling before Firebase installs its own listeners.
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.stopImmediatePropagation();
 event.waitUntil((async()=>{
  const destination=SalonPush.destination(event.notification?.data?.url,self.location.origin);
  const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const isApple=/iPhone|iPad|iPod|Macintosh/i.test(self.navigator?.userAgent||'');
  if(isApple){for(const client of list){
   const current=new URL(client.url);
   if(current.origin===destination.origin && current.pathname===destination.pathname){
    client.postMessage({type:'OPEN_NOTIFICATION_URL',url:destination.href});
    if('focus' in client)return client.focus();
   }
  }}
  return self.clients.openWindow?.(destination.href);
 })());
});
importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js");
firebase.initializeApp({apiKey:"AIzaSyBS-lHTp1YPhhFOKriBRSrwdSomT3ZGw0c",authDomain:"salon-space-chat.firebaseapp.com",projectId:"salon-space-chat",storageBucket:"salon-space-chat.firebasestorage.app",messagingSenderId:"103245363547",appId:"1:103245363547:web:3f19674918bbf257a4c27e"});
const messaging=firebase.messaging();
const DIAG_CACHE="salon-push-diag-v1";
async function saveDiag(obj){
 const cache=await caches.open(DIAG_CACHE);
 await cache.put(new Request("/salon-space-chat/__push_diag__"),new Response(JSON.stringify({...obj,at:new Date().toISOString()}),{headers:{"Content-Type":"application/json"}}));
}
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
messaging.onBackgroundMessage(async payload=>{
 const d=payload.data||{};
 try{self.navigator.setAppBadge?.().catch(()=>{});}catch{}
 const {title,options}=SalonPush.notification(d,await readBrand(),self.location.origin);
 return saveDiag({stage:"received",data:d}).then(()=>self.registration.showNotification(title,options)).then(()=>saveDiag({stage:"shown",data:d})).catch(e=>saveDiag({stage:"show-error",error:String(e),data:d}));
});
