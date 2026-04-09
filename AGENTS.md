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
- Gemini Live voice sessions now set explicit realtime activity detection instead of relying on SDK defaults:
  - `startOfSpeechSensitivity` and `endOfSpeechSensitivity` are forced high;
  - `silenceDurationMs` is shortened to ~700ms;
  - `turnCoverage` stays `TURN_INCLUDES_ONLY_ACTIVITY`.
  This is meant to reduce the case where the manager speaks but the client never starts answering because Gemini does not close the manager turn quickly enough.
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
  - desktop/mobile history stays in sync from one state source;
  - the desktop rail has inline search and a fast `Новый диалог` action;
  - dialogs support pinning via `pinnedAt`, with pinned records sorted first;
  - auto-titles are derived from the early topic of the dialog (subject/model/qualifier), not from the raw first line.
  - legacy long first-line titles are normalized on read, so older records also show short topic titles without manual rename.
  - each history row has a hover/tap `...` menu with `переименовать / поделиться / удалить`.
  - the desktop rail is list-only; opening a saved dialog happens in the main chat workspace, not inside the sidebar itself.
  - dialog history is no longer duplicated inside settings; the left rail is the single primary place for browsing saved dialogs.
  - the main shell does not auto-open the first history item on load.
  - the desktop history rail starts collapsed by default and is reopened with a dedicated toggle.
  - the old saved-dialog header block is intentionally gone now: when a saved dialog is opened, the center view should start directly with the messages instead of rendering a separate `Сохранённый диалог` / title / meta / pin-delete section above them.
  - the main saved-dialog view must actually become visible after selecting a history item: `syncMainDialogHistoryStage()` should switch to `mainDialogHistoryStage` for any non-live selected history item, including the loading/error states; do not gate the stage visibility on `dialogHistorySelectedPayload`, or clicks will look like they did nothing.
- A large from-scratch shell redesign was attempted on 2026-04-07 and reverted the same day because it created too many visual regressions at once; future redesigns should land in smaller passes or from a prototype branch first.
- The current interface was then repaired in-place:
  - login is a centered modal card again;
  - chat/prompt areas have explicit headers and clearer panel structure;
  - a fresh session has three visible start actions (`чат / звонок / аттестация`);
  - on an empty session the bottom composer collapses to a compact voice-call button so mobile start actions stay visible;
  - the collapsed desktop history toggle is offset far enough not to overlap the clear-chat button.
  - the large saved-dialog viewer is no longer rendered in the center workspace; saved-dialog access remains in the history rail only.
  - the extra `Диалоги` eyebrow above `История` was removed from the left rail.
- The minimal shell now runs behind `body.local-minimal-ui` on `localhost/127.0.0.1` and on the production domains `client-simulator.ru` / `www.client-simulator.ru`:
  - it preserves existing IDs/logic and smoke coverage;
  - it uses a calmer ChatGPT-like shell with open history rail by default locally;
  - on desktop, the shell is intentionally `история + чат`, while the role/prompt editor opens as a right drawer instead of occupying a permanent third column;
  - the localhost settings surface is now restyled into the same warm right-side drawer language as the new shell; it should no longer appear as the old centered modal card;
  - the localhost settings top theme/close section is no longer sticky; it should scroll away with the rest of settings content instead of hanging over the fields;
  - the localhost settings drawer no longer shows accent color presets; settings keep only the theme toggle there;
  - the localhost settings close button now occupies the same top-right slot and size as the local settings-open icon in the chat header, instead of sitting inline in the drawer row;
  - the localhost early minimal-UI boot no longer uses an inline script; it is loaded from `early-local-ui.js` immediately after `<body>` starts, so CSP can stay strict without `unsafe-inline` and the old interface should not flash before the local shell class is applied;
  - Firebase App Check is intentionally skipped on localhost preview, and Firebase REST fallback is disabled there unless App Check is truly active; this prevents local reCAPTCHA/App Check spam and repeated REST `401` noise in dev tools;
  - the old floating clear/history/settings controls are hidden locally in favor of inline header actions;
  - desktop history width is fixed to the local grid so the rail does not visually intrude into chat anymore;
  - if the client prompt is empty, local start actions now route the user into role/scenario setup instead of showing a red prompt-empty chat error;
  - localhost now injects built-in fallback prompts for `client / manager / manager_call / rater` whenever Firebase/cached public prompts are absent, so local tests and local dev auth do not start from blank prompt editors;
  - localhost minimal UI class is now applied inline at the top of `body` in `index.html`, before the main shell markup, so the old interface should not flash briefly before the local prototype takes over;
  - the local start-screen voice CTA is intentionally visually neutral now; do not restore the old green accent unless the user explicitly asks for it;
  - local drawer open/close still explicitly dismisses tooltip state before toggling, so stale tooltip state cannot stay over the interface after clicking;
  - in the local drawer, the visible `Роль` / `Личность` labels are hidden, prompt variations are shown as a vertical list instead of chips, and the local composer wrapper clips the textarea scrollbar cleanly;
  - local shell header action buttons are now plain at rest; pill chrome should appear only on hover/active, not permanently;
  - the local shell chat header is action-only now; do not reintroduce a visible `Чат` title in that top bar unless requested;
  - the local history rail now owns its own left-edge collapse control; when collapsed it stays as a narrow ChatGPT-like rail with expand, new-chat, and search icons instead of disappearing completely;
  - the local history area no longer shows a visible `История` title above the list in the localhost prototype;
  - when the localhost history list is empty, it must stay visually empty; do not show the dashed `Пока пусто. Первый чат появится здесь.` placeholder card there anymore;
  - the local history rail now uses one scrollbar for the full main history column (`history-panel-main`), not a separate inner scrollbar only on the dialog list; the scrollbar should match the settings drawer style;
  - the localhost role/personality dropdown now uses fully opaque cards and a higher stacking context so prompt content beneath it must not bleed through visually;
  - in the localhost role/personality dropdown, menu items must keep a stable tall two-line layout with the checkmark centered on the right; do not let the active role card collapse or show underlying variation text through it;
  - while the localhost role/personality dropdown is open, `.instruction-content` is intentionally hidden underneath it; keep that behavior so prompt variations and prompt copy cannot bleed through the menu even if browser stacking gets quirky;
  - keep the localhost role/personality dropdown radii nested cleanly: the menu uses a larger outer radius and option cards use a slightly smaller inner radius so active cards do not look clipped or oddly squared at the corners;
  - the localhost role/personality dropdown now shows only the role names inside the menu; keep the subtitle/description lines hidden there unless the user explicitly asks to restore them;
  - the localhost role/personality dropdown selected item is intentionally neutral now; do not restore the old green active card unless the user explicitly asks for an accent state there;
  - the localhost role/personality dropdown is intentionally compact now: shorter option height, tighter inner padding, and a smaller max-height than before;
  - the prompt drawer context bar now shows only the role name and active variation badge; the old per-role explanatory text and `Новый вариант` button were intentionally removed;
  - the local top action/header areas are now transparent surfaces; do not reintroduce a tinted header strip above the chat or inside the role drawer unless requested;
  - localhost light theme now has its own warm overrides for the shell, history rail, start cards, composer, role drawer, role dropdown, and settings drawer; it should no longer fall back to the broken old dark/white mixed styles;
  - when adjusting localhost light theme, keep the role drawer, history rail, dropdown menus, and settings controls on one shared warm-cream surface ladder so it does not drift into mismatched whites after dark-theme fixes;
  - the current local light-theme repair also depends on a final bottom-of-file harmonization layer in `style.css`; prefer editing that tail block instead of reviving conflicting earlier light overrides higher in the file;
  - the local light-theme start cards also depend on a late override for `#startBtn / #startVoiceBtn / #startAttestationBtn`, because an old global `body.light-theme #startBtn { ... !important }` rule otherwise makes only `Чат с клиентом` look different from the other two cards;
  - the local light-theme composer field also depends on a late override for `#userInput` and `#userInput:focus`, because old global `body.light-theme #userInput` / `textarea:focus` rules otherwise paint a colder inner rounded rectangle inside the warm input shell;
  - local input-tool buttons should stay icon-only in all states; do not reintroduce square hover/focus/selected fills around `rate / AI / mic` in the composer, only color changes are intended there;
  - the local chat composer should not sit on its own extra strip or gradient block above the rounded input shell; `body.local-minimal-ui .chat-input-container` is intended to stay transparent now, with only the actual `input-wrapper` visible.
  - chat and history scrollbars in the local minimal shell are now aligned to the settings drawer scrollbar; keep their width/thumb language in sync instead of styling each area separately.
  - the local voice-stop primary action is no longer the old small white circle with a thin outlined square; it now uses a larger dedicated stop treatment with a filled rounded-square glyph, so do not revert it to the old generic send-button style unless requested.
  - the local role dropdown must stay truly hidden when the selector is closed; do not set `display:flex` on `.personality-selector-menu` unconditionally, because it overrides the base `.dropdown-options { display:none; }` rule and causes the menu to remain visible, overlap its own text, and ignore the trigger close state.
  - the localhost minimal UI uses the old custom tooltip system again for hover help on icon/ambiguous controls; the local override no longer disables tooltip rendering globally;
  - in localhost minimal UI, clicking a tooltip-enabled button must immediately hide its tooltip and suppress re-show on that same hovered/focused button until the pointer/focus leaves it;
  - localhost chat messages in the minimal shell are now laid out as side-aligned rows again: client/assistant on the left, manager/user on the right; they should no longer appear as one centered conversation column;
  - the localhost collapsed history rail should not have its own tinted overlay anymore; it inherits the panel surface and no longer shows a brighter top block over the left strip;
  - the localhost left history rail no longer has an inner vertical divider line; only the outer history-vs-chat boundary should remain visible;
  - the localhost history chevron must stay in the same left-rail position when the sidebar expands or collapses; do not let it drift toward the center in the open state;
  - the localhost history rail width is fixed, so the top collapse chevron keeps the same left-edge position in expanded and collapsed states;
  - the localhost history item `...` actions use a compact neutral ellipsis button plus a fixed floating dropdown; the menu must not be clipped by the scrollable list or overlap the card content awkwardly;
  - in localhost minimal UI, dialog messages are no longer laid out as one centered text column: manager (`.message.user`) stays on the right, client (`.message.assistant`) stays on the left, while only non-message utility blocks remain center-constrained;
  - the local shell palette has been warmed from cool blue-grays to warmer neutral grays/taupes; future color tweaks should stay in that warmer direction unless the user asks otherwise;
  - the local accent is neutral now too: do not reintroduce the old green accent for active dropdown rows, selected prompt variations, voice pills, or control outlines unless the user explicitly asks for green back;
  - the auth/start screen is compact now: the long welcome/explanation copy was intentionally removed, the login card uses the same local shell surface language as the rest of the site, and on normal desktop it should fit without an inner scrollbar;
  - tooltip globals were changed to non-TDZ storage because early local drawer init could throw `ReferenceError: Cannot access 'tooltipLayer' before initialization` and silently break later local UI bindings;
  - on mobile the local prototype forces full-width panels and redirects the same empty-prompt start case into the `Роль` tab;
  - the localhost light theme now has its own warm override layer for history/chat/start cards/input/role drawer/settings drawer, so it no longer falls back to old cold or dark surfaces from the legacy UI;
  - it is now the intended production shell on the main domains; future fixes should treat the old grey shell as deprecated rather than as the primary interface.
  - the old grey production shell should not be restored on the main domain unless explicitly requested.
  - as of 2026-04-09, the chosen production host is still GitHub Pages for corporate-network compatibility; Vercel may still exist as a side deployment, but the main domain should continue serving from GitHub Pages unless the user explicitly asks to switch again.
  - the admin panel inside settings now follows the same warm minimal shell language as the rest of the site:
    - outer admin sections are flattened into divider-based blocks instead of heavy nested rectangles;
    - the `Выдача доступа` days control must stay as one shell: `.admin-invite-days-wrap` is the outer surface and the inner `.admin-invite-days` input stays transparent/borderless so it does not render as a smaller field inside;
    - the admin role selector should keep a theme-matched dropdown surface too: do not leave it as a dark trigger with a bright native white popup underneath;
    - the admin users list should stay compact now: tighter table-cell padding, a slightly shorter role trigger, and wrapped right-side access/status text so rows do not get huge vertical gaps or clip past the drawer edge;
    - the access table can scroll horizontally inside the drawer instead of blowing out the layout;
    - the voice tech log uses the same local admin styling as the other sections again (`.admin-webhook-debug-body` is the real class; older `.admin-voice-debug-body` selectors were a dead typo).
- Admins can view and delete foreign dialog history; users can manage only their own history.
- Active time is now “real focused activity only”:
  - visible tab
  - focused window
  - real action in the last 60 seconds
- Roles are enforced via Firebase Custom Claims.
- App Check is enabled in the frontend/token-server flow.
- Default Gemini voice is `Enceladus`; the token server now respects the user-selected Gemini voice (from the allowlist) instead of forcing a single server-side voice.
- Voice settings save scope is now split correctly:
  - changing only the Gemini voice or microphone must show a local-device save message, not `сохранены для всех пользователей`;
  - only a real token-endpoint change may produce the shared/global save message.
- Gemini microphone selection is now safer during device-list refresh:
  - the picker first tries to preserve the current real selection;
  - then the saved device id;
  - then a unique label match;
  - it should no longer silently jump to the first enumerated microphone just because the list refreshed.
- Gemini microphone fallback is now resynced after live capture too:
  - if the saved microphone is unavailable and capture falls back to a real available input, the picker/cache must be updated to the actual captured device instead of still showing the stale saved one.
- Hard refresh auth restore is now more tolerant:
  - a 10-second restore timeout is treated as a soft timeout, not as proof of logout;
  - the saved session is no longer wiped just because Firebase restored slowly after hard refresh;
  - the frontend now gives auth restore a longer second window before showing the login form;
  - repeat login for an existing user no longer blocks on non-critical RTDB profile rewrites or access-mirror sync if Firebase Auth is already open.
  - opening Firebase Auth session now has a longer timeout and retries once on transient network errors.
- Preview-role switching is now safer:
  - the settings `Сменить` button no longer flips admin/user view immediately;
  - it opens the confirm block first, and the actual switch happens only after explicit `OK`;
  - this protects against accidental role flips from stray/overlapping clicks.
- In the local empty-state start cards, only the main titles remain visible; the lower subtitle lines under `Чат с клиентом / Голосовой звонок / Аттестация` were intentionally removed.
- The local empty-state start cards are compact now: the card column is intentionally much narrower than before and the remaining titles are center-aligned. Do not stretch them back to full-width unless requested.
- For local empty-state start cards, explicitly override the base `justify-content: flex-end`; these compact cards must stay vertically centered, not bottom-biased.
- The whole localhost empty-state start stack is centered now, not just the text inside the cards. Keep the wrapper/content centered so the column does not drift toward the left edge.
- In the localhost role/prompt editor, the prompt preview should read as one full-width block inside `.prompt-wrapper`, not as a smaller nested card. Keep the wrapper clipping the edges and the preview itself flat/full-width.
- The localhost `Роль` drawer is intentionally a bit wider than before: around 10% wider than the earlier 420px/34vw baseline. Keep that wider drawer unless the user asks to tighten it again.
- Local settings sections are flat now: section wrappers should not render as separate rounded cards. Use only faint divider lines between sections; keep the inner controls/card-like inputs intact.
- Вход в режим аттестации теперь тихий: он должен запускаться так же, как обычный вход в чат, без отдельного toast `Режим аттестации включен`.

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
- On `client-simulator.ru` / `www.client-simulator.ru`, same-origin `/api/gemini-live-token` is now treated as an invalid production route even if it was saved in local/shared config earlier; production token fetches should stay on the remote token server and must not fall back into the known-bad same-origin `405` path.
- If repeated Vercel `Authorization successful / You can close this tab` pages start opening, first check for a stuck local `npx vercel ...` process (for example `vercel domains inspect ...`) and kill that process instead of approving more tabs; Vercel is not the primary production path right now.
- If the first client reply disappears again, look in the admin tech log for `assistant_output_buffered_before_user_turn`, `assistant_output_waiting_for_user_turn`, and `assistant_output_released_after_user_turn`.
- If dialog history acts like a permissions problem, verify both Firebase rules and fresh auth token state.
- If a hard refresh looks like a logout, first check whether Firebase Auth simply restored too slowly; soft timeout alone should not wipe the browser session anymore.
- Если пользователь снова пожалуется на аттестацию, сначала проверь, не вернулся ли toast `Режим аттестации включен`: вход в этот режим теперь должен быть silent.
- When updating context again, prefer replacing old bullets instead of appending another long timeline.
