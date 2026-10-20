import {engineerMaxDownload} from './_engineer-max-http.js';

export function markerCheckDigit(body) {
  let sum=0,weight=3;
  for(let i=body.length-1;i>=0;i--){sum+=Number(body[i])*weight;weight=weight===3?1:3;}
  return (10-sum%10)%10;
}
export function markerValid(code) {
  return /^\d+$/.test(code)&&[8,12,13,14].includes(code.length)&&markerCheckDigit(code.slice(0,-1))===Number(code.at(-1));
}
export function markerParseCsv(text) {
  const str=String(text).replace(/^\uFEFF/,'');
  const first=str.split(/\r?\n/,1)[0];
  const delimiter=[';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<str.length;i++){
    const c=str[i];
    if(quoted){
      if(c==='"'&&str[i+1]==='"'){cell+='"';i++;}
      else if(c==='"')quoted=false;
      else cell+=c;
    }else if(c==='"'&&!cell)quoted=true;
    else if(c===delimiter){row.push(cell);cell='';}
    else if(c==='\n'||c==='\r'){
      if(c==='\r'&&str[i+1]==='\n')i++;
      row.push(cell);rows.push(row);row=[];cell='';
      if(rows.length>3000)throw Error('too_many_rows');
    }else cell+=c;
  }
  if(quoted)throw Error('invalid_csv');
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}
export function markerAnalyze(rows) {
  let start=0,col=0,checked=0,good=0;
  const problems=[],seen=new Map();
  const headers=(rows[0]||[]).map(s=>String(s).toLowerCase().trim());
  const found=headers.findIndex(h=>/^(gtin|ean(?:-?1[2348])?|штрих.?код|код товара|товарный код)/iu.test(h));
  if(found>=0){col=found;start=1;}
  for(let i=start;i<rows.length;i++){
    const row=rows[i];
    if(row.every(c=>!String(c).trim()))continue;
    checked++;
    const raw=String(row[col]??'');const value=raw.trim();let error='';
    if(!value)error='пустой GTIN';
    else if(!/^\d+$/.test(value))error='нечисловой код';
    else if(![8,12,13,14].includes(value.length))error='неверная длина ('+value.length+')';
    else if(!markerValid(value))error='неверная контрольная цифра GS1';
    else if(seen.has(value.padStart(14,'0')))error='дубликат строки '+seen.get(value.padStart(14,'0'));
    if(error)problems.push({row:i+1,error,value:raw});
    else {good++;seen.set(value.padStart(14,'0'),i+1);}
  }
  return{checked,good,problems};
}
function markerFormat(result){
  if(!result.checked)return'В файле нет непустых строк GTIN. Укажите колонку GTIN или EAN.';
  const lines=result.problems.slice(0,12).map(p=>'Строка '+p.row+': '+p.error+' ('+(p.value.slice(0,24)||'пусто')+')');
  return('🧾 Предварительная проверка GTIN\nПроверено строк: '+result.checked+'\nБез ошибок: '+result.good+'\nС ошибками: '+result.problems.length+
    (lines.length?'\n\n'+lines.join('\n'):'\n\n✅ Ошибок формата не обнаружено.')+
    (result.problems.length>12?'\n...и ещё '+(result.problems.length-12)+' строк.':'')+
    '\n\nВажно: не проверяет регистрацию кода в GS1, документы или готовность для «Честного знака». Файл в нашей базе не сохраняется.').slice(0,3750);
}
const INTRO='🧾 Проверка таблиц товаров — бесплатный пилот.\n\nОтправьте CSV до 256 КБ прямо в этот чат. Желателен столбец GTIN или EAN. Кодировки UTF-8 и Windows-1251, разделители ; или ,.\n\nМожно без файла: /gtin 4601234567893 4601234567894\n\nExcel XLSX временно сохраните как CSV. Не отправляйте личные данные и коммерческие тайны. Техническая проверка не заменяет правила «Честного знака».';
function reply(userId,text){return{userId,text,attachments:[]};}
export async function engineerMarkerReply(update,{download=engineerMaxDownload}={}){
  if(update?.update_type!=='message_created'||update.message?.recipient?.chat_type!=='dialog'||update.message?.sender?.is_bot===true)return null;
  const userId=Number(update.message.sender?.user_id);
  if(!Number.isSafeInteger(userId)||userId<=0)return null;
  const text=String(update.message.body?.text||'').trim();
  const file=update.message.body?.attachments?.find(a=>a?.type==='file');
  if(file){
    if(!/\.csv$/iu.test(String(file.filename||'')))return reply(userId,'Пока поддерживается CSV. Сохраните Excel как CSV и пришлите файл заново.');
    if(!Number.isSafeInteger(Number(file.size))||Number(file.size)<0||Number(file.size)>262144)return reply(userId,'CSV должен быть не больше 256 КБ.');
    try{
      const bytes=await download(file.payload?.url,262144);
      let csv;
      try{csv=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{csv=new TextDecoder('windows-1251').decode(bytes);}
      return reply(userId,markerFormat(markerAnalyze(markerParseCsv(csv))));
    }catch{return reply(userId,'Не удалось безопасно прочитать CSV. Проверьте файл и повторите отправку.');}
  }
  if(['/marker','/markirovka','🧾 Проверить таблицу'].includes(text))return reply(userId,INTRO);
  if(/^\/gtin(?:\s|$)/i.test(text)){
    const codes=text.slice(5).trim().split(/[\s,;]+/).filter(Boolean).slice(0,100);
    if(!codes.length)return reply(userId,'Пример: /gtin 4601234567893 4601234567894');
    return reply(userId,markerFormat(markerAnalyze(codes.map(v=>[v]))));
  }
  return null;
}
