import crypto from 'node:crypto';

export function tbankApiBase(){
  return (process.env.TBANK_API_BASE||'https://securepay.tinkoff.ru/v2').replace(/\/$/,'');
}

export function tbankTerminalKey(){
  const v=process.env.TBANK_TERMINAL_KEY;
  if(!v)throw new Error('TBANK_TERMINAL_KEY is not configured');
  return v;
}

export function tbankPassword(){
  const v=process.env.TBANK_PASSWORD;
  if(!v)throw new Error('TBANK_PASSWORD is not configured');
  return v;
}

export function makeTbankToken(payload,password=tbankPassword()){
  const pairs={};
  for(const [k,v] of Object.entries(payload||{})){
    if(k==='Token'||v===undefined||v===null)continue;
    if(typeof v==='object')continue;
    pairs[k]=v;
  }
  pairs.Password=password;
  const raw=Object.keys(pairs).sort().map(k=>String(pairs[k])).join('');
  return crypto.createHash('sha256').update(raw,'utf8').digest('hex');
}

export function verifyTbankToken(payload){
  const supplied=String(payload?.Token||'').toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(supplied))return false;
  const expected=makeTbankToken(payload).toLowerCase();
  const a=Buffer.from(expected),b=Buffer.from(supplied);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

export async function tbankCall(method,payload={}){
  const body={TerminalKey:tbankTerminalKey(),...payload};
  body.Token=makeTbankToken(body);
  const r=await fetch(`${tbankApiBase()}/${method}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d?.Success!==true){
    const e=new Error('tbank_api_error');
    e.details={status:r.status,errorCode:d?.ErrorCode,message:d?.Message,details:d?.Details};
    throw e;
  }
  return d;
}

export function safeTbankState(o,p,orderId){
  if(!o)return{state:'not_found'};
  if(orderId&&String(o.OrderId||'')!==String(orderId))return{state:'mismatch'};
  const amount=Number(o.Amount);
  const expected=Math.round(Number(p.price)*100);
  if(!Number.isFinite(amount)||amount!==expected)return{state:'mismatch'};
  const status=String(o.Status||'').toUpperCase();
  if(status==='CONFIRMED')return{state:'paid',paymentStatus:status};
  if(['REJECTED','CANCELED','REVERSED','REFUNDED','PARTIAL_REFUNDED','PARTIAL_REVERSED','DEADLINE_EXPIRED','AUTH_FAIL'].includes(status))return{state:'failed',paymentStatus:status};
  return{state:'pending',paymentStatus:status||'NEW'};
}
