import crypto from'node:crypto';

const PAYMENT_URL='https://auth.robokassa.ru/Merchant/Index.aspx';

function credentials(){
  const merchantLogin=String(process.env.ROBOKASSA_MERCHANT_LOGIN||'').trim();
  const password1=String(process.env.ROBOKASSA_PASSWORD1||'').trim();
  const password2=String(process.env.ROBOKASSA_PASSWORD2||'').trim();
  if(!merchantLogin)throw new Error('ROBOKASSA_MERCHANT_LOGIN is not configured');
  if(!password1)throw new Error('ROBOKASSA_PASSWORD1 is not configured');
  if(!password2)throw new Error('ROBOKASSA_PASSWORD2 is not configured');
  return{merchantLogin,password1,password2};
}

function algo(){
  const v=String(process.env.ROBOKASSA_HASH_ALGO||'md5').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!['md5','sha256','sha512'].includes(v))throw new Error('ROBOKASSA_HASH_ALGO invalid');
  return v;
}

function digest(value){return crypto.createHash(algo()).update(String(value),'utf8').digest('hex')}

export function robokassaConfigured(){
  return Boolean(process.env.ROBOKASSA_MERCHANT_LOGIN&&process.env.ROBOKASSA_PASSWORD1&&process.env.ROBOKASSA_PASSWORD2);
}

export function robokassaMode(){
  return String(process.env.ROBOKASSA_TEST_MODE||'').toLowerCase()==='true'?'test':'production';
}

export function makeInvId(){
  const suffix=crypto.randomInt(0,1000).toString().padStart(3,'0');
  return `${Date.now()}${suffix}`;
}

function receiptFor({title,amount}){
  return encodeURIComponent(JSON.stringify({
    items:[{name:String(title||'Цифровой материал').slice(0,128),quantity:1,sum:Number(amount),tax:'none'}]
  }));
}

export function createRobokassaPaymentUrl({invId,orderId,product,amount,title,email}){
  const{merchantLogin,password1}=credentials();
  const outSum=Number(amount).toFixed(2);
  const receipt=receiptFor({title,amount});
  const shp={Shp_order:String(orderId),Shp_product:String(product)};
  const shpPart=Object.keys(shp).sort().map(k=>`${k}=${shp[k]}`);
  const signatureSource=[merchantLogin,outSum,String(invId),receipt,password1,...shpPart].join(':');
  const signature=digest(signatureSource);

  const q=new URLSearchParams();
  q.set('MerchantLogin',merchantLogin);
  q.set('OutSum',outSum);
  q.set('InvId',String(invId));
  q.set('Description',String(title||'Оплата цифрового материала').slice(0,100));
  q.set('SignatureValue',signature);
  q.set('Culture','ru');
  q.set('Encoding','utf-8');
  q.set('Email',String(email||''));
  q.set('Receipt',receipt);
  q.set('IsTest',robokassaMode()==='test'?'1':'0');
  for(const[k,v]of Object.entries(shp))q.set(k,v);
  return `${PAYMENT_URL}?${q.toString()}`;
}

function timingSafeHex(a,b){
  const x=String(a||'').toLowerCase(),y=String(b||'').toLowerCase();
  if(!/^[a-f0-9]+$/.test(x)||x.length!==y.length)return false;
  const xb=Buffer.from(x,'hex'),yb=Buffer.from(y,'hex');
  return xb.length===yb.length&&crypto.timingSafeEqual(xb,yb);
}

export function verifyResult({outSum,invId,signature,shpOrder,shpProduct}){
  const{password2}=credentials();
  const shp={Shp_order:String(shpOrder||''),Shp_product:String(shpProduct||'')};
  const source=[String(outSum),String(invId),password2,...Object.keys(shp).sort().map(k=>`${k}=${shp[k]}`)].join(':');
  return timingSafeHex(signature,digest(source));
}

export function verifySuccess({outSum,invId,signature,shpOrder,shpProduct}){
  const{password1}=credentials();
  const shp={Shp_order:String(shpOrder||''),Shp_product:String(shpProduct||'')};
  const source=[String(outSum),String(invId),password1,...Object.keys(shp).sort().map(k=>`${k}=${shp[k]}`)].join(':');
  return timingSafeHex(signature,digest(source));
}
