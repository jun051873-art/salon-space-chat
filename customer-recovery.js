import {initializeApp,deleteApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,initializeAuth,inMemoryPersistence,browserLocalPersistence,setPersistence,signInAnonymously,signInWithCustomToken,signOut,deleteUser} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
const cfg={apiKey:'AIzaSyBS-lHTp1YPhhFOKriBRSrwdSomT3ZGw0c',authDomain:'salon-space-chat.firebaseapp.com',projectId:'salon-space-chat',storageBucket:'salon-space-chat.firebasestorage.app',messagingSenderId:'103245363547',appId:'1:103245363547:web:3f19674918bbf257a4c27e'};
const ADMIN='HcFJGmzHw6MYoWbFmtq9IyFSjvL2',auth=getAuth(initializeApp(cfg)),button=document.getElementById('submit'),status=document.getElementById('status'),input=document.getElementById('code');
const build=Number(new URL(location.href).searchParams.get('appBuild')||0),target='./customer.html'+(Number.isSafeInteger(build)&&build>=5?'?appBuild='+build:'');
document.querySelector('a').href=target;
async function protectShop(){await auth.authStateReady();if(auth.currentUser?.uid===ADMIN)throw Error('SHOP_SESSION');}
try{await protectShop();button.disabled=false;status.textContent='恢復碼有效 15 分鐘，僅能使用一次。';}catch{status.textContent='此瀏覽器已登入店家端。請在客人自己的手機操作，店家登入不會被變更。';}
document.getElementById('recovery').onsubmit=async event=>{
 event.preventDefault();if(button.disabled)return;
 const code=input.value.trim();if(!/^[A-Za-z0-9_-]{1,128}\.[a-f0-9]{64}$/.test(code)){status.textContent='請完整貼上店家提供的恢復碼。';return;}
 button.disabled=true;status.textContent='正在接回原本資料…';let candidate;
 try{
  await protectShop();
  // Validate persistence before consuming the code. Preserve the existing session on failure.
  await setPersistence(auth,browserLocalPersistence);
  candidate=initializeApp(cfg,'recovery-'+Date.now());
  const temp=initializeAuth(candidate,{persistence:inMemoryPersistence});
  await signInAnonymously(temp);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);let result;
  try{const response=await fetch('https://salon-space-notify.jun051873.workers.dev/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recovery-redeem',code,idToken:await temp.currentUser.getIdToken()}),signal:controller.signal});result=await response.json();if(!response.ok||!result.customToken)throw Error('RECOVERY_FAILED');}finally{clearTimeout(timer);}
  await protectShop();await signInWithCustomToken(auth,result.customToken);
  input.value='';location.replace(target);
 }catch(e){status.textContent=e.message==='SHOP_SESSION'?'此瀏覽器已登入店家端，請在客人自己的手機操作。':'未完成恢復，原有資料保留。請確認網路與恢復碼；若已過期或使用過，請店家重新產生。';button.disabled=false;}
 finally{if(candidate){const temp=getAuth(candidate);if(temp.currentUser)await deleteUser(temp.currentUser).catch(()=>{});await signOut(temp).catch(()=>{});await deleteApp(candidate);}}
};
