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
- The local admin panel now relies on an explicit final stabilization layer in `C:\projects\sites\client-simulator\style.css`: compact sizing lives there, and the users table now switches by `data-admin-layout="desktop|mobile"` instead of relying on ambiguous shared selectors.
- The invite row in the local admin panel intentionally has no standalone divider under it before the first admin accordion section.
- Smoke coverage now explicitly includes the collapsed-history no-scrollbar case and the desktop admin-users real-table layout/desktop layout-flag case, so regressions there should fail `C:\projects\sites\client-simulator\scripts\smoke-e2e.mjs`.
- In the local desktop admin table, the `Статус` label and presence text are now intentionally inline in one row to keep user lines compact; avoid restoring the old stacked status layout there.

## Current auth state
- Password login now waits more patiently for the matching Firebase session instead of failing too early on delayed session exposure.
- Password login no longer blindly falls through into `createUserWithEmailAndPassword()` after any Firebase sign-in error.
- Create-user fallback is now limited to credential-like failures only.
- If Firebase already has the same email with a stale/different password, the UI now returns an explicit conflict message instead of a vague generic login failure.
- Session restore no longer destroys the saved browser session immediately just because the Firebase auth session came back but the user profile read still returned empty once; that path is now treated as a soft restore miss first.

## Still watch
- If one employee still cannot log in while others can, first check Firebase Authentication for an old standalone account or stale password on that exact email.
- Keep auth fixes narrow and safe; do not reopen the earlier broad auth rewrite unless a reproducible blocker appears.
