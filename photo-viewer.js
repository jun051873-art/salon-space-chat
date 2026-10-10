// Display the stored image directly; never make a thumbnail or canvas copy.
export function openPhotoViewer(src,alt='照片'){
 const dialog=document.createElement('dialog');
 dialog.setAttribute('aria-label',alt+'・照片檢視');
 dialog.style.cssText='position:fixed;inset:0;box-sizing:border-box;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:#111;color:#fff;overflow:hidden;';
 const bar=document.createElement('div');
 bar.style.cssText='position:absolute;top:0;left:0;right:0;z-index:2;display:flex;gap:10px;justify-content:flex-end;padding:calc(12px + env(safe-area-inset-top)) 16px 12px;background:linear-gradient(#111,transparent);';
 const stage=document.createElement('div');
 stage.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none;';
 const img=new Image();img.src=src;img.alt=alt;img.draggable=false;
 img.style.cssText='display:block;width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;transform-origin:center;user-select:none;-webkit-user-select:none;';
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent='正在載入照片…';status.style.cssText='position:absolute;bottom:calc(20px + env(safe-area-inset-bottom));left:12px;right:12px;text-align:center;pointer-events:none;';
 stage.append(img);dialog.append(stage,bar,status);document.body.append(dialog);
 let scale=1,x=0,y=0,previous=null;const pointers=new Map();
 const paint=()=>{const w=img.offsetWidth,h=img.offsetHeight;const boundX=Math.max(0,(w*scale-stage.clientWidth)/2),boundY=Math.max(0,(h*scale-stage.clientHeight)/2);x=Math.max(-boundX,Math.min(boundX,x));y=Math.max(-boundY,Math.min(boundY,y));img.style.transform=`translate(${x}px,${y}px) scale(${scale})`;};
 const zoom=value=>{scale=Math.max(1,Math.min(4,value));if(scale===1)x=y=0;paint();};
 const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',label);b.style.cssText='font:inherit;font-weight:700;min-width:44px;min-height:44px;margin:0;padding:8px 14px;border:1px solid #777;border-radius:24px;background:#222;color:white;';b.onclick=action;bar.append(b);return b;};
 button('縮小',()=>zoom(scale/1.5));button('放大',()=>zoom(scale*1.5));button('重設',()=>zoom(1));const close=button('關閉',()=>dialog.close());
 stage.addEventListener('dblclick',()=>zoom(scale===1?2:1));
 const gesture=()=>{const p=[...pointers.values()];if(p.length===2)return{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};return p[0]||null;};
 stage.addEventListener('pointerdown',e=>{if(e.button>0||pointers.size>=2)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});stage.setPointerCapture(e.pointerId);previous=gesture();});
 stage.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=gesture();if(previous&&next){if(next.d&&previous.d)scale=Math.max(1,Math.min(4,scale*next.d/previous.d));if(scale>1){x+=next.x-previous.x;y+=next.y-previous.y;}paint();}previous=next;});
 const end=e=>{pointers.delete(e.pointerId);previous=gesture();};for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,end);
 const key=e=>{if(e.key==='+'||e.key==='='){e.preventDefault();zoom(scale*1.5);}else if(e.key==='-'){e.preventDefault();zoom(scale/1.5);}else if(e.key==='0'){e.preventDefault();zoom(1);}};dialog.addEventListener('keydown',key);
 const resize=()=>paint();window.addEventListener('resize',resize);
 const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 dialog.addEventListener('close',()=>{document.body.style.overflow=oldOverflow;window.removeEventListener('resize',resize);dialog.remove();},{once:true});
 img.decode().then(()=>{status.textContent='雙指縮放、拖曳查看照片';paint();}).catch(()=>{status.textContent='照片暫時無法開啟，請關閉後再試。';});
 dialog.showModal();close.focus();return dialog;
}

export function bindPhotoViewer(img){
 if(!img||img.closest('[data-photo-viewer]'))return;
 const button=document.createElement('button');button.type='button';button.dataset.photoViewer='';button.setAttribute('aria-label','放大查看'+(img.alt||'照片'));
 button.style.cssText='display:block;width:100%;margin:0;padding:0;border:0;border-radius:inherit;background:transparent;cursor:zoom-in;';
 img.before(button);button.append(img);button.onclick=()=>openPhotoViewer(img.currentSrc||img.src,img.alt||'照片');
}
