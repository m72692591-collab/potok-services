import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.PORT = '3187';
process.env.ORDER_HMAC_SECRET = 'test-secret-that-is-at-least-32-characters';

let server;
before(async () => {
  ({ server } = await import('../server.js'));
  await new Promise(resolve => server.listening ? resolve() : server.once('listening', resolve));
});
after(() => new Promise(resolve => server.close(resolve)));

async function get(path) {
  return fetch(`http://127.0.0.1:3187${path}`, { redirect: 'manual' });
}

test('serves storefront and all legal pages', async () => {
  for (const route of ['/', '/offer', '/privacy', '/payment', '/delivery', '/return', '/contacts', '/requisites']) {
    const response = await get(route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
});

test('keeps canonical prices in the storefront', async () => {
  const html = await (await get('/')).text();
  for (const price of ['1 990 ₽', '2 490 ₽', '3 490 ₽']) assert.match(html, new RegExp(price));
});

test('exposes API handlers and hides source files', async () => {
  assert.equal((await get('/api/public-info')).status, 200);
  assert.equal((await get('/package.json')).status, 404);
  assert.equal((await get('/.env')).status, 404);
});
