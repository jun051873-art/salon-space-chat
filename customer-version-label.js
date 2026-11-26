// Customer display only: APK package version and web content release are separate.
(() => {
 if(!document.body.classList.contains('customerApp'))return;
 const build=new URL(location.href).searchParams.get('appBuild');
 const versions={'5':'1.0.4','6':'1.0.5','7':'1.0.6','8':'1.0.7','9':'1.0.8','10':'1.0.9','11':'1.0.10','12':'1.0.11','13':'1.0.12','14':'1.0.13','15':'1.0.14','16':'1.0.15','17':'1.0.16','18':'1.0.17','19':'1.0.18','20':'1.0.19','21':'1.0.20'};
 const installed=/Android/i.test(navigator.userAgent)&&/^[1-9]\d*$/.test(build||'');
 const packageLabel=installed?(versions[build]?'Android 安裝版 '+versions[build]+'（組建 '+build+'）':'Android 安裝版 · 組建 '+build):'客人端網頁版';
 const release=document.querySelector('meta[name="salon-release"]')?.content||'未標示';
 function render(){
  const target=document.getElementById('preferences');
  if(!target?.querySelector('#settingsInstall'))return;
  // Remove only the obsolete standalone version line in customer settings.
  for(const p of target.querySelectorAll(':scope > p.small')){
   if(/^版本\s+N[\d.]+\s*$/.test(p.textContent.trim()))p.remove();
  }
  if(target.querySelector('[data-salon-version]'))return;
  const label=document.createElement('p');label.dataset.salonVersion='';
  label.style.cssText='font-size:12px;line-height:1.7;color:inherit;opacity:.58;margin:24px 0 8px;text-align:center;font-weight:400';
  label.append(document.createTextNode(packageLabel),document.createElement('br'),document.createTextNode('客人端雲端內容版本 '+release));
  target.append(label);
 }
 new MutationObserver(render).observe(document.body,{childList:true,subtree:true});
 render();
})();
