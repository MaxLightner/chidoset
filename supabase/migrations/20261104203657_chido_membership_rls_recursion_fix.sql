-- SECURITY DEFINER is narrowly scoped to the current caller's own membership check.
-- It prevents recursive evaluation of the company_memberships RLS policy.
create or replace function public.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','branch'])
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists(
  select 1 from public.company_memberships m
  where m.company_id=p_company_id and m.user_id=auth.uid()
   and m.status='active' and m.role=any(p_roles)
 )
$$;
revoke all on function public.chido_has_company_role(uuid,text[]) from public,anon;
grant execute on function public.chido_has_company_role(uuid,text[]) to authenticated;
