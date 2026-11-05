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

create or replace function public.chido_company_write(p_actor uuid,p_company uuid,p_action text,p_data jsonb,p_central boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_role text;v_id uuid;v_parent uuid;v_ids uuid[];v_count int;v_kind text;v_status text;v_user uuid;
begin
 if p_central then
  if not exists(select 1 from public.platform_roles where user_id=p_actor and role='platform_admin') then raise exception 'Access denied' using errcode='42501';end if;v_role='central';
 else
  select role into v_role from public.company_memberships where user_id=p_actor and company_id=p_company and status='active' and role='company_admin';
  if v_role is null then raise exception 'Company access denied' using errcode='42501';end if;
 end if;
 v_id=nullif(p_data->>'id','')::uuid;
 v_ids=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_data->'media_ids','[]'))),'{}'::uuid[]);
 select count(*) into v_count from public.company_media where id=any(v_ids) and company_id=p_company and archived_at is null;
 if v_count<>cardinality(v_ids) then raise exception 'Attachment not allowed' using errcode='42501';end if;
 if v_role='company_viewer' and p_action<>'notification.read' then raise exception 'Read-only account' using errcode='42501';end if;
 if p_action in ('showroom.register','showroom.update','branch.save','code.issue','code.revoke','invite.issue','invite.revoke','member.update','device.revoke','profile.save','layout.archive','colorway.archive') and v_role<>'company_admin' then raise exception 'Company manager required' using errcode='42501';end if;
 case p_action
 when 'showroom.register' then
  if not private.chido_company_enabled(p_company) or not exists(select 1 from public.branches where id=(p_data->>'branch_id')::uuid and company_id=p_company and status='active') then raise exception 'Branch not active';end if;
  v_user=(p_data->>'user_id')::uuid;
  insert into public.company_memberships(company_id,user_id,branch_id,role,status,display_name) values(p_company,v_user,(p_data->>'branch_id')::uuid,'branch',p_data->>'status',p_data->>'display_name');
  insert into public.branch_devices(branch_id,user_id,device_label,revoked_at) values((p_data->>'branch_id')::uuid,v_user,p_data->>'display_name',case when p_data->>'status'='suspended' then now() end);
  insert into public.showroom_accounts(company_id,branch_id,user_id,login_name,display_name,status) values(p_company,(p_data->>'branch_id')::uuid,v_user,p_data->>'login_name',p_data->>'display_name',p_data->>'status') returning id into v_id;
 when 'showroom.update' then
  if not exists(select 1 from public.branches where id=(p_data->>'branch_id')::uuid and company_id=p_company) then raise exception 'Branch not found';end if;
  update public.showroom_accounts set branch_id=(p_data->>'branch_id')::uuid,login_name=p_data->>'login_name',display_name=p_data->>'display_name',status=p_data->>'status' where id=v_id and company_id=p_company returning user_id into v_user;
  if not found then raise exception 'Showroom account not found';end if;
  update public.company_memberships set branch_id=(p_data->>'branch_id')::uuid,display_name=p_data->>'display_name',status=p_data->>'status' where user_id=v_user and company_id=p_company;
  update public.branch_devices set branch_id=(p_data->>'branch_id')::uuid,device_label=p_data->>'display_name',revoked_at=case when p_data->>'status'='suspended' then now() else null end where user_id=v_user;
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
 when 'device.revoke' then
  update public.branch_devices d set revoked_at=now() where d.id=v_id and exists(select 1 from public.branches b where b.id=d.branch_id and b.company_id=p_company) returning d.user_id into v_user;
  if not found then raise exception 'Device not found';end if;
  update public.company_memberships set status='suspended' where company_id=p_company and user_id=v_user; update public.showroom_accounts set status='suspended' where company_id=p_company and user_id=v_user;
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

