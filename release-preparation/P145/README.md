# P145 / Worker 20：合併清除後保留手機存取

## 行為

- 新建立的合併清除工作使用 schema 2。完整搬移並核對資料後，仍清除舊 users/chats/files/pushTokens/notes；不再停用或刪除原 Firebase Auth 身分。
- 完成工作時原子寫入最小退休對應 `retiredCustomers/{oldUid}` 的 `primaryUid` 和 `automatic:true`。舊帳號不能直接讀寫舊資料；既有 P141 規則仍拒絕。
- 客人用原本已登入的身分，在原頁面資料缺失或清除發生時，後端驗證 Firebase ID token 後沿店家合併對應找到最後保留主檔，回傳短效 custom token，手機接回主檔並重新載入。
- 支援連續合併（最多32層），拒絕循環、店家身分、封鎖/停用主檔、不一致群組、失效 Auth，以及處理中的資料。清除進行中會等待，超時可重新整理。
- 沒有自動對應的新客仍進正常申請；後端尚未更新時保留原有流程。
- 店家端永久清除入口必須確認後端支援 automaticMergedRecovery 才開放，避免以舊版後端繼續刪掉登入。

## 不可回溯的限制

前一版已刪除的 Firebase Auth 身分無法憑姓名、電話或舊UID自動認領。這些手機需要 P144 已提供的一次性店家恢復碼，遠端交給本人即可，不需現場重填。既有 schema 1 未完成的工作保持其原語意，完成後受影響手機亦需恢復碼。

真正刪除保留主檔、封鎖/停用客人仍阻止存取；本變更只針對店家核對過的合併清除，不恢復真正要求刪除的帳戶。

## 部署

以本目錄 `worker-bundle.js` 完整取代 Cloudflare salon-space-notify 的最新 worker.js，再部署。保留原 Firebase secrets、CUSTOMER_CLEANUP_RULES_VERSION=P141、現有 P141 規則，不需更新Android安裝包。
Worker首頁應為 `20-preserve-customer-access` 且 `automaticMergedRecovery:true`。
網頁由GitHub Pages更新。保留P144恢復碼入口，處理已失效的手機。

## 驗證

執行完整 npm test、test:recovery、customer-cleanup 單元測試；Firestore模擬器驗證實際清除、對應切換、原資料保存、舊身分直接存取拒絕及恢復碼原子兌換。沒有刪除或修改正式客人資料。
部署後需以本人測試帳號驗收兩支手機合併清除、刷新與再次合併；正式iPhone操作尚未驗收。
