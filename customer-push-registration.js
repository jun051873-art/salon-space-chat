// Keep each installation's push subscription instead of overwriting the account
// document used by legacy clients. Worker already reads the devices collection.
export function customerPushRegistration(uid,token,{storage=globalThis.localStorage,uuid=()=>globalThis.crypto.randomUUID(),href=globalThis.location.href}={}){
 if(!uid||uid.includes('/')||!token)throw Error('通知裝置資料不完整');
 const build=Number(new URL(href).searchParams.get('appBuild')||0);
 const key='salonCustomerPushDevice'+(build>0?'APK':'Web');
 let id=storage.getItem(key);
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(id||'')){id=uuid();storage.setItem(key,id);}
 return {path:'pushTokens/'+uid+'/devices/'+id,values:{token,uid,role:'customer',deviceId:id,client:build>0?'android-app':'web'}};
}
