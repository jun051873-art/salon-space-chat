importScripts('./push-presentation.js?v=N113');
importScripts('./admin-notification-visibility.js?v=N131');
importScripts('./push-routing.js?v=P155');
const NOTIFICATION_VERSION='P155';
const BRAND_CACHE='salon-notification-brand-v1';
const BRAND_URL='/salon-space-chat/__notification_brand__';
async function readBrand(){try{const response=await (await caches.open(BRAND_CACHE)).match(BRAND_URL);return response?await response.json():{};}catch{return {};}}
self.addEventListener('message',event=>{
 if(event.data?.type==='SALON_NOTIFICATION_VERSION'){event.ports?.[0]?.postMessage({version:NOTIFICATION_VERSION});return;}
 if(event.data?.type!=='SALON_NOTIFICATION_BRAND')return;
 const input=event.data.branding||{},branding={};
 for(const role of ['admin','customer'])branding[role]={name:String(input[role]?.name||'專屬空間').slice(0,100),color:SalonPush.palette(input[role]?.color,role)};
 event.waitUntil(readBrand().then(previous=>{branding.ownerDevice=previous.ownerDevice===true||event.data.ownerDevice===true;return caches.open(BRAND_CACHE).then(cache=>cache.put(BRAND_URL,new Response(JSON.stringify(branding),{headers:{'Content-Type':'application/json'}})));}));
});
// Register click handling before Firebase installs its own listeners.
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.stopImmediatePropagation();
 event.waitUntil((async()=>{
  const destination=SalonPush.destination(event.notification?.data?.url,self.location.origin);
  const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of list){
   const current=new URL(client.url);
   if(current.origin===destination.origin && current.pathname===destination.pathname){
    // Keep the target in the URL even if auth is still loading or a suspended
    // page misses postMessage. Navigation keeps this installed app's identity.
    // Preserve the installed customer's native-settings/version context.
    const build=current.searchParams.get('appBuild');
    if(destination.pathname.endsWith('/customer.html')&&/^[1-9]\d*$/.test(build||''))destination.searchParams.set('appBuild',build);
    let target=client;
    try{if(current.href!==destination.href&&client.navigate)target=await client.navigate(destination.href)||client;}catch{}
    target.postMessage({type:'OPEN_NOTIFICATION_URL',url:destination.href});
    if('focus' in target){try{return await target.focus();}catch{/* A discarded window must fall back to a fresh launch. */}}
   }
  }
  return self.clients.openWindow?.(destination.href);
 })());
});
// Only intercept our known data-only FCM envelopes; all other pushes retain
// Firebase's normal handling. stopImmediatePropagation prevents duplicate banners.
self.addEventListener('push',event=>{
 let payload;try{payload=event.data?.json();}catch{return;}
 if(!SalonPushRouting.owns(payload,self.location.origin))return;
 event.stopImmediatePropagation();
 event.waitUntil(handleSalonPush(payload));
});
importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js");
firebase.initializeApp({apiKey:"AIzaSyBS-lHTp1YPhhFOKriBRSrwdSomT3ZGw0c",authDomain:"salon-space-chat.firebaseapp.com",projectId:"salon-space-chat",storageBucket:"salon-space-chat.firebasestorage.app",messagingSenderId:"103245363547",appId:"1:103245363547:web:3f19674918bbf257a4c27e"});
const messaging=firebase.messaging();
const DIAG_CACHE="salon-push-diag-v1";
async function saveDiag(obj){
 const cache=await caches.open(DIAG_CACHE);
 await cache.put(new Request("/salon-space-chat/__push_diag__"),new Response(JSON.stringify({...obj,version:NOTIFICATION_VERSION,at:new Date().toISOString()}),{headers:{"Content-Type":"application/json"}}));
}
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
async function handleSalonPush(payload){
 const d=payload.data||{};
 if(await SalonAdminNotification.visibleChat(d,self.clients,self.location.origin)){await saveDiag({stage:'active-admin-chat-suppressed'}).catch(()=>{});return;}
 if(await SalonPushRouting.customerChatVisible(d,self.clients,self.location.origin)){await saveDiag({stage:'active-customer-chat-suppressed'}).catch(()=>{});return;}
 const brand=await readBrand();
 if((d.automatic===true||d.automatic==='true')&&(brand.ownerDevice||d.recipientRole==='admin'||String(d.url||'').includes('/admin.html'))){await saveDiag({stage:'automatic-owner-suppressed'}).catch(()=>{});return;}
 try{await self.navigator.setAppBadge?.(1);}catch{}
 const {title,options}=SalonPush.notification(d,brand,self.location.origin);
 try{await self.registration.showNotification(title,options);await saveDiag({stage:"shown",data:d}).catch(()=>{});}catch(e){await saveDiag({stage:"show-error",error:String(e),data:d}).catch(()=>{});}
}
messaging.onBackgroundMessage(handleSalonPush);




