create or replace function private.chido_company_enabled(p_company_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.companies c where c.id=p_company_id and c.status='active')
 and (not exists(select 1 from public.subscriptions s where s.company_id=p_company_id) or coalesce((
 select s.status in ('active','trial') and (s.ends_at is null or s.ends_at>now())
 from public.subscriptions s where s.company_id=p_company_id and s.starts_at<=now()
 order by s.created_at desc,s.id desc limit 1),false))
$$;
revoke all on function private.chido_company_enabled(uuid) from public,anon;
grant execute on function private.chido_company_enabled(uuid) to authenticated,service_role;
create or replace function private.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','branch'])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.chido_company_enabled(p_company_id) and exists(
 select 1 from public.company_memberships m where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active' and m.role=any(p_roles)
 and (m.role='company_admin' or exists(select 1 from public.branches b join public.branch_devices d on d.branch_id=b.id where b.id=m.branch_id and b.company_id=m.company_id and b.status='active' and d.user_id=auth.uid() and d.revoked_at is null)))
$$;
create or replace function private.chido_guest_session_active(p_session_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.jwt()->'app_metadata'->>'role')='guest'
 and (auth.jwt()->'app_metadata'->>'live_session_id')=p_session_id::text
 and exists(select 1 from public.live_sessions s join public.live_session_guests g on g.session_id=s.id and g.user_id=auth.uid()
 where s.id=p_session_id and s.revoked_at is null and s.expires_at>now() and private.chido_company_enabled(s.company_id))
$$;
create or replace function private.chido_limit_official_records()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_limit int;v_count int;
begin
 if new.status='archived' then return new;end if;
 perform 1 from public.sets where id=new.set_id for update;
 if tg_table_name='layouts' then
  select c.max_layouts_per_set into v_limit from public.sets s join public.companies c on c.id=s.company_id where s.id=new.set_id;
  select count(*) into v_count from public.layouts where set_id=new.set_id and id<>new.id and status<>'archived';
 else
  select c.max_colorways_per_set into v_limit from public.sets s join public.companies c on c.id=s.company_id where s.id=new.set_id;
  select count(*) into v_count from public.colorways where set_id=new.set_id and id<>new.id and status<>'archived';
 end if;
 if v_count>=v_limit then raise exception 'ظرفیت رکوردهای رسمی این ست تکمیل شده است.' using errcode='23514';end if;
 return new;
end $$;
revoke all on function private.chido_limit_official_records() from public,anon,authenticated;
create trigger chido_layout_limits before insert or update on public.layouts for each row execute function private.chido_limit_official_records();
create trigger chido_colorway_limits before insert or update on public.colorways for each row execute function private.chido_limit_official_records();
create or replace function private.chido_clamp_live_expiry()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_ends timestamptz;
begin
 select ends_at into v_ends from public.subscriptions where company_id=new.company_id and starts_at<=now() order by created_at desc,id desc limit 1;
 if v_ends is not null then new.expires_at=least(new.expires_at,v_ends);end if;
 return new;
end $$;
revoke all on function private.chido_clamp_live_expiry() from public,anon,authenticated;
create trigger chido_live_expiry before insert on public.live_sessions for each row execute function private.chido_clamp_live_expiry();
create or replace function private.chido_revoke_changed_access()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='companies' and new.status<>'active' then
  update public.live_sessions set revoked_at=now() where company_id=new.id and revoked_at is null;
 elsif tg_table_name='branches' and new.status<>'active' then
  update public.live_sessions set revoked_at=now() where branch_id=new.id and revoked_at is null;
 elsif tg_table_name='company_memberships' and new.status<>'active' then
  update public.live_sessions set revoked_at=now() where company_id=new.company_id and host_user_id=new.user_id and revoked_at is null;
 elsif tg_table_name='subscriptions' and not private.chido_company_enabled(new.company_id) then
  update public.live_sessions set revoked_at=now() where company_id=new.company_id and revoked_at is null;
 end if;
 return new;
end $$;
revoke all on function private.chido_revoke_changed_access() from public,anon,authenticated;
create trigger chido_company_access after update on public.companies for each row execute function private.chido_revoke_changed_access();
create trigger chido_branch_access after update on public.branches for each row execute function private.chido_revoke_changed_access();
create trigger chido_member_access after update on public.company_memberships for each row execute function private.chido_revoke_changed_access();
create trigger chido_subscription_access after insert or update on public.subscriptions for each row execute function private.chido_revoke_changed_access();
