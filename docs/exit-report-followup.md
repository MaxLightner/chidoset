# 0.13.6 — narrow post-session native cleanup

Evidence: the user supplied a 0.13.5 report containing two menu exit attempts. In both, the device end event, end promise resolution, renderer end event and queued cleanup succeeded. The final persisted entry was `xr-ended`; neither `cleanup-inputs-done`, a home navigation entry nor a JS exception followed. The next launches started on `studio` about 4.5–4.8 seconds later. This narrows the failure window to early cleanup; it does not prove a particular failing call, GPU crash, memory pressure, refresh mechanism or database cause.

The report has a desktop-formatted Linux Chrome 143 user agent. The user explicitly confirmed that it was exported on the Samsung device; do not reject that provenance based solely on the user agent.

The early-cleanup window included listener disposal, pending-photo cancellation, optional Wide View hiding, hit-test source cancellation and anchor deletion. After native XR shutdown, the application now forgets old hit-test handles and resets anchor bookkeeping without invoking their native `cancel`/`delete` methods. Explicit in-session rescan still releases active resources as before. Late asynchronous hit-test/anchor results only invoke native cleanup when they still belong to the current session.

This is a targeted mitigation within the evidenced window, not a confirmed exact root cause. Additional before/after checkpoints bracket binding, photo and Wide View cleanup. If the problem remains, a new exported report should narrow the remaining window further.

Primary references reviewed: the W3C hit-test specification describes `cancel()` on an inactive source as an `InvalidStateError` (https://www.w3.org/TR/webxr-hit-test-1/#dom-xrhittestsource-cancel); the Immersive Web hit-test sample cancels a source before requesting session end (https://github.com/immersive-web/webxr-samples/blob/main/hit-test.html). These references do not establish the cause of the user's failure.

Validation: syntax and whitespace checks only. No local unit/browser/device tests were run, per the user's instruction. Physical-device confirmation remains outstanding.
