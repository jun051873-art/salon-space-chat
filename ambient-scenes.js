import {startAtmosphere} from './ambient-renderer.js?v=N43';
import {solarDates} from './solar-terms-data.js?v=N43';
export const scenes={rain:['細雨','💧','fall'],petals:['櫻花','🌸','fall'],snow:['飄雪','❄','fall'],sun:['暖陽','☀️','stay'],fireflies:['螢火','✧','float'],bubbles:['泡泡','○','rise'],ripples:['水波','◯','pulse'],leaves:['秋葉','🍂','fall'],stars:['星光','✦','pulse'],confetti:['彩紙','▰','fall'],wind:['微風','〰','cross'],clouds:['流雲','☁️','cross'],suncloud:['雲間晴光','🌤️','cross'],moon:['月光','🌙','stay'],rainbow:['雨後彩虹','🌈','stay'],mist:['晨霧','☁','cross'],lanterns:['元宵燈籠','🏮','rise'],newyear:['新春祝福','🧧','fall'],fireworks:['跨年煙火','✺','pulse'],christmas:['聖誕小樹','🎄','float'],gifts:['聖誕禮物','🎁','fall'],midautumn:['中秋月兔','🐇','cross'],dragonboat:['端午粽香','🍃','fall'],hearts:['情人愛心','♡','rise'],birthday:['生日氣球','🎈','rise'],halloween:['萬聖南瓜','🎃','float'],sprouts:['春日嫩芽','🌱','rise'],wheat:['金色麥穗','🌾','cross']};
export const cities={yingge:['新北・鶯歌',24.96,121.35],taipei:['台北',25.04,121.56],keelung:['基隆',25.13,121.74],taoyuan:['桃園',24.99,121.31],taichung:['台中',24.15,120.67],tainan:['台南',23,120.21],kaohsiung:['高雄',22.63,120.30],hualien:['花蓮',23.99,121.60]};
const termScenes=['wind','snow','sprouts','rain','fireflies','petals','clouds','rain','suncloud','wheat','wheat','sun','bubbles','sun','leaves','wind','mist','moon','leaves','wind','moon','snow','snow','lanterns'];
export function localDate(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(date);}
export function currentTerm(date=new Date()){const day=localDate(date);if(day<'2025-01-05'||day>'2030-12-31')return null;const row=solarDates.filter(r=>r[0]<=day).at(-1);if(!row)return null;const i=solarDates.findIndex(r=>r===row)%24;return {name:row[1],date:row[0],effect:termScenes[i]};}
const pending=new Map();
function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
export function weatherScene(symbol='',temp=25,wind=0){if(/snow|sleet/.test(symbol))return 'snow';if(/rain|showers|thunder/.test(symbol))return 'rain';if(wind>=7||temp<18)return 'wind';if(/fog/.test(symbol))return 'mist';if(/night/.test(symbol))return 'moon';if(/partlycloudy|fair/.test(symbol))return 'suncloud';if(/cloud/.test(symbol))return 'clouds';return 'sun';}
export async function dailyWeather(city='yingge'){
 if(!cities[city])city='yingge';const key='salon-weather-v1-'+city,cached=read(key),now=Date.now();
 if(cached?.until>now)return cached.result;
 if(pending.has(city))return pending.get(city);
 const job=(async()=>{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);
 try{
 const [name,lat,lon]=cities[city];
 const response=await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,{signal:ctrl.signal,credentials:'omit'});
 if(!response.ok)throw Error('天氣暫時無法更新');const data=await response.json();
 const rows=data?.properties?.timeseries||[];const current=rows.reduce((best,r)=>Math.abs(Date.parse(r.time)-now)<Math.abs(Date.parse(best.time)-now)?r:best,rows[0]);
 if(!current||Math.abs(Date.parse(current.time)-now)>3*3600000)throw Error('天氣資料已過期');
 const info=current.data.instant.details,temp=info.air_temperature;if(!Number.isFinite(temp))throw Error('天氣資料不完整');
 const symbol=current.data.next_1_hours?.summary?.symbol_code||current.data.next_6_hours?.summary?.symbol_code||'';
 const hour=new Date(now).toLocaleString('sv-SE',{timeZone:'Asia/Taipei',hour12:false}).slice(0,13);
 const previousDay=localDate(new Date(now-86400000)),old=read(key+'-history')||{};
 const previous=old[previousDay+' '+hour.slice(-2)];const delta=Number.isFinite(previous)?Math.round((temp-previous)*10)/10:null;
 const comparison=delta===null?'昨日同時段資料尚未累積':Math.abs(delta)<0.5?'與昨日同時段預估相近':`比昨日同時段預估${delta>0?'暖':'冷'} ${Math.abs(delta)}°C`;
 old[hour]=temp;for(const k of Object.keys(old))if(k.slice(0,10)<previousDay)delete old[k];save(key+'-history',old);
 const result={effect:weatherScene(symbol,temp,info.wind_speed),text:`${name} · 預估 ${Math.round(temp)}°C · ${comparison} · ${new Date(current.time).toLocaleTimeString("zh-TW",{timeZone:"Asia/Taipei",hour:"2-digit",minute:"2-digit"})}`,updated:data.properties.meta.updated_at};
 const expires=Date.parse(response.headers.get('Expires'));save(key,{until:Math.max(now+3600000,Number.isFinite(expires)?expires:0),result});return result;
 }catch(e){save(key,{until:now+300000,result:{effect:'none',text:'天氣暫時無法更新，稍後再試'}});throw e}finally{clearTimeout(timer)}})();pending.set(city,job);try{return await job}finally{pending.delete(city)}
}
export function randomScene(key='default',rng=Math.random){const choices=Object.keys(scenes),last=read('salon-scene-last-'+key),pool=choices.filter(x=>x!==last);const effect=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];save('salon-scene-last-'+key,effect);return effect;}
export async function resolveScene(mode,effect,city){if(mode==='random')return {effect:randomScene(city||'default'),text:''};if(mode==='weather'){try{return await dailyWeather(city)}catch{return {effect:'none',text:'天氣暫時無法更新'}}}if(mode==='solar'){const t=currentTerm();return t?{effect:t.effect,text:`${t.name} · 二十四節氣意象（非即時天氣）`}:{effect:'none',text:'節氣日期待更新'}}return {effect,text:''};}
export function mountAmbient(target,{effect,text='',direction='left',duration=12}={}){
 const layer=document.createElement('div');layer.className='ambientScene';layer.dataset.effect=effect;layer.dataset.direction=direction;layer.style.setProperty('--ambient-time',Math.max(5,Math.min(20,duration))+'s');
 // Ambient scenes are visual only: no city, temperature or status captions.
 layer.setAttribute('aria-hidden','true');
 const entry=scenes[effect],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.readingMotion==='off'||document.documentElement.dataset.readingMotion==='reduced';
 let stop=()=>{};
 if(entry&&!reduced){layer.dataset.motion='art';const canvas=document.createElement('canvas');canvas.className='atmosphereCanvas';layer.append(canvas);target.append(layer);stop=startAtmosphere(canvas,effect,{direction});}else target.append(layer);
 const remove=()=>{clearTimeout(timer);stop();layer.remove();document.removeEventListener('visibilitychange',hidden)};const hidden=()=>{if(document.hidden)remove()};const timer=setTimeout(remove,Math.max(5,Math.min(20,duration))*1000);document.addEventListener('visibilitychange',hidden);return remove;
}

const cloud='<path d="M23 58c-15 0-16-22-1-24 1-19 28-24 37-7 16-6 30 6 27 20 14 12 4 24-10 24H27" fill="#eaf3f4" fill-opacity=".45"/><path d="M23 58h52c17 0 18-24 1-25-5-19-33-17-37 1-18-7-30 17-16 24Z"/>';
const sun='<circle cx="48" cy="43" r="16" fill="#f4d9a2" fill-opacity=".6"/><path d="M48 16v-6m0 66v-6M21 43h-6m66 0h-6M29 24l-5-5m48 48-5-5M29 62l-5 5m48-48-5 5"/>';
const art={sun,clouds:cloud,suncloud:sun+cloud,rain:cloud+'<path d="m35 70-4 9m21-9-4 9m21-9-4 9"/>',snow:cloud+'<path d="M49 70v20m-9-15 18 10m-18 0 18-10"/>',wind:'<path d="M13 36h49c21 0 18-23 5-19M21 49h59c20 0 15 23 3 19M10 63h35c16 0 17 17 6 19"/>',mist:'<path d="M18 32h58M9 46h82M24 60h53M13 74h69"/>',moon:'<path d="M66 15a32 32 0 1 0 20 52 33 33 0 0 1-40-41 33 33 0 0 1 20-11Z" fill="#e4e6f5" fill-opacity=".35"/>',rainbow:'<path d="M12 73a38 38 0 0 1 76 0M24 73a26 26 0 0 1 52 0M36 73a14 14 0 0 1 28 0"/>',hearts:'<path d="M50 78 19 47C-1 23 33 6 50 30 67 6 101 23 81 47Z" fill="#e7b9c7" fill-opacity=".3"/>',petals:'<path d="M50 47C12 42 23 7 44 19L50 38C55-1 89 17 75 38L58 46C95 42 96 81 70 76L54 58C69 95 31 99 29 75L42 57C9 81-3 43 23 40Z" fill="#ecd2dc" fill-opacity=".4"/>',leaves:'<path d="M24 77C-1 27 46 13 80 15 91 54 73 86 24 77Zm0 0 45-49M43 57l-6-20m6 20 22 4"/>',sprouts:'<path d="M50 85V47C18 50 14 32 18 18 45 17 55 32 50 47 50 23 72 21 85 26 85 47 67 57 50 54"/>',gifts:'<path d="M21 46h58v37H21ZM16 33h68v14H16Zm34 0v50M50 32C12 36 26 3 40 15Zm0 0C88 36 74 3 60 15Z"/>',christmas:'<path d="m50 12-23 27h12L20 61h17L23 79h54L63 61h17L61 39h12ZM50 79v12"/>',birthday:'<ellipse cx="50" cy="36" rx="23" ry="29" fill="#c4dce6" fill-opacity=".3"/><path d="m50 65-4 6h8Zm0 6c-17 12 10 12-4 25"/>',lanterns:'<path d="M50 7v9M33 17h34v9H33Zm-7 9h48c17 13 17 33 0 46H26c-17-13-17-33 0-46ZM33 72h34v9H33Zm17 9v14M35 26c-8 16-8 30 0 46m30-46c8 16 8 30 0 46"/>',stars:'<path d="m50 12 10 27 28 11-28 10-10 28-11-28-27-10 27-11Z" fill="#e9dcaf" fill-opacity=".4"/>',bubbles:'<circle cx="42" cy="56" r="25"/><circle cx="74" cy="24" r="12"/><path d="M25 50a18 18 0 0 1 15-12"/>',ripples:'<ellipse cx="50" cy="57" rx="39" ry="21"/><ellipse cx="50" cy="57" rx="25" ry="12"/><ellipse cx="50" cy="57" rx="10" ry="4"/>'};
export function sceneArtwork(effect){const aliases={sakura:'petals',fireflies:'stars',confetti:'stars',fireworks:'stars',newyear:'lanterns',midautumn:'moon',dragonboat:'leaves',wheat:'sprouts',halloween:'moon'};return '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(art[effect]||art[aliases[effect]]||art.stars)+'</svg>';}
