# P159 — 店家聊天室手動模式

聊天室上方可切換自動回覆與手動聊天；每次啟用一小時，可延長一小時或立即結束。以伺服器建立時間儲存在管理員專用 customerNotes；離開頁面不清除期限。合併顧客以共同歷史聊天室鍵同步。

手動期間暫停關鍵字、營業時間與排程自動訊息；到期由 Worker 依絕對時間恢復，不依賴裝置計時器。自動模式鎖定輸入區，須先開手動聊天。

## 部署

前端須搭配 release-preparation/P159/worker-bundle.js，覆蓋 Cloudflare salon-space-notify 的 worker.js 後部署。保留原有環境變數、憑證及排程。健康檢查應回傳 version=22-timed-manual-chat 與 features.timedManualChat=true。前端偵測後端尚未就緒時不啟用切換，以免顯示手動卻仍發送自動回覆。

不需變更 Firestore 規則或 Android AAB。

## 驗證

通過 npm test、訊息編輯與收回測試、手動模式 DOM 測試、Worker 到期/延長/合併顧客/自動關心隔離測試。未宣稱實體手機端到端測試完成。
