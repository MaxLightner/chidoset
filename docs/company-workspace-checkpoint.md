# Company workspace checkpoint — paused by user, 2026-11-05

User explicitly requested stopping at a useful checkpoint because about 10% of the five-hour limit remained. Do not continue implementation until the user resumes.

## Last released version

`main` at `2e8c9ea95269d8a16b48a995402d3df8a3fadc94`: central administration is published. The manager workspace changes below are unfinished on `feature/company-workspace`; do not merge or deploy them as complete.

## Latest user requirements take precedence

Keep usage simple, with exactly three product roles:

1. Company manager controls company photos, requests, support, showrooms and showroom users. Central Chido alone determines the sets assigned to the company. Manager saves official layouts/colorways within the centrally assigned limits, including from the web rather than requiring AR.
2. Showroom operator signs into the app with a username/password defined by the company manager. Can present/use the scene, but cannot save official layouts/colorways. Do not introduce staff/viewer web-account roles or complicated invitation workflows.
3. QR guest only views the host's 3D camera angle, has no controls and receives no real AR camera background.

Also requested central monitoring: user growth, measured network/data usage, prepared/uploaded model counts and related real charts. Current release has recent-activity charts and counts, not complete network/growth telemetry. Be candid about this distinction; do not fabricate historical data or equate client payload measurements with the hosting provider's total bandwidth bill.

## Work saved so far

- Read existing portal, central UI, roles/RLS, app scene methods and relevant design/Supabase/testing skills.
- Added `workspace-domain.mjs` and `company-service.js` for validated company actions and private photo upload.
- Added `company.html` and `company.css` as an initial workspace shell. **`company.js` has not been implemented**, so this shell is not usable or published.
- Added `supabase/company-workspace.sql`: private photo/media records, requests, tickets, threaded messages, notifications, company mutation RPC and storage policies.
- Applied hosted migration **`chido_company_workspace`**. It initially introduced extra web roles/invites before the user's clarification.
- Then applied **`chido_simple_company_roles`**, assembled in `supabase/company-simple.sql`. It restores company membership roles to `company_admin`/`branch`, restricts the company portal helper to manager, adds `showroom_accounts` and login-attempt state, and extends the company RPC for showroom account registration/update. Earlier web-invite tables remain unused; do not expose their UI.
- `supabase/company-simple-base.sql` is the base source; the full `company-simple.sql` contains the updated RPC. Copy hosted migration versions into proper migration files when resuming; do not rerun the initial CREATE TABLE migrations.
- `supabase/functions/chido-company/index.ts` was deployed as **version 1** before the simplified-roles clarification. Local source subsequently received the membership `company_id` fix but was not redeployed. It still needs refactoring to remove invite endpoints and implement manager-created showroom credentials and anonymous showroom login. Current hosted schema rejects the extra membership roles.
- Local `chido-admin/index.ts` has un-deployed additions for company request/support snapshots and replies. Its live version remains the previous central-admin release.
- No new test fixtures/accounts/photos have been created in this turn. No new manager-workspace browser acceptance or final regression suite has been run.

## Next implementation steps when resumed

1. Finish simplified company API: manager-only workspace, create/reset/suspend showroom username/password via Supabase Auth with no password logging/storage in public tables, and authenticated app showroom login. Scope every mutation to the manager's company. Keep QR guests read-only.
2. Finish `company.js`, simplify `company.html` to manager login/activation only (remove the initially scaffolded extra colleague-invite tab), and use showrooms/users instead of staff/viewer roles. Keep the current released portal working until the replacement passes checks.
3. Add browser-based scene/layout/colorway editor using the existing Studio, within existing server-enforced limits; set composition stays central-only.
4. Finish central support/request conversation UI and deploy matching backend; photos must remain private and company-scoped.
5. Implement real monitoring collection/aggregation and central charts. Separate business account growth from temporary guest accounts. Mark the start of measurement and unavailable history clearly.
6. Test cross-company isolation, showroom login/no-save restrictions, photo requests, support replies, manager actions and guest 3D-only display with disposable fixtures; clean up exact fixtures/uploads. Then publish and update links.

Do not replace the existing released portal with the unfinished shell or claim this manager-workspace task is complete. User wants their manual device tests at the end, not as a prerequisite to further building.
