import { createHmac } from 'node:crypto';
import { get,put } from '@vercel/blob';
import { blobAuth } from './_blob-auth.js';

function sessionPath(userId){
  const secret=String(process.env.ORDER_HMAC_SECRET||'');
  if(secret.length<32)throw new Error('max_session_not_configured');
  const key=createHmac('sha256',secret).update('max-checkout:'+userId).digest('hex');
  return '_max_checkout/'+key+'.json';
}
export async function loadMaxSession(userId){
  const r=await get(sessionPath(userId),{access:'private',useCache:false,...blobAuth()});
  if(!r||r.statusCode!==200)return null;
  return JSON.parse(await new Response(r.stream).text());
}
export async function saveMaxSession(userId,data){
  const previous=await loadMaxSession(userId);
  await put(sessionPath(userId),JSON.stringify({...data,lastOrderId:data.lastOrderId||previous?.lastOrderId,paidOrderIds:data.paidOrderIds||previous?.paidOrderIds||[]}),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',...blobAuth()});
}


