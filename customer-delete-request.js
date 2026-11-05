/* No network calls, analytics, localStorage, or automatic sending. */
document.getElementById('deleteRequest').addEventListener('submit', event => {
 event.preventDefault();
 const name=document.getElementById('requestName').value.trim();
 const phone=document.getElementById('requestPhone').value.trim();
 const note=document.getElementById('requestNote').value.trim();
 if(!name||!phone)return;
 const body=`我要申請永久刪除專屬空間帳號與相關資料。\n原登記稱呼：${name}\n原登記電話：${phone}\n補充說明：${note||'無'}\n請先核對身分、告知刪除範圍及必要保留項目，再回覆處理結果。`;
 document.getElementById('requestStatus').textContent='已要求開啟郵件 App；請確認內容並自行寄出，才算完成申請。若未開啟，請使用下方信箱。';
 window.location.href='mailto:doujun051873@gmail.com?subject='+encodeURIComponent('專屬空間帳號與資料刪除申請')+'&body='+encodeURIComponent(body);
});
