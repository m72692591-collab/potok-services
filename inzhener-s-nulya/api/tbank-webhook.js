import{CATALOG,readJson}from'./_shared.js';
import{safeTbankState,tbankCall,verifyTbankNotification}from'./_tbank.js';
import{getTbankPayment,saveTbankPayment}from'./_tbank-payments.js';
import{ensureNpdReceiptForOrder,cancelNpdReceiptForOrder}from'./_npd.js';

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
    if(body?.OrderId&&body?.PaymentId){
      const orderId=String(body.OrderId);
      const paymentId=String(body.PaymentId);
      const ref=await getTbankPayment(orderId);
      const product=CATALOG[String(ref?.product||'')];
      if(!ref||!product||String(ref.paymentId||'')!==paymentId){
        console.error('tbank_webhook_unbound_payment',orderId);
        res.status(500).setHeader('content-type','text/plain; charset=utf-8').end('RETRY');
        return;
      }
      const authoritative=await tbankCall('GetState',{TerminalKey:process.env.TBANK_TERMINAL_KEY,PaymentId:paymentId});
      const checked=safeTbankState(authoritative,product,orderId,paymentId);
      if(['not_found','mismatch'].includes(checked.state)){
        console.error('tbank_webhook_state_mismatch',orderId,checked.state);
        res.status(500).setHeader('content-type','text/plain; charset=utf-8').end('RETRY');
        return;
      }
      const status=String(checked.paymentStatus||'').toUpperCase();
      try{
        const patch={paymentId,status};
        if(status==='CONFIRMED'){
          patch.confirmedAt=Date.now();
          patch.npdReceiptStatus='pending';
        }else if(['REFUNDED','REVERSED'].includes(status)){
          patch.npdReceiptStatus='cancel_pending';
        }else if(['PARTIAL_REFUNDED','PARTIAL_REVERSED'].includes(status)){
          patch.npdReceiptStatus='review_partial_refund';
        }
        await saveTbankPayment(orderId,patch);
      }catch(se){
        console.error('tbank_webhook_map_save_failed',String(se?.message||se));
        res.status(500).setHeader('content-type','text/plain; charset=utf-8').end('RETRY');
        return;
      }
      if(status==='CONFIRMED'){
        try{
          await ensureNpdReceiptForOrder(orderId);
        }catch(ne){
          console.error('npd_auto_receipt_failed',String(ne?.message||ne),ne?.status||'',ne?.details||'');
          res.status(503).setHeader('content-type','text/plain; charset=utf-8').end('RETRY');
          return;
        }
      }else if(['REFUNDED','REVERSED'].includes(status)){
        try{
          await cancelNpdReceiptForOrder(orderId,'Возврат средств');
        }catch(ne){
          console.error('npd_auto_receipt_cancel_failed',String(ne?.message||ne),ne?.status||'',ne?.details||'');
          res.status(503).setHeader('content-type','text/plain; charset=utf-8').end('RETRY');
          return;
        }
      }
    }
    res.status(200).setHeader('content-type','text/plain; charset=utf-8').end('OK');
  }catch(e){
    console.error('tbank_webhook_failed',String(e?.message||e));
    res.status(500).setHeader('content-type','text/plain; charset=utf-8').end('ERROR');
  }
}
