import crypto from'node:crypto';
import coursePatch from './_engineer-course-patch-endpoint.js';
export const config={api:{bodyParser:false}};
import{put}from'@vercel/blob';
import{json,readJson}from'./_shared.js';
import{blobAuth}from'./_blob-auth.js';
import{engineerSupportAnswer}from'./_engineer-support.js';
import{engineerTelegramWebhook}from'./_engineer-telegram.js';
import{engineerMaxWebhook}from'./_engineer-max.js';

const EVENT_NAMES=new Set([
  'page_view','free_start_click','telegram_click','max_click','support_open',
  'support_question','checkout_open','payment_start','order_paid','download_start'
]);

function clean(value,max=160){
  return String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
}

async function recordEvent(req,res){
  try{
    const body=await readJson(req);
    const event=clean(body?.event,40);
    if(!EVENT_NAMES.has(event))return json(res,400,{error:'invalid_event'});
    const now=Date.now();
    const day=new Date(now).toISOString().slice(0,10);
    const payload={
      event,
      ts:now,
      path:clean(body?.path,180),
      source:clean(body?.source,120),
      product:clean(body?.product,40),
      referrer:clean(body?.referrer,180)
    };
    await put(`_analytics/${day}/${now}-${crypto.randomUUID()}.json`,JSON.stringify(payload),{
      access:'private',
      addRandomSuffix:false,
      contentType:'application/json',
      ...blobAuth()
    });
    return json(res,200,{ok:true});
  }catch(e){
    console.error('analytics_event_failed',String(e?.message||e));
    return json(res,200,{ok:false});
  }
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(req.query?.channel==='course-patch')return coursePatch(req,res);
  if(req.query?.channel==='telegram')return engineerTelegramWebhook(req,res);
  if(req.query?.channel==='max')return engineerMaxWebhook(req,res);
  if(req.query?.channel==='event')return recordEvent(req,res);
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
