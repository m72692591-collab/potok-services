import crypto from'node:crypto';
import{list}from'@vercel/blob';
import{CATALOG,baseUrl,json,envName}from'./_shared.js';
import{blobAuth}from'./_blob-auth.js';
import{tbankEnv}from'./_tbank.js';
import{npdSessionStatus}from'./_npd.js';
import{ensureEngineerTelegramWebhook}from'./_engineer-telegram.js';

function norm(s){
  return String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-zа-яё0-9]/giu,'');
}

async function productFilesStatus(){
  try{
    const {blobs}=await list({limit:100,...blobAuth()});
    const names=blobs.map(b=>String(b.pathname||''));
    const normalized=new Set(names.map(norm));
    const files={};
    for(const [code,p] of Object.entries(CATALOG)){
      if(p.controlOnly)continue;
      if(p.inlineDelivery){files[code]=true;continue}
      files[code]=names.includes(p.blobPath)||normalized.has(norm(p.blobPath));
    }
    return{ok:Object.values(files).every(Boolean),files};
  }catch(e){
    return{ok:false,files:{},error:'blob_check_failed'};
  }
}

async function telegramStatus(req){
  const status=await ensureEngineerTelegramWebhook(req);
  return{
    botUrl:'https://t.me/AnimaTactusGrowthBot',
    ...status
  };
}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  const provider=(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase();
  const yandexReady=envName()==='production'&&Boolean(process.env.YANDEX_PAY_API_KEY)&&Boolean(process.env.YANDEX_PAY_MERCHANT_ID);
  const terminalKey=String(process.env.TBANK_TERMINAL_KEY||'');
  const tbankPassword=String(process.env.TBANK_PASSWORD||'');
  const tbankReady=Boolean(terminalKey)&&Boolean(tbankPassword);
  const [npd,products,telegram]=await Promise.all([
    npdSessionStatus(),
    productFilesStatus(),
    telegramStatus(req)
  ]);
  const checks={
    paymentProvider:provider,
    environment:provider==='tbank'?tbankEnv():envName(),
    paymentCredentialsConfigured:provider==='tbank'?tbankReady:yandexReady,
    tbankTerminalMode:provider==='tbank'?( /DEMO/i.test(terminalKey)?'DEMO':'NON_DEMO'):'n/a',
    tbankTerminalKeyLength:provider==='tbank'?terminalKey.length:0,
    tbankPasswordLength:provider==='tbank'?tbankPassword.length:0,
    tbankApiMode:provider==='tbank'?( /DEMO/i.test(terminalKey)?'securepay-demo':(tbankEnv()==='production'?'securepay-production':'rest-api-test')):'n/a',
    orderSecretConfigured:Boolean(process.env.ORDER_HMAC_SECRET&&process.env.ORDER_HMAC_SECRET.length>=32),
    blobConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN||(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN)),
    productFilesReady:products.ok,
    productFiles:products.files,
    legalNameConfigured:true,
    innConfigured:true,
    ogrnConfigured:true,
    emailConfigured:true,
    phoneConfigured:true,
    addressConfigured:true,
    taxMode:'NPD',
    kktRequired:false,
    npdReceiptFlow:'automatic_unofficial_lknpd_api',
    npdConnected:Boolean(npd.connected),
    npdAutoReceiptReady:Boolean(npd.connected),
    controlPurchaseEnabled:String(process.env.CONTROL_PURCHASE_ENABLED||'').toLowerCase()==='true',
    controlPurchaseTokenConfigured:Boolean(process.env.CONTROL_PURCHASE_TOKEN),
    tbankCallbackUrl:'/api/tbank-webhook',
    yandexCallbackUrl:'/v1/webhook',
    telegram
  };
  checks.productionPaymentReady=provider==='tbank'
    ?(tbankReady&&checks.tbankTerminalMode==='NON_DEMO'&&tbankEnv()==='production')
    :yandexReady;
  checks.commerceReady=checks.productionPaymentReady
    &&checks.orderSecretConfigured
    &&checks.blobConfigured
    &&checks.productFilesReady
    &&checks.npdAutoReceiptReady;
  checks.telegramReady=telegram.tokenConfigured
    &&telegram.webhookSecretConfigured
    &&telegram.identityVerified
    &&telegram.webhookMatchesExpected;
  checks.launchReady=checks.commerceReady;
  checks.fullAutomationReady=checks.commerceReady&&checks.telegramReady;
  return json(res,200,checks);
}
