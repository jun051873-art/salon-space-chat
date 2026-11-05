// Owner-only customer grouping. Assignments never change message timestamps.
const millis=v=>v?.toMillis?.()??(typeof v==='number'?v:typeof v==='string'?(Date.parse(v)||0):(Number(v?.seconds||0)*1000+Number(v?.nanoseconds||0)/1e6));
export function latestMessageTime(r){return Math.max(millis(r.lastCustomerMessageAt),millis(r.lastAdminMessageAt))||millis(r.updatedAt);}
export function filterDesignerRooms(rows,filter='*'){
 return rows.filter(r=>filter==='*'||(r.assignedDesignerId||'')===filter).sort((a,b)=>latestMessageTime(b)-latestMessageTime(a)||String(b.id).localeCompare(String(a.id)));
}
export function assignedDesignerLabel(row,config={}){return row.assignedDesignerId?(config.designers||[]).find(x=>x.id===row.assignedDesignerId)?.name||row.assignedDesignerName||'原指定設計師':'未指定';}
export function designerFilterOptions(config={},rows=[]){
 const entries=new Map((config.designers||[]).map(x=>[x.id,{id:x.id,name:x.name+(x.active===false?'（停用）':'')}]));
 for(const r of rows)if(r.assignedDesignerId&&!entries.has(r.assignedDesignerId))entries.set(r.assignedDesignerId,{id:r.assignedDesignerId,name:r.assignedDesignerName||'原指定設計師'});
 return [{id:'*',name:'全部客人'},{id:'',name:'未指定'},...entries.values()];
}
export function hasDuplicateCustomers(rows){
 const names=new Set(),phones=new Set();
 for(const row of rows){const name=String(row.name||'').trim(),phone=String(row.phone||'').replace(/\D/g,'');if((name&&names.has(name))||(phone&&phones.has(phone)))return true;if(name)names.add(name);if(phone)phones.add(phone);}
 return false;
}
