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

## Current Context
- Voice mode runs on Gemini Live (`gemini-3.1-flash-live-preview`) through the token server.
- Stable voice behavior is manager-first. The frontend no longer relies on a synthetic first text turn from the client.
- First assistant reply recovery is turn-centric:
  - assistant audio is buffered per turn;
  - if text is missing or late, the frontend can request fallback transcription from `/api/gemini-live-transcribe`;
  - half-duplex is enforced while the assistant is speaking.
- Admin settings include a local Gemini Live tech log for debugging transport/startup issues.
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
- If dialog history acts like a permissions problem, verify both Firebase rules and fresh auth token state.
- When updating context again, prefer replacing old bullets instead of appending another long timeline.
