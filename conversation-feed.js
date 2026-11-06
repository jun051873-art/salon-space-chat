// Cached documents must still emit the metadata-only server confirmation.
export function watchServerDocument(subscribe,ref,next,error){return subscribe(ref,{includeMetadataChanges:true},snapshot=>{if(!snapshot.metadata.fromCache)next(snapshot.data());},error);}
import {createPagedFeed} from './chat-feed.js?v=N117';
// Every historical room retains its own cursor and original document path.
export function createConversationFeed({room,watchAccount,watchGroup,makeSource,onGroup=()=>{},onChange,onError}) {
 let accountStop=null,groupStop=null,feeds=new Map(),states=new Map(),running=false,dead=false,generation=0,groupId=null,signature='';
 const emit=reason=>{
  const all=[...states.values()],docs=all.flatMap(s=>s.docs).sort((a,b)=>{
   const x=a.data().createdAt,y=b.data().createdAt;
   return (y?.seconds||0)-(x?.seconds||0)||(y?.nanoseconds||0)-(x?.nanoseconds||0)||a.id.localeCompare(b.id);
  });
  onChange({docs,more:all.some(s=>s.more),loading:all.some(s=>s.loading),ready:all.length===feeds.size&&all.every(s=>s.ready),fromCache:all.some(s=>s.fromCache),reason});
 };
 function configure(group){
  const rooms=group?.state==='active'?group.historyRoomIds:[room];
  if(!Array.isArray(rooms)||!rooms.length||rooms.length>40||!rooms.includes(room)||rooms.some(r=>typeof r!=='string'||!r||r.includes('/')))throw Error('聊天室連結不完整，請店家重新核對');
  const ids=[...new Set(rooms)].sort(),key=JSON.stringify(ids);
  onGroup(group,ids);
  if(signature===key){for(const f of feeds.values())f.start();return;}
  signature=key;const gen=++generation;
  for(const f of feeds.values())f.destroy();feeds.clear();states.clear();
  for(const sourceRoom of ids){
   const f=createPagedFeed({...makeSource(sourceRoom),field:'createdAt',pageSize:30,onError,
    onChange:s=>{
     if(dead||generation!==gen)return;
     const docs=s.docs.map(d=>({id:sourceRoom===room?d.id:sourceRoom+'/'+d.id,sourceRoom,sourceId:d.id,metadata:d.metadata,ref:d.ref,data:()=>d.data()}));
     states.set(sourceRoom,{...s,docs});emit(s.reason);
    }});
   feeds.set(sourceRoom,f);
  }
  for(const f of feeds.values())f.start();
 }
 function fail(e){++generation;for(const f of feeds.values())f.destroy();feeds.clear();states.clear();signature='';onChange({docs:[],more:false,loading:false,ready:false,fromCache:false,reason:'reset'});onError(e);}
 function start(){if(dead||running)return;running=true;
  accountStop=watchAccount(account=>{
   const id=account?.conversationId||null;
   if(id===groupId&&signature){for(const f of feeds.values())f.start();return;}
   groupStop?.();groupStop=null;groupId=id;
   if(!id){try{configure(null);}catch(e){fail(e);}return;}
   groupStop=watchGroup(id,group=>{try{if(!group||group.state!=='active')throw Error('共用聊天室尚未啟用');configure(group);}catch(e){fail(e);}},fail);
  },fail);
 }
 function pause(){running=false;accountStop?.();accountStop=null;groupStop?.();groupStop=null;groupId=null;for(const f of feeds.values())f.pause();}
 return {start,pause,destroy(){pause();dead=true;++generation;for(const f of feeds.values())f.destroy();feeds.clear();states.clear();},
  async loadMore(){await Promise.all([...feeds.values()].map(f=>f.loadMore()));},entries:()=>[...states.values()].flatMap(s=>s.docs)};
}
export function sourceOf(view,id){const d=view.docs?.find(d=>d.id===id);return {room:d?.sourceRoom||view.room,id:d?.sourceId||id};}

export function watchConversationRooms({room,watchAccount,watchGroup,watchRoom,onChange,onError}){
 let stopGroup=null,stops=[],rows=new Map(),dead=false,version=0;
 function clear(){++version;stops.forEach(f=>f());stops=[];rows.clear();}
 function configure(ids){clear();const gen=version;if(!Array.isArray(ids)||ids.length>40||!ids.includes(room)){onError(Error('聊天室連結不完整'));return;}
  for(const id of new Set(ids))stops.push(watchRoom(id,(data,fromCache)=>{if(dead||gen!==version)return;rows.set(id,{id,...data,fromCache});onChange([...rows.values()],rows.size===new Set(ids).size&&[...rows.values()].every(x=>!x.fromCache));},e=>{clear();onChange([],false);onError(e);}));
 }
 const stopAccount=watchAccount(account=>{stopGroup?.();stopGroup=null;
  if(account?.conversationId)stopGroup=watchGroup(account.conversationId,group=>{if(group?.state==='active')configure(group.historyRoomIds);else{clear();onChange([],false);onError(Error('共用聊天室尚未啟用'));}},e=>{clear();onChange([],false);onError(e);});else configure([room]);
 },onError);
 return ()=>{dead=true;stopAccount?.();stopGroup?.();clear();};
}
