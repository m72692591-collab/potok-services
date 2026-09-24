import{get,list}from'@vercel/blob';
import{baseUrl,signOrder}from'./_shared.js';
import{blobAuth}from'./_blob-auth.js';

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.statusCode=405;res.end('Method Not Allowed');return;
  }
  if(String(process.env.TBANK_ENV||'').toLowerCase()==='production'){
    res.statusCode=404;res.end('Not Found');return;
  }
  try{
    const {blobs}=await list({prefix:'_orders/tbank/',limit:100,...blobAuth()});
    let latest=null;
    for(const b of blobs){
      try{
        const r=await get(b.pathname,{access:'private',useCache:false,...blobAuth()});
        if(!r||r.statusCode!==200)continue;
        const d=JSON.parse(await new Response(r.stream).text());
        if(!d?.orderId||!d?.product)continue;
        if(!latest||Number(d.updatedAt||0)>Number(latest.updatedAt||0))latest=d;
      }catch{}
    }
    if(!latest){
      res.statusCode=404;res.end('Test order not found');return;
    }
    const token=signOrder(String(latest.orderId),String(latest.product));
    const url=`${baseUrl(req)}/order.html?orderId=${encodeURIComponent(latest.orderId)}&product=${encodeURIComponent(latest.product)}&token=${encodeURIComponent(token)}&recovered=1`;
    res.statusCode=302;
    res.setHeader('Location',url);
    res.setHeader('Cache-Control','no-store');
    res.end();
  }catch(e){
    console.error('test_last_order_failed',String(e?.message||e));
    res.statusCode=500;res.end('Test order recovery failed');
  }
}
