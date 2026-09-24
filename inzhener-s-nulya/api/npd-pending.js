import crypto from'node:crypto';
import{list,get}from'@vercel/blob';
import{blobAuth}from'./_blob-auth.js';
import{CATALOG,json}from'./_shared.js';

function authorized(token){
  const expected=String(process.env.CONTROL_PURCHASE_TOKEN||'');
  const supplied=String(token||'');
  if(!expected||!supplied)return false;
  const a=crypto.createHash('sha256').update(expected).digest();
  const b=crypto.createHash('sha256').update(supplied).digest();
  return crypto.timingSafeEqual(a,b);
}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  if(!authorized(req.query.token))return json(res,403,{error:'forbidden'});
  try{
    const result=await list({prefix:'_orders/tbank/',limit:100,...blobAuth()});
    const blobs=(result.blobs||[]).slice(-60);
    const rows=[];
    for(const b of blobs){
      try{
        const obj=await get(b.pathname,{access:'private',useCache:false,...blobAuth()});
        if(!obj||obj.statusCode!==200)continue;
        const r=JSON.parse(await new Response(obj.stream).text());
        const p=CATALOG[String(r.product||'')];
        if(!p||p.controlOnly)continue;
        const status=String(r.status||'').toUpperCase();
        if(status!=='CONFIRMED')continue;
        rows.push({
          orderId:String(r.orderId||''),
          product:p.code,
          title:p.title,
          amount:p.price,
          buyerContact:String(r.buyerContact||''),
          buyerType:String(r.buyerType||'individual'),
          confirmedAt:Number(r.confirmedAt||r.updatedAt||r.createdAt||0),
          receiptStatus:String(r.npdReceiptStatus||'pending'),
          receiptUrl:String(r.npdReceiptUrl||''),
          receiptIssuedAt:Number(r.npdReceiptIssuedAt||0)
        });
      }catch{}
    }
    rows.sort((a,b)=>b.confirmedAt-a.confirmedAt);
    return json(res,200,{taxMode:'NPD',orders:rows});
  }catch(e){
    console.error('npd_pending_failed',String(e?.message||e));
    return json(res,500,{error:'npd_pending_failed'});
  }
}