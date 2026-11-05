# 專屬空間：店主處理刪除申請

這是本機人工處理工具，不會自行連線執行，不需新付費服務。申請寄到 doujun051873@gmail.com。7天內回覆核對，核對完成30天內處理。

## 使用限制
- 僅限 salon-space-chat，拒絕店主 UID。只能處理確認為 customer 的單一帳號。
- 用既有電話或已確認身分的店內聯繫方式核對；不能只憑來信姓名、電話就刪除。
- 有預約紀錄、合併身分時工具會停止，另行核對範圍，不動預約表。
- 正式使用前需以自己建立的測試帳號演練。單元測試通過不代表雲端權限已驗證。
- 使用已授權的本機 Google ADC 登入，不把憑證、私鑰或客人報告上傳 GitHub。
- 本工具不清除供應商內部日誌、客人裝置快取或外部備份；若日後啟用備份，要另訂清除作業。

## 步驟
1. 在僅店主可存取的資料夾安裝 `npm install firebase-admin`，透過 Google Cloud CLI 設定該專案的 Application Default Credentials。帳號須有 Firestore 與 Firebase Authentication 管理權限。
2. `node operator.mjs inspect 客人UID`：唯讀盤點，核對姓名與原始聯絡資料後再繼續。
3. `node operator.mjs prepare 客人UID --identity-verified`：停用登入、撤銷刷新權杖並標記待刪除，尚未刪除資料。
4. 等至少65分鐘。安排維護時段，關閉店家端及其他會寫入的管理工具；暫停通知 Worker 的排程及 HTTP 寫入來源，待執行中作業結束。若不能確認全部停止，不能執行下一步。暫停會短暫影響訊息推播，應另安排時間。
5. `node operator.mjs erase 客人UID --identity-verified --writers-paused --confirm-target`：重新盤點，刪除 Auth、訊息與附件、裝置權杖、個人資料、回報及關聯通知工作。中途中斷可再次盤點後重跑；不要手動先刪 users 文件。
6. 到 Firebase 核對 Auth、users、chats（含 messages/files）、pushTokens（含 devices）與盤點清單；確認沒有其他來源重建資料，再恢復 Worker、店家端並複查。
7. 完成後回覆申請者。不保留包含客人內容的本機報告；只記必要的處理時間與完成狀態。

正式環境尚未執行刪除演練；本次不修改 Firestore 規則、Worker、店主頁面或預約資料。
