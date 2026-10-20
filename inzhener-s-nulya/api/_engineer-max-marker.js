import https from 'node:https';

const MAX_CSV_BYTES=512*1024;
const ALLOWED_DOMAINS=['oneme.ru','max.ru','okcdn.ru','mycdn.me'];
const HELP='📋 МаркерФайл — бесплатная проверка CSV перед загрузкой в «Честный знак».\n\nПришлите в этот чат CSV-файл до 512 КБ с колонкой GTIN (поддерживается разделитель «;» или «,»). Бот проверит длину, контрольную цифру GS1, дубликаты и пустые коды.\n\nПроверка техническая: не подтверждает регистрацию GTIN, документы и обязательность маркировки. Файл не сохраняется нами в базе. Не отправляйте конфиденциальные сведения.';
function allowedFileUrl(raw){
  let u;
  try{u=new URL(raw)}catch{throw new Error('bad_attachment_url')}
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!ALLOWED_DOMAINS.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))throw new Error('bad_attachment_url');
  return u;
}
export function downloadMaxCsv(raw,{maxBytes=MAX_CSV_BYTES}={}){
  const url=allowedFileUrl(raw);
  return new Promise((resolve,reject)=>{
    const request=https.get(url,{timeout:9000,headers:{'Accept':'text/csv,application/octet-stream'}},response=>{
      if(response.statusCode!==200){response.resume();reject(new Error('download_status'));return;}
      const declared=Number(response.headers['content-length']||0);
      if(declared>maxBytes){response.destroy();reject(new Error('file_too_large'));return;}
      const chunks=[];let size=0;
      response.on('data',part=>{
        size+=part.length;
        if(size>maxBytes){response.destroy(new Error('file_too_large'));return;}
        chunks.push(part);
      });
      response.on('end',()=>resolve(Buffer.concat(chunks)));
      response.on('error',reject);
    });
    request.on('error',reject);
    request.on('timeout',()=>request.destroy(new Error('download_timeout')));
  });
}
export function parseCsv(raw,delimiter){
  const records=[];let row=[],cell='',inside=false;
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(inside){
      if(c==='"'&&raw[i+1]==='"'){cell+='"';i++;}
      else if(c==='"')inside=false;
      else cell+=c;
    }else if(c==='"'&&cell===''){inside=true;}
    else if(c===delimiter){row.push(cell);cell='';}
    else if(c==='\r'||c==='\n'){
      if(c==='\r'&&raw[i+1]==='\n')i++;
      row.push(cell);records.push(row);row=[];cell='';
      if(records.length>12000)throw new Error('too_many_rows');
    }else cell+=c;
  }
  if(inside)throw new Error('bad_csv_quotes');
  if(cell||row.length){row.push(cell);records.push(row)}
  return records;
}
function delimiterOf(text){
  const row=text.split(/\r?\n/).find(s=>s.trim())||'';
  return (row.match(/;/g)||[]).length>=(row.match(/,/g)||[]).length?';':',';
}
function checksum(code){
  let sum=0,weight=3;
  for(let i=code.length-2;i>=0;i--){sum+=Number(code[i])*weight;weight=weight===3?1:3}
  return (10-sum%10)%10===Number(code[code.length-1]);
}
export function inspectCsvText(text){
  const records=parseCsv(text.replace(/^\uFEFF/,''),delimiterOf(text));
  if(!records.length)throw new Error('empty_csv');
  const first=records[0].map(v=>v.toLowerCase().trim().replace(/[\s_\-]/g,''));
  let col=first.findIndex(s=>['gtin','ean','ean13','штрихкод','кодтовара'].includes(s));
  if(col===-1)throw new Error('no_gtin_header');
  const faults=[];const seen=new Set();let checked=0,ok=0;
  for(let i=1;i<records.length;i++){
    const r=records[i];
    if(r.every(c=>!c.trim()))continue;
    checked++;
    if(checked>10000)throw new Error('too_many_rows');
    const value=(r[col]||'').trim();
    let reason='';
    if(!value)reason='пустой GTIN';
    else if(!/^\d+$/.test(value))reason='нецифровые символы';
    else if(![8,12,13,14].includes(value.length))reason='неверная длина';
    else if(!checksum(value))reason='ошибка контрольной цифры GS1';
    else if(seen.has(value.padStart(14,'0')))reason='дубликат';
    if(!reason){seen.add(value.padStart(14,'0'));ok++}
    else faults.push({line:i+1,code:value.slice(0,25),reason});
  }
  return {checked,ok,errors:faults.length,faults};
}
function content(buffer){
  try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer)}
  catch{return new TextDecoder('windows-1251').decode(buffer)}
}
export async function engineerMaxMarkerReply(update,{download=downloadMaxCsv}={}){
  if(update?.update_type!=='message_created')return null;
  const message=update.message||{};
  const userId=Number(message?.sender?.user_id);
  if(message.sender?.is_bot===true||message.recipient?.chat_type!=='dialog'||!Number.isSafeInteger(userId)||userId<=0)return null;
  const input=String(message.body?.text||'').trim().toLowerCase();
  const file=(message.body?.attachments||[]).find(a=>a.type==='file');
  const reply=text=>({userId,text,attachments:[]});
  if(!file){
    if(['/marker','маркерфайл','📋 проверить csv','проверить csv'].includes(input))return reply(HELP);
    return null;
  }
  const name=String(file.filename||'');
  if(!/\.csv$/i.test(name))return reply('МаркерФайл сейчас принимает только CSV. Сохраните таблицу в формате CSV с заголовком GTIN и отправьте снова. Файл XLSX подключим после дополнительной проверки.');
  if(!Number.isFinite(Number(file.size))||Number(file.size)<1||Number(file.size)>MAX_CSV_BYTES)return reply('Допустимый размер CSV: от 1 байта до 512 КБ. Большой файл разделите на части.');
  let url;
  try{url=allowedFileUrl(file.payload?.url).toString()}catch{return reply('MAX не передал безопасную ссылку на файл. Попробуйте отправить CSV повторно.');}
  try{
    const buffer=await download(url);
    if(!Buffer.isBuffer(buffer)||buffer.length>MAX_CSV_BYTES)throw new Error('file_too_large');
    const result=inspectCsvText(content(buffer));
    const examples=result.faults.slice(0,8).map(f=>'Строка '+f.line+': '+f.reason+(f.code?' ('+f.code+')':''));
    return reply('📋 МаркерФайл: проверка выполнена\nПроверено товарных строк: '+result.checked+'\nБез ошибок: '+result.ok+'\nОшибок: '+result.errors+(examples.length?'\n\nПервые замечания:\n'+examples.join('\n'):'\n\n✅ Ошибок формата GTIN не обнаружено.')+(result.errors>8?'\n...и ещё '+(result.errors-8)+' ошибок.':'')+'\n\nЭто техническая проверка, не подтверждение регистрации или соответствия требованиям «Честного знака».');
  }catch(e){
    const error=String(e?.message||'');
    if(error==='no_gtin_header')return reply('Не обнаружена колонка GTIN. Первая строка CSV должна содержать заголовок GTIN (или EAN, Штрихкод, Код товара).');
    if(error==='file_too_large'||error==='too_many_rows')return reply('CSV слишком большой. Ограничение: 512 КБ и 10 000 строк. Разделите файл.');
    if(error==='bad_csv_quotes')return reply('Ошибка CSV: незакрытая кавычка в данных. Исправьте файл и попробуйте ещё раз.');
    return reply('Не удалось прочитать или проверить CSV. Попробуйте сохранить таблицу как CSV UTF-8 и отправить снова.');
  }
}
