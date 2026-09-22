import crypto from 'node:crypto';
import{CATALOG,baseUrl,json,readJson,requirePayKey,signOrder,validateContact,yandexApiBase}from'./_shared.js';
import{tbankCall}from'./_tbank.js';
import{saveTbankPayment}from'./_tbank-payments.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  try{
    const b=await readJson(req);
    const p=CATALOG[String(b.product||'').toLowerCase()];
    const contact=validateContact(b.contact);
    if(!p)return json(res,400,{error:'invalid_product'});
    if(!contact)return json(res,400,{error:'invalid_contact'});

    const provider=(process.env.PAYMENT_PROVIDER||'tbank').toLowerCase();
    const orderId=`IZN-${p.code.toUpperCase()}-${crypto.randomUUID()}`;
    const token=signOrder(orderId,p.code);
    const site=baseUrl(req);
    const orderPage=`${site}/order.html?orderId=${encodeURIComponent(orderId)}&product=${p.code}&token=${encodeURIComponent(token)}`;

    if(provider==='tbank'){
      const data={};
      if(contact.includes('@'))data.Email=contact;
      else data.Phone=contact.replace(/[()\s-]/g,'');

      const init=await tbankCall('Init',{
        Amount:Math.round(p.price*100),
        OrderId:orderId,
        Description:p.title.slice(0,140),
        PayType:'O',
        Language:'ru',
        NotificationURL:`${site}/api/tbank-webhook`,
        SuccessURL:`${orderPage}&result=success`,
        FailURL:`${orderPage}&result=error`,
        DATA:data
      });

      if(!init?.PaymentURL||!init?.PaymentId)throw new Error('tbank_init_invalid');
      await saveTbankPayment(orderId,{
        paymentId:String(init.PaymentId),
        amount:Math.round(p.price*100),
        product:p.code,
        status:String(init.Status||'NEW'),
        createdAt:Date.now()
      });
      return json(res,200,{paymentUrl:init.PaymentURL});
    }

    const item={productId:p.code,title:p.title,quantity:{count:'1'},unitPrice:p.price.toFixed(2),subtotal:p.price.toFixed(2),total:p.price.toFixed(2)};
    const tax=process.env.YANDEX_RECEIPT_TAX_CODE;
    if(tax&&/^\d+$/.test(tax))item.receipt={tax:Number(tax)};
    const payload={
      orderId,currencyCode:'RUB',orderSource:'WEBSITE',isPrepayment:false,fiscalContact:contact,purpose:p.title,ttl:1800,
      redirectUrls:{onSuccess:`${orderPage}&result=success`,onError:`${orderPage}&result=error`,onAbort:`${orderPage}&result=abort`},
      cart:{externalId:orderId,items:[item],total:{amount:p.price.toFixed(2)}}
    };
    const y=await fetch(`${yandexApiBase()}/orders`,{
      method:'POST',
      headers:{Authorization:`Api-Key ${requirePayKey()}`,'content-type':'application/json','X-Request-Id':orderId,'X-Request-Timeout':'15000','X-Request-Attempt':'0'},
      body:JSON.stringify(payload)
    });
    const d=await y.json().catch(()=>({}));
    if(!y.ok||d?.status!=='success'||!d?.data?.paymentUrl)return json(res,502,{error:'payment_provider_error'});
    return json(res,200,{paymentUrl:d.data.paymentUrl});
  }catch(e){
    console.error('create_payment_failed',String(e?.message||e),e?.details||'');
    const cfg=/TBANK_TERMINAL_KEY|TBANK_PASSWORD|YANDEX_PAY_API_KEY|ORDER_HMAC_SECRET/.test(String(e?.message||e));
    return json(res,cfg?503:500,{error:cfg?'not_configured':'server_error'});
  }
}
