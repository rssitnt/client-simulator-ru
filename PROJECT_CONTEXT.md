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
- The local left history rail now uses the settings-style thin scrollbar on the whole `.history-panel`, and in collapsed state that scrollbar is forced fully hidden.
- Opening a saved dialog from the history rail now reuses the same main `#chatMessages` renderer as a fresh/new chat, so old records no longer fall back to a separate legacy viewer layout.
- The local admin panel now relies on an explicit final stabilization layer in `C:\projects\sites\client-simulator\style.css`: compact sizing lives there, and the users table now switches by `data-admin-layout="desktop|mobile"` instead of relying on ambiguous shared selectors.
- The desktop admin users table now also has fixed pixel-based column widths in that final stabilization layer, so the drawer keeps a clean compact table and falls back to horizontal scroll instead of letting `Роль / Доступ / Статус` overlap each other.
- The invite row in the local admin panel intentionally has no standalone divider under it before the first admin accordion section.
- Smoke coverage now explicitly includes the collapsed-history no-scrollbar case and the desktop admin-users real-table layout/desktop layout-flag case, so regressions there should fail `C:\projects\sites\client-simulator\scripts\smoke-e2e.mjs`.
- Smoke coverage now also asserts that opening a saved dialog renders message bubbles in the main chat area and keeps `#mainDialogHistoryStage` hidden.
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

## Still watch
- If one employee still cannot log in while others can, first check Firebase Authentication for an old standalone account or stale password on that exact email.
- Keep auth fixes narrow and safe; do not reopen the earlier broad auth rewrite unless a reproducible blocker appears.
