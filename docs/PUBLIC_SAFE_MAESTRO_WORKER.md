# Public-safe MAESTRO worker

Статус: `ZERO-COST PUBLIC CONTEXT WORKER`.

## Зачем

`Anima-Tactus` является приватным репозиторием, а GitHub Actions в нём сейчас имеет startup-блокер: jobs завершаются до первого шага. Этот worker размещён в публичном архивном репозитории только для задач, которые безопасно выполнять на публичном контексте: общие исследования, нейтральные контентные черновики, шаблоны и документы без секретов и персональных данных.

Он не заменяет приватный/local MAESTRO и не получает доступ к закрытому репозиторию.

## Обязательная карточка

```json
{
  "schema": 1,
  "task_id": "public-example-001",
  "status": "READY",
  "public_context_only": true,
  "action": "answer",
  "budget_rub": 0,
  "provider_policy": "free_only",
  "external_side_effects": "deny",
  "prompt": "Публично безопасная задача без секретов"
}
```

Для `write_files` модель может писать только в:

```text
public-output/<task-id>/
```

## Запрещено

- секреты, cookies, sessions, токены и OTP;
- приватный код или документы;
- персональные данные;
- банковские и медицинские записи;
- публикация в соцсетях;
- отправка сообщений;
- платежи;
- обход CAPTCHA и правил площадок;
- утверждение, что result применён в приватном проекте.

## Модель

```text
Ollama
qwen2.5-coder:0.5b
0 ₽
```

## Результат

```text
queue/receipts/<task-id>.json
queue/results/<task-id>.json
queue/results/<task-id>.md        # для answer
public-output/<task-id>/*          # для write_files
```

Каждая задача получает конечный `DONE` или `FAILED`. Результат остаётся публичным и перед использованием в приватном проекте должен быть проверен человеком/ChatGPT и перенесён отдельным изменением.
