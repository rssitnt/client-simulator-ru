# Client Simulator Studio

Тренажёр для проверки AI-агентов через чат, оценку диалога, подсказки менеджеру, аттестацию и голосовой режим.

Сейчас это уже не просто "страница с одним webhook", а полноценный фронт с:
- Firebase Auth + Realtime Database;
- единым `n8n` webhook для основных сценариев симулятора;
- отдельным webhook для аттестации;
- редактором инструкций с вариациями, историей, compare/publish/rollback;
- админкой, инвайтами, скрытым prompt клиента и presence-статусами;
- опциональным token server для безопасного voice flow.

## Что умеет сайт

- Разделённый интерфейс: чат слева, инструкции справа.
- Роли инструкций: клиент, менеджер, клиент в звонке, оценщик.
- Вариации промптов: public/draft, compare, publish, rollback, история.
- Единый `n8n` flow для `chat`, `chat_start`, `rating`, `manager_assist`, `improve`.
- Отдельный flow для аттестации.
- Markdown-ответы, подсветка кода, экспорт диалога и инструкций.
- Голосовой режим через безопасный token endpoint.
- Админский режим с пользователями, доступами, скрытым prompt и realtime presence.

## Основные файлы

- Фронтенд: `index.html`
- Основная логика: `script.js`
- Стили: `style.css`
- Firebase rules: `database.rules.json`
- Token server: `server/gemini-token-server.mjs`
- Локальный smoke: `scripts/smoke-e2e.mjs`
- Live integration smoke: `scripts/integration-smoke.mjs`

## Локальный запуск

Установка зависимостей:

```bash
npm install
```

Запуск статического фронта:

```bash
npx http-server -p 3001
```

После этого открой:

```text
http://127.0.0.1:3001/index.html
```

На localhost доступен dev-вход без боевой авторизации, чтобы быстро открыть интерфейс и тестировать UI.

## Проверка после изменений

Быстрый локальный smoke:

```bash
npm run test:smoke
```

Проверка с живым `n8n` webhook:

```bash
npm run test:smoke:integration
```

Важно:
- `test:smoke` использует локальные заглушки Firebase и не проверяет реальные боевые rules.
- `test:smoke:integration` зависит от сети и живого `n8n`, поэтому может падать из-за внешней недоступности.

## Текущая архитектура webhook

### Основной webhook симулятора

Фронт по умолчанию отправляет основные сценарии на:

```text
https://n8n-api.tradicia-k.ru/webhook/client-simulator
```

Через него идут:
- `chat`
- `chat_start`
- `rating`
- `manager_assist`
- `improve`

### Отдельный webhook аттестации

Для аттестации используется отдельный endpoint:

```text
https://n8n-api.tradicia-k.ru/webhook/certification
```

## Рекомендуемый контракт для n8n

Фронт отправляет `requestType` и несколько канонических полей:

```json
{
  "requestType": "chat",
  "inputText": "Сообщение пользователя",
  "historyText": "История диалога в текстовом виде",
  "systemText": "Активная инструкция",
  "sessionId": "session-id",
  "requestId": "request-id"
}
```

Для обратной совместимости фронт также добавляет alias-поля вроде:
- `chatInput`
- `userMessage`
- `dialogHistory`
- `systemPrompt`
- `prompt`
- `guardrailsInput`

Поэтому лучший паттерн на стороне `n8n` сейчас такой:

```text
Webhook -> Normalize Input -> AI Agent -> Respond to Webhook
```

Где `Normalize Input` приводит всё к одной схеме:
- `requestType`
- `inputText`
- `historyText`
- `systemText`
- `modeInstruction`

## Формат ответа от webhook

Поддерживаются:
- простая строка;
- `{ "message": "..." }`
- `{ "response": "..." }`
- `{ "output": "..." }`
- `{ "text": "..." }`
- объект с `conversationAction`.

Пример:

```json
{
  "message": "Понял, давайте уточним детали.",
  "conversationAction": {
    "type": "go_silent",
    "reason": "lost_interest"
  }
}
```

Поддерживаемые platform actions:
- `go_silent` — клиент временно замолчал, но его ещё можно вернуть;
- `end_conversation` — диалог завершён;
- для `end_conversation` фронт умеет запускать последующую оценку.

## Firebase и rules

Фронт использует не только базовые ветки `users`, `prompts`, `prompt_history`, но и:
- `prompt_overrides`
- `user_presence`

Поэтому после изменения `database.rules.json` правила нужно не просто закоммитить, а реально опубликовать в Firebase Realtime Database.

Если в Firebase Console остались старые rules, локальные изменения в репозитории сами по себе ничего не поменяют.

## Голосовой режим без API key в браузере

Чтобы сотрудники не вставляли API key вручную:

1. Поднимите token server из `server/gemini-token-server.mjs`.
2. Храните `OPENAI_API_KEY` только на сервере.
3. Фронт по умолчанию обращается к `POST /api/openai-realtime-session`.
4. Браузер отправляет Firebase ID token в `Authorization`.

Подробности и env-переменные: `server/README.md`.

### Быстрый запуск token server

```bash
cp server/.env.example server/.env.local
# заполните server/.env.local
npm run start:token-server
```

## Что важно помнить при доработках

- Не хранить long-lived API keys в браузере.
- `localhost` preview может менять только вид и локальный dev-flow, но не должен обходить реальные cloud-права.
- Реальные права админа определяются не UI-переключателем, а данными в Firebase.
- После фронтовых правок удобно сразу прогонять `npm run test:smoke`.
- После правок в auth / webhook / prompt sync лучше прогонять и `npm run test:smoke:integration`.
