-- Soft moderation for individual work photos; private draft object remains recoverable.
alter table public.work_photos add column if not exists hidden_at timestamptz;
create index if not exists work_photos_visible on public.work_photos(project_id,created_at) where hidden_at is null;
