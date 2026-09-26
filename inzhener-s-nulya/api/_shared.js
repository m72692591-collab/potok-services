import crypto from 'node:crypto';
export const CATALOG={
autocad:{code:'autocad',title:'AutoCAD для стройки и исполнительной документации — 21 день, версия 2.0',price:1990,blobPath:'Инженер_с_нуля_AutoCAD_21_день_v2.0.zip'},
primavera:{code:'primavera',title:'Primavera P6 с нуля для строительства — 14 дней',price:2490,blobPath:'Инженер_с_нуля_Primavera_P6_14_дней_v1.0.zip'},
bundle:{code:'bundle',title:'Инженер с нуля: AutoCAD + Primavera P6',price:3490,blobPath:'Инженер_с_нуля_КОМПЛЕКТ_AutoCAD_Primavera.zip'},
control:{code:'control',title:'Контрольная покупка магазина',price:1,controlOnly:true}
};
export function json(res,status,body){res.status(status).setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body))}
export async function readJson(req){if(req.body&&typeof req.body==='object')return req.body;let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>64*1024)throw new Error('request_body_too_large')}return raw?JSON.parse(raw):{}}
export function baseUrl(req){const x=(process.env.APP_PUBLIC_URL||'').replace(/\/$/,'');if(x)return x;return `${req.headers['x-forwarded-proto']||'https'}://${req.headers['x-forwarded-host']||req.headers.host}`}
export function envName(){return process.env.YANDEX_PAY_ENV==='production'?'production':'sandbox'}
export function yandexApiBase(){return envName()==='production'?'https://pay.yandex.ru/api/merchant/v1':'https://sandbox.pay.yandex.ru/api/merchant/v1'}
export function yandexJwksUrl(){return envName()==='production'?'https://pay.yandex.ru/api/jwks':'https://sandbox.pay.yandex.ru/api/jwks'}
export function requirePayKey(){const k=process.env.YANDEX_PAY_API_KEY;if(!k)throw new Error('YANDEX_PAY_API_KEY is not configured');return k}
export function signOrder(id,p){const s=process.env.ORDER_HMAC_SECRET;if(!s||s.length<32)throw new Error('ORDER_HMAC_SECRET is not configured');return crypto.createHmac('sha256',s).update(`${id}.${p}`).digest('base64url')}
export function verifyOrderToken(id,p,t){if(!id||!p||!t)return false;const a=Buffer.from(signOrder(id,p)),b=Buffer.from(String(t));return a.length===b.length&&crypto.timingSafeEqual(a,b)}
export function validateContact(c){const v=String(c||'').trim();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||/^\+?[0-9()\-\s]{10,24}$/.test(v)?v:null}
export async function fetchYandexOrder(id){const r=await fetch(`${yandexApiBase()}/orders/${encodeURIComponent(id)}`,{headers:{Authorization:`Api-Key ${requirePayKey()}`,'X-Request-Id':crypto.randomUUID(),'X-Request-Timeout':'15000','X-Request-Attempt':'0'},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d?.status!=='success')throw new Error('lookup failed');return d.data?.order}
export function safeOrderState(o,p){if(!o)return{state:'not_found'};const amount=Number(o.orderAmount);if(!Number.isFinite(amount)||Math.abs(amount-p.price)>.001)return{state:'mismatch'};if(o.paymentStatus==='CAPTURED')return{state:'paid'};if(['FAILED','VOIDED','REFUNDED','PARTIALLY_REFUNDED'].includes(o.paymentStatus))return{state:'failed'};return{state:'pending',paymentStatus:o.paymentStatus||'PENDING'}}
