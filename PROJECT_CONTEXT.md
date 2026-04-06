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
- Token server now respects the requested Gemini voice from the frontend (limited to the allowed list) instead of forcing a single server-side voice.
- Fixed a race where the first client reply could be dropped if Gemini emitted client output before the first manager transcript reached the frontend.
- The frontend now buffers this early first client reply instead of treating it as orphan output.
- Audio for that first client reply can still start immediately.
- The first client text bubble is delayed briefly until the opening manager turn is restored, so chat order stays stable in the normal path.
- Early first client reply buffering no longer depends on mic activity or a time window: any assistant output before the first user turn is now buffered deterministically and released via the existing grace/fallback path.
- Fixed the adjacent case where Gemini had only an unfinished preview of the first manager turn:
  - when `waitingForInput`, `turnComplete`, or delayed assistant release fires before the first manager transcript is marked finished, the frontend now finalizes the current manager preview into the first manager bubble instead of losing it;
  - this prevents “client already answered, but the first manager phrase is missing” failures.
- Added smoke coverage for these cases: `output-before-first-input-transcript` and `waiting-for-input-finalizes-user-preview`.
- Fixed voice startup behavior around token-server cold starts:
  - voice debug log loading no longer depends on the local JSON cache bootstrap order;
  - voice mode now prewarms the token endpoint with `OPTIONS` in the background;
  - if the first token route is slow or unavailable, the frontend retries through trusted fallback candidates instead of failing after one attempt;
  - if the first token route returns HTML, empty payload, or other non-API content, the frontend treats that as a bad route and still falls through to the next trusted candidate;
  - on the production domains `client-simulator.ru` and `www.client-simulator.ru`, remote token routing is preferred before same-origin `/api/...` attempts;
  - before the token request starts, the frontend waits for Firebase auth readiness to avoid instant failures on partially restored sessions;
  - the UI no longer pretends the call already started before the session key is received.
- Fixed noisy multilingual manager preview:
  - the top manager status no longer mirrors raw `inputTranscription` chunks while Gemini is still streaming them;
  - the manager-side status is shown only after `finalizeGeminiUserTurn(...)`, using the stabilized final transcript instead of the unstable preview text.
- Fixed false logout on hard refresh:
  - a slow `restoreAuthSession()` / Firebase `authStateReady()` timeout no longer wipes the saved browser session after 10 seconds;
  - auth restore now gets a longer second window before the UI falls back to the login form;
  - lack of immediate Firebase Auth recovery is treated as a soft failure, not as proof that the session is invalid;
  - only a definitive invalid-session branch should clear auth state.
- Softened repeat login for existing users:
  - if Firebase Auth is already opened successfully, repeat login no longer hard-depends on a fresh RTDB write to `users/...` for ordinary last-login/profile sync;
  - non-critical user/profile mirror sync can continue best-effort after login instead of blocking access on an 8-second RTDB write timeout.
- Hardened Firebase Auth open step:
  - the Firebase Auth open step now retries once on `auth/network-request-failed`;
  - the timeout for opening Firebase Auth is longer and the message no longer blames email/password on a timeout.
- Chat autoscroll now aligns to the start of very tall messages so the first line is visible; shorter messages still scroll to the bottom.

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
- Date: 2026-04-06
