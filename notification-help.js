// Permission is only one step: show success after the device token is saved.
export function notificationState({apple,standalone,supported,permission,ready}){
 if(apple&&!standalone)return 'install';
 if(!supported)return 'unsupported';
 if(permission==='denied')return 'denied';
 return permission==='granted'&&ready?'ready':'enable';
}
export function mountNotificationHelp(host,enable,role){
 const box=document.createElement('section');box.className='notificationHelp';host.prepend(box);
 const style=document.createElement('style');style.textContent='.notificationHelp{margin:14px 0;padding:16px;border:1px solid #c9a67c;border-radius:22px;background:#fff8ee;color:#403427}.notificationHelp p{font-size:15px;line-height:1.65;margin:8px 0}.notificationHelp button{font:inherit;min-height:44px;padding:10px 16px;border-radius:22px}.notificationHelp[data-ready=true]{background:#f1f7f2;border-color:#c2d6c6}.notificationGuide{max-width:440px;width:calc(100% - 60px);border:0;border-radius:24px;padding:22px;color:#302e28;background:#fffcf7}.notificationGuide::backdrop{background:#0007}.notificationGuide p{line-height:1.7}.notificationGuide button{min-height:44px}';document.head.append(style);
 let ready=false,error='',busy=false;
 function state(){return notificationState({apple:/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1),standalone:!!navigator.standalone||matchMedia('(display-mode: standalone)').matches,supported:'Notification'in window&&'PushManager'in window&&'serviceWorker'in navigator,permission:globalThis.Notification?.permission,ready});}
 function guide(){const d=document.createElement('dialog');d.className='notificationGuide';d.innerHTML='<h2>讓新訊息即時提醒你</h2><p><b>iPhone／iPad</b><br>若尚未加入主畫面：在 Safari 開啟此網址 → 分享 → 加入主畫面，再從桌面圖示開啟並允許通知。已安裝的人直接使用原本圖示。</p><p>到手機「設定 → 通知 → 找到這個 App 的名稱」開啟允許通知、鎖定畫面、橫幅、聲音與標記。若使用專注模式或通知摘要，也請允許本 App 即時通知。</p><p><b>Android</b><br>允許此 App／網站通知，並在手機通知設定開啟鎖定畫面、浮動通知與桌面角標。省電或背景限制可能延遲提醒；角標可能顯示數字或圓點，依手機而定。</p><p>每台裝置都需個別開啟通知。網路或手機設定仍可能影響送達時間。</p><button autofocus>知道了</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();}
 const title=document.createElement('strong'),p=document.createElement('p'),enableButton=document.createElement('button'),test=document.createElement('button'),help=document.createElement('button');
 p.setAttribute('role','status');enableButton.type=test.type=help.type='button';help.className='softBtn';help.textContent='通知設定教學';help.onclick=guide;
 test.textContent='測試手機提示';test.onclick=async()=>{if(test.disabled)return;test.disabled=true;try{const reg=await navigator.serviceWorker.getRegistration();if(!reg)throw Error('通知服務尚未就緒');await reg.showNotification('訊息提醒測試',{body:'此為手機提示測試。',tag:'salon-notification-test',data:{url:location.pathname}});p.textContent='已送出手機提示。若沒有橫幅，請先查看通知中心；睡眠／專注模式可能將提示靜音。這項測試不代表店家與客人的雙向傳送已驗證。';}catch(e){p.textContent='測試未完成：'+e.message;}finally{test.disabled=false;}};
 enableButton.onclick=async()=>{if(busy)return;busy=true;error='';render();try{await enable();}catch(e){error=e.message;}finally{busy=false;if(!ready&&!error)error='通知尚未完成，請確認已允許通知後再試。';render();}};
 box.append(title,p,enableButton,test,help);let lastState='';
 function render(){const s=state(),key=JSON.stringify([s,busy,error]);if(key===lastState)return;lastState=key;const ok=s==='ready';if(document.body?.dataset)document.body.dataset.notificationReady=String(ok);box.dataset.ready=String(ok);box.setAttribute('aria-busy',String(busy));
 title.textContent=ok?'✓ 通知已開啟':busy?'正在設定通知…':'開啟通知，不漏看新訊息';
 p.textContent=error||({install:'請從桌面 App 圖示開啟，再允許通知。',unsupported:'目前瀏覽器未支援背景通知，請查看教學。',denied:'通知已關閉，請到手機設定允許通知後再回來。',enable:'點一下開啟，完成後會顯示綠色勾勾。',ready:'此裝置已完成設定；鎖定畫面與聲音可查看教學。'})[s];
 enableButton.hidden=s!=='enable';enableButton.disabled=busy;enableButton.textContent=busy?'正在設定…':'開啟訊息通知';test.hidden=!ok;
 if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('salon:notification-state',{detail:{ready:ok,busy,error}}));
 }
 render();return {update(ok=false,message=''){ready=ok;error=message;render();},guide};
}
