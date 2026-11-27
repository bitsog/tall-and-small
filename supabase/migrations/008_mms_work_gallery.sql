-- MMS project gallery: no customer contact details, address, or location data.
create table if not exists public.work_projects (
 id uuid primary key default gen_random_uuid(),
 title text not null default 'Completed Yard Work' check(char_length(title) between 1 and 80),
 status text not null default 'draft' check(status in ('draft','awaiting_publish','held','published','archived')),
 capture_mode text not null default 'after' check(capture_mode in ('before','after')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 archived_at timestamptz
);
create unique index if not exists work_projects_one_active
 on public.work_projects ((1)) where status in ('draft','awaiting_publish');
create index if not exists work_projects_published on public.work_projects(published_at desc)
 where status='published';
alter table public.work_projects enable row level security;
revoke all on public.work_projects from anon,authenticated;
grant select,insert,update,delete on public.work_projects to service_role;

create table if not exists public.work_photos (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.work_projects(id) on delete cascade,
 photo_type text not null check(photo_type in ('before','after')),
 draft_path text not null unique,
 public_path text unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 created_at timestamptz not null default now()
);
create index if not exists work_photos_project on public.work_photos(project_id,created_at);
alter table public.work_photos enable row level security;
revoke all on public.work_photos from anon,authenticated;
grant select,insert,update,delete on public.work_photos to service_role;

-- Private drafts must never have public file access; public copies are created
-- only after David explicitly approves publication.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('yard-project-drafts','yard-project-drafts',false,6291456,ARRAY['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('yard-project-public','yard-project-public',true,6291456,ARRAY['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do nothing;
