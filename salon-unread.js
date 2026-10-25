export function unreadSummary(rows){let count=0;for(const r of rows){if(r.adminDeleted)continue;const at=typeof r.lastCustomerMessageAt?.toMillis==='function'?r.lastCustomerMessageAt.toMillis():Number(r.lastCustomerMessageAt||0);if(at>Number(r.readAdminMs||0))count++;}return count;}
export function badge(target,count,label='未讀對話',partial=false){if(!target)return;let el=target.querySelector('.countBadge');if(!el){el=document.createElement('span');el.className='countBadge';target.append(el);}el.hidden=!count;el.textContent=count?String(count)+(partial?'+':''):'';el.setAttribute('aria-label',`${partial?'至少 ':''}${count} 個${label}`);}
let confirmedBadge=null,pendingCustomers=0;
export function appPending(count){pendingCustomers=Math.max(0,Number(count)||0);setBadge((confirmedBadge||0)+pendingCustomers);}
function setBadge(value){try{if(value>0)navigator.setAppBadge?.(value).catch(()=>{});else navigator.clearAppBadge?.().catch(()=>{});}catch{}}
export function appDot(unread,clear=false){const count=typeof unread==='number'?Math.max(0,unread):unread?1:0;if(clear||count>0)confirmedBadge=count;if(count||clear)setBadge(count+pendingCustomers);}
export function refreshAppBadge(){if(confirmedBadge!==null)setBadge(confirmedBadge+pendingCustomers);}



// Unread state is represented by native notifications and page badges. Remove any legacy floating alert.
export function unreadAlert(){document.getElementById('salonUnreadAlert')?.remove();}
