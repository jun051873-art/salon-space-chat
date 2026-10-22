// The same content and detail actions as the normal homepage, in reading order.
export function homeMosaicHTML({sections={},feature,products=[],events=[],notices=[],notice},esc){
 const tiles=[];
 const tile=(kind,title,text,image,action)=>`<button class="homeMosaicTile ${image?.startsWith('data:image/')?'hasImage':''}" ${action}>${image?.startsWith('data:image/')?`<img src="${esc(image)}" alt="" loading="lazy">`:''}<span class="mosaicCopy"><small>${esc(kind)}</small><strong>${esc(title)}</strong><span class="mosaicExcerpt">${esc(text||'')}</span><span class="mosaicOpen">點擊查看 <b aria-hidden="true">↗</b></span></span></button>`;
 if(sections.feature!==false&&feature)tiles.push(tile('本月主打',feature.title,feature.text,feature.image,'data-home-feature'));
 if(sections.notice===true&&notice)tiles.push(tile('空間消息','店家公告',notice,'','data-home-notice'));
 if(sections.products===true)for(const p of products)tiles.push(tile(p.category||'精選商品',p.title,p.description,p.image||p.images?.[0],`data-home-product="${esc(p.id)}"`));
 if(sections.events===true)for(const x of events)tiles.push(tile('本月活動',x.title,x.text,x.image,`data-home-board="${esc(x.id)}"`));
 if(sections.board!==false)for(const x of notices)tiles.push(tile('布告欄',x.title,x.text,x.image,`data-home-board="${esc(x.id)}"`));
 return tiles.join('');
}
