-- Trusted server/SQL editor only. Return the one-time code once; never commit it.
with raw as materialized (
 select 'CHIDO-CENTRAL-'||upper(encode(extensions.gen_random_bytes(16),'hex')) as code
), inserted as (
 insert into public.platform_admin_invites(code_hash,expires_at)
 select encode(extensions.digest(convert_to(code,'UTF8'),'sha256'),'hex'),now()+interval '7 days'
 from raw returning id
)
select raw.code as one_time_central_admin_invite from raw cross join inserted;
