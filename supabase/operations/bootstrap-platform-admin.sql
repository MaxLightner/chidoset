-- Bootstrap the first Chido platform administrator after the person has created an Auth account.
-- Replace the UUID with that account's auth.users.id. Run only from the trusted SQL editor.
insert into public.platform_roles(user_id,role)
values('REPLACE-WITH-AUTH-USER-UUID'::uuid,'platform_admin')
on conflict(user_id) do update set role='platform_admin';
