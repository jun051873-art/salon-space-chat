// Customer-only supplement. Never imports or changes owner settings or cloud records.
export function installCustomerCompliance(){
 if(!document.body.classList.contains('customerApp'))return;
 const links=()=>{
  const box=document.createElement('section');box.className='customerLegalLinks';
  box.style.cssText='margin:20px 0 0;padding:14px 0;border-top:1px solid rgba(90,90,90,.12);font-size:13px;line-height:1.9';
  for(const [text,path] of [['隱私權政策','customer-privacy.html'],['使用條款','customer-terms.html'],['申請刪除帳號與資料','customer-delete-account.html']]){
   const a=document.createElement('a');a.textContent=text;a.href='./'+path;a.style.cssText='display:inline-block;margin:0 16px 4px 0;color:inherit;text-decoration:underline';box.append(a);
  }
  return box;
 };
 const setup=document.getElementById('setup');if(setup&&!setup.querySelector('.customerLegalLinks'))setup.append(links());
 const attach=()=>{
  const settings=document.getElementById('preferences');if(!settings)return false;
  const mount=()=>{if(settings.querySelector('#settingsInstall')&&!settings.querySelector('.customerLegalLinks'))settings.append(links());};
  new MutationObserver(mount).observe(settings,{childList:true});mount();return true;
 };
 if(!attach()){const discovery=new MutationObserver(()=>{if(attach())discovery.disconnect();});discovery.observe(document.body,{childList:true,subtree:true});}
}

installCustomerCompliance();
