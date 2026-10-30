# 顧客連結第一階段
預約表 → 專屬邀請 → 客人確認 → 店家核准 → 雙端已連結。
不以姓名、電話自動合併。既有顧客 ID 不變。訊息、消費備註不會傳給客人。

## 部署
1. 發布本次靜態檔案及預約表 320.22。
2. 在 Firebase 專案 salon-space-chat 部署本版 firestore.rules：
   firebase deploy --only firestore:rules --project salon-space-chat
3. 登入 admin.html 後開啟 booking-link.html。預約表沿用另一個 Firebase 專案，不必改其權限。
4. 用測試顧客產生邀請，在不同瀏覽器／客人手機登入客人帳號並申請，再由店家核准。
5. 核准前橘燈；兩筆伺服器配對紀錄確認一致才綠燈；離線或讀取失敗灰燈。

部署規則前會顯示無法確認，不會假裝已連結。不得把 Firestore 改成公開讀寫。
本版沒有解除配對、重新綁定、跨系統新增顧客、消費資料同步或發送關懷訊息。
公共加入仍走原本流程，不會自動建立預約表顧客。

## 驗證
Firestore emulator：未授權讀取、冒名 claim、自行核准、部分配對、重複帳號、
過期邀請均拒絕；原子核准成功。
Chromium 模擬 375／430／1024 px：管理頁與預約表 QR；375／1024 px 客人頁。
尚須正式 Firebase 規則部署及真實 iPhone／iPad 端到端驗收。

## 資料
bookingLinkClients / bookingLinkAccounts 是同一 Firestore 交易的雙向索引。
bookingLinkInvites 是 24 小時、隨機 256-bit 邀請。網址僅帶 token。
權限拒絕客人列舉邀請或讀取私人索引；客人只能認領，不能核准。
已核准索引不可由客戶端更新或刪除。
