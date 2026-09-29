import{json,readJson}from'./_shared.js';
import{engineerSupportAnswer}from'./_engineer-support.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  try{
    const body=await readJson(req);
    const question=String(body?.question||'').trim().slice(0,1200);
    const result=engineerSupportAnswer(question);
    return json(res,200,{
      ...result,
      freeUrl:'/free.html?src=support',
      coursesUrl:'/#courses'
    });
  }catch(e){
    console.error('engineer_support_failed',String(e?.message||e));
    return json(res,500,{error:'support_unavailable'});
  }
}
