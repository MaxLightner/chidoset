-- CHIDO Unified Catalog, additive migration compatible with the live legacy schema.
-- Keep old catalog_index/slug/JSONB size_m/asset_path/active and private Storage.
create extension if not exists pgcrypto;
alter table public.companies add column if not exists code text;
alter table public.companies add column if not exists english_slug text;
alter table public.companies add column if not exists contact_name text;
alter table public.companies add column if not exists contact_phone text;
alter table public.companies add column if not exists contact_email text;
alter table public.companies add column if not exists admin_email text;
alter table public.companies add column if not exists subscription_plan text not null default 'Starter';
alter table public.companies add column if not exists subscription_active boolean not null default true;
alter table public.companies add column if not exists product_seq integer not null default 0;
alter table public.companies add column if not exists archived boolean not null default false;
alter table public.companies add column if not exists updated_at timestamptz not null default now();
create unique index if not exists chido_company_codes_unique on public.companies(code) where code is not null;
alter table public.companies drop constraint if exists chido_company_code_pattern;
alter table public.companies add constraint chido_company_code_pattern check(code is null or code ~ '^[A-Z0-9]{2,8}$');
insert into public.companies(name,slug,status,code,english_slug,subscription_plan,subscription_active)
select 'کتابخانه عمومی چیدو (General)','gen-general','active','GEN','GEN-General','Internal',true
where not exists(select 1 from public.companies where code='GEN');

alter table public.products add column if not exists product_code text;
alter table public.products add column if not exists category text not null default 'seating';
alter table public.products add column if not exists set_name text;
alter table public.products add column if not exists source_channel text not null default 'studio_manual';
alter table public.products add column if not exists status text not null default 'requested';
alter table public.products add column if not exists reference_image_path text;
alter table public.products add column if not exists live_glb_path text;
alter table public.products add column if not exists live_thumb_path text;
alter table public.products add column if not exists glb_hash text;
alter table public.products add column if not exists has_gold_accent boolean not null default false;
alter table public.products add column if not exists has_carved_normal boolean not null default false;
alter table public.products add column if not exists notes text not null default '';
alter table public.products add column if not exists updated_at timestamptz not null default now();
create unique index if not exists chido_products_code_unique on public.products(product_code) where product_code is not null;
create index if not exists chido_products_company_status on public.products(company_id,status);
-- Backfill identifiers only, preserving NULL company ownership and GitHub file paths.
update public.products set product_code='GEN-'||lpad(catalog_index::text,4,'0'),
 category=coalesce(metadata->>'category','seating'),
 status=case when active then 'live' else 'archived' end
where product_code is null and company_id is null;
update public.companies set product_seq=greatest(product_seq,coalesce((
 select max((substring(p.product_code from 5))::integer) from public.products p
 where p.product_code ~ '^GEN-[0-9]{4,}$'),0)) where code='GEN';
create sequence if not exists public.chido_catalog_index_seq start with 2000;
select setval('public.chido_catalog_index_seq',
 greatest(1999,coalesce((select max(catalog_index) from public.products),0)),true);
create or replace function public.chido_assign_unified_product()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_company_code text; v_seq integer; v_gen_id uuid;
begin
 if new.company_id is null then
   select id into v_gen_id from public.companies where code='GEN';
   if v_gen_id is null then raise exception 'GEN company missing'; end if;
   new.company_id:=v_gen_id;
 end if;
 if new.product_code is null or btrim(new.product_code)='' then
   update public.companies set product_seq=product_seq+1,updated_at=now()
    where id=new.company_id and code is not null returning code,product_seq into v_company_code,v_seq;
   if v_company_code is null then raise exception 'Company has no CHIDO code'; end if;
   new.product_code:=v_company_code||'-'||lpad(v_seq::text,4,'0');
 end if;
 if new.catalog_index is null then new.catalog_index:=nextval('public.chido_catalog_index_seq'); end if;
 if new.slug is null or btrim(new.slug)='' then new.slug:=lower(new.product_code); end if;
 new.updated_at:=now();
 return new;
end;$$;
drop trigger if exists chido_assign_unified_product on public.products;
create trigger chido_assign_unified_product before insert on public.products
for each row execute function public.chido_assign_unified_product();
revoke all on function public.chido_assign_unified_product() from public,anon,authenticated;

create or replace function public.chido_status_sync_active()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.active:=new.status='live'; new.updated_at:=now(); return new; end;$$;
drop trigger if exists chido_status_sync_active on public.products;
create trigger chido_status_sync_active before update of status on public.products
for each row when (old.status is distinct from new.status)
execute function public.chido_status_sync_active();

create table if not exists public.asset_sync_manifest(
 storage_path text primary key,entity_type text not null check(entity_type in('model','thumbnail','material_map','material_swatch')),
 entity_code text not null,company_code text not null default 'GEN',
 file_hash text not null,file_mtime timestamptz not null,size_bytes bigint not null default 0,
 synced_at timestamptz not null default now());
create index if not exists idx_sync_manifest_entity on public.asset_sync_manifest(entity_type,entity_code);
create table if not exists public.material_families(
 id uuid primary key default gen_random_uuid(),code text not null unique,name text not null,
 kind text not null check(kind in('fabric','wood','metal','glass','gold')),
 scope text not null default 'shared' check(scope in('shared','company')),
 owner_company_id uuid references public.companies(id) on delete cascade,
 normal_path text,roughness_path text,tile_cm numeric not null default 35,
 roughness_factor numeric not null default .85,metalness_factor numeric not null default 0,
 normal_scale numeric not null default .65,content_hash text,active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint chido_family_owner_scope check((scope='shared' and owner_company_id is null) or (scope='company' and owner_company_id is not null)));
create table if not exists public.material_swatches(
 id uuid primary key default gen_random_uuid(),family_id uuid not null references public.material_families(id) on delete cascade,
 code text not null unique,name text not null,hex_color text not null default '#D6CFC7',
 albedo_path text,thumb_path text,file_hash text,sort_order integer not null default 0,
 active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.company_materials(
 company_id uuid not null references public.companies(id) on delete cascade,
 family_id uuid not null references public.material_families(id) on delete cascade,
 is_default boolean not null default false,created_at timestamptz not null default now(),
 primary key(company_id,family_id));
create table if not exists public.product_material_overrides(
 product_id uuid not null references public.products(id) on delete cascade,
 role text not null check(role in('fabric','wood','metal','glass','gold')),
 default_swatch_id uuid references public.material_swatches(id) on delete set null,
 allowed_family_ids uuid[] not null default '{}',primary key(product_id,role));
create table if not exists public.studio_notifications(
 id uuid primary key default gen_random_uuid(),company_id uuid references public.companies(id) on delete cascade,
 product_id uuid references public.products(id) on delete cascade,
 event_type text not null check(event_type in('new_request','revision_requested','synced','published')),
 title text not null,body text not null default '',is_read boolean not null default false,
 created_at timestamptz not null default now());
alter table public.companies enable row level security;
alter table public.products enable row level security;
alter table public.asset_sync_manifest enable row level security;
alter table public.material_families enable row level security;
alter table public.material_swatches enable row level security;
alter table public.company_materials enable row level security;
alter table public.product_material_overrides enable row level security;
alter table public.studio_notifications enable row level security;
-- Public ANON gets no new access; authenticated users see GEN/shared and their own companies only.
create policy chido_unified_general_company_read on public.companies for select to authenticated using(code='GEN');
create policy chido_unified_live_product_read on public.products for select to authenticated using(
 status='live' and (company_id is null or
 company_id=(select id from public.companies where code='GEN') or
 public.chido_has_company_role(company_id) or public.chido_is_platform_admin()));
create policy chido_unified_manifest_read on public.asset_sync_manifest for select to authenticated using(
 company_code in ('GEN','SHARED') or public.chido_is_platform_admin() or exists(
 select 1 from public.companies c where c.code=company_code and public.chido_has_company_role(c.id)));
create policy chido_unified_material_families_read on public.material_families for select to authenticated using(
 active and (scope='shared' or public.chido_is_platform_admin() or public.chido_has_company_role(owner_company_id)));
create policy chido_unified_swatches_read on public.material_swatches for select to authenticated using(
 active and exists(select 1 from public.material_families f where f.id=family_id and f.active and
 (f.scope='shared' or public.chido_is_platform_admin() or public.chido_has_company_role(f.owner_company_id))));
create policy chido_unified_company_materials_read on public.company_materials for select to authenticated using(
 public.chido_is_platform_admin() or public.chido_has_company_role(company_id));
create policy chido_unified_product_overrides_read on public.product_material_overrides for select to authenticated using(
 exists(select 1 from public.products p where p.id=product_id));
create policy chido_unified_notifications_read on public.studio_notifications for select to authenticated using(
 public.chido_is_platform_admin() or public.chido_has_company_role(company_id));
-- Storage stays private: signed URLs only, no public bucket change.