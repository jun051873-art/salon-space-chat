// Cover is also stored in the legacy image field: count it twice.
export async function fitProductPhotos(photos,encode,{budget=880000}={}){
 const total=items=>items.reduce((sum,src)=>sum+src.length,0)+(items[0]?.length||0);
 if(total(photos)<=budget)return photos.slice();
 const allowance=Math.floor(budget/(photos.length+1));
 const result=[];
 for(const src of photos)result.push(src.length<=allowance?src:await encode(src,allowance));
 if(total(result)>budget)throw Error('照片容量較大，請減少照片張數後再儲存。');
 return result;
}
