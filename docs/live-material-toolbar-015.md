# 0.15.0 — seller live route, material names and compact AR controls

Work begins from remote main `5f4ce6a`, preserving the separately published live-viewer and SheenChair changes. Inspection of the hosted database showed that the latest seller session still contained an empty scene and the initial camera marker (`timestamp: 0`, `waiting: true`). It did not establish why a particular device failed to publish. Source inspection identified a placement-gated, one-attempt auto-publisher, QR/network dependencies before viewer scene reads, and no-op updates being treated as success.

## Live route

- Automatic host connection now works while AR is active, including scanning, with periodic bounded retries and reconciliation to the latest session for that same authenticated host. Starting a share does not require floor placement or a catalog refresh. Explicit manual stop pauses auto-sharing until the next AR launch or manual share.
- Viewer login still routes `branch` to its QR/monitor page. Session selection filters `host_user_id`, not branch or company alone. Existing database RLS was inspected: scene/camera writes belong to an active session's host; host reads and scoped guest reads remain separate. Both tables are in `supabase_realtime`. No database policy, schema or Edge Function changes were required.
- Receiving the scene/camera is independent of QR retrieval/rendering. The monitor's show-here button moves the existing read-only viewport into a dialog and returns it on close; it does not create a second renderer or replace the seller's session with guest auth.
- Camera updates are capped at four per second and keep one in flight. Each update has a six-second abort deadline and must return an updated row; zero-row updates trigger recovery. Camera packets include tracking/placement/visibility and the floor pose, which viewers apply alongside the projection and viewpoint. Stale/waiting/scanning states have distinct messages without telling an already connected sender to place the floor again. Device-specific “tablet” wording was removed.
- The route remains synchronized read-only 3D from the host's viewpoint. It does not transmit camera video or the real AR background. Models are still loaded by the viewer. This release does not implement WebRTC video streaming.
- BFCache page navigation retains a viewer instead of returning to a destroyed renderer.

## Materials and presentation

- New material groups are case-insensitive `fabric`, `wood`, `metal`, `glass` substrings; Blender numbering remains supported. Existing `body` is a compatibility alias for wood, and old detail choices remain readable. A material name containing conflicting new group words is not guessed.
- The three existing sofa GLBs now name their sole material `fabric`. Their geometry and binary chunks are byte-identical to the prior files. The multi-material SheenChair names are preserved. Sofa AO can finish independently of a newer fabric selection and is preserved on reset. Existing undecomposed models are not artificially segmented.
- AR controls and Wide View now share one top strip with safe-area spacing. Model and material grids use five columns. A soft rear/side directional light adds edge highlights without another shadow map; Reinhard, exposure, camera fill and the 30% contact shadow are retained. This is fixed lighting, not automatic exposure or a guarantee of ideal appearance on every asset.

## Verification and remaining device check

Completed read-only inspection of hosted session state, live policies and Realtime publication; syntax/whitespace checks; GLB header/name checks and binary-chunk comparison. No application, unit, browser, login or physical-device tests were run locally, following the user's instruction to handle testing. End-to-end streaming, lighting appearance and compact layout on the affected device still need user confirmation.

Open the new app on the AR device and the website on another device with the **same seller username**. Enter AR; the website should leave its waiting state without requiring a second floor confirmation. Open show-here, move the host viewpoint and modify one object's material. A second seller account must follow its own session. For debugging, use the retained local diagnostic report after an unsuccessful connection.

Primary SDK references reviewed: https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal and https://supabase.com/docs/reference/javascript/using-modifiers-select . No dependency or paid service was added.
