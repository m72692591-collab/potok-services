import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {engineerMaxCheckout,MAX_BUY_LABELS} from '../api/_engineer-max-checkout.js';
const msg=(text,id=1,chat_type='dialog')=>({update_type:'message_created',message:{sender:{user_id:id,is_bot:false},recipient:{chat_type},body:{text}}});
function fixture(){
  const sessions=new Map(),orders=[];let time=100000;
  const deps={loadSession:async id=>sessions.get(id),saveSession:async(id,s)=>sessions.set(id,s),canPay:async()=>true,now:()=>time,createPayment:async (body,userId)=>{assert.equal(userId,1);orders.push(body);return{orderId:"test-order",paymentUrl:'https://securepay.tbank.ru/test-link'}}};
  return{sessions,orders,deps,run:u=>engineerMaxCheckout(u,deps),expire:()=>time+=31*60000};
}
test('all four products: chat contact, explicit consent, bank link and attribution',async()=>{
  for(const [p,label] of Object.entries(MAX_BUY_LABELS)){
    const f=fixture();
    await f.run({update_type:'bot_started',user:{user_id:1},payload:'eng_vk_max_launch'});
    const choose=await f.run(msg(label));assert.match(choose.text,/email/);assert.equal(f.orders.length,0);
    const confirmation=await f.run(msg('buyer@example.com'));assert.equal(f.orders.length,0);
    const accept=confirmation.attachments[0].payload.buttons[2][0].text;
    assert.match(confirmation.text,/оферту/);
    const reply=await f.run(msg(accept));assert.equal(f.orders.length,1);
    assert.equal(f.orders[0].product,p);assert.equal(f.orders[0].contact,'buyer@example.com');
    assert.equal(f.orders[0].acceptTerms,true);assert.equal(f.orders[0].termsVersion,'2026-09-24');
    assert.equal(f.orders[0].attribution.src,'max_eng_vk_max_launch');
    assert.match(reply.attachments[0].payload.buttons[0][0].url,/securepay.tbank.ru/);
    assert.equal(f.sessions.get(1).contact,undefined);assert.equal(f.sessions.get(1).lastOrderId,'test-order');
    await f.run(msg(accept));assert.equal(f.orders.length,1,'repeat reuses payment URL');
  }
});
test('invalid contact, wrong price, other user, group and expiry cannot initialize payment',async()=>{
  const f=fixture();
  assert.equal(await f.run(msg(MAX_BUY_LABELS.starter,1,'chat')),null);
  await f.run(msg(MAX_BUY_LABELS.starter));await f.run(msg('wrong'));
  assert.equal(f.sessions.get(1).phase,'contact');
  await f.run(msg('+79991234567'));
  await f.run(msg('Принимаю · 1 990 ₽'));
  await f.run(msg('Принимаю · 490 ₽',2));assert.equal(f.orders.length,0);
  f.expire();await f.run(msg('Принимаю · 490 ₽'));assert.equal(f.orders.length,0);
});
test('cancellation removes contact and payment-disabled check fails closed',async()=>{
  const f=fixture();await f.run(msg(MAX_BUY_LABELS.starter));await f.run(msg('buyer@example.com'));
  f.deps.canPay=async()=>false;await f.run(msg('Принимаю · 490 ₽'));assert.equal(f.orders.length,0);
  await f.run(msg('Отменить оформление'));assert.equal(f.sessions.get(1).contact,undefined);
  await f.run(msg('Принимаю · 490 ₽'));assert.equal(f.orders.length,0);
});
test('provider failure does not return catalog link and allows explicit retry',async()=>{
  const f=fixture();await f.run(msg(MAX_BUY_LABELS.starter));await f.run(msg('buyer@example.com'));
  f.deps.createPayment=async()=>{throw new Error('failed')};
  const r=await f.run(msg('Принимаю · 490 ₽'));assert.match(r.text,/Не удалось/);assert.equal(f.sessions.get(1).phase,'consent');
});
test('legacy MAX links select the right product in chat without payment or consent',async()=>{
  for(const p of Object.keys(MAX_BUY_LABELS)){
    const f=fixture();
    const r=await f.run({update_type:'bot_started',user:{user_id:1},payload:'buy_'+p+'__src_max_eng_vk_max_launch'});
    assert.equal(f.sessions.get(1).product,p);assert.equal(f.sessions.get(1).source,'eng_vk_max_launch');
    assert.match(r.text,/email/);assert.equal(f.orders.length,0);
    assert.ok(!r.attachments[0].payload.buttons.flat().some(b=>b.url?.includes('?buy=')));
  }
  const f=fixture();await f.run(msg('/start buy_starter'));assert.equal(f.sessions.get(1).product,'starter');
  await f.run(msg('/starter'));assert.equal(f.orders.length,0);
});
