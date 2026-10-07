import { bilingualText,LANGUAGE_NOTE } from './_engineer-language.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { engineerSupportAnswer } from './_engineer-support.js';
import { CATALOG, json, readJson } from './_shared.js';

export const GROWTH_BOT = 'AnimaTactusGrowthBot';
const SITE = 'https://inzhener-s-nulya.vercel.app';

export function engineerTelegramToken(env=process.env) {
  return String(
    env.ENGINEER_TELEGRAM_BOT_TOKEN
    || env.GROWTH_TELEGRAM_BOT_TOKEN
    || env.TELEGRAM_BOT_TOKEN
    || env.ANIMA_TACTUS_TELEGRAM_BOT_TOKEN
    || ''
  ).trim();
}

function derivedWebhookSecret(env=process.env){
  const base=String(env.ORDER_HMAC_SECRET||'');
  if(base.length<32)return'';
  return createHmac('sha256',base)
    .update('telegram-webhook:AnimaTactusGrowthBot')
    .digest('base64url');
}

export function engineerTelegramSecret(env=process.env) {
  const explicit = String(
    env.ENGINEER_TELEGRAM_WEBHOOK_SECRET
    || env.TELEGRAM_WEBHOOK_SECRET
    || ''
  ).trim();
  if (/^[A-Za-z0-9_-]{32,256}$/.test(explicit)) return explicit;
  return derivedWebhookSecret(env);
}

export function engineerTelegramWebhookUrl(req) {
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'inzhener-s-nulya.vercel.app';
  return `${proto}://${host}/api/engineer-support?channel=telegram`;
}

export async function ensureEngineerTelegramWebhook(req,{env=process.env,fetchImpl=fetch}={}) {
  const token = engineerTelegramToken(env);
  const secret = engineerTelegramSecret(env);
  const result = {
    tokenConfigured:/^\d+:[A-Za-z0-9_-]{25,}$/.test(token),
    webhookSecretConfigured:/^[A-Za-z0-9_-]{32,256}$/.test(secret),
    identityVerified:false,
    webhookConfigured:false,
    webhookMatchesExpected:false,
    pendingUpdates:null,
    autoConfigured:false
  };
  if (!result.tokenConfigured || !result.webhookSecretConfigured) return result;
  const api = `https://api.telegram.org/bot${token}`;
  const expected = engineerTelegramWebhookUrl(req);
  try {
    const meRes = await fetchImpl(`${api}/getMe`,{method:'POST',signal:AbortSignal.timeout(8000)});
    const me = await meRes.json().catch(()=>({}));
    result.identityVerified = Boolean(meRes.ok && me?.ok && me?.result?.username === GROWTH_BOT);
    if (!result.identityVerified) return result;

    let whRes = await fetchImpl(`${api}/getWebhookInfo`,{method:'POST',signal:AbortSignal.timeout(8000)});
    let wh = await whRes.json().catch(()=>({}));
    let url = String(wh?.result?.url||'');
    result.webhookConfigured = Boolean(whRes.ok && wh?.ok && url);
    result.webhookMatchesExpected = url === expected;
    result.pendingUpdates = Number.isFinite(Number(wh?.result?.pending_update_count))
      ? Number(wh.result.pending_update_count) : null;

    if (!result.webhookMatchesExpected) {
      const setRes = await fetchImpl(`${api}/setWebhook`,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          url:expected,
          secret_token:secret,
          allowed_updates:['message'],
          drop_pending_updates:false
        }),
        signal:AbortSignal.timeout(8000)
      });
      const set = await setRes.json().catch(()=>({}));
      if (setRes.ok && set?.ok) {
        result.autoConfigured = true;
        whRes = await fetchImpl(`${api}/getWebhookInfo`,{method:'POST',signal:AbortSignal.timeout(8000)});
        wh = await whRes.json().catch(()=>({}));
        url = String(wh?.result?.url||'');
        result.webhookConfigured = Boolean(whRes.ok && wh?.ok && url);
        result.webhookMatchesExpected = url === expected;
        result.pendingUpdates = Number.isFinite(Number(wh?.result?.pending_update_count))
          ? Number(wh.result.pending_update_count) : null;
      }
    }
    return result;
  } catch {
    return result;
  }
}

// Pure reply builder: the Telegram bot is the primary advertising landing.
export function engineerTelegramReply(update) {
  const m = update?.message;
  if (!Number.isSafeInteger(update?.update_id) || !m || m.chat?.type !== 'private'
      || m.from?.is_bot !== false || !Number.isSafeInteger(m.chat.id)
      || m.chat.id !== m.from.id || typeof m.text !== 'string') return null;

  const input = m.text.trim().slice(0, 1200);
  const [raw, arg = ''] = input.split(/\s+/, 2);
  const [commandRaw, mention] = raw.split('@');
  if (mention && mention.toLowerCase() !== GROWTH_BOT.toLowerCase()) return null;

  const source = commandRaw === '/start' && /^eng_[A-Za-z0-9_-]{1,60}$/.test(arg)
    ? arg.slice(4) : 'bot';

  const buyUrl = product =>
    `${SITE}/?buy=${encodeURIComponent(product)}&src=tg_${encodeURIComponent(source)}#courses`;

  const keyboard = {
    keyboard: [
      [{ text: '🎁 Бесплатный старт' }, { text: '⚡ Практикум 490 ₽' }],
      [{ text: '📐 AutoCAD 1 990 ₽' }, { text: '📅 Primavera P6 2 490 ₽' }],
      [{ text: '📦 Комплект 3 490 ₽' }],
      [{ text: '💬 Задать вопрос' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };

  const aliases = {
    '/engineer': '/start',
    '/engineer_autocad': '/autocad',
    '/engineer_primavera': '/primavera',
    '/engineer_both': '/courses',
    '🎁 Бесплатный старт': '/free',
    '⚡ Практикум 490 ₽': '/starter',
    '📐 AutoCAD 1 990 ₽': '/autocad_paid',
    '📅 Primavera P6 2 490 ₽': '/primavera_paid',
    '📦 Комплект 3 490 ₽': '/bundle',
    '💬 Задать вопрос': '/support'
  };
  const command = aliases[input] || aliases[commandRaw] || commandRaw;
  const fromAd = source.startsWith('vk_') || source.startsWith('tgads_') || source.startsWith('ad_');

  const replies = {
    '/start': fromAd
      ? `Инженер с нуля 👷\n\nВы пришли из рекламы — сайт открывать не нужно. Всё начинается здесь, в Telegram.\n\nМожно бесплатно попробовать две короткие задачи, купить практикум за 490 ₽ или сразу выбрать полный курс. Нажмите кнопку ниже.`
      : `Инженер с нуля 👷\n\nAutoCAD и Primavera P6 с нуля по рабочим задачам. Бесплатный старт, практикум 490 ₽ и полные курсы — выберите кнопку ниже.`,
    '/free': `Бесплатный старт — прямо здесь.\n\nAutoCAD: откройте учебный DWG/DXF, измерьте один известный размер командой DIST, проверьте слой объекта и поставьте контрольный размер DIM.\n\nPrimavera P6: создайте учебный Project, WBS из 3 блоков и 3 Activities, задайте длительности и свяжите их FS.\n\nЕсли получилось — практикум 490 ₽ даст полный «первый рабочий день» по обоим инструментам.`,
    '/autocad': `AutoCAD: начните с бесплатной задачи — DIST → слой → DIM. Если нужен полный путь от нуля до исполнительных схем, курс стоит ${CATALOG.autocad.price.toLocaleString('ru-RU')} ₽.\n\nКупить: ${buyUrl('autocad')}`,
    '/primavera': `Primavera P6: начните с Project → WBS → 3 Activities → связи FS. Полный 14-дневный курс стоит ${CATALOG.primavera.price.toLocaleString('ru-RU')} ₽.\n\nКупить: ${buyUrl('primavera')}`,
    '/starter': `«Первый рабочий день инженера» — AutoCAD + Primavera P6 за ${CATALOG.starter.price.toLocaleString('ru-RU')} ₽. Практика на 2–3 часа, два проверяемых результата и чек-лист ошибок.\n\nОплатить 490 ₽: ${buyUrl('starter')}`,
    '/autocad_paid': `AutoCAD с нуля для стройки и исполнительной документации — 21 день, ${CATALOG.autocad.price.toLocaleString('ru-RU')} ₽.\n\nОплатить: ${buyUrl('autocad')}`,
    '/primavera_paid': `Primavera P6 с нуля для строительства — 14 дней, ${CATALOG.primavera.price.toLocaleString('ru-RU')} ₽.\n\nОплатить: ${buyUrl('primavera')}`,
    '/bundle': `Комплект AutoCAD + Primavera P6 — оба полных курса за ${CATALOG.bundle.price.toLocaleString('ru-RU')} ₽.\n\nОплатить: ${buyUrl('bundle')}`,
    '/courses': `Первый рабочий день инженера — ${CATALOG.starter.price.toLocaleString('ru-RU')} ₽\nAutoCAD — ${CATALOG.autocad.price.toLocaleString('ru-RU')} ₽\nPrimavera P6 — ${CATALOG.primavera.price.toLocaleString('ru-RU')} ₽\nКомплект — ${CATALOG.bundle.price.toLocaleString('ru-RU')} ₽\n\nДля покупки нажмите нужную кнопку в меню ниже.`,
    '/support': `Просто напишите вопрос сюда обычным сообщением. Я отвечу по AutoCAD, Primavera P6, выбору курса, оплате и доступу. Владелец проекта вручную подключаться не должен.`,
    '/access': `После оплаты банк подтвердит платёж, чек НПД сформируется автоматически, а на странице заказа появится защищённая выдача материалов. Если деньги списались, не оплачивайте повторно — напишите сюда, что произошло.`
  };

  const rawText = replies[command] || (command.startsWith('/')
    ? 'Используйте кнопки меню ниже или просто напишите свой вопрос.'
    : engineerSupportAnswer(input).answer);

  return {
    method: 'sendMessage',
    chat_id: m.chat.id,
    text:bilingualText(rawText)+(command==='/free'?'\n\n'+LANGUAGE_NOTE:''),
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard
  };
}

export async function engineerTelegramWebhook(req, res, {
  env = process.env, fetchImpl = fetch
} = {}) {
  const secret = engineerTelegramSecret(env);
  const supplied = req.headers?.['x-telegram-bot-api-secret-token'];
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret) || typeof supplied !== 'string')
    return json(res, 403, { error: 'forbidden' });
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json(res, 403, { error: 'forbidden' });
  const token = engineerTelegramToken(env);
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

