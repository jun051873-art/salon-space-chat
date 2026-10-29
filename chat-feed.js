// Bounded live window + explicit cursor pages. No writes, polling or offsets.
export function createPagedFeed({subscribe,fetchPage,field,pageSize=30,onChange,onError,requestTimeout=15000}) {
 let docs=new Map(),liveIds=new Set(),cursor=null,more=false,ready=false;
 let unsubscribe=null,loading=false,epoch=0,pageEpoch=0,retryTimer=null,retryAttempts=0;
 function reconnect(){if(retryTimer)return;const delay=Math.min(30000,500*2**Math.min(retryAttempts++,6));retryTimer=setTimeout(()=>{retryTimer=null;start();},delay);}
 const compare=(a,b)=>{
  const x=a.data()[field],y=b.data()[field];
  return (y?.seconds||0)-(x?.seconds||0)||(y?.nanoseconds||0)-(x?.nanoseconds||0)||(a.id<b.id?1:a.id>b.id?-1:0);
 };
 const sorted=()=>[...docs.values()].sort(compare);
 const emit=(reason,fromCache=false)=>onChange({docs:sorted(),more,loading,ready,reason,fromCache});
 function start(){
  if(unsubscribe||retryTimer)return;
  const generation=++epoch;
  unsubscribe=subscribe(s=>{
   if(generation!==epoch)return;
   // Do not let a partial SDK cache overwrite an established server window.
   if(s.metadata.fromCache){if(!ready){for(const d of s.docs)docs.set(d.id,d);emit('cache',true);}return;}
   retryAttempts=0;
   const incoming=new Set(s.docs.map(d=>d.id));
   const disconnectedGap=liveIds.size&&s.docs.length===pageSize&&!s.docs.some(d=>liveIds.has(d.id));
   if(!ready||disconnectedGap){docs.clear();cursor=null;more=s.docs.length===pageSize;++pageEpoch;}
   const boundary=s.docs[s.docs.length-1];
   // A document removed inside the current window was deleted; older evictions
   // stay visible without adding an unbounded realtime listener.
   for(const id of liveIds)if(!incoming.has(id)){
    const old=docs.get(id);
    if(old&&(!boundary||compare(old,boundary)<=0))docs.delete(id);
   }
   for(const d of s.docs)docs.set(d.id,d);
   liveIds=incoming;ready=true;
   if(!cursor)cursor=boundary||null;
   if(s.docs.length<pageSize)more=false;
   emit(disconnectedGap?'reset':'live');
  },e=>{if(generation===epoch){++epoch;const stop=unsubscribe;unsubscribe=null;stop?.();onError(e);reconnect();}});
 }
 function pause(){++epoch;clearTimeout(retryTimer);retryTimer=null;unsubscribe?.();unsubscribe=null;}
 async function loadMore(){
  if(loading||!ready||!more||!cursor)return;
  loading=true;emit('loading');const generation=pageEpoch,after=cursor;
  let timeoutId;
  try{
   const s=await Promise.race([fetchPage(after),new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(Error('載入較早訊息逾時，請再試一次')),requestTimeout);})]);
   if(generation!==pageEpoch)return;
   for(const d of s.docs)if(!liveIds.has(d.id))docs.set(d.id,d);
   cursor=s.docs[s.docs.length-1]||cursor;more=s.docs.length===pageSize;
   emit('older');
  }catch(e){if(generation===pageEpoch)onError(e);}
  finally{clearTimeout(timeoutId);loading=false;if(generation===pageEpoch)emit('loaded');}
 }
 function destroy(){pause();++pageEpoch;docs.clear();liveIds.clear();}
 return {start,pause,loadMore,destroy,entries:sorted};
}
