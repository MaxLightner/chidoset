-- Browser payload telemetry. No URLs, bodies, credentials or camera data.
create table public.chido_usage_settings(singleton boolean primary key default true check(singleton),started_at timestamptz not null default now());
insert into public.chido_usage_settings(singleton) values(true);
create table public.chido_usage_batches(
 id uuid primary key, company_id uuid references public.companies(id) on delete cascade,
 user_id uuid not null, role text not null check(role in ('company_admin','branch','guest','central')),
 client text not null check(client in ('app','company','studio','guest','central')),
 http_sent bigint not null check(http_sent between 0 and 268435456),http_received bigint not null check(http_received between 0 and 536870912),
 ws_sent bigint not null check(ws_sent between 0 and 268435456),ws_received bigint not null check(ws_received between 0 and 536870912),
 requests integer not null check(requests between 0 and 10000),errors integer not null check(errors between 0 and 10000),
 model_loads integer not null check(model_loads between 0 and 1000),active_seconds integer not null check(active_seconds between 0 and 300),created_at timestamptz not null default now()
);
create index chido_usage_company_time on public.chido_usage_batches(company_id,created_at);
create index chido_usage_user_time on public.chido_usage_batches(user_id,created_at desc);
alter table public.chido_usage_settings enable row level security;
alter table public.chido_usage_batches enable row level security;
revoke all on public.chido_usage_settings,public.chido_usage_batches from public,anon,authenticated;
grant all on public.chido_usage_settings,public.chido_usage_batches to service_role;
create function public.chido_usage_summary(p_company uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
 with days as(select generate_series((now() at time zone 'Asia/Tehran')::date-29,(now() at time zone 'Asia/Tehran')::date,interval '1 day')::date as bucket_day),
 members as(select * from public.company_memberships where p_company is null or company_id=p_company),
 models as(select p.* from public.products p where p_company is null or exists(select 1 from public.set_products sp join public.sets s on s.id=sp.set_id where sp.product_id=p.id and s.company_id=p_company)),
 usage as(select (created_at at time zone 'Asia/Tehran')::date as bucket_day,sum(http_sent+ws_sent) sent,sum(http_received+ws_received) received,sum(requests) requests,sum(errors) errors,sum(model_loads) model_loads,sum(active_seconds) active_seconds,count(distinct user_id) users from public.chido_usage_batches where created_at>=now()-interval '31 days' and(p_company is null or company_id=p_company) group by 1)
 select jsonb_build_object('started_at',(select started_at from public.chido_usage_settings),'accounts',(select count(*) from members),'active_accounts',(select count(*) from members where status='active'),'prepared_models',(select count(*) from models where active),'uploaded_models',(select count(*) from models where catalog_index>=32),'days',(select jsonb_agg(jsonb_build_object('day',d.bucket_day,'accounts',(select count(*) from members where (created_at at time zone 'Asia/Tehran')::date<=d.bucket_day),'new_accounts',(select count(*) from members where (created_at at time zone 'Asia/Tehran')::date=d.bucket_day),'new_models',(select count(*) from models where catalog_index>=32 and(created_at at time zone 'Asia/Tehran')::date=d.bucket_day),'sent',coalesce(u.sent,0),'received',coalesce(u.received,0),'requests',coalesce(u.requests,0),'errors',coalesce(u.errors,0),'model_loads',coalesce(u.model_loads,0),'active_seconds',coalesce(u.active_seconds,0),'users',coalesce(u.users,0)) order by d.bucket_day) from days d left join usage u on u.bucket_day=d.bucket_day))
$$;
revoke all on function public.chido_usage_summary(uuid) from public,anon,authenticated;
grant execute on function public.chido_usage_summary(uuid) to service_role;
