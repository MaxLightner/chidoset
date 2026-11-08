-- Additive viewer consent protocol. Apply as a hosted migration.
create table public.live_view_requests (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.live_sessions(id) on delete cascade,
 requester_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null,
 status text not null default 'requested' check(status in ('requested','seen','approved','rejected','ended')),
 host_client_id uuid,
 host_message text not null default '' check(char_length(host_message)<=250),
 created_at timestamptz not null default now(),
 check(status not in ('seen','approved') or host_client_id is not null)
);
create index live_view_requests_session_status on public.live_view_requests(session_id,status,created_at desc);
create index live_view_requests_requester on public.live_view_requests(requester_id);
create index live_view_requests_claim on public.live_view_requests(session_id,host_client_id) where status in ('seen','approved');
alter table public.live_view_requests enable row level security;
revoke all on public.live_view_requests from anon,authenticated;
grant select on public.live_view_requests to authenticated;
grant insert(session_id,requester_id,client_id) on public.live_view_requests to authenticated;
grant update(status,host_client_id,host_message) on public.live_view_requests to authenticated;
grant all on public.live_view_requests to service_role;

create policy view_requests_read on public.live_view_requests for select to authenticated using (
 (requester_id=(select auth.uid()) or exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid())))
 and (exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid()) and s.revoked_at is null and s.expires_at>now()) or private.chido_guest_session_active(session_id))
);
create policy view_requests_insert on public.live_view_requests for insert to authenticated with check (
 requester_id=(select auth.uid()) and status='requested' and host_client_id is null
 and (exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid()) and s.revoked_at is null and s.expires_at>now()) or private.chido_guest_session_active(session_id))
);
create policy view_requests_update on public.live_view_requests for update to authenticated using (
 exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid()) and s.revoked_at is null and s.expires_at>now())
 or (requester_id=(select auth.uid()) and private.chido_guest_session_active(session_id))
) with check (
 exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid()) and s.revoked_at is null and s.expires_at>now())
 or (requester_id=(select auth.uid()) and status='ended' and private.chido_guest_session_active(session_id))
);

drop policy if exists live_scenes_read_guest on public.live_session_scenes;
create policy live_scenes_read_guest on public.live_session_scenes for select to authenticated using (
 private.chido_guest_session_active(session_id) and exists(select 1 from public.live_view_requests v where v.session_id=live_session_scenes.session_id and v.requester_id=(select auth.uid()) and v.status='approved')
);
drop policy if exists live_cameras_read_guest on public.live_session_cameras;
create policy live_cameras_read_guest on public.live_session_cameras for select to authenticated using (
 private.chido_guest_session_active(session_id) and exists(select 1 from public.live_view_requests v where v.session_id=live_session_cameras.session_id and v.requester_id=(select auth.uid()) and v.status='approved')
);

drop policy if exists live_scenes_update_host on public.live_session_scenes;
create policy live_scenes_update_host on public.live_session_scenes for update to authenticated using (
 exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid()) and s.revoked_at is null and s.expires_at>now())
) with check (
 exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid()) and s.revoked_at is null and s.expires_at>now())
 and exists(select 1 from public.live_view_requests v where v.session_id=live_session_scenes.session_id and v.host_client_id::text=live_session_scenes.scene_state->>'publisherClientId' and v.status in ('seen','approved'))
);
drop policy if exists live_cameras_update_host on public.live_session_cameras;
create policy live_cameras_update_host on public.live_session_cameras for update to authenticated using (
 exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid()) and s.revoked_at is null and s.expires_at>now())
) with check (
 exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=(select auth.uid()) and s.revoked_at is null and s.expires_at>now())
 and exists(select 1 from public.live_view_requests v where v.session_id=live_session_cameras.session_id and v.host_client_id::text=live_session_cameras.camera_state->>'publisherClientId' and v.status in ('seen','approved'))
);
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_view_requests') then
  alter publication supabase_realtime add table public.live_view_requests;
 end if;
end $$;
notify pgrst,'reload schema';


