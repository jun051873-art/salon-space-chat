// Shared touch, dialog and foreground recovery behavior for both entry points.
export function enhanceDialog(dialog){
 if(dialog.dataset.salonEnhanced)return;
 dialog.dataset.salonEnhanced='true';
 dialog.querySelectorAll('button').forEach(button=>{
  const label=button.getAttribute('aria-label')||button.textContent.trim();
  if(button.hasAttribute('data-close')||/^(關閉|[×✕✖]$)/.test(label)){
   button.classList.add('salonClose');button.setAttribute('aria-label',label.startsWith('關閉')?label:'關閉');
   button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  }
 });
 let outside=false;
 const isOutside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 dialog.addEventListener('pointerdown',e=>{outside=e.target===dialog&&isOutside(e);});
 dialog.addEventListener('click',e=>{if(outside&&e.target===dialog&&isOutside(e))dialog.close();outside=false;});
}

export function installInteractions(){
 if(document.documentElement.dataset.salonInteractions)return;
 document.documentElement.dataset.salonInteractions='true';
 document.body.dataset.inputModality='pointer';
 document.addEventListener('pointerdown',()=>document.body.dataset.inputModality='pointer',true);
 document.addEventListener('keydown',e=>{if(e.key==='Tab')document.body.dataset.inputModality='keyboard';},true);
 const scan=node=>{if(node.nodeType!==1)return;if(node.matches('dialog'))enhanceDialog(node);node.querySelectorAll('dialog').forEach(enhanceDialog);};
 scan(document.body);
 new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(scan))).observe(document.body,{childList:true,subtree:true});
 let scheduled=0,lastResume=0;
 function recover(){
  if(document.hidden)return;
  cancelAnimationFrame(scheduled);
  scheduled=requestAnimationFrame(()=>{
   const admin=location.pathname.endsWith('/admin.html');
   document.body.classList.add(admin?'adminApp':'customerApp');
   if(!document.querySelector('dialog[open]'))document.body.style.removeProperty('overflow');
   window.dispatchEvent(new Event('salon:viewport'));
   for(const link of document.querySelectorAll('link[rel="stylesheet"]')){
    if(link.sheet||link.dataset.recovering||navigator.onLine===false)continue;
    const attempts=Number(link.dataset.recoverAttempts||0);if(attempts>=3)continue;
    link.dataset.recoverAttempts=String(attempts+1);link.dataset.recovering='true';
    const done=()=>{delete link.dataset.recovering;link.removeEventListener('load',done);link.removeEventListener('error',done);};
    link.addEventListener('load',done);link.addEventListener('error',done);
    const url=new URL(link.href);url.searchParams.set('recover','R1-'+attempts);link.href=url.href;
   }
   if(Date.now()-lastResume>1000){lastResume=Date.now();window.dispatchEvent(new Event('salon:resume'));}
  });
 }
 for(const type of ['pageshow','online','focus'])window.addEventListener(type,recover);
 document.addEventListener('visibilitychange',recover);
 // Receiving an FCM message while visible does not create an OS notification.
 window.addEventListener('salon:foreground-message',event=>{
  const data=event.detail||{};if(document.hidden)return;
  let url;try{url=new URL(data.url,location.href);}catch{return;}
  if(url.origin!==location.origin||!['/salon-space-chat/customer.html','/salon-space-chat/admin.html'].includes(url.pathname))return;
  let banner=document.getElementById('foregroundMessage');
  if(!banner){banner=document.createElement('button');banner.id='foregroundMessage';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');document.body.append(banner);}
  banner.textContent='● 新訊息：'+String(data.body||'點此查看').slice(0,100);banner.hidden=false;
  banner.onclick=()=>{banner.hidden=true;location.href=url.href;};
  clearTimeout(banner._hideTimer);banner._hideTimer=setTimeout(()=>banner.hidden=true,8000);
 });
 recover();
}
