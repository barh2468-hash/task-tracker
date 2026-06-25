-- Fixes for edit/delete projects and displaying uploaded photos.
-- Run once in Supabase SQL Editor.

create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'manager'
  );
$$;

grant execute on function public.is_manager() to authenticated;

-- Manager delete permission for projects. Related status_history/project_photos rows are deleted by ON DELETE CASCADE.
drop policy if exists "projects delete managers" on public.projects;
create policy "projects delete managers" on public.projects
for delete using (public.is_manager());

-- Make sure authenticated users can read/upload photos in the project-photos bucket.
insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', false)
on conflict (id) do update set name = excluded.name;

drop policy if exists "project photos upload authenticated" on storage.objects;
drop policy if exists "project photos read authenticated" on storage.objects;
drop policy if exists "project photos delete managers" on storage.objects;

create policy "project photos upload authenticated" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-photos');

create policy "project photos read authenticated" on storage.objects
for select to authenticated
using (bucket_id = 'project-photos');

create policy "project photos delete managers" on storage.objects
for delete to authenticated
using (bucket_id = 'project-photos' and public.is_manager());

-- Project photo rows.
drop policy if exists "photos read related" on public.project_photos;
drop policy if exists "photos insert authenticated" on public.project_photos;
drop policy if exists "photos delete managers" on public.project_photos;

create policy "photos read related" on public.project_photos
for select using (
  exists (
    select 1 from public.projects pr
    where pr.id = project_id
    and (
      pr.assigned_to = auth.uid()
      or public.is_manager()
    )
  )
);

create policy "photos insert authenticated" on public.project_photos
for insert with check (uploaded_by = auth.uid());

create policy "photos delete managers" on public.project_photos
for delete using (public.is_manager());
