# P152 — 聊天照片保留 90 天

店家及客人傳送至 `chats/{room}/files/{id}` 的 image/* 附件，依原訊息的伺服器 createdAt 計算 90 天，既有照片亦適用。聊天室及文字不刪除。商品、頭像、公告、PDF 與文字附件不列入。裝置已下載的照片不會被遠端刪除。

- 網頁：到期顯示「圖片已到期」，移除圖片及下載入口；已開啟的聊天室會在期限到達時更新。照片檢視器到期關閉。
- Firestore rules：到期讀取由伺服器拒絕，包括店家。未部署此規則前，只有新版介面的限制。
- Worker：沿用每分鐘 Cron，獨立於提醒工作掃描 10 筆附件中繼資料，保存游標。到期刪除檔案與標記訊息在同一批次提交，使用版本前置條件；文字欄位不改動。掃描完成前，已部署規則仍會拒絕過期讀取。大量歷史檔案實體釋放需等掃描輪巡完成。
- 舊客戶端傳送的照片亦可清理，不依賴新增欄位。沒有訊息的孤立照片依檔案 createTime 計算。

## 驗證

- npm test 全套既有測試通過。
- test:images：90 天前後邊界、待傳照片、文字保留、非圖片與商品排除、孤立照片、重試、競態衝突、分頁游標、兩端實際訊息 renderer。
- Firestore emulator：店家與客人過期拒讀、新照片可讀、文字/PDF 保留、陌生人拒讀；以實際 REST collection-group 查詢及 commit 確認檔案刪除與文字保留。
- 既有 Firestore rules 測試通過。

## Android

核對 SalonSpace-1.0.15-candidate.aab 的 classes.dex 及同版原始碼：versionCode 16，透過 Trusted Web Activity 載入正式 customer.html。本次只更新網站、Worker 和 Firestore rules，不需要新 AAB。未在實體手機重跑背景通知，未修改原生通知功能。

## 部署

1. GitHub main 網頁更新由 Pages 發布。
2. Cloudflare salon-space-notify：以 release-preparation/P152/worker-bundle.js 完整覆蓋 Worker 程式並部署，保留現有環境變數。確認現有 Cron `* * * * *` 已啟用。服務健康回應應為 version `21-chat-image-retention`、features.chatImageRetentionDays `90`。
3. Firebase salon-space-chat / Firestore 規則：發布 release-preparation/P152/firestore.rules。
4. 觀察 broadcasts/_chatImageRetention 的 lastRun 與 cursor 變化，確認排程實際執行；deleted 為該批次數量。

部署程式碼到 GitHub 不等於 Cloudflare 或 Firebase 規則已生效，須分別確認。
