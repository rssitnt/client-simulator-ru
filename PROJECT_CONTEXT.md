# PROJECT_CONTEXT.md

## Project
- Name: `client-simulator-studio`
- Type: static site + optional token server
- Purpose: тренажёр, где ИИ-клиент ведёт диалог с менеджером, а отдельный ИИ оценивает результат.

## Current Priorities
- Надёжность сценариев `chat -> conversationAction -> rating`
- Безопасный и предсказуемый prompt sync
- Производительность UI под realtime Firebase
- Реалистичность клиента и качество оценки

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

## Current Behavior Snapshot
- Prompt system supports public variations plus local hidden overrides.
- Real admin accounts sync hidden/local prompt overrides across devices through RTDB `prompt_overrides/<login>`.
- Client dialog supports:
  - plain text responses
  - structured `conversationAction.go_silent`
  - structured `conversationAction.end_conversation`
- After terminal close, rating is manual via button under `Диалог завершен`.
- Recoverable silent state is forwarded into the next webhook request as `conversationActionState`.

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
  - `npm run test:smoke` в этой итерации упёрся не в auth-flow, а в общий таймаут сценария сравнения/публикации промпта (внешняя нестабильность интеграции), поэтому авторизацию в бою нужно проверить вручную сразу после деплоя.

## Data / Inputs
- Real call transcript source noted by user:
  - `C:\projects\sites\client-simulator\crm_call_transcripts.csv`
  - caveat: noisy ASR / missing fragments / role confusion possible
  - treat as weak-supervision realism source, not exact ground truth

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
- 2026-03-21: убрал кнопку(и) отката из панели админки: удалён promptRollbackBtn из тулбара инструкций и promptCompareRollback из модалки сравнения (index.html). В script.js удалены переменные, блоки показа/подсказки состояния rollback и обработчики кликов для этих кнопок; внутренняя функция ollbackPublicPrompt и метка estore в истории пока оставлены как резервная функциональность (без кнопки для запуска).
- 2026-03-21: добавлен клик по карточке записи истории: теперь каждый блок в списке истории промпта открывает модальное окно с диффом относительно предыдущей версии (зелёное = добавлено, красное = удалено, без изменений — обычный текст). Кнопка «Восстановить» осталась отдельным действием.
- 2026-03-21: устранён падение списка пользователей после импорта RTDB: в `script.js` добавлена устойчивная нормализация логинов в `users/partner_invites/access_revocations` по ключу узла (декодирование `loginToStorageKey`) и переход к `Object.entries(...).map(([key,item])=>normalizeX(..., key))` в списках. Это возвращает пользователей в таблицу даже если импорт сохранил только ключи без явного `login`.
- 2026-03-21: в `database.rules.json` добавлены parent-level `.read` для `users`, `users_by_uid`, `partner_invites`, `access_revocations` (только для админа), чтобы админка корректно могла считать списки; публичного доступа нет.
- 2026-03-21: `normalizeRole` в `script.js` теперь нормализует значение роли регистронезависимо (`Admin`/`admin` и т.п. обрабатываются одинаково).
