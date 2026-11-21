-- Allow the read-only CHIDO Studio catalog to compare published model versions without exposing customer data.
-- Existing products RLS remains active: anon can read only live General Library rows.
grant select (asset_version) on public.products to anon;
