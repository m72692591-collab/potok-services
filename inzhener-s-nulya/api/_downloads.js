import crypto from'node:crypto';
import{get,put}from'@vercel/blob';
import{blobAuth}from'./_blob-auth.js';

export const DOWNLOAD_LIMIT=3;
export const DOWNLOAD_WINDOW_MS=24*60*60*1000;

export{blobAuth}from'./_blob-auth.js';

function metaPath(orderId){
  const key=crypto.createHash('sha256').update(String(orderId)).digest('hex');
  return `_orders/downloads/${key}.json`;
}

function view(raw={}){
  const used=Math.max(0,Number(raw.used)||0);
  const firstDownloadAt=raw.firstDownloadAt?Number(raw.firstDownloadAt):null;
  const expiresAt=firstDownloadAt?Number(raw.expiresAt)||firstDownloadAt+DOWNLOAD_WINDOW_MS:null;
  const lastDownloadAt=raw.lastDownloadAt?Number(raw.lastDownloadAt):null;
  const expired=Boolean(expiresAt&&Date.now()>expiresAt);
  return{
    used,
    limit:DOWNLOAD_LIMIT,
    remaining:expired?0:Math.max(0,DOWNLOAD_LIMIT-used),
    firstDownloadAt,
    lastDownloadAt,
    expiresAt,
    expired
  };
}

async function readRaw(orderId){
  const result=await get(metaPath(orderId),{access:'private',useCache:false,...blobAuth()});
  if(!result||result.statusCode!==200)return{};
  try{return JSON.parse(await new Response(result.stream).text())}catch{return{}}
}

export async function getDownloadStatus(orderId){
  return view(await readRaw(orderId));
}

export async function reserveDownload(orderId){
  const raw=await readRaw(orderId);
  const current=view(raw);
  if(current.expired)throw new Error('download_window_expired');
  if(current.used>=DOWNLOAD_LIMIT)throw new Error('download_limit_reached');

  const now=Date.now();
  const firstDownloadAt=current.firstDownloadAt||now;
  const events=Array.isArray(raw.downloadEvents)?raw.downloadEvents.filter(Number.isFinite).slice(-9):[];
  events.push(now);
  const next={
    ...raw,
    used:current.used+1,
    firstDownloadAt,
    lastDownloadAt:now,
    expiresAt:firstDownloadAt+DOWNLOAD_WINDOW_MS,
    downloadEvents:events,
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
