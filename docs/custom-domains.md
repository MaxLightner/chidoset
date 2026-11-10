# Chido production domains

- `https://chidoset.ir/`: opens the marketing website at `/website/`.
- `https://chidoset.ir/index.html`: AR application. Login and company pages use the same origin.
- `https://admin.chidoset.ir/`: planned central-administration hostname; its independent GitHub Pages publication is not configured yet.
- `www.chidoset.ir`: canonical redirect to the marketing website.

Source and hosting: `MaxLightner/chidoset`, GitHub Pages, `main`, repository root.
Cloudflare manages DNS. The Cloudflare Pages hosting project was deleted; do not recreate it or migrate hosting away from GitHub Pages.

## Pages configuration

In GitHub Settings → Pages, use “Deploy from a branch”, `main`, `/ (root)`, custom domain `chidoset.ir`, and enforce HTTPS. The root `CNAME` file must contain `chidoset.ir`. GitHub automatically deploys pushes to `main`.

The bare-domain entry redirects to the existing marketing directory. Explicit `/index.html` remains the application, preserving its relative assets and navigation. A single Pages publication does not provide independent app/admin host routing. Merely creating their DNS records does not publish those applications.

`deploy/cloudflare-worker.mjs` and `scripts/build-cloudflare.mjs` are inactive legacy deployment files. Their host routing does not run on GitHub Pages.

The branch-based Pages publication serves tracked static files. Never commit credentials or private customer data. Existing client libraries are vendored locally so startup and QR generation do not depend on a separate JavaScript CDN.

## Identity

Authentication tokens are never transferred in query strings or fragments. Existing server-side role checks remain authoritative; a hostname never grants a role. The intended central-admin origin remains separate, but its publication must be completed before treating that hostname as live.

If Supabase email confirmation, password reset or OAuth is enabled, configure exact production callback URLs in Auth URL Configuration. Do not authorize arbitrary store subdomains as authentication callbacks. Current username/password login uses `chido-login` and does not require an OAuth callback.

## Storefronts

`/stores/<slug>` is reserved for future published public storefronts; it currently returns 404. Adding DNS does not implement storefronts or a site builder. Build these against stable company/branch IDs, separate public published content from private workspaces, and validate ownership server-side before introducing custom hostnames.

## Migration scope

Active source, exported layout format, browser settings, gallery identifier and diagnostic identifiers use Chido branding. Historical Git commits are retained. Local-only browser records under retired identifiers are not copied automatically. The domain move starts new browser sessions.
