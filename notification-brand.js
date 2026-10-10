const colors=['teal','violet','rose','amber'];
export function notificationColor(value,role){return colors.includes(value)?value:role==='admin'?'violet':'teal';}
export function notificationIcon(role,color){return './icons/'+role+'-'+notificationColor(color,role)+'-192.png';}
export function syncNotificationBrand(config,role){
  const name=config?.name||'專屬空間',settings=config?.notificationColors||{};
  const branding=Object.fromEntries(['admin','customer'].map(r=>[r,{name,color:notificationColor(settings[r],r)}]));
  const icon=notificationIcon(role,branding[role].color);
  for(const rel of ['apple-touch-icon','icon']){
    let link=document.querySelector('link[rel="'+rel+'"]');
    if(!link){link=document.createElement('link');link.rel=rel;document.head.append(link);}
    link.href=icon;link.type='image/png';
  }
  const title=document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(title)title.content=name+(role==='admin'?'店家':'');
  const send=registration=>registration.active?.postMessage({type:'SALON_NOTIFICATION_BRAND',branding});
  navigator.serviceWorker?.ready.then(send).catch(()=>{});
}
