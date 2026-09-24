import{CATALOG,json,readJson,verifyOrderToken}from'./_shared.js';
import{fetchTbankOrder,safeTbankOrderState,tbankCall}from'./_tbank.js';
import{getTbankPayment,saveTbankPayment}from'./_tbank-payments.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(String(process.env.TBANK_ENV||'').toLowerCase()==='production'){
    return json(res,403,{error:'test_only'});
  }
  try{
    const body=await readJson(req);
    const orderId=String(body.orderId||'');
    const productCode=String(body.product||'');
    const token=String(body.token||'');
    const product=CATALOG[productCode];
    if(!product||!verifyOrderToken(orderId,productCode,token)){
      return json(res,403,{error:'forbidden'});
    }

    let ref=await getTbankPayment(orderId);
    if(!ref?.paymentId){
      const checked=safeTbankOrderState(await fetchTbankOrder(orderId),product);
      if(checked.state!=='paid'||!checked.paymentId){
        return json(res,409,{error:'payment_not_refundable',state:checked.state});
      }
      ref=await saveTbankPayment(orderId,{
        paymentId:String(checked.paymentId),
        product:productCode,
        status:String(checked.paymentStatus||'CONFIRMED')
      });
    }

    const result=await tbankCall('Cancel',{
      TerminalKey:process.env.TBANK_TERMINAL_KEY,
      PaymentId:String(ref.paymentId)
    });

    if(!result?.Success||String(result?.ErrorCode||'')!=='0'){
      return json(res,400,{
        error:'refund_failed',
        providerCode:String(result?.ErrorCode||''),
        detail:[result?.Message,result?.Details].filter(Boolean).join(' — ').slice(0,300)
      });
    }

    await saveTbankPayment(orderId,{
      paymentId:String(ref.paymentId),
      product:productCode,
      status:String(result?.Status||'REFUNDED')
    }).catch(()=>{});

    return json(res,200,{
      ok:true,
      status:String(result?.Status||'REFUNDED'),
      paymentId:String(ref.paymentId)
    });
  }catch(e){
    console.error('tbank_test_refund_failed',String(e?.message||e));
    return json(res,500,{error:'refund_failed',detail:String(e?.message||'unknown').slice(0,160)});
  }
}
