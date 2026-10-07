import { get,list,put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { blobAuth } from './_blob-auth.js';
import { CATALOG,verifyOrderToken } from './_shared.js';
import { engineerMaxFetch,engineerMaxUpload } from './_engineer-max-http.js';
import { starterProductHtml } from './_starter-product.js';
import { getTbankPayment,saveTbankPayment } from './_tbank-payments.js';
import { safeTbankState,tbankCall } from './_tbank.js';
import { ensureNpdReceiptForOrder } from './_npd.js';
const API='https://platform-api2.max.ru';
const BOT='se13638142_1_bot';
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^a-zа-яё0-9]/giu,'');
const headers=()=>({Authorization:String(process.env.ENGINEER_MAX_BOT_TOKEN||process.env.MAX_BOT_TOKEN||'').trim(),'content-type':'application/json'});
async function api(path,body){
  const r=await engineerMaxFetch(API+path,{method:body?'POST':'GET',headers:headers(),body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error('max_api_'+String(data.code||r.status));
  return data;
}
async function identity(){const me=await api('/me');if(me.username!==BOT||me.is_bot!==true)throw new Error('max_delivery_wrong_bot');}
export function starterZip(){
  const name=Buffer.from('first-engineer-workday.html'),raw=Buffer.from(starterProductHtml('')),compressed=deflateRawSync(raw);
  let crc=0xffffffff;for(const b of raw){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+compressed.length,16);
  return Buffer.concat([local,name,compressed,central,name,end]);
}
export async function prepareMaxAsset(code){
  const p=CATALOG[code];if(!p||p.controlOnly)throw new Error('invalid_product');
  await identity();
  const path='_max_assets/chat-files-v1/'+code+'.json';
  const cached=await get(path,{access:'private',useCache:false,...blobAuth()});
  if(cached?.statusCode===200){const asset=JSON.parse(await new Response(cached.stream).text());if(asset.token&&asset.bot===BOT)return asset;}
  let bytes;
  if(code==='starter')bytes=starterZip();
  else{
    const {blobs}=await list({limit:100,...blobAuth()});
    const matching=blobs.filter(b=>norm(b.pathname)===norm(p.blobPath));
    if(matching.length!==1)throw new Error('max_asset_not_found');
    if(matching[0].size>128*1024*1024)throw new Error('max_asset_too_large');
    const file=await get(matching[0].pathname,{access:'private',useCache:false,...blobAuth()});
    if(file?.statusCode!==200)throw new Error('max_asset_unreadable');
    bytes=Buffer.from(await new Response(file.stream).arrayBuffer());
  }
  const upload=await api('/uploads?type=file',{});
  const boundary='max-'+randomUUID(),filename=code==='starter'?'first-engineer-workday.zip':code+'-course.zip';
  const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="data"; filename="'+filename+'"\r\nContent-Type: application/zip\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--\r\n')]);
  const response=await engineerMaxUpload(upload.url,body,'multipart/form-data; boundary='+boundary);
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.token)throw new Error('max_asset_upload_failed');
  const asset={token:result.token,bot:BOT,filename,createdAt:Date.now()};
  await put(path,JSON.stringify(asset),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',...blobAuth()});
  return asset;
}
// Authoritative bank check is mandatory, including manual recovery and retries.
export async function deliverMaxOrder(orderId,{userId,accessToken,productCode,force=false}={},deps={}){
  const d={load:getTbankPayment,save:saveTbankPayment,state:tbankCall,check:safeTbankState,verify:verifyOrderToken,receipt:ensureNpdReceiptForOrder,asset:prepareMaxAsset,send:api,...deps};
  let order=await d.load(orderId);const product=CATALOG[order?.product];
  if(!order?.paymentId||!product||product.controlOnly)throw new Error('order_not_found');
  if(userId){
    if(order.maxUserId&&Number(order.maxUserId)!==userId)throw new Error('order_owner_mismatch');
    if(!order.maxUserId&&!(productCode===order.product&&d.verify(orderId,productCode,accessToken)))throw new Error('order_access_required');
  }else if(!Number.isSafeInteger(order.maxUserId)||order.maxUserId<=0)throw new Error('order_owner_missing');
  const checked=d.check(await d.state('GetState',{TerminalKey:process.env.TBANK_TERMINAL_KEY,PaymentId:String(order.paymentId)}),product,orderId,String(order.paymentId));
  if(checked.state!=='paid')return checked;
  if(!order.maxUserId)order=await d.save(orderId,{maxUserId:userId});
  if(order.maxDeliveredAt&&!force)return{state:'paid',delivered:true,alreadyDelivered:true};
  await d.receipt(orderId);
  const asset=await d.asset(order.product);
  let message;
  for(let i=0;i<4;i++){
    try{message=await d.send('/messages?user_id='+order.maxUserId,{text:'Оплата подтверждена. '+product.title+'\n\nМатериалы — в ZIP-файле ниже. Скачайте архив и распакуйте его. '+(order.product==='starter'?'Откройте first-engineer-workday.html из архива: практикум работает на компьютере без подключения к сайту.':'Откройте инструкцию внутри архива на компьютере.')+'\n\nСохраните файл. Для повторной выдачи напишите /access. Вопросы можно написать обычным сообщением в этом чате.',attachments:[{type:'file',payload:{token:asset.token}}]});break;}
    catch(e){if(!String(e.message).includes('attachment.not.ready')||i===3)throw e;await new Promise(r=>setTimeout(r,1000*2**i));}
  }
  await d.save(orderId,{maxDeliveredAt:Date.now(),maxDeliveryMessageId:message?.message?.body?.mid||message?.body?.mid||'',maxDeliveryStatus:'delivered'});
  return{state:'paid',delivered:true};
}
