import{baseUrl,json,readJson}from'./_shared.js';
import{choices,normalChoice,welcomeText}from'./_funnel-content.js';

const MAX_API='https://platform-api2.max.ru';

function secretOk(req){
  const expected=String(process.env.MAX_WEBHOOK_SECRET||'');
  if(!expected)return true;
  return String(req.headers['x-max-bot-api-secret']||'')===expected;
}
function token(){
  const t=String(process.env.MAX_BOT_TOKEN||'');
  if(!t)throw new Error('MAX_BOT_TOKEN is not configured');
  return t;
}
function keyboard(rows){
  return[{type:'inline_keyboard',payload:{buttons:rows}}];
}
function welcomeButtons(){
  return keyboard([
    [{type:'callback',text:'AutoCAD',payload:'f:autocad'},{type:'callback',text:'Primavera P6',payload:'f:primavera'}],
    [{type:'callback',text:'Хочу оба',payload:'f:both'}]
  ]);
}
function lessonButtons(kind,site){
  return keyboard([
    [{type:'callback',text:'Я выполнил задачу',payload:`done:${kind}`}],
    [{type:'link',text:'Бесплатный набор на сайте',url:`${site}/free.html?src=max_bot`}]
  ]);
}
async function api(path,{query={},body}={}){
  const qs=new URLSearchParams(Object.entries(query).filter(([,v])=>v!==undefined&&v!==null&&v!==''));
  const r=await fetch(`${MAX_API}${path}${qs.size?'?'+qs:''}`,{method:'POST',headers:{Authorization:token(),'content-type':'application/json'},body:JSON.stringify(body||{})});
  if(!r.ok)throw new Error(`max_api_${r.status}`);
  return r.json().catch(()=>({}));
}
async function send(update,text,attachments){
  const chatId=update.chat_id||update.message?.recipient?.chat_id||update.message?.recipient?.chatId;
  const userId=update.user?.user_id||update.callback?.user?.user_id||update.message?.sender?.user_id;
  const query=chatId?{chat_id:chatId}:{user_id:userId};
  if(!query.chat_id&&!query.user_id)throw new Error('max_recipient_missing');
  return api('/messages',{query,body:{text,attachments}});
}
async function ack(update){
  const id=update.callback?.callback_id;
  if(!id)return;
  try{await api('/answers',{query:{callback_id:id},body:{}})}catch{}
}
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(!secretOk(req))return json(res,403,{error:'forbidden'});
  try{
    const u=await readJson(req);
    const site=baseUrl(req);
    if(u.update_type==='bot_started'){
      await send(u,welcomeText,welcomeButtons());
    }else if(u.update_type==='message_callback'){
      const data=String(u.callback?.payload||'');
      await ack(u);
      if(data.startsWith('f:')){
        const kind=normalChoice(data.slice(2));
        if(kind)await send(u,choices[kind].text,lessonButtons(kind,site));
      }else if(data.startsWith('done:')){
        const kind=normalChoice(data.slice(5));
        if(kind)await send(u,choices[kind].done,keyboard([[{type:'link',text:'Посмотреть курсы',url:`${site}/#courses`}]]));
      }
    }else if(u.update_type==='message_created'){
      await send(u,welcomeText,welcomeButtons());
    }
    return json(res,200,{ok:true});
  }catch(e){
    console.error('max_webhook_failed',String(e?.message||e));
    return json(res,200,{ok:true});
  }
}
