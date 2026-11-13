import {mountAmbient,currentTerm,localDate} from './ambient-scenes.js?v=N66';
export const homeEffects={gifts:'生日禮物',fireworks:'跨年煙火',newyear:'新春紅包',lanterns:'燈籠',midautumn:'中秋月兔',dragonboat:'端午綠葉',christmas:'聖誕小樹',snow:'飄雪',petals:'花瓣',leaves:'秋葉',sprouts:'春日嫩芽'};
export function normalizeCelebration(raw={}){
 raw=raw&&typeof raw==='object'?raw:{};
 const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s))?s:'';
 return {enabled:raw.enabled===true,birthday:raw.birthday!==false,automatic:raw.automatic!==false,solar:raw.solar===true,manual:raw.manual===true,effect:Object.hasOwn(homeEffects,raw.effect)?raw.effect:'gifts',start:validDate(raw.start),end:validDate(raw.end)};
}
export function homeCelebration(raw,person={},date=new Date()){
 const c=normalizeCelebration(raw);if(!c.enabled)return null;
 const day=localDate(date),md=day.slice(5),[month,d]=md.split('-').map(Number);
 if(c.birthday&&Number(person.birthMonth)===month&&Number(person.birthDay)===d)return {effect:'gifts',label:'生日快樂',day};
 if(c.manual&&c.start&&c.end&&c.start<=c.end&&day>=c.start&&day<=c.end)return {effect:c.effect,label:homeEffects[c.effect],day};
 if(c.automatic){
  let effect=({'12-24':'christmas','12-25':'christmas','12-31':'fireworks','01-01':'fireworks'})[md];
  if(!effect)try{const parts=new Intl.DateTimeFormat('en-u-ca-chinese',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric'}).formatToParts(date);const get=t=>parts.find(p=>p.type===t)?.value;const m=get('month'),n=Number(get('day'));if(m==='1'&&n<=5)effect='newyear';else if(m==='1'&&n===15)effect='lanterns';else if(m==='5'&&n===5)effect='dragonboat';else if(m==='8'&&n===15)effect='midautumn';}catch{/* Unsupported lunar calendar: fixed dates remain available. */}
  if(effect)return {effect,label:homeEffects[effect],day};
 }
 if(c.solar){const term=currentTerm(date);if(term)return {effect:term.effect,label:term.name,day};}
 return null;
}
// One short, silent animation per home entry; no server timers, videos or polling.
export function createHomeCelebration({target,getConfig,getPerson,isHome}){
 let stop=()=>{},key='';
 function clear(){stop();stop=()=>{};key='';}
 function sync(){
  if(!isHome()||document.hidden){clear();return;}
  const scene=homeCelebration(getConfig(),getPerson());
  if(!scene){clear();return;}const next=JSON.stringify(scene);if(key===next)return;
  clear();key=next;stop=mountAmbient(target,{effect:scene.effect,duration:10,loop:false});
 }
 document.addEventListener('visibilitychange',sync);
 return {sync,stop:clear,destroy(){clear();document.removeEventListener('visibilitychange',sync);}};
}
export function mountHomeCelebrationEditor(body,raw,save){
 const c=normalizeCelebration(raw);let previewStop=()=>{};
 body.innerHTML=`<h3>客人首頁・生日與節慶</h3><p class="small">只在客人主頁播放約 10 秒，無聲、不遮擋操作，進入聊天室立即停止。與聊天動畫及招呼語各自獨立。</p><label><input type="checkbox" data-home="enabled"> 啟用首頁動畫</label><label><input type="checkbox" data-home="birthday"> 客人生日當天：禮物動畫</label><label><input type="checkbox" data-home="automatic"> 自動節日：元旦、農曆新年、元宵、端午、中秋、聖誕與跨年</label><label><input type="checkbox" data-home="solar"> 平日跟隨二十四節氣（日期表至 2030 年）</label><label><input type="checkbox" data-home="manual"> 指定日期播放</label><label>指定動畫<select data-home="effect">${Object.entries(homeEffects).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><div class="split"><label>開始日期<input type="date" data-home="start"></label><label>結束日期<input type="date" data-home="end"></label></div><p class="small">依台灣日期。優先順序：個人生日 → 指定日期 → 自動節日 → 節氣。生日未填不會猜測；減少動態設定會停用動畫。</p><div data-home-preview style="position:relative;isolation:isolate;height:180px;overflow:hidden;border-radius:24px;background:#f5f1fa;display:grid;place-items:center"><span>客人主頁預覽</span></div><div class="toolbar"><button type="button" data-preview>預覽指定動畫</button><button type="button" data-save>儲存首頁動畫</button></div><p role="status" data-status></p>`;
 const fields=[...body.querySelectorAll('[data-home]')];for(const el of fields){if(el.type==='checkbox')el.checked=c[el.dataset.home];else el.value=c[el.dataset.home];}
 const draft=()=>normalizeCelebration(Object.fromEntries(fields.map(el=>[el.dataset.home,el.type==='checkbox'?el.checked:el.value])));
 body.querySelector('[data-preview]').onclick=()=>{previewStop();previewStop=mountAmbient(body.querySelector('[data-home-preview]'),{effect:draft().effect,duration:10});};
 body.querySelector('[data-save]').onclick=async e=>{const next=draft(),status=body.querySelector('[data-status]');if(next.manual&&(!next.start||!next.end||next.start>next.end)){status.textContent='請選擇完整日期，結束日期不能早於開始日期。';return;}e.currentTarget.disabled=true;try{await save(next);status.textContent='已儲存，客人回到主頁時會依日期播放。';}catch{status.textContent='尚未儲存，請確認網路後再試。';}finally{body.querySelector('[data-save]').disabled=false;}};
}
