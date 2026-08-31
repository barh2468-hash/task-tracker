-- General employee attendance, independent of project work sessions.
-- Safe additive migration for the linked Supabase project.

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_lat double precision,
  started_lng double precision,
  started_accuracy double precision,
  ended_lat double precision,
  ended_lng double precision,
  ended_accuracy double precision,
  end_note text,
  attendance_type text not null default 'field',
  attendance_date date not null default current_date,
  is_all_day boolean not null default false,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

alter table public.attendance_sessions
  add column if not exists attendance_type text not null default 'field',
  add column if not exists attendance_date date not null default current_date,
  add column if not exists is_all_day boolean not null default false;

alter table public.attendance_sessions
  drop constraint if exists attendance_sessions_type_check;
alter table public.attendance_sessions
  add constraint attendance_sessions_type_check
  check (attendance_type in ('field', 'office', 'vacation', 'sick', 'reserve_duty'));

create index if not exists attendance_sessions_worker_id_idx
  on public.attendance_sessions(worker_id);
create index if not exists attendance_sessions_started_at_idx
  on public.attendance_sessions(started_at desc);
create index if not exists attendance_sessions_ended_at_idx
  on public.attendance_sessions(ended_at);

create unique index if not exists attendance_sessions_one_open_per_worker_idx
  on public.attendance_sessions(worker_id)
  where ended_at is null;

create unique index if not exists attendance_sessions_one_day_status_idx
  on public.attendance_sessions(worker_id, attendance_date)
  where is_all_day = true;

alter table public.attendance_sessions enable row level security;

drop policy if exists "attendance sessions read own or managers" on public.attendance_sessions;
drop policy if exists "attendance sessions insert own" on public.attendance_sessions;
drop policy if exists "attendance sessions update own or managers" on public.attendance_sessions;
drop policy if exists "attendance sessions delete managers" on public.attendance_sessions;
drop policy if exists "attendance sessions delete own day status or managers" on public.attendance_sessions;

create policy "attendance sessions read own or managers" on public.attendance_sessions
for select using (
  worker_id = auth.uid()
  or public.is_manager()
);

create policy "attendance sessions insert own" on public.attendance_sessions
for insert with check (worker_id = auth.uid());

create policy "attendance sessions update own or managers" on public.attendance_sessions
for update using (
  worker_id = auth.uid()
  or public.is_manager()
)
with check (
  worker_id = auth.uid()
  or public.is_manager()
);

create policy "attendance sessions delete own day status or managers" on public.attendance_sessions
for delete using (
  public.is_manager()
  or (worker_id = auth.uid() and is_all_day = true)
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.attendance_sessions;
  exception when duplicate_object then null;
  end;
end $$;
