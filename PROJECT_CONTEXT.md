# PROJECT_CONTEXT.md

## Project
- Name: `client-simulator-studio`
- Workspace: `C:\projects\sites\client-simulator`
- Frontend: `C:\projects\sites\client-simulator\index.html`
- Logic: `C:\projects\sites\client-simulator\script.js`
- Styles: `C:\projects\sites\client-simulator\style.css`
- Token server: `C:\projects\sites\client-simulator\server\gemini-token-server.mjs`

## Current product state
- Main UI target is the warm minimal shell; the old grey shell stays deprecated.
- Production hosting should remain GitHub Pages unless the user explicitly asks to switch again.
- Voice mode is Gemini Live through the token server; first-turn handling and mic/voice settings were recently stabilized.
- Voice mode now also has a local idle-boundary watchdog: if Gemini fails to emit an explicit end-of-manager-turn boundary (`input finished / waitingForInput`), the frontend retries `activityEnd`, finalizes the pending manager turn locally, and keeps the call in a waiting state instead of leaving the turn stuck in preview forever.
- Voice mode now also has a second recovery step after that: if the manager turn is already finalized but the assistant still does not start replying, the frontend does not stop at one blind retry anymore:
  - the assistant-response watchdog can retry the manager `activityEnd` boundary more than once;
  - if the gap still persists, a later hard stall-recovery retry fires, keeps the call in a waiting state, and logs `assistant_response_stall_recovery` into the local voice tech log.
- Voice call status text is also smoothed now: fast race-condition flips between `Клиент говорит…` and `Ваша очередь говорить.` are briefly held so the top call status does not visibly blink during short boundary races.
- The final voice-call summary card is now meant to live at the bottom of chat, not in the top voice status panel:
  - the top voice status panel is only for active/connecting call states;
  - after a call ends, `Звонок завершён / Разговор сохранён` should be the last dialog card appended after the messages.
  - in the local minimal shell, that footer card is also intentionally centered now and uses the same warm neutral surface ladder as the rest of the product instead of an older colder/system-note look.
- The local left history rail now uses the settings-style thin scrollbar on the whole `.history-panel`, and in collapsed state that scrollbar is forced fully hidden.
- Opening a saved dialog from the history rail now reuses the same main `#chatMessages` renderer as a fresh/new chat, so old records no longer fall back to a separate legacy viewer layout.
- For the owner, a saved dialog opened from history is now the same live workspace as a new chat: the main composer stays usable, new text messages append into the same stored `dialogId`, and starting voice from that opened dialog continues the same conversation instead of resetting into a new one. Foreign/admin-opened dialogs remain read-only.
- There is no extra "continue this dialog" transition state anymore: after opening an owned saved dialog from history, the frontend should already treat it as the current live dialog entity. Sending the next message or starting voice must work directly on that dialog, not through a hidden one-time prep step.
- Reopened saved dialogs now also preserve their stored mode on hydration:
  - a voice dialog reopened from history keeps `currentDialogHistoryMode = voice`;
  - this prevents continued work from history from silently drifting into text-mode bookkeeping.
- Smoke now also covers dialog-history parity explicitly:
  - owned saved voice/rated dialogs must reopen in the same writable main workspace with the finished-call footer preserved;
  - foreign voice/rated dialogs must render through the same main workspace but stay locked/read-only.
- The local admin panel now relies on an explicit final stabilization layer in `C:\projects\sites\client-simulator\style.css`: compact sizing lives there, and the users table now switches by `data-admin-layout="desktop|mobile"` instead of relying on ambiguous shared selectors.
- The desktop admin users table now also has fixed pixel-based column widths in that final stabilization layer, so the drawer keeps a clean compact table and falls back to horizontal scroll instead of letting `Роль / Доступ / Статус` overlap each other.
- On desktop, the admin users table is intentionally less noisy now:
  - visible `Доступ` and `Активность` columns are hidden from the permanent table layout;
  - those values are still preserved per row and exposed through a hover/focus bubble near the access action button;
  - mobile cards can continue showing them inline because hover is not available there.
- The invite row in the local admin panel intentionally has no standalone divider under it before the first admin accordion section.
- Smoke coverage now explicitly includes the collapsed-history no-scrollbar case and the desktop admin-users real-table layout/desktop layout-flag case, so regressions there should fail `C:\projects\sites\client-simulator\scripts\smoke-e2e.mjs`.
- That desktop admin-users smoke now also guards the new compact behavior:
  - separate `Доступ / Активность` headers must stay hidden on desktop;
  - when a real data row exists, its action cell must keep hover-bubble data for those two values.
- Smoke coverage now also asserts that opening a saved dialog renders message bubbles in the main chat area and keeps `#mainDialogHistoryStage` hidden.
- Smoke coverage now also asserts saved-dialog continuation: opening your own history item must leave the main composer enabled and persist the next outgoing message into the same saved dialog record.
- Smoke coverage now also includes a voice idle-boundary case: the first manager turn must become a normal chat bubble even if Gemini only sent an unfinished input transcript and never sent the usual input boundary event.
- Smoke coverage now also includes an assistant-start recovery case: if Gemini accepts the manager turn but does not begin the reply, the frontend must retry the boundary once and recover the first client response without resetting the call.
- Smoke coverage now also includes a harder assistant-start stall case: if Gemini keeps ignoring the finalized manager turn, the frontend must escalate through the later hard stall-recovery boundary retry and still recover the delayed first client response without resetting the call.
- Smoke coverage now also includes a dedicated light-theme mobile regression pass for the local shell:
  - all three start cards must keep the same warm light-theme surface;
  - the composer input and prompt wrapper must stay transparent/flat in local light theme;
  - the active mobile tab must not fall back to the old accent-blue styling.
- In the local desktop admin table, the `Статус` label and presence text are now intentionally inline in one row to keep user lines compact; avoid restoring the old stacked status layout there.

## Current auth state
- Password login now waits more patiently for the matching Firebase session instead of failing too early on delayed session exposure.
- Password login no longer blindly falls through into `createUserWithEmailAndPassword()` after any Firebase sign-in error.
- Create-user fallback is now limited to credential-like failures only.
- If Firebase already has the same email with a stale/different password, the UI now returns an explicit conflict message instead of a vague generic login failure.
- The auth modal now has a dedicated password-reset action:
  - only email is required there;
  - current passwords are not stored in plaintext anywhere in the frontend flow;
  - reset is sent through Firebase `sendPasswordResetEmail()`;
  - smoke now verifies that the reset button restores its label and does not leave the main login submit disabled.
- If the local stored password hash is stale but Firebase already accepts the employee's new password, password login now succeeds and silently rewrites the local hash right away during that login.
- If the local password is still correct but Firebase has an old standalone password for the same email, login now auto-sends a reset email and shows an explicit next-step message instead of leaving the employee in a dead-end error.
- Smoke now also covers both auth repair paths: local-hash recovery through Firebase and auto-reset on Firebase password conflict.
- Session restore no longer destroys the saved browser session immediately just because the Firebase auth session came back but the user profile read still returned empty once; that path is now treated as a soft restore miss first.
- Auth observability is now exposed in the UI:
  - the login modal shows a small live status line for current auth step/result;
  - admin settings expose `Техлог входа и сброса пароля` with recent `login / restore / reset` events;
  - each event stores a compact browser/Firebase session snapshot so support can triage employee login issues from the app UI.
- Old global light-theme rules for mobile tabs, `#startBtn`, and generic dropdown active states are now isolated away from `body.local-minimal-ui`; if the warm local light shell drifts back toward old blue/grey styling, inspect that isolation first instead of piling on new overrides.

## Still watch
- If one employee still cannot log in while others can, first check Firebase Authentication for an old standalone account or stale password on that exact email.
- Keep auth fixes narrow and safe; do not reopen the earlier broad auth rewrite unless a reproducible blocker appears.
