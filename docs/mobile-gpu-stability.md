# Chido 0.13.3 — mobile GPU lifetime and lighter contact shadow

Reported symptoms on Samsung S8 / Chrome: the home screen appears briefly after XR exit then the app page disappears; separately, Chrome itself sometimes closes. A GPU/driver or memory failure is a hypothesis; physical-device crash logs are not available.

- Removed delayed renderer destruction from ordinary app navigation. One primary renderer and scene are suspended on home/other app pages and resumed on return, retaining the same models and textures. Ownership is tied to authenticated company/user; sign-out/account switching clears prior content.
- The optional Wide View renderer is disabled and retained on XR exit rather than disposed during the transition; it also uses the touch pixel budget.
- Suspended views do not render, listen for input or resize. Detached/zero-size views cannot resize the framebuffer to zero. A hidden AR launch view does not draw behind its instructions.
- Coarse-pointer devices use DPR capped at 1, XR framebuffer scale 0.75, no MSAA and no persistent drawing buffer. This trades some virtual-image sharpness for a lower GPU budget. Photo capture still explicitly renders before reading the canvas.
- Real shadow maps are enabled only for an architectural floor. The default sofa-only contact decal does not allocate/update the unused real-shadow pass.
- Contact shadow opacity is 0.30, preserving the v15 rounded shape and fade.
- WebGL context loss suspends rendering and requests XR termination; restoration resumes only an active view. Bounded local lifecycle breadcrumbs and resource counts are included in the existing diagnostic JSON, with no tokens/account data or automatic server transmission.
- Fabric waits have a deadline so abandoned model clones are not retained indefinitely by unresolved material promises. Native GLB rendering remains independent of cloth/AO.

Validation: 174 unit/integrity checks; `qa/mobile-stability.mjs` emulates a touch/high-DPR viewport, loads a real sofa and its material, verifies the low-GPU settings, captures a nonblank photo without preserving buffers, exercises three XR/home/return cycles with a 1.6-second home dwell (one renderer, zero destroys, same sofa UUID), deliberately loses/restores an actual WebGL context, and verifies that home remains visible and an idle intro stops drawing. XR camera/end signals are simulated; Samsung S8 hardware/Chrome-process stability is not certified by these tests.
