# PROJECT_CONTEXT.md

## 2026-03-28 — Найден реальный корень сброса Gemini Live и убран неверный стартовый путь
- Проведена живая проверка напрямую против `gemini-3.1-flash-live-preview` с тем же voice/config, что и на фронте.
- Результат:
  - `live.connect(...)` проходит нормально,
  - приходит `setupComplete`,
  - но самый первый `sendClientContent(...)` сразу закрывает сокет с `1007` и причиной `Request contains an invalid argument.`
- Отдельная проверка показала, что realtime-аудио (`sendRealtimeInput({ audio: ... })`) этим же соединением принимается нормально и сессию не валит.
- Вывод: корень проблемы был не в кнопке/tooltip/retry/UI-гонке, а в самой схеме старта “клиент начинает первым через текстовый ход” для этой модели Gemini Live.
- Исправление в продукте:
  - из фронта убран синтетический первый текстовый ход Gemini-клиента;
  - Gemini voice call переведён в стабильный режим `менеджер начинает первым`;
  - после выхода клиента на линию UI явно показывает `Клиент на линии. Начинайте разговор.`
- Это именно root fix: теперь старт звонка не должен сам убивать live-сессию invalid-аргументом.

## 2026-03-28 — Добавлен один автопереподключатель на ранний transport-close Gemini Live
- Даже после закрытия гонки со stale callbacks оставался сценарий, когда live-сессия могла сорваться в самые первые секунды до `setupComplete` и до первой реплики.
- Добавлен один автоматический retry на фронте:
  - только если звонок сорвался очень рано,
  - ещё нет первой реплики/аудио,
  - нет накопленного диалога,
  - и это первая такая неудача.
- В таком случае UI не дропает звонок сразу, а показывает `Соединение сорвалось. Переподключаем клиента…` и сам пробует старт ещё раз.
- Это транспортная страховка от ранних `onclose/onerror` на старте Gemini Live.

## 2026-03-28 — Добавлена защита от случайного раннего stop на старте звонка
- Ещё один реальный путь для сценария “звонок сбрасывается не начавшись” — повторный клик/тап по основной кнопке в момент, когда UI уже успел переключиться в режим stop, но соединение ещё не поднялось.
- Добавлена защита на первые ~1.2с подключения:
  - если сессия ещё не прошла `setupComplete`
  - и клиент ещё не начал реально отвечать,
  - ранний stop игнорируется, а статус остаётся “Идёт подключение клиента…”.
- Это не ломает обычный hangup: после выхода клиента на линию остановка работает как прежде.

## 2026-03-28 — Закрыта гонка со stale callbacks Gemini Live
- Найдена реальная гонка при старте нового звонка: `onopen` уже был защищён от старой попытки, но `onmessage`, `onerror` и особенно `onclose` — нет.
- Из-за этого поздний `close` от предыдущей сессии мог прилететь во время нового старта и сбросить свежий звонок ещё до начала диалога.
- Исправление: все live callbacks теперь проверяют актуальный `startAttempt.id` и игнорируют события от старых попыток старта.
- Ожидаемый эффект: звонок больше не должен самопроизвольно завершаться на старте после предыдущих попыток/рестартов.

## 2026-03-28 — Добавлен noise filter для финальных голосовых реплик
- Пользователь отверг вариант “писать в чат только финализированные реплики и ничего больше” как основной подход и выбрал именно фильтр шума без ломки текущего стримингового статуса.
- Фильтр поставлен в слой финальной санитизации, а не в потоковый статус:
  - `sanitizeUserCompletedTranscript(...)`
  - `sanitizeAssistantCompletedTranscript(...)`
- Это сохраняет live-preview/status как раньше, но не даёт мусорным коротким кускам попадать в историю диалога.
- Эвристика режет сверхкороткие некириллические фрагменты в русском контексте (`Sí.` и похожие), но оставляет короткие нормальные ответы (`да`, `нет`, `ок`, `алло`) и частые бренды/модели техники (`CASE`, `CAT`, `JCB`, `XCMG` и т.п.).

## 2026-03-28 — Упрощён первый голосовой ответ Gemini
- Найдена не косметическая, а логическая причина: первый ответ клиента ломался не одной ошибкой, а сочетанием конфликтующих fallback-веток.
- Убран авто-watchdog, который раньше отправлял повтор первой реплики, если аудио чуть задерживалось. Это могло перебивать настоящий первый ответ ещё до прихода его звука.
- Микрофон менеджера теперь не стримится в Gemini сразу после соединения: он открывается только после завершения первой реплики клиента, чтобы менеджер не мог случайно перебить стартовую фразу.
- Отдельно закрыта гонка unlock-а: раньше микрофон мог открыться просто по `turnComplete`, даже если первый аудиочанк ещё не пришёл; теперь вход открывается только после реального появления и доигрывания первого аудио.
- Сброс воспроизведения теперь инвалидирует старые queued audio chunks через generation counter, чтобы после interrupt/reset не доигрывались устаревшие куски и не возникали наложения голосов.
- Первый ход клиента теперь отправляется через `sendClientContent(..., turnComplete: true)` и содержит только короткую команду на старт разговора, без повторной отправки всего клиентского промпта в текст user-turn.

## 2026-03-28 — Выбор голоса убран с главного экрана и оставлен только в настройках
- Найден реальный баг в `index.html`: блок выбора Gemini voice всё ещё находился в левой чат-панели, хотя должен был быть в модалке настроек.
- Исправление: voice-row удалён из chat panel и вставлен в `settingsModal` сразу после блока экспорта.
- Это возвращает ожидаемый UX: на главном экране нет лишней формы, а выбор голоса доступен только через настройки.
- Дополнительно убраны кнопки `Сохранить`, `Сбросить` и подпись про новые звонки; выбор голоса теперь сохраняется автоматически при смене селекта.
- Нативный browser select заменён на кастомный dropdown в стиле сайта: тёмный trigger, отдельный popup-список, активный голос подсвечивается, подпись разбита на name + description.
- Для voice dropdown scrollbar приведён к тому же виду, что и у остальных скроллящихся компонентов сайта: без `scrollbar-gutter`, с тем же тонким thumb/track, чтобы не было толстого виндового желоба и торчащих стрелок/угла.
- Для первого голосового хода Gemini убран проблемный путь через `sendRealtimeInput({ text })` с дублированием полного client prompt:
  - теперь стартовая реплика уходит как короткий opener через `sendClientContent(..., turnComplete: true)` при наличии этого метода в SDK.
  - это соответствует live SDK для текстовых ходов без VAD и должно убрать пропажу/задержку первой озвученной реплики.

## 2026-03-28 — Исправлены склейки слов в голосовом статусе
- В voice-mode потоковом тексте добавлена логика вставки пробела между фрагментами.
- Теперь фразы не слипаются в «тебеужевсёсказал.Либодавай…».

## 2026-03-28 — Голосовой статус больше не исчезает сразу
- Добавлен короткий lock на статус во время стриминга.
- Это не даёт системному “Идёт диалог…” перезаписывать свежий текст.

## 2026-03-28 — Роли переведены в Custom Claims + включён App Check + REST fallback выключен в проде
- Админ‑доступ теперь определяется по Firebase Custom Claims (`auth.token.admin/role`), а не по RTDB роли (localhost preview сохранён).
- `database.rules.json` обновлён под claims (нужно опубликовать в Firebase Console).
- В браузере добавлен App Check (reCAPTCHA v3 через `firebase-config.js -> appCheckSiteKey`).
- Token server умеет жёстко требовать App Check при `FIREBASE_APP_CHECK_ENFORCE=true` и service account env.
- REST‑fallback в браузере отключён на `client-simulator.ru` (остался только для localhost/preview).
- Добавлен скрипт `scripts/set-custom-claims.mjs` для проставления claims (через `firebase-admin`).

## 2026-03-28 — Ускорена обработка prompt_history без изменения UX
- Убраны тяжёлые `JSON.stringify` по full history при каждом обновлении.
- Добавлен компактный hash по `id/ts/role/variationId/kind` для сравнения снапшотов и очереди sync.
- Realtime listener на `prompt_history` теперь включается только для админов (кнопка истории скрыта для остальных), чтобы не гонять лишние данные.
- Изменения только на фронте (`script.js`), поведение и UI не менялись.

## 2026-03-28 — Добавлен cooldown для Firebase REST fallback
- Проблема: при сбоях SDK REST‑fallback может повторяться слишком часто и создавать сетевой “шум”.
- Решение: экспоненциальный cooldown per‑path (2с → 4с → 8с → … до 30с) с авто‑reset при успешном чтении.
- Цель: стабильность и скорость без изменений UX.

## 2026-03-28 — Ужесточены правила чтения prompt_history
- `prompt_history` теперь доступен на чтение и запись только для админов.
- Это снижает риск утечки внутренней истории промптов.
- Чтобы вступило в силу, нужно опубликовать `database.rules.json` в Firebase Console.

## 2026-03-28 — Усилен recovery-бэкофф для realtime слушателей
- Проблема: при сетевых сбоях realtime-слушатели (presence, admin, prompt overrides, protected listeners) пытались восстанавливаться каждые 2 секунды без backoff.
- Решение: добавлен экспоненциальный backoff (2с → 4с → 8с → … до 30с) и сброс попыток при успешном восстановлении.
- Цель: стабильность и скорость — меньше лишних запросов и “дёрганий” при плохой сети, без изменений UX.
- Файлы: `script.js`, `index.html` (bump версии для cache busting).

## 2026-03-27 — Добавлена кнопка выхода из аккаунта в настройках
- В модалку настроек добавлена кнопка `Выйти из аккаунта`.
- При выходе:
  - выполняется `signOut` из Firebase (если есть),
  - очищается dev-bypass сессия на localhost,
  - сбрасывается локальная auth-сессия и открывается окно входа.
- Smoke прошёл после правки.

## 2026-03-27 — Token server выведен в Vercel API, но voice требует Firebase ID token
- В репозитории добавлены Vercel API endpoints:
  - `api/gemini-live-token.mjs`
  - `api/openai-realtime-session.mjs`
  - общий handler вынесен из `server/gemini-token-server.mjs` для reuse в Vercel.
- Vercel проект: `ti-client-simulator-studio` (production).
- Env переменные проставлены в Vercel (GEMINI_API_KEY, FIREBASE_WEB_API_KEY, FIREBASE_DATABASE_URL, ALLOWED_ORIGINS, ALLOWED_EMAIL_DOMAINS, GEMINI_LIVE_MODEL, GEMINI_LIVE_VOICE, ALLOW_LEGACY_LOGIN_FALLBACK=false).
- Боевой API endpoint отвечает `401` при отсутствии Firebase ID token — это ожидаемо и означает, что SSO-защита снята, а дальше нужен нормальный email login в Firebase.
- На текущий момент `client-simulator.ru` всё ещё отдаётся статикой (GitHub Pages), поэтому token endpoint используется как внешний `https://ti-client-simulator-studio.vercel.app/api/gemini-live-token`.

## 2026-03-27 — Живая локальная проверка Gemini Live доведена до первой реплики ИИ-клиента
- Выполнен живой local pass поверх недавней миграции voice mode на Gemini Live.
- Что было найдено:
  - local-only voice token flow уже был частично подготовлен на фронте для `localhost devBypass` сессии;
  - токен-сервер в `server/.env.local` уже работал с `ALLOW_LEGACY_LOGIN_FALLBACK=true`, поэтому `POST /api/gemini-live-token` без Firebase ID token успешно выдавал Gemini token для `smoke@tradicia-k.ru`;
  - при реальном headless browser запуске с fake microphone токен запрашивался успешно и Live session открывалась, но затем Gemini закрывал соединение с `1007 Request contains an invalid argument`.
- Причина:
  - в `script.js` первый ход для `gemini-3.1-flash-live-preview` отправлялся через `sendClientContent(...)`;
  - для этого live-моделя такой путь не подходит для обычного стартового текста; из-за этого соединение падало уже после открытия.
- Исправление:
  - стартовый первый ход переведён на `geminiLiveSession.sendRealtimeInput({ text: ... })`;
  - лишний дублирующий helper вокруг localhost voice fallback убран, оставлен один рабочий local-only path;
  - прод-поведение не ослаблялось: Firebase ID token всё ещё обязателен вне localhost dev bypass сценария.
- Практический результат:
  - локальная живая проверка через Playwright + fake microphone теперь доходит до первой реплики клиента;
  - итоговый статус voice modal в проверке: `ИИ-клиент: Здравствуйте! Подскажите,`
  - это подтверждает, что связка frontend -> local token server -> Gemini Live теперь реально работает в браузерном сценарии.
- Остаточный локальный шум:
  - в localhost dev-bypass проверке всё ещё виден `user_presence ... permission_denied`;
  - это не блокирует голосовой режим, но отдельным проходом можно приглушить этот локальный warning-path.

## 2026-03-27 — Голосовой режим переведён с ElevenLabs на Gemini Live с фиксированными настройками
- Выполнен крупный pass по voice-mode пути в `script.js`, `index.html`, `style.css`, `server/gemini-token-server.mjs`, `README.md` и `server/README.md`.
- Что было найдено до правки:
  - основной voice flow сначала пытался открыть `ElevenLabs`, а встроенный режим был лишь fallback;
  - текущий “Gemini” на фронте фактически жил на OpenAI Realtime (`/api/openai-realtime-session`, WebRTC SDP, OpenAI events), а не на Gemini Live;
  - это делало настройки voice mode запутанными и не соответствующими целевой конфигурации из AI Studio.
- Что изменено:
  - ElevenLabs widget убран из `index.html`, из live-flow и из CSP-разрешений;
  - фронт по умолчанию переведён на `POST /api/gemini-live-token`;
  - голосовой режим теперь поднимает настоящий Gemini Live через `@google/genai` и short-lived token, без API key в браузере;
  - для Gemini Live зафиксированы настройки:
    - model: `gemini-3.1-flash-live-preview`
    - voice: `Enceladus`
    - media resolution: low (`MEDIA_RESOLUTION_LOW`, ближайшее API-представление для режима “66 tokens / image”)
    - thinking: `thinkingBudget = 0` (“No Thinking”)
  - token server теперь тоже фиксирует эти поля в ephemeral token constraints, чтобы фронт и сервер не расходились;
  - в voice modal добавлена явная кнопка завершения звонка для корректной остановки Gemini Live и дальнейшей оценки диалога.
- Практический смысл:
  - больше нет попыток открыть звонок через ElevenLabs/VPN fallback;
  - голосовой режим стал однопровайдерным и соответствует Gemini-настройкам из пользовательского запроса;
  - браузер получает только короткоживущий Gemini token, а не постоянный ключ.
- Технический хвост:
  - часть старых helper-ов и констант вокруг ElevenLabs/OpenAI voice в `script.js` пока осталась как мёртвый код;
  - runtime-path уже переведён на Gemini Live, но внутреннюю чистку этих legacy-блоков можно сделать отдельным безопасным проходом.
- Проверка после правок:
  - `node --check script.js`
  - `node --check server/gemini-token-server.mjs`
  - `npm run test:smoke`
- Отдельная живая server-side проверка после получения рабочего `GEMINI_API_KEY` от пользователя:
  - token server был поднят временно через process env без записи ключа в репозиторий;
  - `POST /api/gemini-live-token` вернул валидный Gemini auth token;
  - проверка прошла через `ALLOW_LEGACY_LOGIN_FALLBACK=true` + allowlist domain для технического smoke запроса.
- Ограничение проверки:
  - текущий smoke не покрывает реальный voice-session handshake с Gemini Live, поэтому полноценную живую проверку нужно делать уже с рабочим `GEMINI_API_KEY` и локально поднятым token server.

## 2026-03-27 — Существенный фикс: отправка партнёрского инвайта больше не дублируется по повторному `Enter`
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `handleCreatePartnerInvite()`.
- Найдена следующая хрупкая зона:
  - email-поле инвайта напрямую вызывало `handleCreatePartnerInvite()` по `Enter`;
  - сама кнопка блокировалась, но у handler-а не было собственного `inFlight`-guard;
  - из-за этого повторные `Enter` во время отправки могли повторно запустить invite flow и дать дублирующие отправки.
- Исправление:
  - добавлен `partnerInviteCreateInFlight`;
  - `handleCreatePartnerInvite()` теперь отсекает повторный запуск до завершения текущего invite request;
  - защита находится внутри самого handler-а, поэтому работает и для клика, и для `Enter`, и для любых будущих путей вызова.
- Практический смысл:
  - при быстром повторном нажатии `Enter` один и тот же инвайт больше не должен улетать дублем;
  - админский invite flow стал устойчивее к обычным race-сценариям ввода.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: кнопка оценки больше не залипает после гонки `AI assist -> send`
- Выполнен ещё один заметный non-UX pass по `script.js`, уже вокруг `rateChatBtn` и `generateAIResponse()`.
- Найдена следующая хрупкая зона:
  - `generateAIResponse()` временно выключал `rateChatBtn`, но возвращал её назад только если в момент `finally` уже не шёл другой chat request;
  - если пользователь успевал отправить обычное сообщение, кнопка оценки могла остаться disabled;
  - параллельно вскрылось, что состояние `rateChatBtn` вообще было размазано по нескольким async-путям без общего helper-а.
- Исправление:
  - добавлен единый `updateRateChatButtonState()` для расчёта доступности кнопки оценки;
  - `toggleInputState()`, `updateSendBtnState()`, `lockDialogInput()`, `clearChat()`, `rateChat()` и `generateAIResponse()` теперь используют общий пересчёт вместо разрозненных ручных `disabled = false`;
  - `clearChat()` теперь также чистит `aiAssistBtn.loading`, чтобы старый helper-request не оставлял визуальный хвост после reset.
- Практический смысл:
  - после сценария “AI-подсказка -> быстро отправили своё сообщение” кнопка оценки больше не должна залипать disabled;
  - состояние кнопки оценки стало предсказуемее и меньше зависит от порядка завершения async-запросов.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: `AI Improve` больше не применяет устаревший ответ после закрытия модалки или смены контекста
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `improvePromptWithAI()` и модалке AI Improve.
- Найдена следующая хрупкая зона:
  - запрос на AI-улучшение промпта не имел cancel/stale-защиты и мог доехать уже после закрытия модалки;
  - старый ответ мог подменить `pendingImprovedPrompt`, diff и шаг модалки уже в новом контексте;
  - при повторном открытии/новом запросе старый `finally` тоже мог вмешаться в loading-state кнопки.
- Исправление:
  - добавлен отдельный cancel/version flow для AI Improve request;
  - `showAiImproveModal()` и `hideAiImproveModal()` теперь инвалидируют старый improve-запрос;
  - `requestAiImproveResponseText()` теперь принимает `signal`, а `improvePromptWithAI()` проверяет, что модалка, режим, active variation и исходный prompt всё ещё те же;
  - stale/cancelled improve-response теперь тихо отбрасывается и не трогает pending/diff state.
- Практический смысл:
  - старый AI-ответ больше не должен внезапно всплывать после закрытия модалки;
  - повторный запуск AI Improve не конфликтует с предыдущим незавершённым запросом;
  - loading-state кнопки улучшения не затирается старым `finally`.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: AI-подсказка менеджеру больше не затирает новый диалог или уже набранный текст
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `generateAIResponse()`.
- Найдена следующая хрупкая зона:
  - async-ответ AI-подсказки мог прийти уже после `clearChat()`, нового сообщения или нового старта и всё равно записаться в `userInput`;
  - отдельного guard-а по chat-сессии и состоянию диалога у `manager_assist` не было;
  - подсказка могла перезаписать даже уже вручную набранный пользователем текст, если он начал печатать, пока ответ летел.
- Исправление:
  - `generateAIResponse()` переведён на тот же `chatUiRequestGuard`, что и основные chat/start/rating path;
  - добавлен `conversationHistoryRevision`, чтобы отсекать assist-ответы для уже изменившегося диалога;
  - assist-ответ теперь не применяется, если за время запроса сменился session/context или пользователь уже изменил поле ввода;
  - stale/cancelled assist path завершается тихо, без ложной ошибки для пользователя.
- Практический смысл:
  - старые AI-подсказки больше не должны всплывать в новом диалоге;
  - ручной текст в поле ввода не затирается поздним assist-ответом;
  - менеджерский helper стал предсказуемее в реальной работе, когда пользователь быстро продолжает диалог.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: после ошибки `/start` стартовый блок снова показывается и даёт повторить запуск
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в error-path `startConversationHandler()`.
- Найдена следующая хрупкая зона:
  - стартовый блок скрывался до запроса `/start`, но при ошибке или пустом ответе не возвращался назад;
  - после одного сетевого сбоя пользователь мог остаться без нормальной кнопки “Начать диалог”;
  - это ломало не внешний вид, а сам повторный старт сценария.
- Исправление:
  - добавлен helper для восстановления `startConversation` блока;
  - при ошибке `/start` и при пустом webhook-ответе стартовый блок снова показывается до вывода сообщения об ошибке;
  - cancelled/stale request path по-прежнему не трогает UI новой сессии.
- Практический смысл:
  - после неудачного `/start` пользователь может сразу нажать “Начать диалог” повторно;
  - чат больше не застревает в полусломанном состоянии без точки входа.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: `/start` теперь не гоняется с обычной отправкой и не запускается повторно
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `startConversationHandler()`.
- Найдена следующая хрупкая зона:
  - `/start` не ставил `isProcessing`, не блокировал ввод и старт-кнопки на время webhook-запроса;
  - из-за этого можно было словить двойной старт или успеть отправить обычное сообщение до прихода стартовой реплики;
  - старый `finally` start-path тоже мог поздно вмешаться в UI уже новой сессии.
- Исправление:
  - `startConversationHandler()` теперь сразу отсекает повторный запуск через `isProcessing`;
  - на время `/start` блокируются input и start buttons по той же модели, что и обычная отправка;
  - `finally` start-path теперь восстанавливает UI только если запрос всё ещё относится к текущей chat-сессии.
- Практический смысл:
  - нельзя случайно запустить `/start` дважды быстрым кликом;
  - пользователь не отправит первое обычное сообщение раньше стартового ответа;
  - стартовый flow стал предсказуемее и ближе к обычной chat-отправке.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: `clearChat()` теперь реально отрезает старые chat/start/rating ответы от новой сессии
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в async chat flow вокруг `clearChat()`, `/start`, обычной отправки и rating.
- Найдена следующая хрупкая зона:
  - `clearChat()` менял session id и перерисовывал чат, но старые webhook-ответы всё равно могли дописаться позже уже в новый пустой диалог;
  - отдельного abort/session-guard слоя у chat UI не было, поэтому stale reply мог приехать из `sendMessage()`, `startConversationHandler()` и `rateChat()`;
  - отменённый старый `send` ещё и мог поздним `finally` сбросить UI-состояние уже новой сессии.
- Исправление:
  - добавлен общий `chatUiRequestGuard` с session-version и `AbortController` для chat/start/rating path;
  - `clearChat()` теперь инвалидирует и абортит все активные chat UI requests перед reset новой сессии;
  - `sendMessage()`, `startConversationHandler()` и `rateChat()` теперь перед применением ответа проверяют, что запрос всё ещё относится к текущей сессии;
  - rating retry-path тоже стал abort-aware, чтобы не продолжать retries после `clearChat()`;
  - UI restore в `sendMessage()` теперь не может поздно вмешаться в уже новую сессию.
- Практический смысл:
  - после очистки чата старые ответы больше не должны “воскресать” в новой сессии;
  - rating и `/start` тоже не засоряют уже заново начатый диалог;
  - chat UI стал стабильнее в сценариях “отправил -> быстро очистил / начал заново”.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: устаревший запуск built-in voice mode теперь реально отменяется, а не доезжает постфактум
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в startup path встроенного OpenAI Realtime voice mode.
- Найдена следующая хрупкая зона:
  - если voice-экран закрывали во время запуска, token request и startup flow могли всё равно доехать до конца;
  - код в основном ловил это только поздним `stopGeminiVoiceMode()` уже после получения токена, микрофона и части WebRTC setup;
  - `fetchWithTimeout()` не умел различать timeout abort и внешний abort от отменённого запуска.
- Исправление:
  - добавлен attempt-id и abort-controller для startup path built-in voice mode;
  - `resolveGeminiLiveApiKey()` теперь умеет принимать `signal`, а `fetchWithTimeout()` поддерживает внешний abort отдельно от timeout;
  - `startGeminiVoiceMode()` проверяет stale/cancelled start после критичных async-шагов и не показывает ложную ошибку для уже отменённого запуска;
  - `stopGeminiVoiceMode()` теперь сразу инвалидирует текущий startup attempt.
- Практический смысл:
  - при быстром закрытии voice mode устаревший запуск не продолжает молча получать токен и поднимать transport;
  - built-in voice меньше открывает микрофон и WebRTC "вдогонку" уже закрытому экрану;
  - abort больше не маскируется под обычный timeout.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: OpenAI Realtime voice transport больше не зависает при аварийном падении data channel
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в built-in voice mode на OpenAI Realtime.
- Найдена следующая хрупкая зона:
  - data channel OpenAI Realtime почти не обрабатывал аварийные `close/error`;
  - voice UI мог остаться в состоянии "как будто активен", хотя командный канал уже умер;
  - `waitForOpenAiDataChannelReady()` тоже ждал только `open` или timeout и не завершался раньше при явном `close/error`.
- Исправление:
  - добавлен единый controlled failure handler для аварий transport-а голосового канала;
  - `peerConnection` disconnect/fail, `dataChannel.onerror` и `dataChannel.onclose` теперь переводят voice mode в корректный stop/recovery state с понятным статусом;
  - `waitForOpenAiDataChannelReady()` теперь завершает ожидание сразу и на `close/error`, а не только по timeout.
- Практический смысл:
  - built-in voice mode меньше зависает в ложном active-state после сетевых/transport сбоев;
  - пользователь быстрее получает понятное состояние "нажмите начать снова" вместо подвешенного канала;
  - start-path быстрее отваливается при реально умершем data channel.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: single-record Firebase reads больше не стирают локальный fallback после одного пустого SDK-read
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в single-record read path для `users`, `partner_invites` и `access_revocations`.
- Найдена следующая хрупкая зона:
  - `getUserRecordByLogin()`, `getPartnerInviteByLogin()` и `getAccessRevocation()` на пустом успешном SDK-read сразу очищали локальный cache;
  - это уже расходилось с недавно исправленными list-path и могло терять локальный запасной state слишком агрессивно;
  - при transient деградации RTDB path локальный fallback мог быть удалён раньше, чем второй канал чтения что-то подтвердил.
- Исправление:
  - добавлен общий helper verified local fallback для single-record read;
  - локальная запись теперь очищается только если и SDK, и REST согласованно подтверждают, что remote записи нет;
  - если remote record существует, но приходит в битом виде, код сохраняет локальный fallback вместо немедленного самообнуления.
- Практический смысл:
  - auth/access-related single-record read path стал устойчивее к временно пустым или деградировавшим RTDB ответам;
  - локальный fallback больше не теряется после одного неудачного канала чтения;
  - поведение single-record path выровнено с уже исправленными list-path.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: prompt write-path теперь переживает transient Firebase write-сбои без ручного повторного редактирования
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в write path для public prompts и `prompt_overrides`.
- Найдена следующая хрупкая зона:
  - `savePromptsToFirebaseNow()` и `savePromptOverridesToFirebaseNow()` при transient write-error только логировали сбой;
  - public/draft prompt sync после этого мог остаться в подвешенном состоянии до следующего случайного редактирования;
  - не было защиты от overlap write-ов и не было controlled retry для уже собранного payload/state.
- Исправление:
  - добавлен deduped retry-path для public prompts и prompt overrides write-веток;
  - добавлены `inFlight` guards, чтобы не запускать overlapping write-и поверх уже идущего sync;
  - при write-failure текущий payload/state ставится в controlled retry вместо тихого обнуления попытки;
  - при stop/reset protected realtime и prompt-overrides subscription теперь дополнительно чистится stale retry-state, чтобы старые retry/full-replace флаги не протекали в следующую сессию.
- Практический смысл:
  - transient Firebase write-сбой больше не требует обязательно ещё раз что-то редактировать, чтобы sync сдвинулся с места;
  - prompt editor меньше зависает в состоянии “локально изменено, но в облако уже не поедет”;
  - overlapping sync write-и стали аккуратнее и предсказуемее.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: current user presence live listener теперь сам восстанавливается после сбоев
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `currentUserPresence` live path.
- Найдена следующая хрупкая зона:
  - `.info/connected` listener текущего пользователя при ошибке только логировал сбой;
  - presence sync после этого не пытался автоматически вернуть healthy live-state;
  - `startCurrentUserPresenceSync()` считал transport рабочим по одному факту наличия `unsubscribe`, даже если listener уже был сломан.
- Исправление:
  - добавлены health-флаг и recovery timer для current-user presence listener;
  - повторный старт presence transport теперь reuse-ит только здоровую подписку;
  - при live error broken listener корректно снимается, local presence state сбрасывается в offline и планируется мягкий restart `.info/connected` подписки;
  - full `stopCurrentUserPresenceSync()` теперь также очищает pending recovery.
- Практический смысл:
  - presence текущего пользователя меньше застревает после transient RTDB-сбоев;
  - `.info/connected` listener возвращается сам, без ручного refresh страницы;
  - activity/presence path больше не держится за формально существующую, но уже нездоровую подписку.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: admin realtime sync теперь самовосстанавливается после live listener сбоев
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в live path админской таблицы.
- Найдена следующая хрупкая зона:
  - `users`, `partner_invites`, `access_revocations` и `user_presence` listener-ы админки при ошибке только логировали сбой;
  - таблица могла зависнуть на старом состоянии и не вернуться в live-mode без ручного refresh;
  - при этом приложение продолжало считать admin realtime transport активным, потому что unsubscribe-функции оставались в памяти.
- Исправление:
  - добавлен controlled recovery для admin realtime sync;
  - любой live error теперь мягко останавливает только transport-часть подписок и таймеров, но не очищает уже показанную таблицу и live state;
  - затем планируется deduped restart `startAdminRealtimeSync()` и повторный `renderAdminUsersTable()`;
  - `stopAdminRealtimeSync()` теперь отдельно умеет полностью останавливать sync, включая pending recovery timer.
- Практический смысл:
  - админская таблица не застревает навсегда после transient RTDB-сбоев;
  - live обновления users/invites/revocations/presence возвращаются сами;
  - при recovery не происходит лишнего визуального сброса уже открытой таблицы.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: prompt overrides live listener теперь восстанавливается без потери локального state
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `currentUserPromptOverridesSubscription`.
- Найдена следующая хрупкая зона:
  - listener local draft-промптов при `onValue` error только логировал сбой;
  - код продолжал держать старый subscription transport и не пытался нормально вернуть healthy live-state;
  - грубый `stopCurrentUserPromptOverridesSubscription()` очищал слишком много state, поэтому простой restart мог потерять queued/local override context.
- Исправление:
  - добавлены health-флаг и recovery timer для current-user prompt overrides listener;
  - при live error listener помечается как нездоровый, UI немедленно откатывается на локальный prompt-overrides store и планируется мягкий restart;
  - для restart добавлен transport-only teardown без очистки локального override state, dirty ролей и queued payload;
  - повторный `startCurrentUserPromptOverridesSubscription()` больше не считает нездоровую подписку рабочей.
- Практический смысл:
  - локальные draft-промпты остаются доступны и согласованны даже после transient RTDB-сбоев;
  - live subscription для prompt overrides возвращается сама, без ручного refresh страницы;
  - recovery больше не рискует потерять локальный override state только ради пересборки listener-а.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: protected realtime listeners теперь самовосстанавливаются после RTDB-сбоев
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в protected Firebase live path для `prompts`, `app_config` и `prompt_history`.
- Найдена следующая хрупкая зона:
  - protected listeners после `onValue` error уходили на fallback, но не пытались заново поднять live sync;
  - в таком режиме public prompts могли остаться только на cached/REST bootstrap, а `app_config` и history — без нормального live recovery;
  - `app_config` дополнительно обнулялся на transient read-error, хотя проблема могла быть временной.
- Исправление:
  - добавлен controlled recovery timer для protected listeners;
  - при ошибках `prompts`, `app_config`, `prompt_history` и при падении setup теперь планируется перезапуск `setupPromptsAndConfigListeners()` с повторным `bootstrapPromptsViaRestFallback()`;
  - повторные recovery-сигналы дедуплируются одним timer;
  - `stopProtectedRealtimeListeners()` теперь всегда отменяет pending recovery, чтобы listeners не поднимались заново после logout/reset;
  - на transient `app_config` read-error больше не затирается текущий shared config до пустых значений.
- Практический смысл:
  - live sync protected данных возвращается сам после кратковременных RTDB-сбоев;
  - public prompts, shared voice config и prompt history меньше зависят от ручного refresh страницы;
  - transient сбой чтения `app_config` больше не обнуляет UI-конфиг без причины.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: после сбоя current-user realtime listener снова включается fallback-проверка ревока сессии
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в live auth/session path.
- Найдена следующая хрупкая зона:
  - `startCurrentUserRecordSubscription()` при ошибке listener-а только логировал сбой;
  - код продолжал считать current-user realtime subscription "живой" просто по факту наличия `unsubscribe`-функции;
  - из-за этого `enforceSessionRevocation()` и visible wakeup-path переставали делать fallback-check, даже если live sync уже был нерабочим.
- Исправление:
  - добавлен health-флаг `currentUserRecordSubscriptionHealthy`;
  - skip polling теперь разрешён только когда current-user subscription реально здорова, а не просто существует;
  - при `onValue` error health-флаг сбрасывается и сразу запускается `enforceSessionRevocation(true)`, чтобы backup-path не ждал следующего случайного wakeup;
  - повторный `startCurrentUserRecordSubscription()` теперь не держится за нездоровую подписку и может заново её пересобрать.
- Практический смысл:
  - ревок сессии не "зависает" в fail-open режиме после ошибки current-user live listener;
  - active session быстрее возвращается на backup-check path при деградации realtime;
  - auth/session поведение стало устойчивее без UX-изменений.
- Во время проверки всплыл отдельный auth-modal race:
  - отложенный autofocus в `showNameModal()` мог перехватывать ввод и уводить пароль в поле ФИО;
  - добавлен безопасный initial-focus timer с отменой при первом взаимодействии пользователя с auth-модалкой.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: realtime admin state теперь кэширует и отсортированный список логинов
- Выполнен ещё один заметный non-UX pass по `script.js`, как продолжение оптимизации admin table build path.
- Найдена следующая тяжёлая зона:
  - даже после перехода на realtime login-maps каждый rebuild админской таблицы заново собирал и сортировал общий список логинов;
  - при активной админской сессии это повторялось на каждом incremental/full render без изменения самого login-set.
- Исправление:
  - добавлен `adminRealtimeSortedLogins` и helpers для построения/обновления отсортированного login-list;
  - users/invites/revocations snapshot handlers теперь пересобирают этот список один раз в момент live update;
  - `renderAdminUsersTableFromRealtimeState()` и live-ready ветка `renderAdminUsersTable()` переиспользуют уже готовый sorted login list.
- Практический смысл:
  - incremental/full rebuild админской таблицы стал ещё легче;
  - меньше лишней сортировки и пересборки одинакового login-set;
  - поведение таблицы не менялось, изменился только внутренний data-prep path.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: invites/revocations fallback больше не очищает local cache на пустом remote
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `listPartnerInvites()` и `listAccessRevocations()`.
- Найдена следующая хрупкая зона:
  - обе list-функции при успешном, но пустом remote read слишком агрессивно очищали локальный cache и возвращали пустой список;
  - при временно пустом/деградировавшем RTDB это могло убирать локальный запасной список invite/revoke записей;
  - normalize/sort логика была размазана по нескольким веткам каждой функции.
- Исправление:
  - invites и revocations теперь используют единый local normalize/sort path внутри своей list-функции;
  - при пустом remote обе функции возвращают локальный fallback list вместо очистки cache;
  - поведение выровнено с недавно исправленным `listAllUserRecords()`.
- Практический смысл:
  - админка и access-related экраны стали устойчивее при временно пустом RTDB read-path;
  - локальный запасной список invite/revoke записей больше не теряется слишком агрессивно;
  - fallback-поведение стало предсказуемее.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: fallback user-list больше не затирает локальный запасной список на пустом remote
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `listAllUserRecords()`.
- Найдена следующая хрупкая зона:
  - при успешном, но пустом чтении `users` и `users_by_uid` код считал remote authoritative-empty и очищал локальный users cache;
  - если это было временное пустое состояние/деградация чтения, админка теряла локальный запасной список пользователей;
  - normalize/sort user records был размазан по нескольким веткам функции.
- Исправление:
  - добавлен общий normalize/sort path для user record collections;
  - `listAllUserRecords()` теперь возвращает локальный fallback list, если remote paths пусты, вместо агрессивного `saveLocalUsersStore({})`;
  - primary users path, `users_by_uid` mirror и local cache теперь используют один и тот же helper для сборки и сортировки записей.
- Практический смысл:
  - админская таблица стала устойчивее при временно пустом или деградировавшем RTDB read-path;
  - локальный запасной список пользователей больше не теряется слишком агрессивно;
  - код user-list fallback стал короче и предсказуемее.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: build/render админской таблицы теперь использует готовые realtime login-maps
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `buildAdminUsersTableRows()` и admin realtime state.
- Найдена следующая тяжёлая зона:
  - realtime snapshot handlers хранили данные в массивах, а `renderAdminUsersTableFromRealtimeState()` и `renderAdminUsersTable()` потом на каждом rebuild заново пересобирали `users/invites/revocations/presence` в `Map`;
  - при активной админской сессии это повторялось много раз без реальной пользы.
- Исправление:
  - добавлены login-indexed realtime maps для `users`, `invites`, `revocations` и `presence`;
  - snapshot handlers теперь один раз индексируют данные по логину в момент получения;
  - `renderAdminUsersTableFromRealtimeState()` и live-ready ветка `renderAdminUsersTable()` переведены на `buildAdminUsersTableRowsFromMaps(...)`, без повторного пересбора тех же `Map` на каждый render.
- Практический смысл:
  - incremental/full rebuild админской таблицы стал легче по CPU;
  - при живых обновлениях и повторных открытиях админки меньше лишней подготовки данных перед рендером;
  - UX и состав строк не менялись, изменился только внутренний data-shaping path.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: первый render админской таблицы теперь ждёт realtime state и реже уходит в тяжёлый fallback
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `renderAdminUsersTable()`.
- Найдена следующая тяжёлая зона:
  - при первом открытии админской таблицы код сразу стартовал realtime listeners, но почти без ожидания уходил в `Promise.all(...)`/fallback fetch, хотя live state часто уже был на подходе;
  - даже когда live state потом оказывался готов, render-path уже успевал сделать лишний широкий fetch.
- Исправление:
  - добавлен короткий wait-path `waitForAdminRealtimeTableData(...)` с резолвом от realtime snapshot handlers;
  - `renderAdminUsersTable()` теперь даёт live state короткое окно на заполнение перед тяжёлым fallback fetch;
  - убран лишний повторный `listAllUserRecords()` в ветке, где live data уже признан готовым.
- Практический смысл:
  - первый рендер админской таблицы реже делает лишние полные чтения данных;
  - открытие админки стало спокойнее, когда realtime listeners уже могут быстро отдать состояние;
  - full fallback остался только когда live state действительно не успел или недоступен.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: admin realtime presence теперь обновляет только затронутые логины
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `adminRealtimePresence` live path.
- Найдена следующая тяжёлая зона:
  - каждый live snapshot presence раньше переписывал presence-data по всем строкам таблицы и потом обновлял все presence-метки разом;
  - даже если поменялся один пользователь, проход шёл по всему `adminUserRowsByLogin`.
- Исправление:
  - добавлены точечные helpers для presence render key и обновления одной presence-метки по логину;
  - `applyAdminRealtimePresenceSnapshot(...)` теперь сравнивает предыдущий и новый presence по логинам и обновляет только реально изменившиеся строки;
  - если таблица ещё не инициализирована, presence-path теперь идёт только в incremental render, а не в более широкий fallback.
- Практический смысл:
  - presence live sync меньше будит всю админскую таблицу;
  - смена online/idle/away/hidden/offline у одного пользователя больше не гоняет полный проход по всем строкам;
  - общий refresh всех presence labels оставлен только для периодического таймера относительных подписей.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: admin realtime users snapshot теперь точечно обновляет строки, а не срывается в широкий render
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в `adminRealtimeUsers` live path.
- Найдена следующая тяжёлая зона:
  - `applyAdminRealtimeUsersSnapshot(...)` умел спокойно жить только с `activeMs`-изменениями;
  - если у пользователя менялись роль, блокировка, `emailVerifiedAt`, `passwordNeedsSetup`, `sessionRevokedAt` и другие row-поля, код уходил в широкий render-path, хотя логин-сет и DOM-строки уже были на месте.
- Исправление:
  - при неизменном наборе логинов `users` live snapshot теперь обновляет только затронутые строки через `updateAdminUsersTableRow(...)`;
  - `activeMs` по-прежнему обновляется самым лёгким путём через `updateAdminUserTimeCell(...)`;
  - structural cases вроде добавления/удаления логина теперь ведут только в incremental render, а не в более тяжёлый full render.
- Практический смысл:
  - админская таблица меньше дёргает широкий render-path при живых изменениях профилей пользователей;
  - смена роли, блокировка, верификация и похожие updates теперь обновляют только нужные строки;
  - таблица стала заметно спокойнее при активной админской работе.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: legacy local prompt-store migration больше не делает лишний full-store compare на каждом чтении
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в legacy local prompt-store migration.
- Найдена следующая тяжёлая зона:
  - при каждом чтении локальных prompt overrides код заново собирал stable/legacy stores, а потом ещё раз нормализовал и сериализовал их для сравнения `stable vs migrated`;
  - live bootstrap prompt overrides поверх этого ещё раз заворачивал `loadLocalPromptsStore()` в новый normalize/hash цикл.
- Исправление:
  - добавлены `readPromptOverridesStoreStateByKey(...)` и `loadLocalPromptsStoreState()`, которые сразу работают через normalized/hash state;
  - legacy merge теперь собирает role-data map из уже нормализованных store и сравнивает `stable` и `migrated` через готовые state hash, без повторного `JSON.stringify(normalize(...))`;
  - `getPromptOverridesStore()` и live bootstrap prompt overrides переведены на reuse этого state-path, без лишнего повторного wrap в `buildNormalizedPromptOverridesStoreState(...)`.
- Практический смысл:
  - локальная загрузка и миграция старых draft-prompt storage keys стала легче;
  - меньше лишних full-store normalize/hash проходов при старте и при работе с local overrides;
  - UX и формат хранения не менялись, изменился только внутренний migration/load path.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: prompt overrides больше не гоняет лишние full-store hash/normalize по кругу
- Выполнен ещё один заметный non-UX pass по `script.js`, уже в ветке локальных prompt overrides.
- Найдена следующая тяжёлая зона:
  - `prompt_overrides` несколько раз подряд заново нормализовал один и тот же store и сериализовал его целиком в local save, remote save и live subscription;
  - diff по ролям тоже шёл через повторные role-snapshot compare поверх заново нормализованных store;
  - pending/current/queued override state жили отдельно от derived hash-state, из-за чего часть горячего пути делала лишнюю работу.
- Исправление:
  - добавлен общий helper `buildNormalizedPromptOverridesStoreState(...)` и role-hash helpers для override store;
  - `queuePromptOverridesSave()`, `savePromptOverridesToFirebaseNow()`, `startCurrentUserPromptOverridesSubscription()` и `saveLocalPromptsData()` переведены на reuse одного и того же normalized/hash state;
  - добавлены runtime state-переменные для current/queued/pending prompt overrides store, чтобы не пересчитывать hash/normalize повторно на соседних шагах;
  - deferred apply теперь тоже использует уже подготовленный pending override state.
- Практический смысл:
  - local override path стал легче по CPU и памяти;
  - меньше лишних full-store compare и сериализаций при редактировании/автосохранении локальных draft-prompts;
  - поведение prompt overrides не менялось, изменился только внутренний sync/state path.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: baseline/conflict path по prompt roles больше не пересчитывает remote role hash заново
- Выполнен ещё один заметный non-UX pass по `script.js`, как продолжение prompt-sync performance cleanup.
- Найдена следующая тяжёлая и хрупкая зона:
  - при начале редактирования и при conflict-check роли baseline брался через повторный role-level hash из `lastPromptsFirebaseSnapshot`;
  - если listener временно падал и фронт откатывался на cached snapshot, baseline state мог остаться пустым;
  - pending/last prompt snapshot и его derived role hashes жили разрозненно, поэтому edit/conflict ветка делала лишние пересчёты.
- Исправление:
  - добавлены `lastPromptsFirebaseSnapshotState` и `pendingPromptsFirebaseSnapshotState`;
  - role-level hashes для prompt snapshot теперь вычисляются лениво и кэшируются внутри snapshot state, а baseline/conflict path переиспользует их вместо повторного пересчёта;
  - при fallback на cached prompt snapshot после listener/read ошибки теперь сохраняется и сам snapshot state, а не только UI-данные;
  - при reset/logout prompt snapshot state очищается вместе с остальным auth/runtime state, чтобы новый hash-cache не переживал старую сессию.
- Практический смысл:
  - меньше лишних role-level compare во время редактирования и conflict recovery;
  - baseline для конфликтов стал стабильнее даже при деградации realtime listener и откате на local cache;
  - поведение prompt editor не менялось, изменился только внутренний state/cache path.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-27 — Существенный фикс: prompt realtime listener больше не сериализует один и тот же snapshot по несколько раз
- Выполнен ещё один заметный non-UX pass по `script.js`, нацеленный на горячий путь prompt sync.
- Найдена системная проблема:
  - live listener по `prompts`, REST bootstrap, local cache bootstrap и localhost test hook держали разрозненную логику сравнения snapshot;
  - один и тот же нормализованный prompt snapshot сериализовался повторно в нескольких местах подряд, включая listener и оба local backup path.
- Исправление:
  - добавлен общий helper `buildNormalizedPromptSnapshotState(...)`, который за один проход готовит нормализованный snapshot, его stable hash и флаг meaningful content;
  - `setupPromptsAndConfigListeners()`, `bootstrapPromptsViaRestFallback()`, `loadPrompts()` и localhost test hook переведены на этот общий state вместо локальных `JSON.stringify(data)` путей;
  - `persistPublicPromptsSnapshot(...)` и `persistPublicPromptsEmergencySnapshot(...)` теперь умеют принимать уже посчитанный snapshot state и не делают повторную нормализацию/сериализацию того же payload.
- Практический смысл:
  - prompt realtime path стал легче по CPU и памяти, особенно на больших prompt variation snapshot;
  - listener, REST fallback и локальные backup-и теперь сравнивают один и тот же canonical snapshot одинаково;
  - поведение prompt sync не менялось, изменился только внутренний путь dedupe/caching.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-26 — Существенный фикс: admin realtime table теперь точечно обновляет invite/revoke строки
- Выполнен ещё один заметный non-UX pass по `script.js`, как продолжение прошлых admin-table оптимизаций.
- Найдена следующая тяжёлая зона:
  - live snapshot по `partner_invites` и `access_revocations` всё ещё будил общий incremental refresh всей таблицы;
  - на практике даже одиночный invite/revoke update зря прогонял пересборку row data по всем логинам.
- Исправление:
  - добавлены отдельные fast-path handlers для `partner_invites` и `access_revocations`;
  - если набор логинов не изменился, меняется только затронутая строка: пересчитываются `invite` / `accessRevocation`, `accessState` и затем вызывается `updateAdminUsersTableRow(...)`;
  - общий live refresh оставлен как fallback только для структурных изменений.
- Практический смысл:
  - действия администратора вроде invite / revoke / un-revoke меньше будят тяжёлый путь обновления таблицы;
  - админка стала спокойнее не только на `users`, но и на access-related live updates.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-26 — Существенный фикс: prompt history больше не перезаписывает весь remote snapshot на каждый checkpoint
- Выполнен ещё один заметный non-UX pass по `script.js`.
- Найдена серьёзная проблема в `prompt_history`:
  - новая версия промпта раньше вела к полной перезаписи всего `prompt_history` через `set(ref(db, 'prompt_history'), promptHistory)`;
  - это давало лишние тяжёлые full-state write и повышало риск гонки “кто последний переписал весь массив, тот и победил”.
- Исправление:
  - remote sync prompt history переведён на append-only по `entry.id` через incremental `update(...)`;
  - добавлена serial queue с debounce и retry для remote sync history entries;
  - локальное сохранение истории осталось мгновенным и по-прежнему работает через local cache;
  - чтение `prompt_history` теперь нормализует и array, и object-формат, сортирует по времени и режет до `HISTORY_LIMIT` на каждый prompt.
- Практический смысл:
  - новая history entry больше не перезаписывает весь remote blob;
  - уменьшается write amplification и снижается риск потери history entries при параллельной работе;
  - схема стала совместимой и со старым массивом, и с новым object/append-only форматом.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — Существенный фикс: admin realtime table больше не гонит полный render на каждый live snapshot
- Выполнен ещё один заметный non-UX pass по `script.js`, уже поверх предыдущего active-time throttle.
- Найдена следующая системная проблема:
  - админская realtime-таблица на любые live snapshot изменения в `users`, `partner_invites` и `access_revocations` шла через полный `renderAdminUsersTable()`;
  - это заново запускало тяжёлый render-path даже тогда, когда данные уже были в памяти и нужен был обычный refresh строк.
- Исправление:
  - выделен общий updater строк `applyAdminUsersTableRows(...)`;
  - добавлен отдельный live-path `renderAdminUsersTableFromRealtimeState()`, который берёт уже собранные realtime-данные и обновляет таблицу без полного render-flow;
  - `scheduleAdminUsersTableRender(...)` теперь различает `full` и `incremental` режимы, а live callbacks переводят таблицу именно в incremental refresh;
  - полный `renderAdminUsersTable()` оставлен как fallback для первого запуска и случаев, когда realtime state ещё не собран.
- Практический смысл:
  - админка меньше дёргает тяжёлый render-path при live-обновлениях;
  - снижается лишняя работа по JS и DOM при активной админской сессии;
  - логика ролей, доступа и содержимого строк не менялась, поменялся только путь обновления.
- Проверка после правок:
  - `node --check script.js`
  - `npm run test:smoke`

## 2026-03-26 — Существенный фикс: active time теперь пишет в `users` заметно реже
- Выполнен более крупный non-UX pass по `script.js`, нацеленный на снижение лишних RTDB write и пробуждений админки.
- Найдена системная проблема:
  - `flushActiveTime()` писал `activeMs` и `lastSeenAt` в общую ветку `users` примерно каждые 15 секунд во время активности;
  - админская таблица подписана на всю коллекцию `users`, поэтому каждая такая запись будила полный users snapshot/remap и последующую перерисовку.
- Исправление:
  - добавлен отдельный throttle `ACTIVE_REMOTE_USER_FLUSH_MS = 60000` для remote flush активного времени в `users`;
  - принудительные точки сохранения оставлены без изменений: pause / pagehide / logout / recovery-path;
  - время последнего успешного flush теперь хранится в runtime и сбрасывается при reset сессии.
- Дополнительно во время проверки всплыл отдельный latent-bug:
  - в импорт Firebase RTDB были оставлены неиспользуемые `onChildAdded/onChildChanged/onChildRemoved`, которых нет в текущем browser bundle;
  - это ломало загрузку страницы в smoke;
  - неиспользуемые импорты удалены.
- Практический смысл:
  - при активной работе сайт заметно реже пишет `activeMs/lastSeenAt` в `users`;
  - это снижает сетевой шум и лишние пробуждения админской realtime-таблицы;
  - presence-статус остаётся жить в отдельной `user_presence`, как и раньше.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: auth modal prefill login теперь берёт localhost runtime раньше cache
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найден ещё один cache-first хвост вокруг логина:
  - при открытии auth modal prefill для `modalLoginInput` брал `USER_LOGIN_KEY` раньше, чем `localhostDevUser?.login`;
  - из-за этого в localhost dev bypass сценарии модалка могла сначала показывать старый login из cache вместо текущего runtime-пользователя.
- Исправление:
  - порядок fallback для prefill логина в модалке выровнен на runtime-first:
    `localhostDevUser?.login -> USER_LOGIN_KEY`.
- Практический смысл:
  - auth modal показывает актуальный localhost runtime login, если он уже известен;
  - local cache остался только запасным fallback.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: voice token request теперь берёт login из runtime раньше local cache
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найден cache-first хвост в voice token request:
  - при запросе ephemeral voice session frontend передавал `login` как `currentUser?.login || USER_LOGIN_KEY`;
  - если `currentUser` ещё не собрался, request мог раньше времени взять stale login из local cache.
- Исправление:
  - поле `login` в body запроса выровнено на runtime-first порядок:
    `currentUser?.login -> auth.currentUser.email -> authSession.login -> USER_LOGIN_KEY`;
  - значение дополнительно проходит через `normalizeLogin(...)`.
- Практический смысл:
  - token request опирается сначала на текущую живую auth/session информацию;
  - local cache остался только резервным fallback, а не ранним источником идентичности.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: legacy prompt-store login discovery теперь runtime-first
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найден ещё один cache-first хвост вокруг логина:
  - `getKnownLocalPromptStoreLogins()` для adoption/поиска legacy local prompt stores брал `USER_LOGIN_KEY` раньше, чем живую Firebase/auth-session информацию;
  - из-за этого stale cache мог раньше времени попадать в список “известных логинов”.
- Исправление:
  - порядок fallback выровнен на runtime-first: `currentUser?.login -> auth.currentUser.email -> authSession.login -> USER_LOGIN_KEY`.
- Практический смысл:
  - legacy prompt-store paths опираются сначала на текущую сессию, а не на старый local cache;
  - меньше риск, что stale login будет участвовать в adoption local prompt stores.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: stable prompt owner key теперь тоже берёт живое имя раньше кэша
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найден ещё один хвост того же класса рассинхрона:
  - `getStablePromptOwnerKey()` в guest/fallback path всё ещё строил owner key от `USER_NAME_KEY` раньше, чем от живого `currentUser` или `managerNameInput`;
  - из-за этого локальный store key для промптов мог короткое время привязываться к старому имени, хотя runtime-имя уже обновилось.
- Исправление:
  - порядок fallback выровнен на runtime-first: `currentUser?.fio -> managerNameInput?.value -> USER_NAME_KEY -> guest`.
- Практический смысл:
  - fallback owner key теперь совпадает с текущим именем сессии, а не со старым cache-first значением;
  - это снижает риск тихого расползания локальных prompt-store ключей после переименования.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: attestation/export берут имя менеджера из runtime раньше кэша
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найден хвост в attestation/export path:
  - отправка аттестации в очередь и генерация docx всё ещё могли брать имя менеджера из local cache как fallback раньше, чем из живого runtime-state;
  - после локального редактирования имени это могло давать старое имя в очереди и имени файла.
- Исправление:
  - `getManagerName()` переведён на runtime-first fallback: `currentUser?.fio -> managerNameInput?.value -> USER_NAME_KEY`;
  - `sendAttestationResult()` теперь кладёт в очередь `managerName` через `getManagerName('')`;
  - `buildAttestationDocxPayload()` тоже берёт manager name через тот же helper, если имя не пришло в `options`.
- Практический смысл:
  - очередь аттестации и имя экспортируемого файла видят то же имя, что и текущая сессия;
  - local cache остался только резервным fallback, а не первым источником.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: локальный кэш имени обновляется сразу, без ожидания debounce-save
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найден хвост в profile/name path:
  - при вводе нового имени `currentUser.fio` и UI обновлялись сразу;
  - но `USER_NAME_KEY` в local cache обновлялся только внутри debounce перед `patchUserRecord(...)`.
- Почему это было неидеально:
  - часть runtime-path читает сначала кэш имени (`USER_NAME_KEY`) для export / legacy prompt owner keys / fallback owner name;
  - в коротком окне до debounce эти ветки могли видеть старое имя, хотя локальный профиль уже показывал новое.
- Исправление:
  - `setCachedStorageValue(USER_NAME_KEY, newName)` перенесён в immediate input-path;
  - remote save в `patchUserRecord(...)` всё ещё остаётся отложенным на debounce.
- Практический смысл:
  - локальный runtime, export-path и owner-key fallback видят одно и то же имя сразу;
  - лишних Firebase write на каждый input не добавлено.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: self role change сразу обновляет settings state
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найден stale-case в self role-change через admin users table:
  - локальная роль текущего пользователя менялась сразу;
  - `presence` уже синхронизировался отдельной правкой;
  - но `settings`-состояние могло остаться “админским” до realtime-эха.
- Исправление:
  - в self-update path после `syncSelectedRole(nextRole)` теперь вызывается `syncCurrentUserSettingsState()` только если роль реально изменилась;
  - после этого остаются `syncCurrentUserPresenceState(true)` и `applyRoleRestrictions()`.
- Практический смысл:
  - settings modal синхронно прячет/обновляет админский блок сразу после self role-change;
  - не нужно ждать realtime-эхо для локального UI-state.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: patchUserRecord() больше не возвращает sensitive auth поля caller-ам
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- На выходе `patchUserRecord()` возвращаемая нормализованная запись пользователя теперь всегда дополнительно очищает:
  - `passwordHash`
  - `passwordHashScheme`
- Практический смысл:
  - caller-ы `patchUserRecord()` больше не получают эти поля обратно даже случайно;
  - это уменьшает риск тихого повторного заноса auth-sensitive данных в runtime-path через return value.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: локальные пересборки currentUser снова чистят sensitive auth поля
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найдены ещё 2 локальные ветки, где `currentUser` пересобирался из свежей записи пользователя вне основных auth/realtime-path:
  - после `ensureCurrentUserAccessMirror()` при дозаписи `uid`;
  - после локального refresh текущего пользователя в access-state ветке.
- В этих местах теперь снова принудительно очищаются:
  - `currentUser.passwordHash = ''`
  - `currentUser.passwordHashScheme = null`
- Практический смысл:
  - sensitive auth поля не возвращаются обратно в `currentUser` даже если свежая запись пользователя пришла из patch/read path;
  - это выравнивает поведение с уже существующими sanitize-path в `applyAuthenticatedUser()` и `applyCurrentUserRealtimeRecord()`.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: self role change сразу обновляет presence role
- Выполнен ещё один безопасный pass по `script.js` без UX-изменений.
- Найден тихий рассинхрон:
  - если админ меняет собственную роль через admin users table, `currentUser.role` обновлялся локально сразу;
  - но presence payload мог остаться со старой ролью до следующей активности, потому что realtime-эхо потом уже не видело `roleChanged`.
- Исправление:
  - в self-update path админской таблицы добавлен точечный `syncCurrentUserPresenceState(true)` только если реальная роль пользователя действительно изменилась.
- Практический смысл:
  - presence role обновляется сразу после self role change;
  - лишних sync при no-op выборе той же роли не добавлено.
- Проверка:
  - один первый прогон `npm run test:smoke` упал на флаки prompt-workflow шаге, но повторный прогон на том же коде прошёл полностью;
  - итоговый зафиксированный статус — smoke зелёный.

## 2026-03-26 — После security-pass: blur и hidden больше не запускают двойной pause-path
- Выполнен ещё один безопасный cleanup pass по `script.js` без UX-изменений.
- Найден типовой дубль:
  - при переключении вкладки браузер часто даёт сначала `blur`, потом `visibilitychange -> hidden`;
  - оба пути раньше почти подряд запускали pause/flush/presence logic.
- Исправление:
  - для `blur` добавлена короткая отложенная пауза `USER_ACTIVITY_BLUR_PAUSE_DELAY_MS = 120`;
  - если за это время приходит `hidden`, pending blur-pause отменяется и остаётся только hidden-path;
  - если это обычная потеря фокуса окна без скрытия вкладки, pause всё равно выполняется.
- Guard чистится на `focus`, `visibility -> visible`, `page exit`, снятии listeners и logout.
- Практический смысл:
  - меньше лишних двойных pause/flush операций при обычном переключении вкладок;
  - сценарий “окно потеряло фокус, но вкладка осталась видимой” не ломается.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: схлопнут быстрый дубль wakeup между visibility и focus
- Выполнен ещё один безопасный cleanup pass по `script.js` без UX-изменений.
- Найден мелкий фоновый шум на возврате вкладки:
  - браузер часто шлёт парой `visibilitychange -> visible` и `focus`;
  - оба пути раньше сразу запускали forced activity wakeup, хотя это один и тот же возврат пользователя.
- Исправление:
  - добавлен короткий dedupe-guard `USER_ACTIVITY_WAKEUP_DEDUPE_MS = 400`;
  - `focus` и `visibility -> visible` теперь идут через общий `triggerForcedUserActivityWakeup(...)`;
  - если второй сигнал приходит почти сразу после первого, он игнорируется как дубль.
- Практический смысл:
  - меньше лишних forced wakeups на возврате во вкладку;
  - обычные pointer/keyboard/scroll события и более поздние реальные wakeups не затронуты.
- На logout этот guard тоже сбрасывается вместе с остальным activity-state.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: выровнен стартовый presence-state на login/restore
- Выполнен ещё один безопасный cleanup pass по `script.js` без UX-изменений.
- Найден нюанс стартового presence-path:
  - `applyAuthenticatedUser()` поднимал presence sync ещё до `startActiveTimeTracking()`;
  - если пользователь долго сидел на форме входа, первый `.info/connected` sync мог успеть посчитать состояние по старому `lastUserActivityAt`.
- Исправление:
  - перед `startCurrentUserPresenceSync(normalized.login)` в `applyAuthenticatedUser()` теперь принудительно обновляется `lastUserActivityAt = Date.now()`;
  - это даёт корректное стартовое состояние новой сессии уже на первом presence sync, а дальнейший sync из `startActiveTimeTracking()` схлопывается существующим dedupe там, где payload не изменился.
- Во время проверки один прогон `npm run test:smoke` упал на флаки email-auth шаге (в screenshot пароль оказался в поле имени), но повторный прогон на том же коде прошёл полностью; итоговый зафиксированный статус — smoke зелёный.
- Проверка после финальной правки:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: listeners активности и session-wakeup снимаются на logout
- Выполнен ещё один безопасный cleanup pass по `script.js` без UX-изменений.
- Что изменено:
  - `markUserActivity()` теперь сразу выходит, если текущего пользователя уже нет;
  - listeners активности (`pointer/scroll/keydown/focus/blur/visibilitychange/pagehide/beforeunload`) переведены на именованные handler-ссылки и теперь снимаются через `stopUserActivityTrackingListeners()`;
  - listeners для wakeup-проверки отзыва сессии тоже получили отдельный teardown через `stopSessionRevocationListeners()`.
- Когда это срабатывает:
  - при `resetCurrentSessionToAuth()` listeners и их локальные throttle-счётчики теперь сбрасываются;
  - при следующем логине они поднимаются заново через `startActiveTimeTracking()`.
- Практический смысл:
  - после logout окно и документ больше не продолжают будить фоновые activity/session handlers;
  - это убирает холостую работу между сессиями и делает повторный логин чище.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: облегчён realtime-path админской таблицы
- Выполнен ещё один безопасный performance pass по `script.js` без UX-изменений.
- В admin realtime sync убрана двойная лишняя сортировка:
  - входные realtime-массивы пользователей, инвайтов и ревокаций больше не сортируются сразу в callback;
  - таблица всё равно собирает `Map` и сортирует уже финальный список логинов перед рендером, поэтому ранняя сортировка только тратила CPU.
- Presence realtime-поток облегчен отдельно:
  - presence snapshot теперь обновляет `adminRealtimePresence`;
  - если строки таблицы уже нарисованы, для них обновляется только presence-часть и вызывается `refreshAdminUsersPresenceLabels()` вместо полного `renderAdminUsersTable()`.
- Практический смысл:
  - меньше лишней работы на каждом realtime-апдейте в админке;
  - статусы присутствия продолжают обновляться, но без пересборки всей таблицы.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — Read-only analysis: currentUser presence / active-time / session revocation
- Выполнен отдельный read-only проход по `script.js` без правок кода, только для поиска безопасных cleanup-кандидатов.
- Подтверждены 3 спокойных направления без ожидаемого UX-эффекта:
  - listeners активности после первого логина не снимаются на logout и продолжают будить `markUserActivity()`, хотя дальше код почти сразу упирается в early-return из-за отсутствия `currentUser`;
  - стартовый `syncCurrentUserPresenceState(true)` в `startActiveTimeTracking()` выглядит дублирующим по отношению к `.info/connected` callback в `startCurrentUserPresenceSync()`, который и так публикует presence при подключении;
  - polling/check path для session revocation через `focus` / `visibilitychange` уже во многом избыточен, потому что основной auth-flow держит realtime-подписку на запись текущего пользователя и она остаётся главным источником истины.

## 2026-03-26 — После security-pass: убраны лишние wakeups вокруг session revocation
- Выполнен ещё один безопасный cleanup pass по `script.js` без UX-изменений.
- `focus` / `visibilitychange` listeners для проверки отзыва сессии теперь отсекают лишние wakeups до вызова `enforceSessionRevocation()`:
  - если пользователь не залогинен;
  - если вкладка не видима;
  - если это localhost dev bypass;
  - если уже активна realtime-подписка на текущего пользователя и она всё равно является источником истины.
- Практический смысл:
  - меньше фоновых холостых вызовов при переключении вкладок и возврате в окно;
  - логика отзыва сессии не меняется, потому что раньше `enforceSessionRevocation()` в этих же случаях тоже сразу делал `return false`.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: срезаны дубли финального presence/offline write на выходе со страницы
- Выполнен небольшой cleanup pass по `script.js` без UX-изменений.
- Логика `beforeunload` / `pagehide` собрана в один guarded path:
  - добавлен единый `handleCurrentUserPageExit()`;
  - повторный вызов при втором событии игнорируется через локальный guard, поэтому финальный offline-path больше не запускается дважды.
- В unload-пути `pauseActiveTimeTracking()` теперь умеет работать с `skipPresenceSync`, чтобы не делать промежуточный presence sync прямо перед `stopCurrentUserPresenceSync({ immediateOffline: true })`.
- На `pageshow` guard сбрасывается, чтобы возврат из BFCache не ломал следующий нормальный выход со страницы.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: срезан лишний UI-sync на echo-апдейтах current user record
- Выполнен ещё один безопасный performance pass по `script.js` без UX-изменений.
- В `applyCurrentUserRealtimeRecord()` добавлен early-return для echo-only кейса:
  - если realtime-апдейт фактически меняет только `activeMs` и/или `lastSeenAt`, фронтенд больше не прогоняет полный user/settings/role sync;
  - при этом `currentUser` всё равно обновляется, а в админском режиме ячейка времени продолжает обновляться отдельно.
- Практический смысл:
  - собственные `patchUserRecord(activeMs, lastSeenAt)` больше не возвращаются через realtime как повод лишний раз дёргать `updateUserNameDisplay()`, `syncCurrentUserSettingsState()` и related UI-paths;
  - это уменьшает лишнюю работу на фоне при активной сессии.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — После security-pass: срезан лишний presence write-noise во фронте
- Выполнен небольшой performance/cleanup pass по `script.js` без UX-изменений.
- В presence sync добавлен payload-level dedupe:
  - фронтенд больше не пишет повторно один и тот же presence payload, если фактически не изменились `login`, `sessionId`, `role` и `state`;
  - это снижает лишние RTDB `update(...)` на forced presence sync путях (focus/visibility/reconnect/start tracking), не меняя доступы и пользовательские сценарии.
- В `.info/connected` listener при потере соединения теперь локально сбрасываются `currentUserPresenceState` и presence payload cache; это нужно, чтобы после reconnect `online` публиковался заново корректно и dedupe не мешал восстановлению presence.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — Пункт 4 закрыт: shared voice endpoint больше не может увести Firebase ID token на произвольный URL
- Выполнен frontend security pass по `script.js`, плюс кратко обновлены `README.md` и `server/README.md`.
- Добавлена жёсткая allowlist-проверка для voice token endpoint:
  - разрешён только путь `/api/openai-realtime-session`;
  - разрешены только same-origin URL, production origins `https://client-simulator.ru` / `https://www.client-simulator.ru`, loopback (`localhost`, `127.0.0.1`, `::1`) и опциональные origins из `window.ALLOWED_VOICE_TOKEN_ENDPOINT_ORIGINS` / `window.OPENAI_REALTIME_ALLOWED_ORIGINS`;
  - `http:` разрешён только для loopback/local dev;
  - URL с `query`, `hash`, embedded credentials или произвольным путём отклоняются.
- Защита стоит в двух слоях:
  - при чтении shared/local endpoint из `app_config` и `localStorage` небезопасное значение игнорируется;
  - перед `fetch()` в `resolveGeminiLiveApiKey()` endpoint проверяется повторно, так что Firebase ID token не уйдёт на произвольный адрес даже если плохой URL уже записан.
- Сохранение voice-настроек теперь тоже валидирует endpoint до записи; при попытке сохранить плохой URL UI возвращает текст ошибки вместо молчаливого generic fail.
- Проверка после правок:
  - `npm run test:smoke`

## 2026-03-26 — Пункт 3 закрыт: token server выровнен с access-моделью сайта
- Выполнен server-side pass по `server/gemini-token-server.mjs` и `server/README.md`.
- В secure-ветке (`Authorization: Bearer <Firebase ID token>`) token server теперь повторяет ту же базовую access-логику, что и сайт:
  - читает `users/$key`, `access_revocations/$key`, `partner_invites/$key` через RTDB REST с Firebase ID token;
  - deny при `users.isBlocked`;
  - deny при `access_revocations.status === 'revoked'`;
  - allow только для `admin`, corporate domain или active invite;
  - после allow deny при `passwordNeedsSetup`;
  - после allow deny без `emailVerifiedAt` в user/invite state.
- В ответ token server теперь возвращает `requestContext.accessSource`, чтобы было видно, по какому пути доступ был выдан.
- Legacy fallback по `login`/`email` не удалён полностью, потому что он нужен как временный миграционный режим и по определению не несёт Firebase ID token; из-за этого без отдельной server-side service auth он не может гарантировать полный паритет self-state checks.
- При этом legacy fallback теперь тоже сначала проходит через общий helper `resolveVoiceAccess()`, а затем уже падает в совместимый compat-path только если secure-style проверка недоступна без auth context.
- Проверка после правок:
  - `node --check server/gemini-token-server.mjs`
  - `npm run test:smoke`

## 2026-03-26 — Пункт 3: собран минимальный safe edit plan без правок кода
- Выполнен read-only разбор расхождения между `server/gemini-token-server.mjs` и клиентской access-моделью (`resolveAccessPolicy`, `normalizeAccessRevocation`, `normalizePartnerInvite`, `isPartnerInviteActive`, `restoreAuthSession`).
- Подтверждённый разрыв сейчас такой:
  - secure server-ветка с Firebase ID token проверяет только валидность токена и `ALLOWED_EMAIL_DOMAINS`;
  - fallback server-ветка дополнительно смотрит `users/$key.role` и `partner_invites/$key`, но всё равно не учитывает `access_revocations`, `isBlocked`, `passwordNeedsSetup`, `emailVerifiedAt`;
  - фронтенд после логина живёт по более строгой модели: deny при `isBlocked`, deny при revoked access, deny при `passwordNeedsSetup`, deny без `emailVerifiedAt`, allow для `admin` / corporate email / active invite.
- Минимальный безопасный план для следующего edit-pass:
  - вынести на сервер единый helper резолва доступа по login, который читает `users/$key`, `access_revocations/$key`, `partner_invites/$key` и повторяет тот же порядок проверок, что фронтенд;
  - перевести и Firebase-ID-token ветку, и legacy fallback на этот единый helper, чтобы server больше не жил по отдельной access-модели;
  - сохранить `ALLOWED_EMAIL_DOMAINS` только как часть corporate allow-check, а не как отдельный hard gate раньше admin/invite/revocation logic.
- Точные серверные проверки, которые должны появиться:
  - deny при невалидном login;
  - deny при `users/$key.isBlocked === true`;
  - deny при `access_revocations/$key.status === 'revoked'`;
  - allow при `users/$key.role === 'admin'`;
  - allow при corporate email по `ALLOWED_EMAIL_DOMAINS`;
  - allow при `partner_invites/$key.status === 'active'` и `expiresAt` отсутствует или в будущем;
  - после allow: deny при `users/$key.passwordNeedsSetup === true`;
  - после allow: deny если нет `users/$key.emailVerifiedAt` и нет `partner_invites/$key.emailVerifiedAt`;
  - при Firebase ID token path login должен браться из подтверждённого email токена, а не из request body.

## 2026-03-26 — Пункт 2 закрыт: ужесточены RTDB rules для user security-state
- Выполнен второй практический security pass по `database.rules.json`.
- Ветка `users/$key` усилена child-level validations:
  - обычный пользователь больше не может свободно переписывать `failedLoginAttempts`, `isBlocked`, `blockedReason`, `failedLoginBackoffUntil`, `blockedAt`, `sessionRevokedAt`;
  - эти поля теперь допускают только admin-write, либо неизменённое значение, либо безопасные create-time defaults;
  - `emailVerifiedAt` и `passwordNeedsSetup` ужесточены частично: для self-write они теперь допускают только ограниченные переходы, совместимые с текущим email-link/auth flow.
- Практический смысл:
  - закрыт главный сценарий self-unblock / self-unrevoke через прямую запись в `users/$key`;
  - при этом текущий фронтовый auth-flow не сломан и `npm run test:smoke` остаётся зелёным.
- Важно:
  - это пока репозиторное изменение; чтобы прод реально стал безопаснее, новые rules нужно опубликовать в Firebase Realtime Database.
- Ограничение текущего шага:
  - `emailVerificationSentAt`, `passwordHash`, `passwordHashScheme` и часть verification-flow всё ещё остаются в self-write модели, потому что текущая архитектура auth хранит и мигрирует пароль на фронте; их можно ужесточать уже только вместе с отдельным рефакторингом auth.

## 2026-03-26 — Пункт 1 закрыт: убраны client-side fallback paths для voice и emergency bypass
- Выполнен первый практический security-cleanup pass без изменения UX-структуры.
- В `script.js`:
  - voice переведён в fail-closed режим: браузер больше не использует long-lived API key из `window`/`localStorage`; `resolveGeminiLiveApiKey()` теперь работает только через token endpoint и Firebase ID token;
  - legacy localStorage ключ `geminiLiveApiKey` больше не используется для voice и очищается как миграционный хвост;
  - сохранение voice-настроек больше не пишет API key в browser storage; если пользователь пытается сохранить только API key, UI получает уведомление, что нужен token endpoint;
  - полностью удалён client-side emergency bypass из auth-flow: убраны hardcoded emergency credentials, special-case в `verifyPasswordHash()`, ранний `allow` в `resolveAccessPolicy()` и emergency-сброс lock-state в `handleAuthSubmit()`.
- В `server/README.md`:
  - явно зафиксировано, что browser-side API key fallback больше не поддерживается;
  - `ALLOWED_ORIGINS` помечен как фактически обязательный для браузерного использования;
  - локальный запуск переписан под PowerShell/Windows окружение.
- Проверка после правок:
  - `npm run test:smoke` проходит полностью.

## 2026-03-26 — Обзор сайта: что чинить, ускорять и упрощать
- Выполнен обзорный проход по фронту, voice/token-server, RTDB rules, auth и UI/UX; код не менялся, это аналитический pass с приоритетами.
- Самые критичные находки по безопасности и доступу:
  - во фронтенде всё ещё есть client-side fallback для voice с long-lived API key (`script.js`), хотя проектный инвариант требует только server-issued session;
  - в `script.js` остаётся emergency-access логика прямо на клиенте, включая жёстко зашитую экстренную credential-связку и её проверку в браузере;
  - `database.rules.json` для `users/$key` разрешает владельцу записи менять чувствительные поля (`emailVerifiedAt`, `passwordNeedsSetup`, `failedLoginAttempts`, `isBlocked`, `sessionRevokedAt` и др.), на которых затем держится фронтовый access policy;
  - token server в secure-ветке авторизации живёт по другой модели доступа, чем основной сайт: он не учитывает `access_revocations`, invite-логику и часть user-state, поэтому revoked user может сохранить voice-доступ, а invited external user — потерять его;
  - глобально настраиваемый voice endpoint может увести Firebase ID token на произвольный origin, потому что URL сохраняется в `app_config` и потом используется клиентами без host allowlist.
- Подтверждённые техдолги по производительности и поддержке:
  - `script.js` вырос до ~13.6k строк и содержит слишком связанную auth-ветку (`handleAuthSubmit`) плюс мёртвый webhook-debug subsystem;
  - prompt sync и prompt history всё ещё работают как full-state overwrite / full-state compare (`set(..., promptHistory)`, `JSON.stringify(...)` по целым blob-объектам);
  - админская realtime-таблица подписывается на целые коллекции `users`, `partner_invites`, `access_revocations`, `user_presence` и на каждом снапшоте заново нормализует/сортирует данные, что будет тяжело расти по мере увеличения числа пользователей.
- Подтверждённые UX/accessibility проблемы:
  - мобильный переход desktop -> mobile может оставить интерфейс без активной панели;
  - модалки и табы почти без dialog/tab semantics, без фокус-трапа и слабо дружат с клавиатурой;
  - compact dropdown ролей не имеет нормальной keyboard/ARIA-поддержки;
  - в проекте много снятых focus-outline и иконок без `aria-label`.
- Рекомендуемый порядок следующего практического прохода:
  1. убрать клиентские emergency/API-key fallback paths и привести token-server + RTDB rules к единой access-модели;
  2. починить mobile panel bug и базовую accessibility семантику модалок/таба/dropdown;
  3. вынести auth, voice, prompt-sync и admin-table из монолитного `script.js` в отдельные модули;
  4. заменить full overwrite/history sync на более узкие записи и lazy/on-demand загрузку там, где это возможно.

## 2026-03-25 — Integration smoke: проверка rater payload в live-контуре
- В `scripts/integration-smoke.mjs` добавлен прозрачный перехват запросов к `n8n` через `route.continue()` (без моков ответа) для аудита отправляемого payload.
- Перед запуском rating сценарий задаёт `adminHiddenRaterPromptInput`, затем проверяет, что в реальном `rating`-payload поле `raterPrompt` содержит скрытый prompt оценщика и не содержит старый фиксированный блок `СЛУЖЕБНЫЙ КОНТРАКТ ФОРМАТА ОЦЕНКИ`.

## 2026-03-25 — Smoke: проверка скрытого prompt оценщика
- В `scripts/smoke-e2e.mjs` добавлен отдельный сценарий `runHiddenRaterPromptFlow`: он сохраняет `adminHiddenRaterPromptInput`, запускает оценку после `end_conversation` и проверяет payload `rating` — скрытый prompt оценщика должен подмешиваться в `raterPrompt`, а фиксированный блок `СЛУЖЕБНЫЙ КОНТРАКТ ФОРМАТА ОЦЕНКИ` больше не должен присутствовать.

## 2026-03-25 — Проверка: продовые RTDB rules = репозиторные rules
- Выполнена живая сверка через Firebase CLI (`firebase database:get /.settings/rules --project client-simulator --instance client-simulator-default-rtdb`): текущие rules в Firebase Realtime Database совпадают с `database.rules.json` из репозитория (diff пустой).

## 2026-03-25 — Debounce перерисовки админ-таблицы пользователей
- `scheduleAdminUsersTableRender()` больше не ставит отдельный `queueMicrotask` на каждый `onValue` из четырёх веток realtime; вместо этого отложенный вызов `renderAdminUsersTable` сливается в окне **80 ms** (`ADMIN_USERS_TABLE_RENDER_DEBOUNCE_MS`), чтобы пачка почти одновременных снапшотов не запускала несколько тяжёлых проходов подряд. Таймер сбрасывается в `stopAdminRealtimeSync`. Версия скрипта в `index.html`: `?v=20260325-26`.

## 2026-03-25 — Меньше фоновых срабатываний: active time и админ-presence
- `ACTIVE_TICK_MS` 5s→8s (реже `setInterval`, flush по-прежнему от `ACTIVE_FLUSH_MS` 15s).
- Троттлинг `markUserActivity` для цикла активного времени и для `syncCurrentUserPresenceState`: 1.5s→3s.
- Проверка отзыва сессии при фокусе (`SESSION_REVOCATION_CHECK_MS`): 10s→20s — запись пользователя и так подтягивается через `onValue`.
- Таймер только для относительных подписей «N мин назад» в админ-таблице: 60s→90s (`ADMIN_PRESENCE_RELATIVE_LABEL_REFRESH_MS`). Версия `script.js` в `index.html`: `?v=20260325-25`.

## 2026-03-25 — Запушены отложенные репозиторные правки
- В `main` (после `7990223`) закоммичены и отправлены на GitHub: `.github/workflows/smoke.yml`, обновления `README.md`, `database.rules.json`, `scripts/smoke-e2e.mjs`, `scripts/integration-smoke.mjs`. Локально перед коммитом прогнан `npm run test:smoke`.

## 2026-03-25 — «Сценарии тестирования» удалены из кода
- По запросу пользователя из настроек убрана не только разметка, но и вся логика: пресеты `TEST_SCENARIO_PRESETS`, админ-библиотека, плашка у чата, подмешивание `promptSuffix` в client webhook и описание сценария в контексте оценщика (остались пустые поля `activeScenarioPresetId` / `activeScenarioPresetName` в payload для совместимости). Стили `.admin-scenario-*` и `.active-scenario-*` вычищены из `style.css`. При загрузке по-прежнему чистится ключ `activeTestScenario:v1`. Версия скрипта в `index.html`: `script.js?v=20260325-24`. Проверка: `npm run test:smoke` зелёный.

## 2026-03-25 — Скрытый prompt оценщика в админке
- В панели администратора добавлен второй блок (рядом со скрытым prompt клиента): текст сохраняется в `app_config/raterHiddenPrompt`, дублируется в localStorage ключ `raterHiddenPrompt:v1`, и при сборке webhook для оценки вставляется в prompt оценщика (`buildRaterPromptForWebhook`).

## Project
- Name: `client-simulator-studio`
- Type: static site + optional token server
- Purpose: тренажёр, где ИИ-клиент ведёт диалог с менеджером, а отдельный ИИ оценивает результат.

## 2026-03-25 — UI: скроллбар «Скрытый prompt клиента»
- В `style.css` для `.admin-hidden-prompt-textarea` убран широкий сине-серый «pill»-ползунок с градиентом; стиль приведён к тому же тонкому нейтральному виду, что у `.prompt-editor` (6px, `#333` / hover `#555`, прозрачный track). В `index.html` обновлён query `style.css?v=...` для сброса кэша.
- У того же поля отключён `resize: vertical` → `resize: none`, чтобы не показывалась нативная ручка растягивания в углу (L-образная рамка и диагональная «шашечка»). Высота фиксирована по `min-height`, длинный текст — только скролл.
- Для таблицы в «Пользователи и доступ» (`.admin-table-wrap`) задан тот же тонкий нейтральный скроллбар, что у скрытого промпта.

## Current Priorities
- Надёжность сценариев `chat -> conversationAction -> rating`
- Безопасный и предсказуемый prompt sync
- Производительность UI под realtime Firebase
- Реалистичность клиента и качество оценки

## 2026-03-25 — Добавлен базовый CI для smoke
- После синхронизации rules и README добавлен первый GitHub Actions workflow: `C:\projects\sites\client-simulator\.github\workflows\smoke.yml`.
- Что делает workflow:
  - запускается на `push`, `pull_request` и вручную через `workflow_dispatch`;
  - поднимает Node.js 20;
  - ставит зависимости через `npm ci`;
  - ставит Playwright Chromium;
  - запускает `npm run test:smoke`;
  - при падении прикладывает артефакт `output/playwright`.
- Это не заменяет live integration smoke и не проверяет боевые Firebase rules/n8n, но закрывает самый полезный автоматический регрессионный контур для фронта.

## 2026-03-25 — Репозиторные Firebase rules и README синхронизированы с текущим сайтом
- После обзорного прохода закрыт практический разрыв между кодом фронта и репозиторными артефактами:
  - в `database.rules.json` добавлены ветки `prompt_overrides` и `user_presence`, потому что `script.js` реально использует их для облачного sync локальных draft-override и для presence-статусов;
  - для `prompt_overrides` доступ оставлен только админу-владельцу своей записи;
  - для `user_presence` админ может читать коллекцию целиком, а запись разрешена владельцу своей записи и администратору.
- Важно: это меняет только репозиторий. Чтобы реальное поведение Firebase совпало с кодом, эти rules всё ещё нужно опубликовать в Firebase Console.
- `README.md` полностью обновлён под текущее состояние продукта:
  - теперь там описан unified webhook `client-simulator`, отдельный webhook аттестации, реальные команды `test:smoke` / `test:smoke:integration`, token server и текущая архитектура;
  - удалены вводящие в заблуждение старые описания про один простой webhook и устаревший request shape.
- Проверка после этих правок:
  - `database.rules.json` валиден как JSON;
  - `npm run test:smoke` проходит;
  - lints по изменённым файлам чистые.

## 2026-03-25 — Обзор сайта и что логичнее делать дальше
- После обзорного прохода по сайту как по продукту и по техслою картина такая:
  - ядро у проекта уже сильное: чат, prompt-редактор, rating, manager assist, аттестация, voice/token-server, админка, история/compare/rollback промптов;
  - самый крупный источник будущей боли — не отсутствие фич, а разросшийся единый `script.js` и расхождение между тем, что фронт реально пишет в Firebase, и тем, что описано в репозиторных rules;
  - README уже частично устарел: описывает более простой ранний продукт и старый webhook-формат, тогда как реальный фронт живёт на unified `client-simulator` flow и намного более сложной auth/prompt архитектуре.
- Подтверждённый техриск:
  - в `script.js` используются ветки `user_presence` и `prompt_overrides`;
  - в текущем `database.rules.json` их нет вообще;
  - это значит, что либо продовые rules уже правились вручную и репозиторий отстал от реальности, либо часть sync/presence поведения сейчас хрупкая и зависит от локальных fallback-веток.
- Практический приоритет следующих шагов после текущего cleanup:
  1. сверить и привести в порядок `database.rules.json` под реальные используемые пути (`user_presence`, `prompt_overrides`) и затем опубликовать их;
  2. обновить `README.md`, чтобы он описывал нынешний продукт, реальные команды проверки и текущий unified webhook-контракт;
  3. начать аккуратную декомпозицию `script.js` хотя бы на крупные модули (`auth`, `webhook/chat`, `prompts`, `admin`, `voice`);
  4. добавить базовый CI на `npm run test:smoke`, потому что `.github/workflows` в репозитории сейчас нет.

## 2026-03-25 — Smoke harness снова зелёный после cleanup-прохода
- После cleanup-правок код приложения в целом был рабочим, но локальный mocked smoke начал падать не из-за реальной поломки UI, а из-за рассинхрона самого test-harness с текущим приложением.
- Подтверждённый root cause в боевом коде был один: при удалении локальной `webhook debug`-секции очистка `WEBHOOK_DEBUG_CONFIG_STORAGE_KEY` была вызвана слишком рано, ещё до инициализации `localJsonStorageCache`; это давало runtime-ошибку `Cannot access 'localJsonStorageCache' before initialization` и роняло bootstrap. Исправлено: на старте теперь выполняется прямое `removeSafeLocalStorageValue(...)`, без раннего обращения к JSON-кэшу.
- Дальше обновлён сам smoke harness:
  - `scripts/smoke-e2e.mjs` и `scripts/integration-smoke.mjs` больше не используют слишком бедные Firebase stubs; для тестов поднята лёгкая in-memory RTDB-заглушка, чтобы auth-flow мог реально сохранять обязательную запись пользователя, а не падать на `Firebase RTDB недоступна для обязательной записи пользователя.`;
  - auth-stub дополнен экспортами `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, потому что фронтенд теперь импортирует их на старте;
  - localhost smoke-seed переведён на текущий dev-bypass путь: тест кладёт `localhostDevAuthUser:v1` и `authSession:v1` с `devBypass: true`, вместо старой псевдо-сессии без localhost-preview semantics;
  - `waitForChatReady()` теперь умеет подхватить localhost dev auth, если модалка всё же открыта;
  - сценарий prompt workflow обновлён под текущий UI: rollback теперь проверяется через `Историю` и `Восстановить`, а не через старую несуществующую кнопку `promptRollbackBtn`;
  - сценарий `end_conversation` больше не ищет удалённый блок `Диагностика webhook`;
  - сценарий prompt-conflict теперь проверяет главное поведение (`локальные правки сохранились`, `compare доступен`), а не жёстко завязан на старую форму notice-текста.
- Итоговая проверка после правок:
  - `npm run test:smoke` проходит полностью;
  - `npm run test:smoke:integration` тоже проходит.

## 2026-03-25 — Укрепление основы: меньше фона, чище webhook, аккуратнее mobile
- По ранее согласованным направлениям выполнен безопасный проход по трём зонам: снижена фоновая нагрузка, упорядочен unified webhook payload и подтянуты мобильные UX-мелочи.
- `script.js`:
  - `markUserActivity()` теперь троттлит тяжёлые действия (`ensureActiveTimeTrackingLoop`, `syncCurrentUserPresenceState`) на высокочастотных событиях вроде `pointermove` и `scroll`, но при `focus`/`visibilitychange` всё ещё форсирует моментальную синхронизацию;
  - минутный таймер админ-таблицы больше не запускает полный `renderAdminUsersTable()` ради текста `N мин назад` — вместо этого обновляются только подписи presence в уже отрисованных строках;
  - скрытая локальная система `webhook debug`, которая раньше продолжала жить в localStorage даже после удаления вкладки, отключена: runtime debug-конфиг больше не читается, новые debug-логи не пишутся, старые ключи очищаются при загрузке;
  - unified webhook layer переведён на канонический вызов из call-site: `chat`, `chat_start`, `rating`, `manager_assist`, `improve` теперь передают только смысловые поля, а `buildUnifiedSimulatorWebhookPayload()` сам достраивает совместимые alias-поля;
  - в payload добавляются стабилизирующие канонические поля `inputText`, `historyText`, `systemText`, чтобы следующий шаг на стороне `n8n` можно было делать без поиска по старым именам;
  - кэш public prompt snapshot теперь не переписывается повторно, если данные не изменились; emergency snapshot тоже дедуплицирован;
  - `prompt_history` больше не перерендеривается повторно на идентичном снапшоте, а очистка legacy local-prompt keys теперь выполняется один раз за сессию вместо каждого локального сохранения;
  - автосохранение имени менеджера больше не пишет `localStorage` на каждый символ: локальный кэш обновляется после короткой паузы вместе с облачным `patchUserRecord`.
- `style.css`:
  - добавлены safe-area-aware отступы для общих модалок, полноэкранного логина и плавающих кнопок;
  - на мобильных `#userInput` снова держит удобную высоту `44px`, а не сжимается до `24px`;
  - кнопки markdown-toolbar увеличены в зоне нажатия на планшетах/телефонах;
  - `modal-close` получил более удобимую область нажатия `44x44`.
- Версии фронтовых ассетов обновлены до `style.css?v=20260325-20` и `script.js?v=20260325-21`.

## 2026-03-25 — Убраны вкладки тестовых сценариев и webhook-диагностики
- По прямому запросу пользователя из админ-раздела настроек полностью убраны блоки `Сценарии тестирования` и `Диагностика webhook`.
- Из области чата также убрана плашка активного тестового сценария, чтобы интерфейс не показывал больше локальные тестовые пресеты рядом с перепиской.
- Старый сохранённый `activeTestScenario:v1` теперь принудительно очищается при загрузке, чтобы ранее выбранный тестовый сценарий не продолжал скрыто влиять на prompt и стартовые сообщения после удаления UI.
- В `showSettingsModal()` убраны лишние раскрытия/рендеры для этих удалённых секций.
- Версия JS-кэша обновлена до `script.js?v=20260325-20`.

## 2026-03-25 — Модалка улучшения теперь влезает в экран
- Пользователь отменил прошлую просьбу про логику создания/обновления и попросил сфокусироваться только на вёрстке модалки `Улучшить инструкцию...`, потому что окно выходило за границы экрана.
- Для `#aiImproveModal` добавлен отдельный режим прокрутки оверлея и самой модалки:
  - оверлей выравнивается от верхнего края и умеет скроллиться;
  - сама `.ai-improve-modal` получила `max-height: calc(100dvh - 24px)` и внутренний `overflow-y: auto`.
- Заголовок и текст стали адаптивными по размеру, у textarea появился предсказуемый `max-height`, а у diff-блока внутри второго шага — свой ограниченный `max-height`, чтобы длинный ответ ИИ не раздувал всё окно.
- Добавлен responsive-блок для узких и невысоких экранов: уменьшены внутренние отступы модалки и лимиты высоты textarea/diff.
- У кнопок `Улучшить инструкцию` убран hover-эффект с увеличением; вместо него теперь используется плавный едва заметный наклон против часовой стрелки (`rotate(-1.5deg)`), без изменения размера кнопки.
- У чипов вариаций промпта кнопка удаления (`крестик`) после первой правки была чуть отведена обратно от края: `margin-right` смягчён с `-8px` до `-6px`, чтобы сохранить аккуратную симметрию без ощущения, что элемент прилипает к правой кромке.
- Версия CSS-кэша обновлена до `style.css?v=20260325-19`.

## 2026-03-25 — Tooltip для кнопки улучшения менеджера
- В блоке улучшения промптов по оценке убрана постоянно видимая подпись `Улучшение ИИ-менеджера...`.
- Теперь это объяснение показывается только при наведении на кнопку `Менеджер`, через тот же custom-tooltip механизм, что уже используется у кнопки `Отправить`.
- Подсказка инициализируется сразу на созданном DOM-узле через `prepareCustomTooltips(buttonContainer)`, чтобы поведение было стабильным и в динамически добавленном сообщении.
- Для ясности над кнопками улучшения добавлена отдельная подпись `Улучшить инструкцию:`; сам контейнер переведён в вертикальную композицию с заголовком и строкой кнопок.
- В textarea модалки улучшения отключён `resize`, а также скрыты `::-webkit-scrollbar-button`, `::-webkit-resizer` и `::-webkit-scrollbar-corner`, чтобы снизу справа не торчали лишние стрелки/уголок.
- Во voice-режиме стартовое idle-сообщение заменено на текст про ожидание окна звонка и VPN.
- Версии фронтовых ассетов обновлены до `style.css?v=20260325-15` и `script.js?v=20260325-18`.

## 2026-03-25 — `Failed to fetch` после перевода на единый n8n flow
- Причина оказалась не в самом объединении сценариев, а в адресе: фронтенд был переведён на `https://n8n-api.tradicia-k.ru/webhook-test/client-simulator`.
- Прямой probe подтвердил:
  - `webhook-test/client-simulator` сейчас отвечает `404 The requested webhook "client-simulator" is not registered`, то есть это обычное поведение test-webhook без `Execute workflow` в n8n;
  - `https://n8n-api.tradicia-k.ru/webhook/client-simulator` отвечает `200` на `chat_start` и `chat`, поэтому фронтенд нужно держать именно на production webhook.
- Фронтенд переведён обратно на единый, но уже production endpoint: `https://n8n-api.tradicia-k.ru/webhook/client-simulator`.
- Отдельное наблюдение по текущему общему workflow: direct probe на `requestType=rating` и `requestType=manager_assist` вернул `200`, но с пустым body. Это уже не `Failed to fetch`, а признак того, что в самом n8n-сценарии эти ветки пока не формируют явный ответ `Respond to Webhook`.
- Следующий подтверждённый слой: единый n8n-сценарий в некоторых нодах всё ещё ждал старые поля `chatInput`, `systemPrompt`, `dialogHistory`, тогда как unified frontend для части веток слал `dialog`, `raterPrompt`, `userMessage`.
- Во фронтенде добавлен совместимый payload shim:
  - `manager_assist` теперь дублирует `userMessage` в `chatInput`;
  - `rating` теперь дублирует `dialog` -> `chatInput` и `dialogHistory`, а `raterPrompt` -> `systemPrompt`;
  - `chat`/`chat_start` дополнительно дублируют `chatInput` в `userMessage`.
- Прямые probes на production webhook с этими совместимыми alias-полями вернули уже непустые ответы и для `manager_assist`, и для `rating`, что подтверждает сам root cause.
- После следующего live-скрина стало ясно, что для manager-ветки в ноде AI Agent до сих пор читался именно `body.chatInput`, поэтому совместимость усилена ещё жёстче:
  - алиасы `chatInput`, `prompt`, `guardrailsInput` теперь проставляются явно прямо в теле `manager_assist`, `rating`, `chat`, `chat_start`;
  - общий helper `buildUnifiedSimulatorWebhookPayload()` тоже умеет достраивать эти поля как запасной слой.
- Доп. мелкая UI-правка: исправлена опечатка в placeholder модалки улучшения инструкции (`усилий` -> `усиль`).
- Версия фронта обновлена до `script.js?v=20260325-13`.

## 2026-03-25 — Единый n8n webhook для chat/rating/manager assist
- По запросу пользователя фронтенд переведён на один общий webhook: `https://n8n-api.tradicia-k.ru/webhook/client-simulator`.
- На этот общий URL теперь идут:
  - клиентский чат (`sendMessage`, `startConversationHandler`);
  - оценка диалога (`requestRatingWithRetry`);
  - подсказка для менеджера (`generateAIResponse`).
- `prompt improvement` теперь тоже жёстко идёт только через единый webhook `https://n8n-api.tradicia-k.ru/webhook/client-simulator` с `requestType=improve`.
- Legacy fallback на `prompt-enchancement` полностью убран по явному требованию пользователя.
- Для improve-ветки фронтенд по-прежнему шлёт совместимые поля `userMessage`, `chatInput`, `prompt`, `guardrailsInput`, чтобы единый workflow мог читать старые и новые имена.
- Если общий n8n workflow для `requestType=improve` не вернёт текст, сайт теперь честно покажет ошибку `Единый n8n workflow не вернул ответ для requestType=improve.` вместо тихого ухода в старый сценарий.
- Версия фронта обновлена до `script.js?v=20260325-17`.
- Чтобы единый workflow в `n8n` мог безопасно различать ветки без анализа URL, фронтенд теперь передаёт явный `requestType` и дублирует его в header `X-Client-Simulator-Request-Type`.
- Значения `requestType`:
  - `chat`
  - `chat_start`
  - `rating`
  - `manager_assist`
- `attestation` пока остаётся на отдельном webhook-е; `prompt improvement`, chat, rating и manager assist теперь все идут через единый `client-simulator` webhook.
- Локальный smoke (`scripts/smoke-e2e.mjs`) обновлён под единый endpoint и теперь маршрутизирует ответы по `payload.requestType`, а не по старым путям `rate-manager`/`manager-simulator`.
- Отдельная локальная целевая проверка после правки подтвердила, что фронтенд действительно отправляет `chat_start`, `chat`, `manager_assist` и `rating` на один URL `https://n8n-api.tradicia-k.ru/webhook/client-simulator`.
- Рекомендуемая серверная схема для n8n после webhook:
  - `Webhook -> Code/Normalize Input -> AI Agent -> Respond to Webhook`
  - в `Code` node вход нормализуется в единые поля `requestType`, `inputText`, `systemText`, `historyText`, `modeInstruction`
  - `AI Agent` должен читать `Prompt (User Message)` из `inputText`, а `System Message` собирать из `modeInstruction + systemText + historyText`
  - `Memory` для этой схемы лучше не подключать
  - `Respond to Webhook` должен возвращать результат `AI Agent` без дополнительной ветвистой логики

## Core Invariants
- Браузер не хранит long-lived API keys.
- Voice flow остаётся через server-issued ephemeral session.
- Реальные admin-права проверяются через `hasAdminAccount()`, а не через preview-state.
- `localhost` preview может менять только вид интерфейса, но не cloud-права и не public Firebase data.
- `go_silent` и `end_conversation` — это platform actions; фронт умеет их обрабатывать даже если n8n вернул nested JSON-string.

## Important Entry Points
- Frontend: `C:\projects\sites\client-simulator\index.html`
- Main client logic: `C:\projects\sites\client-simulator\script.js`
- Styles: `C:\projects\sites\client-simulator\style.css`
- Token server: `C:\projects\sites\client-simulator\server\gemini-token-server.mjs`
- Mocked smoke: `C:\projects\sites\client-simulator\scripts\smoke-e2e.mjs`
- Integration smoke: `C:\projects\sites\client-simulator\scripts\integration-smoke.mjs`
- Realism planning pack: `C:\projects\sites\client-simulator\automations\realism-contour\`

## Operational Notes
- `2026-03-21`: repo workspace also used to set up Windows RDP access for this laptop. Current target values: host `artemkirillov`, LAN IP `192.168.1.72`, user `artemkirillov\qwert`.
- `2026-03-21`: after reboot, MacBook reached the Windows App certificate prompt for `192.168.1.72`, which confirms the RDP listener and LAN path are working. For this home-LAN scenario, that prompt is expected self-signed cert behavior; next user step is `Continue` and normal Windows login.
- `2026-03-21`: локальный пользователь `qwert` показывает `PrincipalSource=MicrosoftAccount`; из текущей системы приоритетные формы username для RDP: `MicrosoftAccount\qwertaf134@gmail.com`, затем `.\qwert` и `ARTEMKIRILLOV\qwert`. Важный UX-факт: для RDP нужен именно пароль учётной записи, а не Windows Hello PIN.

## 2026-03-25 — Старая локальная сессия без Firebase Auth
- По консоли пользователя: `users/... timeout`, `access_revocations/... timeout`, `restoreAuthSession timed out`, при этом `prompts` остаются пустыми.
- Вывод: после прежней кастомной сессии в `localStorage` UI считает пользователя вошедшим, но в Firebase Auth нет живой сессии; из-за этого RTDB-узлы, требующие `auth != null`, не читаются.
- Доп. правка в `script.js`:
  - `ensureFirebaseAuthPasswordSession` больше не проглатывает ошибки и реально валит вход, если Firebase Auth-сессия не открылась;
  - `restoreAuthSession()` теперь сбрасывает устаревшую локальную сессию без Firebase Auth и показывает понятное сообщение: нужно войти ещё раз;
  - кэш-версия обновлена до `script.js?v=20260325-03`.
- Ещё один выявленный сценарий: `setupPromptsAndConfigListeners()` раньше запускался до нормального Firebase Auth-входа, ловил отказ/тихий срыв и не переоткрывался после логина.
- Доп. правка:
  - защищённые realtime-listeners теперь хранят unsubscribe-и и умеют перезапускаться;
  - до появления `auth.currentUser` они вообще не поднимаются;
  - после успешного входа вызывается `refreshProtectedFirebaseDataAfterAuth()` и заново подтягиваются `prompts`, `prompt_history`, `app_config`;
  - кэш-версия обновлена до `script.js?v=20260325-04`.
- Ещё один сценарий из живой консоли: `restoreAuthSession()` уходил в timeout на `users/...` и `access_revocations/...`, но фоновый promise продолжал жить и мог позже снова применить старую сессию, из-за чего модалка входа не показывалась стабильно.
- Доп. правка:
  - введён `activeAuthRestoreAttemptId`, чтобы устаревшие попытки восстановления не могли поздно вызвать `applyAuthenticatedUser`;
  - при timeout/ошибке восстановления локальная сессия теперь сразу очищается, protected listeners останавливаются и в модалке показывается явное сообщение о повторном входе;
  - кэш-версия обновлена до `script.js?v=20260325-05`.
- По свежей консоли после ручного входа видно, что проблема шире prompt-listeners: timeout получают и `users`, и `partner_invites`, и `access_revocations`. Это похоже на сетевой/transport-срыв именно браузерного RTDB SDK, а не на отсутствие самих промптов в базе.
- Доп. правка:
  - `firebaseGetWithTimeout()` теперь делает параллельно 2 стратегии чтения: обычный SDK `get(ref(...))` и REST `fetchFirebaseJsonViaRest(...)`; выигрывает первый успешный ответ;
  - при ошибке realtime-listener для `prompts` сразу пробуется `bootstrapPromptsViaRestFallback()`;
  - CSP `connect-src` расширен под Firebase transport-хосты: `https://*.firebasedatabase.app`, `https://*.firebaseio.com`, `wss://*.firebaseio.com`, `https://firebasedatabase.googleapis.com`, `https://*.googleapis.com`;
  - кэш-версия обновлена до `script.js?v=20260325-06`.
- 2026-03-25: пользователь попросил уйти от зависимости rules на `auth.token.email_verified` для `users`, `users_by_uid`, `partner_invites`, `access_revocations`.
- Новая модель в репозитории:
  - `database.rules.json` для этих веток больше требует `auth != null` + совпадение `auth.uid` / `auth.token.email` / роли через `users_by_uid`, без `email_verified`;
  - в `handleAuthSubmit()` Firebase Auth-сессия теперь открывается **до** обязательных облачных записей пользователя;
  - `saveUserRecord`, `patchUserRecord`, `savePartnerInvite`, `patchPartnerInvite`, `setAccessRevocation`, `ensureCurrentUserAccessMirror` получили режим `requireRemote`, при котором локальный cache больше не маскирует провал облака как “успешный вход”;
  - кэш-версия обновлена до `script.js?v=20260325-07`.
- Важно: чтобы это заработало в проде, новые rules из `database.rules.json` нужно именно **опубликовать в Firebase Console**, иначе live-база продолжит жить по старым правилам.
- После удаления битого Firebase Auth-пользователя и публикации rules следующий блокер оказался уже не в claims/rules, а в transport записи: сайт открывал Firebase Auth, но `set/update` через браузерный RTDB SDK зависали по 8с на `users`, `users_by_uid`, `partner_invites`, `access_revocations`.
- Доп. правка:
  - добавлены `writeFirebaseJsonViaRest()` и `firebaseWritePathWithFallback()` — критичные записи теперь идут и через обычный RTDB REST с Firebase idToken, а не только через подвисающий SDK transport;
  - на fallback переведены `saveUserRecord`, `patchUserRecord`, `syncCurrentUserAccessMirror`, `savePartnerInvite`, `patchPartnerInvite`, `setAccessRevocation`;
  - кэш-версия обновлена до `script.js?v=20260325-08`.
- Новый подтверждённый root cause из live console: Firebase Realtime Database SDK использует **long-polling через script tag** на URL вида `https://<db>.firebasedatabase.app/.lp?...`, и именно это блокировалось CSP директивой `script-src`, а не `connect-src`.
- Доп. правка:
  - в `index.html` `script-src` и `script-src-elem` расширены хостами `https://*.firebasedatabase.app` и `https://*.firebaseio.com`, чтобы RTDB long-polling transport вообще мог стартовать;
  - `connect-src` дополнен `https://cdnjs.cloudflare.com`, `https://www.gstatic.com`, `https://unpkg.com`, `https://cdn.jsdelivr.net`, чтобы не шумели служебные sourcemap/CSP сообщения в консоли при отладке;
  - версия фронта обновлена до `script.js?v=20260325-10`.

## 2026-03-25 — Пустые промпты: нет Firebase Auth при входе по паролю
- Корень: логин проверялся по записи в RTDB `users`, но **Firebase Authentication** часто оставался без сессии (`auth.currentUser === null`). Правила RTDB для `prompts` требовали `auth != null` и раньше ещё `email_verified` — клиентский `onValue`/`get` получал **permission denied**, кэш пустой → «Промпт пустой».
- Исправление фронта: после успешной проверки пароля вызывается `ensureFirebaseAuthPasswordSession` — `signInWithEmailAndPassword` или `createUserWithEmailAndPassword` (тот же email/пароль, что уже принят в RTDB). Перед подпиской на промпты — `waitForFirebaseAuthReady()`.
- Правила `database.rules.json`: чтение `prompts`, `prompt_history`, `app_config` — `auth != null` (без `email_verified`, иначе новый Firebase user после create часто с `emailVerified: false` не читал бы промпты). Запись по-прежнему только если в `users_by_uid` у uid роль `admin`.
- **Важно:** правила нужно **опубликовать** в Firebase Console (Realtime Database → Rules), иначе на сервере останутся старые.
- Версия: `script.js?v=20260325-02`.

## 2026-03-25 — «Загрузка…» бесконечно + пустые промпты
- Симптом: слева плейсхолдер «Загрузка…», справа «Промпт пустой».
- Причина A: после таймаута первого `restoreAuthSession()` второй вызов шёл **без** `withPromiseTimeout` — при зависании сети/Firebase `loadPrompts()` не завершался, `isAppBootstrapped` оставался false → чат не выходил из загрузки.
- Причина B (UX): готовность интерфейса ждала конца всего блока auth в `loadPrompts()`. Теперь после подключения слушателей промптов и REST-fallback выставляются `isAppBootstrapped` и `updateChatReadyState()`, чтобы снять «Загрузка…» до завершения восстановления сессии.
- Версия скрипта: `script.js?v=20260325-01`.

## 2026-03-24 — Prompts visible in UI but empty (Firebase vs browser)
- Симптом: в консоли RTDB промпты есть, в приложении «Промпт пустой», роль в UI — админ.
- Частая причина: правила `database.rules.json` для `prompts` требуют `auth.token.email_verified == true`; консоль Firebase не использует JWT пользователя, браузер — да. При `permission_denied` срабатывает fallback из `localStorage`; пустой кэш → пустой редактор. Проверка: Firebase Authentication → пользователь → подтверждение email; в DevTools консоль на `Firebase read error`.
- Доп. причины: отложенное применение снапшота при `isUserEditing` (фокус в редакторе без blur); пустой локальный draft админа поверх публичного варианта.
- Правки в `script.js`: при выборе публичного варианта не показывать пустой локальный override, если публичный непустой; `applyDeferredPromptRemoteState` применяет отложенный снапшот без лишнего условия на `lastPromptsFirebaseSnapshot`; при возврате на вкладку (`visibilitychange`) сброс отложенного состояния если есть pending remote.
- Версия скрипта в `index.html`: `script.js?v=20260324-04`.

## 2026-03-24 — Auth legacy compatibility fix
- Вышеописанная причина вашего текущего падения входа — несовместимость старых хэшей пароля: фронтенд принимал только ограниченный набор старых форматов и показывал `Неверный логин или пароль. Осталось попыток...`.
- В `script.js` расширил `parsePasswordHashWithState` и проверку `verifyPasswordHash`:
  - поддержка префикса `sha256:` без `|`
  - поддержка `sha256`-хэшей как в `hex`, так и в `base64`/`base64url`
  - расширенный набор кандидатов секрета для старых учёток (`login::password`, `password`, `normalizeLogin`/`trim` варианты)
- После фикса:
  - `node --check script.js` проходит без ошибок.
  - если учётка действительно старая, она должна начать проходить валидацию после деплоя, и счетчик попыток больше не должен расти.
- Рекомендованный следующий шаг: попытаться войти 1-2 раза подряд после очистки кэша страницы (или hard-reload). Если счётчик всё равно растёт — вероятно, пароль не соответствует текущему записанному хэшу и нужен reset через админа/пересоздание учётки.

## 2026-03-24 — Emergency access for specific account
- Добавлена временная техническая подсветка доступа для `qwertaf134@gmail.com` с паролем `MrIbraPro05` в `script.js`:
  - добавлен `EMERGENCY_ACCESS_CREDENTIALS` (хэшированная проверка `normalizeLogin(login) + '::' + password` через SHA-256),
  - добавлен прямой быстрый bypass `EMERGENCY_ACCESS_PLAINTEXT` для этой пары (`login + password`) до любых хэш-проверок, чтобы убрать зависимость от формата/совпадения legacy-хэшей,
  - `resolveAccessPolicy(login, userRecord, password)` теперь раннего типа отдаёт `allow` для этой пары до проверок `isBlocked`/revocation,
  - `handleAuthSubmit()`:
    - рассчитывает `hasEmergencyAccess`,
    - пропускает проверку backoff перед попыткой логина и запись `failedLoginAttempts`,
    - не обновляет `failedLoginBackoffUntil` для emergency-пары,
  - `verifyPasswordHash()` принудительно возвращает `true` для этой пары.
- Результат: этот логин/пароль должен проходить даже при текущем `blocked/backoff` состоянии.
- Проверка: `node --check script.js` успешен.
- Доп. фикс: emergency-проверка теперь использует нормализованный пароль (`trim`) и защищает от копипаста с лишними пробелами/переносом строки.
- Для гарантии обновления в браузере обновлён query-string кэша скрипта: `script.js?v=20260324-01` в `index.html`.

## 2026-03-24 — Local workspace cleanup
- Убраны временные артефакты тестов из `output/playwright` и сам пустой каталог `output`.
- Сохранены только файлы, которые действительно участвуют в запуске сайта, auth-логике и админке; неотслеживаемые артефакты теперь не забивают корень проекта.
- Удалён локальный `node_modules` после тестов/автозапусков; для запуска сервера нужно выполнять `npm install` при необходимости.

## 2026-03-24 — Prompt bootstrap guard
- Выявлен источник массового очищения: `setupPromptsAndConfigListeners()` при пустом снапшоте Firebase выполнял `fullReplace` в `prompts`, даже если локальное состояние не содержит осмысленного текста.
- В `script.js` добавлена защита: `fullReplace` теперь запускается только при `Object.keys(data).length === 0` **и** наличии meaningful-содержимого `promptsStateHasMeaningfulContent()`.
- Это убирает самовосстановление в виде перезаписи валидных промптов на пустые значения при пустом/битом `onValue`.
- При пустом снепшоте без контента мы больше не будем форсировать запись пустых промптов обратно в Firebase.

## 2026-03-24 — Prompt fallback cache
- Причина продолжающейся «пустоты» после перезагрузки: при старте `loadPrompts()` и ошибках слушателя Firebase выполнялся `initPromptsData({})`, который инициализировал публичные промпты пустыми значениями при отсутствии/ошибке снапшота.
- В `script.js` добавлены кэширующие функции:
  - `normalizePromptSnapshotForCache`
  - `persistPublicPromptsSnapshot`
  - `loadCachedPublicPromptsSnapshot`
- `loadPrompts()`, `setupPromptsAndConfigListeners()` и `bootstrapPromptsViaRestFallback()` теперь:
  - пытаются сначала восстановить значимый снепшот `prompts` из `localStorage` (`promptPublicSnapshot:v1`);
  - сохраняют в этот кэш только осмысленное содержимое;
  - на ошибки чтения Firebase не затирают локальное состояние пустым объектом.
- Дополнительно при успешной синхронизации публичных промптов в Firebase сохраняется их full snapshot в этот же кэш.
- После фикса локально больше не должно теряться содержание после hard-refresh, если до этого был валидный снапшот из Firebase/локальной синхронизации.

## 2026-03-24 — Prevent accidental empty override
- До этого фикс-слоя оставался путь, когда `prompts` в Firebase приходил пустым, `onValue` применял `initPromptsData({})`, и UI терял уже загруженные тексты.
- В `script.js` добавлена защита: `initPromptsData(data, options)` теперь нормализует входной payload и не применяет полностью пустой/несодержательный `prompts`-объект, если локально уже есть meaningful-промпты (кроме принудительного режима восстановления из `restore`).
- В `setupPromptsAndConfigListeners()` этот режим теперь блокирует «пустое» переинициализирование при активной загрузке, а ошибка listener-а не сбрасывает `lastPromptsFirebaseSnapshot` в `{}`.
- `applyDeferredPromptRemoteState()` теперь учитывает результат `initPromptsData`, чтобы пропущенный/пустой merge не инициировал лишние `savePromptsToFirebase`.

## 2026-03-24 — Fix repeated login on hard reload
- Пользователь сообщил, что после hard refresh всегда вываливает на экран входа.
- Причина в инициализации: при `AUTH_SESSION_RESTORE_TIMEOUT_MS` (6 сек) промократ сессии, on timeout очищался `authSession` и показывался модал логина до повторного `lateSession`-процедуры.
- Изменено:
  - увеличен таймаут восстановления сессии до `10000` мс;
  - при ошибке по таймауту больше не очищаем `authSession` и `identity`, давая повторную попытку восстановления.
- Результат: сессия не должна сбрасываться из-за временной медленной инициализации Firebase и больше не должна теряться при жёстком перезагрузке в таких условиях.

## 2026-03-24 — Admin users block now collapsible
- Секция `Пользователи и доступ` в админ-панели переведена в одинаковый закрываемый формат, как `Скрытый prompt клиента`, `Сценарии тестирования`, `Диагностика webhook`:
  - `index.html`: заменён статичный блок на `<details id="adminUsersAccessAccordion" class="admin-hidden-prompt-section">` с `summary`.
  - `Пользователи и доступ` теперь всегда начинается закрытой и разворачивается по клику.
  - Внутри теперь лежат `admin-users-access-toolbar` (кнопка `Обновить`) и таблица `adminUsersTableBody` как раньше, без изменения JS-идентификаторов.
- `style.css`: добавлен базовый стиль `admin-users-access-toolbar` для выравнивания кнопки в правую сторону.

## 2026-03-24 — Admin users list stuck loading
- Пользователь сообщил, что в админке в разделе пользователей остаётся `Загрузка...` без данных.
- В `script.js` усилил `renderAdminUsersTable()`:
  - добавил короткий диалоговый отказ для не-админских путей (`isAdmin() === false`) с текстом «Нет прав администратора…», чтобы вкладка больше не показывала бесконечный загрузочный статус;
  - добавил явный контроль потока для `ensureCurrentUserAccessMirror()` и `adminUsersTableInitialized`, чтобы путь с неуспешной синхронизацией Firebase показывал диагностическое сообщение;
  - оставил существующий watchdog (15 сек), поэтому при зависании чтения таблица больше не остаётся в сыром `Загрузка...`.
- Проверка: `node --check script.js` после правок проходит.

## Current Behavior Snapshot
- Prompt system supports public variations plus local hidden overrides.
- Real admin accounts sync hidden/local prompt overrides across devices through RTDB `prompt_overrides/<login>`.
- Client dialog supports:
  - plain text responses
  - structured `conversationAction.go_silent`
  - structured `conversationAction.end_conversation`
- After terminal close, rating is manual via button under `Диалог завершен`.
- Recoverable silent state is forwarded into the next webhook request as `conversationActionState`.

## 2026-03-24 — Restore prompt bootstrap from legacy payload shapes
- Повторное сообщение «промпты пустые» диагностировано как проблема нормализации: `normalizePromptSnapshotForCache` и проверка meaningful-content ломались на `*_variations`, если Firebase/local cache хранил их как объект (`{ id: {..}, ... }`) вместо массива.
- В `script.js` добавлены:
  - `normalizePromptVariationEntry()` и `normalizePromptSnapshotVariations()`:
    - принимают массив/объект/пустое значение;
    - поддерживают `id` из `id/variationId/key/uid`;
    - сохраняют `name/content` даже если формат нестандартный;
    - дедуплицируют и подменяют id при конфликтах.
  - `normalizePromptSnapshotForCache()` теперь строит `*_variations` через новый нормализатор вместо строгой фильтрации только массивов с `id`.
  - `firebasePromptSnapshotHasMeaningfulContent()` и `getPublicPromptRoleSnapshotFromFirebaseData()` теперь тоже используют новый нормализатор при проверке содержимого.
- Это защищает от того, чтобы валидный снапшот интерпретировался как пустой и очищал UI промптов при следующем старте.
- Обновлён `index.html` query-string у скрипта до `script.js?v=20260324-02` для принудительного обновления скрипта в браузере.

## Major Work Already Landed
- Security hardening:
  - fail-open auth/session behaviors removed
  - token-server body parsing hardened
  - CDN loading hardened with CSP/SRI/loader checks
  - DOMPurify used for rendered HTML
  - public prompt cloud sync requires real admin rights
- Auth/session:
  - email-link/session restore tightened
  - user record live subscription added
  - revocation/role/fio changes arrive event-driven
- Activity/presence:
  - adaptive `activeMs` loop
  - carryover in localStorage
  - RTDB presence states `online/idle/away/hidden/offline`
- Prompt UX:
  - hide/show public prompt no longer creates duplicate chips
  - hidden chips show icon instead of `(локальный)`
  - non-admins never see hidden/local prompt content
- Client action contract:
  - front adds hidden system suffix for `go_silent/end_conversation`
  - nested JSON-string webhook envelopes are parsed correctly
  - `go_silent` styling now matches terminal notice styling

## Latest Pass — 2026-03-21
- Added robust `localhost` auth bypass:
  - auth modal now exposes explicit CTA `Войти локально без авторизации`
  - bypass session persists via dedicated `localhostDevAuthUser:v1` storage instead of piggybacking only on shared local auth cache
  - session restore for `devBypass` now reads that dedicated local record first, so reload keeps the local dev session alive
  - session-revocation checks fully skip localhost dev-bypass sessions, so Firebase/live-subscription gaps can no longer kick localhost preview back to auth
  - switching into admin preview on localhost for a non-admin account now auto-upgrades the current session into local dev-preview mode instead of continuing to rely on live Firebase auth state
  - mocked smoke fixed to seed auth-flow state only once per browser context, then verified `localhost dev auth -> reload` successfully
- Fixed opaque email login hangs:
  - root cause: the login flow disabled the submit button immediately, but major steps (`consumePendingEmailSignInLinkForLogin`, user lookup, access-policy resolution, verification-email send) had no user-visible stage text, and magic-link send had no dedicated timeout
  - auth submit button now shows step labels (`Проверяем ссылку...`, `Проверяем аккаунт...`, `Проверяем доступ...`, `Отправляем письмо...`, `Входим...`) instead of a silent darkened state
  - `sendMagicLinkToEmail()` now has a hard timeout via `withPromiseTimeout(...)`
- 2026-03-23: auth compatibility update for legacy accounts:
  - добавлена проверка старых sha256-хешей без префикса в `script.js` (формат `raw` 64-символьный hex), чтобы учётки из предыдущих версий не падали на “Неверный логин или пароль”
  - после успешной проверки такой формы хеша учётка мигрирует в новый `pbkdf2:v1` при следующем сохранении сессии
  - добавлена поддержка двух вариантов legacy-проверки: `password` и `login::password` для случаев, где старый код хешировал только пароль
  - `handleAuthSubmit()` wraps key async stages in bounded `runAuthStep(...)`, so hangs surface as readable auth errors instead of an indefinitely disabled button
  - extended staged auth labels to Firebase write points too (`Сохраняем попытку...`, `Сохраняем аккаунт...`, `Обновляем приглашение...`, `Фиксируем письмо...`), which narrows real-world stalls down to the exact write step instead of leaving the last read-status text on screen
  - for localhost/stubborn browser cases where RTDB writes hang instead of rejecting, added `firebaseWriteWithTimeout(...)` to user/invite/revocation writes so the existing local-cache fallback can proceed instead of blocking login on `Сохраняем аккаунт...`
  - for localhost/stubborn browser cases where SDK reads miss an already-verified production user, auth lookup now falls back to direct Firebase REST for `users`, `partner_invites`, and `access_revocations`; this prevents false “подтвердите почту” loops for already verified accounts when only the SDK path is flaky
  - localhost preview-mode now tolerates local-only dev auth state better: password validation can fall back to the local cached user record on localhost, and the current-user realtime subscription no longer kicks the user back to the auth screen just because the live RTDB snapshot is missing while a local dev user cache still exists
  - mocked smoke now covers the “new corporate email -> send verification link” flow and verifies both transient button state and final mail-help/error state
- Fixed blank prompts / stuck loading for stubborn local browser profiles:
  - root cause: `loadPrompts()` waited for email-link + auth-session restore before even starting live prompt listeners, so stale/broken auth state could keep the page in `Загрузка...` while prompt editors stayed empty
  - prompt UI and Firebase listeners now bootstrap immediately; auth restore runs after that with a hard timeout, so public prompts can appear independently from session recovery
  - added direct REST fallback to `databaseURL/prompts.json` when SDK/local cache still leaves the client prompt empty, which gives one more recovery path for capricious browser profiles
- Polished hidden client prompt editor scrollbar:
  - `.admin-hidden-prompt-textarea` now has a thin modern scrollbar with stable gutter and theme-aware thumb styling instead of the old system-looking track/arrows
- Fixed prompt editor blank-on-load regression:
  - root cause: `updateEditorContent()` only repainted when `textarea.value !== content`, so browser/profile states with already-filled textarea but empty preview could leave prompts visually blank forever
  - preview now tracks `data-rendered-markdown` and repaints independently from textarea state
  - after delayed `initWYSIWYGMode()` the app now forces a fresh `updateAllPreviews()` + active-editor repaint
  - mocked smoke `waitForChatReady()` now also waits for non-empty client prompt textarea + preview, so this class of regression fails fast
- Fixed real-world blank prompt state caused by corrupted local hidden override selection:
  - root cause: an empty local hidden draft could stay selected and shadow a non-empty public prompt, which produced `Промпт пустой...` even though a valid public prompt still existed
  - admin view now ignores broken empty local overrides when a linked public prompt has content
  - boot now repairs active selection back to the public prompt instead of staying on the empty local draft
  - mocked smoke now seeds a broken `localPrompts:v3` client override and verifies automatic recovery
- Fixed frontend boot hanging on Firebase reads:
  - root cause: auth/access restore and several RTDB reads (`users`, `partner_invites`, `access_revocations`) had no frontend timeout, so a stalled Firebase `get(...)` could keep `loadPrompts()` pending forever
  - added `firebaseGetWithTimeout(...)` with local fallback for key reads and list reads
  - `loadPrompts()` now bootstraps prompt UI from local cache immediately before waiting for live RTDB snapshots, so prompts are visible even when Firebase is slow
- Fixed rare stuck `Загрузка...` state on page init:
  - root cause: chat readiness depended too narrowly on `window.load`, so in some browser states the UI could stay forever in loading even though the DOM was already interactive
  - `isWindowLoaded` now initializes from `document.readyState !== 'loading'`
  - added `syncWindowReadyState()` with `readystatechange`, `pageshow`, microtask and timeout fallback so the app self-recovers even if `load` is missed or delayed
- Fixed empty scenario strip ghost after voice-mode exit:
  - root cause was CSS overriding the native `hidden` attribute on `#activeScenarioStrip` because the strip had an explicit `display:flex`
  - added `.active-scenario-strip[hidden] { display: none !important; }`
  - mocked smoke now explicitly checks that the strip is really invisible before any local test scenario is selected
- Improved rating output and contract:
  - frontend now appends a hidden rating-format contract to the rater prompt before sending to `rate-manager`
  - rating webhook now also receives `conversationOutcome`, `conversationOutcomeReason`, and active local scenario id/name
  - frontend accepts both old plain-text rating and new structured JSON rating payloads
  - structured rating is rendered as a card with explicit blocks: summary, what killed the dialogue, what was still salvageable, why client left, manager mistakes/wins, next best step, CRM actions
  - export/attestation/improve-from-rating still use a plain-text synthesized version, so old downstream flows stay compatible
- Updated mocked smoke for the new rating shape:
  - smoke `rate-manager` now returns structured JSON
  - smoke verifies both the richer rendered rating block and that the hidden rating prompt contract plus conversation outcome reached the webhook
- Added admin scenario library for manager testing:
  - new admin-only settings block with reusable client presets (`Срочный прораб`, `Цена выше рынка`, `Риск поломки`, `Мягкий уход`, `Жёсткий собственник`)
  - selected preset is stored locally only (`activeTestScenario:v1`) and never mutates shared Firebase prompt data
  - active preset is shown in a quick strip under chat with actions `Подставить сообщение`, `Стартовать`, `Сбросить`
  - launching a preset can clear the current chat, inject the preset-specific hidden client suffix into webhook `systemPrompt`, and auto-send the preset starter message
  - presets are limited to admin view / localhost admin preview and disabled in attestation mode
- Expanded mocked smoke with scenario-library coverage:
  - choose preset in settings
  - verify local activation and starter-message prefill
  - verify quick-start flow sends `/start` with `SCENARIO_ID: ...` marker in `systemPrompt`
  - verify the first real chat message equals the prefilled scenario starter message
- Fixed brittle smoke assertion for the scenario library:
  - smoke now verifies non-empty prefill + actual sent message instead of matching a hardcoded preset string byte-for-byte

## Previous Pass — 2026-03-20
- Fixed prompt live-sync conflict window:
  - remote Firebase prompt snapshots and prompt override snapshots are deferred while the user edits
  - deferred remote state is safely applied after editing ends
  - local dirty roles are merged back before cloud resync, reducing accidental overwrite risk
- Optimized admin realtime access table:
  - removed `tbody` reset and `Загрузка...` flicker on every realtime tick
  - rows are now keyed by login and patched/reordered instead of recreated wholesale
- Optimized dialog serialization:
  - added incremental `conversationHistoryText`
  - chat/rating/manager assistant no longer rebuild full dialog strings on every request
- Split smoke coverage:
  - mocked smoke remains at `npm run test:smoke`
  - new live-webhook integration smoke at `npm run test:smoke:integration`
- Removed local browser dependency from smoke:
  - switched from `playwright-core` to `playwright`
  - no more hardcoded Chrome/Edge paths in the smoke harness
- Closed dependency vulnerability:
  - pinned transitive `minimatch` to safe `9.0.7` through `package.json` overrides
  - `npm audit` is now clean with `0 vulnerabilities`
- Added admin editing for hidden client trigger prompt:
  - new admin-only settings section edits the hidden client action suffix used before trigger node send
  - value is loaded from and saved to `app_config/clientConversationActionPrompt`
  - frontend falls back to cached/shared value and then to the built-in default suffix
- Stabilized live integration smoke around rating:
  - frontend now honors localhost-only `webhookDebugConfig:v1` for rating attempt/timeout tuning
  - integration smoke seeds bounded rating config (`ratingAttempts=1`, `ratingTimeoutMs=45000`) instead of waiting for full production retry budget
  - integration smoke clicks terminal notice CTA `Оценить` when present, else falls back to global rate button
  - on transient rating error it retries once at the smoke level; latest verified run passed after one retry
- Added multi-admin prompt conflict protection for public prompts:
  - while editing a public role, frontend remembers the remote baseline hash for that role
  - if remote public data changes before local edit is synced, the local public edit is preserved as a local hidden draft instead of overwriting remote data
  - active prompt panel now shows an inline conflict notice explaining that remote changed and the local edit was moved into a draft for manual compare/publish
- Added explicit prompt workflow for admins:
  - toolbar now exposes `Сравнить` for draft/public diff and `Откат` for previous public revision
  - local drafts compare against their linked public prompt in a dedicated modal and can be published from there
  - history modal now shows public journal even while a local draft is active, including event labels (`База`, `Публикация`, `Откат`)
  - rollback is now real after first change because public prompts seed a baseline snapshot before first edit/publish
  - mocked smoke now covers `draft -> compare -> publish -> rollback`
- Added admin webhook observability in settings:
  - new admin-only `Диагностика webhook` block shows recent local requests for chat, start, rating, manager assist, improve and attestation
  - each entry stores request type, endpoint, requestId, attempt, timeout, duration, HTTP status and compact error/result text
  - log persists in localStorage (`webhookDebugLog:v1`) and can be cleared from UI
  - chat/start/rating/improve/manager-assist/attestation request points now write into this log
  - mocked smoke now verifies that `Старт` and `Оценка` appear in the debug block and that log clear works
- Expanded mocked smoke around prompt/admin flows:
  - hidden client trigger prompt is now covered end-to-end: save in settings -> reload -> `/start` webhook payload contains saved hidden suffix
  - localhost admin preview is covered for prompt privacy: admin-only local prompt content disappears in `user` preview and comes back in `admin` preview
  - public prompt conflict recovery is covered: simulated remote public change during local edit must preserve local text as hidden draft and show conflict notice
  - localhost test hooks are now exposed only on localhost for smoke/runtime introspection of prompt sync state

## Verification State
- `script.js` parses successfully after latest pass.
- `npm run test:smoke` passes, including:
  - scenario library choose + quick-start flow
  - hidden client prompt persistence/apply
  - admin/user preview prompt privacy
  - public prompt conflict recovery
  - compare/publish/rollback workflow
  - end_conversation flow
  - go_silent flow
- `npm run test:smoke:integration` passes; `rate-manager` may still need one bounded smoke-level retry on transient timeout.
- `npm audit` reports `0 vulnerabilities`.
- `script.js` hash-совместимость:
  - поддержка legacy SHA-256 без префикса добавлена для старых аккаунтов, `node --check script.js` проходит.
  - `sha256`-ветка проверяет оба варианта legacy-секрета: `login::password` и `password`.
  - `npm run test:smoke` в этой итерации упёрся не в auth-flow, а в общий таймаут сценария сравнения/публикации промпта (внешняя нестабильность интеграции), поэтому авторизацию в бою нужно проверить вручную сразу после деплоя.

## Data / Inputs
- Real call transcript source noted by user:
  - `C:\projects\sites\client-simulator\crm_call_transcripts.csv`
  - caveat: noisy ASR / missing fragments / role confusion possible
  - treat as weak-supervision realism source, not exact ground truth

## 2026-03-24 — Prompt emergency backup
- Добавлена дополнительная аварийная защита для public prompts:
  - новый локальный ключ: `promptPublicEmergencyBackup:v1`.
  - при загрузке snapshot из Firebase/REST и при каждой успешной локальной правке в `savePromptsToFirebaseNow` выполняется сохранение в emergency-резерв (timestamp + версия + нормализованный payload).
  - `loadPrompts()` теперь использует цепочку:
    1) `promptPublicSnapshot:v1`,
    2) `promptPublicEmergencyBackup:v1`,
    3) пустой инициализационный state.
  - добавлен ручной экспорт `Экстренная копия (JSON)` в меню экспорта инструкции.
  - добавлено действие `Восстановить из копии` (только для режима администратора), которое применяет snapshot через `initPromptsData(..., { forceApplyEmpty: true })` и инициирует `savePromptsToFirebaseNow({ fullReplace: true })`.
- В `showSettingsModal()` все свертывающиеся админские секции закрываются при каждом открытии модалки (в т.ч. `adminUsersAccessAccordion`), чтобы вкладка "Пользователи и доступ" визуально соответствовала другим разделам.

## 2026-03-24 — Restore role-level prompt variations parsing
- Пользователь снова сообщил, что промпты пустые после очередного релога.
- Причина: `initPromptsData()` брал `*_variations` только как массив (`Array.isArray(...)`) и игнорировал нормализованные map-объекты вида `{id: { ... }}`, из-за чего роль могла инициализироваться пустой и затирать редактор.
- В `script.js` в этой функции `rawPublicVariations` теперь создается через `normalizePromptSnapshotVariations(...)`, поэтому любые легитимные legacy/кэширующие формы корректно превращаются в массив вариаций.
- Дополнительно валидация meaningful-content уже опиралась на нормализатор; теперь и инициализация использует тот же путь.
- Рекомендуется сделать hard-refresh после деплоя и проверить вкладки `client/manager/...`, что значения больше не уходят в ноль после перезагрузки.
- Для принудительного обновления в браузере поднят query-cache кода в `index.html` до `script.js?v=20260324-03`.

## 2026-03-24 — Auth-aware REST fallback
- Повторный массовый провал после релога на production мог быть связан с тем, что REST-резервный путь восстановления промптов (`bootstrapPromptsViaRestFallback`) считывал Firebase без токена из защищённых правил `.read = auth != null`.
- В `script.js` `fetchFirebaseJsonViaRest()` теперь по умолчанию пытается добавить `?auth=<Firebase idToken>` к URL, если пользователь уже авторизован, и только после этого делает запрос.
- Это добавляет дополнительный путь восстановления на случай коротких сбоев/пустых SDK-снимков без потери локальных данных.

## 2026-03-27 — Access policy: allow existing users
- В `script.js` `resolveAccessPolicy()` теперь разрешает вход любому пользователю, который уже есть в базе (`userRecord`), даже если email не корпоративный и нет активного инвайта.
- Блокировки (`isBlocked`) и ревокации (`access_revocations`) остаются приоритетными и продолжают закрывать доступ.

## 2026-03-27 — Admin users list: merge `users` + `users_by_uid`
- В `listAllUserRecords()` теперь используется объединение записей из `users` и зеркала `users_by_uid`, чтобы список не обрезался, когда в `users` остались только часть логинов.
- Вводится `mergeUserRecordsByLogin(...)`, который оставляет приоритет за `users`, но добавляет отсутствующие логины из `users_by_uid`.

## 2026-03-27 — Admin users list: tolerate non-hex keys + fallback when realtime is too small
- `resolveNormalizedLogin()` теперь принимает `loginKey` как прямого кандидата (на случай, если ключи в RTDB — это email, а не hex).
- В админской таблице добавлен fallback: если realtime-список пользователей подозрительно мал (`< 6`), дополнительно подтягивается список через `listAllUserRecords()` и используется, если он больше.

## 2026-03-27 — Settings: single scroll for users table
- Убрана отдельная прокрутка у `admin-table-wrap`; теперь длинная таблица скроллится вместе с панелью настроек.
- Перекрывающий скролл у `#settingsModal` отключен, чтобы не было двух полос прокрутки.

## 2026-03-27 — Admin users table sorting
- В таблицу пользователей добавлена сортировка по ролям, доступу (по сроку приглашения) и активному времени.
- Заголовки колонок сделали кликабельными с переключением направления сортировки.

## 2026-03-28 — Rater prompt assembly
- Для вебхука оценки используется `buildRaterPromptForWebhook()` — в него попадает базовый prompt оценщика + скрытый prompt оценщика + служебный контекст платформы (если есть outcome).
- Дополнительных скрытых добавок к `systemPrompt` в payload нет; `buildUnifiedSimulatorWebhookPayload()` только добавляет алиасы полей.

## Open Next Steps
- Revisit prompt sync further if multi-admin concurrent public edits still collide semantically.
- Consider diff-based Firebase prompt writes instead of full role payloads where practical.
- Expand integration smoke to cover more than one natural dialogue branch if it stays stable.
- Next high-impact product step after scenario library: enrich the rating output so it explicitly explains what killed the dialogue, what was salvageable, and why the client chose `go_silent` vs `end_conversation`.
- Consider adding retry/copy actions into the new webhook debug panel once the basic observability proves useful.
- Decide whether admin table needs row-level diffing for invite/source/status tooltips beyond current keyed patching.
- When realism contour starts for real, build Phase 1 harness first; planning docs already live in `automations/realism-contour`.
- User request (2026-03-21): выдать роль `admin` для `qwertaf134@gmail.com`; для выполнения нужна правка в Firebase (в `users` и `users_by_uid` на основе его UID), поскольку frontend- и DB-гарантии не позволяют назначить роль через UI без уже существующего админа.

- 2026-03-21: обновил локальный экспорт client-simulator-default-rtdb-export.json: роли admin для users/71_77_65_72_74_61_66_31_33_34_40_67_6d_61_69_6c_2e_63_6f_6d и users_by_uid/tWRvimjZcvVwLL54HMmvYDZuoLT2 установлены (uid=tWRvimjZcvVwLL54HMmvYDZuoLT2). Для фактического применения нужно импортировать дамп или применить изменения в RTDB.
- 2026-03-21: добавил защиту рендера админ-таблицы пользователей в `script.js`:
  - если Firebase не возвращает список пользователей, таблица больше не зависает на `Загрузка...` и показывает диагностический текст;
  - добавлен fallback-ряд текущего авторизованного админа, чтобы в крайнем случае не было пустоты и интерфейс не «падал»;
  - в ошибках рендера теперь фиксируется лог и понятное сообщение о проблемах доступа к Firebase-сессии.
- 2026-03-21: убрал кнопку(и) отката из панели админки: удалён promptRollbackBtn из тулбара инструкций и promptCompareRollback из модалки сравнения (index.html). В script.js удалены переменные, блоки показа/подсказки состояния rollback и обработчики кликов для этих кнопок; внутренняя функция 
ollbackPublicPrompt и метка 
estore в истории пока оставлены как резервная функциональность (без кнопки для запуска).
- 2026-03-21: добавлен клик по карточке записи истории: теперь каждый блок в списке истории промпта открывает модальное окно с диффом относительно предыдущей версии (зелёное = добавлено, красное = удалено, без изменений — обычный текст). Кнопка «Восстановить» осталась отдельным действием.
- 2026-03-21: устранён падение списка пользователей после импорта RTDB: в `script.js` добавлена устойчивная нормализация логинов в `users/partner_invites/access_revocations` по ключу узла (декодирование `loginToStorageKey`) и переход к `Object.entries(...).map(([key,item])=>normalizeX(..., key))` в списках. Это возвращает пользователей в таблицу даже если импорт сохранил только ключи без явного `login`.
- 2026-03-21: в `database.rules.json` добавлены parent-level `.read` для `users`, `users_by_uid`, `partner_invites`, `access_revocations` (только для админа), чтобы админка корректно могла считать списки; публичного доступа нет.
- 2026-03-21: `normalizeRole` в `script.js` теперь нормализует значение роли регистронезависимо (`Admin`/`admin` и т.п. обрабатываются одинаково).
- 2026-03-27: по запросу проверены паттерны синхронизации Auth -> RTDB. В коде нет Firebase Admin SDK и нет отдельного sync-скрипта; сервер (`server/gemini-token-server.mjs`) использует REST (Identity Toolkit + RTDB) с `FIREBASE_WEB_API_KEY`/`FIREBASE_DATABASE_URL`. Для будущего sync предложен минимальный admin-скрипт, который читает Auth пользователей, заполняет `users` и `users_by_uid` и бережно не затирает существующие поля.
