// One bounded page per explicit action; concurrent views share the same request.
export function createCustomerPages(readPage, ttl=300000) {
 let rows=[],cursor=null,more=true,loadedAt=0,pending=null;
 return {
  get more(){return more;},
  async load({refresh=false,next=false}={}){
   if(pending)return pending;
   const reset=refresh||!loadedAt||(!next&&Date.now()-loadedAt>=ttl);
   if(!reset&&(!next||!more))return rows;
   pending=(async()=>{
    const result=await readPage(reset?null:cursor,30);
    rows=reset?result.rows:[...new Map([...rows,...result.rows].map(x=>[x.id,x])).values()];
    cursor=result.cursor;more=result.more;loadedAt=Date.now();return rows;
   })();
   try{return await pending;}finally{pending=null;}
  }
 };
}
