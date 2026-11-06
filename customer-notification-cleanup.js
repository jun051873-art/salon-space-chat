import {nativePushBridge,isNativePushApp} from './native-push-bridge.js?v=N127';
// Only clear notifications after the server confirms this customer has no unread messages.
export async function clearCustomerNotifications(cutoff,stillRead,env=globalThis){
 if(!/Android/i.test(env.navigator.userAgent)||!stillRead())return;
 if(isNativePushApp(env)&&stillRead()){nativePushBridge?.clear(env.document?.body?.dataset?.nativePushUid,cutoff);}
 const here=new URL(env.location.href);
 if(!here.pathname.endsWith('/customer.html'))return;
 const registrations=await env.navigator.serviceWorker?.getRegistrations?.()||[];
 for(const reg of registrations){
  const notices=await reg.getNotifications();
  for(const n of notices){
   if(!stillRead())return;
   if(!n.data?.url||!Number.isFinite(n.timestamp)||n.timestamp>cutoff)continue;
   try{const url=new URL(n.data.url,here);if(url.origin===here.origin&&url.pathname===here.pathname)n.close();}catch{}
  }
 }
}
