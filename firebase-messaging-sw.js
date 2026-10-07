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
 const options={
  body:d.body||"您有一則新訊息",
  tag:d.tag||("salon-message-"+Date.now()),
  renotify:true,
  requireInteraction:false,
  silent:false,
  timestamp:Date.now(),
  data:{url:d.url||"/salon-space-chat/customer.html"}
 };
 return saveDiag({stage:"received",data:d}).then(()=>self.registration.showNotification(title,options)).then(()=>saveDiag({stage:"shown",data:d})).catch(e=>saveDiag({stage:"show-error",error:String(e),data:d}));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const url=event.notification?.data?.url||"/salon-space-chat/customer.html";
 event.waitUntil((async()=>{
  const destination=new URL(url,self.location.origin);
  if(destination.pathname.endsWith("/customer.html"))destination.hash="chat";
  const absolute=destination.href;
  const list=await clients.matchAll({type:"window",includeUncontrolled:true});
  // Apple/WebKit 對既有 standalone 視窗的 focus 較穩；Android 則優先走深連結開啟。
  const isApple=/iPhone|iPad|iPod|Macintosh/i.test(self.navigator?.userAgent||"");
  if(isApple){
   for(const client of list){
    if(new URL(client.url).origin===self.location.origin && new URL(client.url).pathname===new URL(absolute).pathname){
     client.postMessage({type:"OPEN_NOTIFICATION_URL",url:absolute});
     if("focus" in client)return client.focus();
    }
   }
  }
  return clients.openWindow?clients.openWindow(absolute):undefined;
 })());
});
