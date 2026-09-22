import{json,envName}from'./_shared.js';

export default function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  const provider=(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase();
  const tbankEnv=(process.env.TBANK_ENV||'test').toLowerCase()==='production'?'production':'test';

  const yandexCredentials=Boolean(process.env.YANDEX_PAY_API_KEY)&&Boolean(process.env.YANDEX_PAY_MERCHANT_ID);
  const tbankCredentials=Boolean(process.env.TBANK_TERMINAL_KEY)&&Boolean(process.env.TBANK_PASSWORD);

  const checks={
    paymentProvider:provider,
    environment:provider==='tbank'?tbankEnv:envName(),
    paymentCredentialsConfigured:provider==='tbank'?tbankCredentials:yandexCredentials,
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

  checks.paymentReady=checks.paymentCredentialsConfigured&&checks.orderSecretConfigured&&checks.blobConfigured;
  checks.launchReady=checks.paymentReady&&checks.environment==='production';
  return json(res,200,checks);
}
