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
- Admins can view and delete foreign dialog history; users can manage only their own history.
- Active time is now “real focused activity only”:
  - visible tab
  - focused window
  - real action in the last 60 seconds
- Roles are enforced via Firebase Custom Claims.
- App Check is enabled in the frontend/token-server flow.
- Default Gemini voice is `Enceladus` unless the user picked another voice locally.

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
- When updating context again, prefer replacing old bullets instead of appending another long timeline.
