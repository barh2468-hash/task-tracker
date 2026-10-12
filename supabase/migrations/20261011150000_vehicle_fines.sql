-- Vehicle fines (דוחות): register and holder-at-time lookup. Management-side
-- only: managers own the data, workers have no access (a worker-facing view is
-- built separately). Workers pay the amount the authority shows, so no
-- interest is computed here: a newer scan records the new amount in
-- amount_history.

create table if not exists public.vehicle_fines (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete set null,
  driver_name text not null default '',
  fine_number text not null default '',
  offense_description text not null default '',
  offense_at timestamptz,
  location text not null default '',
  authority text not null default '',
  amount_ils numeric(12, 2) not null check (amount_ils >= 0),
  due_date date,
  points integer check (points is null or points >= 0),
  status text not null default 'new' check (status in ('new', 'forwarded', 'paid', 'appeal')),
  paid_at timestamptz,
  document_id uuid references public.vehicle_documents(id) on delete set null,
  amount_history jsonb not null default '[]'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists vehicle_fines_number_key
  on public.vehicle_fines(vehicle_id, fine_number) where fine_number <> '';
create index if not exists vehicle_fines_status_idx on public.vehicle_fines(status, due_date);
create index if not exists vehicle_fines_driver_idx on public.vehicle_fines(driver_id) where driver_id is not null;

alter table public.vehicle_fines enable row level security;
drop policy if exists "vehicle_fines fleet read" on public.vehicle_fines;
drop policy if exists "vehicle_fines fleet insert" on public.vehicle_fines;
drop policy if exists "vehicle_fines fleet update" on public.vehicle_fines;
drop policy if exists "vehicle_fines fleet delete" on public.vehicle_fines;
create policy "vehicle_fines fleet read" on public.vehicle_fines for select using (public.can_view_fleet());
create policy "vehicle_fines fleet insert" on public.vehicle_fines for insert with check (public.is_fleet());
create policy "vehicle_fines fleet update" on public.vehicle_fines for update using (public.is_fleet()) with check (public.is_fleet());
create policy "vehicle_fines fleet delete" on public.vehicle_fines for delete using (public.is_fleet());

-- Who held the vehicle at a given moment: the assignment covering that time,
-- else the vehicle's regular driver.
create or replace function public.fine_holder_at(p_vehicle uuid, p_at timestamptz)
returns table (driver_id uuid, driver_name text)
language sql
stable
security definer
set search_path = public
as $$
  select a.driver_id, a.driver_name
  from public.vehicle_assignments a
  where public.can_view_fleet()
    and a.vehicle_id = p_vehicle
    and a.started_at <= p_at
    and (a.ended_at is null or a.ended_at > p_at)
  union all
  select v.driver_id, v.driver_name
  from public.vehicles v
  where public.can_view_fleet()
    and v.id = p_vehicle
    and not exists (
      select 1 from public.vehicle_assignments a
      where a.vehicle_id = p_vehicle and a.started_at <= p_at and (a.ended_at is null or a.ended_at > p_at)
    )
  limit 1;
$$;
revoke all on function public.fine_holder_at(uuid, timestamptz) from public;
grant execute on function public.fine_holder_at(uuid, timestamptz) to authenticated;
