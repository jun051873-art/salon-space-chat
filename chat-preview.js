// A preview is deliberately independent of the live chat/feed/read-receipt lifecycle.
export function bindLongPress(element, openPreview, {delay=500, tolerance=12}={}) {
 let timer=null, start=null, consumed=false;
 element.addEventListener('selectstart',e=>e.preventDefault());
 const cancel=()=>{clearTimeout(timer);timer=null;start=null;};
 element.addEventListener('pointerdown',e=>{
  if(e.button>0||e.isPrimary===false)return;
  cancel();consumed=false;start={x:e.clientX,y:e.clientY};
  timer=setTimeout(()=>{timer=null;consumed=true;globalThis.getSelection?.()?.removeAllRanges();openPreview();},delay);
 });
 element.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>tolerance)cancel();});
 ['pointerup','pointercancel','lostpointercapture','pointerleave'].forEach(type=>element.addEventListener(type,cancel));
 element.addEventListener('click',e=>{if(consumed){e.preventDefault();e.stopImmediatePropagation();consumed=false;}},true);
 element.addEventListener('contextmenu',e=>{e.preventDefault();cancel();if(!consumed){consumed=true;openPreview();}});
 element.addEventListener('keydown',e=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();openPreview();}});
 return cancel;
}
export async function readPreview({room,read,cache,now=Date.now()}) {
 const old=cache.get(room);
 if(old&&now-old.at<15000)return old.rows;
 const rows=await read(room,12);
 cache.set(room,{at:now,rows});
 if(cache.size>20)cache.delete(cache.keys().next().value);
 return rows;
}
