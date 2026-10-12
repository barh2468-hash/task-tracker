-- Vehicle fleet management, phase 1: vehicle register, documents, insurance
-- policies, inspections (טסט), toll subscriptions and monthly odometer readings.
--
-- Access: managers read and write everything. Every other role — field
-- workers, drafters, accounting — has no access to these tables or to the
-- private storage bucket. (The helper names is_fleet() / can_view_fleet() are
-- kept; both simply mean "is a manager".)

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('manager', 'field_worker', 'drafter', 'accounting', 'admin'));
-- 'admin' is not used by the app code but already exists on a production
-- profile row, so the constraint has to keep accepting it.

create or replace function public.is_fleet()
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
grant execute on function public.is_fleet() to authenticated;

create or replace function public.can_view_fleet()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_manager();
$$;
grant execute on function public.can_view_fleet() to authenticated;

-- ---------------------------------------------------------------- vehicles
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null check (length(btrim(plate_number)) > 0),
  kind text not null default 'car' check (kind in ('car', 'truck', 'trailer', 'other')),
  make_model text not null default '',
  manufacture_year integer check (manufacture_year is null or manufacture_year between 1980 and 2100),
  is_electric boolean not null default false,
  status text not null default 'in_use' check (
    status in ('expected', 'awaiting_insurance', 'awaiting_handover', 'in_use', 'in_service', 'retired')
  ),
  expected_arrival date,
  entered_on date,
  ownership text check (ownership is null or ownership in ('leasing', 'owned', 'rental')),
  ownership_label text not null default '',
  lease_start date,
  lease_end date,
  holder_type text not null default 'driver' check (holder_type in ('driver', 'office', 'company')),
  driver_name text not null default '',
  driver_id uuid references public.profiles(id) on delete set null,
  insurance_agent text not null default '',
  current_odometer integer check (current_odometer is null or current_odometer >= 0),
  retired_on date,
  retired_reason text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lease_end is null or lease_start is null or lease_end >= lease_start)
);

-- One register row per plate, however the plate is punctuated.
create unique index if not exists vehicles_plate_digits_key
  on public.vehicles ((regexp_replace(plate_number, '\D', '', 'g')));
create index if not exists vehicles_status_idx on public.vehicles(status);
create index if not exists vehicles_driver_idx on public.vehicles(driver_id) where driver_id is not null;

-- ------------------------------------------------------------- documents
create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  doc_type text not null check (
    doc_type in (
      'registration', 'insurance_mandatory', 'insurance_comprehensive', 'insurance_quote',
      'inspection', 'fine', 'fine_payment', 'declaration', 'swap_form', 'lease_contract',
      'condition_photo', 'other'
    )
  ),
  file_path text not null,
  original_name text not null default '',
  mime_type text,
  size_bytes bigint check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 10485760)),
  valid_to date,
  notes text not null default '',
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  check (mime_type is null or mime_type in ('application/pdf', 'image/jpeg', 'image/png'))
);
create index if not exists vehicle_documents_vehicle_idx
  on public.vehicle_documents(vehicle_id, uploaded_at desc);

-- ------------------------------------------------------ insurance policies
create table if not exists public.vehicle_insurance_policies (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  kind text not null check (kind in ('mandatory', 'comprehensive', 'third_party')),
  insurer text not null default '',
  agent text not null default '',
  policy_number text not null default '',
  valid_from date,
  valid_to date not null,
  premium_ils numeric(12, 2) check (premium_ils is null or premium_ils >= 0),
  source text not null default 'manual' check (source in ('manual', 'ai', 'import')),
  document_id uuid references public.vehicle_documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_from is null or valid_to >= valid_from)
);
create index if not exists vehicle_insurance_vehicle_idx
  on public.vehicle_insurance_policies(vehicle_id, valid_to desc);

-- ----------------------------------------------------------- inspections
create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  inspected_on date,
  valid_to date not null,
  result text not null default '',
  station text not null default '',
  notes text not null default '',
  document_id uuid references public.vehicle_documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vehicle_inspections_vehicle_idx
  on public.vehicle_inspections(vehicle_id, valid_to desc);

-- ------------------------------------------------------ toll subscriptions
create table if not exists public.vehicle_toll_subscriptions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  kind text not null check (
    kind in ('kvish6', 'pango', 'hatzut_zafon', 'carmel_tunnels', 'dalkan', 'traffilog')
  ),
  subscription_number text not null default '',
  updated_on date,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (vehicle_id, kind)
);

-- ------------------------------------------------------ odometer readings
create table if not exists public.vehicle_odometer_readings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  reading_month date not null check (reading_month = date_trunc('month', reading_month)::date),
  odometer_km integer not null check (odometer_km >= 0),
  read_on date not null default current_date,
  entered_by uuid references public.profiles(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (vehicle_id, reading_month)
);

-- Keep vehicles.current_odometer at the highest reading on record.
create or replace function public.sync_vehicle_odometer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vehicles
  set current_odometer = new.odometer_km, updated_at = now()
  where id = new.vehicle_id
    and (current_odometer is null or new.odometer_km >= current_odometer);
  return new;
end;
$$;

drop trigger if exists vehicle_odometer_sync on public.vehicle_odometer_readings;
create trigger vehicle_odometer_sync
after insert or update of odometer_km on public.vehicle_odometer_readings
for each row execute function public.sync_vehicle_odometer();

-- -------------------------------------------------------------------- RLS
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'vehicles', 'vehicle_documents', 'vehicle_insurance_policies',
    'vehicle_inspections', 'vehicle_toll_subscriptions', 'vehicle_odometer_readings'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists "%s fleet read" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s fleet insert" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s fleet update" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s fleet delete" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s fleet read" on public.%I for select using (public.can_view_fleet())',
      tbl, tbl
    );
    execute format(
      'create policy "%s fleet insert" on public.%I for insert with check (public.is_fleet())',
      tbl, tbl
    );
    execute format(
      'create policy "%s fleet update" on public.%I for update using (public.is_fleet()) with check (public.is_fleet())',
      tbl, tbl
    );
    execute format(
      'create policy "%s fleet delete" on public.%I for delete using (public.is_fleet())',
      tbl, tbl
    );
  end loop;
end $$;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-documents',
  'vehicle-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicle files fleet read" on storage.objects;
drop policy if exists "vehicle files fleet insert" on storage.objects;
drop policy if exists "vehicle files fleet update" on storage.objects;
drop policy if exists "vehicle files fleet delete" on storage.objects;

create policy "vehicle files fleet read" on storage.objects
for select using (bucket_id = 'vehicle-documents' and public.can_view_fleet());

create policy "vehicle files fleet insert" on storage.objects
for insert with check (bucket_id = 'vehicle-documents' and public.is_fleet());

create policy "vehicle files fleet update" on storage.objects
for update using (bucket_id = 'vehicle-documents' and public.is_fleet())
with check (bucket_id = 'vehicle-documents' and public.is_fleet());

create policy "vehicle files fleet delete" on storage.objects
for delete using (bucket_id = 'vehicle-documents' and public.is_fleet());
