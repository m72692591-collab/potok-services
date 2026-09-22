import{Readable}from'node:stream';
import{get,list}from'@vercel/blob';
import{CATALOG,fetchYandexOrder,json,safeOrderState,verifyOrderToken}from'./_shared.js';
import{getTbankPayment}from'./_tbank-payments.js';
import{safeTbankState,tbankCall}from'./_tbank.js';
import{blobAuth,reserveDownload}from'./_downloads.js';

function norm(s){
  return String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-zа-яё0-9]/giu,'');
}

async function resolveBlobPath(productCode,expected){
  const{blobs}=await list({limit:100,...blobAuth()});
  const exact=blobs.find(b=>b.pathname===expected);
  if(exact)return exact.pathname;

  const expectedNorm=norm(expected);
  const normalized=blobs.find(b=>norm(b.pathname)===expectedNorm);
  if(normalized)return normalized.pathname;

  const candidates=blobs.filter(b=>{
    const n=norm(b.pathname);
    const isBundle=n.includes('комплект')||(n.includes('autocad')&&n.includes('primavera'));
    if(productCode==='bundle')return isBundle;
    if(productCode==='autocad')return n.includes('autocad')&&!isBundle;
    if(productCode==='primavera')return n.includes('primavera')&&!isBundle;
    return false;
  });
  if(candidates.length===1)return candidates[0].pathname;
  throw new Error(candidates.length?'blob_path_ambiguous':'blob_not_found');
}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  let stage='start';
  try{
    const id=String(req.query.orderId||'');
    const pc=String(req.query.product||'');
    const t=String(req.query.token||'');
    const p=CATALOG[pc];
    if(!p||!verifyOrderToken(id,pc,t))return json(res,403,{error:'forbidden'});

    stage='payment_check';
    const provider=(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase();
    let st;
    if(provider==='tbank'){
      const ref=await getTbankPayment(id);
      if(!ref?.paymentId)return json(res,409,{state:'pending'});
      st=safeTbankState(await tbankCall('GetState',{PaymentId:String(ref.paymentId)}),p,id);
    }else{
      st=safeOrderState(await fetchYandexOrder(id),p);
    }
    if(st.state!=='paid')return json(res,409,st);

    stage='blob_resolve';
    const pathname=await resolveBlobPath(pc,p.blobPath);

    stage='blob_get';
    const result=await get(pathname,{access:'private',useCache:true,...blobAuth()});
    if(!result||result.statusCode!==200)throw new Error('blob_get_failed');

    stage='download_limit';
    await reserveDownload(id);

    const filename=pathname.split('/').pop()||'course.zip';
    res.statusCode=200;
    res.setHeader('Content-Type',result.blob.contentType||'application/zip');
    res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');

    Readable.fromWeb(result.stream).pipe(res);
  }catch(e){
    const msg=String(e?.message||'unknown');
    console.error('download_unavailable',stage,msg);
    if(res.headersSent){
      try{res.destroy(e)}catch{}
      return;
    }
    if(msg==='download_limit_reached')return json(res,429,{error:'download_limit_reached'});
    if(msg==='download_window_expired')return json(res,410,{error:'download_window_expired'});
    const known=['blob_not_found','blob_path_ambiguous','blob_get_failed'];
    const code=known.includes(msg)?msg:stage+'_failed';
    return json(res,503,{error:'download_unavailable',code});
  }
}
