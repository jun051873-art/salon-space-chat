// Track the real entry path independently of content refreshes.
export function createPageTrail(initial='inbox'){
 let entries=[{id:initial,scroll:0}],index=0;
 return {
  visit(id,scroll=0){if(id===entries[index].id)return;entries[index].scroll=Math.max(0,Number(scroll)||0);if(id==='inbox'||id==='setup'){entries=[{id,scroll:0}];index=0;return;}entries=entries.slice(0,index+1);entries.push({id,scroll:0});index++;},
  back(){if(index>0)index--;return {...entries[index]};},
  target(){return index>0?entries[index-1].id:'inbox';},
  reset(id='inbox'){entries=[{id,scroll:0}];index=0;}
 };
}
