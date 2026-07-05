-- Safe additive migration for: photo categories, unassigned projects view support, exceptions report and project PDF export.
-- Run once in Supabase SQL Editor.

alter table if exists public.project_photos
add column if not exists category text not null default 'תמונת שטח';

-- Keep existing photos categorized without changing data meaning.
update public.project_photos
set category = 'תמונת שטח'
where category is null or trim(category) = '';

-- Helpful indexes for reports. Safe to run multiple times.
create index if not exists idx_projects_assigned_to on public.projects(assigned_to);
create index if not exists idx_projects_updated_at on public.projects(updated_at);
create index if not exists idx_project_tasks_project_done on public.project_tasks(project_id, is_done);
create index if not exists idx_project_photos_project_category on public.project_photos(project_id, category);

-- No destructive changes are made here.
