import './push-badge-ledger.js?v=P180';

function millis(value){return value?.toMillis?.()??Number(value||0);}

export function unreadRooms(rows,role){
 const [latest,read]=role==='admin'?['lastCustomerMessageAt','readAdminMs']:['lastAdminMessageAt','readCustomerMs'];
 return rows.filter(row=>row.id&&!row.adminDeleted&&millis(row[latest])>Number(row[read]||0))
  .map(row=>({id:row.id,after:Number(row[read]||0),latest:millis(row[latest])}));
}

// Only query rooms with unread incoming messages. Reuse confirmed results for
// unchanged room watermarks and limit concurrency for large inboxes.
export function createUnreadMessageCount({role,load,publish,visible=()=>!document.hidden,now=Date.now}){
 let snapshot=null,observedAt=0,revision=0,running=false,queued=false,allowBackground=false;
 let cache=new Map();
 const idle=[];
 async function flush(){
  if(!snapshot||(!visible()&&!allowBackground))return;
  if(running){queued=true;return;}
  running=true;
  try{
   do{
    queued=false;
    const current=snapshot,version=revision,startedAt=observedAt;
    if(!current||(!visible()&&!allowBackground))break;
    const keys=[],next=new Map();
    for(let i=0;i<current.length&&version===revision;i+=5){
     await Promise.all(current.slice(i,i+5).map(async room=>{
      const signature=room.after+':'+room.latest;
      const previous=cache.get(room.id);
      const msgs=previous?.signature===signature?previous.msgs:await load(room.id,room.after);
      next.set(room.id,{signature,msgs});
      for(const message of msgs)keys.push('salon-'+room.id+'-'+message);
     }));
    }
    if(version===revision){
     cache=next;
     await publish(role,keys,startedAt);
    }
   }while(queued);
  }catch{
   // Keep the worker's current badge when a cloud fetch is incomplete.
   if(queued)queueMicrotask(flush);
  }finally{running=false;for(const resolve of idle.splice(0))resolve();}
 }
 return {
  update(rows,startedAt=now(),allowHidden=false){snapshot=unreadRooms(rows,role);observedAt=startedAt;allowBackground=allowHidden||(running&&allowBackground);revision++;return flush();},
  refresh:flush,
  whenIdle:()=>running?new Promise(resolve=>idle.push(resolve)):Promise.resolve(),
  reset(){snapshot=null;allowBackground=false;revision++;cache.clear();}
 };
}

export async function publishUnreadMessages(role,keys,startedAt,env=globalThis){
 const navigator=env.navigator;
 let device='unknown';
 if(role==='admin'||role==='customer'){
  // Persist the authoritative count before changing the installed icon. A
  // suspended or newly started worker can then reconcile before its next push.
  if(env.caches)try{
   await globalThis.SalonPushBadge.saveCheckpoint(env.caches,new URL(env.location.href).origin,keys,startedAt,role);
  }catch{}
  if(!env.document.hidden)try{
   if(!keys.length&&typeof navigator.clearAppBadge==='function'){
    await navigator.clearAppBadge();device='cleared';
   }else if(typeof navigator.setAppBadge==='function'){
    await navigator.setAppBadge(keys.length);device=keys.length?'updated':'cleared';
   }
  }catch{device='failed';}
 }
 // Reconcile last, so a push received after the server snapshot can restore
 // its count if it arrived while the foreground clear was in flight.
 try{
  const registration=await navigator.serviceWorker?.getRegistration(env.location.href);
  if(registration?.active){
   registration.active.postMessage({type:'SALON_UNREAD_MESSAGES',role,keys,startedAt});
  }
 }catch{}
 return device;
}
