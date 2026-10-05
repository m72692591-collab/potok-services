# Telegram bot branding — @AnimaTactusGrowthBot

Target use: «Инженер с нуля».

## Profile

Name: **Инженер с нуля**

Short description:
**AutoCAD и Primavera P6 с нуля — практика, бесплатный старт и помощь 24/7.**

Description:
**Практический помощник проекта «Инженер с нуля». Бесплатный старт по AutoCAD и Primavera P6, ответы по курсам, оплате и доступу. Без обещаний трудоустройства и дохода.**

Commands:
- `/start` — Начать
- `/starter` — Практикум 490 ₽
- `/autocad` — Бесплатный старт AutoCAD
- `/primavera` — Бесплатный старт Primavera P6
- `/courses` — Курсы и цены
- `/support` — Помощник 24/7
- `/access` — Доступ после оплаты

Default menu button opens:
`https://inzhener-s-nulya.vercel.app/support?src=tg_menu`

## Safety

The configurator verifies `getMe.username == AnimaTactusGrowthBot` before any write.
It must not modify `@AnimaTactusPartner_bot`.
It must never print the token.

Script:
`scripts/configure-growthbot.ps1`
