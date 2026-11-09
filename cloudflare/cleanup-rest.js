// Firestore REST transport for the owner-only cleanup state machine.
import {cleanupError} from './customer-cleanup.js';
export const encodeValue=v=>v==null?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):typeof v==='string'?{stringValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(encodeValue)}}:{mapValue:{fields:encodeFields(v)}};
export const encodeFields=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encodeValue(x)]));
export function decodeValue(v){if('nullValue'in v)return null;if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('timestampValue'in v)return v.timestampValue;if(v.arrayValue)return(v.arrayValue.values||[]).map(decodeValue);if(v.mapValue)return decodeFields(v.mapValue.fields||{});return v;}
export const decodeFields=raw=>Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,decodeValue(v)]));
export function createCleanupRest({project,token,fetcher=fetch,emulatorOrigin}){
 const base='projects/'+project+'/databases/(default)/documents',root=(emulatorOrigin||'https://firestore.googleapis.com')+'/v1/'+base;
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const encodePath=p=>p.split('/').map(encodeURIComponent).join('/');
 async function request(url,payload){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetcher(url,{method:payload===undefined?'GET':'POST',headers,body:payload===undefined?undefined:JSON.stringify(payload),signal:controller.signal});const out=await response.json();if(!response.ok){const e=cleanupError(out.error?.message||out.error?.status||'雲端操作失敗',response.status);e.code=out.error?.status;throw e;}return out;}finally{clearTimeout(timer);}
 }
 const snapshot=d=>({path:d.name.split('/documents/')[1],version:d.updateTime,raw:d.fields||{},data:decodeFields(d.fields||{})});
 async function get(path){try{return snapshot(await request(root+'/'+encodePath(path)));}catch(e){if(e.status===404)return null;throw e;}}
 async function select(path,{field,op,value,cursor='',limit=4}={}){
  const parts=path.split('/'),collectionId=parts.pop(),parent=parts.join('/');
  const structuredQuery={from:[{collectionId}],orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit};
  if(field)structuredQuery.where={fieldFilter:{field:{fieldPath:field},op,value:encodeValue(value)}};
  if(cursor)structuredQuery.startAt={values:[{referenceValue:base+'/'+path+'/'+cursor}],before:false};
  const out=await request(root+(parent?'/'+encodePath(parent):'')+':runQuery',{structuredQuery});
  return out.filter(x=>x.document).map(x=>snapshot(x.document));
 }
 async function children(path){let pageToken='',ids=[];do{const out=await request(root+'/'+encodePath(path)+':listCollectionIds',{pageSize:100,...(pageToken?{pageToken}:{})});ids.push(...(out.collectionIds||[]));pageToken=out.nextPageToken||'';}while(pageToken);return ids;}
 async function commit(writes){
  const body={writes:writes.map(w=>{
   const name=base+'/'+w.path,currentDocument=w.version?{updateTime:w.version}:w.create?{exists:false}:undefined;
   if(w.delete)return {delete:name,...(currentDocument?{currentDocument}:{})};
   const fields=w.raw||encodeFields(w.data);
   return {update:{name,fields},...(w.merge?{updateMask:{fieldPaths:Object.keys(fields)}}:{}),...(currentDocument?{currentDocument}:{})};
  })};
  if(new TextEncoder().encode(JSON.stringify(body)).length>8*1024*1024)throw cleanupError('資料批次過大，未執行清除');
  return request(root+':commit',body);
 }
 const authRoot='https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(project)+'/accounts:';
 async function authAction(action,uid){try{await request(authRoot+action,{localId:uid,...(action==='update'?{disableUser:true}:{})});}catch(e){if(!/USER_NOT_FOUND|EMAIL_NOT_FOUND/.test(e.message))throw e;}}
 return {db:{get,list:(path,cursor,limit)=>select(path,{cursor,limit}),query:(path,field,op,value,limit)=>select(path,{field,op,value,limit}),children,commit},auth:{disable:uid=>authAction('update',uid),remove:uid=>authAction('delete',uid)}};
}
