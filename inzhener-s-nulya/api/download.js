import{issueSignedToken,presignUrl,list}from'@vercel/blob';
import{CATALOG,fetchYandexOrder,json,safeOrderState,verifyOrderToken}from'./_shared.js';

function signingAuth(){
  if(process.env.BLOB_READ_WRITE_TOKEN)return{token:process.env.BLOB_READ_WRITE_TOKEN};
  if(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN){
    return{storeId:process.env.BLOB_STORE_ID,oidcToken:process.env.VERCEL_OIDC_TOKEN};
  }
  throw new Error('blob_auth_missing');
}

function listAuth(){
  return process.env.BLOB_READ_WRITE_TOKEN?{token:process.env.BLOB_READ_WRITE_TOKEN}:{};
}

function norm(s){
  return String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-zа-яё0-9]/giu,'');
}

async function resolveBlobPath(productCode,expected){
  const{blobs}=await list({limit:100,...listAuth()});
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
    const st=safeOrderState(await fetchYandexOrder(id),p);
    if(st.state!=='paid')return json(res,409,st);

    stage='blob_resolve';
    const pathname=await resolveBlobPath(pc,p.blobPath);

    stage='blob_sign';
    const validUntil=Date.now()+300000;
    const signed=await issueSignedToken({
      pathname,
      operations:['get'],
      validUntil,
      ...signingAuth()
    });

    stage='blob_presign';
    const{presignedUrl}=await presignUrl(signed,{
      pathname,
      operation:'get',
      access:'private',
      validUntil
    });

    return json(res,200,{url:presignedUrl,expiresInSeconds:300});
  }catch(e){
    const msg=String(e?.message||'unknown');
    console.error('download_unavailable',stage,msg);
    const known=['blob_auth_missing','blob_not_found','blob_path_ambiguous'];
    const code=known.includes(msg)?msg:stage+'_failed';
    return json(res,503,{error:'download_unavailable',code});
  }
}
