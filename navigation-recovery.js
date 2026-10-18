// Shared escape route for both roles. Never reload or clear stored user data.
export function keyboardViewport(view,height,editing){return !!(editing&&view&&(view.scale||1)<1.05&&view.height<height-100);}
export function restoreViewport(){
 document.activeElement?.blur?.();
 const meta=document.querySelector('meta[name="viewport"]');
 if(meta&&window.visualViewport?.scale>1.05){
  // Only reset on an explicit back/reset action; leave pinch zoom available afterwards.
  const original=meta.dataset.normalViewport||meta.content;meta.dataset.normalViewport=original;
  meta.content='width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover';
  clearTimeout(restoreViewport.timer);restoreViewport.timer=setTimeout(()=>{meta.content=original;delete meta.dataset.normalViewport;window.dispatchEvent(new Event('salon:viewport'));},180);
 }
 window.dispatchEvent(new Event('salon:viewport'));
}
export function navigateBack(){
 const dialogs=[...document.querySelectorAll('dialog[open]')];
 if(dialogs.length){const top=dialogs.at(-1);const event=new Event('cancel',{cancelable:true});if(top.dispatchEvent(event))top.close();restoreViewport();return true;}
 const button=[...document.querySelectorAll('#leaveChat,#back,#toolBack,.pageBack,[data-chat-back]')].find(b=>b.getClientRects().length&&!b.closest('.hidden')&&!b.disabled);
 if(!button)return false;
 restoreViewport();button.click();return true;
}
export function installEdgeBack(){
 let gesture=null,suppressClick=false;
 const clear=()=>{gesture=null;};
 document.addEventListener('touchstart',e=>{
  clear();if(e.touches.length!==1)return;const p=e.touches[0],view=window.visualViewport;
  // client coordinates include the visual viewport offset when a page is zoomed.
  if(p.clientX-(view?.offsetLeft||0)>28)return;
  gesture={id:p.identifier,x:p.clientX,y:p.clientY,scale:view?.scale||1};
 },{passive:true,capture:true});
 document.addEventListener('touchmove',e=>{
  if(!gesture)return;if(e.touches.length!==1){clear();return;}
  const p=[...e.touches].find(p=>p.identifier===gesture.id);if(!p){clear();return;}
  const dx=(p.clientX-gesture.x)*gesture.scale,dy=(p.clientY-gesture.y)*gesture.scale;
  if(Math.abs(dy)>30&&Math.abs(dy)>dx){clear();return;}
  if(dx>12&&dx>Math.abs(dy)*1.5&&e.cancelable)e.preventDefault();
  if(dx>=75&&Math.abs(dy)<55){clear();suppressClick=navigateBack();if(suppressClick){e.stopPropagation();setTimeout(()=>suppressClick=false,500);}}
 },{passive:false,capture:true});
 for(const type of ['touchend','touchcancel'])document.addEventListener(type,clear,{passive:true,capture:true});
 document.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
}
