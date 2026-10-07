import { CATALOG, validateContact } from './_shared.js';

const SITE='https://inzhener-s-nulya.vercel.app';
export const MAX_BUY_LABELS={starter:'⚡ Практикум 490 ₽',autocad:'📐 AutoCAD 1 990 ₽',primavera:'📅 Primavera 2 490 ₽',bundle:'📦 Комплект 3 490 ₽'};
const TTL=30*60*1000;
const buttons=rows=>[{type:'inline_keyboard',payload:{buttons:rows}}];
const cancel=()=>[{type:'message',text:'Отменить оформление'}];
const price=p=>CATALOG[p].price.toLocaleString('ru-RU');
const accept=p=>'Принимаю · '+price(p)+' ₽';
function confirmation(s){
  return {text:CATALOG[s.product].title+' — '+price(s.product)+' ₽\n\nКонтакт для чека: '+s.contact+'\n\nНажимая «'+accept(s.product)+'», вы принимаете публичную оферту, условия возврата и политику обработки персональных данных. После успешной оплаты доступ к цифровому товару предоставляется сразу.\n\nЗатем появится кнопка оплаты Т-Банка.',attachments:buttons([
    [{type:'link',text:'Оферта и возврат',url:SITE+'/offer'}],
    [{type:'link',text:'Политика данных',url:SITE+'/privacy'}],
    [{type:'message',text:accept(s.product)}],cancel()
  ])};
}
function paymentReply(s){
  return {text:CATALOG[s.product].title+' — '+price(s.product)+' ₽\n\nОплата подготовлена. Кнопка ниже открывает защищённую страницу Т-Банка. После подтверждения оплаты бот пришлёт материалы файлом в этот чат MAX. Можно закрыть браузер и вернуться в чат. Для проверки нажмите «Проверить оплату». Если деньги уже списались, повторно не оплачивайте.',attachments:buttons([[{type:'link',text:'Оплатить '+price(s.product)+' ₽',url:s.paymentUrl}],[{type:'message',text:'Проверить оплату'}]])};
}

// Receives only messages in a private dialog. All persistent state is injected.
export async function engineerMaxCheckout(update,{loadSession,saveSession,createPayment,canPay,now=Date.now}={}){
  if(update?.update_type==='bot_started'){
    const id=Number(update?.user?.user_id);
    if(Number.isSafeInteger(id)&&id>0){
      const source=String(update?.payload||'bot').replace(/[^A-Za-z0-9_-]/g,'').slice(0,80)||'bot';
      const purchase=source.match(/^buy_(starter|autocad|primavera|bundle)(?:__src_(max_[A-Za-z0-9_-]{1,80}))?$/);
      await saveSession(id,{source:purchase?(purchase[2]||'max_legacy').replace(/^max_/, ''):source,phase:'idle',expiresAt:now()+TTL});
      if(purchase)return engineerMaxCheckout({update_type:'message_created',message:{sender:{user_id:id,is_bot:false},recipient:{chat_type:'dialog'},body:{text:MAX_BUY_LABELS[purchase[1]]}}},{loadSession,saveSession,createPayment,canPay,now});
    }
    return null;
  }
  if(update?.update_type!=='message_created')return null;
  const m=update.message,userId=Number(m?.sender?.user_id);
  if(m?.sender?.is_bot===true||m?.recipient?.chat_type!=='dialog'||!Number.isSafeInteger(userId)||userId<=0)return null;
  let input=String(m?.body?.text||'').trim().slice(0,1200);
  const startPurchase=input.match(/^\/start\s+(buy_(?:starter|autocad|primavera|bundle)(?:__src_max_[A-Za-z0-9_-]{1,80})?)$/);
  if(startPurchase)return engineerMaxCheckout({update_type:'bot_started',user:{user_id:userId},payload:startPurchase[1]},{loadSession,saveSession,createPayment,canPay,now});
  const aliases={'/starter':'starter','/buy_starter':'starter','купить 490':'starter','⚡ Первый рабочий день — 490 ₽':'starter','/autocad_paid':'autocad','/primavera_paid':'primavera','/bundle':'bundle'};
  if(aliases[input])input=MAX_BUY_LABELS[aliases[input]];
  if(!input)return null;
  const reply=r=>({userId,...r});
  const selected=Object.keys(MAX_BUY_LABELS).find(p=>MAX_BUY_LABELS[p]===input);
  if(selected){
    const previous=await loadSession(userId);
    await saveSession(userId,{source:previous?.source||'bot',product:selected,phase:'contact',expiresAt:now()+TTL});
    return reply({text:CATALOG[selected].title+' — '+price(selected)+' ₽\n\nДля оплаты и электронного чека напишите свой email или номер телефона обычным сообщением в этом чате MAX.\n\nНажмите поле сообщения, введите email или телефон и отправьте сообщение. Например: name@example.com или +79991234567.\n\nКнопка «Политика данных» открывает документ для ознакомления. Для ввода email или телефона нажимать её не нужно.\n\nКонтакт используется для оформления заказа и чека согласно политике ниже. Следующий шаг — подтверждение условий и оплата Т-Банка.',attachments:buttons([[{type:'link',text:'Политика данных',url:SITE+'/privacy'}],cancel()])});
  }
  if(input==='/start'||input==='/courses'||input==='/cancel'||input==='Отменить оформление'){
    const previous=await loadSession(userId);
    await saveSession(userId,{source:previous?.source||'bot',phase:'cancelled',expiresAt:now()});
    if(input==='/start'||input==='/courses')return null;
    return reply({text:'Оформление отменено. Напишите /courses, чтобы выбрать другой продукт.',attachments:[]});
  }
  const s=await loadSession(userId);
  if(!s||s.expiresAt<=now()||!MAX_BUY_LABELS[s.product]){
    if(input.startsWith('Принимаю · '))return reply({text:'Оформление истекло. Напишите /courses и выберите продукт заново.',attachments:[]});
    return null;
  }
  if(input.startsWith('/')||input==='💬 Задать вопрос')return null;
  if(s.phase==='contact'){
    const contact=validateContact(input);
    if(!contact)return reply({text:'Напишите свой email или номер телефона обычным сообщением в этом чате MAX. В сообщении укажите только email или телефон, например name@example.com или +79991234567. Для отмены нажмите «Отменить оформление».',attachments:buttons([cancel()])});
    const next={...s,contact,phase:'consent'};
    await saveSession(userId,next);
    return reply(confirmation(next));
  }
  if(input!==accept(s.product)){
    if(s.phase==='consent')return reply(confirmation(s));
    return null;
  }
  if(s.phase==='ready')return reply(paymentReply(s));
  if(s.phase==='creating')return reply({text:'Оплата ещё готовится. Подождите минуту. Деньги без вашего подтверждения в банке не списываются.',attachments:[]});
  if(s.phase!=='consent')return null;
  if(!await canPay())return reply({text:'Оплата временно недоступна. Попробуйте позднее — сейчас деньги не списываются.',attachments:[]});
  await saveSession(userId,{...s,phase:'creating'});
  try{
    const result=await createPayment({product:s.product,contact:s.contact,acceptTerms:true,termsVersion:'2026-09-24',attribution:{src:'max_'+String(s.source||'bot').replace(/[^A-Za-z0-9_-]/g,'').slice(0,80)}},userId);
    const url=new URL(result?.paymentUrl);
    if(url.protocol!=='https:')throw new Error('invalid_payment_url');
    const next={source:s.source,product:s.product,phase:'ready',paymentUrl:url.toString(),lastOrderId:result.orderId,expiresAt:s.expiresAt};
    await saveSession(userId,next);
    return reply(paymentReply(next));
  }catch{
    await saveSession(userId,{...s,phase:'consent'});
    return reply({text:'Не удалось подготовить оплату. Деньги не списаны. Можно повторить подтверждение условий.',attachments:confirmation(s).attachments});
  }
}

