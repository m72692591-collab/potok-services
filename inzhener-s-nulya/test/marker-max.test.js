import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markerCheckDigit,markerValid,markerParseCsv,markerAnalyze,engineerMarkerReply} from '../api/_engineer-marker.js';

const incoming=(text='',attachments=[])=>({update_type:'message_created',message:{
  sender:{user_id:1002,is_bot:false},recipient:{chat_type:'dialog'},body:{text,attachments}
}});
test('GS1 modulo 10 verifies valid and invalid values',()=>{
  assert.equal(markerCheckDigit('460123456789'),3);
  assert.equal(markerValid('4601234567893'),true);
  assert.equal(markerValid('4601234567894'),false);
  assert.equal(markerValid('123'),false);
});
test('CSV parser supports quoted delimiters and multiline fields',()=>{
  const rows=markerParseCsv('Наименование;GTIN\n"Набор; 2 шт";4601234567893\n"Товар\nдва";4601234567894');
  assert.equal(rows.length,3);
  assert.equal(rows[1][0],'Набор; 2 шт');
  assert.equal(rows[2][0],'Товар\nдва');
});
test('CSV analysis flags duplicate and wrong checksum',()=>{
  const csv='Товар;GTIN\nА;4601234567893\nБ;4601234567893\nВ;4601234567894\n';
  const result=markerAnalyze(markerParseCsv(csv));
  assert.equal(result.checked,3);
  assert.equal(result.good,1);
  assert.equal(result.problems.length,2);
  assert.match(result.problems[0].error,/дубликат/);
  assert.match(result.problems[1].error,/контрольная/);
});
test('intro and slash commands are self-contained',async()=>{
  assert.match((await engineerMarkerReply(incoming('/marker'))).text,/бесплатный пилот/);
  assert.match((await engineerMarkerReply(incoming('/gtin 4601234567893 4601234567894'))).text,/С ошибками: 1/);
  assert.equal(await engineerMarkerReply(incoming('/courses')),null);
});
test('MAX attached CSV is processed without real API',async()=>{
  const buffer=Buffer.from('GTIN;Название\n4601234567893;Товар\n4601234567894;Ошибка\n');
  const file={type:'file',filename:'goods.csv',size:buffer.length,payload:{url:'https://fu.oneme.ru/fake-file'}};
  const resp=await engineerMarkerReply(incoming('',[file]),{download:async()=>buffer});
  assert.match(resp.text,/Проверено строк: 2/);
  assert.match(resp.text,/С ошибками: 1/);
});
test('excessive attachment size is rejected before download',async()=>{
  const file={type:'file',filename:'goods.csv',size:262145,payload:{url:'https://fu.oneme.ru/fake-file'}};
  let called=false;
  const resp=await engineerMarkerReply(incoming('',[file]),{download:async()=>{called=true;return Buffer.alloc(0);}});
  assert.match(resp.text,/256 КБ/);
  assert.equal(called,false);
});