-- Vehicle fleet, phase 2 (fleet-side only): who holds which vehicle and when.
-- Read and written by the fleet role (managers read). Nothing here is exposed
-- to workers; the worker-facing flow (my vehicle, receive / swap / return
-- forms) is built separately.

create extension if not exists btree_gist;

create table if not exists public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete set null,
  driver_name text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  assignment_kind text not null default 'permanent' check (assignment_kind in ('permanent', 'temporary')),
  liability_ack_at timestamptz,
  start_odometer integer check (start_odometer is null or start_odometer >= 0),
  end_odometer integer check (end_odometer is null or end_odometer >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  -- A vehicle has exactly one holder at any moment: no overlapping periods.
  constraint vehicle_assignments_no_overlap exclude using gist (
    vehicle_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  )
);
create unique index if not exists vehicle_assignments_one_open_idx
  on public.vehicle_assignments(vehicle_id) where ended_at is null;
create index if not exists vehicle_assignments_driver_idx
  on public.vehicle_assignments(driver_id, started_at desc);

alter table public.vehicle_assignments enable row level security;
drop policy if exists "vehicle_assignments fleet read" on public.vehicle_assignments;
drop policy if exists "vehicle_assignments fleet insert" on public.vehicle_assignments;
drop policy if exists "vehicle_assignments fleet update" on public.vehicle_assignments;
drop policy if exists "vehicle_assignments fleet delete" on public.vehicle_assignments;
create policy "vehicle_assignments fleet read" on public.vehicle_assignments
  for select using (public.can_view_fleet());
create policy "vehicle_assignments fleet insert" on public.vehicle_assignments
  for insert with check (public.is_fleet());
create policy "vehicle_assignments fleet update" on public.vehicle_assignments
  for update using (public.is_fleet()) with check (public.is_fleet());
create policy "vehicle_assignments fleet delete" on public.vehicle_assignments
  for delete using (public.is_fleet());
