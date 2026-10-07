export const ADMIN_UID='HcFJGmzHw6MYoWbFmtq9IyFSjvL2';
export const DAY=86400000;
export function millis(v){return v?.toMillis?.()??(v?.seconds?Number(v.seconds)*1000+Math.floor((v.nanoseconds||0)/1e6):typeof v==='number'?v:typeof v==='string'?Date.parse(v)||0:0);}
export function daysSince(v,now=Date.now()){const n=millis(v);return n?Math.max(0,Math.floor((now-n)/DAY)):null;}
export function tagsFor(u,now=Date.now()){
 const tags=[];const joined=daysSince(u.joinedAt||u.createdAt,now);if(joined!==null&&joined<30)tags.push('近一個月加入');
 const days=daysSince(u.lastCustomerMessageAt,now);
 if(days===null)tags.push('來訊日期待累積');else if(days>=365)tags.push('一年未聯絡');else if(days>=180)tags.push('半年未聯絡');else if(days>=90)tags.push('三個月未聯絡');else if(days>=60)tags.push('兩個月未聯絡');else if(days>=30)tags.push('一個月未聯絡');else tags.push('近期互動');
 if(u.status==='blocked')tags.push('已封鎖');if(u.status==='archived')tags.push('已封存');
 return [...new Set([...tags,...(Array.isArray(u.tags)?u.tags:[])])];
}
export function validBirthday(month,day){return Number.isInteger(month)&&Number.isInteger(day)&&month>0&&month<=12&&day>0&&day<=new Date(2000,month,0).getDate();}
export function localDay(date=new Date()){return date.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});}
export function matchesCustomer(u,{text='',tag='',gender='',birthday=false}={},now=Date.now()){
 if(text&&!`${u.name||''} ${u.phone||''}`.toLowerCase().includes(text.toLowerCase()))return false;
 if(tag&&!tagsFor(u,now).includes(tag))return false;if(gender&&u.gender!==gender)return false;
 if(birthday&&Number(u.birthMonth)!==Number(localDay(new Date(now)).slice(5,7)))return false;return true;
}
export function receiptCandidate(docs,viewer,known=0){let result=known;for(const d of docs){const x=typeof d.data==='function'?d.data():d;if(x.senderId!==viewer&&!d.metadata?.hasPendingWrites)result=Math.max(result,millis(x.createdAt));}return result;}
export function dueAutomation(rule,u,date=new Date()){
 if(!rule.enabled||u.status==='blocked'||u.status==='archived'||!u.name)return false;
 const day=localDay(date),[year,month,dateDay]=day.split('-').map(Number);
 if(rule.kind==='birthday')return Number(u.birthMonth)===month&&Number(u.birthDay)===dateDay;
 if(rule.kind==='inactive'){const days=daysSince(u.lastCustomerMessageAt,date.getTime());return days!==null&&days>=Number(rule.days||30);}
 return false;
}
export function automationKey(rule,u,date=new Date()){
 return rule.kind==='birthday'?`${rule.id}_${u.id}_${localDay(date).slice(0,4)}`:`${rule.id}_${u.id}_${millis(u.lastCustomerMessageAt)}`;
}
