// The worker serializes updates so simultaneous deliveries cannot overwrite
// one another. Store message identifiers only, never push preview text.
(function(root){
 const retention=7*24*60*60*1000;
 function create({load,save,apply,now=Date.now}){
  let pending=Promise.resolve();
  function change(role,update){
   const task=pending.then(async()=>{
    const state=await load(role)||{};
    const {unread={},seen={}}=state;
    const time=now();
    for(const [key,at] of Object.entries(seen))if(at<time-retention&&!Object.hasOwn(unread,key))delete seen[key];
    update(unread,seen,time,state);
    await save(role,{unread,seen,lastSync:state.lastSync||0});
    return apply(Object.keys(unread).length);
   });
   pending=task.catch(()=>{});
   return task;
  }
  return {
   push(role,key){return change(role,(unread,seen,time)=>{
    if(!Object.hasOwn(seen,key))unread[key]=time;
    seen[key]=time;
   });},
   sync(role,keys,startedAt){return change(role,(unread,seen,time,state)=>{
    if((state.lastSync||0)>startedAt)return;
    state.lastSync=startedAt;
    for(const key of Object.keys(unread))if(unread[key]<startedAt)delete unread[key];
    for(const key of keys){unread[key]??=startedAt;seen[key]=time;}
   });}
  };
 }
 root.SalonPushBadge={create};
})(globalThis);
