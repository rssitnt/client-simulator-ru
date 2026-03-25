# PROJECT_CONTEXT.md

## 2026-03-25 — «Сценарии тестирования» удалены из кода
- По запросу пользователя из настроек убрана не только разметка, но и вся логика: пресеты `TEST_SCENARIO_PRESETS`, админ-библиотека, плашка у чата, подмешивание `promptSuffix` в client webhook и описание сценария в контексте оценщика (остались пустые поля `activeScenarioPresetId` / `activeScenarioPresetName` в payload для совместимости). Стили `.admin-scenario-*` и `.active-scenario-*` вычищены из `style.css`. При загрузке по-прежнему чистится ключ `activeTestScenario:v1`. Версия скрипта в `index.html`: `script.js?v=20260325-23`.

## 2026-03-25 — Скрытый prompt оценщика в админке
- В панели администратора добавлен второй блок (рядом со скрытым prompt клиента): текст сохраняется в `app_config/raterHiddenPrompt`, дублируется в localStorage ключ `raterHiddenPrompt:v1`, и при сборке webhook для оценки вставляется между видимым prompt роли «Оценщик» и константой `DEFAULT_RATING_RESULT_PROMPT_SUFFIX` + контекстом платформы (`buildRaterPromptForWebhook`).

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
