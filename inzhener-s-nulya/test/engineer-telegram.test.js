import test from 'node:test';
import assert from 'node:assert/strict';
import { engineerTelegramReply as reply, engineerTelegramWebhook as webhook, engineerTelegramSecret, ensureEngineerTelegramWebhook } from '../api/_engineer-telegram.js';
const update = text => ({ update_id: 42, message: { text, chat: { id: 123, type: 'private' }, from: { id: 123, is_bot: false } } });
test('all requested commands route to the engineering site including paid starter', () => {
  for (const command of ['/start eng_smoke', '/starter', '/autocad', '/primavera', '/courses', '/support', '/access']) {
    const r = reply(update(command));
    assert.equal(r.chat_id, 123);
    assert.match(r.text, /https:\/\/inzhener-s-nulya.vercel.app\//);
    assert.doesNotMatch(r.text, /Partner_bot/);
  }
  assert.match(reply(update('/start eng_smoke')).text, /src=tg_smoke/);
  assert.match(reply(update('/autocad')).text, /#autocad/);
  assert.match(reply(update('/primavera')).text, /#primavera/);
  assert.match(reply(update('/starter')).text, /490 ₽/);
  assert.match(reply(update('/courses')).text, /490 ₽/);
});
test('ignores other bots, groups, forged chat identity and non-text updates', () => {
  assert.equal(reply(update('/start@AnimaTactusPartner_bot')), null);
  for (const mutate of [u => u.message.chat.type = 'group', u => u.message.from.is_bot = true,
    u => u.message.from.id = 999, u => delete u.message.text, u => delete u.update_id]) {
    const u = update('/start'); mutate(u); assert.equal(reply(u), null);
  }
});
const env = { ENGINEER_TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(40), ENGINEER_TELEGRAM_BOT_TOKEN: '123:' + 'x'.repeat(30) };
async function run(options = {}, headers = { 'x-telegram-bot-api-secret-token': env.ENGINEER_TELEGRAM_WEBHOOK_SECRET }) {
  const res = { status(n) { this.code = n; return this; }, setHeader() {}, end(s) { this.body = JSON.parse(s); } };
  await webhook({ body: update('/start eng_smoke'), headers }, res, { env, ...options });
  return res;
}
test('unconfigured or unauthenticated calls never reach Telegram', async () => {
  const fetchImpl = () => { throw new Error('must not call'); };
  assert.equal((await run({ env: {}, fetchImpl })).code, 403);
  assert.equal((await run({ fetchImpl }, {})).code, 403);
  assert.equal((await run({ fetchImpl }, { 'x-telegram-bot-api-secret-token': 'wrong' })).code, 403);
});
test('PartnerBot token and upstream errors fail closed', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true, result: { username: 'AnimaTactusPartner_bot' } }) });
  assert.equal((await run({ fetchImpl })).code, 503);
  assert.equal((await run({ fetchImpl: async () => { throw Error('network'); } })).code, 503);
});
test('verified GrowthBot returns Telegram webhook reply', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true, result: { username: 'AnimaTactusGrowthBot' } }) });
  const r = await run({ fetchImpl });
  assert.equal(r.code, 200); assert.equal(r.body.method, 'sendMessage');
  assert.match(r.body.text, /src=tg_smoke/);
});

test('derives a stable webhook secret from existing order secret', () => {
  const e={ ORDER_HMAC_SECRET:'q'.repeat(48), TELEGRAM_BOT_TOKEN:'123:'+'z'.repeat(30) };
  const a=engineerTelegramSecret(e), b=engineerTelegramSecret(e);
  assert.match(a,/^[A-Za-z0-9_-]{32,256}$/);
  assert.equal(a,b);
});

test('readiness helper self-configures GrowthBot webhook once', async () => {
  const e={ ORDER_HMAC_SECRET:'q'.repeat(48), TELEGRAM_BOT_TOKEN:'123:'+'z'.repeat(30) };
  const calls=[];
  const fetchImpl=async (url,opts={})=>{
    calls.push({url,opts});
    if(url.endsWith('/getMe')) return {ok:true,json:async()=>({ok:true,result:{username:'AnimaTactusGrowthBot'}})};
    if(url.endsWith('/getWebhookInfo')){
      const configured=calls.some(x=>x.url.endsWith('/setWebhook'));
      return {ok:true,json:async()=>({ok:true,result:{url:configured?'https://example.test/api/engineer-support?channel=telegram':'',pending_update_count:0}})};
    }
    if(url.endsWith('/setWebhook')) return {ok:true,json:async()=>({ok:true,result:true})};
    throw new Error('unexpected');
  };
  const req={headers:{host:'example.test','x-forwarded-proto':'https'}};
  const r=await ensureEngineerTelegramWebhook(req,{env:e,fetchImpl});
  assert.equal(r.identityVerified,true);
  assert.equal(r.webhookMatchesExpected,true);
  assert.equal(r.autoConfigured,true);
  assert.equal(calls.filter(x=>x.url.endsWith('/setWebhook')).length,1);
});
