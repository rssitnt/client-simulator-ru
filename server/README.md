# Voice Token Server

Этот сервер нужен, чтобы сотрудники не вставляли API key в браузер.
Ключ хранится только на сервере, а браузер получает короткоживущий ключ сессии.

## Что делают endpoint'ы

- URL: `POST /api/gemini-live-token`
- URL: `POST /api/openai-realtime-session`
- Проверяют доступ пользователя
- Выдают short-lived токен/ключ для голосовой сессии

## Что используется во фронте

- Фронт по умолчанию обращается к `"/api/openai-realtime-session"`
- Если endpoint находится на другом домене, админ может указать URL в настройках 1 раз
- Значение endpoint сохраняется в Firebase и становится общим для всех пользователей

## Переменные окружения (обязательные)

- `OPENAI_API_KEY` (если используете OpenAI Realtime)
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_DATABASE_URL`

## Авторизация запроса

Сервер поддерживает 2 режима:

1. `Authorization: Bearer <Firebase ID token>` (предпочтительный)
2. Fallback по `login`/`email` в body, с проверкой доступа через RTDB (`users`, `partner_invites`) и `ALLOWED_EMAIL_DOMAINS`

## Переменные окружения (рекомендуемые)

- `ALLOWED_ORIGINS` — например: `https://client-simulator.ru,https://www.client-simulator.ru`
- `ALLOWED_EMAIL_DOMAINS` — например: `tradicia-k.ru,tradicia-k.kz`
- `GEMINI_LIVE_MODEL` — по умолчанию `gemini-2.5-flash-native-audio-preview-09-2025`
- `OPENAI_REALTIME_MODEL` — по умолчанию `gpt-4o-realtime-preview-2025-06-03`
- `OPENAI_DEFAULT_VOICE` — по умолчанию `alloy`
- `PORT` — по умолчанию `8787`

## Локальная проверка

```bash
npm install
cp server/.env.example server/.env.local
# заполните значения в server/.env.local вручную
```

Запуск:

```bash
set -a
source server/.env.local
set +a
npm run start:token-server
```
