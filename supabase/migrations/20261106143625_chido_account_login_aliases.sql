create table public.chido_login_aliases (
 username text primary key check(username=lower(username) and username ~ '^[a-z0-9][a-z0-9._-]{2,49}$'),
 user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.chido_login_aliases enable row level security;
revoke all on public.chido_login_aliases from public,anon,authenticated;
grant all on public.chido_login_aliases to service_role;
