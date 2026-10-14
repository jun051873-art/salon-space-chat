import assert from 'node:assert/strict';
import { homeFeatureData } from '../home-feature.js';

const catalog = [
  { id: 'active', title: '護髮油', description: '居家保養', price: 900, salePrice: 750, image: 'data:image/jpeg;base64,abc' },
  { id: 'hidden', title: '舊商品', active: false }
];

assert.equal(homeFeatureData({ homeFeatureEnabled: false, homeTitle: '服務' }, catalog), null);
assert.deepEqual(homeFeatureData({ homeFeatureEnabled: true, homeFeatureProductId: 'active' }, catalog), {
  kind: '商品', title: '護髮油', text: '居家保養\n特價 $750', image: 'data:image/jpeg;base64,abc', product: catalog[0]
});
assert.equal(homeFeatureData({ homeFeatureEnabled: true, homeFeatureProductId: 'hidden' }, catalog), null);
assert.deepEqual(homeFeatureData({ homeFeatureEnabled: true, homeTitle: '頭皮護理', homeText: '服務介紹' }), {
  kind: '服務', title: '頭皮護理', text: '服務介紹', image: '', product: null
});
console.log('home feature selection: ok');
