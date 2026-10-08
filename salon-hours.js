export const WEEK_LABELS=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
export function suggestedHours(){return Object.fromEntries(WEEK_LABELS.map((_,i)=>[i,{closed:i===1||i===2,open:'11:30',close:i===0?'17:00':'19:00'}]));}
export function validateHours(hours){for(let i=0;i<7;i++){const h=hours[i];if(!h||typeof h.closed!=='boolean')throw Error('請設定完整的一週營業時間');if(!h.closed&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close)||h.close<=h.open))throw Error(WEEK_LABELS[i]+'：結束時間必須晚於開始時間');}return hours;}
export function hoursForDay(config,day){if(!config.weeklyHours)return null;return config.weeklyHours[new Date(day+'T12:00:00+08:00').getUTCDay()]||null;}
export function availableTimes(config,day){const h=hoursForDay(config,day);return (config.times||[]).filter(t=>!h||(!h.closed&&t>=h.open&&t<h.close));}
export function hoursText(config){if(!config.weeklyHours)return config.hours||'營業時間請洽店家';return [1,2,3,4,5,6,0].map(i=>{const h=config.weeklyHours[i];return WEEK_LABELS[i]+'　'+(!h||h.closed?'休息':h.open+'–'+h.close)}).join('\n');}
