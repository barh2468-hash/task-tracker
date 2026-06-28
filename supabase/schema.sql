-- Supabase schema for Infrastructure Tracker
-- Run this file in Supabase SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null,
  role text not null default 'field_worker' check (role in ('manager','field_worker')),
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  location text not null,
  description text,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  status text not null default 'בעבודה בשטח' check (status in ('בעבודה בשטח','עבר לשרטוט','נדרש GPR','מחכה להיתרים','הושלם')),
  progress int default 25 check (progress >= 0 and progress <= 100),
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id),
  note text,
  created_at timestamptz default now()
);

create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  file_path text not null,
  created_at timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.status_history enable row level security;
alter table public.project_photos enable row level security;

-- Helper function used by RLS policies. It avoids recursive policies on public.profiles.
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

-- Clean duplicate policies if the script is re-run.
drop policy if exists "profiles read own or managers" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "projects read assigned or managers" on public.projects;
drop policy if exists "projects insert managers" on public.projects;
drop policy if exists "projects update assigned or managers" on public.projects;
drop policy if exists "history read related" on public.status_history;
drop policy if exists "history insert authenticated" on public.status_history;
drop policy if exists "photos read related" on public.project_photos;
drop policy if exists "photos insert authenticated" on public.project_photos;

create policy "profiles read own or managers" on public.profiles
for select using (
  id = auth.uid()
  or public.is_manager()
);

create policy "profiles insert own" on public.profiles
for insert with check (id = auth.uid());

create policy "profiles update own" on public.profiles
for update using (id = auth.uid());

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

create policy "history insert authenticated" on public.status_history
for insert with check (changed_by = auth.uid());

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

insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', false)
on conflict (id) do nothing;

-- Storage policies for project photos.
drop policy if exists "project photos upload authenticated" on storage.objects;
drop policy if exists "project photos read authenticated" on storage.objects;

create policy "project photos upload authenticated" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-photos');

create policy "project photos read authenticated" on storage.objects
for select to authenticated
using (bucket_id = 'project-photos');

-- Enable realtime for the relevant tables. If these commands warn that the table already exists in the publication, ignore the warning.
do $$
begin
  begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.status_history; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.project_photos; exception when duplicate_object then null; end;
end $$;

-- After the first manager logs in, run this with their email:
-- update public.profiles set role = 'manager', full_name = 'שם המנהל' where email = 'manager@company.com';

-- To define a team lead, run:
