import{json}from'./_shared.js';
import{engineerTelegramToken}from'./_engineer-telegram.js';

function safePublicUrl(value,allowedHosts){
  const raw=String(value||'').trim();
  if(!raw)return'';
  try{
    const u=new URL(raw);
    if(u.protocol!=='https:'||!allowedHosts.includes(u.hostname))return'';
    return u.toString();
  }catch{return''}
}

export default function handler(req,res){
  return json(res,200,{
    brand:'Инженер с нуля',
    legalName:process.env.BUSINESS_LEGAL_NAME||'ИП Григоров Михаил Владимирович',
    inn:process.env.BUSINESS_INN||'640100982708',
    ogrn:process.env.BUSINESS_OGRN||'326045700090104',
    email:process.env.BUSINESS_CONTACT_EMAIL||'grigorov555@mail.ru',
    phone:process.env.BUSINESS_CONTACT_PHONE||'8-969-621-34-70',
    address:process.env.BUSINESS_ADDRESS||'с. Александров Гай, ул. Дома Газовиков, д. 21',
    hours:process.env.BUSINESS_HOURS||'Ежедневно, 09:00–20:00 по московскому времени',
    telegramBotUrl:/^\d+:[A-Za-z0-9_-]{25,}$/.test(engineerTelegramToken())
      ?safePublicUrl(process.env.TELEGRAM_BOT_URL||'https://t.me/AnimaTactusGrowthBot',['t.me','telegram.me'])
      :'',
    maxBotUrl:safePublicUrl(process.env.MAX_BOT_URL,['max.ru']),
    yandexMetrikaId:/^\d{4,12}$/.test(String(process.env.YANDEX_METRIKA_ID||''))?String(process.env.YANDEX_METRIKA_ID):''
  });
}
