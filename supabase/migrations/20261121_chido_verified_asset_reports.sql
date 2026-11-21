-- CHIDO verified published model component reports: GLB-native and app-runtime facts.
alter table public.product_asset_reports
 add column if not exists published_details jsonb,
 add column if not exists scanned_asset_path text,
 add column if not exists scanned_asset_version integer;
grant select (published_details,scanned_asset_path,scanned_asset_version)
 on public.product_asset_reports to anon;
