# AGENTS.md

## Project
- Canonical name: `client-simulator-studio`
- Type: site
- Purpose: client simulator for testing AI agents through chat and webhook flows, with an optional token server for voice mode.

## Entry Points
- Frontend entry: `index.html`
- Static assets and config: top-level files plus `favicon/`
- Token server: `server/gemini-token-server.mjs`
- Package metadata: `package.json`

## Commands
- Frontend can be served as static files, for example with `npx http-server -p 3001`
- Token server: `npm run start:token-server`

## Working Rules
- Do not put long-lived API keys in the browser.
- Keep the safe voice flow server-side: the frontend should request ephemeral sessions from the token server.
- Preserve the testing workflow around system prompt editing, chat history, and export.

## Recent Context
- As of `2026-03-28`, voice-mode preview text spacing fixed:
  - streaming transcript fragments now insert missing spaces between words/punctuation.
  - prevents “тебеужевсёсказал.Либодавай...” in voice status line.
- As of `2026-03-28`, voice-mode status no longer disappears instantly:
  - streaming status text now has a short lock to prevent generic “Идёт диалог…” from overwriting it.
- As of `2026-03-28`, роли и App Check усилены без изменения UX:
  - админ‑доступ на фронте и в правилах RTDB теперь читается из Firebase Custom Claims (`auth.token.admin/role`), а не из RTDB роли (кроме localhost preview).
  - REST‑fallback в браузере отключён для `client-simulator.ru` (остался для localhost/preview), чтобы убрать канал с токеном в URL.
  - добавлен App Check (reCAPTCHA v3) на фронте; токен‑сервер умеет принудительно проверять App Check при `FIREBASE_APP_CHECK_ENFORCE=true` + service account.
  - добавлен скрипт `scripts/set-custom-claims.mjs` и зависимость `firebase-admin` для проставления ролей в claims.
- As of `2026-03-28`, service-account JSON for `set-custom-claims.mjs` not found locally; need to download a new key from Firebase Console to proceed.
- As of `2026-03-28`, custom claims set for `qwertaf134@gmail.com`; service-account JSON moved out of repo to `C:\Users\qwert\Downloads\firebase-service-accounts\`.
- As of `2026-03-28`, RTDB export shows `app_config.geminiTokenEndpoint` set to `https://client-simulator-gemini-token.onrender.com/api/gemini-live-token` (token server on Render).
- As of `2026-03-28`, settings modal open now hides tooltips and removes focus outline from the floating settings button.
- As of `2026-03-28`, admin accounts now force admin view on login (claims sync overrides any stored user-preview mode).
- As of `2026-03-28`, Render blueprint (`render.yaml`) includes App Check env vars; `server/.env.example` updated for local setup.
- As of `2026-03-28`, realtime listener recovery hardened:
  - exponential backoff (2s → 4s → 8s → … capped at 30s) added for presence/admin/prompt overrides/protected listeners.
  - backoff resets on successful recovery to avoid long delays after a stable reconnect.
  - goal: stability + speed under flaky network, no UX changes.
- As of `2026-03-28`, prompt_history sync was optimized without UX change:
  - heavy `JSON.stringify` comparisons replaced with compact hash from `id/ts/role/variationId/kind`.
  - reduces CPU/memory on every history update while keeping behavior identical.
  - prompt_history realtime listener now runs only for admins to avoid unnecessary reads for non-admin users.
- As of `2026-03-28`, Firebase REST fallback reads now back off on repeated failures:
  - exponential cooldown per path (2s → 4s → 8s → … capped at 30s).
  - avoids network storms when SDK reads fail or REST is flaky.
  - cooldown resets after a successful REST read.
- As of `2026-03-28`, `prompt_history` rules were tightened:
  - read/write now admin-only to reduce exposure of internal history data.
  - requires publishing updated `database.rules.json` in Firebase Console.
- As of `2026-03-28`, rater prompt assembly verified in `script.js`:
  - rating webhook uses `buildRaterPromptForWebhook()` which concatenates base rater prompt + hidden rater prompt + platform context (if any), and sends it as `systemPrompt` without extra text injection.
- As of `2026-03-27`, settings modal scroll behavior adjusted:
  - removed inner scrollbar on the admin users table so it scrolls with the settings panel.
  - disabled overlay scroll on `#settingsModal` to avoid dual scrollbars.
- As of `2026-03-27`, admin users table got sorting controls:
  - sortable headers for role, access expiry, and active time with toggle direction.
- As of `2026-03-27`, reviewed admin users table logic in `script.js` for missing users in RTDB:
  - Table rendering prefers realtime `users` path snapshots when available and does not merge `users_by_uid` mirror, so extra users stored only in the mirror can be hidden.
  - User normalization drops records without a valid email login; if RTDB keys are raw emails (not hex) and the value lacks `login`/`email`, `resolveNormalizedLogin` returns empty and the record is filtered out.
  - If Firebase Security Rules or auth context only allow partial reads, the UI will show that subset without clear diagnostics.
- As of `2026-03-24`, login-path check on current frontend build (`script.js?v=20260324-01`) showed emergency credentials routing to confirmation flow for new accounts (message: `Отправьте ссылку для подтверждения на почту ...`) instead of "wrong password", under clean local state.
- User-visible "wrong password / remaining attempts" counter is likely from stale local auth cache (legacy `localStorage` state) or old cached frontend version, not from server-side password reject.
- Immediate recovery steps (without code changes):
  - hard-refresh after clearing cache (`Ctrl/Cmd + Shift + R`)
  - clear session state: `localStorage.removeItem('authUsers:v1')`, `localStorage.removeItem('authSession:v1')`, `sessionStorage.clear()`
  - if needed, test in Incognito/private window.
- If this repeats, next code hardening is to auto-clear local failed-attempt counters for emergency credentials before policy check.
- As of `2026-03-24`, hardening patch applied to `script.js`:
  - emergency credentials now clear stale local/remote lock-state (`failedLoginAttempts`, `isBlocked`, `blockedAt`, `blockedReason`, `failedLoginBackoffUntil`) before login continues.
  - this should stop the “неверный пароль, осталось попыток...” loop for `qwertaf134@gmail.com` + `MrIbraPro05` when only old counters were blocking it.
- As of `2026-03-21`, a read-only follow-up on Windows sign-in forms for RDP/Windows App was run from the repo workspace:
  - current session resolves as `ARTEMKIRILLOV\qwert`; `cmd /c whoami /upn` says the user is not a domain user
  - `Get-LocalUser` shows `qwert` with `PrincipalSource=MicrosoftAccount`, while `Win32_UserAccount` still reports it as a local account/profile (`C:\Users\qwert`)
  - registry under `HKCU\Software\Microsoft\IdentityCRL\UserExtendedProperties` exposes linked Microsoft account email `qwertaf134@gmail.com`
  - practical username forms to try first in Windows App: `ARTEMKIRILLOV\qwert`, `.\qwert`, `qwert`, then `MicrosoftAccount\qwertaf134@gmail.com` or plain `qwertaf134@gmail.com` if Microsoft-account auth is required
- As of `2026-03-20`, a read-only Windows remote-access sidecar check was run from the repo workspace:
  - current user `ARTEMKIRILLOV\qwert`; local account in `Administrators`, current token non-elevated; Windows reports `PasswordRequired=True`, `PasswordLastSet=2025-11-20`
  - active non-loopback IPv4s seen on `Беспроводная сеть` (`192.168.1.72`), `SetupVPN` (`172.16.9.2`), Hyper-V vSwitches (`172.31.128.1`, `172.26.112.1`), plus several APIPA interfaces
  - no Tailscale install/service/binary detected via uninstall registry, `Get-Service`, or `where.exe`
  - Windows Firewall profiles enabled; RDP disabled (`fDenyTSConnections=1`), `TermService` stopped/manual, no listener on `3389`, built-in Remote Desktop firewall rules present but disabled
- As of `2026-03-19`, the latest completed pass focused on token-server robustness and frontend prompt-sync performance.
- Already fixed in this codebase:
  - client-side self-escalation to admin
  - overly broad Firebase RTDB access
  - token-server login/email fallback and fail-open CORS
  - weak password fallback and password-hash leakage to local cache
  - fail-open trust of localStorage when Firebase reads fail
  - CDN supply-chain hardening with CSP, SRI, and loader checks
  - sanitizer replacement with DOMPurify
  - request-body size limit and invalid JSON handling in `server/gemini-token-server.mjs`
  - prompt/history write amplification in `script.js`
  - hidden prompt-history modal re-rendering on every Firebase history update
- The next pending work from that pass is:
  - frontend polling/write-loop performance cleanup in `script.js`
  - review `active time` and session-revocation polling for event-driven simplification opportunities

## References
- `README.md`
- `server/README.md`
