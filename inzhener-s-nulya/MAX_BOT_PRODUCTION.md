# MAX bot — production profile

This bot mirrors the sales/support role of Telegram @AnimaTactusGrowthBot.

## Profile before moderation

Name: Инженер с нуля

Description:
Практический помощник по AutoCAD и Primavera P6 для строительства. Бесплатный старт, практикум «Первый рабочий день инженера», полные курсы, ответы по оплате и доступу. Без обещаний трудоустройства и дохода.

Avatar:
Use the same Engineer brand avatar as the website/Telegram brand.

## API after token is issued

Cloud readiness will automatically:
- verify GET /me is a bot;
- register commands /start, /free, /courses, /support through PATCH /me/commands;
- register HTTPS webhook /api/engineer-support?channel=max;
- subscribe to bot_started and message_created;
- derive a webhook secret from ORDER_HMAC_SECRET unless an explicit ENGINEER_MAX_WEBHOOK_SECRET is configured;
- expose the public MAX link only when the MAX token is configured.

Required secrets:
ENGINEER_MAX_BOT_TOKEN=<issued by MAX after bot moderation>
MAX_BOT_URL=https://max.ru/<actual_bot_username>

Do not commit the token to GitHub.

## Advertising source

Use:
https://max.ru/<actual_bot_username>?start=eng_vk_max_launch

Website remains a separate ad destination:
https://inzhener-s-nulya.vercel.app/?src=vk_site

Telegram remains a separate ad destination:
https://t.me/AnimaTactusGrowthBot?start=eng_vk_launch
