-- Issue a one-time activation code for a showroom branch.
-- Replace the company and branch slugs before running. Copy the returned code once.
with raw as materialized (
  select 'CHIDO-BRANCH-' || upper(encode(extensions.gen_random_bytes(12),'hex')) as code
), inserted as (
  insert into public.activation_codes(company_id,branch_id,role,code_hash,expires_at)
  select c.id,b.id,'branch',
    encode(extensions.digest(convert_to(raw.code,'UTF8'),'sha256'),'hex'),
    now()+interval '30 days'
  from raw
  join public.companies c on c.slug='REPLACE-WITH-COMPANY-SLUG'
  join public.branches b on b.company_id=c.id and b.slug='REPLACE-WITH-BRANCH-SLUG'
  returning id
)
select raw.code as one_time_branch_activation_code from raw cross join inserted;
