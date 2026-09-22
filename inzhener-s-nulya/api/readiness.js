import{json,envName}from'./_shared.js';

export default function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  const provider=(process.env.PAYMENT_PROVIDER||'yandex').toLowerCase();
  const yandexReady=envName()==='production'&&Boolean(process.env.YANDEX_PAY_API_KEY)&&Boolean(process.env.YANDEX_PAY_MERCHANT_ID);
  const tbankReady=provider==='tbank'&&Boolean(process.env.TBANK_TERMINAL_KEY)&&Boolean(process.env.TBANK_PASSWORD);
  const checks={
    paymentProvider:provider,
    environment:tbankReady?'production':envName(),
    paymentCredentialsConfigured:provider==='tbank'?tbankReady:yandexReady,
    orderSecretConfigured:Boolean(process.env.ORDER_HMAC_SECRET&&process.env.ORDER_HMAC_SECRET.length>=32),
    blobConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN||(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN)),
    legalNameConfigured:Boolean(process.env.BUSINESS_LEGAL_NAME),
    innConfigured:Boolean(process.env.BUSINESS_INN),
    ogrnConfigured:Boolean(process.env.BUSINESS_OGRN),
    emailConfigured:Boolean(process.env.BUSINESS_CONTACT_EMAIL),
    phoneConfigured:Boolean(process.env.BUSINESS_CONTACT_PHONE),
    addressConfigured:Boolean(process.env.BUSINESS_ADDRESS),
    tbankCallbackUrl:'/api/tbank-webhook',
    yandexCallbackUrl:'/v1/webhook'
  };
  checks.launchReady=checks.paymentCredentialsConfigured&&checks.orderSecretConfigured&&checks.blobConfigured&&checks.legalNameConfigured&&checks.innConfigured&&checks.ogrnConfigured&&checks.emailConfigured&&checks.phoneConfigured&&checks.addressConfigured;
  return json(res,200,checks);
}