# Stage 1 hosted browser checks

`stage1-browser.mjs` uses an existing Playwright installation and installed Google Chrome. It starts and stops its own local static server. Set `NODE_PATH` to the available Playwright module directory if it is outside this repository; no dependency installation is part of the script.

Run `node qa/stage1-browser.mjs`, then send one JSON array on stdin. Each entry has `slug`, `company_id`, `branch_id`, `set_id`, `role`, and a fresh one-time `code`. Provision two disposable companies with slugs ending in `-a` and `-b`; each has one branch, one published set containing the 32 catalog products, and fresh company-admin and branch codes. Use a trusted backend connection and the patterns in `supabase/operations` to provision them. Never save raw codes or passwords in tracked files.

The script uses the real configured backend. It activates temporary users, creates/archives official records, opens guest accounts, and creates/revokes live sessions. It must only receive disposable test fixtures. Delete those exact temporary users and companies through the trusted backend after the test, including on failure; preserve existing demo/customer data. Revoke sessions before deleting temporary users.

This is an explicit hosted integration test, separate from `npm test`. It does not emulate physical WebXR or verify real device tracking.
