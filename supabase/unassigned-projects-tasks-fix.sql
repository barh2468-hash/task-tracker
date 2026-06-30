-- Allow creating projects without assigning a field worker yet, and add project tasks.
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.projects
  alter column assigned_to drop not null;

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  is_done boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.project_tasks enable row level security;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists project_tasks_updated_at on public.project_tasks;
create trigger project_tasks_updated_at
before update on public.project_tasks
for each row execute function public.set_updated_at();

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

-- Make sure manager sees all projects, including unassigned projects.
drop policy if exists "projects read assigned or managers" on public.projects;
create policy "projects read assigned or managers" on public.projects
for select using (
  assigned_to = auth.uid()
  or public.is_manager()
);

-- Make sure manager can create projects with assigned_to = null.
drop policy if exists "projects insert managers" on public.projects;
create policy "projects insert managers" on public.projects
for insert with check (public.is_manager());

-- Make sure managers can edit unassigned projects and workers can update assigned projects.
drop policy if exists "projects update assigned or managers" on public.projects;
create policy "projects update assigned or managers" on public.projects
for update using (
  assigned_to = auth.uid()
  or public.is_manager()
);

-- Task policies.
drop policy if exists "tasks read related" on public.project_tasks;
drop policy if exists "tasks insert managers" on public.project_tasks;
drop policy if exists "tasks update managers" on public.project_tasks;
drop policy if exists "tasks delete managers" on public.project_tasks;

create policy "tasks read related" on public.project_tasks
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

create policy "tasks insert managers" on public.project_tasks
for insert with check (
  public.is_manager()
  and created_by = auth.uid()
);

create policy "tasks update managers" on public.project_tasks
for update using (public.is_manager());

create policy "tasks delete managers" on public.project_tasks
for delete using (public.is_manager());

-- History read should also include unassigned projects for managers.
drop policy if exists "history read related" on public.status_history;
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

-- Realtime for task updates.
do $$
begin
  begin alter publication supabase_realtime add table public.project_tasks; exception when duplicate_object then null; end;
end $$;
