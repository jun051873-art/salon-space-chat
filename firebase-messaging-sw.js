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
messaging.onBackgroundMessage(payload=>{
 const d=payload.data||{};
 const title=d.title||"專屬空間 SALON";
 const options={body:d.body||"您有一則新訊息",tag:d.tag||"salon-message",data:{url:d.url||"/salon-space-chat/customer.html"}};
 return saveDiag({stage:"received",data:d}).then(()=>self.registration.showNotification(title,options)).then(()=>saveDiag({stage:"shown",data:d})).catch(e=>saveDiag({stage:"show-error",error:String(e),data:d}));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const url=event.notification?.data?.url||"/salon-space-chat/customer.html";
 event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
  for(const client of list){if("focus"in client)return client.focus()}
  return clients.openWindow?clients.openWindow(url):undefined;
 }));
});