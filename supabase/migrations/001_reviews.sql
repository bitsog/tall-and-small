-- Supabase review system for Tall and Small Yard Work.
-- Public reads only published reviews; all changes occur through a trusted Edge Function.
create extension if not exists pgcrypto;
create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 10 and 1000),
  owner_reply text,
  owner_replied_at timestamptz,
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now()
);
alter table public.customer_reviews enable row level security;
revoke all on public.customer_reviews from anon, authenticated;
grant select on public.customer_reviews to anon, authenticated;
drop policy if exists "Public can read published reviews" on public.customer_reviews;
create policy "Public can read published reviews" on public.customer_reviews
  for select to anon, authenticated using (status = 'published');
create index if not exists customer_reviews_recent on public.customer_reviews (created_at desc) where status='published';

-- Keep optional customer contact details PRIVATE from public review displays.
create table if not exists public.review_contacts (
  review_id uuid primary key references public.customer_reviews(id) on delete cascade,
  customer_contact text,
  contact_permission boolean not null default false
);
alter table public.review_contacts enable row level security;
revoke all on public.review_contacts from anon, authenticated;
-- No public RLS policies. Access exclusively through the service-role Edge Function.
