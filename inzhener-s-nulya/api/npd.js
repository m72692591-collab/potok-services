import{list,get}from'@vercel/blob';
import{blobAuth}from'./_blob-auth.js';
import{CATALOG,json,readJson}from'./_shared.js';
import{npdAdminAuthorized,npdSessionStatus,startNpdSms,verifyNpdSms}from'./_npd.js';

async function listOrders(){
  const result=await list({prefix:'_orders/tbank/',limit:100,...blobAuth()});
  const blobs=(result.blobs||[]).slice(-60);
  const rows=[];
  for(const b of blobs){
    try{
      const obj=await get(b.pathname,{access:'private',useCache:false,...blobAuth()});
      if(!obj||obj.statusCode!==200)continue;
      const r=JSON.parse(await new Response(obj.stream).text());
      const p=CATALOG[String(r.product||'')];
      if(!p||p.controlOnly)continue;
      const status=String(r.status||'').toUpperCase();
      if(status!=='CONFIRMED'&&!['REFUNDED','REVERSED','PARTIAL_REFUNDED','PARTIAL_REVERSED'].includes(status))continue;
      rows.push({
        orderId:String(r.orderId||''),
        product:p.code,
        title:p.title,
        amount:p.price,
        buyerContact:String(r.buyerContact||''),
        buyerType:String(r.buyerType||'individual'),
        paymentStatus:status,
        confirmedAt:Number(r.confirmedAt||r.updatedAt||r.createdAt||0),
        receiptStatus:String(r.npdReceiptStatus||'pending'),
        receiptUrl:String(r.npdReceiptUrl||''),
        receiptIssuedAt:Number(r.npdReceiptIssuedAt||0),
        receiptCancelledAt:Number(r.npdReceiptCancelledAt||0),
        receiptError:String(r.npdReceiptError||'')
      });
    }catch{}
  }
  rows.sort((a,b)=>b.confirmedAt-a.confirmedAt);
  return rows;
}

export default async function handler(req,res){
  try{
    if(req.method==='GET'){
      const token=String(req.query.token||'');
      if(!npdAdminAuthorized(token))return json(res,403,{error:'forbidden'});
      const action=String(req.query.action||'status');
      if(action==='status'){
        const s=await npdSessionStatus();
        return json(res,200,{connected:Boolean(s.connected),inn:s.connected?String(s.inn):'',connectedAt:Number(s.connectedAt||0)});
      }
      if(action==='orders'){
        const s=await npdSessionStatus();
        const orders=await listOrders();
        return json(res,200,{connected:Boolean(s.connected),taxMode:'NPD',orders});
      }
      return json(res,400,{error:'invalid_action'});
    }

    if(req.method==='POST'){
      const b=await readJson(req);
      if(!npdAdminAuthorized(b.token))return json(res,403,{error:'forbidden'});
      const action=String(b.action||'');
      if(action==='start'){
        const r=await startNpdSms(b.phone);
        return json(res,200,r);
      }
      if(action==='verify'){
        const r=await verifyNpdSms(b.code);
        return json(res,200,r);
      }
      return json(res,400,{error:'invalid_action'});
    }

    return json(res,405,{error:'method_not_allowed'});
  }catch(e){
    console.error('npd_admin_api_failed',String(e?.message||e),e?.status||'',e?.details||'');
    const m=String(e?.message||e);
    const code=m==='npd_already_connected'?409:400;
    return json(res,code,{error:m,detail:String(e?.details||'').slice(0,300)});
  }
}
