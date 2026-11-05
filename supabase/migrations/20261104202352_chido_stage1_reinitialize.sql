-- ONE-TIME BASELINE: this migration repurposed the empty Menosaz test project for Chido.
-- Do not manually re-run this reset after customer data has been created.
-- Supabase-managed schemas, extensions and migration history are intentionally retained.

do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prokind
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p')
      and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  loop
    if r.prokind='p' then execute format('drop procedure if exists public.%I(%s) cascade',r.proname,r.args);
    else execute format('drop function if exists public.%I(%s) cascade',r.proname,r.args); end if;
  end loop;

  for r in
    select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','f')
      and not exists (select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
  loop
    if r.relkind='v' then execute format('drop view if exists public.%I cascade',r.relname);
    elsif r.relkind='m' then execute format('drop materialized view if exists public.%I cascade',r.relname);
    elsif r.relkind='f' then execute format('drop foreign table if exists public.%I cascade',r.relname);
    else execute format('drop table if exists public.%I cascade',r.relname); end if;
  end loop;

  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='S'
      and not exists (select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
  loop execute format('drop sequence if exists public.%I cascade',r.relname); end loop;

  for r in
    select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typtype in ('e','d')
      and not exists (select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e')
  loop execute format('drop type if exists public.%I cascade',r.typname); end loop;
end $$;

delete from auth.users;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create table public.companies (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 status text not null default 'pending' check(status in ('pending','active','suspended')),
 max_layouts_per_set integer not null default 3 check(max_layouts_per_set between 1 and 50),
 max_colorways_per_set integer not null default 5 check(max_colorways_per_set between 1 and 50),
 created_at timestamptz not null default now()
);
create table public.branches (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 name text not null, slug text not null, status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now(), unique(company_id,slug)
);
create table public.company_memberships (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, branch_id uuid references public.branches(id) on delete set null,
 role text not null check(role in ('company_admin','branch')),
 status text not null default 'active' check(status in ('active','pending','suspended')),
 created_at timestamptz not null default now(), unique(company_id,user_id)
);
create table public.branch_devices (
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, device_label text not null default 'Showroom tablet',
 activated_at timestamptz not null default now(), last_seen_at timestamptz, revoked_at timestamptz,
 unique(branch_id,user_id)
);
create table public.activation_codes (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete cascade, role text not null check(role in ('company_admin','branch')),
 code_hash text not null unique, expires_at timestamptz not null, redeemed_at timestamptz,
 redeemed_user_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 check((role='branch' and branch_id is not null) or (role='company_admin' and branch_id is null))
);
create table public.products (
 id uuid primary key default gen_random_uuid(), catalog_index smallint not null unique check(catalog_index between 0 and 99),
 name text not null, slug text not null unique, size_m jsonb not null default '[]'::jsonb,
 asset_path text, thumbnail_path text, metadata jsonb not null default '{}'::jsonb,
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.sets (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 name text not null, description text not null default '', status text not null default 'published' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(), unique(company_id,name)
);
create table public.set_products (
 set_id uuid not null references public.sets(id) on delete cascade, product_id uuid not null references public.products(id) on delete restrict,
 sort_order integer not null default 0, created_at timestamptz not null default now(), primary key(set_id,product_id)
);
create table public.layouts (
 id uuid primary key default gen_random_uuid(), set_id uuid not null references public.sets(id) on delete cascade,
 name text not null, room text not null default 'پذیرایی', template_kind text not null default 'empty',
 capacity integer not null default 5, scene_state jsonb, status text not null default 'published' check(status in ('draft','published','archived')),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.colorways (
 id uuid primary key default gen_random_uuid(), set_id uuid not null references public.sets(id) on delete cascade,
 name text not null, material_map jsonb not null default '{}'::jsonb,
 status text not null default 'published' check(status in ('draft','published','archived')),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.layout_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete set null, set_id uuid references public.sets(id) on delete set null,
 requested_by uuid not null references auth.users(id) on delete cascade, description text not null,
 status text not null default 'pending' check(status in ('pending','approved','declined','completed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 plan_code text not null default 'pilot', status text not null default 'trial' check(status in ('trial','active','past_due','expired','cancelled')),
 starts_at timestamptz not null default now(), ends_at timestamptz,
 billing_notes text not null default '', created_at timestamptz not null default now()
);
create table public.activity_events (
 id bigint generated always as identity primary key, company_id uuid references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete set null, user_id uuid references auth.users(id) on delete set null,
 event_type text not null, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.live_sessions (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid not null references public.branches(id) on delete cascade, host_user_id uuid not null references auth.users(id) on delete cascade,
 guest_token_hash text not null unique, expires_at timestamptz not null default(now()+interval '45 minutes'),
 revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.live_session_scenes (
 session_id uuid primary key references public.live_sessions(id) on delete cascade,
 scene_state jsonb not null, updated_at timestamptz not null default now()
);
create table public.live_session_cameras (
 session_id uuid primary key references public.live_sessions(id) on delete cascade,
 camera_state jsonb not null, updated_at timestamptz not null default now()
);
create table public.live_session_guests (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.live_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
 unique(session_id,user_id)
);
create table public.company_access_requests (
 id uuid primary key default gen_random_uuid(), contact_name text not null, company_name text not null,
 email text not null, phone text not null default '', message text not null default '',
 status text not null default 'pending' check(status in ('pending','contacted','approved','declined')),
 created_at timestamptz not null default now()
);
create table public.platform_roles (
 user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('platform_admin')),
 created_at timestamptz not null default now()
);

create index company_memberships_user_idx on public.company_memberships(user_id,status);
create index branches_company_idx on public.branches(company_id,status);
create index sets_company_idx on public.sets(company_id,status);
create index layouts_set_idx on public.layouts(set_id,status);
create index colorways_set_idx on public.colorways(set_id,status);
create index activity_events_company_time_idx on public.activity_events(company_id,created_at desc);
create index live_sessions_host_idx on public.live_sessions(host_user_id,created_at desc);
create index live_sessions_expiry_idx on public.live_sessions(expires_at) where revoked_at is null;

create or replace function public.chido_is_platform_admin()
returns boolean language sql stable security invoker set search_path=public,auth
as $$ select exists(select 1 from public.platform_roles r where r.user_id=auth.uid() and r.role='platform_admin') $$;
create or replace function public.chido_has_company_role(p_company_id uuid,p_roles text[] default array['company_admin','branch'])
returns boolean language sql stable security invoker set search_path=public,auth
as $$ select exists(select 1 from public.company_memberships m where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active' and m.role=any(p_roles)) $$;
create or replace function public.chido_is_company_admin(p_company_id uuid)
returns boolean language sql stable security invoker set search_path=public,auth
as $$ select public.chido_has_company_role(p_company_id,array['company_admin']) $$;
create or replace function private.chido_guest_session_active(p_session_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
 and (auth.jwt()->'app_metadata'->>'role')='guest'
 and (auth.jwt()->'app_metadata'->>'live_session_id')=p_session_id::text
 and exists(select 1 from public.live_sessions s where s.id=p_session_id and s.revoked_at is null and s.expires_at>pg_catalog.now())
$$;
revoke all on function private.chido_guest_session_active(uuid) from public,anon;
grant execute on function private.chido_guest_session_active(uuid) to authenticated;

alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.company_memberships enable row level security;
alter table public.branch_devices enable row level security;
alter table public.activation_codes enable row level security;
alter table public.products enable row level security;
alter table public.sets enable row level security;
alter table public.set_products enable row level security;
alter table public.layouts enable row level security;
alter table public.colorways enable row level security;
alter table public.layout_requests enable row level security;
alter table public.subscriptions enable row level security;
alter table public.activity_events enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_session_scenes enable row level security;
alter table public.live_session_cameras enable row level security;
alter table public.live_session_guests enable row level security;
alter table public.company_access_requests enable row level security;
alter table public.platform_roles enable row level security;

create policy platform_roles_read_self on public.platform_roles for select to authenticated using(user_id=auth.uid());
create policy companies_read_member on public.companies for select to authenticated using(public.chido_is_platform_admin() or public.chido_has_company_role(id));
create policy companies_update_admin on public.companies for update to authenticated using(public.chido_is_platform_admin() or public.chido_is_company_admin(id)) with check(public.chido_is_platform_admin() or public.chido_is_company_admin(id));
create policy branches_read_member on public.branches for select to authenticated using(public.chido_is_platform_admin() or public.chido_has_company_role(company_id));
create policy branches_manage_company_admin on public.branches for all to authenticated using(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id)) with check(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id));
create policy memberships_read_self_or_admin on public.company_memberships for select to authenticated using(user_id=auth.uid() or public.chido_is_platform_admin() or public.chido_is_company_admin(company_id));
create policy memberships_manage_company_admin on public.company_memberships for all to authenticated using(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id)) with check(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id));
create policy branch_devices_read_self_or_admin on public.branch_devices for select to authenticated using(user_id=auth.uid() or public.chido_is_platform_admin() or exists(select 1 from public.branches b where b.id=branch_id and public.chido_is_company_admin(b.company_id)));
create policy branch_devices_update_self on public.branch_devices for update to authenticated using(user_id=auth.uid() and revoked_at is null) with check(user_id=auth.uid());
create policy activation_codes_platform_only on public.activation_codes for all to authenticated using(public.chido_is_platform_admin()) with check(public.chido_is_platform_admin());
create policy products_read_active on public.products for select to authenticated using(active or public.chido_is_platform_admin());
create policy products_manage_platform on public.products for all to authenticated using(public.chido_is_platform_admin()) with check(public.chido_is_platform_admin());
create policy sets_read_company on public.sets for select to authenticated using((status='published' and public.chido_has_company_role(company_id)) or public.chido_is_platform_admin());
create policy sets_manage_platform on public.sets for all to authenticated using(public.chido_is_platform_admin()) with check(public.chido_is_platform_admin());
create policy set_products_read_company on public.set_products for select to authenticated using(exists(select 1 from public.sets s where s.id=set_id and (public.chido_has_company_role(s.company_id) or public.chido_is_platform_admin())));
create policy set_products_manage_platform on public.set_products for all to authenticated using(public.chido_is_platform_admin()) with check(public.chido_is_platform_admin());
create policy layouts_read_company on public.layouts for select to authenticated using(status='published' and exists(select 1 from public.sets s where s.id=set_id and (public.chido_has_company_role(s.company_id) or public.chido_is_platform_admin())));
create policy layouts_insert_company_admin on public.layouts for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.sets s where s.id=set_id and public.chido_is_company_admin(s.company_id)));
create policy layouts_update_company_admin on public.layouts for update to authenticated using(exists(select 1 from public.sets s where s.id=set_id and public.chido_is_company_admin(s.company_id))) with check(exists(select 1 from public.sets s where s.id=set_id and public.chido_is_company_admin(s.company_id)));
create policy layouts_delete_company_admin on public.layouts for delete to authenticated using(exists(select 1 from public.sets s where s.id=set_id and public.chido_is_company_admin(s.company_id)));
create policy colorways_read_company on public.colorways for select to authenticated using(status='published' and exists(select 1 from public.sets s where s.id=set_id and (public.chido_has_company_role(s.company_id) or public.chido_is_platform_admin())));
create policy colorways_insert_company_admin on public.colorways for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.sets s where s.id=set_id and public.chido_is_company_admin(s.company_id)));
create policy colorways_update_company_admin on public.colorways for update to authenticated using(exists(select 1 from public.sets s where s.id=set_id and public.chido_is_company_admin(s.company_id))) with check(exists(select 1 from public.sets s where s.id=set_id and public.chido_is_company_admin(s.company_id)));
create policy colorways_delete_company_admin on public.colorways for delete to authenticated using(exists(select 1 from public.sets s where s.id=set_id and public.chido_is_company_admin(s.company_id)));
create policy layout_requests_read_company_admin on public.layout_requests for select to authenticated using(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id));
create policy layout_requests_insert_member on public.layout_requests for insert to authenticated with check(requested_by=auth.uid() and public.chido_has_company_role(company_id));
create policy layout_requests_update_company_admin on public.layout_requests for update to authenticated using(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id)) with check(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id));
create policy subscriptions_read_company_admin on public.subscriptions for select to authenticated using(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id));
create policy subscriptions_manage_platform on public.subscriptions for all to authenticated using(public.chido_is_platform_admin()) with check(public.chido_is_platform_admin());
create policy activity_events_read_company_admin on public.activity_events for select to authenticated using(public.chido_is_platform_admin() or public.chido_is_company_admin(company_id));
create policy activity_events_insert_member on public.activity_events for insert to authenticated with check(user_id=auth.uid() and public.chido_has_company_role(company_id));
create policy live_sessions_read_host on public.live_sessions for select to authenticated using(host_user_id=auth.uid() or public.chido_is_platform_admin() or public.chido_is_company_admin(company_id));
create policy live_sessions_insert_member on public.live_sessions for insert to authenticated with check(host_user_id=auth.uid() and exists(select 1 from public.company_memberships m where m.company_id=public.live_sessions.company_id and m.user_id=auth.uid() and m.status='active' and (m.role='company_admin' or (m.role='branch' and m.branch_id=public.live_sessions.branch_id))));
create policy live_sessions_revoke_host on public.live_sessions for update to authenticated using(host_user_id=auth.uid() or public.chido_is_platform_admin()) with check(host_user_id=auth.uid() or public.chido_is_platform_admin());
create policy live_scenes_read_host on public.live_session_scenes for select to authenticated using(exists(select 1 from public.live_sessions s where s.id=session_id and (s.host_user_id=auth.uid() or public.chido_is_platform_admin())));
create policy live_scenes_read_guest on public.live_session_scenes for select to authenticated using(private.chido_guest_session_active(session_id));
create policy live_scenes_insert_host on public.live_session_scenes for insert to authenticated with check(exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=auth.uid() and s.revoked_at is null and s.expires_at>now()));
create policy live_scenes_update_host on public.live_session_scenes for update to authenticated using(exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=auth.uid() and s.revoked_at is null and s.expires_at>now())) with check(exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=auth.uid() and s.revoked_at is null and s.expires_at>now()));
create policy live_cameras_read_host on public.live_session_cameras for select to authenticated using(exists(select 1 from public.live_sessions s where s.id=session_id and (s.host_user_id=auth.uid() or public.chido_is_platform_admin())));
create policy live_cameras_read_guest on public.live_session_cameras for select to authenticated using(private.chido_guest_session_active(session_id));
create policy live_cameras_insert_host on public.live_session_cameras for insert to authenticated with check(exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=auth.uid() and s.revoked_at is null and s.expires_at>now()));
create policy live_cameras_update_host on public.live_session_cameras for update to authenticated using(exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=auth.uid() and s.revoked_at is null and s.expires_at>now())) with check(exists(select 1 from public.live_sessions s where s.id=session_id and s.host_user_id=auth.uid() and s.revoked_at is null and s.expires_at>now()));
create policy company_access_request_public_insert on public.company_access_requests for insert to anon,authenticated with check(length(contact_name) between 2 and 120 and length(company_name) between 2 and 160 and length(email) between 5 and 254);
create policy company_access_request_platform_read on public.company_access_requests for select to authenticated using(public.chido_is_platform_admin());

grant usage on schema public to anon,authenticated;
grant select,update on public.companies to authenticated;
grant select,insert,update,delete on public.branches to authenticated;
grant select,insert,update,delete on public.company_memberships to authenticated;
grant select,update on public.branch_devices to authenticated;
grant select on public.products,public.sets,public.set_products,public.layouts,public.colorways to authenticated;
grant insert,update,delete on public.layouts,public.colorways to authenticated;
grant select,insert,update on public.layout_requests to authenticated;
grant select on public.subscriptions to authenticated;
grant select,insert on public.activity_events to authenticated;
grant select,insert,update on public.live_sessions to authenticated;
grant select,insert,update on public.live_session_scenes,public.live_session_cameras to authenticated;
grant insert on public.company_access_requests to anon,authenticated;
grant select on public.company_access_requests to authenticated;
grant select on public.platform_roles to authenticated;
revoke all on public.activation_codes,public.live_session_guests from anon,authenticated;

alter table public.live_session_scenes replica identity full;
alter table public.live_session_cameras replica identity full;
alter publication supabase_realtime add table public.live_session_scenes;
alter publication supabase_realtime add table public.live_session_cameras;

insert into public.products(catalog_index,name,slug,size_m,asset_path,thumbnail_path) values
(0,'کاناپه','sofa-3-seat','[2.1,0.85,0.9]','', 'assets/chido/thumbs/0.jpg'),
(1,'تک‌نفره','armchair','[0.9,0.85,0.9]','', 'assets/chido/thumbs/1.jpg'),
(2,'میز','table','[1.1,0.4,0.6]','', 'assets/chido/thumbs/2.jpg'),
(3,'تک‌نفره دوم','armchair-2','[0.9,0.85,0.9]','', 'assets/chido/thumbs/3.jpg'),
(4,'گلدان سرامیکی','ceramic-vase','[0.25,0.4,0.25]','', 'assets/chido/thumbs/4.jpg'),
(5,'کوسن دکوراتیو','decorative-cushion','[0.46,0.18,0.4]','', 'assets/chido/thumbs/5.jpg'),
(6,'آباژور ایستاده','floor-lamp','[0.45,1.55,0.45]','', 'assets/chido/thumbs/6.jpg'),
(7,'فرش مینیمال','minimal-rug','[2.4,0.015,1.7]','', 'assets/chido/thumbs/7.jpg'),
(8,'تخت دو نفره','double-bed','[1.65,0.95,2.08]','', 'assets/chido/thumbs/8.jpg'),
(9,'میز کار','desk','[1.4,0.74,0.67]','', 'assets/chido/thumbs/9.jpg'),
(10,'میز ناهارخوری','dining-table','[1.7,0.75,0.86]','', 'assets/chido/thumbs/10.jpg'),
(11,'صندلی ناهارخوری','dining-chair','[0.48,0.9,0.47]','', 'assets/chido/thumbs/11.jpg'),
(12,'میز عسلی مربعی','square-side-table','[0.48,0.48,0.48]','', 'assets/chido/thumbs/12.jpg'),
(13,'میز جلو مبلی مربعی','square-coffee-table','[1.15,0.42,1.15]','', 'assets/chido/thumbs/13.jpg'),
(14,'آباژور رومیزی','table-lamp','[0.35,0.55,0.35]','', 'assets/chido/thumbs/14.jpg'),
(15,'آباژور سه‌پایه','tripod-lamp','[0.55,1.6,0.55]','', 'assets/chido/thumbs/15.jpg'),
(16,'تابلو عمودی کوچک','small-portrait-art','[0.45,0.68,0.045]','', 'assets/chido/thumbs/16.jpg'),
(17,'تابلو افقی کوچک','small-landscape-art','[0.7,0.44,0.045]','', 'assets/chido/thumbs/17.jpg'),
(18,'تابلو مربعی متوسط','medium-square-art','[0.65,0.65,0.045]','', 'assets/chido/thumbs/18.jpg'),
(19,'تابلو افقی بزرگ','large-landscape-art','[1.2,0.68,0.045]','', 'assets/chido/thumbs/19.jpg'),
(20,'تابلو عمودی بزرگ','large-portrait-art','[0.78,1.15,0.045]','', 'assets/chido/thumbs/20.jpg'),
(21,'تابلو سه‌تکه','triptych-art','[1.25,0.75,0.045]','', 'assets/chido/thumbs/21.jpg'),
(22,'مبل سه‌نفره پارچه‌ای تیره','imported-sofa-3','[1.8934,0.7744,0.893]','assets/chido/sofaA1.glb','assets/chido/thumbs/22.jpg'),
(23,'مبل دونفره پارچه‌ای تیره','imported-sofa-2','[1.6778,0.77,0.9029]','assets/chido/SofaC1.glb','assets/chido/thumbs/23.jpg'),
(24,'مبل تک‌نفره پارچه‌ای تیره','imported-sofa-1','[1.1458,0.7781,0.9081]','assets/chido/sofab1.glb','assets/chido/thumbs/24.jpg'),
(25,'میز جلو مبلی چوب و فلز','imported-coffee-table','[1.19,0.353,0.6]','assets/chido/desks2.glb','assets/chido/thumbs/25.jpg'),
(26,'میز عسلی چوب و فلز','imported-side-table','[0.49,0.351,0.489]','assets/chido/desks1.glb','assets/chido/thumbs/26.jpg'),
(27,'میز دکوری شیشه‌ای','imported-glass-table','[0.571,0.731,0.535]','assets/chido/minidesk1.glb','assets/chido/thumbs/27.jpg'),
(28,'آباژور رومیزی کریستالی','imported-crystal-lamp','[0.391,0.4,0.393]','assets/chido/lamp1.glb','assets/chido/thumbs/28.jpg'),
(29,'چراغ ایستاده فلزی','imported-metal-floor-lamp','[0.338,1.7,0.33]','assets/chido/Lamp2.glb','assets/chido/thumbs/29.jpg'),
(30,'شمعدان دکوری','imported-candle-holder','[0.428,0.54,0.19]','assets/chido/decor1.glb','assets/chido/thumbs/30.jpg'),
(31,'فرش پتینه طوسی','imported-rug','[3,0.01,2]','assets/chido/rug.glb','assets/chido/thumbs/31.jpg');

with company as (
 insert into public.companies(name,slug,status,max_layouts_per_set,max_colorways_per_set)
 values('Chido Demo','chido-demo','active',3,5) returning id
), branch as (
 insert into public.branches(company_id,name,slug,status)
 select id,'نمایشگاه آزمایشی','demo-showroom','active' from company returning id,company_id
), demo_set as (
 insert into public.sets(company_id,name,description,status)
 select company.id,'ست نمونه چیدو','مجموعه آزمایشی برای بررسی چرخه ورود، چیدمان و نمایش زنده.','published'
 from company returning id,company_id
)
insert into public.set_products(set_id,product_id,sort_order)
select demo_set.id,products.id,products.catalog_index from demo_set cross join public.products;

insert into public.layouts(set_id,name,room,template_kind,capacity,status)
select s.id,x.name,x.room,x.kind,x.capacity,'published'
from public.sets s
cross join (values('گفت‌وگومحور','پذیرایی','conversation',5),('روبه‌روی تلویزیون','پذیرایی','tv',5),('چیدمان U','پذیرایی','u',7)) as x(name,room,kind,capacity)
where s.name='ست نمونه چیدو' and s.company_id=(select id from public.companies where slug='chido-demo');

insert into public.colorways(set_id,name,material_map,status)
select s.id,x.name,x.material_map,'published'
from public.sets s
cross join (values
 ('آبی نفتی','{"22":{"color":"#244957","fabric":"dark"},"23":{"color":"#244957","fabric":"dark"},"24":{"color":"#244957","fabric":"dark"}}'::jsonb),
 ('کرم روشن','{"22":{"color":"#d2c0aa","fabric":"creme"},"23":{"color":"#d2c0aa","fabric":"creme"},"24":{"color":"#d2c0aa","fabric":"creme"}}'::jsonb),
 ('زیتونی','{"22":{"color":"#7e825c"},"23":{"color":"#7e825c"},"24":{"color":"#7e825c"}}'::jsonb)
) as x(name,material_map)
where s.name='ست نمونه چیدو' and s.company_id=(select id from public.companies where slug='chido-demo');

insert into public.subscriptions(company_id,plan_code,status,starts_at,ends_at,billing_notes)
select id,'pilot','trial',now(),now()+interval '30 days','دموی داخلی؛ تمدید و پرداخت از پنل مدیریت مرکزی انجام می‌شود.'
from public.companies where slug='chido-demo';
