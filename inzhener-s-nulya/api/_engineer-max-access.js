const SITE='https://inzhener-s-nulya.vercel.app';
const BOT='se13638142_1_bot';
export function maxAccessInput(update){
 const message=update?.message;
 const userId=Number(update?.update_type==='bot_started'?update.user?.user_id:message?.sender?.user_id);
 if(!Number.isSafeInteger(userId)||userId<=0)return null;
 if(update?.update_type==='message_created'&&(message?.sender?.is_bot||message?.recipient?.chat_type!=='dialog'))return null;
 const input=String(update?.update_type==='bot_started'?update.payload:message?.body?.text||'').trim();
 const command=input.toLowerCase().replace(new RegExp('@'+BOT+'$','i'),'').replace(/\s+/g,' ');
 const isCheck=['access','/access','/start access','проверить оплату','получить архив','получить материалы','мои покупки','/purchases'].includes(command);
 let url;try{const u=new URL(input);if(u.origin===SITE&&u.pathname==='/order.html')url=u;}catch{}
 return isCheck||url?{userId,url}:null;
}
export async function engineerMaxAccess(update,{loadSession,findOrders,deliver,saveSession,record=async()=>{}}){
 const parsed=maxAccessInput(update);if(!parsed)return null;
 const {userId,url}=parsed;
 const reply=text=>({userId,text,attachments:[]});
 const health=async result=>{try{await record(result);}catch{}};
 let session;
 try{session=await loadSession(userId);}catch{await health({result:'error',stage:'session'});return reply('Не удалось прочитать историю покупок. Оплачивать повторно не нужно. Напишите /access ещё раз через минуту.');}
 let candidates=[];
 if(url)candidates=[{orderId:url.searchParams.get('orderId')}];
 else{
  try{candidates=await findOrders(userId);}catch{await health({result:'error',stage:'history'});}
  const remembered=[...(session?.paidOrderIds||[]),session?.lastOrderId].filter(Boolean);
  for(const orderId of remembered)if(!candidates.some(o=>o.orderId===orderId))candidates.push({orderId});
 }
 candidates=candidates.filter(o=>typeof o.orderId==='string'&&o.orderId).slice(0,20);
 if(!candidates.length){
  await health({result:'not_found',stage:'ownership'});
  return reply('В этом чате пока не найдена привязанная покупка. Если оплатили по старой ссылке, отправьте полную ссылку на страницу заказа обычным сообщением в этот чат MAX — бот проверит оплату и пришлёт архив. Повторно оплачивать не нужно.');
 }
 let pending=false,failed=false,accessRequired=false,delivered=[];
 for(const order of candidates){
  try{
   const result=await deliver(order.orderId,{userId,accessToken:url?.searchParams.get('token'),productCode:url?.searchParams.get('product'),force:!url});
   if(result.state==='paid'){delivered.push(order.orderId);break;}
   else if(result.state==='pending')pending=true;
   else failed=true;
  }catch(e){
   if(['order_access_required','order_owner_mismatch','order_not_found'].includes(e.message))accessRequired=true;
   else{
    await health({result:'error',stage:e.deliveryStage||'delivery'});
    return reply('Бот нашёл заказ, но не смог выдать файл сейчас. Повторно платить не нужно. '+(e.deliveryStage==='receipt'?'Не удалось завершить оформление чека. ':e.deliveryStage==='payment'?'Не удалось получить подтверждение от банка. ':'Возникла ошибка при подготовке или отправке архива. ')+'Попробуйте /access через минуту.');
   }
  }
 }
 if(delivered.length){
  const paidOrderIds=[...new Set([...delivered,...(session?.paidOrderIds||[])])].slice(0,20);
  try{await saveSession(userId,{...session,paidOrderIds});}catch{}
  await health({result:'delivered',stage:'complete',count:delivered.length});
  return reply('Оплата проверена. Материалы отправлены ZIP-файлом в этот чат MAX. Скачайте архив из сообщения выше и распакуйте его. Это обновлённая версия материалов; повторная оплата не нужна.');
 }
 if(pending){await health({result:'pending',stage:'payment'});return reply('Банк пока не подтвердил оплату найденного заказа. Если деньги списались, повторно не платите. Для повторной проверки напишите /access через минуту.');}
 if(accessRequired){await health({result:'not_found',stage:'ownership'});return reply('Покупка ещё не привязана к этому чату MAX. Отправьте полную ссылку на страницу оплаченного заказа обычным сообщением в этот чат — бот проверит доступ и выдаст архив. Повторно не платите.');}
 await health({result:'not_paid',stage:'payment'});return reply('У найденных заказов нет подтверждённой оплаты. Если деньги списались, повторно не платите: отправьте ссылку на страницу оплаченного заказа обычным сообщением в этот чат.');
}
