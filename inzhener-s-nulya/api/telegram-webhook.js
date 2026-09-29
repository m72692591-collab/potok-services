import{baseUrl,json,readJson}from'./_shared.js';
import{choices,normalChoice,welcomeText}from'./_funnel-content.js';

function secretOk(req){
  const expected=String(process.env.TELEGRAM_WEBHOOK_SECRET||'');
  if(!expected)return true;
  return String(req.headers['x-telegram-bot-api-secret-token']||'')===expected;
}
function safeSource(value){
  return String(value||'organic').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,36)||'organic';
}
function startSource(text){
  const m=String(text||'').trim().match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([A-Za-z0-9_-]{1,64}))?/);
  return safeSource(m?.[1]||'organic');
}
async function tg(method,body){
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
  if(!token)throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.ok===false)throw new Error('telegram_api_failed');
  return d;
}
function welcomeMarkup(src){
  return{inline_keyboard:[
    [{text:'AutoCAD',callback_data:`f:autocad:${src}`},{text:'Primavera P6',callback_data:`f:primavera:${src}`}],
    [{text:'Хочу оба',callback_data:`f:both:${src}`}]
  ]};
}
function lessonMarkup(kind,site,src){
  const q=encodeURIComponent(`tg_${src}`);
  return{inline_keyboard:[
    [{text:'Я выполнил задачу',callback_data:`done:${kind}:${src}`}],
    [{text:'Открыть бесплатный набор на сайте',url:`${site}/free.html?src=${q}`}]
  ]};
}
function courseMarkup(site,src){
  const q=encodeURIComponent(`tg_${src}`);
  return{inline_keyboard:[[{text:'Посмотреть курсы',url:`${site}/?src=${q}#courses`}]]};
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
      const parts=String(cb.data||'').split(':');
      const action=parts[0];
      const kind=normalChoice(parts[1]);
      const src=safeSource(parts[2]);
      const chatId=cb.message?.chat?.id||cb.from?.id;
      if(action==='f'&&kind){
        console.log('telegram_funnel_choice',kind,src);
        await tg('sendMessage',{chat_id:chatId,text:choices[kind].text,reply_markup:lessonMarkup(kind,site,src)});
      }else if(action==='done'&&kind){
        console.log('telegram_funnel_done',kind,src);
        await tg('sendMessage',{chat_id:chatId,text:choices[kind].done,reply_markup:courseMarkup(site,src)});
      }
      return json(res,200,{ok:true});
    }
    const msg=u.message;
    if(msg?.chat?.id){
      const src=startSource(msg.text);
      if(String(msg.text||'').startsWith('/start'))console.log('telegram_funnel_start',src);
      await tg('sendMessage',{chat_id:msg.chat.id,text:welcomeText,reply_markup:welcomeMarkup(src)});
    }
    return json(res,200,{ok:true});
  }catch(e){
    console.error('telegram_webhook_failed',String(e?.message||e));
    return json(res,200,{ok:true});
  }
}
