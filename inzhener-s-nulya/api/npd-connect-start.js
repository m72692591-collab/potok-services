import{json,readJson}from'./_shared.js';
import{npdAdminAuthorized,startNpdSms}from'./_npd.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  try{
    const b=await readJson(req);
    if(!npdAdminAuthorized(b.token))return json(res,403,{error:'forbidden'});
    const r=await startNpdSms(b.phone);
    return json(res,200,r);
  }catch(e){
    console.error('npd_connect_start_failed',String(e?.message||e));
    const m=String(e?.message||e);
    return json(res,m==='npd_already_connected'?409:400,{error:m});
  }
}