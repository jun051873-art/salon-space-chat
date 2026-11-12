# P158 — 客人訊息 30 分鐘修改期限

- 客人自己的訊息從原始 createdAt 起算，未滿 30 分鐘可編輯或收回；滿 30 分鐘不可再操作。
- 編輯不重設期限；不改文字保留期限；店家不受 30 分鐘限制。
- 長按選單、下方按鈕、編輯儲存及照片收回皆套用期限。停留聊天室時按鈕自動到期。
- firestore.rules 以 request.time 強制期限，防止舊客戶端、修改裝置時鐘、重設 createdAt 或直接刪除繞過。

## 發布注意
網頁由 GitHub Pages 發布。Firebase 正式規則必須另外部署；此工作階段沒有 Firebase 授權帳號，不能宣稱後端規則已上線。
部署前核對正式規則與本檔差異，避免覆蓋後台另外修改的規則。

新增的限制只位於 /chats/{uid}/messages/{messageId} 的 allow update 客人分支，保留 admin() 分支：

```text
&& resource.data.createdAt is timestamp
&& request.time >= resource.data.createdAt
&& request.time < resource.data.createdAt + duration.value(30,'m')
&& resource.data.get('retracted',false) != true
```

驗證：npm test、npm run test:messages、npm run test:message-deadline，以及 Firebase Emulator 的 message-deadline-rules.test.mjs / firestore-rules.test.mjs。
