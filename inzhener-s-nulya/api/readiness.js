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
    receiptTaxationConfigured:Boolean(process.env.TBANK_RECEIPT_TAXATION),
    receiptTaxConfigured:Boolean(process.env.TBANK_RECEIPT_TAX),
    receiptPaymentObjectConfigured:Boolean(process.env.TBANK_RECEIPT_PAYMENT_OBJECT),
    controlPurchaseEnabled:String(process.env.CONTROL_PURCHASE_ENABLED||'').toLowerCase()==='true',
    controlPurchaseTokenConfigured:Boolean(process.env.CONTROL_PURCHASE_TOKEN),
    tbankCallbackUrl:'/api/tbank-webhook',
    yandexCallbackUrl:'/v1/webhook'
  };
  checks.productionPaymentReady=provider==='tbank'
    ?(tbankReady&&checks.tbankTerminalMode==='NON_DEMO'&&tbankEnv()==='production')
    :yandexReady;
  checks.launchReady=checks.productionPaymentReady&&checks.orderSecretConfigured&&checks.blobConfigured;
  return json(res,200,checks);
}
