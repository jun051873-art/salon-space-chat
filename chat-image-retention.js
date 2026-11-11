// Chat attachments only. Product, profile and announcement assets never enter here.
export const CHAT_IMAGE_DAYS=90;
export const CHAT_IMAGE_TTL=CHAT_IMAGE_DAYS*86400000;
export function imageTime(value){
 if(typeof value==='number')return value;
 if(typeof value==='string')return Date.parse(value)||0;
 return value?.toMillis?.()||(value?.seconds?value.seconds*1000+(value.nanoseconds||0)/1e6:0);
}
export function chatImageExpired(message,now=Date.now()){
 if(!message?.attachment?.type?.startsWith('image/'))return false;
 if(message.attachment.expired===true)return true;
 const sent=imageTime(message.createdAt);
 return !message.pending&&sent>0&&now>=sent+CHAT_IMAGE_TTL;
}
