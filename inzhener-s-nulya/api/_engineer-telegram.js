import { createHmac, timingSafeEqual } from 'node:crypto';
import { engineerSupportAnswer } from './_engineer-support.js';
import { CATALOG, json, readJson } from './_shared.js';

export const GROWTH_BOT = 'AnimaTactusGrowthBot';
const SITE = 'https://inzhener-s-nulya.vercel.app';

function derivedWebhookSecret(env=process.env){
  const base=String(env.ORDER_HMAC_SECRET||'');
  if(base.length<32)return'';
  return createHmac('sha256',base).update('telegram-webhook:AnimaTactusGrowthBot').digest('base64url');
}

// Pure reply builder: usable by the existing consumer without starting a poller.
export function engineerTelegramReply(update) {
  const m = update?.message;
  if (!Number.isSafeInteger(update?.update_id) || !m || m.chat?.type !== 'private'
      || m.from?.is_bot !== false || !Number.isSafeInteger(m.chat.id)
      || m.chat.id !== m.from.id || typeof m.text !== 'string') return null;
  const input = m.text.trim().slice(0, 1200);
  const [raw, arg = ''] = input.split(/\s+/, 2);
  const [command, mention] = raw.split('@');
  if (mention && mention.toLowerCase() !== GROWTH_BOT.toLowerCase()) return null;
  const source = command === '/start' && /^eng_[A-Za-z0-9_-]{1,60}$/.test(arg)
    ? arg.slice(4) : 'bot';
  const url = (path, hash = '') => `${SITE}${path}?src=tg_${source}${hash}`;
  const free = url('/free.html');
  const courses = url('/', '#courses');
  const support = url('/support');
  const replies = {
    '/start': `Инженер с нуля\n\nНачните с бесплатных заданий по AutoCAD и Primavera P6: ${free}\n\n/autocad — AutoCAD\n/primavera — Primavera P6\n/courses — курсы и цены\n/support — задать вопрос\n/access — доступ после оплаты`,
    '/autocad': `Бесплатный старт AutoCAD: команды и практическое задание.\n${url('/free.html', '#autocad')}`,
    '/primavera': `Бесплатный старт Primavera P6: структура проекта, работы и связи.\n${url('/free.html', '#primavera')}`,
    '/courses': `AutoCAD — ${CATALOG.autocad.price.toLocaleString('ru-RU')} ₽\nPrimavera P6 — ${CATALOG.primavera.price.toLocaleString('ru-RU')} ₽\nКомплект — ${CATALOG.bundle.price.toLocaleString('ru-RU')} ₽\n\nСодержание курсов и покупка: ${courses}`,
    '/support': `Напишите вопрос про AutoCAD, Primavera P6, выбор курса или получение материалов. Здесь отвечает автоматический помощник.\n\nПомощник на сайте: ${support}`,
    '/access': `После оплаты вернитесь на страницу своего заказа: там появится защищённая ссылка на материалы. Если деньги списаны, а доступа нет, не оплачивайте повторно. Порядок обращения: ${url('/contacts')}\n\nНе отправляйте сюда данные карты или секретную ссылку заказа.`
  };
  const aliases = { '/engineer': '/start', '/engineer_autocad': '/autocad', '/engineer_primavera': '/primavera', '/engineer_both': '/courses' };
  const text = replies[aliases[command] || command] || (command.startsWith('/')
    ? 'Выберите /start, /autocad, /primavera, /courses, /support или /access.'
    : engineerSupportAnswer(input).answer);
  return { method: 'sendMessage', chat_id: m.chat.id, text,
    link_preview_options: { is_disabled: true } };
}

export async function engineerTelegramWebhook(req, res, {
  env = process.env, fetchImpl = fetch
} = {}) {
  const secret = env.ENGINEER_TELEGRAM_WEBHOOK_SECRET
    || env.TELEGRAM_WEBHOOK_SECRET
    || derivedWebhookSecret(env);
  const supplied = req.headers?.['x-telegram-bot-api-secret-token'];
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret) || typeof supplied !== 'string')
    return json(res, 403, { error: 'forbidden' });
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json(res, 403, { error: 'forbidden' });
  const token = env.ENGINEER_TELEGRAM_BOT_TOKEN
    || env.GROWTH_TELEGRAM_BOT_TOKEN
    || env.TELEGRAM_BOT_TOKEN
    || env.ANIMA_TACTUS_TELEGRAM_BOT_TOKEN
    || '';
  if (!/^\d+:[A-Za-z0-9_-]{25,}$/.test(token)) return json(res, 503, { error: 'telegram_not_configured' });
  let update;
  try { update = await readJson(req); } catch { return json(res, 400, { error: 'invalid_update' }); }
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/getMe`, {
      method: 'POST', signal: AbortSignal.timeout(8000)
    });
    const identity = await response.json();
    if (!response.ok || !identity.ok || identity.result?.username !== GROWTH_BOT)
      return json(res, 503, { error: 'telegram_identity_unverified' });
  } catch { return json(res, 503, { error: 'telegram_identity_unverified' }); }
  // Telegram executes this reply. A 200 alone does not prove message delivery.
  return json(res, 200, engineerTelegramReply(update) || { ok: true });
}
