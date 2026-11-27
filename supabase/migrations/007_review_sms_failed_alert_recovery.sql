-- Release the active slot if Twilio refuses a notification, instead of blocking the entire queue.
alter table public.review_sms_queue drop constraint if exists review_sms_queue_state_check;
alter table public.review_sms_queue add constraint review_sms_queue_state_check
 check (state in ('queued','active','complete','failed'));

create or replace function public.enqueue_review_sms_next(p_review_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_next uuid;
begin
 perform pg_advisory_xact_lock(873215,13);
 insert into public.review_sms_queue(review_id) values(p_review_id)
 on conflict (review_id) do nothing;
 if exists (select 1 from public.review_sms_queue where state='active') then return null; end if;
 select review_id into v_next from public.review_sms_queue
 where state='queued' order by queued_at,review_id limit 1;
 if v_next is not null then
  update public.review_sms_queue set state='active',activated_at=now()
  where review_id=v_next;
 end if;
 return v_next;
end; $$;
revoke execute on function public.enqueue_review_sms_next(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_review_sms_next(uuid) to service_role;

create or replace function public.fail_review_sms_alert(p_review_id uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(873215,13);
 update public.review_sms_queue set state='failed'
 where review_id=p_review_id and state='active';
 return found;
end; $$;
revoke execute on function public.fail_review_sms_alert(uuid) from public,anon,authenticated;
grant execute on function public.fail_review_sms_alert(uuid) to service_role;
