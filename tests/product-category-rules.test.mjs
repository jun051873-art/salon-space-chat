import fs from 'node:fs';import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,runTransaction,serverTimestamp,updateDoc} from 'firebase/firestore';
import {categoryName,renameCategory} from '../product-categories.js';
const env=await initializeTestEnvironment({projectId:'demo-salon',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync('firestore.rules','utf8')}});
try{const admin=env.authenticatedContext('HcFJGmzHw6MYoWbFmtq9IyFSjvL2').firestore(),customer=env.authenticatedContext('cat-test').firestore();
await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'announcements','settings'),{name:'保留店名',productCategoryOrder:['護髮','洗髮']});await setDoc(doc(c.firestore(),'products','one'),{category:'護髮',title:'商品',image:'原照片'});});
for(const [from,to]of [['護髮','保養'],['保養','護髮']])await runTransaction(admin,async tx=>{const ref=doc(admin,'announcements','settings'),s=await tx.get(ref);tx.update(ref,{...renameCategory(s.data(),from,to),updatedAt:serverTimestamp()});});
const cfg=(await getDoc(doc(customer,'announcements','settings'))).data();assert.equal(cfg.name,'保留店名');assert.equal(categoryName('保養',cfg),'護髮');assert.equal(categoryName('護髮',cfg),'護髮');assert.equal(Object.hasOwn(cfg.productCategoryAliases,'護髮'),false);
const p=(await getDoc(doc(customer,'products','one'))).data();assert.equal(p.image,'原照片');assert.equal(categoryName(p.category,cfg),'護髮');await assertFails(updateDoc(doc(customer,'announcements','settings'),{productCategoryAliases:{護髮:'竄改'}}));console.log('PASS admin rename/revert persisted without alias cycles, customer read and write denial, preserved shop settings and photos');
}finally{await env.cleanup();}
