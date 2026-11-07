# Chido 0.12.2 — entry, navigation and photo weight

- Application: original welcome screen with one compact manager/seller login. Central accounts use the website. Existing `#access` links resolve to welcome.
- Website: `login.html` is the shared central/company login. Dashboard URLs restore an existing session, otherwise send users to the shared form. Legacy `portal.html` forwards there. Activation remains available through `company.html?activate=1` and `central.html?activate=1`.
- Remember me stores the session in persistent storage; unchecked uses tab storage. Passwords are never retained. Central and company/application sessions keep separate keys.
- Application account identity and company name appear in the normal header and AR overlay. Manager dashboard link is hidden for sellers.
- Regular XR end now reconstructs the launch screen from scene memory without refetching the catalog. Home exit retains its own route. Both XR session and renderer end signals are handled. Late start completion cannot modify a replaced renderer.
- Generated static images: five images reduced from 5,454,052 to 466,876 bytes (91.4%). Two PNG originals replaced by WebP. New gallery/company photos are normalized to WebP with a 1920px maximum side; prior saved photos remain readable.

Validation: syntax checks, 157 unit/integrity checks, and `qa/navigation-session.mjs` using live demo accounts supplied through hidden stdin. Browser QA uses a simulated XR end signal with the real renderer and app cleanup. Physical tablet/ARCore session behavior still needs device testing.
