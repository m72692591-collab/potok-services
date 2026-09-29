import{baseUrl,json,readJson}from'./_shared.js';
import{choices,normalChoice,welcomeText}from'./_funnel-content.js';

function secretOk(req){
  const expected=String(process.env.TELEGRAM_WEBHOOK_SECRET||'');
  if(!expected)return true;
  return String(req.headers['x-telegram-bot-api-secret-token']||'')===expected;
}
async function tg(method,body){
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.ok===false)throw new Error('telegram_api_failed');
  return d;
}
function welcomeMarkup(){
  return{inline_keyboard:[
    [{text:'AutoCAD',callback_data:'f:autocad'},{text:'Primavera P6',callback_data:'f:primavera'}],
    [{text:'Хочу оба',callback_data:'f:both'}]
  ]};
}
function doneMarkup(kind,site){
  return{inline_keyboard:[
    [{text:'Я выполнил задачу',callback_data:`done:${kind}`}],
    [{text:'Открыть бесплатный набор на сайте',url:`${site}/free.html?src=telegram_bot`}]
  ]};
}
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(!secretOk(req))return json(res,403,{error:'forbidden'});
  try{
    const u=await readJson(req);
    const site=baseUrl(req);
    const cb=u.callback_query;
    if(cb){
      await tg('answerCallbackQuery',{callback_query_id:cb.id});
      const data=String(cb.data||'');
      const chatId=cb.message?.chat?.id||cb.from?.id;
      if(data.startsWith('f:')){
        const kind=normalChoice(data.slice(2));
        if(kind)await tg('sendMessage',{chat_id:chatId,text:choices[kind].text,reply_markup:doneMarkup(kind,site)});
      }else if(data.startsWith('done:')){
        const kind=normalChoice(data.slice(5));
        if(kind)await tg('sendMessage',{chat_id:chatId,text:choices[kind].done,reply_markup:{inline_keyboard:[[{text:'Посмотреть курсы',url:`${site}/#courses`}]]}});
      }
      return json(res,200,{ok:true});
    }
    const msg=u.message;
    if(msg?.chat?.id){
      await tg('sendMessage',{chat_id:msg.chat.id,text:welcomeText,reply_markup:welcomeMarkup()});
    }
    return json(res,200,{ok:true});
  }catch(e){
    console.error('telegram_webhook_failed',String(e?.message||e));
    return json(res,200,{ok:true});
  }
}
