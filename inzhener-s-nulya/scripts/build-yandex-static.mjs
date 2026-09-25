import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import legalHandler from '../api/legal.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-yandex');
const legalPages = ['offer', 'privacy', 'payment', 'delivery', 'return', 'contacts', 'requisites'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

let index = await readFile(path.join(root, 'index.html'), 'utf8');
index = index.replace(
  "fetch('/api/readiness').then(r=>r.json()).then(d=>{",
  "fetch('/api/readiness').then(r=>r.json()).then(d=>{"
);
index = index.replace(
  /fetch\('\/api\/readiness'\)[\s\S]*?\.catch\(\(\)=>\{\}\);\r?\nfetch\('\/api\/public-info'\)[\s\S]*?\.catch\(\(\)=>\{\}\);/,
  `paymentsReady=false;
  const mode=document.getElementById('mode');
  mode.textContent='Продажи временно закрыты на время переноса защищённой оплаты и автоматических чеков НПД.';
  mode.style.display='block';
  document.getElementById('contactInfo').innerHTML='<div class="contact-grid"><div><b>Продавец:</b> ИП Григоров Михаил Владимирович<br><b>ИНН:</b> 640100982708<br><b>ОГРНИП:</b> 326045700090104</div><div><b>Телефон:</b> 8-969-621-34-70<br><b>Email:</b> grigorov555@mail.ru<br><b>Адрес:</b> с. Александров Гай, ул. Дома Газовиков, д. 21<br><b>Режим работы:</b> Ежедневно, 09:00–20:00 по московскому времени</div></div>';`
);
await writeFile(path.join(out, 'index.html'), index);

for (const type of legalPages) {
  let body = '';
  const res = {
    status() { return this; },
    setHeader() { return this; },
    end(value) { body = String(value); }
  };
  legalHandler({ query: { type } }, res);
  if (!body.startsWith('<!doctype html>')) throw new Error(`Legal page ${type} was not rendered`);
  await writeFile(path.join(out, type), body);
  await writeFile(path.join(out, `${type}.html`), body);
}

await writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');
await writeFile(path.join(out, '404.html'), '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Страница не найдена</title><body><main><h1>Страница не найдена</h1><p><a href="/">Вернуться на главную</a></p></main></body></html>');

console.log(`Built ${out}`);
