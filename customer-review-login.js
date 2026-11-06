import {initializeApp, deleteApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth, initializeAuth, inMemoryPersistence, browserLocalPersistence, setPersistence, signInWithEmailAndPassword, signInWithCredential, EmailAuthProvider, signOut} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore, doc, getDoc} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {canReplaceSession, isReviewCustomer} from './customer-review-policy.mjs';
const cfg={apiKey:"AIzaSyBS-lHTp1YPhhFOKriBRSrwdSomT3ZGw0c",authDomain:"salon-space-chat.firebaseapp.com",projectId:"salon-space-chat",storageBucket:"salon-space-chat.firebasestorage.app",messagingSenderId:"103245363547",appId:"1:103245363547:web:3f19674918bbf257a4c27e"};
const appBuild=Number(new URL(location.href).searchParams.get('appBuild')||0);
const customerTarget='./customer.html'+(Number.isSafeInteger(appBuild)&&appBuild>=5?'?appBuild='+appBuild:'');
document.querySelector('a[href="./customer.html"]').href=customerTarget;
const ADMIN='HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
const app=initializeApp(cfg), auth=getAuth(app), db=getFirestore(app);
const form=document.getElementById('login'), button=document.getElementById('submit'), status=document.getElementById('status');
async function checkSession(){
  await auth.authStateReady();
  const user=auth.currentUser;
  const exists=user ? (await getDoc(doc(db,'users',user.uid))).exists() : false;
  if(!canReplaceSession(user,exists)) throw new Error('existing-session');
}
function showError(error){
  const messages={
    'existing-session':'目前已有帳戶，為保留原登入資料，請使用另一個瀏覽器或乾淨的測試裝置。 / Existing account: use a separate browser or clean test device.',
    'review-not-ready':'這個帳戶尚未開放測試。 / This account is not approved for review.',
    'auth/operation-not-allowed':'測試登入尚未啟用，請聯絡店家。 / Review sign-in is not enabled.',
    'auth/network-request-failed':'連線失敗，請重試。 / Network error. Please retry.'
  };
  status.textContent=messages[error.code || error.message] || '無法登入，請確認帳號密碼或稍後重試。 / Unable to sign in. Check your credentials and retry.';
}
try {await checkSession();button.disabled=false;status.textContent='請輸入提供給你的測試帳號。 / Enter the provided review credentials.';} catch(error){showError(error);}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(button.disabled)return;button.disabled=true;
  status.textContent='登入中… / Signing in…';
  let candidate;
  try {
    await checkSession();
    // Validate in memory before replacing the default customer session.
    candidate=initializeApp(cfg,'review-validation');
    const candidateAuth=initializeAuth(candidate,{persistence:inMemoryPersistence});
    const email=document.getElementById('email').value.trim();
    const password=document.getElementById('password').value;
    const {user}=await signInWithEmailAndPassword(candidateAuth,email,password);
    const profile=await getDoc(doc(getFirestore(candidate),'users',user.uid));
    if(!isReviewCustomer(user.uid,profile.data(),ADMIN))throw new Error('review-not-ready');
    await checkSession();
    await setPersistence(auth,browserLocalPersistence);
    await signInWithCredential(auth,EmailAuthProvider.credential(email,password));
    document.getElementById('password').value='';
    location.replace(customerTarget);
  }catch(error){showError(error);button.disabled=false;}
  finally{if(candidate){await signOut(getAuth(candidate)).catch(()=>{});await deleteApp(candidate);}}
});
