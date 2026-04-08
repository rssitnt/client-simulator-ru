# AGENTS.md

## Project
- Canonical name: `client-simulator-studio`
- Type: site
- Purpose: simulator for testing AI agents in chat and voice scenarios, with Firebase-backed auth/admin flows and a separate Gemini token server.

## Entry Points
- Frontend: `C:\projects\sites\client-simulator\index.html`
- Main frontend logic: `C:\projects\sites\client-simulator\script.js`
- Styles: `C:\projects\sites\client-simulator\style.css`
- Firebase rules: `C:\projects\sites\client-simulator\database.rules.json`
- Token server: `C:\projects\sites\client-simulator\server\gemini-token-server.mjs`
- Smoke tests: `C:\projects\sites\client-simulator\scripts\smoke-e2e.mjs`

## Commands
- Static frontend preview: `npx http-server -p 3001`
- Token server: `npm run start:token-server`
- Smoke tests: `npm run test:smoke`

## Working Rules
- Do not expose long-lived API keys in the browser.
- Keep Gemini Live token/session creation server-side.
- Keep project context compressed; do not accumulate stale step-by-step history.
- Prefer updating `AGENTS.md` and `PROJECT_CONTEXT.md` with only current architecture, current constraints, and still-relevant fixes.
- For this project, code changes should be committed and pushed by default unless the user explicitly says not to push.

## Current Context
- Voice mode runs on Gemini Live (`gemini-3.1-flash-live-preview`) through the token server.
- Stable voice behavior is manager-first. The frontend no longer relies on a synthetic first text turn from the client.
- Voice startup is now split into two phases:
  - before session key arrives, UI shows that the voice server is connecting and does not imitate an active call yet;
  - if the main token endpoint stalls or returns a non-API payload, the frontend can prewarm it with `OPTIONS` and retry through a trusted fallback route instead of failing after one blind 45-second wait.
  - on `client-simulator.ru` and `www.client-simulator.ru`, the frontend now prefers the dedicated remote token server before same-origin `/api/...` fallbacks.
  - before requesting a voice session key, the frontend now waits for Firebase auth readiness so the call does not fail instantly on a still-restoring session.
- The manager-side top status no longer shows raw streaming ASR fragments; it updates only after the manager turn is finalized, so transient cross-language garbage is hidden.
- First assistant reply recovery is turn-centric:
  - assistant audio is buffered per turn;
  - if text is missing or late, the frontend can request fallback transcription from `/api/gemini-live-transcribe`;
  - half-duplex is enforced while the assistant is speaking.
- Early first client reply is protected from frontend race conditions:
  - if Gemini emits the first client reply before the first manager transcript arrives, the frontend no longer drops it as `orphan_*`;
  - client audio can start immediately, but the first client text bubble is held briefly until the opening manager turn is restored, then shown in the correct order;
  - if Gemini only has an unfinished preview of the first manager turn when `waitingForInput` or delayed assistant release happens, the frontend now finalizes that preview into the first manager bubble before showing the buffered client reply;
  - covered by smoke scenarios `output-before-first-input-transcript` and `waiting-for-input-finalizes-user-preview`.
- Admin settings include a local Gemini Live tech log for debugging transport/startup issues.
- Voice debug log loading is intentionally independent from the local JSON cache bootstrap so startup diagnostics do not break on localStorage init order.
- Settings on mobile are a full-screen sheet with a fixed close button.
- `Пользователи и доступ` has a dedicated mobile card layout; desktop table remains unchanged.
- Persistent dialog history is stored in RTDB:
  - index: `dialog_history_index/{loginKey}/{dialogId}`
  - payload: `dialog_history_messages/{loginKey}/{dialogId}`
  - only text/transcripts/rating are stored; audio is not stored.
- Main history UX is now GPT-like:
  - shared desktop/mobile/settings history views stay in sync from one state source;
  - the desktop rail has inline search and a fast `Новый диалог` action;
  - dialogs support pinning via `pinnedAt`, with pinned records sorted first;
  - auto-titles are derived from the early topic of the dialog (subject/model/qualifier), not from the raw first line.
  - legacy long first-line titles are normalized on read, so older records also show short topic titles without manual rename.
  - each history row has a hover/tap `...` menu with `переименовать / поделиться / удалить`.
  - the desktop rail is list-only; opening a saved dialog happens in the main chat workspace, not inside the sidebar itself.
  - the main shell does not auto-open the first history item on load.
  - the desktop history rail starts collapsed by default and is reopened with a dedicated toggle.
  - the main saved-dialog viewer keeps title/meta above actions so long names do not clip in the header.
- A large from-scratch shell redesign was attempted on 2026-04-07 and reverted the same day because it created too many visual regressions at once; future redesigns should land in smaller passes or from a prototype branch first.
- The current interface was then repaired in-place:
  - login is a centered modal card again;
  - chat/prompt areas have explicit headers and clearer panel structure;
  - a fresh session has three visible start actions (`чат / звонок / аттестация`);
  - on an empty session the bottom composer collapses to a compact voice-call button so mobile start actions stay visible;
  - the collapsed desktop history toggle is offset far enough not to overlap the clear-chat button.
  - the large saved-dialog viewer is no longer rendered in the center workspace; saved-dialog access remains in the history rail/settings surfaces.
  - the extra `Диалоги` eyebrow above `История` was removed from the left rail.
- Admins can view and delete foreign dialog history; users can manage only their own history.
- Active time is now “real focused activity only”:
  - visible tab
  - focused window
  - real action in the last 60 seconds
- Roles are enforced via Firebase Custom Claims.
- App Check is enabled in the frontend/token-server flow.
- Default Gemini voice is `Enceladus`; the token server now respects the user-selected Gemini voice (from the allowlist) instead of forcing a single server-side voice.
- Hard refresh auth restore is now more tolerant:
  - a 10-second restore timeout is treated as a soft timeout, not as proof of logout;
  - the saved session is no longer wiped just because Firebase restored slowly after hard refresh;
  - the frontend now gives auth restore a longer second window before showing the login form;
  - repeat login for an existing user no longer blocks on non-critical RTDB profile rewrites or access-mirror sync if Firebase Auth is already open.
  - opening Firebase Auth session now has a longer timeout and retries once on transient network errors.

## Architecture Notes
### Dialog History
- Paths:
  - `dialog_history_index/{loginKey}/{dialogId}`
  - `dialog_history_messages/{loginKey}/{dialogId}`
- Stored data:
  - text chat messages
  - voice transcripts
  - optional rating text
- Audio files are not stored.
- Owners can rename/delete their own dialogs.
- Owners can pin/unpin their own dialogs; `pinnedAt` controls sort priority.
- Auto-generated titles are topic-based (subject/model/qualifier), not raw first-turn text.
- Admins can open and delete any user’s dialog history, but cannot rename чужие записи.

### Auth / Security
- Roles are enforced through Firebase Custom Claims, not just RTDB role fields.
- App Check is part of the frontend + token-server flow.
- Browser REST fallback was reduced/disabled for production-sensitive paths to avoid weaker client-side access patterns.

### Activity Tracking
- `activeMs` counts only real activity:
  - tab visible
  - window focused
  - real action within the last 60 seconds
- Focus/visibility restore alone does not count as activity.

### Mobile UI
- Settings on phones are full-screen.
- Mobile settings have a fixed close button.
- `Пользователи и доступ` has a mobile card layout instead of the wide desktop table.

## Keep In Mind
- If something starts failing in voice mode, check the admin tech log first before adding more heuristics.
- If the call seems to “drop” immediately, first verify whether session key fetch timed out before Gemini Live even opened.
- The production site currently returns `405` on same-origin `OPTIONS /api/gemini-live-token`, so remote token routing is the only healthy warmup path right now.
- If the first client reply disappears again, look in the admin tech log for `assistant_output_buffered_before_user_turn`, `assistant_output_waiting_for_user_turn`, and `assistant_output_released_after_user_turn`.
- If dialog history acts like a permissions problem, verify both Firebase rules and fresh auth token state.
- If a hard refresh looks like a logout, first check whether Firebase Auth simply restored too slowly; soft timeout alone should not wipe the browser session anymore.
- When updating context again, prefer replacing old bullets instead of appending another long timeline.
