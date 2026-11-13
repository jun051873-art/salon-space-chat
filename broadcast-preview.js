// Read-only customer perspective. Reuses the live chat message renderer.
export function renderBroadcastPreview(host,blocks,{renderMessage,applyTheme,config={}}){
 host.replaceChildren();host.classList.add('broadcastChatPreview');
 applyTheme(config.theme||{},host);
 const header=document.createElement('div');header.className='broadcastChatHeader';header.textContent=config.name||'專屬空間';host.append(header);
 const feed=document.createElement('div');feed.className='broadcastChatFeed';feed.setAttribute('aria-label','客人收到的訊息，由上到下排列');host.append(feed);
 const valid=blocks.filter(x=>x.text?.trim()||x.type==='photo');
 for(const [i,x] of valid.entries()){
  const row=document.createElement('div');
  const m={id:'preview-'+i,senderId:'preview-shop',senderRole:'admin',text:x.text?.trim()||(x.type==='photo'?'傳來一張照片':''),createdAt:Date.now(),...(x.type==='photo'?{attachment:{type:'image/jpeg',name:x.name||'照片',width:x.width,height:x.height}}:{})};
  row.innerHTML=renderMessage(m,'preview-customer',0,{name:config.name||'專屬空間',avatar:config.salonAvatar});
  const img=row.querySelector('[data-image-preview]');
  if(img){img.src=x.data;img.loading='eager';img.removeAttribute('role');img.removeAttribute('tabindex');img.removeAttribute('aria-label');img.removeAttribute('data-image-preview');row.querySelector('[data-image-status]')?.remove();}
  row.querySelector('.messageActions')?.remove();
  feed.append(...row.childNodes);
 }
 if(!valid.length){const p=document.createElement('p');p.className='small';p.textContent='加入文字或照片後，這裡會同步顯示。';feed.append(p);}
}
export function confirmBroadcastPreview({modal,blocks,count,renderMessage,applyTheme,config}){
 return new Promise(resolve=>{
  const d=modal('傳送給 '+count+' 位客人','<p class="small">這是客人收到的聊天室內容，依下方順序傳送。照片可捲動查看；文字換行會依客人的螢幕寬度調整。</p><div data-broadcast-preview></div><div class="broadcastConfirmActions"><button type="button" data-send>確認傳送</button><button type="button" class="softBtn" data-edit>返回編輯</button></div>',{nested:true});
  d.classList.add('broadcastConfirmDialog');
  renderBroadcastPreview(d.querySelector('[data-broadcast-preview]'),blocks,{renderMessage,applyTheme,config});
  let done=false;const finish=value=>{if(done)return;done=true;resolve(value);if(d.open)d.close();};
  d.querySelector('[data-send]').onclick=()=>finish(true);
  d.querySelector('[data-edit]').onclick=()=>finish(false);
  d.addEventListener('cancel',()=>finish(false),{once:true});
  d.addEventListener('close',()=>finish(false),{once:true});
 });
}
