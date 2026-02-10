# Gemini Token Server

Этот сервер выдает short-lived Gemini ephemeral token для голосового режима, чтобы не хранить `GEMINI_API_KEY` в браузере.

## Endpoint

- `POST /api/gemini-live-token`

## Что проверяется

- `Authorization: Bearer <Firebase ID token>`
- валидация токена через Firebase Identity Toolkit (`accounts:lookup`)
- опционально: whitelist доменов email через `ALLOWED_EMAIL_DOMAINS`

## Переменные окружения

- `GEMINI_API_KEY` — секретный Gemini API key (обязательно)
- `FIREBASE_WEB_API_KEY` — Firebase Web API key (обязательно)
- `ALLOWED_ORIGINS` — список origin через запятую (опционально)
- `ALLOWED_EMAIL_DOMAINS` — список разрешенных доменов email через запятую (опционально)
- `PORT` — порт сервера (опционально, по умолчанию `8787`)

## Локальный запуск

```bash
npm install
GEMINI_API_KEY=... \
FIREBASE_WEB_API_KEY=... \
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 \
npm run start:token-server
```

По умолчанию фронт будет обращаться к `"/api/gemini-live-token"`.
