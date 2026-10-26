import {cities,dailyWeather} from './ambient-scenes.js?v=N64';
const key='salon-customer-weather';
export function weatherPreferences(){try{const p=JSON.parse(localStorage.getItem(key)||'{}');return {enabled:p.enabled===true,city:cities[p.city]?p.city:'yingge'};}catch{return {enabled:false,city:'yingge'}}}
export function mountWeatherSettings(host){
 const prefs=weatherPreferences(),box=document.createElement('details');box.className='weatherSettings';
 box.innerHTML='<summary>主頁天氣 · '+(prefs.enabled?'已開啟':'未開啟')+'</summary><p class="small">開啟後，在訊息主頁顯示今日預估，展開可看今天起七天，方便安排來店日期。不會改聊天背景，也不會發送通知。不需要手機定位。</p><label><input type="checkbox" data-weather-enabled> 顯示主頁天氣</label><label>查看地區<select data-weather-city>'+Object.entries(cities).map(([id,[name]])=>'<option value="'+id+'">'+name+'</option>').join('')+'</select></label><p class="small">請選店家所在或你想查看的地區。只儲存在這台裝置，可隨時關閉。</p><p data-weather-saved role="status"></p>';
 const enabled=box.querySelector('[data-weather-enabled]'),city=box.querySelector('[data-weather-city]');enabled.checked=prefs.enabled;city.value=prefs.city;
 const save=()=>{try{localStorage.setItem(key,JSON.stringify({enabled:enabled.checked,city:city.value}));box.querySelector('summary').textContent='主頁天氣 · '+(enabled.checked?'已開啟':'未開啟');box.querySelector('[data-weather-saved]').textContent='已儲存，返回訊息主頁即可查看。';}catch{box.querySelector('[data-weather-saved]').textContent='此裝置無法儲存設定，請稍後再試。';}};
 enabled.onchange=save;city.onchange=save;host.append(box);
}
function condition(symbol){if(/thunder/.test(symbol))return ['雷雨','⛈'];if(/snow|sleet/.test(symbol))return ['雨雪','❄'];if(/rain|showers/.test(symbol))return ['有雨','☂'];if(/fog/.test(symbol))return ['有霧','≋'];if(/partlycloudy|fair/.test(symbol))return ['晴時多雲','🌤'];if(/cloud/.test(symbol))return ['多雲','☁'];if(/clearsky/.test(symbol))return ['晴朗','☀'];return ['暫無概況','—'];}
export async function mountHomeWeather(host){
 host.querySelector('.homeWeather')?.remove();const prefs=weatherPreferences();if(!prefs.enabled)return;
 const card=document.createElement('details');card.className='homeWeather';card.innerHTML='<summary>來店天氣 · '+cities[prefs.city][0]+' · 讀取中</summary>';host.prepend(card);
 try{const data=await dailyWeather(prefs.city);if(!card.isConnected)return;if(!data.days)throw Error('unavailable');
 const today=data.days[0],summary=card.querySelector('summary');summary.textContent='來店天氣 · '+cities[prefs.city][0]+(today.available?' · '+condition(today.symbol)[0]+' '+today.min+'–'+today.max+'°':' · 今日資料待更新')+'　查看七天';
 const rail=document.createElement('div');rail.className='weatherDays';rail.setAttribute('aria-label','今天起七天天氣預估，左右滑動查看更多');
 data.days.forEach((day,i)=>{const tile=document.createElement('div'),[label,mark]=condition(day.symbol||'');tile.className='weatherDay';const date=new Date(day.date+'T12:00:00+08:00');const name=i===0?'今天':date.toLocaleDateString('zh-TW',{weekday:'short',timeZone:'Asia/Taipei'});tile.innerHTML='<b></b><span aria-hidden="true"></span><small></small><strong></strong>';tile.children[0].textContent=name+' '+day.date.slice(5).replace('-','/');tile.children[1].textContent=day.available?mark:'—';tile.children[2].textContent=day.available?label:'待更新';tile.children[3].textContent=day.available?day.min+'–'+day.max+'°':'—';rail.append(tile);});card.append(rail);
 const note=document.createElement('p');note.className='small';note.textContent='溫度為預報時點的範圍（今天僅含剩餘時段），圖示為中午附近概況，非全天保證。預報可能變動；不會影響可預約時段。更新：'+(data.updated?new Date(data.updated).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'未知');card.append(note);
 const credit=document.createElement('p');credit.className='small';credit.innerHTML='資料：<a href="https://www.met.no/" target="_blank" rel="noopener">MET Norway</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · 依預報時點整理';card.append(credit);
 }catch{if(card.isConnected){card.querySelector('summary').textContent='來店天氣 · 暫時無法更新';const p=document.createElement('p');p.textContent='天氣服務暫時無法連線，仍可正常傳訊息與預約。稍後返回主頁再試。';card.append(p);}}
}
