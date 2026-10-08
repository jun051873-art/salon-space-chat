// Keep one scroll surface; visualViewport is used only while a keyboard is open.
let frame=0;
function sync(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
 const root=document.documentElement,view=window.visualViewport;
 const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
 const keyboard=editing&&view&&view.height<window.innerHeight-100;
 root.style.setProperty('--salon-height',keyboard?`${view.height}px`:'100dvh');
 root.style.setProperty('--salon-top',keyboard?`${view.offsetTop}px`:'0px');
 root.classList.toggle('keyboardOpen',!!keyboard);
 });}
for(const event of ['resize','pageshow','salon:viewport'])window.addEventListener(event,sync);
window.visualViewport?.addEventListener('resize',sync);
window.visualViewport?.addEventListener('scroll',sync);
document.addEventListener('visibilitychange',sync);
document.addEventListener('focusin',sync);
document.addEventListener('focusout',()=>{sync();setTimeout(sync,300);setTimeout(sync,700);});
sync();
// Edge-only back gesture leaves inbox swipe actions and photo cropping independent.
let backGesture=null;
document.addEventListener('pointerdown',e=>{if(e.clientX>24||e.target.closest('input,textarea,select,dialog,.swipeShell,canvas'))return;backGesture={id:e.pointerId,x:e.clientX,y:e.clientY};},{passive:true});
document.addEventListener('pointerup',e=>{const g=backGesture;backGesture=null;if(!g||g.id!==e.pointerId||e.clientX-g.x<85||Math.abs(e.clientY-g.y)>55)return;const candidates=[...document.querySelectorAll('.pageBack,#back,#toolBack,[data-chat-back]')];const button=candidates.find(b=>b.getClientRects().length&&!b.closest('.hidden'));button?.click();},{passive:true});
document.addEventListener('pointercancel',()=>backGesture=null,{passive:true});
