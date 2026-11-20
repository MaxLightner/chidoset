-- Signed reads for published unified assets. Bucket remains private.
create policy chido_unified_live_assets_read on storage.objects for select to authenticated
using (
 bucket_id='chido-assets' and (
  exists(select 1 from public.products p
   where p.status='live'
   and (p.live_glb_path=objects.name or p.live_thumb_path=objects.name)
   and (p.company_id is null or
        p.company_id=(select c.id from public.companies c where c.code='GEN') or
        public.chido_has_company_role(p.company_id) or public.chido_is_platform_admin()))
  or exists(select 1 from public.material_families f
   where f.active and (f.normal_path=objects.name or f.roughness_path=objects.name)
   and (f.scope='shared' or public.chido_has_company_role(f.owner_company_id) or public.chido_is_platform_admin()))
  or exists(select 1 from public.material_swatches s join public.material_families f on f.id=s.family_id
   where s.active and f.active and (s.albedo_path=objects.name or s.thumb_path=objects.name)
   and (f.scope='shared' or public.chido_has_company_role(f.owner_company_id) or public.chido_is_platform_admin()))
 )
);