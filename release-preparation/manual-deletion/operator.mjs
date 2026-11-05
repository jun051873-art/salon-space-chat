import {processCustomer} from './delete-customer.mjs';
import {PROJECT,validateTarget} from './deletion-plan.mjs';
const [mode='inspect',uid,...flags]=process.argv.slice(2);
validateTarget(PROJECT,uid);
const {initializeApp,applicationDefault}=await import('firebase-admin/app');
const {getFirestore}=await import('firebase-admin/firestore');
const {getAuth}=await import('firebase-admin/auth');
const app=initializeApp({projectId:PROJECT,credential:applicationDefault()});
try {
 const result=await processCustomer({db:getFirestore(app),auth:getAuth(app),uid,mode,identityConfirmed:flags.includes('--identity-verified'),writersPaused:flags.includes('--writers-paused'),confirm:flags.includes('--confirm-target')?`DELETE ${uid}`:''});
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
