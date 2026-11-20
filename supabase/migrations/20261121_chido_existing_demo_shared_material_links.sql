-- Preserve existing demo company material choices on switchover.
insert into public.company_materials(company_id,family_id,is_default)
select c.id,f.id,false
from public.companies c
cross join public.material_families f
where c.code is distinct from 'GEN' and f.scope='shared'
on conflict(company_id,family_id) do nothing;