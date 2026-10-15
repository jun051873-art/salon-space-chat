// Re-pin after asynchronous image/layout changes; release as soon as the reader scrolls.
export function pinChatBottom(view){
 view.stopBottom?.();
 const el=view.el;let active=true,frame=0;
 const bottom=()=>{if(!active)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(active&&el.getClientRects().length)el.scrollTop=el.scrollHeight;});};
 const stop=()=>{active=false;cancelAnimationFrame(frame);observer?.disconnect();el.removeEventListener('load',bottom,true);for(const e of ['wheel','touchstart','pointerdown','keydown'])el.removeEventListener(e,stop);};
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(bottom):null;
 observer?.observe(el);for(const child of el.children)observer?.observe(child);
 el.addEventListener('load',bottom,true);for(const e of ['wheel','touchstart','pointerdown','keydown'])el.addEventListener(e,stop,{passive:true});
 view.stopBottom=stop;bottom();
}
