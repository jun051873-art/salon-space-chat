// Only a currently authenticated, server-recorded alias can follow a merge.
const endpoint='https://salon-space-notify.jun051873.workers.dev/';
export async function followMergedSession({auth,signInWithCustomToken,fetcher=fetch}){
 const user=auth.currentUser;
 if(!user||user.uid==='HcFJGmzHw6MYoWbFmtq9IyFSjvL2')return false;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const health=await fetcher(endpoint,{cache:'no-store',signal:controller.signal});
  if(!health.ok)throw Error('暫時無法確認原有資料，請稍後重新整理。');
  const info=await health.json();
  if(!info.features?.automaticMergedRecovery)return false; // Compatible with the older Worker during deployment.
  const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recovery-follow',idToken:await user.getIdToken()}),signal:controller.signal});
  const result=await response.json();
  if(!response.ok){const e=Error(result.error==='MERGE_IN_PROGRESS'?'店家正在整合資料，完成後會自動接回。':'原帳號暫時無法接回，請聯絡店家恢復資料，不用重新申請。');e.code=result.error;throw e;}
  if(!result.linked)return false;
  if(!result.customToken||auth.currentUser?.uid!==user.uid)throw Error('登入狀態已變更，請重新整理。');
  await signInWithCustomToken(auth,result.customToken);return true;
 }finally{clearTimeout(timer);}
}
