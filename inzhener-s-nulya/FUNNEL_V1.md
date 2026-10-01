# Funnel v1: existing Telegram bot

## Решение

Для «Инженера с нуля» резервируется существующий `@AnimaTactusGrowthBot`. `@AnimaTactusPartner_bot` остаётся у Anima/«Точки роста» и не используется в инженерной воронке.

Новый Telegram bot, webhook, poller или второй Runtime не создаются. Это важно: у одного bot token должен оставаться один фактический consumer. Обработчики «Инженера с нуля» добавляются в существующий MAESTRO/Anima Runtime.

Каналы «Точка роста | Знакомство» и «Точка роста | Практикум» не переименовываются и не используются для публикации материалов «Инженера с нуля». Переиспользуется бот и существующий Telegram runtime/account bridge, а проекты остаются логически разделены.

## Что реализовано в магазине

- `/free.html` — бесплатный старт AutoCAD + Primavera P6.
- Главная ведёт холодного пользователя сначала в бесплатный набор.
- Публичная ссылка на бот: `https://t.me/AnimaTactusGrowthBot`.
- Deep link имеет форму `?start=eng_<source>`.
- Источник сохраняется в ссылках обратно на сайт как `src=tg_<source>`.
- Основные цены не меняются: 1 990 / 2 490 / 3 490 ₽.

## Что реализуется в существующем Anima Runtime

Feature gate:
```
ENGINEER_FUNNEL_ENABLED=1
ENGINEER_PUBLIC_URL=https://inzhener-s-nulya.vercel.app
```

Поддерживаются:
- `/start eng_<source>`
- `/engineer`
- `/engineer_autocad`
- `/engineer_primavera`
- `/engineer_both`

Контур «Точка роста» остаётся отдельно gated и не включается автоматически.

## Состояние GrowthBot на 2026-09-30

Bot API `getMe` подтвердил `@AnimaTactusGrowthBot` (ID 8161855271). Через Bot API заданы имя «Инженер с нуля», оба описания и шесть команд; значения проверены запросами `getMy*`. Токен сохранён только локально в Windows DPAPI, не в Git.

В существующей функции `/api/engineer-support?channel=telegram` подготовлен обработчик Telegram webhook с отдельным секретным заголовком и проверкой `getMe`. Он выключен флагом `ENGINEER_TELEGRAM_ENABLED=0`, пока не подтверждены облачное развёртывание и единственный consumer. Сайт уже возвращает `https://t.me/AnimaTactusGrowthBot` из `/api/public-info`.

Перед включением: сохранить `ENGINEER_TELEGRAM_BOT_TOKEN` и случайный `ENGINEER_TELEGRAM_WEBHOOK_SECRET` длиной 32–256 символов в секретах production; проверить, что других webhook/poller для GrowthBot нет; задеплоить функцию; только после этого вызвать `setWebhook` с URL `https://inzhener-s-nulya.vercel.app/api/engineer-support?channel=telegram` и параметром `secret_token`. Затем проверить `getWebhookInfo` и живые ответы команд. Ответ 200 от webhook сам по себе не доказывает доставку сообщения.

1 октября 2026 аватар из исходного файла `engineer_avatar_512.jpg` установлен через `setMyProfilePhoto`. Telegram подтвердил вызов; верхний `file_unique_id` сменился с `AQADshdrGzb5SEsB` на `AQADYBprG_bp8EkB`. Скачанное затем фото профиля визуально сверено с исходным. Исходный JPEG SHA-256: `3a4d7ecc235c4247c02f1fcaadb9b6eb2d7a4a0ce687912fb6279a2ab863eee9`.

## Следующий коммерческий этап

Продукт 490 ₽ пока не добавляется в Т-Бизнес. Сначала нужен готовый цифровой пакет «Первый рабочий день инженера» и приватная автоматическая выдача.

После готовности пакета:
1. добавить `starter` в `CATALOG`;
2. загрузить архив в приватный Blob;
3. добавить кнопку оплаты;
4. проверить Т-Бизнес → НПД → выдачу;
5. только после контрольной проверки включить его в воронку.
