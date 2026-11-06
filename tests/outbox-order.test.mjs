import assert from 'node:assert/strict';
import {mergeOutboxRows} from '../chat-render.js';
const cloud=[{id:'a',createdAt:{seconds:20}},{id:'b',createdAt:{seconds:30}}];
const retry={id:'old',text:'收到測試',at:10000,stage:'notify-error'};
assert.deepEqual(mergeOutboxRows(cloud,[retry]).map(x=>x.id),['a','b']);
assert.deepEqual(mergeOutboxRows(cloud,[{...retry,at:25000}]).map(x=>x.id),['a','b']);
assert.equal(mergeOutboxRows(cloud,[{...retry,at:25000,stage:'queued'}])[1].createdAt,25000);
assert.deepEqual(mergeOutboxRows(cloud,[{...retry,at:40000,observed:true}]).map(x=>x.id),['a','b']);
assert.deepEqual(mergeOutboxRows(cloud,[{...retry,stage:'queued'}]).map(x=>x.id),['old','a','b']);
assert.deepEqual(mergeOutboxRows(cloud,[{...retry,id:'a'}]).map(x=>x.id),['a','b']);
assert.equal(mergeOutboxRows([], [{...retry,observed:true}]).length,0);
assert.equal(mergeOutboxRows([], [{...retry,stage:'queued'}]).length,1);
console.log('PASS old push retries stay out of newest window; pending messages retained; timestamps, ordering and deduplication');

for(const stage of ['stored','notify-error','done']){
 for(const at of [undefined,NaN,0,25000,40000]){
  assert.deepEqual(mergeOutboxRows(cloud,[{...retry,stage,at}]),cloud);
  assert.deepEqual(mergeOutboxRows([],[{...retry,stage,at}]),[]);
 }
}
const retracted=[{id:'old',text:'',retracted:true,createdAt:{seconds:25}}];
assert.deepEqual(mergeOutboxRows(retracted,[retry]),retracted);
