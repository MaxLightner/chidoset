# Chido production domains

- `https://chidoset.ir/`: marketing website.
- `https://app.chidoset.ir/`: AR application and company workspace.
- `https://admin.chidoset.ir/`: central administration, with a separate browser session.
- `www.chidoset.ir`: canonical redirect to the marketing website.

Source repository: `MaxLightner/chidoset`. The repository stores code; Cloudflare Pages serves production.

## Pages configuration

Use the `main` branch, no framework preset, build command `npm run build:cloudflare`, output directory `dist`, and Node 22 or later. Associate all four production hostnames with the same Pages project. `deploy/cloudflare-worker.mjs` routes each hostname to its correct entry point. The source still runs as an ordinary static checkout for local QA.

The build uses only Node's standard library and tracked public files. It excludes database code, operational scripts, tests, documentation, Git metadata and environment files. Models larger than the Pages per-file limit stop the build rather than silently disappear.

## Identity

Administration, application and marketing have distinct browser origins. Authentication tokens are never transferred in query strings or fragments. Central administrators enter through the admin hostname. Existing server-side role checks remain authoritative; a hostname never grants a role.

If Supabase email confirmation, password reset or OAuth is enabled, configure exact production callback URLs in Auth URL Configuration. Do not authorize arbitrary store subdomains as authentication callbacks. Current username/password login uses `chido-login` and does not require an OAuth callback.

## Storefronts

`/stores/<slug>` is reserved for future published public storefronts; it currently returns 404. Adding DNS does not implement storefronts or a site builder. Build these against stable company/branch IDs, separate public published content from private workspaces, and validate ownership server-side before introducing custom hostnames.

## Migration scope

Active source, exported layout format, browser settings, gallery identifier and diagnostic identifiers use Chido branding. Historical Git commits are retained. Local-only browser records under retired identifiers are not copied automatically. The domain move starts new browser sessions.
