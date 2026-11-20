-- Expose unified read tables to authenticated API clients; RLS enforces tenant scope.
grant select on public.asset_sync_manifest to authenticated;
grant select on public.material_families to authenticated;
grant select on public.material_swatches to authenticated;
grant select on public.company_materials to authenticated;
grant select on public.product_material_overrides to authenticated;
grant select on public.studio_notifications to authenticated;
-- No anon grants; Studio writes use server-side credentials only.