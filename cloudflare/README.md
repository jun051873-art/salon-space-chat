# 目前部署版本：13-appointment-and-visit-care（N72）

只部署本資料夾的 **worker-suite.js**，整份取代 Cloudflare 現有
`salon-space-notify` 的程式碼。不要使用舊 worker.js；不要新增另一個 Worker。
保留既有 secrets、bindings 與網址。這次不需要更改 Firebase 規則。
網站前端 N72 必須同步發布（已在同一個 GitHub 更新）。

## 一次完成部署

1. Cloudflare → Workers & Pages → salon-space-notify → Edit code。
2. 全選原程式碼，貼上 worker-suite.js 的完整內容 → Deploy。
3. Settings → Triggers → Cron Triggers：將原本的排程**改成** `* * * * *`。
   只留一個每分鐘排程，不要同時保留原本 `0 2-12 * * *` 或每日排程。
4. 服務網址顯示 `13-appointment-and-visit-care`，並有
   `features.appointmentReminders: true`、`features.personalVisitCare: true`。
5. 排程變更可能需要最多 15 分鐘傳播。等第一次排程成功後，刷新店家頁面。
6. 主頁 → 自動提醒 → 預約前提醒：勾「啟用」、選提前分鐘數、儲存範本。
7. 訊息 → 客人 ⋯ → 預約提醒：登記日期時間 → 儲存並啟用提醒。
   舊草稿不會自動發送，必須重新儲存。每位客人目前支援一筆待提醒預約。
8. 到店後關心仍在「訊息 → 客人 ⋯ → 到店與關心」，手動記錄實際到店，
   選擇 7 天、30 天或兩者。預約時間不會當作到店日期。

## 排程與取消

- 預約提醒每分鐘讀取已到期的佇列，每輪最多處理 2 筆提醒與 2 筆推播，
  不每分鐘掃描所有客人。一般等待下一分鐘；大量同時到期會排隊。
- 到店／生日／未來訊關心維持台灣每天 10:00–20:00 整點檢查。
- 使用台灣時區計算。提醒時間已過不能新建；排程延遲超過 5 分鐘、
  或預約時間已到則不補發過時提醒，狀態顯示已錯過。
- 改期與取消使用版本檢查；發送前再次讀取客人、設定和預約，並原子寫入
  訊息與已發送狀態。同一 revision 不重複建立訊息。
- 關閉總開關時到期的預約會標為暫停，不會在重新開啟時自行補發。
- 已送進聊天室的訊息不因取消而撤回。背景推播最多嘗試 3 次，
  使用相同 notification tag；FCM 成功代表接受推播，不保證手機顯示。
  網路回應遺失時，推播仍可能重送，但聊天室訊息不會重複建立。
- 新預約排程存在 broadcasts/appointment_{uid}（僅店家可寫）。
  使用同欄位範圍查詢，無需新增複合索引；保留預設單欄位索引。
- readiness：後端功能旗標＋最近 10 分鐘成功的 appointment heartbeat，
  且 cron 必須為 `* * * * *`。未就緒時只能儲存草稿。

## 驗證

npm test 包含到店關心與新預約提醒的模擬測試：取消競爭、重複排程、
改期、過期、封鎖／合併／退出關懷、寫入失敗、推播重試與收件人隔離。
瀏覽器測試涵蓋 320/390/768 寬度、啟用門檻、草稿與排程、修改和取消。
這些不能取代正式 Cloudflare 排程與手機端通知測試。

部署後以自己的測試客人，設定提前 1 分鐘、預約至少 3 分鐘之後，
確認只收到一則；另建一筆後取消並確認不發送。測試完將提前時間改回
30 或 60 分鐘。不要拿真實客人做測試。

---
以下保留舊版紀錄，部署請以本頁最上方 N72 步驟為準。

# salon-space-notify v4

Replace the source of the existing `salon-space-notify` Cloudflare Worker with `worker.js`, then deploy. Keep its existing workers.dev address and its three existing secrets unchanged:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

The matching admin.html/customer.html client change must be live before deploying this Worker. It includes the Firebase ID token, conversation ID, and persisted message ID in notification requests. The previous Worker ignores these extra fields, allowing the client update to be deployed first. Older open pages should be reloaded before sending notifications.

GET / returns version `4-reliable`. This verifies deployment only, not end-to-end FCM delivery.

The Worker authenticates the caller, reads the actual saved message, resolves new and legacy device token records with pagination, caches the Google OAuth token, and reports FCM acceptance/error counts. It performs no Firestore writes. A successful FCM response means accepted by FCM, not that a device displayed the notification. Stable message tags reduce duplicate visible notifications; exactly-once push delivery across retries is not guaranteed without durable server deduplication.

Known deployment blocker on 2026-10-06: Firestore Spark write quota exhausted. The frontend keeps new pending messages on the device and backs off quota retries. Backend writes and end-to-end messaging cannot be verified until quota is available. No billing changes have been made.


## Time-based replies (7-time-replies)

Deploy `worker-suite.js` to the existing salon-space-notify Worker, preserving all existing secrets, bindings and Cron triggers. GitHub Pages deployment does not deploy this Worker. GET / must report `features.timeReplies: true` before the admin can enable the three rules.

Settings are in announcements/settings.timeReplies with business/outside/holiday each containing enabled and text. All default disabled. Configure weeklyHours for business/outside rules; holidays/YYYY-MM-DD overrides a working day. Fixed weekly days off also use holiday. Source creation time in Asia/Taipei selects the category; a matching enabled keyword reply takes priority over time replies. The existing deterministic auto_<sourceId> message ID and create-only transaction prevent duplicate replies on retries. The authenticated message-notification request triggers this logic, including attachment messages; a delayed or failed client request can delay automation. No Firestore trigger or always-on phone is assumed.

Rollback: redeploy the prior worker-suite.js from commit 77c7454512ab14ce6a57d9d87119311a799edf87. This leaves all conversations and configuration intact. No new secrets, billing changes or scheduled tasks are required.


## N56.1 manual deployment — version 11-care-calendar

Use the complete `worker-suite.js` (not the legacy `worker.js`) in the existing
`salon-space-notify` Worker. Preserve secrets, URL, bindings and existing data.
GET / should report `11-care-calendar`. No Firebase rule changes are required.

In Cloudflare Settings > Triggers > Cron Triggers, inspect the existing schedule.
For hourly daytime checks in Taiwan use `0 2-12 * * *` (UTC; Taiwan 10:00–20:00).
Use one matching schedule rather than adding duplicates. Scheduling checks does not
enable draft rules. After the first successful scheduled run, open the admin
自動提醒 page and enable only the intended rules. A new Cron can take 15 minutes
to propagate; execution waits until its next scheduled time.

Priority: configured keyword answer, otherwise enabled holiday/outside/business
reply. One automatic chat message per source message. Birthday: once per rule per
year on the exact birthday; visit/inactive: once per rule per last visit/message.
Days use Taiwan calendar dates. Missing dates, invalid days, disabled rules,
blocked/pending customers, merged-away records and marketing opt-outs are skipped.
A customer failure does not stop subsequent customers. Runtime records sent,
failed and deferred counts; at most 300 new messages per run. Later runs can catch
remaining eligible recipients, subject to Worker/Firestore quotas.

Notifications: incoming customer messages alert the shop; automatic answers/care
alert customer devices, excluding tokens also registered to the owner. Chat
messages persist even if notifications are disabled. Push delivery is best effort:
a failed token/FCM call after message creation is not automatically retried.
Welcome copy is an in-app onboarding display, not a scheduled push. Group sends
are manually initiated in the admin app. Neither is enabled by the Cron.

Verification: check version, send a NEW configured question, check both chat views
and device notifications, and inspect the admin schedule status after a scheduled
run. Mock tests do not prove production credentials, quotas, Cron or phone delivery.


## N69: per-customer visit care — version 12-personal-visit-care

Deploy the complete `cloudflare/worker-suite.js` to the existing
`salon-space-notify` Worker (not `worker.js`). Preserve all secrets, bindings,
URL and existing Cron triggers. No Firebase rules change is needed.
GitHub Pages publication alone does not deploy this backend.

The frontend enables personal care only when GET / advertises
`features.personalVisitCare: true` and broadcasts/_runtime has a successful
heartbeat within 36 hours. Until then, date registration works, and existing
legacy generic visit rules continue to apply. Do not claim personal reminders
are enabled before this check passes.

Admin: 訊息 → customer ⋯ → 到店與關心. Today records Taiwan noon, preserving
an existing timestamp on the same date. Personal choices write two stable,
recipient-specific automation records (kind personalVisit, days 7 and 30),
and users/{uid}.visitCareManaged=true, atomically. Disabled personal rules remain
stored, and the managed marker suppresses generic visit rules even for no-reminder.
Birthday/inactivity rules are unaffected. New kinds are ignored by old workers.
Rules apply to each newly recorded visit until changed; editing content or toggling
a rule does not change its deduplication ID. Selecting an already overdue interval
makes it eligible on the next scheduled check. Blocked/pending/deleted/merged and
marketing-opt-out customers are excluded. No customer records or enabled rules
were created by the implementation/testing workflow.

Validation: npm test; browser harness tests the real visit-care module at
320/390/768 pixels with mocked writes. Physical phone delivery and live Cron
execution require verification after deployment.
