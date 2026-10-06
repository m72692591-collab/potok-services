import { engineerMaxFetch } from './_engineer-max-http.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { engineerSupportAnswer } from './_engineer-support.js';
import { CATALOG, json, readJson } from './_shared.js';

const API='https://platform-api2.max.ru';
const SITE='https://inzhener-s-nulya.vercel.app';

export function engineerMaxToken(env=process.env){
  return String(env.ENGINEER_MAX_BOT_TOKEN||env.MAX_BOT_TOKEN||'').trim();
}

function derivedSecret(env=process.env){
  const base=String(env.ORDER_HMAC_SECRET||'');
  if(base.length<32)return'';
  return createHmac('sha256',base).update('max-webhook:engineer-from-zero').digest('base64url');
}

export function engineerMaxSecret(env=process.env){
  const explicit=String(env.ENGINEER_MAX_WEBHOOK_SECRET||env.MAX_WEBHOOK_SECRET||'').trim();
  if(/^[A-Za-z0-9_-]{5,256}$/.test(explicit))return explicit;
  return derivedSecret(env);
}

export function engineerMaxWebhookUrl(req){
  const proto=req.headers?.['x-forwarded-proto']||'https';
  const host=req.headers?.['x-forwarded-host']||req.headers?.host||'inzhener-s-nulya.vercel.app';
  return proto+'://'+host+'/api/engineer-support?channel=max';
}

function auth(token){return{Authorization:token,'content-type':'application/json'}}

export async function ensureEngineerMaxWebhook(req,{env=process.env,fetchImpl=engineerMaxFetch}={}){
  const token=engineerMaxToken(env);
  const secret=engineerMaxSecret(env);
  const expected=engineerMaxWebhookUrl(req);
  const out={tokenConfigured:Boolean(token),webhookSecretConfigured:/^[A-Za-z0-9_-]{5,256}$/.test(secret),identityVerified:false,username:'',botUrl:'',profileDescriptionConfigured:false,profileAvatarConfigured:false,commandsConfigured:false,commandsAutoConfigured:false,webhookConfigured:false,webhookMatchesExpected:false,autoConfigured:false,diagnostic:{stage:'configuration',httpStatus:null,errorCode:null}};
  if(!out.tokenConfigured||!out.webhookSecretConfigured)return out;
  try{
    out.diagnostic.stage='identity';
    const meRes=await fetchImpl(API+'/me',{headers:{Authorization:token},signal:AbortSignal.timeout(8000)});
    const me=await meRes.json().catch(()=>({}));
    out.diagnostic.httpStatus=meRes.status;
    out.identityVerified=Boolean(meRes.ok&&me?.is_bot===true&&Number.isFinite(Number(me?.user_id)));
    if(!out.identityVerified)return out;
    out.username=String(me?.username||'');
    const expectedUsername=String(env.MAX_BOT_URL||'https://max.ru/se13638142_1_bot').split('/').pop()?.split('?')[0];
    if(out.username!==expectedUsername){out.identityVerified=false;out.diagnostic.errorCode='BOT_IDENTITY_MISMATCH';return out;}
    if(out.username)out.botUrl='https://max.ru/'+out.username;
    out.profileDescriptionConfigured=Boolean(String(me?.description||'').trim());
    out.profileAvatarConfigured=Boolean(String(me?.avatar_url||me?.full_avatar_url||'').trim());

    const desiredCommands=[
      {name:'start',description:'Начать'},
      {name:'free',description:'Бесплатный старт'},
      {name:'courses',description:'Курсы и цены'},
      {name:'support',description:'Задать вопрос'}
    ];
    const currentCommands=Array.isArray(me?.commands)?me.commands.map(x=>({
      name:String(x?.name||''),description:String(x?.description||'')
    })):[];
    out.commandsConfigured=JSON.stringify(currentCommands)===JSON.stringify(desiredCommands);
    if(!out.commandsConfigured){
      const cmdRes=await fetchImpl(API+'/me/commands',{
        method:'PATCH',headers:auth(token),
        body:JSON.stringify({commands:desiredCommands}),
        signal:AbortSignal.timeout(8000)
      });
      if(cmdRes.ok){
        out.commandsConfigured=true;
        out.commandsAutoConfigured=true;
      }
    }

    out.diagnostic.stage='subscriptions';
    const subsRes=await fetchImpl(API+'/subscriptions',{headers:{Authorization:token},signal:AbortSignal.timeout(8000)});
    const subs=await subsRes.json().catch(()=>[]);
    const list=Array.isArray(subs)?subs:(Array.isArray(subs?.subscriptions)?subs.subscriptions:[]);
    out.webhookConfigured=list.some(x=>String(x?.url||''));
    out.webhookMatchesExpected=list.some(x=>String(x?.url||'')===expected);

    if(!out.webhookMatchesExpected){
      const setRes=await fetchImpl(API+'/subscriptions',{
        method:'POST',headers:auth(token),
        body:JSON.stringify({url:expected,update_types:['bot_started','message_created'],secret}),
        signal:AbortSignal.timeout(8000)
      });
      const set=await setRes.json().catch(()=>({}));
      if(setRes.ok&&set?.success===true){
        out.autoConfigured=true;out.webhookConfigured=true;out.webhookMatchesExpected=true;
      }
    }
    out.diagnostic.stage='complete';
    return out;
  }catch(error){
    const code=String(error?.cause?.code||error?.code||error?.name||'unknown');
    out.diagnostic.errorCode=/^[A-Za-z0-9_]{1,80}$/.test(code)?code:'request_failed';
    return out;
  }
}

function cleanSource(raw){
  const v=String(raw||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,80);
  return v||'max';
}

function buyUrl(product,source){
  const q=new URLSearchParams({buy:product,src:'max_'+cleanSource(source)});
  return SITE+'/?'+q.toString()+'#courses';
}

function keyboard(source){
  const freeUrl=SITE+'/free.html?src=max_'+encodeURIComponent(cleanSource(source));
  return [{type:'inline_keyboard',payload:{buttons:[
    [{type:'link',text:'🎁 Бесплатные задания — начать',url:freeUrl}],
    [{type:'link',text:'⚡ Первый рабочий день — 490 ₽',url:buyUrl('starter',source)}],
    [{type:'link',text:'📐 AutoCAD · 21 день · 1 990 ₽',url:buyUrl('autocad',source)}],
    [{type:'link',text:'📅 Primavera · 14 дней · 2 490 ₽',url:buyUrl('primavera',source)}],
    [{type:'link',text:'📦 AutoCAD + Primavera · 3 490 ₽',url:buyUrl('bundle',source)}]
  ]}}];
}

function courseMenu(){
  return '👷 ИНЖЕНЕР С НУЛЯ\nAutoCAD и Primavera P6 по рабочим задачам строительства.\n\n🎁 Начните бесплатно\nПопробуйте задания по чертежам и календарному графику. Кнопка ниже открывает бесплатные материалы; команда /free показывает задание прямо здесь.\n\n⚡ Первый рабочий день инженера — 490 ₽\nКороткий практикум: попробуйте формат перед полным курсом.\n\n📐 AutoCAD — 21 день · 1 990 ₽\nДля стройки и исполнительной документации.\n\n📅 Primavera P6 — 14 дней · 2 490 ₽\nС нуля: структура проекта, задачи и календарный график.\n\n📦 AutoCAD + Primavera P6 — 3 490 ₽\nОба курса в одном комплекте.\n\nВыберите материалы ниже. Покупка открывается на сайте; после оплаты цифровой товар выдаётся автоматически.\n\n💬 Не знаете, с чего начать? Напишите вопрос — помогу выбрать.';
}

export function engineerMaxReply(update){
  const type=String(update?.update_type||'');
  let userId=null,text='',source='max';

  if(type==='bot_started'){
    userId=Number(update?.user?.user_id);
    source=cleanSource(update?.payload||'max');
    text=courseMenu();
  }else if(type==='message_created'){
    const m=update?.message;
    userId=Number(m?.sender?.user_id);
    if(m?.sender?.is_bot===true)return null;
    const input=String(m?.body?.text||'').trim().slice(0,1200);
    if(!input)return null;
    const cmd=input.split(/\s+/,1)[0].toLowerCase();
    if(cmd==='/start'||cmd==='/courses'){
      text=courseMenu();
    }else if(cmd==='/free'){
      text='Бесплатный старт:\n\nAutoCAD: измерьте известный размер командой DIST, проверьте слой объекта и поставьте контрольный размер DIM.\n\nPrimavera P6: создайте Project, WBS из 3 блоков и 3 Activities, задайте длительности и свяжите их FS.\n\nЕсли получилось — переходите к практикуму 490 ₽ или полному курсу.';
    }else if(cmd==='/support'){
      text='Напишите вопрос обычным сообщением. Я отвечу по AutoCAD, Primavera P6, выбору курса, оплате и доступу.';
    }else{
      text=engineerSupportAnswer(input).answer;
    }
  }else return null;

  if(!Number.isSafeInteger(userId)||userId<=0)return null;
  return{userId,text,attachments:keyboard(source)};
}

export async function engineerMaxWebhook(req,res,{env=process.env,fetchImpl=engineerMaxFetch}={}){
  const secret=engineerMaxSecret(env);
  const supplied=req.headers?.['x-max-bot-api-secret'];
  if(!/^[A-Za-z0-9_-]{5,256}$/.test(secret)||typeof supplied!=='string')return json(res,403,{error:'forbidden'});
  const a=Buffer.from(secret),b=Buffer.from(supplied);
  if(a.length!==b.length||!timingSafeEqual(a,b))return json(res,403,{error:'forbidden'});
  const token=engineerMaxToken(env);
  if(!token)return json(res,503,{error:'max_not_configured'});

  let update;
  try{update=await readJson(req)}catch{return json(res,400,{error:'invalid_update'})}
  const reply=engineerMaxReply(update);
  if(!reply)return json(res,200,{ok:true});

  try{
    const u=new URL(API+'/messages');
    u.searchParams.set('user_id',String(reply.userId));
    const r=await fetchImpl(u.toString(),{
      method:'POST',headers:auth(token),
      body:JSON.stringify({text:reply.text,attachments:reply.attachments,disable_link_preview:true}),
      signal:AbortSignal.timeout(8000)
    });
    if(!r.ok){
      const body=await r.text().catch(()=>'');
      console.error('max_send_failed',r.status,body.slice(0,200));
      return json(res,502,{error:'max_send_failed'});
    }
    return json(res,200,{ok:true});
  }catch(e){
    console.error('max_webhook_failed',String(e?.message||e));
    return json(res,502,{error:'max_unavailable'});
  }
}
