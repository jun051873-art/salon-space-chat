// Display-only labels; never read or write shop/customer records.
function installVersionLabel(){
 const owner=document.body.classList.contains('adminApp');
 if(!owner&&!document.body.classList.contains('customerApp'))return;
 const version=document.querySelector('meta[name="salon-release"]')?.content||'未標示';
 const render=()=>{
  const target=document.getElementById(owner?'toolBody':'preferences');
  if(!target)return;
  const visible=owner?target.dataset.colorPage==='settings':!!target.querySelector('#settingsInstall');
  const old=target.querySelector('[data-salon-version]');
  if(!visible){old?.remove();return;}
  if(old)return;
  const label=document.createElement('p');label.dataset.salonVersion='';
  label.style.cssText='font-size:12px;line-height:1.7;color:inherit;opacity:.58;margin:24px 0 8px;text-align:center;font-weight:400;overflow-wrap:anywhere';
  label.textContent=(owner?'店家自用':'客人端')+' · 網頁 '+version;
  if(!owner){label.append(document.createElement('br'),document.createTextNode('網站與 Android App 共用內容；安裝版號請見手機應用程式資訊。'));}
  target.append(label);
 };
 const observer=new MutationObserver(render);
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-color-page']});
 render();
}
installVersionLabel();
