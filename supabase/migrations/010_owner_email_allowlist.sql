-- Owner access is explicitly allowlisted. Authentication remains Supabase Auth.
-- Email is used only after getUser() verifies a real Supabase access token.
create table if not exists public.website_owner_emails (
 email text primary key,
 created_at timestamptz not null default now(),
 constraint email_normalized check (email=lower(trim(email)))
);
alter table public.website_owner_emails enable row level security;
revoke all on public.website_owner_emails from public,anon,authenticated;
grant select,insert,update,delete on public.website_owner_emails to service_role;
insert into public.website_owner_emails(email) values ('ben.rahm@gmail.com')
on conflict(email) do nothing;