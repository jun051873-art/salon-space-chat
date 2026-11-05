// Owner homepage only. Reuse the existing buttons and handlers.
const shapes={customers:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v2"/>',messages:'<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/><path d="M7 9h10M7 13h6"/>',store:'<path d="M3 9l2-6h14l2 6M3 9v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 14v7h14v-7M10 21v-6h4v6"/>',appearance:'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-8Z"/><path d="M7 9h.01M10 6h.01M15 7h.01"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[k]}</svg>`;
function mount(){
 const home=document.getElementById('adminHome'),grid=home?.querySelector('.toolGrid');
 if(!grid?.querySelector('.inviteCard')||home.dataset.simpleHome)return false;
 home.dataset.simpleHome='true';
 const buttons=[...grid.querySelectorAll('[data-tool]')], invite=grid.querySelector('.inviteCard');
 const groups=[['customers','顧客','管理・審核・設計師',['customers','tags','approvals','designers']],['messages','訊息工具','快捷・回覆・提醒',['phrases','broadcast','autoreply','welcome','automation']],['store','店面','內容・展示・回報',['display','notice','gallery','board','feedback','switches']],['appearance','外觀','配色・玻璃・設定',['theme','settings']]];
 const cards=document.createElement('div');cards.className='ownerCategoryGrid';
 const panels=document.createElement('div');panels.className='ownerPanels';panels.hidden=true;
 const back=document.createElement('button');back.type='button';back.className='ownerCategoryBack';back.textContent='‹ 返回主頁';
 const title=document.createElement('h3'),items=document.createElement('div');items.className='ownerCategoryItems';panels.append(back,title,items);
 const pool=document.createElement('div');pool.hidden=true;pool.className='ownerToolPool';pool.append(...buttons);
 function close(){pool.append(...buttons);cards.hidden=false;panels.hidden=true;invite.hidden=false;}
 back.onclick=()=>{close();home.scrollIntoView({block:'start',behavior:'smooth'});};
 for(const [key,label,subtitle,keys]of groups){
  const card=document.createElement('button');card.type='button';card.className='ownerCategory';card.setAttribute('aria-label',label+'：'+subtitle);card.innerHTML=`<span class="ownerCategoryIcon">${svg(key)}</span><b>${label}</b><small>${subtitle}</small><span class="ownerCategoryArrow" aria-hidden="true">↗</span>`;
  card.onclick=()=>{pool.append(...buttons);title.textContent=label;items.replaceChildren(...buttons.filter(b=>keys.includes(b.dataset.tool)));cards.hidden=true;panels.hidden=false;invite.hidden=true;back.focus();};cards.append(card);
 }
 // Keep future tool entries reachable even if they are not yet in the category map.
 const known=new Set(groups.flatMap(g=>g[3]));const extra=buttons.filter(b=>!known.has(b.dataset.tool));groups[3][3].push(...extra.map(b=>b.dataset.tool));
 grid.replaceChildren(cards,panels,invite,pool);
 const shop=document.querySelector('#adminHome .shopHeader');shop?.setAttribute('aria-label','編輯店家資料');
 return true;
}
if(!mount()){const watch=new MutationObserver(()=>{if(mount())watch.disconnect();});watch.observe(document.body,{childList:true,subtree:true});}
