export function unreadSummary(rows){let count=0;for(const r of rows){if(r.adminDeleted)continue;const at=typeof r.lastCustomerMessageAt?.toMillis==='function'?r.lastCustomerMessageAt.toMillis():Number(r.lastCustomerMessageAt||0);if(at>Number(r.readAdminMs||0))count++;}return count;}
export function badge(target,count,label='未讀對話',partial=false){if(!target)return;let el=target.querySelector('.countBadge');if(!el){el=document.createElement('span');el.className='countBadge';target.append(el);}el.hidden=!count;el.textContent=count?String(count)+(partial?'+':''):'';el.setAttribute('aria-label',`${partial?'至少 ':''}${count} 個${label}`);}
let confirmedBadge=null;
function setBadge(value){try{if(value>0)navigator.setAppBadge?.(value).catch(()=>{});else navigator.clearAppBadge?.().catch(()=>{});}catch{}}
export function appDot(unread,clear=false){const count=typeof unread==='number'?Math.max(0,unread):unread?1:0;if(clear||count>0)confirmedBadge=count;if(count||clear)setBadge(count);}
export function refreshAppBadge(){if(confirmedBadge!==null)setBadge(confirmedBadge);}



export function unreadAlert(role,pending,open){
 let el=document.getElementById('salonUnreadAlert');
 if(!el){el=document.createElement('button');el.id='salonUnreadAlert';el.setAttribute('aria-live','polite');el.style.cssText='position:fixed;bottom:calc(88px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:65;max-width:calc(100% - 36px);width:360px;padding:15px 18px;border-radius:24px;background:#843c32;color:white;box-shadow:0 6px 24px #0003;font-size:16px;font-weight:700';document.body.append(el);const style=document.createElement('style');style.textContent='#salonUnreadAlert[hidden],body.conversationOpen #salonUnreadAlert,body.adminApp:has(#adminChat:not(.hidden)) #salonUnreadAlert{display:none!important}';document.head.append(style);}
 el.hidden=!pending;el.textContent=role==='admin'?'● 客人有新訊息，點此查看':'● 店家有新訊息，點此查看';el.onclick=open;
}
