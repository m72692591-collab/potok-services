import { get,list,put } from '@vercel/blob';
import { blobAuth } from './_blob-auth.js';
export async function findMaxOrders(userId){
 if(!Number.isSafeInteger(userId)||userId<=0)return [];
 let cursor,rows=[];
 // Legacy orders have no per-user index. Only orders already bound to this
 // exact private MAX user can be recovered; contact or a name is not proof.
 for(let page=0;page<20;page++){
  const result=await list({prefix:'_orders/tbank/',limit:100,...(cursor?{cursor}:{}),...blobAuth()});
  for(let start=0;start<result.blobs.length;start+=10){
   const batch=await Promise.all(result.blobs.slice(start,start+10).map(async b=>{
    const r=await get(b.pathname,{access:'private',useCache:false,...blobAuth()});
    if(r?.statusCode!==200)return null;
    const order=JSON.parse(await new Response(r.stream).text());
    return Number(order.maxUserId)===userId&&order.orderId?order:null;
   }));rows.push(...batch.filter(Boolean));
  }
  if(!result.hasMore||!result.cursor)break;cursor=result.cursor;
 }
 const paid=o=>o.maxDeliveredAt||String(o.status).toUpperCase()==='CONFIRMED';
 return rows.sort((a,b)=>Number(Boolean(paid(b)))-Number(Boolean(paid(a)))||Number(b.confirmedAt||b.updatedAt||0)-Number(a.confirmedAt||a.updatedAt||0)).slice(0,20).map(o=>({orderId:o.orderId}));
}
const HEALTH='_max_assets/access-health-v1.json';
export async function recordMaxAccessHealth({result,stage,count}){
 await put(HEALTH,JSON.stringify({checkedAt:Date.now(),result,stage,...(count?{count}:{}),version:'access-v2-order-history'}),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',...blobAuth()});
}
export async function maxAccessHealth(){
 const r=await get(HEALTH,{access:'private',useCache:false,...blobAuth()});
 if(r?.statusCode!==200)return{version:'access-v2-order-history',result:'no_requests'};
 return JSON.parse(await new Response(r.stream).text());
}
