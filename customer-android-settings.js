// Installed Android build 5 adds a safe native entry to this app's settings.
(() => {
 if (!document.body.classList.contains('customerApp')) return;
 const build=Number(new URL(location.href).searchParams.get('appBuild')||0);
 if (!/Android/i.test(navigator.userAgent) || build<5) return;
 const link='intent://notifications#Intent;scheme=salonspace;package=com.jun051873.salonspace;end';
 function install(){
  document.querySelectorAll('.notificationHelp,#preferences').forEach(host=>{
   if(host.querySelector('[data-android-notification-settings]'))return;
   const block=document.createElement('div');block.dataset.androidNotificationSettings='';
   block.style.cssText='margin:14px 0;padding:12px 0';
   const a=document.createElement('a');a.href=link;a.textContent='前往手機通知設定';
   a.style.cssText='display:inline-block;padding:12px 16px;border-radius:22px;background:#eee9e2;color:#292722;text-decoration:none;font-weight:600';
   const p=document.createElement('p');p.textContent='可調整懸浮通知、鎖定畫面與桌面角標。';
   p.style.cssText='font-size:13px;line-height:1.6;opacity:.75';
   block.append(a,p);host.append(block);
  });
 }
 install();
 new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
})();
