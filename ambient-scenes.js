import {solarDates} from './solar-terms-data.js?v=N41';
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
export async function resolveScene(mode,effect,city){if(mode==='weather'){try{return await dailyWeather(city)}catch{return {effect:'none',text:'天氣暫時無法更新'}}}if(mode==='solar'){const t=currentTerm();return t?{effect:t.effect,text:`${t.name} · 二十四節氣意象（非即時天氣）`}:{effect:'none',text:'節氣日期待更新'}}return {effect,text:''};}
export function mountAmbient(target,{effect,text='',direction='left',duration=12}={}){
 const layer=document.createElement('div');layer.className='ambientScene';layer.dataset.effect=effect;layer.dataset.direction=direction;layer.style.setProperty('--ambient-time',Math.max(5,Math.min(20,duration))+'s');
 const label=document.createElement('div');label.className='ambientCaption';label.textContent=text;if(text)layer.append(label);
 const entry=scenes[effect],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.readingMotion==='off'||document.documentElement.dataset.readingMotion==='reduced';
 if(entry&&!reduced){layer.dataset.motion=entry[2];for(let i=0;i<(entry[2]==='stay'?1:10);i++){const p=document.createElement('i');p.textContent=entry[1];p.setAttribute('aria-hidden','true');p.style.cssText=`--ax:${(i*31+7)%90}%;--ay:${(i*19+8)%75}%;--ad:${-(i%5)}s;--ar:${i*21}deg`;layer.append(p);}}
 target.append(layer);const remove=()=>{clearTimeout(timer);layer.remove();document.removeEventListener('visibilitychange',hidden)};const hidden=()=>{if(document.hidden)remove()};const timer=setTimeout(remove,Math.max(5,Math.min(20,duration))*1000);document.addEventListener('visibilitychange',hidden);return remove;
}
