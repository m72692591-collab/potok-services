import crypto from 'node:crypto';
import{get,put}from'@vercel/blob';
import{blobAuth}from'./_blob-auth.js';

function pathFor(orderId){
  const key=crypto.createHash('sha256').update(String(orderId)).digest('hex');
  return `_orders/tbank/${key}.json`;
}

export async function getTbankPayment(orderId){
  const result=await get(pathFor(orderId),{access:'private',useCache:false,...blobAuth()});
  if(!result||result.statusCode!==200)return null;
  try{return JSON.parse(await new Response(result.stream).text())}catch{return null}
}

export async function saveTbankPayment(orderId,data){
  const current=await getTbankPayment(orderId)||{};
  const next={...current,...data,orderId:String(orderId),updatedAt:Date.now()};
  await put(pathFor(orderId),JSON.stringify(next),{
    access:'private',
    addRandomSuffix:false,
    allowOverwrite:true,
    contentType:'application/json',
    ...blobAuth()
  });
  return next;
}
