-- Prevent repeated MMS delivery from duplicating photos when Twilio retries.
alter table public.work_photos add column if not exists source_message_sid text;
alter table public.work_photos add column if not exists source_photo_index integer;
create unique index if not exists work_photos_source_idempotent on public.work_photos(source_message_sid,source_photo_index)
where source_message_sid is not null;
