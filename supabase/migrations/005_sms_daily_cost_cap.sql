-- Bound outgoing review alerts to prevent accidental SMS cost spikes.
-- The limit is per UTC day, across review notifications.
create table if not exists public.review_sms_daily_budget (
 day date primary key,
 messages_reserved integer not null check (messages_reserved between 1 and 20)
);
alter table public.review_sms_daily_budget enable row level security;
revoke all on public.review_sms_daily_budget from anon,authenticated;
create or replace function public.reserve_review_sms_alert()
returns boolean language plpgsql security invoker set search_path=public as $$
declare v_count integer;
begin
 insert into public.review_sms_daily_budget(day,messages_reserved)
 values ((now() at time zone 'UTC')::date,1)
 on conflict(day) do update set messages_reserved=review_sms_daily_budget.messages_reserved+1
 where review_sms_daily_budget.messages_reserved < 20
 returning messages_reserved into v_count;
 return v_count is not null;
end;
$$;
revoke execute on function public.reserve_review_sms_alert() from public,anon,authenticated;
grant execute on function public.reserve_review_sms_alert() to service_role;
grant select,insert,update on public.review_sms_daily_budget to service_role;
