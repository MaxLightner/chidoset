-- Read-only public General Library feed for the desktop Studio before local disk setup.
-- Never expose company-owned product rows, private storage, or admin notes.
alter table public.products enable row level security;
alter table public.companies enable row level security;
alter table public.material_families enable row level security;
alter table public.material_swatches enable row level security;
grant usage on schema public to anon;
grant select (id, product_code, name, category, status, active, catalog_index,
  asset_path, thumbnail_path, live_glb_path, live_thumb_path, glb_hash, size_m,
  company_id, updated_at) on public.products to anon;
grant select (id, code, name) on public.companies to anon;
grant select (id, code, name, kind, scope, active, tile_cm, roughness_factor, normal_scale,
 normal_path, roughness_path, owner_company_id) on public.material_families to anon;
grant select (id, family_id, code, name, hex_color, active, albedo_path, thumb_path,
 legacy_albedo_path, legacy_thumb_path, legacy_source, file_hash) on public.material_swatches to anon;

drop policy if exists chido_public_gen_live_read on public.products;
create policy chido_public_gen_live_read on public.products for select to anon
using (status='live' and active=true and (
 company_id is null or company_id=(select c.id from public.companies c where c.code='GEN')));
drop policy if exists chido_public_gen_company_read on public.companies;
create policy chido_public_gen_company_read on public.companies for select to anon using(code='GEN');
drop policy if exists chido_public_shared_family_read on public.material_families;
create policy chido_public_shared_family_read on public.material_families for select to anon
using(active and scope='shared' and owner_company_id is null);
drop policy if exists chido_public_shared_swatch_read on public.material_swatches;
create policy chido_public_shared_swatch_read on public.material_swatches for select to anon
using(active and exists(select 1 from public.material_families f
 where f.id=family_id and f.scope='shared' and f.active));
-- Storage bucket chido-assets stays private. No anon read on storage.objects.
