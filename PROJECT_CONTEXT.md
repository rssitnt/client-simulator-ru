# PROJECT_CONTEXT.md

## Статус
- Статус: активный
- Приоритет: 1
- Один из самых важных проектов

## Суть
Сайт, где ИИ играет роль покупателя навесного оборудования, а менеджер отрабатывает кейс.
После этого другой ИИ оценивает менеджера по внутренней структуре оценки.

## Главные задачи
- надёжность
- безопасность
- логика сценариев
- качество оценки
- общий UX

## Для следующего агента
- Считать проект бизнес-критичным
- Не полировать мелочи раньше, чем надёжность и уязвимости
- Последний CI-pass выполнен `2026-03-19`
- За этот pass сделано:
  - `54169a5` `Harden token server request parsing`
  - `d38dcec` `Reduce prompt sync write amplification`
- После этого локально правили UI scrollbar:
  - чатовый `#userInput` больше не пытается скрывать системный scrollbar, а использует тот же thin/rounded паттерн, что `prompt-editor/prompt-preview`
  - тот же scrollbar-паттерн распространён на `ai-improve` textarea, чтобы зоны редактирования были консистентны
- В текущем локальном проходе без коммита дополнительно сделано:
  - текущий пользователь в `script.js` теперь подписывается на свою запись в Firebase через `onValue`, поэтому удаление юзера, `sessionRevokedAt`, смена роли и смена ФИО прилетают event-driven без регулярного `get()`
  - `session revocation` больше не проверяется внутри `activeTick` каждые 5 секунд; остались live-sync и лёгкий fallback на `focus/visibility`
  - `active time` loop стал адаптивным: стартует по активности, останавливается на `idle/blur/hidden`, и на паузе сразу пытается сбросить накопленный хвост `activeMs`
  - добавлен local `active time carryover`: неотправленный хвост активности сохраняется в localStorage по логину, сериализуется через JSON-cache и автоматически доигрывается после следующего успешного входа/restore session
  - `flushActiveTime` теперь сериализован через `activeTimeFlushInFlight`; carryover помечает in-flight flush и при следующем входе пытается отличить уже доехавший write по `lastSeenAt`, чтобы не задвоить `activeMs`
  - admin users table в открытом settings modal переведена на live-sync через `onValue` по `users`, `partner_invites`, `access_revocations`; повторные full fetch теперь не крутятся на каждый локальный ререндер открытой админки
  - убран лишний скрытый рендер admin table вне открытого settings modal; заодно исправлен кейс, где live-update учётки мог снова показать admin panel в `user` mode из-за проверки по `hasAdminAccount()` вместо `isAdmin()`
  - добавлен RTDB presence-контур без сервера: текущая авторизованная сессия публикует `online/idle/away/hidden/offline` в `user_presence`, регистрирует `onDisconnect`, а admin table подписывается и показывает presence как вторую строку статуса
  - для presence в admin table добавлен минутный refresh только на открытый settings modal, чтобы relative-labels вроде `Был 5 мин назад` не протухали без ручного refresh
  - после админских мутаций (`role/access/invite`) убраны лишние ручные рендеры таблицы, если уже активен live-sync; обновление теперь в основном приходит через `onValue`
  - chat webhook теперь умеет возвращать backward-compatible JSON envelope вида `message + conversationAction`; plain-text ответы продолжают работать как раньше
  - реализован recoverable-state `conversationAction.go_silent`: фронт показывает короткую системную заметку `Клиент не ответил, но его ещё можно вернуть`, не запускает автооценку и сохраняет этот state для следующего chat webhook запроса
  - `conversationAction.end_conversation` теперь показывает короткую terminal-note `Диалог завершен`, блокирует ввод и автоматически запускает `rateChat`
  - legacy `conversationAction.warn_exit`, если ещё прилетит со старого backend/prompt, тихо маппится во фронте в `go_silent`, чтобы переход на новый контракт не ломал UX
  - `rateChat`/rerate/input lifecycle теперь учитывает terminal state диалога и не открывает чат обратно после неудачной автооценки или rerate в уже завершённом диалоге
  - исправлено автозаполнение auth modal: поле ФИО теперь размечено как `autocomplete=name`, email-поле отделено как `name=email`, а фронт дополнительно чинит browser autofill collision, если браузер по ошибке подставил email в ФИО
  - улучшена совместимость auth modal с password manager: добавлена настоящая `form`-семантика с `submit`, поле пароля больше не очищается на открытии модалки, chrome credentials button больше не скрывается стилями, а `autocomplete` у пароля теперь динамически переключается между `current-password` и `new-password` по email и состоянию first-password/email-link setup
  - переключение предпросмотра `админ <-> клиент` теперь живёт только в строке роли внутри настроек; для real admin accounts оно мгновенно меняет только UI-режим, не выдавая новые права
  - поверх этого добавлен `localhost-only` dev bypass: на `localhost` / `127.0.0.1` тот же role-switch в настройках доступен даже если локальная запись пользователя сейчас не определяется как `admin`, но это меняет только фронтовый режим отображения и не пишет новую роль в Firebase
  - исправлен регресс role-switch: после возврата из `user-mode` обратно в `admin-mode` снова восстанавливаются prompt editor / WYSIWYG / toolbar / AI improve controls, потому что теперь код снимает оставшиеся inline `readonly`, `contenteditable=false` и `display:none`
  - исправлена утечка скрытого prompt в `user-mode`: non-admin теперь получает только public variations/content, local hidden-вариации фильтруются из списка, а при role-switch фронт принудительно пересинхронизирует все prompt textarea/preview на доступную public-версию
  - кнопка удаления prompt variation теперь рендерится SVG-крестиком внутри круглой `button.delete-variation`, а не текстовым символом `×`; это убрало визуальный перекос крестика вниз в чипах
  - скрытые prompt chips теперь показывают маленький eye-off indicator и display-only имя без суффикса `(локальный)`; внутреннее имя вариации в данных остаётся прежним, чтобы не ломать текущую local/public логику
  - prompt visibility toggle больше не плодит новые чипы при каждом hide/show: hidden override теперь связан с исходным public variation через `baseVariationId`, админ видит один и тот же вариант со статусом `скрыт/открыт`, а при `publish` локальный override схлопывается обратно в исходный public prompt
  - local prompt overrides для real admin accounts теперь синхронизируются между устройствами через RTDB `prompt_overrides/<login>`: hidden/open state и связанные `baseVariationId` overrides больше не завязаны только на localStorage, при первом пустом remote store идёт bootstrap из старого локального cache, а `localhost-only` preview bypass по-прежнему не пишет эти overrides в Firebase
  - frontend теперь сам добавляет скрытую системную надстройку к outgoing client `systemPrompt`: контракт `conversationAction` (`go_silent`/`end_conversation`) и текущее состояние recoverable silent-state больше не зависят от того, прописал ли админ это руками в тексте промпта
  - `readWebhookEnvelope` теперь делает второй проход по вложенному JSON-string внутри `output/message`: если n8n завернул ответ модели как строку вида `"{\"message\":...,\"conversationAction\":...}"`, фронт всё равно корректно извлекает terminal/recoverable action вместо показа этого как обычного текста
  - автооценка после `end_conversation` убрана: под terminal-note `Диалог завершен` теперь рендерится явная кнопка `Оценить`, а после успешной оценки этот notice перерисовывается уже без CTA
  - terminal-note `Диалог завершен` после оценки больше не пересоздаётся внизу чата: notice теперь обновляется на месте, поэтому остаётся перед rating-message там, где появился изначально
  - исправлен регресс нового `/start`: `clearConversationTerminalState()` теперь вызывается до сборки `conversationActionState` и обогащённого client `systemPrompt`, поэтому новый диалог не наследует silent/terminal state от предыдущего
  - в `server/gemini-token-server.mjs` rate limiter больше не копит `rateLimitBuckets` бесконечно: добавлена ленивая очистка stale bucket-ов с TTL `2 x window`, чтобы Map не рос монотонно на меняющихся `uid/login + ip`
  - в `server/gemini-token-server.mjs` внешние `fetch` к Firebase RTDB, Firebase `accounts:lookup` и OpenAI realtime sessions теперь идут через общий `fetchWithTimeout` helper с `AbortController`; зависший upstream больше не держит request handler до сетевого таймаута, а RTDB timeout не ломает legacy allowlist-вход для разрешённых доменов
  - `verifyLoginFallbackAccess()` в token-server больше не сцепляет `users/{key}` и `partner_invites/{key}` через один `Promise.all`: admin fallback и domain allowlist теперь short-circuit после `users` lookup, так что timeout/ошибка invite-ветки не отрубает валидный admin fallback
  - server-side timeout в token-server теперь покрывает не только `fetch()`, но и чтение `response.json()`: RTDB lookup, Firebase `accounts:lookup` и OpenAI session creation используют `readJsonWithTimeout`, поэтому upstream, который завис после headers, больше не держит request handler бесконечно
  - локальные prompt overrides больше не ключуются по изменяемым `ФИО + preview-role`: localStorage переведён на стабильный owner key `uid/login` (с guest fallback), а старые `v2 role:name` stores мигрируются в единый `v3` store для текущего имени и обоих preview-режимов
  - recovery legacy prompt stores усилен: миграция `v2 -> v3` теперь умеет сканировать все `localPrompts:v2:*` ключи в single-user браузерном профиле, объединяет stable + legacy stores без дублей по variation id и тем самым может вернуть overrides, оставшиеся под прежними ФИО; в multi-user профиле сохранено более консервативное поведение, чтобы не подтянуть чужие локальные данные
  - фронтовый `fetchWithTimeout` больше не живёт на дефолте `300s`: для webhook-флоу введены явные таймауты `45s` для чата/рейтинга и `30s` для AI helper/attestation, чтобы подвисший `n8n` быстрее переходил в понятную ошибку вместо долгого ложного loading-state
  - frontend webhook timeout теперь покрывает не только `fetch()`, но и чтение `response.text()`: chat/rating/manager-assistant и AI improve используют `readResponseTextWithTimeout`, поэтому webhook, который отдал заголовки и завис на body, больше не держит UI дольше заявленного timeout budget
  - добавлен repo-local smoke e2e `npm run test:smoke` на `playwright-core`: скрипт сам поднимает временную static-раздачу, подменяет Firebase-модули stub-ами, seed-ит local auth/prompt state и прогоняет обе ключевые ветки `end_conversation -> rating` и `go_silent -> follow-up -> end_conversation`; failure-скриншоты складываются в `output/playwright/`
  - обновлены cache-busting версии в `index.html` для `script.js` и `style.css`
  - smoke-check страницы через локальный `http.server` и Playwright прошёл без console errors
  - отдельный Playwright smoke-test с моковым webhook подтвердил оба сценария: `go_silent -> note without auto-rating -> manager can message again` и `end_conversation -> note -> auto rating -> locked input`
  - отдельный Playwright smoke-test auth modal подтвердил, что misfill-сценарий `email попал в ФИО` теперь перекидывает email в login-поле и очищает ФИО, а нормальное ФИО остаётся нетронутым
  - отдельный Playwright smoke-test auth modal подтвердил password-manager семантику: `authForm autocomplete=on`, `submit`-button, `minlength` у пароля и переключение password field в `new-password` для нового email
- Что именно улучшено:
  - token server теперь режет oversized JSON body и отдаёт явные `400/413` вместо fail-open парсинга в `{}`
  - public prompt sync во фронтенде стал role-scoped вместо постоянной перезаписи всего `prompts`
  - prompt history больше не пишется на каждый autosave-пауза, а фиксируется checkpoint-ами
  - hidden prompt history modal больше не перерисовывается на каждый Firebase update
  - scrollbar в основных текстовых зонах ввода стал единообразным и современным, без старого системного вида у чатового ввода
- Следующий лучший шаг:
  - проверить, нужна ли отдельная чистка stale presence-записей и стоит ли показывать presence в отдельной колонке/tooltip, если админам окажется тесно в текущей строке статуса
  - проверить, есть ли смысл вынести `active time`/presence глубже на серверный или RTDB `onDisconnect`-контур; текущий local carryover и browser presence заметно снижают потери, но не делают unload-синхронизацию абсолютно надёжной
  - синхронизировать system prompt ИИ-клиента с новым контрактом `conversationAction` (`go_silent`/`end_conversation`) и решить, нужен ли отдельный reason taxonomy/analytics слой для причин завершения (`lost_interest`, `manager_failed`, `price_rejection` и т.п.)
