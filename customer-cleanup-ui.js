// A fresh Firebase ID token is obtained for every step. No admin secrets in browser.
export function cleanupClient({auth,fetcher=fetch,endpoint='https://salon-space-notify.jun051873.workers.dev/'}){
 return async(action,details={})=>{
  if(!auth.currentUser)throw Error('請重新登入店家端');
  const token=await auth.currentUser.getIdToken(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...details,idToken:token}),signal:controller.signal});
   const result=await response.json();if(!response.ok||result.ok===false)throw Error(result.error||'清除尚未完成，請稍後接續');return result;
  }finally{clearTimeout(timer);}
 };
}
export async function openCleanup({primaryUid,sourceUid,call,modal,esc,onDone}){
 const preview=await call('cleanup-preview',{primaryUid,sourceUid});
 if(preview.done){await onDone();return;}
 const d=modal(preview.resume?'接續永久清除':'永久清除舊帳號',`<p>保留：<b>${esc(preview.primaryName||'目前主檔')}</b>（${esc(primaryUid.slice(-8))}）</p><p>清除：${esc(preview.sourceName||'已確認的舊帳號')}（${esc(sourceUid.slice(-8))}）</p><p>會先搬移並核對聊天、附件與備註，再永久刪除舊帳號和裝置連結。清除期間這組顧客暫停寫入，完成後恢復。</p><p><b>舊帳號登入的手機會失效。請先確認要繼續使用的手機登入的是保留主檔。</b>舊帳號不能復原；已搬移的紀錄會留在主對話。</p><label><input type="checkbox" data-cleanup-confirm> 我已核對要保留的帳號及手機</label><button data-cleanup-run class="dangerBtn" disabled>${preview.resume?'繼續完成清除':'確認永久清除'}</button><p data-cleanup-status role="status"></p>`);
 const button=d.querySelector('[data-cleanup-run]'),check=d.querySelector('[data-cleanup-confirm]'),status=d.querySelector('[data-cleanup-status]');
 check.onchange=()=>button.disabled=!check.checked;
 let job=preview.resume?preview:null,busy=false;
 button.onclick=async()=>{
  if(busy||!check.checked)return;busy=true;button.disabled=true;check.disabled=true;
  try{
   status.textContent='正在確認並鎖定資料…';
   job=job||await call('cleanup-start',{primaryUid,sourceUid,token:preview.token});
   // Network loss or closing this dialog leaves a resumable server job.
   // Cap each interaction; long histories can continue without a new job.
   for(let i=0;i<120&&!job.done&&d.isConnected;i++){
    job=await call('cleanup-step',{jobId:sourceUid});
    status.textContent=`已保留 ${job.copiedMessages||0} 則訊息、${job.copiedFiles||0} 個附件；${job.stage?.startsWith('erase')?'正在清除已核對的舊資料':'正在處理'}…`;
   }
   if(job.done){status.textContent='永久清除完成，紀錄已保留在主檔。';await onDone();d.close();}
   else status.textContent='進度已儲存，按「繼續完成清除」接續。';
  }catch(e){status.textContent=(e.name==='AbortError'?'連線逾時':e.message)+'。進度會保留；請按下方按鈕接續核對。';
   // A start response may have been lost. Preview/start are idempotent.
  }finally{busy=false;check.disabled=false;button.disabled=!check.checked;button.textContent='繼續完成清除';}
 };
 return d;
}
