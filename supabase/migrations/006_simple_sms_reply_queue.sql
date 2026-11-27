-- Queue only one SMS review at a time so David never types or copies review IDs.
-- Service-role-only functions; never expose this queue through the public Data API.
create table if not exists public.review_sms_queue (
 review_id uuid primary key references public.customer_reviews(id) on delete cascade,
 state text not null default 'queued' check (state in ('queued','active','complete')),
 queued_at timestamptz not null default now(),
 activated_at timestamptz
);
create unique index if not exists review_sms_one_active
 on public.review_sms_queue((1)) where state='active';
create index if not exists review_sms_queue_order
 on public.review_sms_queue(queued_at,review_id) where state='queued';
alter table public.review_sms_queue enable row level security;
revoke all on public.review_sms_queue from anon,authenticated;
grant select,insert,update on public.review_sms_queue to service_role;

create or replace function public.enqueue_review_sms(p_review_id uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare v_active boolean;
begin
 perform pg_advisory_xact_lock(873215,13);
 insert into public.review_sms_queue(review_id) values (p_review_id)
 on conflict (review_id) do nothing;
 select exists(select 1 from public.review_sms_queue where state='active') into v_active;
 if not v_active then
  update public.review_sms_queue set state='active',activated_at=now()
  where review_id=p_review_id and state='queued';
  return found;
 end if;
 return false;
end; $$;
revoke execute on function public.enqueue_review_sms(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_review_sms(uuid) to service_role;

create or replace function public.advance_review_sms(p_review_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_next uuid;
begin
 perform pg_advisory_xact_lock(873215,13);
 update public.review_sms_queue set state='complete'
 where review_id=p_review_id and state='active';
 if not found then return null; end if;
 select review_id into v_next
 from public.review_sms_queue where state='queued'
 order by queued_at,review_id limit 1;
 if v_next is not null then
  update public.review_sms_queue set state='active',activated_at=now()
  where review_id=v_next;
 end if;
 return v_next;
end; $$;
revoke execute on function public.advance_review_sms(uuid) from public,anon,authenticated;
grant execute on function public.advance_review_sms(uuid) to service_role;
