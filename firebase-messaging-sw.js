importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js");
firebase.initializeApp({apiKey:"AIzaSyBS-lHTp1YPhhFOKriBRSrwdSomT3ZGw0c",authDomain:"salon-space-chat.firebaseapp.com",projectId:"salon-space-chat",storageBucket:"salon-space-chat.firebasestorage.app",messagingSenderId:"103245363547",appId:"1:103245363547:web:3f19674918bbf257a4c27e"});
firebase.messaging();
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const url=event.notification?.data?.FCM_MSG?.fcmOptions?.link || "/salon-space-chat/";
 event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
  for(const client of list){if("focus" in client)return client.focus();}
  if(clients.openWindow)return clients.openWindow(url);
 }));
});