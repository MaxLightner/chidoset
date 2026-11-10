# Local browser dependencies

These are local copies of dependencies the application already used. Versions
and APIs are unchanged; browsers no longer need esm.sh to start or generate QR.

- `supabase-js-2.119.0.mjs`: `@supabase/supabase-js@2.119.0`, browser ESM bundle
  from `https://esm.sh/@supabase/supabase-js@2.119.0/es2022/supabase-js.bundle.mjs`.
  MIT license in `SUPABASE-LICENSE.txt`; bundled dependency notices retained.
- `qrcode-1.5.4.mjs`: `qrcode@1.5.4`, browser ESM bundle from
  `https://esm.sh/qrcode@1.5.4/es2022/qrcode.bundle.mjs`.
  MIT license in `QRCODE-LICENSE.txt`.

Only source-map links were removed because those maps are not shipped.
No JavaScript is imported from external module CDNs at application startup.
