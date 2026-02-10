# Gemini Token Server

Этот сервер нужен, чтобы сотрудники не вставляли Gemini API key в браузер.
Ключ хранится только на сервере, а браузер получает короткоживущий `ephemeral token`.

## Что делает endpoint

- URL: `POST /api/gemini-live-token`
- Проверяет доступ пользователя
- Выдает short-lived токен для Gemini Live

## Что уже сделано во фронте

- Фронт по умолчанию обращается к `"/api/gemini-live-token"`
- Если endpoint находится на другом домене, админ может указать URL в настройках 1 раз
- Значение endpoint сохраняется в Firebase и становится общим для всех пользователей

## Переменные окружения (обязательные)

- `GEMINI_API_KEY`
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
