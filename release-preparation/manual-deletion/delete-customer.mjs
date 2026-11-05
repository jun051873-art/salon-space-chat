/** Operator-only: never import into a web page. Defaults to read-only. */
import {assess,validateTarget,PROJECT} from './deletion-plan.mjs';
export const GRACE_MS=65*60*1000;
export async function processCustomer({db,auth,uid,mode='inspect',identityConfirmed=false,writersPaused=false,confirm='',now=Date.now()}){
 validateTarget(PROJECT,uid);
 if(!['inspect','prepare','erase'].includes(mode))throw Error('未知操作');
 const report=await assess({project:PROJECT,uid,db});
 if(mode==='inspect')return report;
 if(!identityConfirmed)throw Error('須先透過原有聯絡方式核對本人身分');
 if(report.blockers.length>2)throw Error('有合併身分或預約紀錄；停止，先人工核對，不能連帶刪除');
 const ref=db.doc(`users/${uid}`);
 if(mode==='prepare'){
  await auth.updateUser(uid,{disabled:true});
  await auth.revokeRefreshTokens(uid);
  const data=(await ref.get()).data();
  // Preserve the original quarantine time on retries; updateUser is idempotent.
  await ref.update({status:'deletion-pending',deletionPreparedAt:data.deletionPreparedAt||now});
  return {stage:'prepared',earliestEraseAt:(data.deletionPreparedAt||now)+GRACE_MS,deleted:false};
 }
 if(confirm!==`DELETE ${uid}`||!writersPaused)throw Error('須確認精確UID，並暫停店家寫入、其他管理工具與背景Worker後才能刪除');
 const data=(await ref.get()).data();
 if(data.status!=='deletion-pending'||!Number.isFinite(data.deletionPreparedAt)||now-data.deletionPreparedAt<GRACE_MS)throw Error('停用後至少等65分鐘，讓舊登入權杖失效');
 try{if(!(await auth.getUser(uid)).disabled)throw Error('帳號未停用');}catch(e){if(e.code!=='auth/user-not-found')throw e;}
 // Remove Auth first. Keep user marker until all descendants have been deleted,
 // so an interrupted run can safely be resumed after inspecting again.
 try{await auth.deleteUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
 const userPath=`users/${uid}`;
 const paths=report.firestorePaths.filter(p=>p!==userPath).sort((a,b)=>b.split('/').length-a.split('/').length);
 for(const path of paths)await db.doc(path).delete();
 const check=await assess({project:PROJECT,uid,db});
 if(check.firestorePaths.some(p=>p!==userPath))throw Error('仍有資料或新的寫入；停止，保留停用狀態，排查後重跑');
 await ref.delete();
 for(const path of report.firestorePaths)if((await db.doc(path).get()).exists)throw Error('刪除後複查失敗，勿回覆完成');
 return {stage:'erased',deleted:true,documents:report.firestorePaths.length,authDeleted:true};
}
