import{json}from'./_shared.js';
import{npdAdminAuthorized,npdSessionStatus}from'./_npd.js';

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  if(!npdAdminAuthorized(req.query.token))return json(res,403,{error:'forbidden'});
  const s=await npdSessionStatus();
  return json(res,200,{connected:Boolean(s.connected),inn:s.connected?String(s.inn):'',connectedAt:Number(s.connectedAt||0)});
}