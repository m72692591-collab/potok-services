import{readJson}from'./_shared.js';
import{verifyTbankNotification}from'./_tbank.js';
import{saveTbankPayment}from'./_tbank-payments.js';

export default async function handler(req,res){
  if(req.method!=='POST'){
    res.status(405).setHeader('content-type','text/plain; charset=utf-8').end('Method Not Allowed');
    return;
  }
  try{
    const body=await readJson(req);
    if(!verifyTbankNotification(body)){
      res.status(403).setHeader('content-type','text/plain; charset=utf-8').end('INVALID');
      return;
    }
    if(body?.OrderId&&body?.PaymentId){try{await saveTbankPayment(String(body.OrderId),{paymentId:String(body.PaymentId),status:String(body.Status||'')})}catch(se){console.error('tbank_webhook_map_save_failed',String(se?.message||se))}}
    res.status(200).setHeader('content-type','text/plain; charset=utf-8').end('OK');
  }catch(e){
    console.error('tbank_webhook_failed',String(e?.message||e));
    res.status(500).setHeader('content-type','text/plain; charset=utf-8').end('ERROR');
  }
}
