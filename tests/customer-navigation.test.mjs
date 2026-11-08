import assert from 'node:assert/strict';
import {createPageTrail} from '../customer-navigation.js';
import {homeMosaicHTML} from '../home-mosaic.js';
const trail=createPageTrail();
trail.visit('gallery',180);assert.equal(trail.target(),'inbox');
trail.visit('gallery');assert.deepEqual(trail.back(),{id:'inbox',scroll:180});
trail.visit('info',200);trail.visit('gallery',420);assert.equal(trail.target(),'info');assert.deepEqual(trail.back(),{id:'info',scroll:420});assert.deepEqual(trail.back(),{id:'inbox',scroll:200});
trail.visit('chat',100);trail.visit('info',0);trail.visit('gallery',80);assert.equal(trail.back().id,'info');assert.equal(trail.back().id,'chat');
trail.reset();trail.visit('holidays',160);assert.equal(trail.back().id,'inbox');
trail.visit('featureDetail',90);trail.back();trail.visit('preferences',90);assert.equal(trail.back().id,'inbox');
const esc=s=>String(s??'');assert.match(homeMosaicHTML({sections:{holidays:true}},esc),/data-home-holidays/);assert.equal(homeMosaicHTML({sections:{holidays:false}},esc),'');
console.log('PASS real-source back targets, refresh deduplication, nested routes, restored scroll, root navigation and independent holiday entrance');

const admin=createPageTrail('adminHome',[]);
admin.visit('tool:display',20);admin.visit('tool:gallery',120);admin.visit('chat:a',240);
assert.deepEqual(admin.back(),{id:'tool:gallery',scroll:240});
assert.deepEqual(admin.back(),{id:'tool:display',scroll:120});
assert.equal(admin.back().id,'adminHome');admin.reset('admin');admin.visit('chat:b');assert.equal(admin.back().id,'admin');
console.log('PASS shop tools and chats return to the actual entry route');
