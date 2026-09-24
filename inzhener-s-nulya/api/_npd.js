import crypto from'node:crypto';
import{get,put}from'@vercel/blob';
import{blobAuth}from'./_blob-auth.js';
import{CATALOG}from'./_shared.js';
import{getTbankPayment,saveTbankPayment}from'./_tbank-payments.js';

const API='https://lknpd.nalog.ru/api';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const SESSION_PATH='_secure/npd/session.enc.json';
const PENDING_PATH='_secure/npd/pending.enc.json';

function key(){
  const secret=String(process.env.ORDER_HMAC_SECRET||'');
  if(secret.length<32)throw new Error('ORDER_HMAC_SECRET is not configured');
  return crypto.createHash('sha256').update('npd-session-v1:'+secret).digest();
}
function seal(value){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return JSON.stringify({v:1,iv:iv.toString('base64url'),tag:tag.toString('base64url'),data:data.toString('base64url')});
}
function openSealed(raw){
  const p=JSON.parse(String(raw||'{}'));
  if(p.v!==1||!p.iv||!p.tag||!p.data)throw new Error('npd_secure_store_invalid');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(p.iv,'base64url'));
  decipher.setAuthTag(Buffer.from(p.tag,'base64url'));
  const out=Buffer.concat([decipher.update(Buffer.from(p.data,'base64url')),decipher.final()]);
  return JSON.parse(out.toString('utf8'));
}
async function loadSecure(path){
  const r=await get(path,{access:'private',useCache:false,...blobAuth()});
  if(!r||r.statusCode!==200)return null;
  return openSealed(await new Response(r.stream).text());
}
async function saveSecure(path,value){
  await put(path,seal(value),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',...blobAuth()});
  return value;
}
function deviceInfo(deviceId){
  return{sourceDeviceId:deviceId,sourceType:'WEB',appVersion:'1.0.0',metaDetails:{userAgent:UA}};
}
function normalizePhone(v){
  let d=String(v||'').replace(/\D/g,'');
  if(d.length===11&&d.startsWith('8'))d='7'+d.slice(1);
  if(d.length===10)d='7'+d;
  return /^7\d{10}$/.test(d)?d:'';
}
function moscowIso(date=new Date()){
  const d=new Date(date.getTime()+3*60*60*1000);
  return d.toISOString().replace('Z','+03:00');
}
async function call(path,{method='GET',body,token,timeout=7000}={}){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const r=await fetch(API+path,{
      method,
      headers:{
        'content-type':'application/json',
        accept:'application/json, text/plain, */*',
        'accept-language':'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        referer:'https://lknpd.nalog.ru/',
        'user-agent':UA,
        ...(token?{authorization:'Bearer '+token}:{})
      },
      body:body===undefined?undefined:JSON.stringify(body),
      cache:'no-store',
      signal:ctrl.signal
    });
    const raw=await r.text();
    let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
    if(!r.ok){
      const e=new Error('npd_api_error');
      e.status=r.status;e.details=typeof data==='string'?data.slice(0,500):JSON.stringify(data).slice(0,500);
      throw e;
    }
    return data;
  }finally{clearTimeout(timer)}
}

export function npdAdminAuthorized(value){
  const expected=String(process.env.NPD_ADMIN_TOKEN||process.env.CONTROL_PURCHASE_TOKEN||'');
  const supplied=String(value||'');
  if(!expected||!supplied)return false;
  const a=crypto.createHash('sha256').update(expected).digest();
  const b=crypto.createHash('sha256').update(supplied).digest();
  return crypto.timingSafeEqual(a,b);
}

export async function npdSessionStatus(){
  try{
    const s=await loadSecure(SESSION_PATH);
    return s?.refreshToken&&s?.deviceId&&s?.inn?{connected:true,inn:String(s.inn),connectedAt:Number(s.connectedAt||0)}:{connected:false};
  }catch{return{connected:false}}
}

export async function startNpdSms(phone){
  const current=await npdSessionStatus();
  if(current.connected)throw new Error('npd_already_connected');
  const normalized=normalizePhone(phone);
  if(!normalized)throw new Error('invalid_phone');
  const deviceId=crypto.randomBytes(16).toString('hex').slice(0,21);
  const ch=await call('/v2/auth/challenge/sms/start',{
    method:'POST',
    body:{phone:normalized,requireTpToBeActive:true,deviceData:{sourceType:'WEB'}}
  });
  if(!ch?.challengeToken)throw new Error('npd_sms_start_failed');
  await saveSecure(PENDING_PATH,{
    phone:normalized,
    deviceId,
    challengeToken:String(ch.challengeToken),
    expiresAt:Date.now()+Math.max(180000,Number(ch.expireIn||180)*1000),
    createdAt:Date.now()
  });
  return{ok:true,expiresIn:Number(ch.expireIn||180)};
}

async function refreshRaw(session){
  const r=await call('/v1/auth/token',{
    method:'POST',
    body:{refreshToken:session.refreshToken,deviceInfo:deviceInfo(session.deviceId)}
  });
  const next={
    ...session,
    accessToken:String(r?.token||session.accessToken||''),
    refreshToken:String(r?.refreshToken||session.refreshToken||''),
    tokenExpireIn:String(r?.tokenExpireIn||session.tokenExpireIn||''),
    updatedAt:Date.now()
  };
  if(r?.profile?.inn)next.inn=String(r.profile.inn);
  await saveSecure(SESSION_PATH,next);
  return next;
}

export async function verifyNpdSms(code){
  const p=await loadSecure(PENDING_PATH);
  if(!p?.phone||!p?.deviceId||!p?.challengeToken)throw new Error('npd_sms_not_started');
  if(Number(p.expiresAt||0)<Date.now())throw new Error('npd_sms_expired');
  const clean=String(code||'').replace(/\D/g,'');
  if(clean.length<4||clean.length>8)throw new Error('invalid_sms_code');
  let r=await call('/v2/auth/challenge/sms/verify',{
    method:'POST',
    body:{phone:p.phone,code:clean,challengeToken:p.challengeToken,deviceInfo:deviceInfo(p.deviceId)}
  });
  let session={
    accessToken:String(r?.token||''),
    refreshToken:String(r?.refreshToken||''),
    tokenExpireIn:String(r?.tokenExpireIn||''),
    inn:String(r?.profile?.inn||''),
    deviceId:p.deviceId,
    connectedAt:Date.now(),
    updatedAt:Date.now()
  };
  if(!session.refreshToken)throw new Error('npd_missing_refresh_token');
  if(!session.accessToken)session=await refreshRaw(session);
  if(!session.inn){
    const u=await call('/v1/user',{token:session.accessToken});
    session.inn=String(u?.inn||'');
  }
  if(!session.inn)throw new Error('npd_missing_inn');
  await saveSecure(SESSION_PATH,session);
  await saveSecure(PENDING_PATH,{used:true,usedAt:Date.now()});
  return{ok:true,inn:session.inn};
}

async function ensureSession(){
  let s=await loadSecure(SESSION_PATH);
  if(!s?.refreshToken||!s?.deviceId)throw new Error('npd_not_connected');
  const exp=Date.parse(String(s.tokenExpireIn||''));
  if(!s.accessToken||!Number.isFinite(exp)||exp-Date.now()<5*60*1000)s=await refreshRaw(s);
  if(!s.inn){
    const u=await call('/v1/user',{token:s.accessToken});
    s.inn=String(u?.inn||'');
    await saveSecure(SESSION_PATH,s);
  }
  return s;
}

function shortOrder(orderId){
  const m=String(orderId||'').match(/([a-f0-9]{8})(?:-[a-f0-9-]+)?$/i);
  return(m?.[1]||crypto.createHash('sha1').update(String(orderId)).digest('hex').slice(0,8)).toUpperCase();
}
function serviceName(product,orderId){
  const base=String(product?.title||'Цифровой учебный материал').replace(/\s+/g,' ').trim();
  return(base.length>95?base.slice(0,95):base)+' · заказ '+shortOrder(orderId);
}
function receiptUrl(inn,uuid){return`${API}/v1/receipt/${encodeURIComponent(inn)}/${encodeURIComponent(uuid)}/print`}

async function findExisting(session,name,amount,confirmedAt){
  const from=new Date(Math.max(0,Number(confirmedAt||Date.now())-24*60*60*1000));
  const to=new Date(Date.now()+60*60*1000);
  const q=new URLSearchParams({
    from:moscowIso(from),to:moscowIso(to),offset:'0',limit:'100',sortBy:'operation_time:desc'
  });
  const d=await call('/v1/incomes?'+q.toString(),{token:session.accessToken});
  const rows=Array.isArray(d?.content)?d.content:[];
  return rows.find(r=>{
    if(r?.cancellationInfo)return false;
    if(Math.abs(Number(r?.totalAmount)-Number(amount))>.001)return false;
    return Array.isArray(r?.services)&&r.services.some(s=>String(s?.name||'')===name);
  })||null;
}

async function createIncome(session,{name,amount,confirmedAt,buyerContact}){
  const phone=normalizePhone(buyerContact);
  const base={
    operationTime:moscowIso(new Date(Number(confirmedAt||Date.now()))),
    requestTime:moscowIso(),
    ignoreMaxTotalIncomeRestriction:false,
    client:{incomeType:'FROM_INDIVIDUAL',displayName:null,contactPhone:phone?('+'+phone):null,inn:null},
    services:[{name,amount:String(Number(amount).toFixed(2)),quantity:1}],
    totalAmount:String(Number(amount).toFixed(2))
  };
  try{
    return await call('/v1/income',{method:'POST',token:session.accessToken,body:{...base,paymentType:'WIRE'}});
  }catch(e){
    const details=String(e?.details||'');
    if(Number(e?.status)===400&&/ACCOUNT/i.test(details)&&!/WIRE/i.test(details)){
      return call('/v1/income',{method:'POST',token:session.accessToken,body:{...base,paymentType:'ACCOUNT'}});
    }
    throw e;
  }
}

export async function ensureNpdReceiptForOrder(orderId){
  const row=await getTbankPayment(orderId);
  if(!row)return{status:'missing_order'};
  const p=CATALOG[String(row.product||'')];
  if(!p)return{status:'missing_product'};
  if(p.controlOnly)return{status:'not_required'};
  if(String(row.status||'').toUpperCase()!=='CONFIRMED')return{status:'not_paid'};
  if(row.npdReceiptUuid&&row.npdReceiptUrl)return{status:'issued',uuid:row.npdReceiptUuid,url:row.npdReceiptUrl};

  const session=await ensureSession();
  const name=serviceName(p,orderId);
  const priorStatus=String(row.npdReceiptStatus||'');
  if(['creating','pending','error'].includes(priorStatus)){
    try{
      const existing=await findExisting(session,name,p.price,row.confirmedAt);
      if(existing?.approvedReceiptUuid){
        const uuid=String(existing.approvedReceiptUuid);
        const url=receiptUrl(session.inn,uuid);
        await saveTbankPayment(orderId,{npdReceiptStatus:'issued',npdReceiptUuid:uuid,npdReceiptUrl:url,npdReceiptIssuedAt:Date.now(),npdReceiptError:''});
        return{status:'issued',uuid,url,recovered:true};
      }
    }catch(e){console.error('npd_receipt_reconcile_failed',String(e?.message||e))}
  }

  await saveTbankPayment(orderId,{npdReceiptStatus:'creating',npdReceiptLastAttemptAt:Date.now(),npdReceiptError:''});
  try{
    const created=await createIncome(session,{name,amount:p.price,confirmedAt:row.confirmedAt,buyerContact:row.buyerContact});
    const uuid=String(created?.approvedReceiptUuid||'');
    if(!uuid)throw new Error('npd_receipt_uuid_missing');
    const url=receiptUrl(session.inn,uuid);
    await saveTbankPayment(orderId,{
      npdReceiptStatus:'issued',npdReceiptUuid:uuid,npdReceiptUrl:url,npdReceiptIssuedAt:Date.now(),npdReceiptError:''
    });
    return{status:'issued',uuid,url};
  }catch(e){
    await saveTbankPayment(orderId,{
      npdReceiptStatus:'pending',
      npdReceiptError:String(e?.message||e).slice(0,120),
      npdReceiptLastAttemptAt:Date.now()
    });
    throw e;
  }
}

export async function cancelNpdReceiptForOrder(orderId,comment='Возврат средств'){
  const row=await getTbankPayment(orderId);
  if(!row)return{status:'missing_order'};
  const p=CATALOG[String(row.product||'')];
  if(!p||p.controlOnly)return{status:'not_required'};
  if(!row.npdReceiptUuid)return{status:'no_receipt'};
  if(row.npdReceiptCancelledAt)return{status:'cancelled',uuid:row.npdReceiptUuid};

  const session=await ensureSession();
  const now=moscowIso();
  try{
    await call('/v1/cancel',{
      method:'POST',
      token:session.accessToken,
      body:{
        receiptUuid:String(row.npdReceiptUuid),
        comment:String(comment||'Возврат средств'),
        operationTime:now,
        requestTime:now,
        partnerCode:null
      }
    });
    await saveTbankPayment(orderId,{
      npdReceiptStatus:'cancelled',
      npdReceiptCancelledAt:Date.now(),
      npdReceiptCancelReason:String(comment||'Возврат средств'),
      npdReceiptError:''
    });
    return{status:'cancelled',uuid:String(row.npdReceiptUuid)};
  }catch(e){
    await saveTbankPayment(orderId,{
      npdReceiptStatus:'cancel_pending',
      npdReceiptError:String(e?.message||e).slice(0,120),
      npdReceiptLastAttemptAt:Date.now()
    });
    throw e;
  }
}

export async function connectNpdByPassword(username,password){
  const login=String(username||'').trim();
  const pass=String(password||'');
  if(!/^\d{10,12}$/.test(login))throw new Error('invalid_inn');
  if(!pass)throw new Error('password_required');

  const deviceId=crypto.randomBytes(16).toString('hex').slice(0,21);
  const r=await call('/v1/auth/lkfl',{
    method:'POST',
    body:{username:login,password:pass,deviceInfo:deviceInfo(deviceId)}
  });

  let session={
    accessToken:String(r?.token||''),
    refreshToken:String(r?.refreshToken||''),
    tokenExpireIn:String(r?.tokenExpireIn||''),
    inn:String(r?.profile?.inn||login),
    deviceId,
    connectedAt:Date.now(),
    updatedAt:Date.now()
  };
  if(!session.refreshToken)throw new Error('npd_missing_refresh_token');
  if(!session.accessToken)session=await refreshRaw(session);
  if(!session.inn){
    const u=await call('/v1/user',{token:session.accessToken});
    session.inn=String(u?.inn||login);
  }
  await saveSecure(SESSION_PATH,session);
  return{ok:true,inn:session.inn};
}
