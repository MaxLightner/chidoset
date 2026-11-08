# Chido 0.13.2 — progressive material loading and XR teardown order

Reported device: Samsung S8, Chrome; exact Android/Chrome version and physical device verification remain unavailable.

The previous model promise waited for GLB, cloth and AO together. A delayed JPEG therefore prevented the actual furniture mesh from appearing. GLB readiness is now independent; native GLB materials remain visible until external cloth/AO are ready. Fabric changes use a request counter so a late prior download cannot replace the latest choice. Failed fabric loads preserve the native material.

XR device end can arrive before Three.js restores its framebuffer. App cleanup now waits for the renderer sessionend (or confirmed non-presenting state). Cleanup steps tolerate optional tool failures. Home navigation paints its DOM before heavy scene/GPU disposal. A late end confirmation retains the user's home-navigation intent after the request deadline; active renderers are never force-disposed by that deadline.

Validation: 170 unit/integrity checks; `qa/progressive-model-exit.mjs` with real GLB and deliberately blocked JPEG requests, then renderer/device events separated in time, an injected cleanup failure and a check that home exists before disposal. Local asset GLB readiness was 720ms in that run; live Supabase catalog request was approximately 1250ms. These are environment-specific checks, not a Samsung S8 benchmark. `qa/xr-exit-timeout.mjs` covers an unresolved end request followed by a late device confirmation. No backend schema or account changes.
