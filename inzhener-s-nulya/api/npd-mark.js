import crypto from'node:crypto';
import{json,readJson}from'./_shared.js';
import{getTbankPayment,saveTbankPayment}from'./_tbank-payments.js';

function authorized(token){
  const expected=String(process.env.CONTROL_PURCHASE_TOKEN||'');
  const supplied=String(token||'');
  if(!expected||!supplied)return false;
  const a=crypto.createHash('sha256').update(expected).digest();
  const b=crypto.createHash('sha256').update(supplied).digest();
  return crypto.timingSafeEqual(a,b);
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  const body=await readJson(req);
  if(!authorized(body.token))return json(res,403,{error:'forbidden'});
  const orderId=String(body.orderId||'');
  const receiptUrl=String(body.receiptUrl||'').trim();
  if(!orderId||!/^https:\/\//i.test(receiptUrl))return json(res,400,{error:'invalid_input'});
  try{
    const row=await getTbankPayment(orderId);
    if(!row)return json(res,404,{error:'order_not_found'});
    if(String(row.status||'').toUpperCase()!=='CONFIRMED')return json(res,409,{error:'order_not_confirmed'});
    const next=await saveTbankPayment(orderId,{
      npdReceiptStatus:'issued',
      npdReceiptUrl:receiptUrl,
      npdReceiptIssuedAt:Date.now()
    });
    return json(res,200,{ok:true,orderId:next.orderId,npdReceiptStatus:next.npdReceiptStatus});
  }catch(e){
    console.error('npd_mark_failed',String(e?.message||e));
    return json(res,500,{error:'npd_mark_failed'});
  }
}