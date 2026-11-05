create or replace function public.chido_activation_company_enabled(p_company_id uuid)
returns boolean language sql stable security invoker set search_path=''
as $$ select private.chido_company_enabled(p_company_id) $$;
revoke all on function public.chido_activation_company_enabled(uuid) from public,anon,authenticated;
grant execute on function public.chido_activation_company_enabled(uuid) to service_role;
