import {CHAT_IMAGE_TTL} from '../chat-image-retention.js';
// Bounded metadata-only sweep. A durable cursor visits old clients' uploads too.
// Atomic preconditions ensure a simultaneous merge/edit cannot lose message text.
export async function sweepChatImages({root,token,now=Date.now(),request=fetch,limit=10}){
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 async function call(url,body){
  const response=await request(url,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  if(response.status===404&&body===undefined)return null;
  const data=await response.json();if(!response.ok)throw Error('IMAGE_RETENTION_'+response.status);return data;
 }
 const base=root.replace(/^https?:\/\/[^/]+\/v1\//,'').replace(/\/$/,''),stateName=base+'/broadcasts/_chatImageRetention';
 const state=await call(root+'broadcasts/_chatImageRetention');
 const cursor=state?.fields?.cursor?.stringValue||'';
 const structuredQuery={from:[{collectionId:'files',allDescendants:true}],select:{fields:[{fieldPath:'type'}]},orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit};
 if(cursor.startsWith(base+'/'))structuredQuery.startAt={values:[{referenceValue:cursor}],before:false};
 const rows=(await call(root.slice(0,-1)+':runQuery',{structuredQuery})).filter(x=>x.document).map(x=>x.document);
 let deleted=0;
 for(const file of rows){
  const path=file.name.slice(base.length+1);
  if(!file.name.startsWith(base+'/')||!/^chats\/[^/]+\/files\/[^/]+$/.test(path)||!file.fields?.type?.stringValue?.startsWith('image/')||!file.updateTime)continue;
  const messagePath=path.replace('/files/','/messages/'),message=await call(root+messagePath);
  const sent=Date.parse(message?.fields?.createdAt?.timestampValue||file.createTime||'');
  if(!Number.isFinite(sent)||sent<=0||now<sent+CHAT_IMAGE_TTL)continue;
  const writes=[{delete:file.name,currentDocument:{updateTime:file.updateTime}}];
  if(message){
   if(!message.updateTime||!message.fields?.attachment?.mapValue?.fields?.type?.stringValue?.startsWith('image/'))continue;
   writes.push({update:{name:message.name,fields:{attachment:{mapValue:{fields:{expired:{booleanValue:true}}}}}},updateMask:{fieldPaths:['attachment.expired']},currentDocument:{updateTime:message.updateTime}});
  }
  await call(root.slice(0,-1)+':commit',{writes});deleted++;
 }
 // If interrupted, replay is safe: deleted files are absent, text is never removed.
 await call(root.slice(0,-1)+':commit',{writes:[{update:{name:stateName,fields:{cursor:{stringValue:rows.length===limit?rows.at(-1).name:''},lastRun:{timestampValue:new Date(now).toISOString()},deleted:{integerValue:String(deleted)}}},currentDocument:state?{updateTime:state.updateTime}:{exists:false}}]});
 return {scanned:rows.length,deleted};
}
