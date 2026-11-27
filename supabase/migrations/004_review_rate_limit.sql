-- Atomic per-network-window limits for review submissions.
-- Caller supplies only a salted HMAC of an IP (never raw IP).
create table if not exists public.review_submission_throttle (
  network_key text not null,
  time_bucket timestamptz not null,
  submission_count integer not null default 1 check (submission_count between 1 and 3),
  primary key(network_key,time_bucket)
);
alter table public.review_submission_throttle enable row level security;
revoke all on public.review_submission_throttle from anon,authenticated;
create or replace function public.take_review_rate_slot(p_network_key text)
returns boolean language plpgsql security invoker set search_path = public
as $$
declare v_count integer;
begin
  if length(p_network_key) != 64 then return false; end if;
  insert into public.review_submission_throttle(network_key,time_bucket,submission_count)
  values(p_network_key,date_trunc('hour',now()),1)
  on conflict (network_key,time_bucket)
  do update set submission_count = review_submission_throttle.submission_count + 1
  where review_submission_throttle.submission_count < 3
  returning submission_count into v_count;
  return v_count is not null;
end;
$$;
revoke execute on function public.take_review_rate_slot(text) from public, anon, authenticated;
grant execute on function public.take_review_rate_slot(text) to service_role;
grant select,insert,update on public.review_submission_throttle to service_role;
