-- Vehicle fleet, worker side: "my vehicle" for every role.
-- Workers never read or write the fleet tables directly. Everything goes through the
-- security-definer functions below, which check auth.uid() and return only
-- non-sensitive columns. Managers keep full access through the existing fleet policies.

-- ----------------------------------------------------- declaration forms
create table if not exists public.vehicle_declaration_forms (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text not null default '',
  action text not null check (action in ('received', 'swapped', 'returned')),
  vehicle_use text not null default 'permanent' check (vehicle_use in ('permanent', 'temporary')),
  is_regular_driver boolean not null default false,
  happened_at timestamptz not null default now(),
  place text not null default '',
  odometer integer check (odometer is null or odometer >= 0),
  returned_vehicle_id uuid references public.vehicles(id) on delete set null,
  returned_odometer integer check (returned_odometer is null or returned_odometer >= 0),
  -- pascal_removed, dalkan_blocked, no_equipment_left, license_photo_sent, insurance_cert_sent
  checklist jsonb not null default '{}'::jsonb,
  liability_ack_at timestamptz,
  signature_data text,
  assignment_id uuid references public.vehicle_assignments(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists vehicle_declaration_forms_vehicle_idx
  on public.vehicle_declaration_forms(vehicle_id, created_at desc);
create index if not exists vehicle_declaration_forms_user_idx
  on public.vehicle_declaration_forms(user_id, created_at desc);

alter table public.vehicle_declaration_forms enable row level security;
drop policy if exists "vehicle_declaration_forms fleet read" on public.vehicle_declaration_forms;
drop policy if exists "vehicle_declaration_forms fleet update" on public.vehicle_declaration_forms;
drop policy if exists "vehicle_declaration_forms fleet delete" on public.vehicle_declaration_forms;
create policy "vehicle_declaration_forms fleet read" on public.vehicle_declaration_forms
  for select using (public.can_view_fleet());
create policy "vehicle_declaration_forms fleet update" on public.vehicle_declaration_forms
  for update using (public.is_fleet()) with check (public.is_fleet());
create policy "vehicle_declaration_forms fleet delete" on public.vehicle_declaration_forms
  for delete using (public.is_fleet());

-- ------------------------------------------------------ monthly fuel reports
create table if not exists public.vehicle_fuel_reports (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  report_month date not null check (report_month = date_trunc('month', report_month)::date),
  liters numeric(8, 2) not null check (liters >= 0),
  amount_ils numeric(10, 2) check (amount_ils is null or amount_ils >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, report_month, reported_by)
);
create index if not exists vehicle_fuel_reports_vehicle_idx
  on public.vehicle_fuel_reports(vehicle_id, report_month desc);

alter table public.vehicle_fuel_reports enable row level security;
drop policy if exists "vehicle_fuel_reports fleet read" on public.vehicle_fuel_reports;
drop policy if exists "vehicle_fuel_reports fleet write" on public.vehicle_fuel_reports;
create policy "vehicle_fuel_reports fleet read" on public.vehicle_fuel_reports
  for select using (public.can_view_fleet());
create policy "vehicle_fuel_reports fleet write" on public.vehicle_fuel_reports
  for all using (public.is_fleet()) with check (public.is_fleet());

-- ------------------------------------------------------------------ helpers
-- True when the user holds the vehicle now: an open assignment, or the regular driver.
create or replace function public.worker_holds_vehicle(p_user uuid, p_vehicle uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vehicle_assignments a
    where a.vehicle_id = p_vehicle and a.driver_id = p_user and a.ended_at is null
  ) or exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle and v.driver_id = p_user and v.status <> 'retired'
  );
$$;
revoke all on function public.worker_holds_vehicle(uuid, uuid) from public, anon, authenticated;

-- Records the month's reading. A reading below the highest on record is refused
-- (only a manager can correct it); an equal or higher one replaces the month's value.
create or replace function public.worker_set_odometer(p_vehicle uuid, p_km integer, p_user uuid, p_on date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare highest integer;
begin
  if p_km is null then return; end if;
  select max(odometer_km) into highest from public.vehicle_odometer_readings where vehicle_id = p_vehicle;
  if highest is not null and p_km < highest then
    raise exception 'odometer_lower' using hint = 'The reading is lower than the highest one on record.';
  end if;
  insert into public.vehicle_odometer_readings (vehicle_id, reading_month, odometer_km, read_on, entered_by)
  values (p_vehicle, date_trunc('month', p_on)::date, p_km, p_on, p_user)
  on conflict (vehicle_id, reading_month)
  do update set odometer_km = excluded.odometer_km, read_on = excluded.read_on, entered_by = excluded.entered_by;
end;
$$;
revoke all on function public.worker_set_odometer(uuid, integer, uuid, date) from public, anon, authenticated;

-- ------------------------------------------------------------ worker reads
create or replace function public.worker_my_vehicles()
returns table (
  vehicle_id uuid, plate_number text, make_model text, kind text,
  current_odometer integer, odometer_reported_this_month boolean,
  assignment_kind text, since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.plate_number, v.make_model, v.kind, v.current_odometer,
    exists (select 1 from public.vehicle_odometer_readings r
            where r.vehicle_id = v.id and r.reading_month = date_trunc('month', current_date)::date),
    coalesce(a.assignment_kind, 'permanent'), a.started_at
  from public.vehicles v
  left join public.vehicle_assignments a
    on a.vehicle_id = v.id and a.driver_id = auth.uid() and a.ended_at is null
  where auth.uid() is not null and v.status <> 'retired'
    and (a.id is not null or v.driver_id = auth.uid())
  order by v.plate_number;
$$;

-- Only the plate numbers of vehicles in use, to choose from when receiving or swapping.
-- Holder names and models are not exposed to other workers.
drop function if exists public.worker_available_vehicles();
create or replace function public.worker_available_vehicles()
returns table (vehicle_id uuid, plate_number text)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.plate_number
  from public.vehicles v
  where auth.uid() is not null and v.status = 'in_use' and v.kind <> 'trailer'
  order by v.plate_number;
$$;

create or replace function public.worker_my_forms()
returns table (
  id uuid, vehicle_id uuid, plate_number text, make_model text, action text, vehicle_use text,
  happened_at timestamptz, odometer integer, status text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.vehicle_id, v.plate_number, v.make_model, f.action, f.vehicle_use, f.happened_at, f.odometer, f.status, f.created_at
  from public.vehicle_declaration_forms f
  join public.vehicles v on v.id = f.vehicle_id
  where f.user_id = auth.uid()
  order by f.created_at desc
  limit 50;
$$;

create or replace function public.worker_my_fuel_reports()
returns table (id uuid, vehicle_id uuid, plate_number text, report_month date, liters numeric, amount_ils numeric)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.vehicle_id, v.plate_number, f.report_month, f.liters, f.amount_ils
  from public.vehicle_fuel_reports f
  join public.vehicles v on v.id = f.vehicle_id
  where f.reported_by = auth.uid()
  order by f.report_month desc, v.plate_number
  limit 36;
$$;

-- ----------------------------------------------------------- worker writes
create or replace function public.worker_report_odometer(p_vehicle_id uuid, p_km integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_km is null or p_km < 0 then raise exception 'invalid_odometer'; end if;
  if not public.worker_holds_vehicle(auth.uid(), p_vehicle_id) then raise exception 'not_your_vehicle'; end if;
  perform public.worker_set_odometer(p_vehicle_id, p_km, auth.uid(), current_date);
end;
$$;

-- The vehicle must be one the worker holds now, or held at some point in the reported
-- month. Only the current or the previous month can be reported.
create or replace function public.worker_report_fuel(p_vehicle_id uuid, p_month date, p_liters numeric, p_amount numeric default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare month_start date := date_trunc('month', p_month)::date;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_liters is null or p_liters < 0 then raise exception 'invalid_liters'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'invalid_amount'; end if;
  if month_start > date_trunc('month', current_date)::date
     or month_start < (date_trunc('month', current_date) - interval '1 month')::date then
    raise exception 'month_out_of_range';
  end if;
  if not public.worker_holds_vehicle(auth.uid(), p_vehicle_id) and not exists (
    select 1 from public.vehicle_assignments a
    where a.vehicle_id = p_vehicle_id and a.driver_id = auth.uid()
      and a.started_at < (month_start + interval '1 month')
      and coalesce(a.ended_at, 'infinity'::timestamptz) >= month_start
  ) then
    raise exception 'not_your_vehicle';
  end if;

  insert into public.vehicle_fuel_reports (vehicle_id, reported_by, report_month, liters, amount_ils)
  values (p_vehicle_id, auth.uid(), month_start, p_liters, p_amount)
  on conflict (vehicle_id, report_month, reported_by)
  do update set liters = excluded.liters, amount_ils = excluded.amount_ils, updated_at = now();
end;
$$;

-- received / swapped / returned. One transaction: closes the previous assignment(s), opens
-- the new one, records the odometer, saves the signed form and notifies the managers.
create or replace function public.worker_declare_vehicle(
  p_action text,
  p_vehicle_id uuid,
  p_returned_vehicle_id uuid default null,
  p_use text default 'permanent',
  p_is_regular boolean default false,
  p_odometer integer default null,
  p_returned_odometer integer default null,
  p_place text default '',
  p_happened_at timestamptz default null,
  p_checklist jsonb default '{}'::jsonb,
  p_signature text default null,
  p_liability_ack boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  at_time timestamptz := coalesce(p_happened_at, now());
  v_checklist jsonb := coalesce(p_checklist, '{}'::jsonb);
  v_vehicle public.vehicles;
  v_assignment_id uuid;
  form_id uuid;
  returned_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_action not in ('received', 'swapped', 'returned') then raise exception 'invalid_action'; end if;
  if p_use not in ('permanent', 'temporary') then raise exception 'invalid_use'; end if;
  if at_time > now() + interval '5 minutes' then raise exception 'time_in_future'; end if;
  select coalesce(nullif(full_name, ''), email, '') into uname from public.profiles where id = uid;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if v_vehicle.id is null then raise exception 'vehicle_not_found'; end if;

  if p_action = 'returned' then
    if not public.worker_holds_vehicle(uid, p_vehicle_id) then raise exception 'not_your_vehicle'; end if;
    update public.vehicle_assignments
      set ended_at = greatest(at_time, started_at), end_odometer = p_odometer
      where vehicle_id = p_vehicle_id and driver_id = uid and ended_at is null
      returning id into v_assignment_id;
    perform public.worker_set_odometer(p_vehicle_id, p_odometer, uid, at_time::date);
    returned_id := p_vehicle_id;
  else
    if v_vehicle.status <> 'in_use' then raise exception 'vehicle_not_available'; end if;
    if not coalesce(p_liability_ack, false) then raise exception 'liability_required'; end if;
    if coalesce(btrim(p_signature), '') = '' then raise exception 'signature_required'; end if;
    if p_use = 'temporary' and coalesce(v_checklist->>'dalkan_blocked', 'false') <> 'true' then
      raise exception 'dalkan_required';
    end if;

    if p_action = 'swapped' then
      if p_returned_vehicle_id is null or p_returned_vehicle_id = p_vehicle_id then raise exception 'returned_vehicle_required'; end if;
      if not public.worker_holds_vehicle(uid, p_returned_vehicle_id) then raise exception 'not_your_vehicle'; end if;
      update public.vehicle_assignments
        set ended_at = greatest(at_time, started_at), end_odometer = p_returned_odometer
        where vehicle_id = p_returned_vehicle_id and driver_id = uid and ended_at is null;
      perform public.worker_set_odometer(p_returned_vehicle_id, p_returned_odometer, uid, at_time::date);
      returned_id := p_returned_vehicle_id;
    end if;

    -- A vehicle has one holder: whoever held it before is closed at this moment.
    update public.vehicle_assignments
      set ended_at = greatest(at_time, started_at)
      where vehicle_id = p_vehicle_id and ended_at is null;

    insert into public.vehicle_assignments
      (vehicle_id, driver_id, driver_name, started_at, assignment_kind, liability_ack_at, start_odometer, created_by)
    values (p_vehicle_id, uid, uname, at_time, p_use, now(), p_odometer, uid)
    returning id into v_assignment_id;

    perform public.worker_set_odometer(p_vehicle_id, p_odometer, uid, at_time::date);

    if p_use = 'permanent' and coalesce(p_is_regular, false) then
      update public.vehicles set driver_id = uid, driver_name = uname, holder_type = 'driver' where id = p_vehicle_id;
    end if;
  end if;

  insert into public.vehicle_declaration_forms
    (vehicle_id, user_id, user_name, action, vehicle_use, is_regular_driver, happened_at, place, odometer,
     returned_vehicle_id, returned_odometer, checklist, liability_ack_at, signature_data, assignment_id)
  values (p_vehicle_id, uid, uname, p_action, p_use, coalesce(p_is_regular, false), at_time, coalesce(p_place, ''), p_odometer,
          returned_id, p_returned_odometer, v_checklist,
          case when p_action = 'returned' then null else now() end, p_signature, v_assignment_id)
  returning id into form_id;

  perform public.create_manager_notifications(
    'vehicle_declaration',
    case p_action when 'received' then 'קבלת רכב ' when 'swapped' then 'החלפת רכב ' else 'החזרת רכב ' end || v_vehicle.plate_number,
    uname || ' מילא/ה טופס הצהרה לרכב ' || v_vehicle.plate_number || '.'
  );
  return form_id;
end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'worker_my_vehicles()', 'worker_available_vehicles()', 'worker_my_forms()', 'worker_my_fuel_reports()',
    'worker_report_odometer(uuid, integer)', 'worker_report_fuel(uuid, date, numeric, numeric)',
    'worker_declare_vehicle(text, uuid, uuid, text, boolean, integer, integer, text, timestamptz, jsonb, text, boolean)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
