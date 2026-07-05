-- Field team upgrades: multiple workers per project, end-work note, and daily report helpers.
-- Safe/additive migration. It does not delete existing data.

create table if not exists public.project_workers (
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  primary key (project_id, worker_id)
);

alter table public.work_sessions
add column if not exists end_note text;

create index if not exists project_workers_worker_id_idx on public.project_workers(worker_id);
create index if not exists project_workers_project_id_idx on public.project_workers(project_id);
create index if not exists work_sessions_started_at_idx on public.work_sessions(started_at);
create index if not exists work_sessions_ended_at_idx on public.work_sessions(ended_at);

alter table public.project_workers enable row level security;

drop policy if exists "project workers read related" on public.project_workers;
drop policy if exists "project workers insert managers" on public.project_workers;
drop policy if exists "project workers delete managers" on public.project_workers;

create policy "project workers read related" on public.project_workers
for select using (
  worker_id = auth.uid()
  or public.is_manager()
);

create policy "project workers insert managers" on public.project_workers
for insert with check (public.is_manager());

create policy "project workers delete managers" on public.project_workers
for delete using (public.is_manager());

-- Allow field workers to see projects assigned through project_workers as well as assigned_to.
drop policy if exists "projects read assigned or managers" on public.projects;
create policy "projects read assigned or managers" on public.projects
for select using (
  assigned_to = auth.uid()
  or public.is_manager()
  or exists (
    select 1
    from public.project_workers pw
    where pw.project_id = projects.id
      and pw.worker_id = auth.uid()
  )
);

-- Allow workers assigned through project_workers to update project status/progress as well.
drop policy if exists "projects update assigned or managers" on public.projects;
create policy "projects update assigned or managers" on public.projects
for update using (
  assigned_to = auth.uid()
  or public.is_manager()
  or exists (
    select 1
    from public.project_workers pw
    where pw.project_id = projects.id
      and pw.worker_id = auth.uid()
  )
);

-- Work sessions: allow assigned additional workers to create/update their own sessions on the project.
drop policy if exists "work sessions read related" on public.work_sessions;
drop policy if exists "work sessions insert assigned" on public.work_sessions;
drop policy if exists "work sessions update own" on public.work_sessions;

create policy "work sessions read related" on public.work_sessions
for select using (
  worker_id = auth.uid()
  or public.is_manager()
  or exists (
    select 1 from public.projects pr
    where pr.id = project_id
      and (pr.assigned_to = auth.uid() or public.is_manager())
  )
);

create policy "work sessions insert assigned" on public.work_sessions
for insert with check (
  worker_id = auth.uid()
  and (
    exists (select 1 from public.projects pr where pr.id = project_id and pr.assigned_to = auth.uid())
    or exists (select 1 from public.project_workers pw where pw.project_id = project_id and pw.worker_id = auth.uid())
  )
);

create policy "work sessions update own" on public.work_sessions
for update using (worker_id = auth.uid() or public.is_manager());

-- Extend task/history/photo visibility to additional assigned workers.
drop policy if exists "tasks read related" on public.project_tasks;
create policy "tasks read related" on public.project_tasks
for select using (
  exists (
    select 1 from public.projects pr
    where pr.id = project_id
    and (
      pr.assigned_to = auth.uid()
      or public.is_manager()
      or exists (select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = auth.uid())
    )
  )
);

drop policy if exists "tasks update managers or assigned worker" on public.project_tasks;
create policy "tasks update managers or assigned worker" on public.project_tasks
for update using (
  public.is_manager()
  or exists (
    select 1 from public.projects pr
    where pr.id = project_id
      and (
        pr.assigned_to = auth.uid()
        or exists (select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = auth.uid())
      )
  )
)
with check (
  public.is_manager()
  or exists (
    select 1 from public.projects pr
    where pr.id = project_id
      and (
        pr.assigned_to = auth.uid()
        or exists (select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = auth.uid())
      )
  )
);

drop policy if exists "history read related" on public.status_history;
create policy "history read related" on public.status_history
for select using (
  exists (
    select 1 from public.projects pr
    where pr.id = project_id
    and (
      pr.assigned_to = auth.uid()
      or public.is_manager()
      or exists (select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = auth.uid())
    )
  )
);

drop policy if exists "photos read related" on public.project_photos;
create policy "photos read related" on public.project_photos
for select using (
  exists (
    select 1 from public.projects pr
    where pr.id = project_id
    and (
      pr.assigned_to = auth.uid()
      or public.is_manager()
      or exists (select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = auth.uid())
    )
  )
);

-- Realtime for new assignment table.
do $$
begin
  begin alter publication supabase_realtime add table public.project_workers; exception when duplicate_object then null; end;
end $$;
