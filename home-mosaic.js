export const homeLayouts={normal:'原本展示・橫向滑動',mosaic:'錯落拼塊',rows:'直式長卡',tiles:'雙欄小卡',spotlight:'主打一張＋小卡'};
export const normalizeHomeLayout=value=>Object.hasOwn(homeLayouts,value)?value:'normal';
export const isTopicLayout=value=>normalizeHomeLayout(value)!=='normal';
// One quiet entrance per subject. Rich content belongs inside the destination.
export function homeMosaicHTML({sections={},feature,products=[],events=[],notices=[],notice},esc){
 const tiles=[];
 const tile=(key,title,subtitle,action)=>`<button type="button" class="homeMosaicTile topicTile topic-${key}" data-topic="${key}" ${action}><span class="topicOrbit" aria-hidden="true"></span><span class="mosaicCopy"><small>${esc(subtitle)}</small><strong>${esc(title)}</strong><span class="mosaicOpen">探索內容 <b aria-hidden="true">↗</b></span></span></button>`;
 if(sections.feature!==false&&feature)tiles.push(tile('feature','主打','為自己留一點時間','data-home-feature'));
 if(sections.notice===true&&notice)tiles.push(tile('notice','公告','近期的小提醒','data-home-notice'));
 if(sections.products===true&&products.length)tiles.push(tile('products','商品','日常保養提案','data-home-products'));
 if(sections.events===true&&events.length)tiles.push(tile('events','活動','值得期待的相聚','data-home-collection="events"'));
 if(sections.board!==false&&notices.length)tiles.push(tile('board','布告欄','關於這裡的消息','data-home-collection="board"'));
 if(sections.holidays===true)tiles.push(tile('holidays','休假','為相聚留好時間','data-home-holidays'));
 return tiles.join('');
}

// N89 uses a separate config namespace so N88 layout choices remain restorable.
export function fourCardHTML(enabled={},esc=x=>x){
 return [['holidays','休假','看店休，也能預約','data-home-holidays'],['products','商品','日常保養小選物','data-home-products'],['feature','主打','為自己留點時間','data-home-feature'],['board','公告','店裡的新消息','data-home-collection="board"']].filter(([key])=>enabled?.[key]!==false).map(([key,title,subtitle,action])=>`<button type="button" class="homeMosaicTile topicTile topic-${key}" data-topic="${key}" ${action}><span class="mosaicCopy"><small>${esc(subtitle)}</small><strong>${esc(title)}</strong><span class="mosaicOpen">${key==='holidays'?'查看日期':'點開看看'} <b aria-hidden="true">↗</b></span></span></button>`).join('');
}
