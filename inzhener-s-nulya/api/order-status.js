import{CATALOG,fetchYandexOrder,json,safeOrderState,verifyOrderToken}from'./_shared.js';
import{getDownloadStatus}from'./_downloads.js';
import{getTbankPayment}from'./_tbank-payments.js';
import{safeTbankState,tbankCall}from'./_tbank.js';

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  try{
    const id=String(req.query.orderId||'');
    const pc=String(req.query.product||'');
    const t=String(req.query.token||'');
    const p=CATALOG[pc];
    if(!p||!verifyOrderToken(id,pc,t))return json(res,403,{state:'forbidden'});

    const provider=(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase();
    let state;

    if(provider==='tbank'){
      const ref=await getTbankPayment(id);
      if(!ref?.paymentId)return json(res,200,{state:'pending',paymentStatus:'NEW'});
      const o=await tbankCall('GetState',{PaymentId:String(ref.paymentId)});
      state=safeTbankState(o,p,id);
    }else{
      state=safeOrderState(await fetchYandexOrder(id),p);
    }

    if(state.state==='paid')state.downloads=await getDownloadStatus(id);
    return json(res,200,state);
  }catch(e){
    console.error('order_status_failed',String(e?.message||e),e?.details||'');
    return json(res,502,{state:'provider_error'});
  }
}
