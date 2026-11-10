import {cleanupClient} from './customer-cleanup-ui.js?v=P141';
export function mountCustomerRecovery(dialog,u,auth){
 if(u.status!=='active'||u.adminDeleted||u.adminMergedInto)return;
 const section=document.createElement('section');section.className='settingsGroup';
 section.innerHTML='<b>恢復客人手機</b><p>客人看到首次填寫畫面時，先本人核對，再產生一次性恢復碼，接回這筆保留的資料。</p><label><input type="checkbox" data-verified> 已核對本人及這筆保留主檔</label><button type="button" class="softBtn" data-issue disabled>產生恢復碼</button><p data-status role="status"></p><textarea data-code readonly hidden aria-label="一次性恢復碼"></textarea><button type="button" class="softBtn" data-copy hidden>複製恢復碼</button>';
 const button=section.querySelector('[data-issue]'),verified=section.querySelector('[data-verified]'),status=section.querySelector('[data-status]'),code=section.querySelector('[data-code]'),copy=section.querySelector('[data-copy]');
 verified.onchange=()=>{button.disabled=!verified.checked;};
 button.onclick=async()=>{
  if(!verified.checked)return;button.disabled=true;verified.disabled=true;code.hidden=copy.hidden=true;code.value='';status.textContent='產生中…';
  try{const result=await cleanupClient({auth})('recovery-issue',{primaryUid:u.id});if(!result.code)throw Error();code.value=result.code;code.hidden=copy.hidden=false;status.textContent='15 分鐘內使用一次。請客人從原本的桌面圖示開啟「恢復原本資料」，貼上此碼。只交給這位客人；重新產生會使上一碼失效。';}
  catch{status.textContent='無法產生。請確認已部署新版恢復服務，並選擇啟用中的保留主檔，且永久清除已完成。';}
  finally{verified.disabled=false;button.disabled=!verified.checked;}
 };
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(code.value);copy.textContent='已複製';}catch{code.focus();code.select();status.textContent='請長按恢復碼並複製，只交給這位客人。';}};
 dialog.append(section);
}
