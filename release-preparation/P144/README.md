# P144 客人原帳號恢復

永久清除舊帳號會刪除 Firebase Auth 身分。已刪除的身分無法只靠刷新或姓名、電話安全恢復。此版本由店家本人核對後，讓手機一次接回保留的主檔；不復活舊帳號、不新增顧客申請、不搬動或刪除既有資料。

## 部署

1. GitHub Pages 更新 admin.html、customer.html、salon-suite.js 與新增的 customer-recovery*.js/html。
2. Cloudflare salon-space-notify → 編輯程式碼，選最新版本，以本目錄 worker-bundle.js **完整取代** worker.js，部署。
3. 保留既有 Firebase secrets 與 CUSTOMER_CLEANUP_RULES_VERSION=P141；本次不修改 Firestore 規則。P141 的預設拒絕規則使 customerRecovery 僅後端可讀寫。
4. Worker 首頁須顯示 `19-customer-recovery` 以及 `customerRecovery:true`。

## 使用

1. 店家端刷新 → 顧客資料 → 選要保留的主檔 →「恢復客人手機」。核對本人與主檔後，勾選並產生恢復碼。
2. 只把碼交給該客人。客人從**原本的桌面圖示**開啟 →「已填過資料？恢復原本資料」→ 貼上碼並恢復。不要在另一個瀏覽器完成後假設桌面圖示也已登入。
3. 成功後回客人端，核對資料與訊息；關閉再開啟確認登入保留。
4. 碼有效15分鐘、一次使用。重新產生使上一碼失效。網路中斷可能已消耗碼，請重新產生。

若保留主檔仍被封鎖、停用、合併成其他帳號、正在清除或 Auth 身分已不存在，服務會拒絕；不要重複申請或刪除主檔。

## 安全與驗證

- 僅店家 UID 可簽發；256-bit隨機碼只儲存 SHA-256 摘要；不以電話/名稱/舊UID直接登入。
- 兌換前核對啟用中主檔、群組、退休記錄與實際 Firebase Auth 身分，原子版本條件驗證及消耗避免並行重複兌換。
- 客人頁用記憶體暫時身分請求；失敗保留原登入，成功以 Firebase custom token 登入保留主檔。店家登入受保護。
- `test:recovery`：權限、過期、替換、重放、競爭條件、已刪除/停用/合併目標、JWT簽章及Worker HTTP授權。
- `test:recovery-rules`：Firestore模擬器實際REST提交、所有前端角色不能讀寫恢復碼、並行只成功一次、原資料保留。
- 完整 npm test 與 cleanup 測試通過。尚需部署後以本人測試帳號在iPhone桌面圖示驗收；沒有操作正式客人資料。

這不是永久登入保證：清除瀏覽器儲存、移除App或再次刪除帳號仍可能需要恢復。請保留正在使用的主檔。
