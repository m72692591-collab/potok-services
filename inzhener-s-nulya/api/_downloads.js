import crypto from'node:crypto';
import{get,put}from'@vercel/blob';

export const DOWNLOAD_LIMIT=3;
export const DOWNLOAD_WINDOW_MS=24*60*60*1000;

export function blobAuth(){
  if(process.env.BLOB_READ_WRITE_TOKEN)return{token:process.env.BLOB_READ_WRITE_TOKEN};
  if(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN){
    return{storeId:process.env.BLOB_STORE_ID,oidcToken:process.env.VERCEL_OIDC_TOKEN};
  }
  return{};
}

function metaPath(orderId){
  const key=crypto.createHash('sha256').update(String(orderId)).digest('hex');
  return `_orders/downloads/${key}.json`;
}

function view(raw={}){
  const used=Math.max(0,Number(raw.used)||0);
  const firstDownloadAt=raw.firstDownloadAt?Number(raw.firstDownloadAt):null;
  const expiresAt=firstDownloadAt?Number(raw.expiresAt)||firstDownloadAt+DOWNLOAD_WINDOW_MS:null;
  const expired=Boolean(expiresAt&&Date.now()>expiresAt);
  return{
    used,
    limit:DOWNLOAD_LIMIT,
    remaining:expired?0:Math.max(0,DOWNLOAD_LIMIT-used),
    firstDownloadAt,
    expiresAt,
    expired
  };
}

export async function getDownloadStatus(orderId){
  const result=await get(metaPath(orderId),{access:'private',useCache:false,...blobAuth()});
  if(!result||result.statusCode!==200)return view();
  try{
    const raw=JSON.parse(await new Response(result.stream).text());
    return view(raw);
  }catch{
    return view();
  }
}

export async function reserveDownload(orderId){
  const current=await getDownloadStatus(orderId);
  if(current.expired)throw new Error('download_window_expired');
  if(current.used>=DOWNLOAD_LIMIT)throw new Error('download_limit_reached');

  const now=Date.now();
  const firstDownloadAt=current.firstDownloadAt||now;
  const next={
    used:current.used+1,
    firstDownloadAt,
    expiresAt:firstDownloadAt+DOWNLOAD_WINDOW_MS,
    updatedAt:now
  };

  await put(metaPath(orderId),JSON.stringify(next),{
    access:'private',
    addRandomSuffix:false,
    allowOverwrite:true,
    contentType:'application/json',
    ...blobAuth()
  });

  return view(next);
}
