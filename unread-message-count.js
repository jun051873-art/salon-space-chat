function millis(value){return value?.toMillis?.()??Number(value||0);}

export function unreadRooms(rows,role){
 const [latest,read]=role==='admin'?['lastCustomerMessageAt','readAdminMs']:['lastAdminMessageAt','readCustomerMs'];
 return rows.filter(row=>row.id&&!row.adminDeleted&&millis(row[latest])>Number(row[read]||0))
  .map(row=>({id:row.id,after:Number(row[read]||0),latest:millis(row[latest])}));
}

// Only query rooms with unread incoming messages. Reuse confirmed results for
// unchanged room watermarks and limit concurrency for large inboxes.
export function createUnreadMessageCount({role,load,publish,visible=()=>!document.hidden,now=Date.now}){
 let snapshot=null,observedAt=0,revision=0,running=false,queued=false;
 let cache=new Map();
 async function flush(){
  if(!snapshot||!visible())return;
  if(running){queued=true;return;}
  running=true;
  try{
   do{
    queued=false;
    const current=snapshot,version=revision,startedAt=observedAt;
    if(!current||!visible())break;
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
    if(version===revision&&(role==='admin'||visible())){
     cache=next;
     await publish(role,keys,startedAt);
    }
   }while(queued);
  }catch{
   // Keep the worker's current badge when a cloud fetch is incomplete.
   if(queued)queueMicrotask(flush);
  }finally{running=false;}
 }
 return {
  update(rows,startedAt=now()){snapshot=unreadRooms(rows,role);observedAt=startedAt;revision++;return flush();},
  refresh:flush,
  reset(){snapshot=null;revision++;cache.clear();}
 };
}

export async function publishUnreadMessages(role,keys,startedAt,env=globalThis){
 const url=new URL(env.location.href);
 const registration=await env.navigator.serviceWorker?.getRegistration(url.href);
 const worker=registration?.active;
 if(worker&&(role==='admin'||!env.document.hidden))worker.postMessage({type:'SALON_UNREAD_MESSAGES',role,keys,startedAt});
}
