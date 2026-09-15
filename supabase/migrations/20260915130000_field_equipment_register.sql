create table if not exists public.field_equipment_imports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_file_name text not null,
  source_period date,
  raw_headers jsonb not null default '[]'::jsonb,
  display_headers jsonb not null default '[]'::jsonb,
  record_count integer not null default 0 check (record_count >= 0),
  encoding_warning boolean not null default false,
  imported_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.field_equipment_records (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.field_equipment_imports(id) on delete cascade,
  source_row_number integer not null check (source_row_number > 1),
  worker_name text not null,
  source_name_unreadable boolean not null default false,
  section_name text not null default 'ללא קבוצה',
  source_section text not null default '',
  checked_item_count integer not null default 0 check (checked_item_count >= 0),
  cells jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (import_id, source_row_number)
);

create index if not exists field_equipment_imports_created_at_idx
  on public.field_equipment_imports (created_at desc);
create index if not exists field_equipment_records_import_id_idx
  on public.field_equipment_records (import_id, source_row_number);

alter table public.field_equipment_imports enable row level security;
alter table public.field_equipment_records enable row level security;

drop policy if exists "field equipment imports managers only" on public.field_equipment_imports;
create policy "field equipment imports managers only" on public.field_equipment_imports
for all to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "field equipment records managers only" on public.field_equipment_records;
create policy "field equipment records managers only" on public.field_equipment_records
for all to authenticated
using (public.is_manager())
with check (public.is_manager());

