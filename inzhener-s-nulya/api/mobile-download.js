// Second downloadable archive is included at no extra cost with paid Windows courses.
// Validation is intentionally independent of the status page's client-side claims.
import {verifyOrderToken,CATALOG,json} from './_shared.js';
import {getTbankPayment} from './_tbank-payments.js';
import {safeTbankState,tbankCall} from './_tbank.js';
import {mobileSupported,mobileCourseZip} from './_mobile-course-zip.js';

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  const orderId=String(req.query?.orderId||'');
  const code=String(req.query?.product||'');
  const token=String(req.query?.token||'');
  if(!mobileSupported(code)||!orderId||!verifyOrderToken(orderId,code,token))return json(res,403,{error:'forbidden'});
  if(String(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase()!=='tbank')return json(res,503,{error:'provider_not_ready'});
  try{
    const order=await getTbankPayment(orderId);
    if(!order?.paymentId||order.product!==code)return json(res,409,{error:'order_not_confirmed'});
    const checked=safeTbankState(await tbankCall('GetState',{TerminalKey:process.env.TBANK_TERMINAL_KEY,PaymentId:String(order.paymentId)}),CATALOG[code],orderId,String(order.paymentId));
    if(checked.state!=='paid')return json(res,409,{error:'payment_not_confirmed'});
    const zip=mobileCourseZip(code);
    res.status(200).setHeader('content-type','application/zip');
    res.setHeader('content-disposition','attachment; filename="'+code+'-mobile-course.zip"');
    res.setHeader('cache-control','private, no-store');
    res.setHeader('x-content-type-options','nosniff');
    return res.end(zip);
  }catch(error){console.error('mobile_delivery_failed',String(error?.message||error));return json(res,503,{error:'temporarily_unavailable'});}
}
