export function inquiryTimes(config,day){
 const h=config.weeklyHours?.[new Date(day+'T12:00:00+08:00').getUTCDay()];if(h?.closed)return [];
 const configured=(config.times||[]).filter(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t));
 const candidates=configured.length?configured:Array.from({length:48},(_,i)=>String(Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00'));
 return [...new Set(candidates)].filter(t=>t>=(h?.open||'11:30')&&t<(h?.close||'19:00')).sort();
}
export function inquiryText(day,times,services,note=''){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!times.length||!services.length)throw Error('請選擇日期、至少一個時段與服務項目');
 return `【預約詢問・待店家確認】\n日期：${day}\n方便時段（皆可）：${[...times].sort().join('、')}\n服務：${services.join('、')}${note.trim()?'\n備註：'+note.trim().slice(0,300):''}\n以上僅為詢問，請店家回覆確認時間。`;
}
