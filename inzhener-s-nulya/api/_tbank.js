import crypto from'node:crypto';

const PROD_API='https://securepay.tinkoff.ru/v2';
const TEST_API='https://rest-api-test.tinkoff.ru/v2';

export function tbankEnv(){
  if(String(process.env.TBANK_ENV||'').toLowerCase()==='production')return'production';
  return'test';
}

export function requireTbankCredentials(){
  const terminalKey=String(process.env.TBANK_TERMINAL_KEY||'').trim();
  const password=String(process.env.TBANK_PASSWORD||'').trim();
  if(!terminalKey)throw new Error('TBANK_TERMINAL_KEY is not configured');
  if(!password)throw new Error('TBANK_PASSWORD is not configured');
  return{terminalKey,password};
}

function primitiveEntries(payload){
  return Object.entries(payload||{}).filter(([k,v])=>k!=='Token'&&v!==null&&v!==undefined&&typeof v!=='object');
}

export function signTbank(payload){
  const{password}=requireTbankCredentials();
  const pairs=[...primitiveEntries(payload),['Password',password]].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  const source=pairs.map(([,v])=>String(v)).join('');
  return crypto.createHash('sha256').update(source,'utf8').digest('hex');
}

function apiBase(){
  const terminalKey=String(process.env.TBANK_TERMINAL_KEY||'');
  if(/DEMO/i.test(terminalKey))return PROD_API;
  return tbankEnv()==='production'?PROD_API:TEST_API;
}

async function post(method,payload){
  const body={...payload};
  body.Token=signTbank(body);
  const r=await fetch(`${apiBase()}/${method}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const e=new Error('tbank_http_error');
    e.httpStatus=String(r.status||'');
    e.providerCode=String(data?.ErrorCode||'');
    e.providerMessage=String(data?.Message||'');
    e.providerDetails=String(data?.Details||'');
    throw e;
  }
  return data;
}

export async function initTbankPayment({orderId,amount,title,site,orderPage,contact}){
  const{terminalKey}=requireTbankCredentials();
  const data={};
  if(String(contact||'').includes('@'))data.Email=String(contact);
  else if(contact)data.Phone=String(contact).replace(/[^+0-9]/g,'');
  const payload={
    TerminalKey:terminalKey,
    Amount:Math.round(Number(amount)*100),
    OrderId:String(orderId),
    Description:String(title||'').slice(0,140),
    Language:'ru',
    NotificationURL:`${site}/api/tbank-webhook`,
    SuccessURL:`${orderPage}&result=success`,
    FailURL:`${orderPage}&result=error`
  };
  if(Object.keys(data).length)payload.DATA=data;
  const d=await post('Init',payload);
  if(!d?.Success||String(d?.ErrorCode||'')!=='0'||!d?.PaymentURL){
    const e=new Error('tbank_init_failed');
    e.providerCode=String(d?.ErrorCode||'');
    e.providerMessage=String(d?.Message||'');
    e.providerDetails=String(d?.Details||'');
    throw e;
  }
  return{paymentUrl:d.PaymentURL,paymentId:String(d.PaymentId||''),status:d.Status||'NEW'};
}

export async function fetchTbankOrder(orderId){
  const{terminalKey}=requireTbankCredentials();
  const d=await post('CheckOrder',{TerminalKey:terminalKey,OrderId:String(orderId)});
  if(!d?.Success||String(d?.ErrorCode||'')!=='0')throw new Error('tbank_lookup_failed');
  return d;
}

export function safeTbankOrderState(order,product){
  if(!order||!Array.isArray(order.Payments))return{state:'not_found'};
  const expected=Math.round(Number(product.price)*100);
  const payments=order.Payments.filter(x=>Number(x?.Amount)===expected);
  if(!payments.length)return{state:'mismatch'};

  const confirmed=payments.find(x=>String(x?.Status||'').toUpperCase()==='CONFIRMED');
  if(confirmed)return{state:'paid',paymentStatus:'CONFIRMED',paymentId:String(confirmed.PaymentId||'')};

  const statuses=payments.map(x=>String(x?.Status||'').toUpperCase()).filter(Boolean);
  const terminalFailed=['REJECTED','CANCELED','REVERSED','PARTIAL_REVERSED','REFUNDED','PARTIAL_REFUNDED'];
  if(statuses.some(s=>terminalFailed.includes(s)))return{state:'failed',paymentStatus:statuses[0]||'FAILED'};

  return{state:'pending',paymentStatus:statuses[0]||'NEW'};
}

export function verifyTbankNotification(payload){
  try{
    const{terminalKey}=requireTbankCredentials();
    if(String(payload?.TerminalKey||'')!==terminalKey)return false;
    const supplied=String(payload?.Token||'').toLowerCase();
    if(!/^[a-f0-9]{64}$/.test(supplied))return false;
    const expected=signTbank(payload).toLowerCase();
    const a=Buffer.from(supplied,'hex'),b=Buffer.from(expected,'hex');
    return a.length===b.length&&crypto.timingSafeEqual(a,b);
  }catch{return false}
}
