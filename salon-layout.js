import{keyboardViewport,installEdgeBack}from'./navigation-recovery.js?v=N44';
import{installInteractions}from'./salon-interactions.js?v=N44';
installInteractions();
// Keep one scroll surface; visualViewport is used only while a keyboard is open.
let frame=0;
function sync(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
 const root=document.documentElement,view=window.visualViewport;
 const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
 const keyboard=keyboardViewport(view,window.innerHeight,editing);
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
installEdgeBack();
