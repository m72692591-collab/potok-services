import{json,envName}from'./_shared.js';

export default function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  const checks={
    environment:envName(),
    apiKeyConfigured:Boolean(process.env.YANDEX_PAY_API_KEY),
    merchantIdConfigured:Boolean(process.env.YANDEX_PAY_MERCHANT_ID),
    orderSecretConfigured:Boolean(process.env.ORDER_HMAC_SECRET&&process.env.ORDER_HMAC_SECRET.length>=32),
    blobConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN||(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN)),
    legalNameConfigured:Boolean(process.env.BUSINESS_LEGAL_NAME),
    innConfigured:Boolean(process.env.BUSINESS_INN),
    contactConfigured:Boolean(process.env.BUSINESS_CONTACT_EMAIL||process.env.BUSINESS_CONTACT_PHONE),
    callbackUrl:'/v1/webhook'
  };
  checks.launchReady=checks.environment==='production'&&checks.apiKeyConfigured&&checks.merchantIdConfigured&&checks.orderSecretConfigured&&checks.blobConfigured&&checks.legalNameConfigured&&checks.innConfigured&&checks.contactConfigured;
  return json(res,200,checks);
}
