-- The public product has exactly manager, showroom operator and QR guest roles.
do $$ begin if exists(select 1 from public.company_memberships where role not in ('company_admin','branch')) then raise exception 'Review existing web-role accounts before simplifying';end if;end $$;
alter table public.company_memberships drop constraint company_memberships_role_check;
alter table public.company_memberships add constraint company_memberships_role_check check(role in ('company_admin','branch'));
alter table public.company_memberships drop constraint company_membership_branch_role_check;
alter table public.company_memberships add constraint company_membership_branch_role_check check((role='branch' and branch_id is not null) or (role='company_admin' and branch_id is null));
create or replace function private.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','branch'])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.chido_company_enabled(p_company_id) and exists(
 select 1 from public.company_memberships m where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active' and m.role=any(p_roles)
 and (m.role='company_admin' or exists(select 1 from public.branches b join public.branch_devices d on d.branch_id=b.id where b.id=m.branch_id and b.company_id=m.company_id and b.status='active' and d.user_id=auth.uid() and d.revoked_at is null)))
$$;
create or replace function public.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','branch'])
returns boolean language sql stable security invoker set search_path='' as $$ select private.chido_has_company_role(p_company_id,p_roles) $$;
create or replace function private.chido_portal_role(p_company_id uuid)
returns text language sql stable security definer set search_path='' as $$ select m.role from public.company_memberships m where auth.uid() is not null and m.user_id=auth.uid() and m.company_id=p_company_id and m.status='active' and m.role='company_admin' limit 1 $$;
create table public.showroom_accounts(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,branch_id uuid not null references public.branches(id) on delete cascade,
 user_id uuid not null unique references auth.users(id) on delete cascade,login_name text not null unique check(login_name ~ '^[a-z0-9][a-z0-9._-]{2,49}$'),display_name text not null,status text not null default 'active' check(status in ('active','suspended')),created_at timestamptz not null default now(),last_login_at timestamptz
);
alter table public.showroom_accounts enable row level security;
create policy showroom_accounts_manager on public.showroom_accounts for select to authenticated using(private.chido_portal_role(company_id)='company_admin' or public.chido_is_platform_admin());
grant select on public.showroom_accounts to authenticated;
grant select,insert,update,delete on public.showroom_accounts to service_role;
create table public.showroom_login_limits(login_name text primary key,failures int not null default 0,window_started_at timestamptz not null default now());
alter table public.showroom_login_limits enable row level security;
grant select,insert,update,delete on public.showroom_login_limits to service_role;
create or replace function public.chido_showroom_login_failed(p_name text)
returns void language sql security invoker set search_path='' as $$
 insert into public.showroom_login_limits(login_name,failures,window_started_at) values(p_name,1,now()) on conflict(login_name) do update set failures=case when public.showroom_login_limits.window_started_at<now()-interval '15 minutes' then 1 else public.showroom_login_limits.failures+1 end,window_started_at=case when public.showroom_login_limits.window_started_at<now()-interval '15 minutes' then now() else public.showroom_login_limits.window_started_at end
$$;
revoke all on function public.chido_showroom_login_failed(text) from public,anon,authenticated;
grant execute on function public.chido_showroom_login_failed(text) to service_role;
