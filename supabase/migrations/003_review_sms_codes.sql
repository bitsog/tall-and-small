-- Stable, exact review ID for two-way SMS routing (avoid searching UUID prefixes).
alter table public.customer_reviews
  add column if not exists review_code text unique
  default substring(md5(gen_random_uuid()::text), 1, 10);
update public.customer_reviews
  set review_code=substring(md5(gen_random_uuid()::text), 1, 10)
  where review_code is null;
alter table public.customer_reviews alter column review_code set not null;
