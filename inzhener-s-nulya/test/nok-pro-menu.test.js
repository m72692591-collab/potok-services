import test from 'node:test';
import assert from 'node:assert/strict';
import { engineerNokReply, NOK_PRO_PRODUCTS } from '../api/_engineer-nok.js';
import { CATALOG } from '../api/_shared.js';

const msg=text=>({update_type:'message_created',message:{sender:{user_id:301,is_bot:false},recipient:{chat_type:'dialog'},body:{text}}});
test('NOK menu provides three distinct tracks and does not charge',()=>{
  const a=engineerNokReply(msg('/nok'));
  assert.equal(a.userId,301);
  assert.match(a.text,/НОСТРОЙ/);
  assert.match(a.text,/НОПРИЗ/);
  assert.equal(a.attachments[0].payload.buttons.length,3);
  assert.match(engineerNokReply(msg('🏗 НОСТРОЙ')).text,/990/);
  assert.match(engineerNokReply(msg('🌍 НОПРИЗ · изыскания')).text,/платный доступ пока не включены|Продажа и платный доступ пока не включены/);
});
test('bot refuses group messages and other bots',()=>{
  assert.equal(engineerNokReply({...msg('/nok'),message:{...msg('/nok').message,recipient:{chat_type:'group'}}}),null);
  assert.equal(engineerNokReply({...msg('/nok'),message:{...msg('/nok').message,sender:{user_id:301,is_bot:true}}}),null);
  assert.equal(engineerNokReply(msg('/start')),null);
});
test('existing paid course prices remain unchanged',()=>{
  assert.equal(CATALOG.autocad.price,1990);
  assert.equal(CATALOG.primavera.price,2490);
  assert.equal(CATALOG.bundle.price,3490);
  assert.equal(NOK_PRO_PRODUCTS.nok_all.price,1990);
});