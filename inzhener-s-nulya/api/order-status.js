import{CATALOG,fetchYandexOrder,json,safeOrderState,verifyOrderToken}from'./_shared.js';
import{fetchTbankOrder,safeTbankOrderState,safeTbankState,tbankCall}from'./_tbank.js';
import{getTbankPayment}from'./_tbank-payments.js';
import{getDownloadStatus}from'./_downloads.js';

function provider(){return String(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase()}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  try{
    const id=String(req.query.orderId||'');
    const pc=String(req.query.product||'');
    const t=String(req.query.token||'');
    const p=CATALOG[pc];
    if(!p||!verifyOrderToken(id,pc,t))return json(res,403,{state:'forbidden'});

    let state;
    if(provider()==='tbank'){
      const ref=await getTbankPayment(id);
      if(ref?.paymentId){
        state=safeTbankState(await tbankCall('GetState',{TerminalKey:process.env.TBANK_TERMINAL_KEY,PaymentId:String(ref.paymentId)}),p,id);
      }else{
        state=safeTbankOrderState(await fetchTbankOrder(id),p);
      }
    }else{
      state=safeOrderState(await fetchYandexOrder(id),p);
    }

    if(state.state==='paid')state.downloads=await getDownloadStatus(id);
    return json(res,200,state);
  }catch(e){
    console.error('order_status_failed',String(e?.message||e));
    return json(res,502,{state:'provider_error'});
  }
}
