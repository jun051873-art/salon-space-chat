import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto,generateKeyPairSync,verify} from 'node:crypto';
const source=fs.readFileSync('release-preparation/P144/worker-bundle.js','utf8').replace(/export \{\s*worker_suite_default as default\s*\};\s*$/,'');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={FIREBASE_PROJECT_ID:'salon-space-chat',FIREBASE_CLIENT_EMAIL:'test@example.invalid',FIREBASE_PRIVATE_KEY:privateKey.export({format:'pem',type:'pkcs8'}),CUSTOMER_CLEANUP_RULES_VERSION:'P141'};
const context=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array,atob,btoa,Response,Request,URLSearchParams,AbortController,setTimeout,clearTimeout,console:{error(){}},fetch:async()=>Response.json({users:[{localId:'attacker'}]})});
vm.runInContext(source+';globalThis.api={worker:worker_suite_default,mint:recoveryCustomToken};',context);
const jwt=await context.api.mint(env,'main'),[header,payload,sig]=jwt.split('.');const claims=JSON.parse(Buffer.from(payload,'base64url'));
assert.equal(claims.uid,'main');assert.equal(claims.iss,env.FIREBASE_CLIENT_EMAIL);assert.equal(claims.sub,claims.iss);assert.equal(claims.exp-claims.iat,300);assert.equal(claims.aud,'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');assert(verify('RSA-SHA256',Buffer.from(header+'.'+payload),publicKey,Buffer.from(sig,'base64url')));
for(const [headers,body,expected] of [[{}, {action:'recovery-issue',primaryUid:'main'},401],[{Authorization:'Bearer fake'}, {action:'recovery-issue',primaryUid:'main'},403],[{Origin:'https://evil.test',Authorization:'Bearer fake'},{action:'recovery-redeem',code:'x'},403]]){
 const result=await context.api.worker.fetch(new Request('https://example.invalid',{method:'POST',headers,body:JSON.stringify(body)}),env,{});assert.equal(result.status,expected);
}
const health=await(await context.api.worker.fetch(new Request('https://example.invalid'),env,{})).json();assert.equal(health.version,'19-customer-recovery');assert.equal(health.features.customerRecovery,true);
console.log('PASS bundled Worker: RSA signature, Firebase audience, UID, short expiry, missing auth, nonowner issuance and cross-origin rejection');
