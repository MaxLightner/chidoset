-- Sandbox-only payment attempts. Never activates or renews a subscription.
create table if not exists public.chido_sandbox_payment_attempts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 user_id uuid not null references auth.users(id),
 plan_code text not null check (plan_code in ('quarter','half','annual','lifetime')),
 amount_rials bigint not null check (amount_rials > 0),
 authority text unique,
 status text not null default 'initiated' check (status in ('initiated','redirected','verified','failed','cancelled')),
 ref_id text,
 created_at timestamptz not null default now(),
 verified_at timestamptz
);

create index if not exists chido_sandbox_attempts_company_idx
 on public.chido_sandbox_payment_attempts (company_id,created_at desc);

alter table public.chido_sandbox_payment_attempts enable row level security;
-- No public policies: service-role Edge Function owns all reads and writes.
