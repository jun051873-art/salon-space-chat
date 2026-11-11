// Start the primary query alongside membership validation, but expose nothing
// until the validated conversation feed adopts this source.
export function prefetchSource(source){
 let latest,error,observer=null,stop=null,closed=false,adopted=false;
 stop=source.subscribe(s=>{if(closed)return;latest=s;error=null;observer?.next(s);},e=>{if(closed)return;error=e;observer?.error(e);});
 return {source:{...source,subscribe(next,onError){
  if(adopted)return source.subscribe(next,onError);
  adopted=true;observer={next,error:onError};
  queueMicrotask(()=>{if(closed||observer?.next!==next)return;if(error)onError(error);else if(latest)next(latest);});
  return ()=>{closed=true;observer=null;stop?.();};
 }},cancel(){closed=true;observer=null;stop?.();}};
}
