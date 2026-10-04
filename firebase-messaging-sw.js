importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js");
firebase.initializeApp({apiKey:"AIzaSyBS-lHTp1YPhhFOKriBRSrwdSomT3ZGw0c",authDomain:"salon-space-chat.firebaseapp.com",projectId:"salon-space-chat",storageBucket:"salon-space-chat.firebasestorage.app",messagingSenderId:"103245363547",appId:"1:103245363547:web:3f19674918bbf257a4c27e"});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
 const n=payload.notification||{};
 self.registration.showNotification(n.title||"專屬空間 SALON",{body:n.body||"您有一則新訊息",data:{url:"/salon-space-chat/"}});
});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.openWindow("/salon-space-chat/"))});