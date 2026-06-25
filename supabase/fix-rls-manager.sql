-- Fix manager permissions and profile loading for existing Supabase projects.
-- Run this once in Supabase SQL Editor.

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

drop policy if exists "profiles read own or managers" on public.profiles;
drop policy if exists "projects read assigned or managers" on public.projects;
drop policy if exists "projects insert managers" on public.projects;
drop policy if exists "projects update assigned or managers" on public.projects;
drop policy if exists "history read related" on public.status_history;
drop policy if exists "photos read related" on public.project_photos;

create policy "profiles read own or managers" on public.profiles
for select using (
  id = auth.uid()
  or public.is_manager()
);

create policy "projects read assigned or managers" on public.projects
for select using (
  assigned_to = auth.uid()
  or public.is_manager()
);

create policy "projects insert managers" on public.projects
for insert with check (
  public.is_manager()
);

create policy "projects update assigned or managers" on public.projects
for update using (
  assigned_to = auth.uid()
  or public.is_manager()
);

create policy "history read related" on public.status_history
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
