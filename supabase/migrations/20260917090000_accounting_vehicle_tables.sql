-- Accounting feature: vehicle card-balance sync (flow 1) and year-end
-- balance-sheet reconciliation (flow 2). Access is accounting-role
-- exclusive — managers get no read access to these tables.

create or replace function public.is_accounting()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'accounting'
  );
$$;
grant execute on function public.is_accounting() to authenticated;

-- Audit/header row for every import (SAP sync, year-end payroll upload, or
-- the one-time historical seed).
create table if not exists public.accounting_imports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sap_sync', 'year_end_payroll', 'historical_seed')),
  year integer not null,
  source_file_name text not null,
  row_count integer not null default 0 check (row_count >= 0),
  matched_count integer not null default 0 check (matched_count >= 0),
  unmatched_count integer not null default 0 check (unmatched_count >= 0),
  diff_summary jsonb not null default '[]'::jsonb,
  imported_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- The living balance-sheet prep table (source workbook's "כרטיס" sheet
-- shape) — output of both flow 1 (SAP sync) and flow 2 (year-end).
create table if not exists public.accounting_card_balances (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  card_number text not null,
  ownership_type text not null default '',
  label text not null default '',
  plate_number text,
  driver_name text,
  balance_ils numeric(12, 2) not null default 0,
  notes text not null default '',
  last_import_id uuid references public.accounting_imports(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, card_number)
);

-- Payroll/vehicle hub upload for flow 2 (year-end) — the only source table
-- that carries both plate number and card number on the same row.
create table if not exists public.accounting_vehicle_payroll_records (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  import_id uuid not null references public.accounting_imports(id) on delete cascade,
  plate_number text not null,
  card_number text,
  driver_assignments jsonb not null default '[]'::jsonb,
  balance_trial_amount numeric(12, 2),
  extra_fields jsonb not null default '{}'::jsonb,
  notes text not null default '',
  link_status text not null default 'unlinked'
    check (link_status in ('linked', 'unlinked', 'resolved_manual', 'ignored')),
  linked_card_balance_id uuid references public.accounting_card_balances(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, plate_number)
);

-- Vehicle usage grid (plate x month -> driver) — historical reference only,
-- no ongoing upload flow for this shape.
create table if not exists public.accounting_vehicle_usage_records (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  plate_number text not null,
  monthly_drivers jsonb not null default '[]'::jsonb,
  vehicle_value_ils numeric(12, 2),
  created_at timestamptz not null default now(),
  unique (year, plate_number)
);

create index if not exists accounting_card_balances_card_number_idx
  on public.accounting_card_balances (card_number);
create index if not exists accounting_vehicle_payroll_records_card_number_idx
  on public.accounting_vehicle_payroll_records (card_number);
create index if not exists accounting_vehicle_payroll_records_link_status_idx
  on public.accounting_vehicle_payroll_records (link_status)
  where link_status <> 'linked';

alter table public.accounting_imports enable row level security;
alter table public.accounting_card_balances enable row level security;
alter table public.accounting_vehicle_payroll_records enable row level security;
alter table public.accounting_vehicle_usage_records enable row level security;

drop policy if exists "accounting imports accounting only" on public.accounting_imports;
create policy "accounting imports accounting only" on public.accounting_imports
for all to authenticated
using (public.is_accounting())
with check (public.is_accounting());

drop policy if exists "accounting card balances accounting only" on public.accounting_card_balances;
create policy "accounting card balances accounting only" on public.accounting_card_balances
for all to authenticated
using (public.is_accounting())
with check (public.is_accounting());

drop policy if exists "accounting payroll records accounting only" on public.accounting_vehicle_payroll_records;
create policy "accounting payroll records accounting only" on public.accounting_vehicle_payroll_records
for all to authenticated
using (public.is_accounting())
with check (public.is_accounting());

drop policy if exists "accounting usage records accounting only" on public.accounting_vehicle_usage_records;
create policy "accounting usage records accounting only" on public.accounting_vehicle_usage_records
for all to authenticated
using (public.is_accounting())
with check (public.is_accounting());
