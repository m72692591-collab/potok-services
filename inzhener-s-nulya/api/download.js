import{issueSignedToken,presignUrl}from'@vercel/blob';
import{CATALOG,fetchYandexOrder,json,safeOrderState,verifyOrderToken}from'./_shared.js';

function blobAuth(){
  if(process.env.BLOB_READ_WRITE_TOKEN){
    return{token:process.env.BLOB_READ_WRITE_TOKEN};
  }
  if(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN){
    return{storeId:process.env.BLOB_STORE_ID,oidcToken:process.env.VERCEL_OIDC_TOKEN};
  }
  throw new Error('Blob storage is not connected to this deployment');
}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  try{
    const id=String(req.query.orderId||'');
    const pc=String(req.query.product||'');
    const t=String(req.query.token||'');
    const p=CATALOG[pc];
    if(!p||!verifyOrderToken(id,pc,t))return json(res,403,{error:'forbidden'});

    const st=safeOrderState(await fetchYandexOrder(id),p);
    if(st.state!=='paid')return json(res,409,st);

    const validUntil=Date.now()+300000;
    const signed=await issueSignedToken({
      pathname:p.blobPath,
      operations:['get'],
      validUntil,
      ...blobAuth()
    });
    const{presignedUrl}=await presignUrl(signed,{
      pathname:p.blobPath,
      operation:'get',
      access:'private',
      validUntil
    });
    return json(res,200,{url:presignedUrl,expiresInSeconds:300});
  }catch(e){
    console.error('download_unavailable',e?.message||e);
    return json(res,503,{error:'download_unavailable'});
  }
}
