alter table public.company_memberships drop constraint company_memberships_role_check;
alter table public.company_memberships add constraint company_memberships_role_check check(role in ('company_admin','company_staff','company_viewer','branch'));
alter table public.company_memberships drop constraint company_membership_branch_role_check;
alter table public.company_memberships add constraint company_membership_branch_role_check check((role='branch' and branch_id is not null) or (role in ('company_admin','company_staff','company_viewer') and branch_id is null));
alter table public.company_memberships add column display_name text not null default '';
alter table public.companies add column profile jsonb not null default '{}';
create or replace function private.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','company_staff','company_viewer','branch'])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.chido_company_enabled(p_company_id) and exists(
 select 1 from public.company_memberships m where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active' and m.role=any(p_roles)
 and (m.role in ('company_admin','company_staff','company_viewer') or exists(select 1 from public.branches b join public.branch_devices d on d.branch_id=b.id where b.id=m.branch_id and b.company_id=m.company_id and b.status='active' and d.user_id=auth.uid() and d.revoked_at is null)))
$$;
create or replace function public.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','company_staff','company_viewer','branch'])
returns boolean language sql stable security invoker set search_path='' as $$ select private.chido_has_company_role(p_company_id,p_roles) $$;
create or replace function private.chido_portal_role(p_company_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select m.role from public.company_memberships m where auth.uid() is not null and m.user_id=auth.uid() and m.company_id=p_company_id and m.status='active' and m.role in ('company_admin','company_staff','company_viewer') limit 1
$$;
revoke all on function private.chido_portal_role(uuid) from public,anon;
grant execute on function private.chido_portal_role(uuid) to authenticated,service_role;

create table public.company_media(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,filename text not null,object_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),bytes bigint not null check(bytes between 1 and 8388608),caption text not null default '',archived_at timestamptz,created_at timestamptz not null default now()
);
create table public.company_requests(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,created_by uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('model','layout','colorway','general')),title text not null,description text not null,
 product_name text not null default '',dimensions_cm jsonb,media_ids uuid[] not null default '{}',set_id uuid references public.sets(id) on delete set null,
 priority text not null default 'normal' check(priority in ('normal','high')),status text not null default 'submitted' check(status in ('submitted','reviewing','in_progress','needs_info','completed','cancelled')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.support_tickets(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,created_by uuid references auth.users(id) on delete set null,
 title text not null,category text not null check(category in ('technical','account','billing','models','other')),priority text not null default 'normal' check(priority in ('normal','high')),
 status text not null default 'open' check(status in ('open','in_progress','waiting_customer','resolved','closed')),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.company_messages(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 request_id uuid references public.company_requests(id) on delete cascade,ticket_id uuid references public.support_tickets(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null,sender text not null check(sender in ('company','central')),body text not null,media_ids uuid[] not null default '{}',created_at timestamptz not null default now(),check((request_id is null)<>(ticket_id is null))
);
create table public.company_user_invites(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,created_by uuid references auth.users(id) on delete set null,
 display_name text not null,email text not null,role text not null check(role in ('company_admin','company_staff','company_viewer')),code_hash text not null unique,
 expires_at timestamptz not null,redeemed_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now()
);
create table public.company_notifications(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,title text not null,section text not null,entity_id uuid,created_at timestamptz not null default now()
);
create table public.company_notification_reads(notification_id uuid not null references public.company_notifications(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(notification_id,user_id));
do $$ declare t text;begin foreach t in array array['company_media','company_requests','support_tickets','company_messages','company_user_invites','company_notifications'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy company_portal_read on public.%I for select to authenticated using (private.chido_portal_role(company_id) is not null or public.chido_is_platform_admin())',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 if t<>'company_user_invites' then execute format('grant select on public.%I to authenticated',t);end if;
end loop;end $$;
alter table public.company_notification_reads enable row level security;
create policy notification_reads_self on public.company_notification_reads for select to authenticated using(user_id=auth.uid());
grant select on public.company_notification_reads to authenticated;
grant select,insert,delete on public.company_notification_reads to service_role;
create index company_requests_company_updated on public.company_requests(company_id,updated_at desc);
create index support_tickets_company_updated on public.support_tickets(company_id,updated_at desc);
create index company_messages_request on public.company_messages(request_id,created_at);
create index company_messages_ticket on public.company_messages(ticket_id,created_at);
create index company_media_company on public.company_media(company_id,created_at desc);
create index company_invites_company on public.company_user_invites(company_id,created_at desc);

create or replace function public.chido_company_write(p_actor uuid,p_company uuid,p_action text,p_data jsonb,p_central boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_role text;v_id uuid;v_parent uuid;v_ids uuid[];v_count int;v_kind text;v_status text;v_user uuid;
begin
 if p_central then
  if not exists(select 1 from public.platform_roles where user_id=p_actor and role='platform_admin') then raise exception 'Access denied' using errcode='42501';end if;v_role='central';
 else
  select role into v_role from public.company_memberships where user_id=p_actor and company_id=p_company and status='active' and role in ('company_admin','company_staff','company_viewer');
  if v_role is null then raise exception 'Company access denied' using errcode='42501';end if;
 end if;
 v_id=nullif(p_data->>'id','')::uuid;
 v_ids=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_data->'media_ids','[]'))),'{}'::uuid[]);
 select count(*) into v_count from public.company_media where id=any(v_ids) and company_id=p_company and archived_at is null;
 if v_count<>cardinality(v_ids) then raise exception 'Attachment not allowed' using errcode='42501';end if;
 if v_role='company_viewer' and p_action<>'notification.read' then raise exception 'Read-only account' using errcode='42501';end if;
 if p_action in ('branch.save','code.issue','code.revoke','invite.issue','invite.revoke','member.update','device.revoke','profile.save','layout.archive','colorway.archive') and v_role<>'company_admin' then raise exception 'Company manager required' using errcode='42501';end if;
 case p_action
 when 'media.register' then
  if p_data->>'object_path' not like p_company::text||'/'||p_actor::text||'/%' then raise exception 'Invalid upload owner' using errcode='42501';end if;
  insert into public.company_media(company_id,created_by,filename,object_path,mime_type,bytes,caption) values(p_company,p_actor,p_data->>'filename',p_data->>'object_path',p_data->>'mime_type',(p_data->>'bytes')::bigint,coalesce(p_data->>'caption','')) returning id into v_id;
 when 'media.archive' then
  update public.company_media set archived_at=now() where id=v_id and company_id=p_company and (v_role='company_admin' or created_by=p_actor);
  if not found then raise exception 'Media not found';end if;
 when 'request.create' then
  v_parent=nullif(p_data->>'set_id','')::uuid;
  if v_parent is not null and not exists(select 1 from public.sets where id=v_parent and company_id=p_company) then raise exception 'Set not allowed' using errcode='42501';end if;
  insert into public.company_requests(company_id,created_by,kind,title,description,product_name,dimensions_cm,media_ids,set_id,priority)
  values(p_company,p_actor,p_data->>'kind',p_data->>'title',p_data->>'description',coalesce(p_data->>'product_name',''),p_data->'dimensions_cm',v_ids,v_parent,p_data->>'priority') returning id into v_id;
  insert into public.company_messages(company_id,request_id,author_id,sender,body,media_ids) values(p_company,v_id,p_actor,'company',p_data->>'description',v_ids);
 when 'ticket.create' then
  insert into public.support_tickets(company_id,created_by,title,category,priority) values(p_company,p_actor,p_data->>'title',p_data->>'category',p_data->>'priority') returning id into v_id;
  insert into public.company_messages(company_id,ticket_id,author_id,sender,body,media_ids) values(p_company,v_id,p_actor,'company',p_data->>'body',v_ids);
 when 'message.send' then
  v_parent=(p_data->>'parent_id')::uuid;v_kind=p_data->>'parent_kind';
  if v_kind='request' then
   update public.company_requests set updated_at=now() where id=v_parent and company_id=p_company;
  else
   update public.support_tickets set updated_at=now(),status=case when v_role='central' then 'waiting_customer' else 'open' end where id=v_parent and company_id=p_company;
  end if;
  if not found then raise exception 'Conversation not found' using errcode='42501';end if;
  insert into public.company_messages(company_id,request_id,ticket_id,author_id,sender,body,media_ids)
   values(p_company,case when v_kind='request' then v_parent end,case when v_kind='ticket' then v_parent end,p_actor,case when v_role='central' then 'central' else 'company' end,p_data->>'body',v_ids) returning id into v_id;
  if v_role='central' then insert into public.company_notifications(company_id,title,section,entity_id) values(p_company,'پاسخ تازه از چیدو',case when v_kind='request' then 'requests' else 'support' end,v_parent);end if;
 when 'request.status' then
  if v_role<>'central' then
   if p_data->>'status'<>'cancelled' then raise exception 'Only cancellation allowed' using errcode='42501';end if;
   update public.company_requests set status='cancelled',updated_at=now() where id=v_id and company_id=p_company and status in ('submitted','reviewing','needs_info') and (created_by=p_actor or v_role='company_admin');
  else update public.company_requests set status=p_data->>'status',updated_at=now() where id=v_id and company_id=p_company;end if;
  if not found then raise exception 'Request cannot be changed';end if;
  if v_role='central' then insert into public.company_notifications(company_id,title,section,entity_id) values(p_company,'وضعیت درخواست به‌روز شد','requests',v_id);end if;
 when 'ticket.status' then
  if v_role<>'central' and p_data->>'status' not in ('closed','open') then raise exception 'Invalid ticket state' using errcode='42501';end if;
  update public.support_tickets set status=p_data->>'status',updated_at=now() where id=v_id and company_id=p_company;
  if not found then raise exception 'Ticket not found';end if;
  if v_role='central' then insert into public.company_notifications(company_id,title,section,entity_id) values(p_company,'وضعیت تیکت به‌روز شد','support',v_id);end if;
 when 'branch.save' then
  if not private.chido_company_enabled(p_company) then raise exception 'Subscription inactive';end if;
  if v_id is null then insert into public.branches(company_id,name,slug,status) values(p_company,p_data->>'name',p_data->>'slug',p_data->>'status') returning id into v_id;
  else update public.branches set name=p_data->>'name',slug=p_data->>'slug',status=p_data->>'status' where id=v_id and company_id=p_company;if not found then raise exception 'Branch not found';end if;end if;
 when 'code.issue' then
  if not private.chido_company_enabled(p_company) then raise exception 'Subscription inactive';end if;
  if not exists(select 1 from public.branches where id=(p_data->>'branch_id')::uuid and company_id=p_company and status='active') then raise exception 'Branch not active';end if;
  insert into public.activation_codes(company_id,branch_id,role,code_hash,expires_at) values(p_company,(p_data->>'branch_id')::uuid,'branch',p_data->>'code_hash',(p_data->>'expires_at')::timestamptz) returning id into v_id;
 when 'code.revoke' then
  update public.activation_codes set revoked_at=now() where id=v_id and company_id=p_company and role='branch' and redeemed_at is null;if not found then raise exception 'Code not available';end if;
 when 'invite.issue' then
  perform 1 from public.companies where id=p_company for update;
  if not private.chido_company_enabled(p_company) then raise exception 'Subscription inactive';end if;
  if exists(select 1 from public.company_memberships m join auth.users u on u.id=m.user_id where m.company_id=p_company and lower(u.email)=p_data->>'email') then raise exception 'User is already a member';end if;
  update public.company_user_invites set revoked_at=now() where company_id=p_company and email=p_data->>'email' and redeemed_at is null and revoked_at is null;
  insert into public.company_user_invites(company_id,created_by,display_name,email,role,code_hash,expires_at) values(p_company,p_actor,p_data->>'display_name',p_data->>'email',p_data->>'role',p_data->>'code_hash',(p_data->>'expires_at')::timestamptz) returning id into v_id;
 when 'invite.revoke' then update public.company_user_invites set revoked_at=now() where id=v_id and company_id=p_company and redeemed_at is null;if not found then raise exception 'Invitation not available';end if;
 when 'member.update' then
  perform 1 from public.companies where id=p_company for update;
  select user_id into v_user from public.company_memberships where id=v_id and company_id=p_company and role<>'branch';
  if not found or v_user=p_actor then raise exception 'Cannot change own access';end if;
  if exists(select 1 from public.company_memberships where id=v_id and role='company_admin' and status='active') and (p_data->>'role'<>'company_admin' or p_data->>'status'<>'active') and (select count(*) from public.company_memberships where company_id=p_company and role='company_admin' and status='active')<=1 then raise exception 'Last manager must remain active';end if;
  update public.company_memberships set display_name=p_data->>'display_name',role=p_data->>'role',status=p_data->>'status' where id=v_id and company_id=p_company;
 when 'device.revoke' then
  update public.branch_devices d set revoked_at=now() where d.id=v_id and exists(select 1 from public.branches b where b.id=d.branch_id and b.company_id=p_company) returning d.user_id into v_user;
  if not found then raise exception 'Device not found';end if;
  update public.company_memberships set status='suspended' where company_id=p_company and user_id=v_user;
 when 'profile.save' then update public.companies set name=p_data->>'name',profile=p_data->'profile' where id=p_company;v_id=p_company;
 when 'notification.read' then
  if not exists(select 1 from public.company_notifications where id=v_id and company_id=p_company) then raise exception 'Notification not found';end if;
  insert into public.company_notification_reads(notification_id,user_id) values(v_id,p_actor) on conflict do nothing;
 when 'layout.archive' then update public.layouts l set status='archived',updated_at=now() where l.id=v_id and exists(select 1 from public.sets s where s.id=l.set_id and s.company_id=p_company);if not found then raise exception 'Layout not found';end if;
 when 'colorway.archive' then update public.colorways l set status='archived',updated_at=now() where l.id=v_id and exists(select 1 from public.sets s where s.id=l.set_id and s.company_id=p_company);if not found then raise exception 'Colorway not found';end if;
 else raise exception 'Unknown company action';end case;
 insert into public.activity_events(company_id,user_id,event_type,payload) values(p_company,p_actor,'workspace.'||p_action,jsonb_build_object('id',v_id));
 if v_role='central' then insert into public.platform_audit_events(actor_id,action,entity_id,company_id,details) values(p_actor,'workspace.'||p_action,v_id,p_company,p_data-'body');end if;
 return jsonb_build_object('id',v_id);
end $$;
revoke all on function public.chido_company_write(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.chido_company_write(uuid,uuid,text,jsonb,boolean) to service_role;

create or replace function public.chido_accept_company_invite(p_hash text,p_user uuid,p_email text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_invite public.company_user_invites;begin
 select * into v_invite from public.company_user_invites where code_hash=p_hash and email=lower(p_email) and redeemed_at is null and revoked_at is null and expires_at>now() for update;
 if not found or not private.chido_company_enabled(v_invite.company_id) then raise exception 'Invitation unavailable';end if;
 if not exists(select 1 from public.company_memberships where company_id=v_invite.company_id and user_id=v_invite.created_by and status='active' and role='company_admin') then raise exception 'Inviter no longer authorized';end if;
 if exists(select 1 from public.company_memberships where user_id=p_user and status='active') then raise exception 'Account already belongs to a company';end if;
 insert into public.company_memberships(company_id,user_id,role,status,display_name) values(v_invite.company_id,p_user,v_invite.role,'active',v_invite.display_name);
 update public.company_user_invites set redeemed_at=now() where id=v_invite.id;
 insert into public.activity_events(company_id,user_id,event_type,payload) values(v_invite.company_id,p_user,'workspace.invite.accepted','{}');
 return v_invite.company_id;
end $$;
revoke all on function public.chido_accept_company_invite(text,uuid,text) from public,anon,authenticated;
grant execute on function public.chido_accept_company_invite(text,uuid,text) to service_role;

create or replace function private.chido_portal_role_text(p_company text)
returns text language sql stable security invoker set search_path='' as $$ select case when p_company ~ '^[0-9a-fA-F-]{36}$' then private.chido_portal_role(p_company::uuid) else null end $$;
revoke all on function private.chido_portal_role_text(text) from public,anon;
grant execute on function private.chido_portal_role_text(text) to authenticated,service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('company-media','company-media',false,8388608,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy company_media_upload on storage.objects for insert to authenticated with check(bucket_id='company-media' and private.chido_portal_role_text((storage.foldername(name))[1]) in ('company_admin','company_staff') and (storage.foldername(name))[2]=auth.uid()::text);
create policy company_media_read on storage.objects for select to authenticated using(bucket_id='company-media' and (public.chido_is_platform_admin() or exists(select 1 from public.company_media m where m.object_path=storage.objects.name and private.chido_portal_role(m.company_id) is not null) or ((storage.foldername(name))[2]=auth.uid()::text and private.chido_portal_role_text((storage.foldername(name))[1]) is not null)));
create policy company_media_remove_pending on storage.objects for delete to authenticated using(bucket_id='company-media' and (public.chido_is_platform_admin() or ((storage.foldername(name))[2]=auth.uid()::text and not exists(select 1 from public.company_media m where m.object_path=storage.objects.name))));
