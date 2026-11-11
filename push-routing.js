// Route our data-only pushes in the worker, before Firebase forwards them to
// any visible same-origin window (which may belong to the other app role).
(function(root){
 function destination(data,origin){
  try{const url=new URL(data?.url,origin);return url.origin===origin&&/^\/salon-space-chat\/(admin|customer)\.html$/.test(url.pathname)?url:null;}catch{return null;}
 }
 function owns(payload,origin){
  return payload?.from==='103245363547'&&!payload.notification&&!!destination(payload.data,origin)&&String(payload.data?.tag||'').startsWith('salon-');
 }
 function customerRoom(data,origin){
  const url=destination(data,origin);if(!url?.pathname.endsWith('/customer.html'))return null;
  // Read legacy payloads as well, so the web fix works before Worker deployment.
  const id=String(data?.messageId||''),tag=String(data?.tag||''),suffix='-'+id;
  return id&&tag.startsWith('salon-')&&tag.endsWith(suffix)?tag.slice(6,-suffix.length)||null:null;
 }
 async function customerChatVisible(data,clients,origin){
  const room=customerRoom(data,origin);if(!room)return false;
  try{
   const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
   return (await Promise.all(windows.filter(client=>client.visibilityState==='visible'&&destination({url:client.url},origin)?.pathname.endsWith('/customer.html')).map(client=>new Promise(resolve=>{
    const channel=new MessageChannel();let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
    const timer=setTimeout(()=>finish(false),350);
    channel.port1.onmessage=event=>{const state=event.data;finish(state?.visible===true&&Array.isArray(state.rooms)&&state.rooms.includes(room));};
    try{client.postMessage({type:'SALON_CUSTOMER_CHAT_STATE'},[channel.port2]);}catch{finish(false);}
   })))).some(Boolean);
  }catch{return false;}
 }
 root.SalonPushRouting={owns,customerRoom,customerChatVisible};
})(globalThis);
