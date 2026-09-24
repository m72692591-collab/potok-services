import{json,envName}from'./_shared.js';
import{tbankEnv}from'./_tbank.js';

export default function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  const provider=(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase();
  const yandexReady=envName()==='production'&&Boolean(process.env.YANDEX_PAY_API_KEY)&&Boolean(process.env.YANDEX_PAY_MERCHANT_ID);
  const terminalKey=String(process.env.TBANK_TERMINAL_KEY||'');
  const tbankPassword=String(process.env.TBANK_PASSWORD||'');
  const tbankReady=Boolean(terminalKey)&&Boolean(tbankPassword);
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
    legalNameConfigured:true,
    innConfigured:true,
    ogrnConfigured:true,
    emailConfigured:true,
    phoneConfigured:true,
    addressConfigured:true,
    tbankCallbackUrl:'/api/tbank-webhook',
    yandexCallbackUrl:'/v1/webhook'
  };
  checks.launchReady=checks.paymentCredentialsConfigured&&checks.orderSecretConfigured&&checks.blobConfigured;
  return json(res,200,checks);
}
