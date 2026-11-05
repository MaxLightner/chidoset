
-- Keep authorization checks private and bind them to active companies/devices.
create or replace function private.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','branch'])
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists (
  select 1 from public.company_memberships m
  join public.companies c on c.id=m.company_id and c.status='active'
  where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active' and m.role=any(p_roles)
   and (m.role='company_admin' or exists (
    select 1 from public.branches b join public.branch_devices d on d.branch_id=b.id
    where b.id=m.branch_id and b.company_id=m.company_id and b.status='active'
     and d.user_id=auth.uid() and d.revoked_at is null
   ))
 )
$$;
revoke all on function private.chido_has_company_role(uuid,text[]) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.chido_has_company_role(uuid,text[]) to authenticated;
create or replace function public.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','branch'])
returns boolean language sql stable security invoker set search_path=''
as $$ select private.chido_has_company_role(p_company_id,p_roles) $$;

drop policy if exists products_read_active on public.products;
create policy products_read_active on public.products for select to authenticated using (
 public.chido_is_platform_admin() or (active and exists (
 select 1 from public.company_memberships m where m.user_id=auth.uid() and public.chido_has_company_role(m.company_id)
 ))
);
drop policy if exists layouts_read_company on public.layouts;
create policy layouts_read_company on public.layouts for select to authenticated using (
 exists(select 1 from public.sets s where s.id=set_id and
 (public.chido_is_platform_admin() or public.chido_is_company_admin(s.company_id) or (status='published' and public.chido_has_company_role(s.company_id))))
);
drop policy if exists colorways_read_company on public.colorways;
create policy colorways_read_company on public.colorways for select to authenticated using (
 exists(select 1 from public.sets s where s.id=set_id and
 (public.chido_is_platform_admin() or public.chido_is_company_admin(s.company_id) or (status='published' and public.chido_has_company_role(s.company_id))))
);
drop policy if exists live_sessions_insert_member on public.live_sessions;
create policy live_sessions_insert_member on public.live_sessions for insert to authenticated with check (
 host_user_id=auth.uid() and public.chido_has_company_role(company_id)
 and expires_at>now() and expires_at<=now()+interval '1 hour'
 and exists(select 1 from public.branches b where b.id=branch_id and b.company_id=live_sessions.company_id and b.status='active')
 and exists(select 1 from public.company_memberships m where m.company_id=live_sessions.company_id and m.user_id=auth.uid() and m.status='active' and (m.role='company_admin' or m.branch_id=live_sessions.branch_id))
);
-- Company limits and subscription management belong to the central system.
revoke update on public.companies from authenticated;
grant update(name) on public.companies to authenticated;

