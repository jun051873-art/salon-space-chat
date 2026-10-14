export const DEFAULT_CUSTOMER_PHRASES = [
  '好的，沒問題 😊',
  '謝謝你 🙏',
  '收到，謝謝！',
  '我想再詢問一下…',
  '可以幫我預約嗎？'
];

export const DEFAULT_ADMIN_PHRASES = [
  'OK，這個時間可以，已為你確認預約。',
  '我查看一下時間，稍後回覆你。',
  '這個時段已滿，方便換個時間嗎？',
  '謝謝你，收到！'
];

export function parsePhraseLines(value, limit = 12) {
  return [...new Set(String(value ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean))]
    .map(line => line.slice(0, 120))
    .slice(0, limit);
}

export function configuredPhrases(config = {}, role = 'customer') {
  const key = role === 'admin' ? 'adminPhrases' : 'customerPhrases';
  const defaults = role === 'admin' ? DEFAULT_ADMIN_PHRASES : DEFAULT_CUSTOMER_PHRASES;
  const values = Array.isArray(config[key]) ? config[key] : defaults;
  return values.map(value => String(value ?? '').trim()).filter(Boolean).slice(0, 12);
}
