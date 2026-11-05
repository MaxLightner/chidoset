-- Restrict mutable columns and fix live-session tenant ownership checks.
drop policy if exists live_sessions_insert_member on public.live_sessions;
create policy live_sessions_insert_member on public.live_sessions
for insert to authenticated
with check (
 host_user_id=auth.uid()
 and exists(
  select 1 from public.company_memberships m
  where m.company_id=public.live_sessions.company_id
   and m.user_id=auth.uid() and m.status='active'
   and (m.role='company_admin' or (m.role='branch' and m.branch_id=public.live_sessions.branch_id))
 )
);
alter table public.company_memberships add constraint company_membership_branch_role_check
check((role='branch' and branch_id is not null) or role='company_admin');
revoke update on public.live_sessions from authenticated;
grant update(revoked_at) on public.live_sessions to authenticated;
revoke update on public.branch_devices from authenticated;
grant update(last_seen_at) on public.branch_devices to authenticated;
revoke update on public.live_session_scenes from authenticated;
grant update(scene_state,updated_at) on public.live_session_scenes to authenticated;
revoke update on public.live_session_cameras from authenticated;
grant update(camera_state,updated_at) on public.live_session_cameras to authenticated;
grant usage on schema private to authenticated;
update public.products set asset_path=null where asset_path='';
