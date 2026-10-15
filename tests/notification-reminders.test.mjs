import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(path,import.meta.url),'utf8')).toString('base64'));
const {notificationState,mountNotificationHelp}=await load('../notification-help.js');
const base={apple:false,standalone:false,supported:true,permission:'default',ready:false};
assert.equal(notificationState(base),'enable');
assert.equal(notificationState({...base,apple:true}),'install');
assert.equal(notificationState({...base,apple:true,standalone:true}),'enable');
assert.equal(notificationState({...base,supported:false}),'unsupported');
assert.equal(notificationState({...base,permission:'denied',ready:true}),'denied');
assert.equal(notificationState({...base,permission:'granted'}),'enable','permission alone does not prove token registration');
assert.equal(notificationState({...base,permission:'granted',ready:true}),'ready');
const {appDot,refreshAppBadge,unreadSummary}=await load('../salon-unread.js');
const calls=[];
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{setAppBadge:n=>{calls.push(n);return Promise.resolve();},clearAppBadge:()=>{calls.push('clear');return Promise.resolve();}}});
appDot(true,true);appDot(false,false);appDot(false,true);
refreshAppBadge();assert.deepEqual(calls,[1,'clear','clear'],'unconfirmed empty data must not clear the desktop badge');
assert.equal(unreadSummary([{lastCustomerMessageAt:{toMillis:()=>200},readAdminMs:100},{lastCustomerMessageAt:100,readAdminMs:100}]),1);
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
assert.doesNotThrow(()=>appDot(true));
// Exercise the visible controls without Firebase or granting real permissions.
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};}
 append(...children){this.children.push(...children);}
 prepend(child){this.children.unshift(child);}
 replaceChildren(...children){this.children=[...children];}
 setAttribute(){}
}
globalThis.window=globalThis;
globalThis.Notification={permission:'default'};
globalThis.PushManager=function(){};
globalThis.matchMedia=()=>({matches:false});
globalThis.document={createElement:tag=>new Element(tag),head:new Element('head')};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Android',serviceWorker:{}}});
const host=new Element('main');let enabled=0;
const help=mountNotificationHelp(host,async()=>{enabled++;Notification.permission='granted';help.update(true);},'customer');
const panel=host.children[0];const originalChildren=[...panel.children];
const enableButton=panel.children.find(x=>x.textContent==='開啟訊息通知');
assert.ok(enableButton);await enableButton.onclick();assert.equal(enabled,1);
assert.equal(panel.dataset.ready,'true');assert.deepEqual(panel.children,originalChildren,'notification changes preserve controls and avoid rebuilding/focus jumps');help.update(true);assert.deepEqual(panel.children,originalChildren);
assert.ok(!panel.children.some(x=>x.textContent==='開啟訊息通知'&&!x.hidden),'completed setup must hide the permission button');
assert.ok(panel.children.some(x=>x.textContent==='通知設定教學'),'keep help accessible after setup');
Notification.permission='denied';help.update(false);
assert.ok(panel.children.some(x=>x.textContent?.includes('通知已關閉')));
console.log('PASS reminders: install/denied/unsupported states, saved-token readiness, numeric badge, unread/read clearing');
assert.ok(!panel.children.some(x=>x.textContent==='測試手機提示'),'customer has no test button in DOM');
Notification.permission='granted';const ownerHost=new Element('main');const ownerHelp=mountNotificationHelp(ownerHost,async()=>{},'admin');ownerHelp.update(true);
assert.ok(ownerHost.children[0].children.some(x=>x.textContent==='測試手機提示'&&!x.hidden),'admin retains testing');
