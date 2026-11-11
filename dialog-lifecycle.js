let revision=0;
export function beginDialogRequest(){
 const ticket=++revision,origin=document.querySelector('dialog.salonDialog[open]');
 return ()=>ticket===revision&&(!origin||(origin.isConnected&&origin.open));
}
// Keep focus and the modal backdrop continuous when moving between cards.
export function presentDialog(dialog,{nested=false,loading=false}={}){
 revision++;
 const previous=nested?[]:[...document.querySelectorAll('dialog.salonDialog')];
 dialog.classList.add('stableDialog');
 if(loading){dialog.classList.add('asyncFormDialog');dialog.setAttribute('aria-busy','true');}
 const heading=dialog.querySelector('.dialogHead h2');
 if(heading){heading.tabIndex=-1;heading.setAttribute('autofocus','');}
 const close=dialog.querySelector('[data-close]');
 if(close)close.onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);
 // Open before retiring the previous card: no exposed background or focus jump.
 dialog.showModal();
 heading?.focus({preventScroll:true});
 for(const old of previous){if(old.open)old.close();old.remove();}
 return dialog;
}
