// Delegated once: live snapshots replace rows without duplicating handlers.
export function bindMessageMenu(root,open){
 root._openMessageMenu=open;if(root._messageMenuBound)return;root._messageMenuBound=true;
 let timer,row,x,y,consumed=false;
 const cancel=()=>{clearTimeout(timer);timer=null;};
 const show=()=>{cancel();if(row?.isConnected){consumed=true;root._openMessageMenu(row);}};
 root.addEventListener('pointerdown',e=>{cancel();consumed=false;if(e.button!==0||e.target.closest('button,a,input,textarea,img'))return;row=e.target.closest('.bubbleRow');if(!row?.querySelector('[data-retract]'))return;x=e.clientX;y=e.clientY;timer=setTimeout(show,500);});
 root.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-x,e.clientY-y)>10)cancel();});
 for(const type of ['pointerup','pointercancel','pointerleave','scroll'])root.addEventListener(type,cancel);
 root.addEventListener('contextmenu',e=>{if(e.target.closest('img,a,input,textarea'))return;row=e.target.closest('.bubbleRow');if(!row)return;e.preventDefault();if(!consumed)show();});
 root.addEventListener('click',e=>{if(consumed){e.preventDefault();e.stopPropagation();consumed=false;}},true);
}
