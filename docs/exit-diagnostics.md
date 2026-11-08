# 0.13.5 — collect evidence from the affected device

0.13.4 did not resolve the user's menu exit failure. This release instruments that path; it does not claim another confirmed fix.

An independent early module registers uncaught exceptions, rejected promises, page visibility/hide/show signals and page start. Menu exit records click, end request, request resolution/rejection, native device end, renderer end, cleanup checkpoints/errors, UI errors, home navigation, renderer parking and home DOM readiness. A single animation-frame checkpoint and three bounded timer checkpoints at 1/3/8 seconds show whether the main thread continues after exit. No per-frame logging or continuing heartbeat is added.

Three launches, each with at most 100 events, are retained in localStorage, including app version, browser user agent, timestamps and coarse renderer resource counts. No auth/session objects, scene exports or network payloads are collected. Error text is bounded and scrubbed for URLs, email addresses, JWT-shaped tokens and named credential fields; script filenames/line/column remain for diagnosis. Local persistence is best effort and may be unavailable in restricted browsers or after a process/storage failure. Native crashes are not identified conclusively by a missing event alone.

`diagnostics.html` reads the saved records without initializing the app, Supabase, WebGL or a new diagnostic run. It offers copy, manual-selection fallback and JSON download. Use it on the affected device in the same browser/profile/origin. Avoid clearing site data and repeated app reloads before exporting.

Interpret the last successful stages together with error records:

- No `menu-home-click`: check running app version and whether the click reached its handler.
- `session-end-call` with no device/renderer end: browser session shutdown is the next area to inspect; a rejected request includes its error.
- Native end with a missing cleanup checkpoint or `cleanup-error:*`: inspect that specific cleanup section.
- Cleanup complete with `home-render-error`: use the exception and script location to inspect routing/DOM/parking.
- Home DOM, animation frame and timer checkpoints: app code reached home and remained alive until those checkpoints. Visual/compositor/native failures can still occur.
- Abrupt stop without a JS error: use live Android Chrome remote debugging or device crash logs; do not infer a confirmed GPU failure from breadcrumbs alone. Official setup: https://developer.chrome.com/docs/devtools/remote-debugging

Validation: syntax and whitespace checks only; no local browser/unit/device tests were run, respecting the user's instruction to handle testing. Existing repository CI remains unchanged.
