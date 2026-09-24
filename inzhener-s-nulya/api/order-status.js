import{CATALOG,fetchYandexOrder,json,safeOrderState,verifyOrderToken}from'./_shared.js';
import{fetchTbankOrder,safeTbankOrderState,safeTbankState,tbankCall}from'./_tbank.js';
import{getTbankPayment,saveTbankPayment}from'./_tbank-payments.js';
import{getDownloadStatus}from'./_downloads.js';
import{ensureNpdReceiptForOrder}from'./_npd.js';

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
        if(state.state==='paid'&&state.paymentId){
          try{await saveTbankPayment(id,{paymentId:String(state.paymentId),product:pc,status:'CONFIRMED'})}
          catch(se){console.error('tbank_status_recover_save_failed',String(se?.message||se))}
        }
      }
    }else{
      state=safeOrderState(await fetchYandexOrder(id),p);
    }

    if(state.state==='paid'){
      state.downloads=await getDownloadStatus(id);
      if(!p.controlOnly&&provider()==='tbank'){
        try{
          const receipt=await ensureNpdReceiptForOrder(id);
          state.receipt={status:receipt.status,url:receipt.url||''};
        }catch(ne){
          console.error('npd_order_status_receipt_failed',String(ne?.message||ne));
          const ref=await getTbankPayment(id).catch(()=>null);
          state.receipt={status:String(ref?.npdReceiptStatus||'pending'),url:String(ref?.npdReceiptUrl||'')};
        }
      }
    }
    return json(res,200,state);
  }catch(e){
    console.error('order_status_failed',String(e?.message||e));
    return json(res,502,{state:'provider_error'});
  }
}
