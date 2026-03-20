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

## Latest Pass — 2026-03-20
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

## Verification State
- `script.js` parses successfully after latest pass.
- `npm run test:smoke` passes.
- `npm run test:smoke:integration` passes; latest run in this pass succeeded without retry.
- `npm audit` reports `0 vulnerabilities`.

## Data / Inputs
- Real call transcript source noted by user:
  - `C:\projects\sites\client-simulator\crm_call_transcripts.csv`
  - caveat: noisy ASR / missing fragments / role confusion possible
  - treat as weak-supervision realism source, not exact ground truth

## Open Next Steps
- Revisit prompt sync further if multi-admin concurrent public edits still collide semantically.
- Consider diff-based Firebase prompt writes instead of full role payloads where practical.
- Expand integration smoke to cover more than one natural dialogue branch if it stays stable.
- Decide whether admin table needs row-level diffing for invite/source/status tooltips beyond current keyed patching.
- When realism contour starts for real, build Phase 1 harness first; planning docs already live in `automations/realism-contour`.
