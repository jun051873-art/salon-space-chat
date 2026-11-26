// The worker serializes updates so simultaneous deliveries cannot overwrite
// one another. Store message identifiers only, never push preview text.
(function(root){
 const retention=7*24*60*60*1000;
 const checkpointPath='/salon-space-chat/__admin_badge_checkpoint__';
 async function readCheckpoint(storage,origin){
  const cache=await storage.open('salon-unread-messages');
  return (await cache.match(new URL(checkpointPath,origin).href))?.json();
 }
 let writing=Promise.resolve();
 function saveCheckpoint(storage,origin,keys,startedAt){
  const write=writing.then(async()=>{
   const existing=await readCheckpoint(storage,origin);
   if(existing?.startedAt>startedAt)return;
   const cache=await storage.open('salon-unread-messages');
   await cache.put(new URL(checkpointPath,origin).href,new Response(JSON.stringify({keys,startedAt})));
  });
  writing=write.catch(()=>{});
  return write;
 }
 function reconcile(unread,seen,time,state,keys,startedAt){
  if((state.lastSync||0)>=startedAt)return;
  state.lastSync=startedAt;
  for(const key of Object.keys(unread))if(unread[key]<startedAt){delete unread[key];seen[key]=time;}
  for(const key of keys){unread[key]??=startedAt;seen[key]=time;}
 }
 function create({load,save,apply,checkpoint=async()=>null,now=Date.now}){
  let pending=Promise.resolve();
  function change(role,update,applyCount=apply){
   const task=pending.then(async()=>{
    const state=await load(role)||{};
    const {unread={},seen={}}=state;
    const time=now();
    for(const [key,at] of Object.entries(seen))if(at<time-retention&&!Object.hasOwn(unread,key))delete seen[key];
    if(role==='admin'){
     const saved=await checkpoint().catch(()=>null);
     if(saved&&Array.isArray(saved.keys)&&Number.isFinite(saved.startedAt)){
      reconcile(unread,seen,time,state,saved.keys,saved.startedAt);
     }
    }
    update(unread,seen,time,state);
    await save(role,{unread,seen,lastSync:state.lastSync||0});
    return applyCount(Object.keys(unread).length);
   });
   pending=task.catch(()=>{});
   return task;
  }
  return {
   push(role,key){return change(role,(unread,seen,time)=>{
    if(!Object.hasOwn(seen,key))unread[key]=time;
    seen[key]=time;
   });},
   sync(role,keys,startedAt,applyCount){return change(role,(unread,seen,time,state)=>{
    reconcile(unread,seen,time,state,keys,startedAt);
   },applyCount);}
  };
 }
 root.SalonPushBadge={create,readCheckpoint,saveCheckpoint};
})(globalThis);
