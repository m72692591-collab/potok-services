import{json,readJson}from'./_shared.js';
import{npdAdminAuthorized,verifyNpdSms}from'./_npd.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  try{
    const b=await readJson(req);
    if(!npdAdminAuthorized(b.token))return json(res,403,{error:'forbidden'});
    const r=await verifyNpdSms(b.code);
    return json(res,200,r);
  }catch(e){
    console.error('npd_connect_verify_failed',String(e?.message||e),e?.status||'',e?.details||'');
    return json(res,400,{error:String(e?.message||e),detail:String(e?.details||'').slice(0,300)});
  }
}