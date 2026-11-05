// Customer-only prompt. Permission is requested only from a deliberate button tap.
export function mountCustomerNotificationOnboarding({host, enable, guide}) {
 if (!document.body.classList.contains('customerApp') || !host) return {setActive(){}};
 const card=document.createElement('section');
 card.id='customerNotificationOnboarding';card.hidden=true;
 card.innerHTML='<strong>讓店家回覆找到你</strong><p role="status"></p><div><button type="button" data-enable>開啟訊息通知</button><button type="button" data-later>稍後再說</button></div>';
 const style=document.createElement('style');
 style.textContent='#customerNotificationOnboarding{margin:12px 0;padding:16px 18px;border:1px solid #ffffff90;border-radius:22px;background:#ffffffa8;color:inherit}#customerNotificationOnboarding[hidden]{display:none}#customerNotificationOnboarding p{font-size:14px;line-height:1.6;margin:8px 0}#customerNotificationOnboarding>div{display:flex;flex-wrap:wrap;gap:8px}#customerNotificationOnboarding button{font:inherit;min-height:44px;max-width:100%;padding:10px 16px;border-radius:22px}#customerNotificationOnboarding [data-later]{background:transparent;color:inherit;border:0}';
 document.head.append(style);host.prepend(card);
 const action=card.querySelector('[data-enable]'),later=card.querySelector('[data-later]'),status=card.querySelector('p');
 let active=false,ready=false,busy=false,dismissed=false,error='';
 function render(){
  card.hidden=!active||ready||dismissed;
  card.setAttribute('aria-busy',String(busy));action.disabled=busy;later.disabled=busy;
  const denied=globalThis.Notification?.permission==='denied';
  status.textContent=error||(denied?'通知目前已關閉。你仍可使用聊天室，需要提醒時可查看開啟方式。':'開啟後，店家回覆時可在背景與鎖定畫面提醒你。請在系統視窗選擇「允許」。');
  action.textContent=busy?'正在設定…':denied?'查看開啟方式':'開啟訊息通知';
 }
 action.onclick=async()=>{
  if(busy)return;
  if(globalThis.Notification?.permission==='denied'){guide();return;}
  busy=true;error='';render();
  try{await enable();}catch(e){error='設定未完成，請再試一次。';}
  finally{busy=false;if(!ready&&!error)error='通知尚未完成。可再試一次，或稍後從上方鈴鐺開啟。';render();}
 };
 later.onclick=()=>{dismissed=true;render();};
 window.addEventListener('salon:notification-state',e=>{ready=!!e.detail.ready;error=e.detail.error||'';render();});
 return {setActive(value){active=!!value;render();}};
}
