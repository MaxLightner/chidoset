create or replace function private.chido_revoke_changed_access()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 case tg_table_name
 when 'companies' then
  if new.status<>'active' then update public.live_sessions set revoked_at=now() where company_id=new.id and revoked_at is null;end if;
 when 'branches' then
  if new.status<>'active' then update public.live_sessions set revoked_at=now() where branch_id=new.id and revoked_at is null;end if;
 when 'company_memberships' then
  if new.status<>'active' then update public.live_sessions set revoked_at=now() where company_id=new.company_id and host_user_id=new.user_id and revoked_at is null;end if;
 when 'subscriptions' then
  if not private.chido_company_enabled(new.company_id) then update public.live_sessions set revoked_at=now() where company_id=new.company_id and revoked_at is null;end if;
 end case;
 return new;
end $$;
