# PROJECT_CONTEXT.md

## Canonical Project
- Name: `client-simulator-studio`
- Workspace: `C:\projects\sites\client-simulator`
- Frontend entry: `C:\projects\sites\client-simulator\index.html`
- Main frontend logic: `C:\projects\sites\client-simulator\script.js`
- Gemini token server: `C:\projects\sites\client-simulator\server\gemini-token-server.mjs`
- Main smoke coverage: `C:\projects\sites\client-simulator\scripts\smoke-e2e.mjs`

## Current Voice Architecture
- Voice mode is Gemini Live manager-first.
- The browser streams microphone audio to Gemini Live.
- Client audio is played immediately in the browser.
- Client text is assembled from `outputTranscription`, `text` parts, or fallback transcription via `/api/gemini-live-transcribe`.
- Assistant/client playback is half-duplex: microphone input is blocked while client audio is speaking and restored after playback.

## Relevant Current Fixes
- Fixed a race where the first client reply could be dropped if Gemini emitted client output before the first manager transcript reached the frontend.
- The frontend now buffers this early first client reply instead of treating it as orphan output.
- Audio for that first client reply can still start immediately.
- The first client text bubble is delayed briefly until the opening manager turn is restored, so chat order stays stable in the normal path.
- Added smoke coverage for this exact case: `output-before-first-input-transcript`.
- Fixed voice startup behavior around token-server cold starts:
  - voice debug log loading no longer depends on the local JSON cache bootstrap order;
  - voice mode now prewarms the token endpoint with `OPTIONS` in the background;
  - if the first token route is slow or unavailable, the frontend retries through trusted fallback candidates instead of failing after one attempt;
  - if the first token route returns HTML, empty payload, or other non-API content, the frontend treats that as a bad route and still falls through to the next trusted candidate;
  - on the production domains `client-simulator.ru` and `www.client-simulator.ru`, remote token routing is preferred before same-origin `/api/...` attempts;
  - before the token request starts, the frontend waits for Firebase auth readiness to avoid instant failures on partially restored sessions;
  - the UI no longer pretends the call already started before the session key is received.

## Useful Debug Markers
- `assistant_output_buffered_before_user_turn`
- `assistant_output_waiting_for_user_turn`
- `assistant_output_released_after_user_turn`
- `assistant_output_released_to_fallback`
- `token_request_started`
- `token_request_failed`
- `token_request_succeeded`

## Verification
- Passed: `node --check script.js`
- Passed: `npm run test:smoke`
- Observed on 2026-03-30:
  - `OPTIONS https://client-simulator.ru/api/gemini-live-token` => `405`
  - `OPTIONS https://client-simulator-gemini-token.onrender.com/api/gemini-live-token` => `204`
- Date: 2026-03-30
