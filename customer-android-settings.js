// Installed Android build 5 adds a safe native entry to this app's settings.
(() => {
 if (!document.body.classList.contains('customerApp')) return;
 const build=Number(new URL(location.href).searchParams.get('appBuild')||0);
 if (!/Android/i.test(navigator.userAgent)) return;
 const review=document.querySelector('a[href="./customer-review-login.html"]');
 if(review && build>=5)review.href="./customer-review-login.html?appBuild="+build;
 const link='intent://notifications#Intent;scheme=salonspace;package=com.jun051873.salonspace;end';
 function install(){
  document.querySelectorAll('.notificationHelp,#preferences').forEach(host=>{
   if(host.querySelector('[data-android-notification-settings]'))return;
   const block=document.createElement('div');block.dataset.androidNotificationSettings='';
   block.style.cssText='margin:14px 0;padding:12px 0';
   const a=document.createElement('a');a.href=build>=5?link:'#';a.textContent=build>=5?'開啟手機系統通知設定':'查看手機系統通知開啟方式';
   if(build<5)a.onclick=e=>{e.preventDefault();alert('請長按手機桌面的「專屬空間」圖示 → 應用程式資訊 → 通知管理，開啟允許通知、鎖定畫面與橫幅。若使用 Chrome 網頁，也請檢查 Chrome 的通知設定。較新版 APK 可從此按鈕直接前往系統設定。');};
   a.style.cssText='display:inline-block;padding:12px 16px;border-radius:22px;background:#eee9e2;color:#292722;text-decoration:none;font-weight:600';
   const p=document.createElement('p');p.textContent='訊息通知與手機系統通知都需要開啟。可在系統設定調整鎖定畫面、橫幅與角標；請再用店家訊息測試是否收到。';
   p.style.cssText='font-size:13px;line-height:1.6;opacity:.75';
   block.append(a,p);
   const notify=host.querySelector('#settingsNotify');
   if(notify)notify.after(block);else host.prepend(block);
  });
 }
 install();
 new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
})();
