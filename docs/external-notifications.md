# Внешние уведомления

Внутренние уведомления создаются всегда, если у пользователя включён канал `notifyInApp`.

## VK

Для входа через VK OAuth и безопасной привязки аккаунта нужны:

- `VK_CLIENT_ID`
- `VK_CLIENT_SECRET`

Для отправки сообщений в ЛС VK от имени сообщества нужны:

- `VK_GROUP_TOKEN`
- `VK_API_VERSION`, по умолчанию `5.199`

Пользователь может получать такие сообщения, если:

- у него включён канал `notifyVk`
- в профиле сохранён `vkUserId`
- он либо вошёл через VK OAuth, либо указал VK ID / ссылку вручную
- сообщество VK имеет право писать пользователю

## Telegram

Для входа через Telegram и для уведомлений через бота нужны:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`

Для защиты webhook Telegram дополнительно рекомендуется задать:

- `TELEGRAM_WEBHOOK_SECRET`

Пользователь может получать сообщения в Telegram, если:

- у него включён канал `notifyTelegram`
- в профиле сохранён `telegramChatId`
- он хотя бы один раз открыл бота по ссылке привязки из профиля

Telegram-вход работает через виджет Telegram Login Widget, а уведомления отправляются ботом напрямую через Bot API.

## Email

Для email-уведомлений используется webhook-канал:

- `EMAIL_NOTIFICATION_WEBHOOK_URL`
- `EMAIL_NOTIFICATION_FROM`

Webhook должен принимать JSON с полями `from`, `to`, `subject`, `text`, `metadata`.

Секреты и токены не хранятся в коде и задаются только через env.
