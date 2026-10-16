export const DEFAULT_CUSTOMER_PHRASES = [
  "您好，我想預約剪髮，請問最近有可以安排的時段嗎？",
  "我想詢問染髮，可以先傳目前髮色和想染的照片給你看嗎？",
  "我想燙髮，可以幫我看看適合什麼髮型嗎？",
  "我想做護髮，請問有哪些項目可以選擇？",
  "我想體驗本月主打的頭皮去角質，請問有可以安排的時段嗎？",
  "請問這個服務大約多少費用、需要預留多久時間？",
  "我想預約的日期是＿＿，方便的時間是＿＿，想做＿＿。",
  "我想更改原本的預約，請問可以改到＿＿嗎？",
  "不好意思，這次預約需要取消，先跟你說一聲。",
  "不好意思，我可能會晚到約＿＿分鐘，這樣還方便嗎？",
  "想詢問這項商品是否有現貨，以及適合我的用法。",
  "好的，收到，謝謝你 😊"
];
export const DEFAULT_ADMIN_PHRASES = [
  "你好 😊 想做什麼服務呢？可以先告訴我方便的日期和時間。",
  "收到，我先查看時段，確認後再回覆你。",
  "這個時段可以，已幫你確認預約，到時見 😊",
  "這個時段目前已滿，還有哪些日期或時間方便呢？",
  "目前正在服務客人，會在空檔盡快回覆，謝謝你耐心等候。",
  "可以先傳目前頭髮和喜歡的髮型照片，我幫你看看。",
  "想了解一下，你近期有染髮、燙髮或漂髮嗎？",
  "費用和時間會依髮長、髮量與髮況評估，我先幫你確認。",
  "收到改期需求，我先確認新時段，再跟你確認預約。",
  "收到，這次預約已取消，之後需要安排再跟我說就好。",
  "收到晚到的訊息，我先確認後面的安排，再回覆你。",
  "謝謝詢問，我先確認商品庫存和適合的用法，再回覆你。"
];
const LEGACY_CUSTOMER = ['好的，沒問題 😊','謝謝你 🙏','收到，謝謝！','我想再詢問一下…','可以幫我預約嗎？'];
const LEGACY_ADMIN = ['OK，這個時間可以，已為你確認預約。','我查看一下時間，稍後回覆你。','這個時段已滿，方便換個時間嗎？','謝謝你，收到！'];
export function parsePhraseLines(value, limit = 12) {
  return [...new Set(String(value ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean))]
    .map(line => line.slice(0, 120))
    .slice(0, limit);
}

export function configuredPhrases(config = {}, role = 'customer') {
  const key = role === 'admin' ? 'adminPhrases' : 'customerPhrases';
  const defaults = role === 'admin' ? DEFAULT_ADMIN_PHRASES : DEFAULT_CUSTOMER_PHRASES;
  const saved = config[key];
  const legacy = role === 'admin' ? LEGACY_ADMIN : LEGACY_CUSTOMER;
  const unchangedLegacy = config.phrasePresetVersion !== 2 && Array.isArray(saved) && (saved.length === 0 || JSON.stringify(saved) === JSON.stringify(legacy));
  const values = unchangedLegacy || !Array.isArray(saved) ? defaults : saved;
  return values.map(value => String(value ?? '').trim()).filter(Boolean).slice(0, 12);
}
