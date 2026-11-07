// Retire only this browser's customer-path subscription after native cloud save.
// Keep the worker itself, shared owner scope, and all other devices intact.
export async function retireCustomerBrowserPush(env=globalThis){
 if(!env.navigator?.serviceWorker?.getRegistrations)return false;
 const url=new URL(env.location.href);if(Number(url.searchParams.get('appBuild')||0)<15)return false;
 const scope=new URL('./customer.html',url).href;
 const registrations=await env.navigator.serviceWorker.getRegistrations();
 for(const reg of registrations){
  if(reg.scope!==scope)continue;
  const subscription=await reg.pushManager.getSubscription();
  if(subscription&&!await subscription.unsubscribe())throw Error('舊版瀏覽器通知尚未停止，請稍後重試');
  // Remove old customer notifications already displayed by Chrome.
  for(const n of await reg.getNotifications())n.close();
 }
 return true;
}
