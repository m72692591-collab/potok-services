import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import createPayment from './api/create-payment.js';
import download from './api/download.js';
import legal from './api/legal.js';
import npd from './api/npd.js';
import orderStatus from './api/order-status.js';
import publicInfo from './api/public-info.js';
import readiness from './api/readiness.js';
import refundTest from './api/refund-test.js';
import tbankWebhook from './api/tbank-webhook.js';
import testLastOrder from './api/test-last-order.js';
import yandexWebhook from './api/yandex-webhook.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const maxBodyBytes = 64 * 1024;

const apiRoutes = new Map([
  ['/api/create-payment', createPayment],
  ['/api/download', download],
  ['/api/npd', npd],
  ['/api/order-status', orderStatus],
  ['/api/public-info', publicInfo],
  ['/api/readiness', readiness],
  ['/api/refund-test', refundTest],
  ['/api/tbank-webhook', tbankWebhook],
  ['/api/test-last-order', testLastOrder],
  ['/api/yandex-webhook', yandexWebhook],
  ['/v1/webhook', yandexWebhook]
]);

const legalRoutes = new Map([
  ['/payment', 'payment'],
  ['/delivery', 'delivery'],
  ['/return', 'return'],
  ['/terms', 'offer'],
  ['/offer', 'offer'],
  ['/privacy', 'privacy'],
  ['/contacts', 'contacts'],
  ['/requisites', 'requisites']
]);

const staticRoutes = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/order.html', 'order.html'],
  ['/control.html', 'control.html'],
  ['/npd.html', 'npd.html'],
  ['/npd-connect.html', 'npd-connect.html']
]);

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function serveStatic(res, fileName) {
  const filePath = path.join(root, fileName);
  let size;
  try {
    size = statSync(filePath).size;
  } catch {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Length', size);
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(filePath).pipe(res);
}

function guardBodySize(req, res) {
  const declared = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    res.statusCode = 413;
    res.end('Payload Too Large');
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  res.status = code => {
    res.statusCode = code;
    return res;
  };

  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  req.query = Object.fromEntries(requestUrl.searchParams.entries());

  if (!guardBodySize(req, res)) return;

  try {
    const handler = apiRoutes.get(requestUrl.pathname);
    if (handler) {
      await handler(req, res);
      return;
    }

    const legalType = legalRoutes.get(requestUrl.pathname);
    if (legalType) {
      req.query.type = legalType;
      await legal(req, res);
      return;
    }

    const fileName = staticRoutes.get(requestUrl.pathname);
    if (fileName && (req.method === 'GET' || req.method === 'HEAD')) {
      serveStatic(res, fileName);
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not Found');
  } catch (error) {
    console.error('request_failed', requestUrl.pathname, String(error?.message || error));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Internal Server Error');
    }
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.listen(port, '0.0.0.0', () => {
  console.log(`inzhener-s-nulya listening on ${port}`);
});

export { server };
