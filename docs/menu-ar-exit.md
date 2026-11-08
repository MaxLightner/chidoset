# 0.13.4 — menu exit transition

The user reports that menu → exit AR / home still fails on Samsung S8 Chrome after 0.13.3. The physical-device failure has not been reproduced locally; this is a targeted lifecycle correction, not a confirmed diagnosis of the native crash.

Source inspection found that `bindXRExit` calls Studio cleanup synchronously from Three's `sessionend` dispatch. Studio then resized the framebuffer and queued navigation in a microtask. Keeping the renderer alive in 0.13.3 did not remove this work from the native end event.

Studio now queues cleanup in a separate task, checks that the same session is ending and the XR driver is no longer presenting, and coalesces duplicate completion requests. Menu exit suppresses rendering and resize immediately, including the unnecessary preview resize during cleanup. Resume clears that suppression; timeout restores rendering so the user can retry. Home navigation additionally checks the renderer's presenting state. Disposal cancels pending cleanup.

Validation for this release: JavaScript syntax and diff whitespace checks only. Per the user's instruction, no browser, unit or physical-device tests were run locally. The repository's existing push-triggered CI is unchanged. Device confirmation of menu exit remains outstanding.
