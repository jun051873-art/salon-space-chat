// Retain unchanged message/image nodes across receipts, cache and live snapshots.
export function reconcileMessages(container,rows,render,moreHTML=''){
 const old=new Map([...container.children].filter(n=>n.dataset.message).map(n=>[n.dataset.message,n]));
 const nodes=[];
 if(moreHTML){let older=container.querySelector('[data-older]');if(!older||older._source!==moreHTML){const t=document.createElement('template');t.innerHTML=moreHTML;older=t.content.firstElementChild;older._source=moreHTML;}nodes.push(older);}
 for(const row of rows){const html=render(row);let node=old.get(row.id);
  if(!node||node._source!==html){const t=document.createElement('template');t.innerHTML=html;const next=t.content.firstElementChild;
   // An already-decoded photo must survive changes to its timestamp/read label.
   const photo=node?.querySelector('.chatImageAttachment'),replacement=next.querySelector('.chatImageAttachment');
   if(photo&&replacement&&photo.querySelector('img')?.dataset.imagePreview===replacement.querySelector('img')?.dataset.imagePreview)replacement.replaceWith(photo);
   node?.replaceWith(next);node=next;node._source=html;
  }nodes.push(node);
 }
 const keep=new Set(nodes);for(const node of [...container.children])if(!keep.has(node))node.remove();
 let cursor=container.firstElementChild;for(const node of nodes){if(node!==cursor)container.insertBefore(node,cursor);cursor=node.nextElementSibling;}
}

// Merge durable outbox entries without pinning old notification retries below new messages.
export function mergeOutboxRows(rows, entries) {
 const ids=new Set(rows.map(r=>r.id));
 const time=v=>typeof v==='number'?v:(v?.toMillis?.()??(v?.seconds*1000+(v.nanoseconds||0)/1e6))||0;
 const result=[...rows];
 for(const e of entries){
  if(ids.has(e.id))continue;
  // Only unsent writes are optimistic messages. Notification retries are not
  // messages: their cloud document may have been edited, retracted or paged out.
  // Keep the durable retry record, but never resurrect its original text here.
  if(e.stage!=='queued')continue;
  result.push({id:e.id,text:e.text,senderId:e.senderId,senderRole:e.role,createdAt:e.at,pending:e.stage==='queued',pendingFailure:e.stage==='queued'&&!!e.error,attachment:e.attachment,sticker:e.sticker});
 }
 return result.sort((a,b)=>time(a.createdAt)-time(b.createdAt));
}
