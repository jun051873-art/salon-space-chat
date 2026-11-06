// Run in an authorized operator environment with firebase-admin installed and ADC.
// Password is supplied through the environment; never committed or printed.
import {initializeApp, applicationDefault, deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
const projectId='salon-space-chat';
const email=process.env.SALON_REVIEW_EMAIL;
const password=process.env.SALON_REVIEW_PASSWORD;
if(process.argv[2]!=='--create-approved-review-account')throw new Error('Explicit creation flag required.');
if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length<20)throw new Error('Supply SALON_REVIEW_EMAIL and a unique SALON_REVIEW_PASSWORD of at least 20 characters.');
const app=initializeApp({projectId,credential:applicationDefault()});
let uid;
try {
 const auth=getAuth(app),db=getFirestore(app);
 // An existing email fails closed. This script never updates an existing customer.
 uid='play-review-'+randomUUID();
 await auth.createUser({uid,email,password,displayName:'Google Play Review',disabled:true});
 const batch=db.batch();
 batch.create(db.doc(`users/${uid}`),{name:'Google Play Review (Test)',phone:'',role:'customer',status:'active',reviewAccess:true,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
 batch.create(db.doc(`chats/${uid}`),{userId:uid,name:'Google Play Review (Test)',phone:'',status:'active',lastMessage:'',updatedAt:FieldValue.serverTimestamp()});
 await batch.commit();
 await auth.updateUser(uid,{disabled:false});
 console.log(JSON.stringify({projectId,uid,email,status:'created; live sign-in validation still required'}));
} catch(error) {
 console.error('Provisioning stopped. Check the operator console. Any partially created account remains disabled; do not use it for review.');
 if(uid)console.error('Attempted test UID:',uid);
 console.error('Error code:',error.code || 'unknown');
 process.exitCode=1;
} finally {await deleteApp(app);}
