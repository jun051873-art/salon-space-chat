import assert from 'node:assert/strict';
import { configuredPhrases, parsePhraseLines, DEFAULT_CUSTOMER_PHRASES, DEFAULT_ADMIN_PHRASES } from '../quick-phrases.js';

assert.deepEqual(configuredPhrases({}, 'customer'), DEFAULT_CUSTOMER_PHRASES);
assert.deepEqual(configuredPhrases({}, 'admin'), DEFAULT_ADMIN_PHRASES);
assert.deepEqual(configuredPhrases({ customerPhrases: ['自訂', '  ', '<安全>'] }), ['自訂', '<安全>']);
assert.deepEqual(configuredPhrases({ customerPhrases: [] }), DEFAULT_CUSTOMER_PHRASES);
assert.deepEqual(configuredPhrases({ customerPhrases: [], phrasePresetVersion: 2 }), []);
assert.deepEqual(parsePhraseLines('第一句\n第二句\n第一句\n\n 第三句 '), ['第一句', '第二句', '第三句']);
assert.equal(parsePhraseLines(Array.from({ length: 14 }, (_, i) => `用語${i}`).join('\n')).length, 12);
assert.equal(parsePhraseLines('x'.repeat(150))[0].length, 120);
console.log('quick phrases: ok');
