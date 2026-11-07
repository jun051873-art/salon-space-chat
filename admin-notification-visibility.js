// Shared by the admin page and notification worker. Unknown state never silences a push.
(function(root){
 function room(data,origin){
  try{
   const url=new URL(data?.url,origin);
   if(url.origin!==origin||url.pathname!=='/salon-space-chat/admin.html')return null;
   return url.searchParams.get('chat')||(url.hash.startsWith('#chat/')?decodeURIComponent(url.hash.slice(6)):null);
  }catch{return null;}
 }
 function suppress(data,state,origin){
  const target=room(data,origin);
  return !!target&&state?.visible===true&&Array.isArray(state.rooms)&&state.rooms.includes(target);
 }
 async function visibleChat(data,clients,origin){
  if(!room(data,origin))return false;
  try{
   const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
   const results=await Promise.all(windows.filter(client=>{
    try{const url=new URL(client.url);return client.visibilityState==='visible'&&url.origin===origin&&url.pathname==='/salon-space-chat/admin.html';}catch{return false;}
   }).map(client=>new Promise(resolve=>{
    const channel=new MessageChannel();let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
    const timer=setTimeout(()=>finish(false),350);
    channel.port1.onmessage=event=>finish(suppress(data,event.data,origin));
    try{client.postMessage({type:'SALON_ADMIN_CHAT_STATE'},[channel.port2]);}catch{finish(false);}
   })));
   return results.some(Boolean);
  }catch{return false;}
 }
 root.SalonAdminNotification={room,suppress,visibleChat};
})(globalThis);
