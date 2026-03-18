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
- As of `2026-03-10`, the latest completed pass focused on security hardening.
- Already fixed in this codebase:
  - client-side self-escalation to admin
  - overly broad Firebase RTDB access
  - token-server login/email fallback and fail-open CORS
  - weak password fallback and password-hash leakage to local cache
  - fail-open trust of localStorage when Firebase reads fail
  - CDN supply-chain hardening with CSP, SRI, and loader checks
  - sanitizer replacement with DOMPurify
- The next pending work from that pass is:
  - request-body size limit and invalid JSON handling in `server/gemini-token-server.mjs`
  - prompt/history write amplification in `script.js`
  - frontend polling/write-loop performance cleanup in `script.js`

## References
- `README.md`
- `server/README.md`
