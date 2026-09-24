import crypto from'node:crypto';
import{CATALOG,baseUrl,json,readJson,requirePayKey,signOrder,validateContact,yandexApiBase}from'./_shared.js';
import{initTbankPayment}from'./_tbank.js';

function provider(){return String(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase()}

async function createYandex(p,contact,orderId,orderPage){
  const item={productId:p.code,title:p.title,quantity:{count:'1'},unitPrice:p.price.toFixed(2),subtotal:p.price.toFixed(2),total:p.price.toFixed(2)};
  const tax=process.env.YANDEX_RECEIPT_TAX_CODE;
  if(tax&&/^\d+$/.test(tax))item.receipt={tax:Number(tax)};
  const payload={orderId,currencyCode:'RUB',orderSource:'WEBSITE',isPrepayment:false,fiscalContact:contact,purpose:p.title,ttl:1800,redirectUrls:{onSuccess:`${orderPage}&result=success`,onError:`${orderPage}&result=error`,onAbort:`${orderPage}&result=abort`},cart:{externalId:orderId,items:[item],total:{amount:p.price.toFixed(2)}}};
  const r=await fetch(`${yandexApiBase()}/orders`,{method:'POST',headers:{Authorization:`Api-Key ${requirePayKey()}`,'content-type':'application/json','X-Request-Id':orderId,'X-Request-Timeout':'15000','X-Request-Attempt':'0'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d?.status!=='success'||!d?.data?.paymentUrl)throw new Error('yandex_init_failed');
  return d.data.paymentUrl;
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  try{
    const b=await readJson(req);
    const p=CATALOG[String(b.product||'').toLowerCase()];
    const contact=validateContact(b.contact);
    if(!p)return json(res,400,{error:'invalid_product'});
    if(!contact)return json(res,400,{error:'invalid_contact'});

    const orderId=`IZN-${p.code.toUpperCase()}-${crypto.randomUUID()}`;
    const token=signOrder(orderId,p.code);
    const site=baseUrl(req);
    const orderPage=`${site}/order.html?orderId=${encodeURIComponent(orderId)}&product=${p.code}&token=${encodeURIComponent(token)}`;

    let paymentUrl;
    if(provider()==='tbank'){
      paymentUrl=(await initTbankPayment({orderId,amount:p.price,title:p.title,site,orderPage,contact})).paymentUrl;
    }else{
      paymentUrl=await createYandex(p,contact,orderId,orderPage);
    }
    return json(res,200,{paymentUrl});
  }catch(e){
    console.error('create_payment_failed',String(e?.message||e),e?.providerCode||'',e?.providerMessage||'',e?.providerDetails||'');
    const cfg=/TBANK_TERMINAL_KEY|TBANK_PASSWORD|YANDEX_PAY_API_KEY|ORDER_HMAC_SECRET/.test(String(e?.message||e));
    const body={error:cfg?'not_configured':'payment_provider_error'};
    if(provider()==='tbank'&&!cfg){
      body.providerCode=String(e?.providerCode||'');
      body.providerHttpStatus=String(e?.httpStatus||'');
      body.detail=[e?.providerMessage,e?.providerDetails].filter(Boolean).join(' — ').slice(0,300);
      if(String(process.env.TBANK_ENV||'').toLowerCase()!=='production'){
        body.debug=String(e?.message||'unknown').slice(0,120);
        body.transportCode=String(e?.transportCode||'');
        body.transportMessage=String(e?.transportMessage||'').slice(0,160);
      }
    }
    return json(res,cfg?503:500,body);
  }
}
