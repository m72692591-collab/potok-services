import test from 'node:test';
import assert from 'node:assert/strict';
import { engineerTelegramReply as reply, engineerTelegramWebhook as webhook } from '../api/_engineer-telegram.js';
const update = text => ({ update_id: 42, message: { text, chat: { id: 123, type: 'private' }, from: { id: 123, is_bot: false } } });
test('all requested commands route to the engineering site without paid starter', () => {
  for (const command of ['/start eng_smoke', '/autocad', '/primavera', '/courses', '/support', '/access']) {
    const r = reply(update(command));
    assert.equal(r.chat_id, 123);
    assert.match(r.text, /https:\/\/inzhener-s-nulya.vercel.app\//);
    assert.doesNotMatch(r.text, /(?:^|\n)490 ₽|Partner_bot/);
  }
  assert.match(reply(update('/start eng_smoke')).text, /src=tg_smoke/);
  assert.match(reply(update('/autocad')).text, /#autocad/);
  assert.match(reply(update('/primavera')).text, /#primavera/);
});
test('ignores other bots, groups, forged chat identity and non-text updates', () => {
  assert.equal(reply(update('/start@AnimaTactusPartner_bot')), null);
  for (const mutate of [u => u.message.chat.type = 'group', u => u.message.from.is_bot = true,
    u => u.message.from.id = 999, u => delete u.message.text, u => delete u.update_id]) {
    const u = update('/start'); mutate(u); assert.equal(reply(u), null);
  }
});
const env = { ENGINEER_TELEGRAM_ENABLED: '1', ENGINEER_TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(40), ENGINEER_TELEGRAM_BOT_TOKEN: '123:' + 'x'.repeat(30) };
async function run(options = {}, headers = { 'x-telegram-bot-api-secret-token': env.ENGINEER_TELEGRAM_WEBHOOK_SECRET }) {
  const res = { status(n) { this.code = n; return this; }, setHeader() {}, end(s) { this.body = JSON.parse(s); } };
  await webhook({ body: update('/start eng_smoke'), headers }, res, { env, ...options });
  return res;
}
test('disabled or unauthenticated calls never reach Telegram', async () => {
  const fetchImpl = () => { throw new Error('must not call'); };
  assert.equal((await run({ env: {}, fetchImpl })).code, 503);
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
