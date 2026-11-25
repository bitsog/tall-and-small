-- Incoming SMS is processed only after verifying the Twilio request signature.
-- Pending replies expire, require confirmation, and cannot update reviews themselves.
create table if not exists public.review_sms_pending (
  review_id uuid primary key references public.customer_reviews(id) on delete cascade,
  reply_text text not null check (char_length(reply_text) between 1 and 1000),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.review_sms_pending enable row level security;
revoke all on public.review_sms_pending from anon, authenticated;
create table if not exists public.review_sms_processed (
  message_sid text primary key,
  received_at timestamptz not null default now()
);
alter table public.review_sms_processed enable row level security;
revoke all on public.review_sms_processed from anon, authenticated;
create index if not exists idx_review_sms_processed_received on public.review_sms_processed(received_at);
