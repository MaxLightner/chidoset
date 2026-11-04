-- Issue a one-time company-admin invitation code.
-- Replace the company slug before running. Copy the returned code once; only its SHA-256 hash is stored.
with raw as materialized (
  select 'CHIDO-ADMIN-' || upper(encode(extensions.gen_random_bytes(12),'hex')) as code
), inserted as (
  insert into public.activation_codes(company_id,branch_id,role,code_hash,expires_at)
  select c.id,null,'company_admin',
    encode(extensions.digest(convert_to(raw.code,'UTF8'),'sha256'),'hex'),
    now()+interval '30 days'
  from raw cross join public.companies c
  where c.slug='REPLACE-WITH-COMPANY-SLUG'
  returning id
)
select raw.code as one_time_company_admin_code from raw cross join inserted;
