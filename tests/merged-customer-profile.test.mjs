import assert from 'node:assert/strict';
import {mergedProfileFields,createMergedProfileReader} from '../merged-customer-profile.js';
import {mergeConversations} from '../conversation-merge.js';
const old={id:'old',role:'customer',status:'active',createdAt:1,name:'小刀',avatar:'data:image/png;base64,old',profileCover:'cover',phone:'123',birthMonth:10,birthDay:9,gender:'男性'};
const fresh={id:'new',role:'customer',status:'active',createdAt:2,name:'新名字',avatar:'',phone:'',adminProfile:{phone:''}};
for(const primary of [old,fresh]){const p=mergedProfileFields(primary,[fresh,old]);assert.equal(p.avatar,old.avatar);assert.equal(p.phone,'123');assert.equal(p.birthDay,9);assert.equal(p.name,primary.name);}
assert.equal(mergedProfileFields({...fresh,avatar:'newphoto'},[old]).avatar,'newphoto');
assert.equal(mergedProfileFields({...fresh,adminProfile:{name:'店家暱稱',phone:'456'}},[old]).phone,'456');
const fields=mergedProfileFields(fresh,[{...old,status:'blocked',pushToken:'secret',role:'admin'}]);assert(!('status' in fields));assert(!('role' in fields));assert(!('pushToken' in fields));
assert(!('birthMonth' in mergedProfileFields({...fresh,birthMonth:1},[{id:'x',birthDay:9}])));
let reads=0;const accounts=[old,fresh].map(u=>({...u,conversationId:'group'}));
const reader=createMergedProfileReader({readUser:async id=>{reads++;return accounts.find(u=>u.id===id)},readGroup:async()=>({state:'active',primaryUid:'new',memberIds:['old','new']})});
const results=await Promise.all(accounts.map(u=>reader.resolve(u)));assert.equal(reads,2);assert(results.every(u=>u.id==='new'&&u.avatar===old.avatar));
await assert.rejects(reader.resolve({id:'outsider',conversationId:'group'}));
// Exercise the actual transaction, including a pre-existing merged group member.
const records=new Map([['users/old',old],['users/new',{...fresh,conversationId:'group'}],['users/third',{id:'third',role:'customer',status:'active',conversationId:'group',profileCover:'third-cover'}],['conversations/group',{state:'active',memberIds:['new','third'],historyRoomIds:['new','third'],revision:1}]]);
let writes=false;const snap=path=>({id:path.split('/').at(-1),exists:()=>records.has(path),data:()=>records.get(path)});
const tx={get:async path=>{assert.equal(writes,false,'transaction must read before writes');return snap(path)},set:(path,value,opts)=>{writes=true;records.set(path,opts?.merge?{...records.get(path),...value}:value)},update:(path,value)=>{writes=true;records.set(path,{...records.get(path),...value})}};
await mergeConversations({db:{},doc:(_, ...parts)=>parts.join('/'),runTransaction:(_,fn)=>fn(tx),stamp:()=>123,primaryUid:'new',secondaryUid:'old'});
assert.equal(records.get('users/new').avatar,old.avatar);assert.equal(records.get('users/new').profileCover,old.profileCover);assert.equal(records.get('users/new').adminProfile.phone,'123');
assert.equal(records.get('users/old').avatar,old.avatar);assert.equal(records.get('users/new').status,'active');assert.equal(records.get('conversations/group').memberIds.length,3);
console.log('PASS merged profile: both merge directions, conflicts, blank owner fields, birthday integrity, existing groups, cached reads, membership isolation and real merge transaction');
