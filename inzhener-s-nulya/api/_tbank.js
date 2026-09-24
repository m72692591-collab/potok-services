import crypto from'node:crypto';
import https from'node:https';
import tls from'node:tls';

const RUSSIAN_TRUSTED_ROOT_CA=`-----BEGIN CERTIFICATE-----
MIIFwjCCA6qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAxMjEwNDE1WhcNMzIwMjI3MjEwNDE1WjBwMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMSAwHgYDVQQDDBdSdXNzaWFuIFRydXN0ZWQgUm9v
dCBDQTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMfFOZ8pUAL3+r2n
qqE0Zp52selXsKGFYoG0GM5bwz1bSFtCt+AZQMhkWQheI3poZAToYJu69pHLKS6Q
XBiwBC1cvzYmUYKMYZC7jE5YhEU2bSL0mX7NaMxMDmH2/NwuOVRj8OImVa5s1F4U
zn4Kv3PFlDBjjSjXKVY9kmjUBsXQrIHeaqmUIsPIlNWUnimXS0I0abExqkbdrXbX
YwCOXhOO2pDUx3ckmJlCMUGacUTnylyQW2VsJIyIGA8V0xzdaeUXg0VZ6ZmNUr5Y
Ber/EAOLPb8NYpsAhJe2mXjMB/J9HNsoFMBFJ0lLOT/+dQvjbdRZoOT8eqJpWnVD
U+QL/qEZnz57N88OWM3rabJkRNdU/Z7x5SFIM9FrqtN8xewsiBWBI0K6XFuOBOTD
4V08o4TzJ8+Ccq5XlCUW2L48pZNCYuBDfBh7FxkB7qDgGDiaftEkZZfApRg2E+M9
G8wkNKTPLDc4wH0FDTijhgxR3Y4PiS1HL2Zhw7bD3CbslmEGgfnnZojNkJtcLeBH
BLa52/dSwNU4WWLubaYSiAmA9IUMX1/RpfpxOxd4Ykmhz97oFbUaDJFipIggx5sX
ePAlkTdWnv+RWBxlJwMQ25oEHmRguNYf4Zr/Rxr9cS93Y+mdXIZaBEE0KS2iLRqa
OiWBki9IMQU4phqPOBAaG7A+eP8PAgMBAAGjZjBkMB0GA1UdDgQWBBTh0YHlzlpf
BKrS6badZrHF+qwshzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzAS
BgNVHRMBAf8ECDAGAQH/AgEEMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAgEAALIY1wkilt/urfEVM5vKzr6utOeDWCUczmWX/RX4ljpRdgF+5fAIS4vH
tmXkqpSCOVeWUrJV9QvZn6L227ZwuE15cWi8DCDal3Ue90WgAJJZMfTshN4OI8cq
W9E4EG9wglbEtMnObHlms8F3CHmrw3k6KmUkWGoa+/ENmcVl68u/cMRl1JbW2bM+
/3A+SAg2c6iPDlehczKx2oa95QW0SkPPWGuNA/CE8CpyANIhu9XFrj3RQ3EqeRcS
AQQod1RNuHpfETLU/A2gMmvn/w/sx7TB3W5BPs6rprOA37tutPq9u6FTZOcG1Oqj
C/B7yTqgI7rbyvox7DEXoX7rIiEqyNNUguTk/u3SZ4VXE2kmxdmSh3TQvybfbnXV
4JbCZVaqiZraqc7oZMnRoWrXRG3ztbnbes/9qhRGI7PqXqeKJBztxRTEVj8ONs1d
WN5szTwaPIvhkhO3CO5ErU2rVdUr89wKpNXbBODFKRtgxUT70YpmJ46VVaqdAhOZ
D9EUUn4YaeLaS8AjSF/h7UkjOibNc4qVDiPP+rkehFWM66PVnP1Msh93tc+taIfC
EYVMxjh8zNbFuoc7fzvvrFILLe7ifvEIUqSVIC/AzplM/Jxw7buXFeGP1qVCBEHq
391d/9RAfaZ12zkwFsl+IKwE/OZxW8AHa9i1p4GO0YSNuczzEm4=
-----END CERTIFICATE-----`;

const RUSSIAN_TRUSTED_SUB_CA=`-----BEGIN CERTIFICATE-----
MIIHQjCCBSqgAwIBAgICEAIwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAyMTEyNTE5WhcNMjcwMzA2MTEyNTE5WjBvMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMR8wHQYDVQQDDBZSdXNzaWFuIFRydXN0ZWQgU3Vi
IENBMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA9YPqBKOk19NFymrE
wehzrhBEgT2atLezpduB24mQ7CiOa/HVpFCDRZzdxqlh8drku408/tTmWzlNH/br
HuQhZ/miWKOf35lpKzjyBd6TPM23uAfJvEOQ2/dnKGGJbsUo1/udKSvxQwVHpVv3
S80OlluKfhWPDEXQpgyFqIzPoxIQTLZ0deirZwMVHarZ5u8HqHetRuAtmO2ZDGQn
vVOJYAjls+Hiueq7Lj7Oce7CQsTwVZeP+XQx28PAaEZ3y6sQEt6rL06ddpSdoTMp
BnCqTbxW+eWMyjkIn6t9GBtUV45yB1EkHNnj2Ex4GwCiN9T84QQjKSr+8f0psGrZ
vPbCbQAwNFJjisLixnjlGPLKa5vOmNwIh/LAyUW5DjpkCx004LPDuqPpFsKXNKpa
L2Dm6uc0x4Jo5m+gUTVORB6hOSzWnWDj2GWfomLzzyjG81DRGFBpco/O93zecsIN
3SL2Ysjpq1zdoS01CMYxie//9zWvYwzI25/OZigtnpCIrcd2j1Y6dMUFQAzAtHE+
qsXflSL8HIS+IJEFIQobLlYhHkoE3avgNx5jlu+OLYe0dF0Ykx1PGNjbwqvTX37R
Cn32NMjlotW2QcGEZhDKj+3urZizp5xdTPZitA+aEjZM/Ni71VOdiOP0igbw6asZ
2fxdozZ1TnSSYNYvNATwthNmZysCAwEAAaOCAeUwggHhMBIGA1UdEwEB/wQIMAYB
Af8CAQAwDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBTR4XENCy2BTm6KSo9MI7NM
XqtpCzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzCBxwYIKwYBBQUH
AQEEgbowgbcwOwYIKwYBBQUHMAKGL2h0dHA6Ly9yb3N0ZWxlY29tLnJ1L2NkcC9y
b290Y2Ffc3NsX3JzYTIwMjIuY3J0MDsGCCsGAQUFBzAChi9odHRwOi8vY29tcGFu
eS5ydC5ydS9jZHAvcm9vdGNhX3NzbF9yc2EyMDIyLmNydDA7BggrBgEFBQcwAoYv
aHR0cDovL3JlZXN0ci1wa2kucnUvY2RwL3Jvb3RjYV9zc2xfcnNhMjAyMi5jcnQw
gbAGA1UdHwSBqDCBpTA1oDOgMYYvaHR0cDovL3Jvc3RlbGVjb20ucnUvY2RwL3Jv
b3RjYV9zc2xfcnNhMjAyMi5jcmwwNaAzoDGGL2h0dHA6Ly9jb21wYW55LnJ0LnJ1
L2NkcC9yb290Y2Ffc3NsX3JzYTIwMjIuY3JsMDWgM6Axhi9odHRwOi8vcmVlc3Ry
LXBraS5ydS9jZHAvcm9vdGNhX3NzbF9yc2EyMDIyLmNybDANBgkqhkiG9w0BAQsF
AAOCAgEARBVzZls79AdiSCpar15dA5Hr/rrT4WbrOfzlpI+xrLeRPrUG6eUWIW4v
Sui1yx3iqGLCjPcKb+HOTwoRMbI6ytP/ndp3TlYua2advYBEhSvjs+4vDZNwXr/D
anbwIWdurZmViQRBDFebpkvnIvru/RpWud/5r624Wp8voZMRtj/cm6aI9LtvBfT9
cfzhOaexI/99c14dyiuk1+6QhdwKaCRTc1mdfNQmnfWNRbfWhWBlK3h4GGE9JK33
Gk8ZS8DMrkdAh0xby4xAQ/mSWAfWrBmfzlOqGyoB1U47WTOeqNbWkkoAP2ys94+s
Jg4NTkiDVtXRF6nr6fYi0bSOvOFg0IQrMXO2Y8gyg9ARdPJwKtvWX8VPADCYMiWH
h4n8bZokIrImVKLDQKHY4jCsND2HHdJfnrdL2YJw1qFskNO4cSNmZydw0Wkgjv9k
F+KxqrDKlB8MZu2Hclph6v/CZ0fQ9YuE8/lsHZ0Qc2HyiSMnvjgK5fDc3TD4fa8F
E8gMNurM+kV8PT8LNIM+4Zs+LKEV8nqRWBaxkIVJGekkVKO8xDBOG/aN62AZKHOe
GcyIdu7yNMMRihGVZCYr8rYiJoKiOzDqOkPkLOPdhtVlgnhowzHDxMHND/E2WA5p
ZHuNM/m0TXt2wTTPL7JH2YC0gPz/BvvSzjksgzU5rLbRyUKQkgU=
-----END CERTIFICATE-----`;

const TBANK_CA=[...tls.rootCertificates,RUSSIAN_TRUSTED_ROOT_CA,RUSSIAN_TRUSTED_SUB_CA];

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
  const jsonBody=JSON.stringify(body);
  const url=new URL(`${apiBase()}/${method}`);
  const result=await new Promise((resolve,reject)=>{
    const req=https.request({
      protocol:url.protocol,
      hostname:url.hostname,
      port:url.port||443,
      path:url.pathname+url.search,
      method:'POST',
      headers:{
        'content-type':'application/json',
        'content-length':Buffer.byteLength(jsonBody),
        'user-agent':'inzhener-s-nulya/1.0'
      },
      timeout:15000,
      ca:TBANK_CA,
      rejectUnauthorized:true
    },res=>{
      let raw='';
      res.setEncoding('utf8');
      res.on('data',chunk=>raw+=chunk);
      res.on('end',()=>resolve({status:res.statusCode||0,raw}));
    });
    req.on('timeout',()=>req.destroy(Object.assign(new Error('tbank_connect_timeout'),{code:'ETIMEDOUT'})));
    req.on('error',err=>{
      const e=new Error('tbank_transport_error');
      e.transportCode=String(err?.code||'');
      e.transportMessage=String(err?.message||'');
      reject(e);
    });
    req.write(jsonBody);
    req.end();
  });
  const data=(()=>{try{return JSON.parse(result.raw||'{}')}catch{return{}}})();
  if(result.status<200||result.status>=300){
    const e=new Error('tbank_http_error');
    e.httpStatus=String(result.status||'');
    e.providerCode=String(data?.ErrorCode||'');
    e.providerMessage=String(data?.Message||'');
    e.providerDetails=String(data?.Details||'');
    throw e;
  }
  return data;
}

function normalizeReceiptPhone(value){
  const digits=String(value||'').replace(/\\D/g,'');
  if(digits.length===11&&digits.startsWith('8'))return '+7'+digits.slice(1);
  if(digits.length===11&&digits.startsWith('7'))return '+'+digits;
  return digits?'+'+digits:'';
}

function buildReceipt({amount,title,contact}){
  const taxation=String(process.env.TBANK_RECEIPT_TAXATION||'').trim();
  const tax=String(process.env.TBANK_RECEIPT_TAX||'').trim();
  if(!taxation||!tax)return null;
  const kopecks=Math.round(Number(amount)*100);
  const item={
    Name:String(title||'Цифровой материал').slice(0,128),
    Price:kopecks,
    Quantity:1,
    Amount:kopecks,
    Tax:tax,
    PaymentMethod:String(process.env.TBANK_RECEIPT_PAYMENT_METHOD||'full_payment').trim()||'full_payment',
    PaymentObject:String(process.env.TBANK_RECEIPT_PAYMENT_OBJECT||'another').trim()||'another'
  };
  const receipt={Taxation:taxation,Items:[item]};
  const contactValue=String(contact||'').trim();
  if(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(contactValue))receipt.Email=contactValue;
  else{
    const phone=normalizeReceiptPhone(contactValue);
    if(phone)receipt.Phone=phone;
  }
  return receipt;
}

export async function initTbankPayment({orderId,amount,title,site,orderPage,contact}){
  const{terminalKey}=requireTbankCredentials();
  const payload={
    TerminalKey:terminalKey,
    Amount:Math.round(Number(amount)*100),
    OrderId:String(orderId),
    Description:String(title||'').slice(0,140),
    Language:'ru',
    SuccessURL:`${orderPage}&result=success`,
    FailURL:`${orderPage}&result=error`
  };
  const receipt=buildReceipt({amount,title,contact});
  if(receipt)payload.Receipt=receipt;
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


export async function tbankCall(method,payload){
  return post(String(method),payload||{});
}

export function safeTbankState(data,product,orderId){
  if(!data||data.Success===false)return{state:'not_found'};
  if(orderId&&data.OrderId&&String(data.OrderId)!==String(orderId))return{state:'mismatch'};
  const expected=Math.round(Number(product.price)*100);
  if(data.Amount!==undefined&&Number(data.Amount)!==expected)return{state:'mismatch'};
  const status=String(data.Status||'').toUpperCase();
  if(status==='CONFIRMED')return{state:'paid',paymentStatus:status,paymentId:String(data.PaymentId||'')};
  if(['REJECTED','CANCELED','REVERSED','PARTIAL_REVERSED','REFUNDED','PARTIAL_REFUNDED'].includes(status))return{state:'failed',paymentStatus:status};
  return{state:'pending',paymentStatus:status||'NEW',paymentId:String(data.PaymentId||'')};
}
