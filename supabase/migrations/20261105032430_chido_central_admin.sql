-- Additive central administration. Existing company and AR data are preserved.
alter table public.activation_codes add column if not exists revoked_at timestamptz;
create table public.platform_admin_invites (
 id uuid primary key default gen_random_uuid(),code_hash text not null unique,
 expires_at timestamptz not null,redeemed_at timestamptz,created_at timestamptz not null default now()
);
alter table public.platform_admin_invites enable row level security;
revoke all on public.platform_admin_invites from public,anon,authenticated;
grant select,insert,update on public.platform_admin_invites to service_role;
create table public.platform_audit_events (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null,entity_id uuid,company_id uuid references public.companies(id) on delete set null,
 details jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.platform_audit_events enable row level security;
create policy platform_audit_read_admin on public.platform_audit_events for select to authenticated using(public.chido_is_platform_admin());
grant select on public.platform_audit_events to authenticated;
grant select,insert on public.platform_audit_events to service_role;
grant usage,select on sequence public.platform_audit_events_id_seq to service_role;

create or replace function public.chido_admin_write(p_actor uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_company uuid;v_branch uuid;v_result jsonb;v_index integer;v_count integer;
begin
 if not exists(select 1 from public.platform_roles where user_id=p_actor and role='platform_admin') then raise exception 'Platform administrator required' using errcode='42501';end if;
 v_id=nullif(p_data->>'id','')::uuid;
 case p_action
 when 'company.save' then
  if v_id is null then
   insert into public.companies(name,slug,status,max_layouts_per_set,max_colorways_per_set)
   values(p_data->>'name',p_data->>'slug',p_data->>'status',(p_data->>'max_layouts_per_set')::int,(p_data->>'max_colorways_per_set')::int) returning id into v_id;
  else
   update public.companies set name=p_data->>'name',slug=p_data->>'slug',status=p_data->>'status',max_layouts_per_set=(p_data->>'max_layouts_per_set')::int,max_colorways_per_set=(p_data->>'max_colorways_per_set')::int where id=v_id;
   if not found then raise exception 'Company not found';end if;
  end if;v_company=v_id;
 when 'branch.save' then
  v_company=(p_data->>'company_id')::uuid;
  if v_id is null then
   insert into public.branches(company_id,name,slug,status) values(v_company,p_data->>'name',p_data->>'slug',p_data->>'status') returning id into v_id;
  else
   update public.branches set name=p_data->>'name',slug=p_data->>'slug',status=p_data->>'status' where id=v_id and company_id=v_company;
   if not found then raise exception 'Branch not found';end if;
  end if;
 when 'code.issue' then
  v_company=(p_data->>'company_id')::uuid;v_branch=nullif(p_data->>'branch_id','')::uuid;
  if not exists(select 1 from public.companies where id=v_company and status='active') then raise exception 'Company is not active';end if;
  if p_data->>'role'='branch' and not exists(select 1 from public.branches where id=v_branch and company_id=v_company and status='active') then raise exception 'Branch is not active';end if;
  insert into public.activation_codes(company_id,branch_id,role,code_hash,expires_at)
   values(v_company,v_branch,p_data->>'role',p_data->>'code_hash',(p_data->>'expires_at')::timestamptz) returning id into v_id;
 when 'code.revoke' then
  update public.activation_codes set revoked_at=now() where id=v_id and redeemed_at is null returning company_id into v_company;
  if not found then raise exception 'Code is already used or unavailable';end if;
 when 'subscription.save' then
  v_company=(p_data->>'company_id')::uuid;
  if v_id is null then
   insert into public.subscriptions(company_id,plan_code,status,starts_at,ends_at,billing_notes)
    values(v_company,p_data->>'plan_code',p_data->>'status',(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,p_data->>'billing_notes') returning id into v_id;
  else
   update public.subscriptions set plan_code=p_data->>'plan_code',status=p_data->>'status',starts_at=(p_data->>'starts_at')::timestamptz,ends_at=(p_data->>'ends_at')::timestamptz,billing_notes=p_data->>'billing_notes' where id=v_id and company_id=v_company;
   if not found then raise exception 'Subscription not found';end if;
  end if;
 when 'product.save' then
  if v_id is null then
   perform pg_catalog.pg_advisory_xact_lock(26261105);
   select greatest(32,coalesce(max(catalog_index)+1,32)) into v_index from public.products;
   if v_index>99 then raise exception 'Catalog capacity reached';end if;
   if nullif(p_data->>'asset_path','') is null then raise exception 'GLB file required';end if;
   insert into public.products(catalog_index,name,slug,size_m,asset_path,thumbnail_path,metadata,active)
   values(v_index,p_data->>'name',p_data->>'slug',p_data->'size_m',p_data->>'asset_path',nullif(p_data->>'thumbnail_path',''),p_data->'metadata',(p_data->>'active')::boolean) returning id into v_id;
  else
   select catalog_index into v_index from public.products where id=v_id;
   if v_index is null then raise exception 'Product not found';end if;
   if v_index<32 and exists(select 1 from public.products where id=v_id and (size_m<>p_data->'size_m' or coalesce(asset_path,'')<>coalesce(p_data->>'asset_path',''))) then raise exception 'Built-in geometry and dimensions cannot be replaced';end if;
   update public.products set name=p_data->>'name',slug=p_data->>'slug',size_m=p_data->'size_m',asset_path=nullif(p_data->>'asset_path',''),thumbnail_path=nullif(p_data->>'thumbnail_path',''),metadata=p_data->'metadata',active=(p_data->>'active')::boolean where id=v_id;
  end if;
 when 'set.save' then
  v_company=(p_data->>'company_id')::uuid;
  if v_id is null then
   insert into public.sets(company_id,name,description,status) values(v_company,p_data->>'name',p_data->>'description',p_data->>'status') returning id into v_id;
  else
   perform 1 from public.sets where id=v_id and company_id=v_company for update;
   if not found then raise exception 'Set not found';end if;
   update public.sets set name=p_data->>'name',description=p_data->>'description',status=p_data->>'status' where id=v_id;
  end if;
  select count(distinct p.id) into v_count from public.products p where p.id in(select value::uuid from jsonb_array_elements_text(p_data->'product_ids'));
  if v_count<>jsonb_array_length(p_data->'product_ids') then raise exception 'Product list is invalid';end if;
  if p_data->>'status'='published' and (v_count=0 or exists(select 1 from public.products p where not p.active and p.id in(select value::uuid from jsonb_array_elements_text(p_data->'product_ids')))) then raise exception 'Published sets need active products';end if;
  delete from public.set_products where set_id=v_id;
  insert into public.set_products(set_id,product_id,sort_order) select v_id,value::uuid,(ordinality-1)::int from jsonb_array_elements_text(p_data->'product_ids') with ordinality;
 when 'device.revoke' then
  update public.branch_devices set revoked_at=now() where id=v_id returning branch_id into v_branch;
  if not found then raise exception 'Device not found';end if;
  select company_id into v_company from public.branches where id=v_branch;
  update public.company_memberships set status='suspended' where branch_id=v_branch and user_id=(select user_id from public.branch_devices where id=v_id);
  update public.live_sessions set revoked_at=now() where host_user_id=(select user_id from public.branch_devices where id=v_id) and revoked_at is null;
 when 'member.status' then
  update public.company_memberships set status=p_data->>'status' where id=v_id returning company_id into v_company;
  if not found then raise exception 'Member not found';end if;
 when 'access.status' then
  update public.company_access_requests set status=p_data->>'status' where id=v_id;
  if not found then raise exception 'Request not found';end if;
 when 'layout-request.status' then
  update public.layout_requests set status=p_data->>'status',updated_at=now() where id=v_id returning company_id into v_company;
  if not found then raise exception 'Request not found';end if;
 when 'session.revoke' then
  update public.live_sessions set revoked_at=now() where id=v_id returning company_id into v_company;
  if not found then raise exception 'Session not found';end if;
 else raise exception 'Unknown action';
 end case;
 insert into public.platform_audit_events(actor_id,action,entity_id,company_id,details)
 values(p_actor,p_action,v_id,v_company,p_data-'code_hash');
 return jsonb_build_object('id',v_id,'company_id',v_company);
end $$;
revoke all on function public.chido_admin_write(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.chido_admin_write(uuid,text,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chido-assets','chido-assets',false,33554432,array['model/gltf-binary','application/octet-stream','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy chido_asset_admin_insert on storage.objects for insert to authenticated with check(bucket_id='chido-assets' and public.chido_is_platform_admin());
create policy chido_asset_admin_delete on storage.objects for delete to authenticated using(bucket_id='chido-assets' and public.chido_is_platform_admin());
create policy chido_asset_read_member on storage.objects for select to authenticated using(bucket_id='chido-assets' and (public.chido_is_platform_admin() or exists(
 select 1 from public.products p join public.set_products sp on sp.product_id=p.id join public.sets s on s.id=sp.set_id
 where p.active and s.status='published' and public.chido_has_company_role(s.company_id)
 and (p.asset_path='storage://chido-assets/'||storage.objects.name or p.thumbnail_path='storage://chido-assets/'||storage.objects.name)
)));
