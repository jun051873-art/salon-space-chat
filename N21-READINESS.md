# N21 手機穩定性與上線檢查（2026-10-16）

## 此次修改
- 訊息用 keyed DOM 更新；已讀/快取快照不再重建整串圖片。照片預留顯示高度、共用已載入圖片 URL，減少進入聊天室的位移。
- 商品/活動橫向列修正父容器最小寬度，使用原生捲動；滑動後不誤開商品。邊緣返回不攔截商品列。
- 小螢幕、平板、橫向及彈窗視窗高度適配；減少內容卡片重複模糊圖層，保留固定玻璃導航。
- 前景推播點擊直接切換到對應聊天室，不重新載入整個網頁。
- 群發相同照片在本機佇列只存一次；整批保存成功才送出。容量不足時保留草稿且不部分傳送。個別收件人失敗不阻塞其他人，原訊息編號供重試。
- 店家新客審核、主頁導覽新增待核准數量；桌面徽章合併未讀與待核准，讀訊息不會抹去新客待辦。
- 安裝教學不再把 iPhone 按鈕標成可直接安裝；保留 Safari/Chrome 步驟、複製網址、等候核准頁教學入口。Android 支援安裝提示時才呼叫瀏覽器安裝。
- 新客背景推播 Worker v8 程式已準備；須獨立部署 Cloudflare 才生效。新版前端會偵測此能力，不把尚未部署的功能冒充已啟用。

## 已執行測試（全部是假資料，不向正式客人發訊）
- `npm test`：既有訊息、權限、未讀、通知、主頁、主題、帳號、快速用語等回歸測試。
- `node tests/chat-render.test.mjs`：節點身分、已讀更新保留照片、前後插入與收回移除。
- `node tests/load-readiness.test.mjs`：200/300 收件人各一圖一文，400/600 唯一提交；離線、關閉重開、HTTP 回應遺失重試、整批容量失敗回滾。本機佇列峰值約 1.51/1.64 MiB（測試模擬 5 MiB 預算，實際各瀏覽器不同）。
- `node tests/worker-load.test.mjs`：200/300 併發自動回覆假請求、收件人隔離、來源重送不重複；新客提醒僅限本人、pending 狀態、10 次併發只推一次、核准入口。
- HTML 內嵌與變更 JavaScript 語法檢查。

這些是本機邏輯/故障模擬，不是 Firebase/FCM/Cloudflare 的真實 300 人壓測，也不量測真實手機掉幀。沒有讀取帳單/配額或在 iPhone、Android 實機建立 300 帳號。正式裝置仍需小批實測。

## 上線前尚需確認
1. Cloudflare v8 尚須部署，參閱下方。FCM 接受請求不代表手機一定已顯示；作業系統通知權限、省電、網路與專注模式會影響提醒。
2. Firebase 方案及剩餘容量未知。目前聊天圖片仍在每個收件人的 Firestore files 文件各保存一次；一張約 650,000 字元照片群發 300 人，約增加 195 MB 圖片字串（未計其他文件及索引），不是永久免費無限容量。大量長期群發下一階段應轉為受權限保護的共用媒體儲存，不改動既有資料。
3. Firestore 標準版免費額度：1 GiB 儲存、每日 50,000 reads / 20,000 writes；正式方案請以你的 Firebase 主控台為準。300 人各載入 30 則聊天約 9,000 次文件讀取，另有設定、圖片、重連等；不能只看「300 人」估算整天消耗。
4. 單次 300 人一圖一文群發基本聊天寫入約 1,500 次，另有回報、通知服務讀取。前端逐筆送出，需維持網頁開啟；關閉後下次開啟續傳，並非伺服器背景群發工作。
5. Cloudflare Free 每日 100,000 請求，每次執行有外部子請求上限；目前一人一則推播請求與 300 人合成一個請求不同。既有每日關懷排程會遍歷多名客人，未通過正式大量排程驗證，勿把它當作本次群發測試已驗證。
6. 客戶待核准數量上限 500、未讀對話監聽最近 100 筆，滿額會標 `+`，不是全部未讀精確總數。

官方參考：
- https://firebase.google.com/docs/firestore/quotas
- https://developers.cloudflare.com/workers/platform/limits/
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## Cloudflare v8 部署（保留現有 Secrets）
1. Cloudflare → Workers & Pages → `salon-space-notify` → Edit code。
2. 備份目前版本；用本專案 `cloudflare/worker-suite.js` 完整內容替換 Worker 程式，按 Deploy。
3. 保留 `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`，不要把私鑰貼到聊天或 GitHub。
4. 開啟 `https://salon-space-notify.jun051873.workers.dev/`，應顯示 `version: "8-join-alerts"` 和 `newCustomerNotifications: true`。
5. 用自己的測試裝置申請加入，店家應見新客數量；店家通知已啟用時驗證背景提醒，點擊開啟核准頁。未核准帳號不能讀取聊天室。

## 手機驗收順序
- iPhone Safari 分享→加入主畫面；Android Chrome 安裝/新增至主畫面，再由桌面開啟，確認通知為綠勾。
- 用自己的兩台裝置雙向文字/照片，進入聊天室看最新內容；未讀清除，待審新客徽章仍保留。
- 商品左右滑、上下捲、點圖片/關閉、返回；直橫向及小螢幕按鈕不溢出。
- 關螢幕放置後返回、切飛航模式後恢復；不清儲存、不重裝。
- 先少量已同意的熟客試用，確認正式後台用量再擴大，不直接向全體做壓測。

## 回復
本次以前的 main commit：`cb9f33b599a9b90bf2fa78be4f4e8d58f501774c`。可建立還原提交恢復前端檔案，不刪聊天室/登入資料。若本次有待傳共用圖片佇列，先讓佇列送完再還原 `chat-delivery.js`，舊版不認識共用 assetKey。Worker 可在 Cloudflare Versions 回復上一個部署。
