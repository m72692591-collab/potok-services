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
    [{type:'link',text:'Персональные данные',url:SITE+'/privacy'}],
    [{type:'message',text:accept(s.product)}],cancel()
  ])};
}
function paymentReply(s){
  return {text:CATALOG[s.product].title+' — '+price(s.product)+' ₽\n\nОплата подготовлена. Кнопка ниже открывает защищённую страницу Т-Банка. После оплаты вернитесь на страницу заказа по кнопке банка — там автоматически появятся материалы. Если деньги уже списались, повторно не оплачивайте.',attachments:buttons([[{type:'link',text:'Оплатить '+price(s.product)+' ₽',url:s.paymentUrl}]])};
}

// Receives only messages in a private dialog. All persistent state is injected.
export async function engineerMaxCheckout(update,{loadSession,saveSession,createPayment,canPay,now=Date.now}={}){
  if(update?.update_type==='bot_started'){
    const id=Number(update?.user?.user_id);
    if(Number.isSafeInteger(id)&&id>0){
      const source=String(update?.payload||'bot').replace(/[^A-Za-z0-9_-]/g,'').slice(0,80)||'bot';
      await saveSession(id,{source,phase:'idle',expiresAt:now()+TTL});
    }
    return null;
  }
  if(update?.update_type!=='message_created')return null;
  const m=update.message,userId=Number(m?.sender?.user_id);
  if(m?.sender?.is_bot===true||m?.recipient?.chat_type!=='dialog'||!Number.isSafeInteger(userId)||userId<=0)return null;
  const input=String(m?.body?.text||'').trim().slice(0,1200);
  if(!input)return null;
  const reply=r=>({userId,...r});
  const selected=Object.keys(MAX_BUY_LABELS).find(p=>MAX_BUY_LABELS[p]===input);
  if(selected){
    const previous=await loadSession(userId);
    await saveSession(userId,{source:previous?.source||'bot',product:selected,phase:'contact',expiresAt:now()+TTL});
    return reply({text:CATALOG[selected].title+' — '+price(selected)+' ₽\n\nДля оплаты и электронного чека отправьте сюда свой email или телефон. Например: name@example.com или +79991234567.\n\nКонтакт используется для оформления заказа и чека согласно политике ниже. Следующий шаг — подтверждение условий и оплата Т-Банка.',attachments:buttons([[{type:'link',text:'Персональные данные',url:SITE+'/privacy'}],cancel()])});
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
    if(!contact)return reply({text:'Для чека нужен email или телефон. Отправьте только контакт, либо нажмите «Отменить оформление».',attachments:buttons([cancel()])});
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
    const result=await createPayment({product:s.product,contact:s.contact,acceptTerms:true,termsVersion:'2026-09-24',attribution:{src:'max_'+String(s.source||'bot').replace(/[^A-Za-z0-9_-]/g,'').slice(0,80)}});
    const url=new URL(result?.paymentUrl);
    if(url.protocol!=='https:')throw new Error('invalid_payment_url');
    const next={source:s.source,product:s.product,phase:'ready',paymentUrl:url.toString(),expiresAt:s.expiresAt};
    await saveSession(userId,next);
    return reply(paymentReply(next));
  }catch{
    await saveSession(userId,{...s,phase:'consent'});
    return reply({text:'Не удалось подготовить оплату. Деньги не списаны. Можно повторить подтверждение условий.',attachments:confirmation(s).attachments});
  }
}
