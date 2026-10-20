import test from 'node:test';
import assert from 'node:assert/strict';
import { engineerMaxReply } from '../api/_engineer-max.js';
import { engineerMarkerReply } from '../api/_engineer-marker.js';

const start=payload=>({update_type:'bot_started',payload,user:{user_id:10003,is_bot:false}});
const message=text=>({update_type:'message_created',message:{sender:{user_id:10003,is_bot:false},body:{text}}});

test('AutoCAD free deeplink presents a real task and unchanged course price',()=>{
  const r=engineerMaxReply(start('free_autocad_vk_oct26'));
  assert.match(r.text,/_DIST/);
  assert.match(r.text,/5000 мм/);
  assert.match(r.text,/1 990 ₽/);
  assert.doesNotMatch(r.text,/гарантир.*трудоустройств/i);
  assert.match(JSON.stringify(r.attachments),/MAX|autocad|AutoCAD/);
});

test('Primavera free deeplink presents FS exercise and unchanged course price',()=>{
  const r=engineerMaxReply(start('free_primavera_vk_oct26'));
  assert.match(r.text,/Finish-to-Start/);
  assert.match(r.text,/8 дням/);
  assert.match(r.text,/2 490 ₽/);
});

test('plain start remains the default store welcome; marker is separate',async()=>{
  assert.match(engineerMaxReply(start('eng_vk_max_launch')).text,/Инженер с нуля/);
  assert.equal(await engineerMarkerReply(start('free_autocad_vk_oct26')),null);
  assert.match((await engineerMarkerReply(start('marker_launch'))).text,/Проверка таблиц/);
});

test('manual lesson commands work without touching checkout',()=>{
  assert.match(engineerMaxReply(message('/try_autocad')).text,/5000 мм/);
  assert.match(engineerMaxReply(message('/try_primavera')).text,/8 дням/);
});

test('existing paid products continue to display same advertised prices',()=>{
  const r=engineerMaxReply(start('eng_vk_max_launch'));
  for(const amount of ['1 990 ₽','2 490 ₽','3 490 ₽'])assert.match(r.text,new RegExp(amount));
});
