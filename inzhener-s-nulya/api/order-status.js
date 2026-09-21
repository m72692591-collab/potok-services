import{CATALOG,fetchYandexOrder,json,safeOrderState,verifyOrderToken}from'./_shared.js';
import{getDownloadStatus}from'./_downloads.js';

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  try{
    const id=String(req.query.orderId||'');
    const pc=String(req.query.product||'');
    const t=String(req.query.token||'');
    const p=CATALOG[pc];
    if(!p||!verifyOrderToken(id,pc,t))return json(res,403,{state:'forbidden'});

    const state=safeOrderState(await fetchYandexOrder(id),p);
    if(state.state==='paid'){
      state.downloads=await getDownloadStatus(id);
    }
    return json(res,200,state);
  }catch(e){
    return json(res,502,{state:'provider_error'});
  }
}
