import {currentTerm,localDate} from './ambient-scenes.js?v=P168';
import {lunarMonthStarts,lunarCoverage} from './home-lunar-calendar.js?v=P166';
import {startAtmosphere} from './home-festival-renderer.js?v=P168';
export const homeEffects={gifts:'生日禮物',snow:'聖誕雪花',halloween:'南瓜與幽靈',midautumn:'月亮與燈籠',dragonboat:'粽子與龍舟',newyear:'喜氣紅包',lanterns:'元宵燈籠',fireworks:'跨年煙火',hearts:'愛心',christmas:'聖誕小樹',petals:'花瓣',leaves:'秋葉',sprouts:'春日嫩芽'};
export const festivals={newyear:'元旦・跨年',lunarNewyear:'除夕・春節初一至初五',lantern:'元宵',dragonboat:'端午',qixi:'七夕',midautumn:'中秋',valentine:'西洋情人節',halloween:'萬聖節',christmas:'平安夜・聖誕節'};
export function validISODate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
export function normalizeCelebration(raw={}){
 raw=raw&&typeof raw==='object'?raw:{};
 return {enabled:raw.enabled===true,birthday:raw.birthday!==false,automatic:raw.automatic!==false,solar:raw.solar===true,manual:raw.manual===true,effect:Object.hasOwn(homeEffects,raw.effect)?raw.effect:'gifts',start:validISODate(raw.start)?raw.start:'',end:validISODate(raw.end)?raw.end:'',festivals:Object.fromEntries(Object.keys(festivals).map(k=>[k,raw.festivals?.[k]!==false]))};
}
export function lunarDate(date){
 const day=localDate(date);if(day<lunarCoverage[0]||day>lunarCoverage[1])return null;
 let start;for(let i=lunarMonthStarts.length-1;i>=0;i--){if(lunarMonthStarts[i][0]<=day){start=lunarMonthStarts[i];break;}}if(!start)return null;
 return {month:start[1],day:Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(start[0]+'T00:00:00Z'))/86400000)+1,leap:!!start[2]};
}
export function festivalOn(date){
 const day=localDate(date),md=day.slice(5);
 const fixed={'01-01':['newyear','fireworks'],'12-31':['newyear','fireworks'],'02-14':['valentine','hearts'],'10-31':['halloween','halloween'],'12-24':['christmas','snow'],'12-25':['christmas','snow']};
 // Lunar New Year's Eve follows the actual next lunar day (29 or 30), never a guessed Gregorian date.
 try{const lunar=lunarDate(date),tomorrow=lunarDate(new Date(Date.parse(day+'T12:00:00+08:00')+86400000));if(tomorrow&&!tomorrow.leap&&tomorrow.month===1&&tomorrow.day===1)return ['lunarNewyear','newyear'];
 if(lunar&&!lunar.leap){const {month:m,day:d}=lunar;if(m===1&&d<=5)return ['lunarNewyear','newyear'];const e=({'1-15':['lantern','lanterns'],'5-5':['dragonboat','dragonboat'],'7-7':['qixi','hearts'],'8-15':['midautumn','midautumn']})[m+'-'+d];if(e)return e;}}catch{/* Fail closed on unsupported calendars, preserving fixed festivals. */}
 return fixed[md]||null;
}
export function homeCelebration(raw,person={},date=new Date()){
 const c=normalizeCelebration(raw);if(!c.enabled)return null;
 const day=localDate(date),[month,d]=day.slice(5).split('-').map(Number);
 if(c.birthday&&Number(person?.birthMonth)===month&&Number(person?.birthDay)===d)return {effect:'gifts',label:'生日快樂',day};
 if(c.manual&&c.start&&c.end&&c.start<=c.end&&day>=c.start&&day<=c.end)return {effect:c.effect,label:homeEffects[c.effect],day};
 if(c.automatic){const event=festivalOn(date);if(event&&c.festivals[event[0]])return {effect:event[1],label:festivals[event[0]],day};}
 if(c.solar){const term=currentTerm(date);if(term)return {effect:term.effect,label:term.name,day};}
 return null;
}
// Shared date decision, separate scene artwork and independent chat switch.
export function resolveChatTheme(theme={},celebration,person={},date=new Date()){
 if(!theme.followHomeCelebration)return theme;
 const scene=homeCelebration(celebration,person,date);
 return scene?{...theme,effect:scene.effect,randomBackground:false,backgroundMode:'manual'}:theme;
}
export function mountHomeEffect(target,{effect,preview=false,duration=12000}={}){
 if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches||['off','reduced'].includes(document.documentElement.dataset.readingMotion))return ()=>{};
 const layer=document.createElement('div');layer.className='homeCelebrationLayer';layer.dataset.effect=effect;layer.dataset.preview=String(preview);layer.setAttribute('aria-hidden','true');layer.style.setProperty('--celebration-duration',duration+'ms');
 const canvas=document.createElement('canvas');layer.append(canvas);target.append(layer);
 const stopArt=startAtmosphere(canvas,effect);let timer;
 const stop=()=>{clearTimeout(timer);stopArt();layer.remove();document.removeEventListener('visibilitychange',hidden);};
 const hidden=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hidden);timer=setTimeout(stop,duration);return stop;
}
export function createHomeCelebration({getConfig,getPerson,isHome}){
 let stop=()=>{},key='',timer;const motion=matchMedia('(prefers-reduced-motion: reduce)');
 function clear(){stop();stop=()=>{};key='';clearTimeout(timer);}
 function sync(){
  clearTimeout(timer);
  if(!isHome()||document.hidden||motion.matches||['off','reduced'].includes(document.documentElement.dataset.readingMotion)){clear();return;}
  const scene=homeCelebration(getConfig(),getPerson());
  if(!scene){stop();stop=()=>{};key='';}else{const next=JSON.stringify(scene);if(key!==next){stop();key=next;stop=mountHomeEffect(document.body,{effect:scene.effect});}}
  // One local timeout at Taiwan midnight; no network polling and no extra database reads.
  const now=new Date(),day=localDate(now),midnight=Date.parse(day+'T00:00:00+08:00')+86400000;
  timer=setTimeout(sync,Math.max(1000,midnight-Number(now)+100));
 }
 document.addEventListener('visibilitychange',sync);motion.addEventListener?.('change',sync);
 return {sync,stop:clear,destroy(){clear();document.removeEventListener('visibilitychange',sync);motion.removeEventListener?.('change',sync);}};
}
export function mountHomeCelebrationEditor(body,raw,save){
 const c=normalizeCelebration(raw);let previewStop=()=>{};body.classList.add('homeCelebrationEditor');
 body.innerHTML=`<h3>客人首頁・生日與節慶</h3><p class="small">只在客人主頁全螢幕播放約 12 秒，無聲、不擋操作；進聊天室立即停止。與聊天動畫、招呼語獨立。</p><label><input type="checkbox" data-home="enabled"> 啟用首頁動畫</label><label><input type="checkbox" data-home="birthday"> 客人生日當天播放禮物</label><label><input type="checkbox" data-home="automatic"> 自動節日（台灣日期，農曆表 2025–2040）</label><details class="homeFestivalChoices"><summary>選擇自動節日</summary>${Object.entries(festivals).map(([k,n])=>`<label><input type="checkbox" data-festival="${k}"> ${n}</label>`).join('')}</details><label><input type="checkbox" data-home="solar"> 平日跟隨二十四節氣（至 2030 年）</label><label><input type="checkbox" data-home="manual"> 指定日期播放</label><label>指定動畫<select data-home="effect">${Object.entries(homeEffects).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><div class="homeDateRange"><label>開始日期<input type="date" data-home="start"></label><label>結束日期<input type="date" data-home="end"></label></div><p class="small">可跨年，例如 2026/12/20～2027/01/05。優先順序：個人生日 → 指定日期 → 自動節日 → 節氣。生日未填不會猜測。</p><p class="homeToday" data-today></p><div data-home-preview><span>動畫預覽</span></div><div class="homeAnimationActions"><button type="button" data-preview>預覽指定動畫</button><button type="button" data-save>儲存首頁動畫</button></div><p role="status" data-status></p>`;
 const fields=[...body.querySelectorAll('[data-home]')],holidayFields=[...body.querySelectorAll('[data-festival]')];
 for(const el of fields){if(el.type==='checkbox')el.checked=c[el.dataset.home];else el.value=c[el.dataset.home];}for(const el of holidayFields)el.checked=c.festivals[el.dataset.festival];
 const draft=()=>normalizeCelebration({...Object.fromEntries(fields.map(el=>[el.dataset.home,el.type==='checkbox'?el.checked:el.value])),festivals:Object.fromEntries(holidayFields.map(el=>[el.dataset.festival,el.checked]))});
 const update=()=>{const next=draft(),scene=homeCelebration(next),text=!next.enabled?'首頁動畫目前關閉。':scene?'今天一般客人會看到：'+scene.label+'。':'今天沒有符合的指定日期或節日，所以一般客人不播放；生日客人仍依生日設定。';body.querySelector('[data-today]').textContent=localDate()+'｜'+text+' 修改後請儲存。';};
 for(const el of [...fields,...holidayFields])el.addEventListener('change',update);update();
 body.querySelector('[data-preview]').onclick=()=>{previewStop();previewStop=mountHomeEffect(body.querySelector('[data-home-preview]'),{effect:draft().effect,preview:true});body.querySelector('[data-status]').textContent=matchMedia('(prefers-reduced-motion: reduce)').matches||['off','reduced'].includes(document.documentElement.dataset.readingMotion)?'裝置或閱讀設定已減少動態，因此不播放動畫。':'這是指定動畫預覽，不會更改客人設定。';};
 body.querySelector('[data-save]').onclick=async e=>{const next=draft(),status=body.querySelector('[data-status]'),button=e.currentTarget;if(next.manual&&(!next.start||!next.end||next.start>next.end)){status.textContent='請選擇完整日期，結束日期不能早於開始日期；跨年請選下一年。';return;}button.disabled=true;try{await save(next);status.textContent='已儲存，客人首頁會自動同步。';}catch{status.textContent='尚未儲存，請確認網路後再試。';}finally{button.disabled=false;}};
}
