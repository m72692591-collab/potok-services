import{readJson}from'./_shared.js';
import{verifyTbankToken,tbankTerminalKey}from'./_tbank.js';
import{saveTbankPayment}from'./_tbank-payments.js';

function text(res,status,body){
  res.status(status).setHeader('content-type','text/plain; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(body);
}

export default async function handler(req,res){
  if(req.method!=='POST')return text(res,405,'METHOD NOT ALLOWED');
  try{
    const body=await readJson(req);
    if(String(body.TerminalKey||'')!==String(tbankTerminalKey()))return text(res,403,'FORBIDDEN');
    if(!verifyTbankToken(body))return text(res,403,'FORBIDDEN');

    const orderId=String(body.OrderId||'');
    if(orderId){
      await saveTbankPayment(orderId,{
        paymentId:String(body.PaymentId||''),
        amount:Number(body.Amount)||undefined,
        status:String(body.Status||''),
        lastNotificationAt:Date.now(),
        success:Boolean(body.Success),
        errorCode:String(body.ErrorCode||'')
      });
    }
    return text(res,200,'OK');
  }catch(e){
    console.error('tbank_webhook_failed',String(e?.message||e));
    return text(res,500,'ERROR');
  }
}
