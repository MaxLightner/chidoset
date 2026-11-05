# Company workspace — implementation and verification, 2026-11-05

User resumed the paused work. The company workspace is implemented with three product roles: company manager, showroom operator and read-only QR guest. Central Chido retains exclusive control of set composition and account/record limits.

## Delivered

- `company.html`: private photo uploads, model/layout requests, support threads and attachments, notifications, showrooms, username/password operators, company information and subscription support. Managers can use support even when their app subscription has expired.
- `company-studio.html`: browser 3D editor for assigned products, official layouts and colorways. Drag or use move buttons; no AR/camera access is requested. Existing server limits remain transactional. SQL also rejects products outside the assigned set.
- Operators sign in at the app with manager-defined username/password. Suspension takes effect through membership/device checks. Passwords are stored only by Supabase Auth; previous passwords cannot be viewed. Operators cannot use company web APIs or save official records.
- Central requests and support conversations have statuses, replies, private attached photos and company notifications.
- Central monitoring includes cumulative current business-account history, active/current accounts, prepared and newly uploaded model counts, measured HTTP/WebSocket payloads, errors, model loads and foreground time. Guest accounts are excluded from business-account growth. Consumption history begins at measurement setup; these are browser payload measurements, not the hosting provider's total bandwidth or bill. Client telemetry is approximate and may be absent when a browser closes/offlines before delivery.
- Old portal links forward to the new manager workspace. Marketing website links point to the same workspace/backend.

## Verification

- 155 native tests (148 existing + 7 focused workspace/telemetry checks), JavaScript syntax checks.
- Full browser acceptance with disposable central account, two isolated companies, two managers and a showroom operator: UI account creation, private upload, tenant isolation, central replies/statuses, notifications, support, browser layout/colorway save, downstream showroom visibility, suspension, password reset and real telemetry.
- Desktop 1440px, tablet 768px and mobile 390px overflow checks and screenshot review.
- QR acceptance checks: seller camera following, no guest controls/camera requests, host/guest authentication separation and display removal on revocation.
- Transactional database checks of official-record caps and rejection of outside-set products.
- Temporary accounts, uploads and fixture records removed after tests. Security advisor: no new exposed tables; service-only tables intentionally have RLS without client policies. Existing leaked-password protection setting is disabled and was not changed.

## Remaining manual acceptance

User-requested physical AR checks on a supported phone/tablet remain the final acceptance step. No claim is made about real-device tracking accuracy, production load or provider bandwidth measurement. Marketing commerce/OTP/payment demos remain separate from the real company workspace.
