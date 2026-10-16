import test from 'node:test';
import assert from 'node:assert/strict';
import { engineerMaxReply } from '../api/_engineer-max.js';
import { engineerTelegramReply } from '../api/_engineer-telegram.js';

const absent=/НОК|НОСТРОЙ|НОПРИЗ|Тренажёр НОК|test_NOSTROY_bot|giprussia\.ru\/.*nok/i;
function maxMessage(text){
  return {update_type:'message_created',message:{sender:{user_id:321,is_bot:false},body:{text}}};
}
function telegramMessage(text){
  return {update_id:42,message:{text,chat:{id:321,type:'private'},from:{id:321,is_bot:false}}};
}
test('MAX new menus and historical NOK messages do not advertise NOK',()=>{
  for(const update of [{update_type:'bot_started',payload:'eng_vk',user:{user_id:321,is_bot:false}},
    ...['/start','/courses','/nok','🧠 Тренажёр НОК','🏗 НОСТРОЙ','📐 НОПРИЗ · проектирование','🌍 НОПРИЗ · изыскания'].map(maxMessage)]){
    const r=engineerMaxReply(update);
    assert.equal(r.userId,321);
    assert.doesNotMatch(JSON.stringify(r),absent);
    assert.match(JSON.stringify(r.attachments),/AutoCAD/);
    assert.match(JSON.stringify(r.attachments),/Primavera/);
  }
});
test('Telegram menu and historical NOK messages do not advertise NOK',()=>{
  for(const text of ['/start','/courses','/nok','🧠 НОК НОСТРОЙ / НОПРИЗ','/nostroy','/nopriz']){
    const r=engineerTelegramReply(telegramMessage(text));
    assert.equal(r.chat_id,321);
    assert.doesNotMatch(JSON.stringify(r),absent);
    assert.match(JSON.stringify(r.reply_markup),/AutoCAD/);
    assert.match(JSON.stringify(r.reply_markup),/Primavera/);
  }
});
