-- Safe additive migration for project archive support.
-- Run once in Supabase SQL Editor.
-- This does not delete projects, users, work hours, photos, tasks, notifications or history.

alter table if exists public.projects
add column if not exists is_archived boolean not null default false;

alter table if exists public.projects
add column if not exists archived_at timestamptz;

create index if not exists idx_projects_is_archived on public.projects(is_archived);
create index if not exists idx_projects_archived_at on public.projects(archived_at);

-- Keep existing projects active.
update public.projects
set is_archived = false
where is_archived is null;
