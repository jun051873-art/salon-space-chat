// Shared, framework-free notification presentation; usable by the service worker.
(function(root){
  const colors = ['teal','violet','rose','amber'];
  function palette(value,role){return colors.includes(value)?value:role==='admin'?'violet':'teal';}
  function iconPath(role,color,size=192){return './icons/'+role+'-'+palette(color,role)+'-'+size+'.png';}
  function destination(value,origin){
    try {
      const url=new URL(value||'./customer.html',origin+'/salon-space-chat/');
      if(url.origin!==origin || !/^\/salon-space-chat\/(admin|customer)\.html$/.test(url.pathname))throw Error('invalid destination');
      if(url.pathname.endsWith('/customer.html'))url.hash='chat';
      return url;
    }catch{return new URL('/salon-space-chat/customer.html#chat',origin);}
  }
  function notification(data,branding,origin){
    const url=destination(data.url,origin),role=url.pathname.endsWith('/admin.html')?'admin':'customer';
    const brand=branding?.[role]||{};
    const icon=new URL(iconPath(role,brand.color),origin+'/salon-space-chat/').href;
    const title=data.title||brand.name||'沙龍訊息';
    let body=String(data.body||'您有一則新訊息').trim();
    // Older Worker builds included the notification title as the first line
    // of the body. Strip that line so existing deployments still look clean.
    const firstLine=body.split(/\\r?\\n/,1)[0].trim();
    if(firstLine===String(title).trim())body=body.slice(firstLine.length).replace(/^\\s*[\\r\\n]+\\s*/,'').trim();
    return {title,options:{
      // Keep sender/shop identity in the title. Repeating it in the body makes
      // iOS Lock Screen previews noisy and duplicates the same line.
      body:body||'您有一則新訊息',icon,
      badge:new URL('./icons/'+role+'-badge.png',origin+'/salon-space-chat/').href,
      tag:data.tag||('salon-message-'+Date.now()),renotify:true,requireInteraction:false,
      silent:false,timestamp:Date.now(),data:{url:url.href},
    }};
  }
  root.SalonPush={palette,iconPath,destination,notification};
})(globalThis);
