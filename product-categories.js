// One canonical name map updates every product, including older cached records.
export function categoryName(value,config={}){
 let name=String(value||'').trim()||'其他商品';const seen=new Set(),aliases=config.productCategoryAliases||{};
 while(Object.hasOwn(aliases,name)&&!seen.has(name)){seen.add(name);name=String(aliases[name]);}
 return name;
}
export function renameCategory(config,from,to){
 from=categoryName(from,config);to=String(to||'').trim();
 if(!to||to.length>30||to==='全部')throw Error('分類名稱請填 1–30 個字，不能使用「全部」');
 if(from===to)return null;
 const aliases={...(config.productCategoryAliases||{})};
 for(const key of Object.keys(aliases))if(categoryName(key,config)===from)aliases[key]=to;
 delete aliases[to];Object.defineProperty(aliases,from,{value:to,enumerable:true,writable:true,configurable:true});
 return {productCategoryAliases:aliases,productCategoryOrder:[...new Set((config.productCategoryOrder||[]).map(x=>categoryName(x,config)===from?to:categoryName(x,config)))]};
}
