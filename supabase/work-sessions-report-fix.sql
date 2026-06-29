-- Work sessions and employee Excel report support.
-- Run once in Supabase SQL Editor.

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists work_sessions_project_id_idx on public.work_sessions(project_id);
create index if not exists work_sessions_worker_id_idx on public.work_sessions(worker_id);
create index if not exists work_sessions_started_at_idx on public.work_sessions(started_at);

alter table public.work_sessions enable row level security;

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

drop policy if exists "work sessions read own assigned or managers" on public.work_sessions;
drop policy if exists "work sessions insert own" on public.work_sessions;
drop policy if exists "work sessions update own open" on public.work_sessions;
drop policy if exists "work sessions delete managers" on public.work_sessions;

create policy "work sessions read own assigned or managers" on public.work_sessions
for select using (
  worker_id = auth.uid()
  or public.is_manager()
  or exists (
    select 1 from public.projects pr
    where pr.id = project_id
      and pr.assigned_to = auth.uid()
  )
);

create policy "work sessions insert own" on public.work_sessions
for insert with check (
  worker_id = auth.uid()
  and exists (
    select 1 from public.projects pr
    where pr.id = project_id
      and (pr.assigned_to = auth.uid() or public.is_manager())
  )
);

create policy "work sessions update own open" on public.work_sessions
for update using (
  worker_id = auth.uid()
  or public.is_manager()
)
with check (
  worker_id = auth.uid()
  or public.is_manager()
);

create policy "work sessions delete managers" on public.work_sessions
for delete using (public.is_manager());

do $$
begin
  begin alter publication supabase_realtime add table public.work_sessions; exception when duplicate_object then null; end;
end $$;
