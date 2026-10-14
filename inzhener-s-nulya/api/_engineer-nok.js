// NOK PRO staging adapter. Price proposals only; checkout and paid access are deliberately disabled
// until the answer bank passes normative editorial review and server-side license checks.
export const NOK_PRO_PRODUCTS=Object.freeze({
  nok_nostroy:{title:'НОСТРОЙ — строительство, 7 уровень',price:990,days:60},
  nok_nopriz_design:{title:'НОПРИЗ — проектирование, 7 уровень',price:990,days:60},
  nok_nopriz_survey:{title:'НОПРИЗ — инженерные изыскания, 7 уровень',price:990,days:60},
  nok_all:{title:'Все три направления НОК PRO',price:1990,days:90}
});
const trigger=new Map([
  ['/nok','menu'],['🧠 Тренажёр НОК','menu'],
  ['/nostroy','nostroy'],['🏗 НОСТРОЙ','nostroy'],
  ['/nopriz','design'],['📐 НОПРИЗ · проектирование','design'],
  ['/nopriz_survey','survey'],['🌍 НОПРИЗ · изыскания','survey']
]);
const keyboard=rows=>[{type:'inline_keyboard',payload:{buttons:rows.map(x=>[{type:'message',text:x}])}}];
export function engineerNokReply(update,env=process.env){
  if(update?.update_type!=='message_created')return null;
  const m=update?.message||{};
  const userId=Number(m?.sender?.user_id);
  if(m?.sender?.is_bot===true||m?.recipient?.chat_type!=='dialog'||!Number.isSafeInteger(userId)||userId<=0)return null;
  const command=trigger.get(String(m?.body?.text||'').trim());
  if(!command)return null;
  const common='Авторский учебный тренажёр для самостоятельной подготовки к НОК.\nТеория, повторение ошибок, практические задания, тренировка защиты портфолио.\n\nЭто не официальный экзамен НОСТРОЙ/НОПРИЗ. Полная база проходит методическую проверку.';
  if(command==='menu')return{userId,text:'🧠 НОК PRO — подготовка к квалификации\n\n'+common+'\n\nВыберите направление:',attachments:keyboard(['🏗 НОСТРОЙ','📐 НОПРИЗ · проектирование','🌍 НОПРИЗ · изыскания'])};
  const sku=command==='nostroy'?'nok_nostroy':command==='design'?'nok_nopriz_design':'nok_nopriz_survey';
  const p=NOK_PRO_PRODUCTS[sku];
  const rows=[[{type:'message',text:'🧠 Тренажёр НОК'}]];
  const url=String(env.NOK_PUBLIC_DEMO_URL||'').trim();
  if(url){try{const u=new URL(url);if(u.protocol==='https:')rows.unshift([{type:'link',text:'Посмотреть бесплатное демо',url:u.toString()}]);}catch{}}
  return{userId,text:p.title+'\n\nПланируемая цена: '+p.price.toLocaleString('ru-RU')+' ₽ / '+p.days+' дней.\n\n'+common+'\n\nПродажа и платный доступ пока не включены: сперва проверим нормативную точность материалов.',attachments:[{type:'inline_keyboard',payload:{buttons:rows}}]};
}
