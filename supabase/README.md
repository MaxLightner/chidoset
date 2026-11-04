# Chido Stage 1 backend

The hosted Supabase project is currently the former Menosaz test project, deliberately cleared and repurposed for Chido. The old Auth users and public application tables were removed; the Supabase project itself, Auth service, extension schemas and migration ledger were retained.

## Current model

- `companies`, `branches`, `company_memberships`, `branch_devices`
- `activation_codes`: stores only SHA-256 hashes; one-time, expiring codes
- `products`: global product library, independent from sets
- `sets`, `set_products`: set membership is platform-admin managed
- `layouts`, `colorways`: separate company-admin-managed records
- `subscriptions`, `activity_events`, `layout_requests`
- `live_sessions`, `live_session_scenes`, `live_session_cameras`, `live_session_guests`

Company defaults are currently 3 layouts and 5 colorways per set. These are editable company settings, not hard-coded application limits.

## Activation

The central system-admin panel is deferred to Stage 2. For the pilot, issue codes from the trusted Supabase SQL editor using the scripts in `supabase/operations`. Never put the raw code in a public file or browser bundle. The app exchanges a branch code through the `chido-api` Edge Function and receives a Supabase Auth session. A company-admin code is redeemed on `portal.html`; the manager chooses their own email and password.

## Live guest view

The host creates a 45-minute session. The raw guest token is only in the QR/link; the database stores its hash. Each guest exchanges that token for a short-lived guest Auth user. RLS permits that guest to read only the session's scene and camera rows while the session remains active. Guests cannot write scene or camera state. The guest page does not request camera permission and never starts WebXR.

Camera pose is updated through `live_session_cameras`; scene state is updated only when the scene changes through `live_session_scenes`. Both tables are in `supabase_realtime`.

## Deployment

- App/portal/guest pages are in the existing `tolica-ar` GitHub Pages repository.
- `chido-api` is deployed as a Supabase Edge Function with gateway JWT verification disabled because it supports code exchange and guest access; each route performs its own validation.
- `menu-api` is replaced with a 410 retirement response.
- The browser bundle contains only the Supabase publishable key. The service-role key is used only by the Edge Function.

## Stage 2

Build the full Chido platform-admin panel: companies, branch provisioning, subscription administration, product intake/library, set membership, activity analytics, and service health. The current company portal is a Stage 1 customer workspace and feature preview, not the central system-admin panel.
