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

## Current auth state
- Password login now waits more patiently for the matching Firebase session instead of failing too early on delayed session exposure.
- Password login no longer blindly falls through into `createUserWithEmailAndPassword()` after any Firebase sign-in error.
- Create-user fallback is now limited to credential-like failures only.
- If Firebase already has the same email with a stale/different password, the UI now returns an explicit conflict message instead of a vague generic login failure.

## Still watch
- If one employee still cannot log in while others can, first check Firebase Authentication for an old standalone account or stale password on that exact email.
- Keep auth fixes narrow and safe; do not reopen the earlier broad auth rewrite unless a reproducible blocker appears.
