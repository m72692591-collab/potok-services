import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCsvText, engineerMaxMarkerReply, parseCsv } from '../api/_engineer-max-marker.js';
const mkUpdate=(file,text='')=>({
  update_type:'message_created',
  message:{
    sender:{user_id:987654321,is_bot:false},
    recipient:{chat_type:'dialog'},
    body:{text,attachments:file?[file]:[]}
  }
});
const file=(url='https://fu.oneme.ru/files/signed')=>({
  type:'file',filename:'inventory.csv',size:90,payload:{url}
});
test('valid GS1, bad digit, duplicate and empty GTIN',()=>{
  const result=inspectCsvText('GTIN;Название\n4601234567893;Первый\n4601234567894;Плохой\n4601234567893;Повтор\n;Пустой\n');
  assert.equal(result.checked,4);
  assert.equal(result.ok,1);
  assert.equal(result.errors,3);
  assert.deepEqual(result.faults.map(x=>x.reason),[
    'ошибка контрольной цифры GS1','дубликат','пустой GTIN'
  ]);
});
test('Windows CSV style comma separator, GTIN quoted with comma in other column',()=>{
  const result=inspectCsvText('EAN,Name\r\n"4601234567893","Ключ, запятая"\r\n');
  assert.equal(result.ok,1);
});
test('quoted semicolon in CSV parsing',()=>{
  assert.deepEqual(parseCsv('GTIN;Название\n4601234567893;"Товар; набор"', ';')[1],['4601234567893','Товар; набор']);
});
test('no GTIN column fails clearly',()=>{
  assert.throws(()=>inspectCsvText('NAME;PRICE\nМыло;99'),/no_gtin_header/);
});
test('private dialog marker command',async()=>{
  const r=await engineerMaxMarkerReply(mkUpdate(null,'/marker'));
  assert.match(r.text,/МаркерФайл/);
});
test('unsafe file URL is rejected without downloading',async()=>{
  let calls=0;
  const r=await engineerMaxMarkerReply(mkUpdate(file('https://127.0.0.1/admin')),{
    download:async()=>{calls++;return Buffer.from('GTIN\n4601234567893');}
  });
  assert.equal(calls,0);
  assert.match(r.text,/безопасную ссылку/);
});
test('CSV file produces correct report and does not require paid checkout',async()=>{
  const r=await engineerMaxMarkerReply(mkUpdate(file()),{
    download:async()=>Buffer.from('GTIN;Name\n4601234567893;Ok\n4601234567894;Bad','utf8')
  });
  assert.match(r.text,/Проверено товарных строк: 2/);
  assert.match(r.text,/Без ошибок: 1/);
  assert.match(r.text,/Ошибок: 1/);
});
test('disallow oversize attachments',async()=>{
  const huge=file();huge.size=1_000_000;
  const r=await engineerMaxMarkerReply(mkUpdate(huge));
  assert.match(r.text,/512 КБ/);
});
