# Voice Token Server

Этот сервер нужен, чтобы сотрудники не вставляли API key в браузер.
Ключ хранится только на сервере, а браузер получает короткоживущий ключ сессии.

## Что делают endpoint'ы

- URL: `POST /api/gemini-live-token`
- URL: `POST /api/openai-realtime-session`
- Проверяют доступ пользователя
- Выдают short-lived токен/ключ для голосовой сессии

## Что используется во фронте

- Фронт по умолчанию обращается к `"/api/gemini-live-token"`
- Если endpoint находится на другом домене, админ может указать URL в настройках 1 раз
- Значение endpoint сохраняется в Firebase и становится общим для всех пользователей
- Browser-side fallback через API key больше не поддерживается: если Gemini token endpoint недоступен, voice-режим не стартует
- Фронтенд отправляет Firebase ID token только на same-origin endpoint или на адрес из встроенного allowlist доверенных origins; произвольные URL из `app_config` будут отброшены ещё в браузере

## Переменные окружения (обязательные)

- `GEMINI_API_KEY`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_DATABASE_URL`

## Авторизация запроса

По умолчанию сервер принимает только:

1. `Authorization: Bearer <Firebase ID token>`

После проверки Firebase ID token сервер дополнительно сверяет доступ по RTDB в той же логике, что и основной сайт:
- deny при `access_revocations`
- deny при `users.isBlocked`
- deny при `passwordNeedsSetup`
- deny без подтверждённого email в user/invite state
- allow только для `admin`, corporate domain или активного invite

Небезопасный fallback по `login`/`email` в body отключен по умолчанию.
Если вам нужен legacy-режим для миграции, включайте его только временно через `ALLOW_LEGACY_LOGIN_FALLBACK=true`.
Полное совпадение access-политики гарантируется именно в ветке с Firebase ID token; legacy fallback оставлен только как временная совместимость на период миграции.

## Переменные окружения (важные)

- `ALLOWED_ORIGINS` — для браузерного использования фактически обязателен, например: `https://client-simulator.ru,https://www.client-simulator.ru`
- `ALLOWED_EMAIL_DOMAINS` — например: `tradicia-k.ru,tradicia-k.kz`
- `ALLOW_LEGACY_LOGIN_FALLBACK` — по умолчанию `false`, включать только временно для миграции
- `MAX_JSON_BODY_BYTES` — лимит JSON body, по умолчанию `65536`
- `GEMINI_LIVE_MODEL` — по умолчанию `gemini-3.1-flash-live-preview`
- `GEMINI_LIVE_VOICE` — по умолчанию `Enceladus`
- `OPENAI_REALTIME_MODEL` — по умолчанию `gpt-4o-realtime-preview-2025-06-03`
- `OPENAI_DEFAULT_VOICE` — по умолчанию `alloy`
- `PORT` — по умолчанию `8787`

## Локальная проверка

```powershell
npm install
Copy-Item server/.env.example server/.env.local
# заполните значения в server/.env.local вручную
```

Запуск:

```powershell
Get-Content server/.env.local | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $name, $value = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
}
npm run start:token-server
```

## Поведение валидации body

- Сервер принимает только JSON object body.
- Невалидный JSON получает `400`.
- Слишком большой body получает `413`.
- Пустой body по-прежнему допустим и трактуется как `{}`.
